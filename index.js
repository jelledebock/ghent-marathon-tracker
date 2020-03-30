var gpx = require('./lib/gpx');
var express = require('express');
var config = require('./config');
var authController = require('./controllers/auth-controller');
var mqtt = require('./lib/mqtt');
var bodyParser = require('body-parser')
var cookieParser = require('cookie-parser')();
var race_center = require('./lib/race-analytics')
var moment = require('moment');

var port = process.env.PORT || 3000;
var app = express();
var race_api = new race_center.FirebaseRaceCenter(mqtt);

app.use(express.static('public'))
app.set('view engine', 'ejs');
app.use(cookieParser);
app.use(async function(req, res, next) {
  // Grap render
  var _render = res.render;
  res.render = async function(view, options, cb) {
    var cur_user = await authController.user_object();
    if(cur_user)
      options.user = cur_user;
    else
      options.user = null;
    // Original call
    _render.call(this, view, options, cb)
  }
  next()
})

/**
 * Retrieves the status of the race (i.e. the config of a race)
 * ```{'is_live': false, 'tracking_ids':[], 'start_delay':[], "event_started_at":""};```
 * @returns JSON object
 */
app.get('/race_status', async function(req, res){
  return res.json(race_api.race_status);
});

/**
 * ADMIN FUNCTION --> only usable when logged in and when admin
 * 
 * Processes modified config object from the UI and stores it to the Firebase document.
 * Updateable are:
 *  - live status
 *  - tracking ids
 *  - delays (to start)
 *  - race start time
 * @returns JSON (the modified config object)
 */
app.post('/update_status', bodyParser.urlencoded({extended: true}), authController.checkIfAdmin, async function(req, res){
  var status = req.body;
  const millisec = status.event_started_at._seconds * 1e3 ;
  status.event_started_at = new Date(millisec);
  status.is_live = (status.is_live === "true");
  for(var i=0; i<status.start_delay_seconds.length; i++){
    status.start_delay_seconds[i] = parseInt(status.start_delay_seconds[i]);
  }
  console.log("Updating status to ",status);
  var updated_obj = await race_api.setLiveStatus(status);
  // Reload the cached race status (as we know it changed on the back-end, otherwise the back-end is only querried periodically)
  race_api.reload_config();

  return res.json(updated_obj);
})

/**
 * Find latest known location of the athlete with :tracking_id
 *  - Race_api returns an athlete status object containing:
 *    - Current location (lat, lon) pair
 *    - His actual speed (calculated based on last couple of status objects)
 *    - Elapsed distance and run time
 *    - Predicted finish time duration
 * @returns JSON with the data above
 */
app.get('/last_info/:tracking_id', function(req, res){
  var tracking_id = req.params.tracking_id;

  console.log("Getting stats of "+tracking_id);
  json_obj = race_api.getStatus(tracking_id);
  return res.json(json_obj);
});

/**
 * Returns a list of tracking_ids who we follow during the race
 * 
 * @returns JSON with the data above
 */
app.get('/tracking_ids', async function(req, res){
  return res.json(race_api.race_status.tracking_ids);
});

/**
 * Returns a list of the real names (human-readible) who we follow during the race (same sorting as tracking ids)
 * 
 * @returns JSON with the data above
 */
app.get('/real_names', async function(req, res){
  return res.json(race_api.race_status.real_names);
})

/**
 * ADMIN FUNCTION --> only usable when logged in and when admin
 * 
 * Do not confuse with GET login (which renders the login form html)
 * 
 * Logs in a user (matches credentials against firebase authentication db)
 * 
 * @returns JSON (redirects to the profile page if user authenticated)
 */
app.post('/login', bodyParser.urlencoded({extended: true}), function (req, res) {
  var response = {
      username: req.body.username,
      password: req.body.password

  };
  authController.loginUser(response.username, response.password).then(function(){
    authController.user_object().then(function(user_obj){
      req.user = user_obj;
      res.redirect('/user');
    })
  });  
});

/**
 * ADMIN FUNCTION --> only usable when logged in and when admin
 * 
 * Logs out the currently logged in user
 * 
 * @returns JSON (redirects to the profile page if user authenticated)
 */
app.get('/logout', authController.checkIfAuthenticated, function(req, res){
  authController.logOut().then(function(){
    authController.logOut();
    req.user = null;
    var current_location = mqtt.current_location;
    var parcours = gpx.parcours;
    res.render('pages/home', { title: 'Halve marathon 2 Tokyo', location: current_location, parcours: parcours });
  })
});

/**
 * ADMIN FUNCTION --> only usable when logged in and when admin
 * 
 * Shows the basic user info (just as a landing page purpose after login)
 * 
 * @returns HTML (renders the profile page)
 */
app.get('/user', authController.checkIfAuthenticated, function(req, res){
  var user = req.user;
  //console.log(req.user);
  res.render('pages/profile', {title: 'Userinfo of '+user.email});
});

/**
 * ADMIN FUNCTION --> only usable when logged in and when admin
 * 
 * Shortcut function:
 *  - Set race start to current (server times racetime).
 *  - @todo Check if heroku does this correctly as well!
 * 
 * @returns JSON (the modified config object)
 */
app.get('/set_start_time_now', bodyParser.urlencoded({extended: true}), authController.checkIfAdmin, async function(req, res){
  var status = await race_api.getPlatformStatus();
  console.log(status);
  status.event_started_at = new Date();
  var updated_obj = await race_api.setLiveStatus(status);
  race_api.reload_config();
  return res.json(updated_obj);
});

app.get('/login', function(req, res){
  res.render('pages/login', { title: 'Log in' })
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

app.get('/reset_race', bodyParser.urlencoded({extended: true}), authController.checkIfAdmin, async (req, res) => {
  race_api.resetRace();
  res.json({"message": "Race center status resetted!"});
});

app.get('/delete_db_last_day', bodyParser.urlencoded({extended: true}), authController.checkIfAdmin, async (req, res) => {
  var total_deletes = await mqtt.delete_last_day();
  var current_location = mqtt.current_location;
  var parcours = gpx.parcours;
  res.render('pages/home', { title: 'Halve marathon 2 Tokyo', location: current_location, parcours: parcours, 'message': "Successfully deleted "+total_deletes+" documents." });
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
  res.render('pages/home', { title: 'Halve marathon 2 Tokyo', location: current_location, parcours: parcours });
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

