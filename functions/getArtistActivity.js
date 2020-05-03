const {BigQuery} = require('@google-cloud/bigquery');
const functions = require('firebase-functions');

exports.getArtistActivity = functions
    .region('asia-northeast1')
    .https.onCall((data, context) => {
  // Checking that the user is authenticated.
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated', 'The function must be called while authenticated'
    );
  }
  const user = context.auth.uid;
  var artist = data.artist;
  if (artist === undefined) {
    throw new functions.https.HttpsError(
      'invalid-argument', 'Missing artist parameter'
    );
  }
  const bigQuery = new BigQuery();
  const sqlQuery = `
  WITH plays AS (
    SELECT
      COUNT(*) AS plays,
      MIN(date) AS date,
      EXTRACT(MONTH FROM date) AS month,
      EXTRACT(YEAR FROM date) AS year
    FROM wilt_play_history.play_history
    WHERE primary_artist = @artist
    AND user_id = @user
    GROUP BY month, year
  )
  SELECT IFNULL(plays.plays, 0) AS plays, DATE(months.year, months.month, 1) AS date
  FROM (
    SELECT
      EXTRACT(MONTH FROM period) AS month,
       EXTRACT(YEAR FROM period) AS year
    FROM
    UNNEST(
      GENERATE_DATE_ARRAY(
        DATE((SELECT MIN(date) FROM plays)),
        DATE_ADD(DATE((SELECT MAX(date) FROM plays)), INTERVAL 1 MONTH),
        INTERVAL 1 MONTH
       )
      ) period
  ) AS months
  LEFT JOIN plays
  ON plays.month = months.month AND plays.year = months.year
  ORDER BY months.year DESC, months.month DESC
  `;
  var job;
  return bigQuery.createQueryJob({
    query: sqlQuery,
    params: {
      user: user,
      artist: artist,
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
