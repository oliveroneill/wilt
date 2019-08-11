'use strict';

const SpotifyWebApi = require('spotify-web-api-node');
const {BigQuery} = require('@google-cloud/bigquery');
const functions = require('firebase-functions');
const cors = require('cors')({ origin: true });
const admin = require('firebase-admin');
admin.initializeApp();

function getUserData(spotifyApi) {
  return spotifyApi.getMe().then(data => Promise.resolve(data.body));
}

// Returns promise for the user ID that's now stored in Firestore
function storeUser(spotifyApi, spotifyData) {
  spotifyApi.setAccessToken(spotifyData.access_token);
  // Get the username so we can store it as the ID
  return getUserData(spotifyApi)
    .then(userData => {
      // Store Spotify data for user
      var db = admin.firestore();
      // Create ID
      const id = `spotify:${userData.id}`;
      // Store in Firestore
      const docRef = db.collection('users').doc(id);
      const now = new Date().getTime();
      docRef.set({
        access_token: spotifyData.access_token,
        expires_at: new Date(now + (1000 * spotifyData.expires_in)),
        refresh_token: spotifyData.refresh_token,
      });
      return Promise.resolve(id);
    });
}

// Create token for custom user
exports.signUp = functions
  .region('asia-northeast1')
  .https.onCall((data, context) => {
  // Create Spotify Web API instance using firebase function config
  const spotifyApi = new SpotifyWebApi({
    clientId: functions.config().spotify.client_id,
    clientSecret: functions.config().spotify.client_secret,
    redirectUri: data.spotifyRedirectUri,
  });
  // Authorise using the spotify code so we can store a refresh token
  // to periodically read user's play history
  return spotifyApi.authorizationCodeGrant(data.spotifyAuthCode)
    .then(data => Promise.resolve(data.body))
    // Store Spotify user auth and ID in Firestore
    // TODO: we probably shouldn't store the user until we've successfully
    // created a token. Since it still won't fail
    .then(data => storeUser(spotifyApi, data))
    .then(id => admin.auth().createCustomToken(id))
    .then(customToken => { return { 'token': customToken } });
});

exports.playsPerArtist = functions
    .region('asia-northeast1')
    .https.onCall((data, context) => {
  // Checking that the user is authenticated.
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated', 'The function must be called while authenticated'
    );
  }
  const user = context.auth.uid;
  var start = data.start;
  if (start === undefined) {
    throw new functions.https.HttpsError(
      'invalid-argument', 'Missing start parameter'
    );
  }
  // The SQL query requires integers so we clamp values as needed
  start = Math.floor(start);
  var end = data.end;
  if (end === undefined) {
    throw new functions.https.HttpsError(
      'invalid-argument', 'Missing end parameter'
    );
  }
  // The SQL query requires integers so we clamp values as needed
  end = Math.ceil(end);
  // Set extract SQL query based on group by
  var extract;
  var interval = data.group_by;
  switch (interval) {
    case 'day':
        extract = 'DAYOFYEAR';
        break;
    case 'week':
        extract = 'WEEK';
        break;
    case 'month':
        extract = 'MONTH';
        break;
    default:
        // Default to grouping by month
        extract = 'MONTH';
        interval = 'MONTH';
  }
  const bigQuery = new BigQuery();
  const sqlQuery = `
  SELECT
    primary_artist,
    ARRAY_AGG(playdate) AS dates,
    ARRAY_AGG(events) AS events
  FROM (
      SELECT
        period,
        FORMAT_DATE("%F", playdate) AS playdate,
        primary_artist,
        SUM(count) AS events
      FROM (
          SELECT
            grouped.period,
            grouped.year,
            grouped.playdate,
            grouped.primary_artist,
            IFNULL(count, 0) AS count
          FROM (
            wilt_play_history.play_history
            CROSS JOIN (
              SELECT 1 AS count
            )
          )
          RIGHT JOIN (
            SELECT
              period_data.period,
              period_data.year,
              period_data.playdate,
              primary_artist
            FROM (
                SELECT
                  DISTINCT primary_artist
                FROM
                  wilt_play_history.play_history
                WHERE
                  user_id = @user
                  AND UNIX_SECONDS(date) BETWEEN @start AND @end
            ) as history CROSS JOIN (
              SELECT
                period AS playdate,
                EXTRACT(${extract} FROM period) AS period,
                EXTRACT(YEAR FROM period) AS year
              FROM
                UNNEST(
                  GENERATE_DATE_ARRAY(
                    DATE(
                      TIMESTAMP_SECONDS(@start)
                    ),
                    DATE(
                      TIMESTAMP_SECONDS(@end)
                    ),
                    INTERVAL 1 ${interval}
                  )
                ) AS period
            ) AS period_data
          ) AS grouped ON EXTRACT(
            ${extract}
            FROM play_history.date
          ) = grouped.period
          AND EXTRACT(
            YEAR
            FROM play_history.date
          ) = grouped.year
          AND grouped.primary_artist = play_history.primary_artist
          AND play_history.user_id = @user
      )
      GROUP BY
        period,
        year,
        playdate,
        primary_artist
      ORDER BY
        period,
        year
  )
  GROUP BY primary_artist`;

  var job;
  return bigQuery.createQueryJob({
    query: sqlQuery,
    params: {
      user: user,
      start: start,
      end: end,
    },
  }).then(results => {
      job = results[0];
      console.log(`Job ${job.id} started.`);
      return job.promise();
    })
    .then(() => job.getMetadata())
    .then(() => {
      console.log(`Job ${job.id} completed.`);
      return job.getQueryResults();
    })
    .then(([rows]) => {
      return rows;
    });
});

