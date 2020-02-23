const mqtt = require('mqtt');
const config = require('../config');
const db = require('../lib/db');

var curr_location={};
var client;
var db_logger = new db.FirebaseLogger();

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

        if(config.save_to_db){
            var ref = db_logger.logLiveData(location_obj);
            console.log("Persisted to firestore db."+ref);
        }
    }  
    console.log(message.toString());
    });
};

module.exports.delete_last_day = async function(){
        var now = new Date();
        var yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)
        console.log(now);
        console.log(yesterday);
        var firebaseLogger = new db.FirebaseLogger();
        var number_deleted = await firebaseLogger.removeLiveData(yesterday, now, config.tracker_ids);
        return number_deleted;
};

module.exports.get_last_day_data =  async function(){
    var now = new Date();
    var yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    console.log(now);
    console.log(yesterday);
    var firebaseLogger = new db.FirebaseLogger();
    var output = await firebaseLogger.getLiveData(yesterday, now, config.tracker_ids);
    return output;
};

module.exports.disconnect = function(){
    client.end();
}

