// in sublime
var express = require('express');
var config = require('./config');
const mqtt = require('mqtt');
const gpxParse = require('parse-gpx');
const haversine = require('haversine');

var client;
var port = process.env.PORT || 3000;

var app = express();
var curr_location = {};
var parcours = {};

app.get('/location', function (req, res) {
  res.json(curr_location);
});

app.get('/parcours', function (req, res) {
  res.json(parcours);
});

app.get('/', function (req, res) {
  res.send('Hello world!');
});

app.listen(port, function () {
  console.log("App started listening on "+port+"!");
  console.log(config.gpx_path);
  gpxParse(config.gpx_path).then(track =>{
    var calc_dist = 0;
    parcours['points']=[];
    for(var i=0; i<track.length; i++){
      if(i>0){
        lat1 = track[i-1].latitude;
        lon1 = track[i-1].longitude;
        lat2 = track[i].latitude;
        lon2 = track[i].longitude;
        ele = track[i].elevation;
        calc_dist+=haversine({'latitude':lat1, 'longitude':lon1}, {'latitude':lat2, 'longitude': lon2}, {unit: 'meter'});
        parcours['points'].push([lat2, lon2, ele]);
        //console.log(parcours);
        //console.log('Cumm distance '+calc_dist);
      }
    }
    parcours['total_distance'] = calc_dist;
  });

  client = mqtt.connect('mqtt://broker.hivemq.com');
  client.on('connect', ()=>{
    console.log("Connected to MQTT location stream.");
    client.subscribe('owntracks/ghentmarathon/+');
  });
  
  client.on('message', (topic, message) => {
    var athlete = topic.split('/').pop();
    var location_obj = JSON.parse(message.toString());
    console.log("Got location update of "+athlete);
    if(!(curr_location[athlete]) && config.tracker_ids.includes(athlete)){
      curr_location[athlete]={"latitude": -1, "longitude": -1, "timestamp": -1};
    }
    if(config.tracker_ids.includes(athlete)){
      curr_location[athlete].latitude=location_obj.lat
      curr_location[athlete].longitude = location_obj.lon
      curr_location[athlete].timestamp = location_obj.tst
    }

    
    console.log(message.toString());
  })
});

