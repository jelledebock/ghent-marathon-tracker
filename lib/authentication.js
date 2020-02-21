var admin = require("firebase-admin");
var firebase = require('firebase');
var admin_uuid = 'Wi6CYUX5OhPbeXLun8Zkg1CFVfy1';

var serviceAccount = require("../config/gps-tracker-443da-firebase-adminsdk-8rn7g-1b5f9d7bd6.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://gps-tracker-443da.firebaseio.com"
});
admin.auth().setCustomUserClaims(admin_uuid, {admin: true});

const config = require('../config');
firebase.initializeApp(config.firebaseConfig);

module.exports.admin = admin;
module.exports.auth = firebase.auth;
