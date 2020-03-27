var is_live = false;
var map;

var parcours;

var gpx_source;

var tracking_ids = [];
var real_names = {};

var race_config = {};
var tracking_info = {};

//We get data from our server every 60 seconds (the server is the node.js "man in the middle" between MQTT and Firebase db)
var LAST_X_SECONDS_DATA = 60;
var UPDATE_INTERVAL = 60;

//Checks on the server whether the race is going on
// Node.js server listens on /race_status
//  - The status is cached on the node.js server and is refreshed every 2 minutes
//  - UI --> shows live/not live
function get_live_status(){
  return new Promise(function(resolve, reject){
      $.get('/race_status', function(data){
        is_live = data['is_live'];
        race_config = data;

        var place_holder = $('#live-badge');
        var class_names = 'badge '+(is_live?'badge-success':'badge-warning');
        place_holder.removeClass();
        place_holder.addClass(class_names);
        place_holder.text((is_live?'live':'not live'));
        resolve(is_live);
    });
  });
}

// If the race is live, we ask our server for the latest information stats about our athletes
async function update_race_data(){
  var live_status = await get_live_status();
  if(live_status){
    // If the race is live, we loop over all the tracking statusses we are looking for to show in 
    //  UI.
    var i=0;
    for(tid of tracking_ids){
      console.log("Getting info of "+race_config['real_names']+" based on its last 60 seconds worth of data");
      // Function that gets the data from our backend
      var stats = await get_location_stats(tid, real_names[i]);
      console.log("Stats from race server: ", stats);
      // UI --> present the data on our homepage
      create_or_update_tile(tid, stats, real_names[i]);
      i+=1;
    }
  }
}

// Gets the latest info of athlete with Name : tracking_id
//  Next: this function delegates control to the different UI functions in charge for visualization
//    - Create or update the marker of the tracking id
//    - Show distance done/todo, approximate finish time, ...
function get_location_stats(tracking_id, real_name){
  return new Promise(function(resolve, reject){
    $.get('/last_info/'+tracking_id, function(data){
      if(!data || data['is_live']==false){
        console.log(tracking_id+" doesn't seem to be running");
        resolve(data);
      }
      else{
        create_or_update_marker(tracking_id, data, real_name);
        resolve(data);
      }
    });
  });
}
  

function get_tracking_ids(){
  return new Promise(function(resolve, reject){
    if(is_live){
      console.log("Event is live, getting the ids to track");
      $.get('/tracking_ids', function(data){
        resolve(data);
      });
    }
    else{
      resolve([]);
    }
  });
}

function get_real_names(){
  return new Promise(function(resolve, reject){
    if(is_live){
      console.log("Event is live, getting the ids to track");
      $.get('/real_names', function(data){
        resolve(data);
      });
    }
    else{
      resolve([]);
    }
  });
}

$(document).ready(async function(){
    is_live =  await get_live_status();
    tracking_ids = await get_tracking_ids();
    real_names = await get_real_names();

    for(tracking_id of tracking_ids){
      tracking_info[tracking_id]={};
    }
    update_race_data();
    setInterval(update_race_data, UPDATE_INTERVAL*1000);
    init_map();
})

