const mqtt = require('mqtt');
const config = require('../config');
var curr_location={};
var client;

module.exports.current_location = curr_location;
module.exports.initialize = function(){
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
    });
};

module.exports.disconnect = function(){
    client.end();
}

