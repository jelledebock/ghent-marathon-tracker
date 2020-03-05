const mqtt = require('mqtt');
const config = require('../config');
const db = require('../lib/db');

var curr_location={};
var MAX_BUFFER_LENGTH = 60;

var last_seconds_statusses = {};
var db_seconds_log = {};

var db_logger = new db.FirebaseLogger();
var client;

module.exports.current_location = curr_location;
module.exports.last_seconds_statusses = last_seconds_statusses;
module.exports.db_seconds_log = db_seconds_log;

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
            last_seconds_statusses[athlete]=[];
            db_seconds_log[athlete]=[];
        }

        if(config.tracker_ids.includes(athlete)){
            curr_location[athlete].latitude=location_obj.lat
            curr_location[athlete].longitude = location_obj.lon
            curr_location[athlete].timestamp = location_obj.tst

            if(config.save_to_db){
                if(db_seconds_log[athlete].length==MAX_BUFFER_LENGTH){
                    console.log("Flushing last ",MAX_BUFFER_LENGTH, " seconds worth of data to firebase");
                    ref = db_logger.batchLog(db_seconds_log[athlete]);
                    console.log("Persisted to firestore db."+ref);
                    db_seconds_log[athlete] = [];
                }
                if(last_seconds_statusses[athlete].length==MAX_BUFFER_LENGTH){
                    var last_item = last_seconds_statusses[athlete][0];
                    db_seconds_log[athlete].push(last_item);
                    last_seconds_statusses[athlete].shift();
                }
                last_seconds_statusses[athlete].push(location_obj);
                console.log("Number of records for "+athlete+":"+last_seconds_statusses[athlete].length);
                console.log("Number of records in DB log for "+athlete+":"+db_seconds_log[athlete].length);
            }
        }  
    });
};

module.exports.get_current_location = function(athlete){
    return curr_location[athlete];
};

module.exports.get_last_datapoints =function(athlete){
    return last_seconds_statusses[athlete];
};

module.exports.get_location_on_course =function(tracker_id){
    return [curr_location[tracker_id].latitude, curr_location[tracker_id].longitude];
}

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

