var admin = require("firebase-admin");
var admin_uuid = 'Wi6CYUX5OhPbeXLun8Zkg1CFVfy1';
var moment = require('moment');

var serviceAccount = require("../config/gps-tracker-443da-firebase-adminsdk-8rn7g-1b5f9d7bd6.json");
admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: "https://gps-tracker-443da.firebaseio.com"
}, 'firestore_connector');

class FirebaseLogger{
    constructor(){
        this.db = admin.firestore();
    }
    
    logLiveData(tracking_obj){
        var ref = this.db.collection('livedata').add(tracking_obj);
        return ref;
    };
    
    batchLog(batch_info){
        var batch = this.db.batch();
        batch_info.forEach((log)=>{
            var docRef = this.db.collection('livedata').doc();
            batch.set(docRef, log);
        })
        return batch.commit();
    };
    
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

    removeLiveData(from, to, athletes){
        var from_ts = moment(from, moment.HTML5_FMT.DATETIME_LOCAL_SECONDS ).unix();
        var to_ts = moment(to, moment.HTML5_FMT.DATETIME_LOCAL_SECONDS ).unix();
        console.log(from_ts);
        console.log(to_ts);

        var del_query = this.db.collection('livedata').where('tst', '>=', from_ts).where('tst','<', to_ts).where('tid', 'in', athletes);
        
        return new Promise(function(resolve, reject){
            var total_deletes = 0;

            del_query.get().then(function(querySnapshot) {
                querySnapshot.forEach(function(doc) {
                    total_deletes+=1;
                    doc.ref.delete();
                });
                resolve(total_deletes);
            });
        
        }).catch(err => {
        console.log('Error deleting documents', err);
        });

    }

}

module.exports.FirebaseLogger = FirebaseLogger;