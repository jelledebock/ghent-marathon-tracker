// in sublime
var gpx = require('./lib/gpx');
var express = require('express');
var config = require('./config');
var authController = require('./controllers/auth-controller');
var mqtt = require('./lib/mqtt');
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

app.post('/upload_parcours', bodyParser.urlencoded({extended: true}), authController.checkIfAdmin, async (req, res) => {
   var parcours_url = req.body.parcours_url;
   var parcours_desc = req.body.parcours_name;
   gpx.download_gpx(parcours_url, parcours_desc).then(function(filename){
    res.json({'filename': filename});
   });
   
});

app.get('/config', authController.checkIfAdmin, async (_, res) => {
  var config_obj = {
    "tracking_ids": config.tracker_ids,
    "save_to_db": true,
    "parcours_gpx": config.gpx_path
  }
  res.render('pages/config', {title: 'Edit configuration (ADMIN)', config: JSON.stringify(config_obj)});
});  

app.post('/config', bodyParser.urlencoded({extended: true}), authController.checkIfAdmin, async (req, res) => {
  var config_data = req.body.updated_obj;
  config.tracker_ids = config_data.tracking_ids;
  config.save_to_db = JSON.parse(config_data.save_to_db);
  config.parcours_gpx = config_data.parcours_gpx;
  console.log(config);
  mqtt.disconnect();
  mqtt.initialize();
  gpx.intialize();
  res.json(config_data);
});

app.get('/delete_db_last_day', bodyParser.urlencoded({extended: true}), authController.checkIfAdmin, async (req, res) => {
  var total_deletes = await mqtt.delete_last_day();
  var current_location = mqtt.current_location;
  var parcours = gpx.parcours;
  res.render('pages/home', { title: 'Ghent 1/2 marathon race center', location: current_location, parcours: parcours, 'message': "Successfully deleted "+total_deletes+" documents." });
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

app.get('/last_day', async function(req, res){
  var data = await mqtt.get_last_day_data();
  res.json(data);
});

app.listen(port, function () {
  console.log("App started listening on "+port+"!");
  mqtt.initialize();
  gpx.intialize();

});

