'use strict';

const cors = require('cors')({ origin: true });
const admin = require('firebase-admin');
admin.initializeApp();

const { topArtist, topTrack, getSpotifyAuthToken } = require('./profile');
const { getTopArtistPerWeek } = require('./getTopArtistPerWeek');
const { playsPerArtist } = require('./playsPerArtist');
const { signUp } = require('./signUp');
const { getArtistActivity } = require('./getArtistActivity');

exports.topArtist = topArtist;
exports.topTrack = topTrack;
exports.getSpotifyAuthToken = getSpotifyAuthToken;
exports.getTopArtistPerWeek = getTopArtistPerWeek;
exports.playsPerArtist = playsPerArtist;
exports.signUp = signUp;
exports.getArtistActivity = getArtistActivity;