exports.getTopArtistPerWeek = functions
  .region('asia-northeast1')
  .https.onCall((data, context) => {
  // Checking that the user is authenticated.
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated', 'The function must be called while authenticated'
    );
  }
  const user = context.auth.uid;
  var start = data.start;
  if (start === undefined) {
    throw new functions.https.HttpsError(
      'invalid-argument', 'Missing start parameter'
    );
  }
  // The SQL query requires integers so we clamp values as needed
  start = Math.floor(start);
  var end = data.end;
  if (end === undefined) {
    throw new functions.https.HttpsError(
      'invalid-argument', 'Missing end parameter'
    );
  }
  // The SQL query requires integers so we clamp values as needed
  end = Math.ceil(end);
  // Set extract SQL query based on group by
  var extract = 'WEEK';
  var interval = 'WEEK';
  const bigQuery = new BigQuery();
  const sqlQuery = `
  WITH subquery AS (
    SELECT
      period,
      year,
      playdate,
      primary_artist,
      SUM(count) AS events
    FROM (
      SELECT
        grouped.period,
        grouped.year,
        grouped.playdate,
        grouped.primary_artist,
        count
      FROM (
        wilt_play_history.play_history
        CROSS JOIN (
          SELECT 1 AS count
        )
      )
      RIGHT JOIN (
        SELECT
          period_data.period,
          period_data.year,
          period_data.playdate,
          primary_artist
        FROM (
          SELECT
          DISTINCT primary_artist
          FROM wilt_play_history.play_history
          WHERE user_id=@user AND UNIX_SECONDS(date) BETWEEN @start AND @end
        ) as history
        CROSS JOIN (
          SELECT period AS playdate, EXTRACT(${extract} FROM period) AS period, EXTRACT(YEAR FROM period) AS year
          FROM UNNEST(
              GENERATE_DATE_ARRAY(DATE(TIMESTAMP_SECONDS(@start)), DATE(TIMESTAMP_SECONDS(@end)), INTERVAL 1 ${interval})
          ) AS period
        ) AS period_data
      ) AS grouped ON EXTRACT(${extract} FROM play_history.date) = grouped.period AND
        EXTRACT(YEAR FROM play_history.date) = grouped.year AND
        grouped.primary_artist = play_history.primary_artist AND
        play_history.user_id = @user
        WHERE count IS NOT NULL
    ) GROUP BY period, year, playdate, primary_artist)
    SELECT MAX(sq.primary_artist) AS top_artist, MAX(sq.events) AS count,
      FORMAT_DATE("%F", sq.playdate) AS date, FORMAT('%d-%d', sq.period, sq.year) AS week FROM subquery sq,
    (SELECT MAX(events) AS count, playdate, period, year FROM subquery GROUP BY playdate, period, year) max_results
    WHERE sq.playdate = max_results.playdate AND sq.events = max_results.count AND
    sq.period = max_results.period AND sq.year = max_results.year
    GROUP BY sq.playdate, sq.period, sq.year ORDER BY sq.playdate DESC;`;

  var job;
  return bigQuery.createQueryJob({
    query: sqlQuery,
    params: {
      user: user,
      start: start,
      end: end,
    },
  }).then(results => {
      job = results[0];
      console.log(`Job ${job.id} started.`);
      return job.promise();
    })
    .then(() => job.getMetadata())
    .then(() => {
      console.log(`Job ${job.id} completed.`);
      return job.getQueryResults();
    })
    .then(([rows]) => {
      return addImages(rows, user);
    });
});

