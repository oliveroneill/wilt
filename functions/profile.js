const SpotifyWebApi = require('spotify-web-api-node');
const {BigQuery} = require('@google-cloud/bigquery');
const functions = require('firebase-functions');
const admin = require('firebase-admin');

const { getSpotifyClient } = require('./spotify');

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
  if (artistData === undefined) {
    throw new functions.https.HttpsError(
      'not-found', 'No data available for top artist'
    );
  }
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
      externalUrl: artistData.external_urls.spotify,
      spotifyUrl: artistData.uri
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
  if (trackData === undefined) {
    throw new functions.https.HttpsError(
      'not-found', 'No data available for top track'
    );
  }
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
      externalUrl: trackData.external_urls.spotify,
      spotifyUrl: trackData.uri
    }
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

exports.getSpotifyAuthToken = functions
  .region('asia-northeast1')
  .https.onRequest((req, res) => {
  // Create Spotify Web API instance using firebase function config
  const spotifyApi = new SpotifyWebApi({
    clientId: functions.config().spotify.client_id,
    clientSecret: functions.config().spotify.client_secret,
  });
  return spotifyApi.clientCredentialsGrant()
    .then(data => Promise.resolve(data.body))
    .then(data => res.status(200).send({ 'token': data.access_token }));
});
