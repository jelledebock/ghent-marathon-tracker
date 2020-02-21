// in sublime
var gpx = require('./lib/gpx');
var mqtt = require('./lib/mqtt');
var express = require('express');
var config = require('./config');
var authController = require('./controllers/auth-controller');
var bodyParser = require('body-parser')
var cookieParser = require('cookie-parser')();

var port = process.env.PORT || 3000;
var app = express();
var user;

app.use(express.static('public'))
app.set('view engine', 'ejs');
app.use(cookieParser);
app.use(function(req, res, next) {
  // Grap render
  var _render = res.render;
  res.render = function(view, options, cb) {
      options.user = user
    // Original call
    _render.call(this, view, options, cb)
  }
  next()
})

app.post('/login', bodyParser.urlencoded({extended: true}), function (req, res) {
  response = {
      username: req.body.username,
      password: req.body.password

  };    

  // authenticate the user here, but how ?
  authController.loginUser(response.username, response.password).then(function(){
    authController.user_object().then(function(user_obj){
      user = user_obj;
      res.render('pages/profile', {title: 'Userinfo of '+user.email});
    })
  });  
});

app.get('/logout', authController.checkIfAuthenticated, function(req, res){
  authController.logOut().then(function(){
    user = null;
    var current_location = mqtt.current_location;
    var parcours = gpx.parcours;
    res.render('pages/home', { title: 'Ghent 1/2 marathon race center', location: current_location, parcours: parcours });
  })
});

app.get('/user', authController.checkIfAuthenticated, function(req, res){
  var user = authController.user_object().then(function(user_obj){
    user = user_obj;
    res.render('pages/profile', {title: 'Userinfo of '+user.email});
  });
});

app.get('/login', function(req, res){
  res.render('pages/login', { title: 'Log in as admin!' })
});

app.get('/config', authController.checkIfAdmin, async (_, res) => {
  return res.json(config);
});  

app.get('/location', function (req, res) {
  res.json(mqtt.current_location);
});

app.get('/parcours', function (req, res) {
  res.json(gpx.parcours);
});

app.get('/', function (req, res) {
  var current_location = mqtt.current_location;
  var parcours = gpx.parcours;
  res.render('pages/home', { title: 'Ghent 1/2 marathon race center', location: current_location, parcours: parcours });
});

app.listen(port, function () {
  console.log("App started listening on "+port+"!");
  mqtt.initialize();
  gpx.intialize();
});