function getImageForArtist(spotifyApi, artist) {
  return spotifyApi.searchArtists(artist.top_artist)
  .then(result => {
    artist.imageUrl = result.body.artists.items[0].images[0].url;
    return Promise.resolve(artist);
  });
}

function addImages(artistList, user) {
    return getSpotifyClient(user)
    .then(spotifyApi => {
      let promises = artistList.map(artist => {
        return getImageForArtist(spotifyApi, artist);
      });
      return Promise.all(promises);
    });
}

function getNumberOfPlays(bigQuery, artistName, userName) {
  var job;
  return bigQuery.createQueryJob({
    query: `SELECT COUNT(*) AS count FROM wilt_play_history.play_history
      WHERE primary_artist = '${artistName}' AND user_id = '${userName}'`,
  }).then(results => {
      job = results[0];
      console.log(`Job ${job.id} started.`);
      return job.promise();
    })
    .then(() => job.getMetadata())
    .then(() => {
      console.log(`Job ${job.id} completed.`);
      return job.getQueryResults();
    })
    .then(([rows]) => {
      // Return zero if this artist hasn't been played
      if (rows.length === 0) return 0;
      return rows[0].count;
    });
}

function getDateLastPlayed(bigQuery, artistName, userName) {
  var job;
  return bigQuery.createQueryJob({
    query: `SELECT date FROM wilt_play_history.play_history
      WHERE primary_artist = '${artistName}' AND user_id = '${userName}' ORDER BY date DESC LIMIT 1`,
  }).then(results => {
      job = results[0];
      console.log(`Job ${job.id} started.`);
      return job.promise();
    })
    .then(() => job.getMetadata())
    .then(() => {
      console.log(`Job ${job.id} completed.`);
      return job.getQueryResults();
    })
    .then(([rows]) => {
      // Return null if this artist hasn't been played
      if (rows.length === 0) return null;
      return rows[0].date;
    });
}

function getArtistInfo(artistData, userName) {
  const bigQuery = new BigQuery();
  const artistName = artistData.name;
  return Promise.all(
    [
      getNumberOfPlays(bigQuery, artistName, userName),
      getDateLastPlayed(bigQuery, artistName, userName),
    ]
  ).then(values => {
    return {
      name: artistName,
      count: values[0],
      lastPlay: values[1],
      imageUrl: artistData.images[0].url,
    }
  });
}

function getDateLastPlayedForTrack(bigQuery, trackID, userName) {
  var job;
  return bigQuery.createQueryJob({
    query: `SELECT date FROM wilt_play_history.play_history
      WHERE track_id = '${trackID}' AND user_id = '${userName}' ORDER BY date DESC LIMIT 1`,
  }).then(results => {
      job = results[0];
      console.log(`Job ${job.id} started.`);
      return job.promise();
    })
    .then(() => job.getMetadata())
    .then(() => {
      console.log(`Job ${job.id} completed.`);
      return job.getQueryResults();
    })
    .then(([rows]) => {
      // Return null if this artist hasn't been played
      if (rows.length === 0) return null;
      return rows[0].date;
    });
}

