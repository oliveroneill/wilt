const {BigQuery} = require('@google-cloud/bigquery');
const functions = require('firebase-functions');

const { getSpotifyClient } = require('./spotify');

function addURLs(track, user) {
  return getSpotifyClient(user)
    .then(spotifyApi => {
      return spotifyApi.getTrack(track.track_id);
    })
    .then(result => {
      track.imageUrl = result.body.album.images[0].url;
      track.externalUrl = result.body.external_urls.spotify;
      return Promise.resolve(track);
    });
}

function generateQueryString(before, after, artistSearchQuery) {
  console.log('query before:', artistSearchQuery);
  if (artistSearchQuery !== null) {
    artistSearchQuery = artistSearchQuery.toLowerCase();
  }
  console.log('query:', artistSearchQuery);
  const couldPickupCommonWord = artistSearchQuery === 't' || artistSearchQuery === 'th';
  return `
    SELECT primary_artist AS artist_name, date, name AS song_name, track_id
    FROM wilt_play_history.play_history
    WHERE user_id = @user
    AND ${before === null ? 'UNIX_SECONDS(date) > @after' : 'UNIX_SECONDS(date) < @before'}
    ${artistSearchQuery !== null ? `AND (LOWER(primary_artist) LIKE '${artistSearchQuery}%'` : ''}
    ${artistSearchQuery !== null ? `OR LOWER(primary_artist) LIKE '% ${artistSearchQuery}%')` : ''}
    ${couldPickupCommonWord ? `AND LOWER(primary_artist) NOT LIKE '% the %'` : ''}
    ORDER BY date DESC
    LIMIT @limit
  `;
}

exports.getTrackHistory = functions
  .region('asia-northeast1')
  .https.onCall((data, context) => {
  // Checking that the user is authenticated.
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated', 'The function must be called while authenticated'
    );
  }
  const user = context.auth.uid;
  var limit = data.limit;
  if (limit === undefined) {
    throw new functions.https.HttpsError(
      'invalid-argument', 'Missing limit parameter'
    );
  }
  var sqlQuery = undefined;
  var after = data.after;
  var before = data.before;
  var artistSearchQuery = data.artist_search_query;
  if (after !== null) {
    // The SQL query requires integers so we clamp values as needed
    after = Math.floor(after);
    sqlQuery = {
      query: generateQueryString(null, after, artistSearchQuery),
      params: {
        user: user,
        after: after,
        limit: limit,
      },
    };
  } else if (before !== null) {
    // The SQL query requires integers so we clamp values as needed
    before = Math.ceil(before);
    sqlQuery = {
      query: generateQueryString(before, null, artistSearchQuery),
      params: {
        user: user,
        before: before,
        limit: limit,
      },
    };
  } else {
    throw new functions.https.HttpsError(
      'invalid-argument', 'Missing after or before parameter'
    );
  }
  // Set extract SQL query based on group by
  const bigQuery = new BigQuery();
  var job;
  return bigQuery.createQueryJob(sqlQuery)
  .then(results => {
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
      return Promise.all(
        rows.map(track => {
          return addURLs(track, user);
        })
      );
    });
});
