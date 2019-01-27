'use strict';

const escapeHtml = require('escape-html');
const {BigQuery} = require('@google-cloud/bigquery');

const functions = require('firebase-functions');
const cors = require('cors')({ origin: true });
const admin = require('firebase-admin');
admin.initializeApp();

// Create token for custom user
exports.signUp = functions.https.onCall((data, context) => {
  return admin.auth().createCustomToken(data.user_id)
    .then(customToken => { return { 'token': customToken } })
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
  var interval = escapeHtml(data.group_by);
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