function getTotalPlayTime(bigQuery, trackID, userName, durationMs) {
  var job;
  return bigQuery.createQueryJob({
    query: `SELECT COUNT(*) AS count FROM wilt_play_history.play_history
      WHERE track_id = '${trackID}' AND user_id = '${userName}'`,
  }).then(results => {
      job = results[0];
      console.log(`Job ${job.id} started.`);
      return job.promise();
    })
    .then(() => job.getMetadata())
    .then(() => {
      console.log(`Job ${job.id} completed.`);
      return job.getQueryResults();
    })
    .then(([rows]) => {
      // Return zero if this track hasn't been played
      if (rows.length === 0) return 0;
      return rows[0].count * durationMs;
    });
}

function getTrackInfo(trackData, userName) {
  const bigQuery = new BigQuery();
  // Just use the first artists name for now
  const trackName = `${trackData.name} by ${trackData.artists[0].name}`;
  const trackID = trackData.id;
  return Promise.all(
    [
      getTotalPlayTime(bigQuery, trackID, userName, trackData.duration_ms),
      getDateLastPlayedForTrack(bigQuery, trackID, userName),
    ]
  ).then(values => {
    return {
      name: trackName,
      totalPlayTimeMs: values[0],
      lastPlay: values[1],
      imageUrl: trackData.album.images[0].url,
    }
  });
}

function getSpotifyClient(user) {
  // Create Spotify Web API instance using firebase function config
  const spotifyApi = new SpotifyWebApi({
    clientId: functions.config().spotify.client_id,
    clientSecret: functions.config().spotify.client_secret,
  });
  let db = admin.firestore();
  return db.collection('users').doc(user).get()
    .then(snapshot => {
      const doc = snapshot.data();
      spotifyApi.setAccessToken(doc.access_token);
      spotifyApi.setRefreshToken(doc.refresh_token);
      return spotifyApi.refreshAccessToken()
    })
    .then(data => {
      spotifyApi.setAccessToken(data.body.access_token);
      return Promise.resolve(spotifyApi);
    });
}

exports.topArtist = functions
  .region('asia-northeast1')
  .https.onCall((data, context) => {
  // Checking that the user is authenticated.
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated', 'The function must be called while authenticated'
    );
  }
  var timeRange = data.timeRange;
  if (timeRange === undefined) {
    throw new functions.https.HttpsError(
      'invalid-argument', 'Missing time range parameter'
    );
  }
  var index = data.index;
  if (index === undefined) {
    throw new functions.https.HttpsError(
      'invalid-argument', 'Missing index parameter'
    );
  }
  const user = context.auth.uid;
  return getSpotifyClient(user)
    .then(spotifyApi => {
      return spotifyApi.getMyTopArtists({limit: 1, time_range: timeRange, offset: index});
    })
    .then(data => getArtistInfo(data.body.items[0], user));
});

exports.topTrack = functions
  .region('asia-northeast1')
  .https.onCall((data, context) => {
  // Checking that the user is authenticated.
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated', 'The function must be called while authenticated'
    );
  }
  var timeRange = data.timeRange;
  if (timeRange === undefined) {
    throw new functions.https.HttpsError(
      'invalid-argument', 'Missing time range parameter'
    );
  }
  var index = data.index;
  if (index === undefined) {
    throw new functions.https.HttpsError(
      'invalid-argument', 'Missing index parameter'
    );
  }
  const user = context.auth.uid;
  return getSpotifyClient(user)
    .then(spotifyApi => {
      return spotifyApi.getMyTopTracks({limit: 1, time_range: timeRange, offset: index});
    })
    .then(data => getTrackInfo(data.body.items[0], user));
});
