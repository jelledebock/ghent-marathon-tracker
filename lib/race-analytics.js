var admin = require("firebase-admin");
var firebase = require('firebase');

var moment = require('moment');
const haversine = require('haversine');
var config = require('../config');
var gpx = require('./gpx');

var serviceAccount = require("../config/gps-tracker-443da-firebase-adminsdk-8rn7g-1b5f9d7bd6.json");

admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: "https://gps-tracker-443da.firebaseio.com"
}, 'firestore_racecenter');



class FirebaseRaceCenter{
    constructor(mqtt_obj){
        this.db = admin.firestore();

        this.race_status = {'is_live': false, 'tracking_ids':[], 'start_delay':[], "event_started_at":""};
        this.current_status = {};
        
        this.prev_gpx_index = {};

        this.mqtt_obj = mqtt_obj;

        /*this.db.collection("livedata").get().then(function(querySnapshot) {      
            console.log("Livedata has : ", querySnapshot.size, " documents!"); 
        });*/

        setInterval(this.refreshRaceStatus.bind(this), 30000); //refresh every half minute
        setInterval(this.reload_config.bind(this), 120000); //refresh config every 2 minutes
        this.reload_config();
        this.refreshRaceStatus();
    }
    
    resetRace(){
        this.race_status = {'is_live': false, 'tracking_ids':[], 'start_delay':[], "event_started_at":""};
        this.current_status = {};
        
        this.prev_gpx_index = {};
        this.reload_config();
        this.refreshRaceStatus();
    }

    async refreshRaceStatus(){
        console.log("Refreshing tracking status of the race.");
        for(var athlete_id of this.race_status.tracking_ids){
            this.current_status[athlete_id]=this.getLastSecondsData(athlete_id);
        }
        
    }

    async reload_config(){
        console.log("Reloading the race config.");
        var platform_status = await this.getPlatformStatus();
        this.race_status = platform_status;
    }

    getStatus(tid){
        if(this.current_status){
            if(tid in this.current_status){
                return this.current_status[tid];
            }
            else{
                return {};
            }
        }
        else{
            return {};
        }
    }

    getPlatformStatus(){
        var db_query = this.db.collection('config').doc('config');
        return new Promise(function(resolve, reject){
            db_query.get().then(snapshot =>{
                resolve(snapshot.data());
            });
        });
    }

    getTrackingIds(){
        return this.race_status["tracking_ids"];
    }

    getRaceStartTime(){
        return this.race_status['event_started_at'];
    }

    getRaceStartAthlete(tid){
        var start_of_event = this.race_status['event_started_at']._seconds;
        var tid_index = 0;

        while(this.race_status['tracking_ids'][tid_index]!=tid && tid_index<this.race_status['tracking_ids'].length){
            tid_index+=1;
        }
        if(tid_index<this.race_status['tracking_ids'].length){
            return start_of_event + this.race_status['start_delay_seconds'][tid_index];
        }
        else{
            return 0;
        }
    }

    getLastSecondsData(tid){
        var return_json = this.get_data_of_last_seconds(tid);
        var race_start =  this.getRaceStartAthlete(tid);
        
        if(!(tid in this.prev_gpx_index)){
            this.prev_gpx_index[tid]=0;
        }

        if(return_json && 'athlete' in return_json && race_start-return_json['last_seen']<0){
            var location = this.mqtt_obj.get_location_on_course(tid)
            return_json['current_location']=location;
            return_json['run_time']="00:00:00";
            var location_gpx = gpx.find_in_course(location, this.prev_gpx_index[tid]);
            if(location_gpx){
                return_json['location_in_gpx']={};
                return_json['location_in_gpx']['point']=location_gpx[0];
                return_json['location_in_gpx']['distance_done']=location_gpx[1];
                return_json['location_in_gpx']['proximity']=location_gpx[3];
                this.prev_gpx_index[tid]=location_gpx[2];

                if(!('athlete' in return_json)){
                    return_json['is_live']=false;
                }
                if(return_json['is_live'] && return_json['distance']>0){
                    var prediction = this.predict_finish_time(return_json['location_in_gpx']['distance_done'], return_json['speed_m_s'], gpx.parcours.total_distance, race_start);
                    var race_duration = Math.abs(Date.now()-new Date(race_start*1000))/1000;
                    var formatted_total_time = new Date(null);
                    formatted_total_time.setSeconds(race_duration);
                    return_json['run_time']=formatted_total_time.toISOString().substr(11,8);
                    return_json['prediction']=prediction;
                }
            }
            return return_json;
        }
        else{
            return {'is_live': false};
        }
    }

