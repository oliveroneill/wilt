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
exports.signUp = functions.https.onCall((data, context) => {
  // Create Spotify Web API instance using firebase function config
  const spotifyApi = new SpotifyWebApi({
    clientId: functions.config().spotify.client_id,
    clientSecret: functions.config().spotify.client_secret,
    redirectUri: functions.config().spotify.redirect_uri
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

exports.playsPerArtist = functions.https.onCall((data, context) => {
  const user = context.auth.uid;
  var start = data.start;
  if (start === undefined) {
    throw new Error('Missing start parameter');
  }
  // The SQL query requires integers so we clamp values as needed
  start = Math.floor(start);
  var end = data.end;
  if (end === undefined) {
    throw new Error('Missing end parameter');
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
  SELECT primary_artist, ARRAY_AGG(playdate) AS dates, ARRAY_AGG(events) AS events FROM (
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
        grouped.primary_artist = play_history.primary_artist
    ) GROUP BY period, year, playdate, primary_artist ORDER BY period, year
  ) GROUP BY primary_artist`;

  return bigQuery.query({
    query: sqlQuery,
    params: {
      user: user,
      start: start,
      end: end,
    },
  }).then(([rows]) => {
    return rows;
  });
});
