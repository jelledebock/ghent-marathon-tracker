var admin = require("firebase-admin");
var firebase = require('firebase');

var moment = require('moment');
const haversine = require('haversine');
var config = require('../config');

var serviceAccount = require("../config/gps-tracker-443da-firebase-adminsdk-8rn7g-1b5f9d7bd6.json");
admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: "https://gps-tracker-443da.firebaseio.com"
}, 'firestore_racecenter');

class FirebaseRaceCenter{
    constructor(){
        this.db = admin.firestore();
    }
    
    getPlatformStatus(){
        var db_query = this.db.collection('config').doc('config');
        return new Promise(function(resolve, reject){
            db_query.get().then(snapshot =>{
                resolve(snapshot.data());
            });
        });
    }

    predict_finish_time(distance_done, speed_m_s, total_distance){
        var query = this.getPlatformStatus()
        return new Promise(function(resolve, reject){
            query.then(data=>{
                var start_time = data['event_started_at']._seconds;
                console.log(start_time);

                var to_do = total_distance-distance_done;
                var time_seconds = to_do/speed_m_s;
                console.log(typeof(start_time))
                var total_time_seconds = moment().unix()-start_time+time_seconds;
                var formatted_total_time = new Date(null);
                formatted_total_time.setSeconds(total_time_seconds);

                resolve([time_seconds, start_time, formatted_total_time.toISOString().substr(11,8)]);
            });
        })
    }

    get_data_of_last_seconds(tracking_id, last_seconds){
        var now = new Date();
        var dateXSecondsAgo = new Date(now.getTime() - last_seconds*1000);
        console.log("Values between ", dateXSecondsAgo, " and ", now);
        var from_ts = moment(dateXSecondsAgo, moment.HTML5_FMT.DATETIME_LOCAL_SECONDS+'Z').unix(); //2017-12-14T16:34:10
        var to_ts = moment(now, moment.HTML5_FMT.DATETIME_LOCAL_SECONDS+'Z').unix(); //2017-12-14T16:34:10
        console.log("Values between ", from_ts, " and ", to_ts);

        var matches = this.db.collection('livedata').where('tst', '>=', from_ts).where('tst','<', to_ts).where('tid', '==', tracking_id).orderBy('tst', 'asc');
        
        return new Promise(function(resolve, reject){
            var objects = [];
            matches.get().then(snapshot => {
                if (snapshot.empty) {
                    console.log('No matching documents.');
                    resolve({});
                }  

                var altitudes=[];
                var timestamps = [];
                var locations = []
                snapshot.forEach(doc => {
                    var row = doc.data();
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
                resolve(json_obj);
            })
            .catch(err => {
            console.log('Error getting documents', err);
            });
        });
    }
    setLiveStatus(is_live){
        var db_query = this.db.collection('config').doc('config');
        return new Promise(function(resolve, reject){
            db_query.get().then(snapshot =>{
                var data = snapshot.data();
                data['is_live']=is_live;
                db_query.update(data);
                resolve(snapshot.data());
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