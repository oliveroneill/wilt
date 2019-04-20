const chai = require('chai');
const assert = chai.assert;
const sinon = require('sinon');

// Require firebase-admin so we can stub its methods
const admin = require('firebase-admin');
// Offline mode by default
const test = require('firebase-functions-test')();
const SpotifyWebApi = require('spotify-web-api-node');

test.mockConfig(
  { spotify: { client_id: '', client_secret: '', redirect_uri: '' } }
);

describe('Sign up function', () => {
  const spotifyId = 'a_random_id';
  const accessToken = 'a_random_token';
  const refreshToken = 'a_random_refresh_token';
  const customToken = 'a_custom_token';

  let functions, adminInitStub, adminFirestoreStub, adminAuthStub;
  let createCustomTokenStub, databaseSetStub;
  let spotifyAuthStub, spotifyMeStub;

  beforeEach(() => {
    // Setup stubs
    adminInitStub = sinon.stub(admin, 'initializeApp');
    adminFirestoreStub = sinon.stub(admin, 'firestore');
    adminAuthStub = sinon.stub(admin, 'auth');
    databaseSetStub = sinon.stub();
    adminFirestoreStub.get(() => {
      return () => {
        return {
          collection: () => {
            return {
              doc: () => {
                return {
                  set: databaseSetStub,
                }
              },
            }
          },
          settings: () => {},
        }
      }
    });
    createCustomTokenStub = sinon.stub().returns(Promise.resolve(customToken));
    adminAuthStub.get(() => {
      return () => {
        return {
          createCustomToken: createCustomTokenStub,
        }
      }
    });
    spotifyAuthStub = sinon.stub(SpotifyWebApi.prototype, 'authorizationCodeGrant');
    spotifyMeStub = sinon.stub(SpotifyWebApi.prototype, 'getMe');
    spotifyAuthStub.returns(
      Promise.resolve(
        {
          body: {
            access_token: accessToken,
            expires_in: 1549176390,
            refresh_token: refreshToken,
          }
        }
      )
    );
    spotifyMeStub.returns(
      Promise.resolve(
        {
          body: {
            id: spotifyId,
          }
        }
      )
    );
    // We're testing index.js
    functions = require('../index.js');
  });

  afterEach(() => {
    // Restore admin.initializeApp() to its original method.
    adminInitStub.restore();
    adminFirestoreStub.restore();
    adminAuthStub.restore();
    spotifyAuthStub.restore();
    spotifyMeStub.restore();
    // Do other cleanup tasks.
    test.cleanup();
  });

  it('stores user data on sign up', () => {
    const authCode = 'random_auth_code';
    const data = {
      spotifyAuthCode: authCode,
    };
    return functions.signUp.run(data, {}).then(result => {
      // Check spotify auth stub is called correctly
      const authArgs = spotifyAuthStub.getCall(0).args[0];
      assert.equal(authArgs, authCode);
      // Check db store is called correctly
      const dbArgs = databaseSetStub.getCall(0).args[0];
      const expectedDBArgs = {
        access_token: accessToken,
        refresh_token: refreshToken
      };
      assert.equal(dbArgs.access_token, expectedDBArgs.access_token);
      assert.equal(dbArgs.refresh_token, expectedDBArgs.refresh_token);
      // Check custom token is created correctly
      const tokenArgs = createCustomTokenStub.getCall(0).args[0];
      assert.equal(tokenArgs, 'spotify:' + spotifyId);
      // Check the custom token created matches
      assert.deepEqual(result, { token: customToken });
      return null;
    }).catch(e => {
      assert.fail(e);
    });
  });

  it('errors if auth fails', () => {
    const authCode = 'random_auth_code';
    const data = {
      spotifyAuthCode: authCode,
    };
    const expected = new Error("Just a test error")
    spotifyAuthStub.returns(Promise.reject(expected));
    return functions.signUp.run(data, {}).then(result => {
      assert.fail("We succeeded somehow");
      return null;
    }).catch(e => {
      assert.equal(e, expected);
    });
  });

  it('errors if user data call fails', () => {
    const authCode = 'random_auth_code';
    const data = {
      spotifyAuthCode: authCode,
    };
    const expected = new Error("Just a test error")
    spotifyMeStub.returns(Promise.reject(expected));
    return functions.signUp.run(data, {}).then(result => {
      assert.fail("We succeeded somehow");
      return null;
    }).catch(e => {
      assert.equal(e, expected);
    });
  });

  it('errors if custom token creation fails', () => {
    const authCode = 'random_auth_code';
    const data = {
      spotifyAuthCode: authCode,
    };
    const expected = new Error("Just a test error")
    createCustomTokenStub.returns(Promise.reject(expected));
    return functions.signUp.run(data, {}).then(result => {
      assert.fail("We succeeded somehow");
      return null;
    }).catch(e => {
      assert.equal(e, expected);
    });
  });
});
