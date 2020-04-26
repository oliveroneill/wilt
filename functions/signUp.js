const SpotifyWebApi = require('spotify-web-api-node');
const functions = require('firebase-functions');
const admin = require('firebase-admin');

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
