// in sublime
var gpx = require('./lib/gpx-controller');
var mqtt = require('./lib/mqtt-controller');
var express = require('express');
var config = require('./config');
var passport = require('passport');

var port = process.env.PORT || 3000;
var app = express();

app.post('/login',
  passport.authenticate('local'),
  function(req, res) {
    // If this function gets called, authentication was successful.
    // `req.user` contains the authenticated user.
    res.redirect('/config');
  });

app.get('/config',  passport.authenticate('local'), function(req, res){
  res.json(config);
})

app.get('/location', function (req, res) {
  res.json(mqtt.current_location);
});

app.get('/parcours', function (req, res) {
  res.json(gpx.parcours);
});

app.get('/', function (req, res) {
  res.send('Hello world!');
});

app.listen(port, function () {
  console.log("App started listening on "+port+"!");
  mqtt.initialize();
  gpx.intialize();
});

