const SpotifyWebApi = require('spotify-web-api-node');
const functions = require('firebase-functions');
const admin = require('firebase-admin');

exports.getSpotifyClient = function(user) {
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
