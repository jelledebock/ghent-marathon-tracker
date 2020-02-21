import * as firebase from 'firebase/app';
import 'firebase/auth';
const CONFIG = require('../config');

const config = CONFIG.firebaseConfig;

firebase.initializeApp(config);

export const auth = firebase.auth

export default firebase;

