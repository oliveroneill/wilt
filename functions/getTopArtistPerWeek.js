const {BigQuery} = require('@google-cloud/bigquery');
const functions = require('firebase-functions');

const { getSpotifyClient } = require('./spotify');

function getImageForArtist(spotifyApi, artist) {
  return spotifyApi.searchArtists(artist.top_artist)
  .then(result => {
    const artistData = result.body.artists.items[0];
    artist.imageUrl = artistData.images[0].url;
    artist.externalUrl = artistData.external_urls.spotify;
    artist.spotifyUrl = artistData.uri;
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
WITH plays_per_week AS (
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
      wilt_play_history.play_history CROSS JOIN (
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
        SELECT DISTINCT primary_artist
        FROM
          wilt_play_history.play_history
        WHERE
          user_id = @user
          AND UNIX_SECONDS(date) BETWEEN @start AND @end
      ) as history CROSS JOIN (
        SELECT
          period AS playdate,
          EXTRACT(
            ${extract}
            FROM period
          ) AS period,
          EXTRACT(
            YEAR
            FROM
              period
          ) AS year
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
    WHERE count IS NOT NULL
  )
  GROUP BY
    period,
    year,
    playdate,
    primary_artist
)

SELECT
  MAX(per_week.primary_artist) AS top_artist,
  MAX(per_week.events) AS count,
  FORMAT_DATE("%F", per_week.playdate) AS date,
  FORMAT('%d-%d', per_week.period, per_week.year) AS week
FROM
  plays_per_week per_week,
  (
    SELECT
      MAX(events) AS count,
      playdate,
      period,
      year
    FROM plays_per_week
    GROUP BY
      playdate,
      period,
      year
  ) max_results
WHERE
  per_week.playdate = max_results.playdate
  AND per_week.events = max_results.count
  AND per_week.period = max_results.period
  AND per_week.year = max_results.year
GROUP BY
  per_week.playdate,
  per_week.period,
  per_week.year
ORDER BY per_week.playdate DESC;`;

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
