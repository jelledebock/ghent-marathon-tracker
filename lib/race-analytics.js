var admin = require("firebase-admin");
var moment = require('moment');

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