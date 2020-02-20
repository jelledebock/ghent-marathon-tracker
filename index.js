// in sublime
var express = require('express');
const mqtt = require('mqtt')
const client = mqtt.connect('mqtt://broker.hivemq.com')

var port = process.env.PORT || 3000;

var app = express();
var mqtt_listener;
var curr_location = {};

app.get('/location', function (req, res) {
  res.json(curr_location);
});

app.get('/', function (req, res) {
  res.send('Hello world!');
});
app.listen(port, function () {
  console.log("App started listening on "+port+"!");
});

client.on('connect', ()=>{
  console.log("Connected to MQTT location stream.");
  client.subscribe('owntracks/ghentmarathon/+');
});

client.on('message', (topic, message) => {
  var athlete = topic.split('/').pop();
  var location_obj = JSON.parse(message.toString());
  console.log("Got location update of "+athlete);
  if(!(curr_location[athlete])){
    curr_location[athlete]={"latitude": -1, "longitude": -1, "timestamp": -1};
  }
  curr_location[athlete].latitude=location_obj.lat
  curr_location[athlete].longitude = location_obj.lon
  curr_location[athlete].timestamp = location_obj.tst
  
  console.log(message.toString());
})