    predict_finish_time(distance_done, speed_m_s, total_distance, start_time){
        var to_do = total_distance-distance_done;
        var time_seconds = to_do/speed_m_s;
        
        var total_time_seconds = moment().unix()-start_time+time_seconds;
        var formatted_total_time = new Date(null);
        formatted_total_time.setSeconds(total_time_seconds);

        return [time_seconds, start_time, formatted_total_time.toISOString().substr(11,8)];
    }

    get_data_of_last_seconds(tracking_id){
        var statusses = this.mqtt_obj.last_seconds_statusses[tracking_id];
        var objects = [];
        if(statusses){
            var i = statusses.length;
            while(i>0){
                if(statusses[i])
                    objects.unshift(statusses[i]);
                i-=1;
            }
        }
        var altitudes=[];
        var timestamps = [];
        var locations = []
        objects.forEach(row => {
            timestamps.push(row['tst']);
            locations.push([row['lat'], row['lon']]);
            altitudes.push(row['alt']);
        });
        var total_time = 0;
        var total_distance = 0;
        var total_ascend = 0;
        var total_descend = 0;
        var json_obj = {'athlete': tracking_id, 'elapsed_time': 0, 'distance': 0, 'ascend': 0, 'descend': 0};

        for(var i = 1 ; i<timestamps.length; i++){
            total_time+=(timestamps[i]-timestamps[i-1]);
            total_distance+=haversine({'latitude':locations[i-1][0], 'longitude':locations[i-1][1]}, {'latitude':locations[i][0], 'longitude': locations[i][1]}, {unit: 'meter'});
            if(altitudes[i]-altitudes[i-1]>0)
                total_ascend+=(altitudes[i]-altitudes[i-1]);
            else
                total_descend+=Math.abs(altitudes[i]-altitudes[i-1]);
        }
        
        var calculated_speed_ms = total_distance/total_time;
        var json_obj = {'athlete': tracking_id, 'is_live': true, 'speed_m_s': calculated_speed_ms, 'elapsed_time': total_time, 'distance': total_distance, 'ascend': total_ascend, 'descend': total_descend, 'last_seen': timestamps[timestamps.length-1]};
        
        return json_obj;
    };

    setLiveStatus(is_live){
        var db_query = this.db.collection('config').doc('config');
        return new Promise(function(resolve, reject){
            db_query.get().then(snapshot =>{
                db_query.update(is_live).then(_updated=>{
                    db_query.get().then(updated_data=>{
                        updated_data._ref = null;
                        resolve(updated_data);
                    })
                });
            });
        });
    }

    getLiveData(from, to, athletes){
        var from_ts = moment(from, moment.HTML5_FMT.DATETIME_LOCAL_SECONDS ).unix(); //2017-12-14T16:34:10
        var to_ts = moment(to, moment.HTML5_FMT.DATETIME_LOCAL_SECONDS).unix(); //2017-12-14T16:34:10
        var matches = this.db.collection('livedata').where('tst', '>=', from_ts).where('tst','<', to_ts).where('tid', 'in', athletes);
        
        return new Promise(function(resolve, reject){
            var objects = [];
            matches.get().then(snapshot => {
                if (snapshot.empty) {
                    console.log('No matching documents.');
                    resolve(objects);
                }  
            
                snapshot.forEach(doc => {
                    objects.push(doc.data());
                });
                resolve(objects);
            })
            .catch(err => {
            console.log('Error getting documents', err);
            });
        });
    }

}

module.exports.FirebaseRaceCenter = FirebaseRaceCenter;