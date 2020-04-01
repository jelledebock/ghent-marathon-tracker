var admin = require("firebase-admin");
var firebase = require('firebase');
var admin_uuid = 'Wi6CYUX5OhPbeXLun8Zkg1CFVfy1';

var serviceAccount = require("../config/gps-tracker-443da-firebase-adminsdk-8rn7g-af34154f2c.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://gps-tracker-443da.firebaseio.com"
});
admin.auth().setCustomUserClaims(admin_uuid, {admin: true});

const config = require('../config');
firebase.initializeApp(config.firebaseConfig);
firebase.auth().setPersistence(firebase.auth.Auth.Persistence.NONE);

module.exports.firebase = firebase;
module.exports.auth = admin.auth;
