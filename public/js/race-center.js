var is_live = false;
var map;

var tracking_ids = [];
var tracking_info = {};

var LAST_X_SECONDS_DATA = 60;
var UPDATE_INTERVAL = 60;

function get_live_status(){
  return new Promise(function(resolve, reject){
      $.get('/race_status', function(data){
        is_live = data['is_live'];
        var place_holder = $('#race-status');
        var class_names = 'btn '+(is_live?'btn-success':'btn-danger');
        place_holder.removeClass();
        place_holder.addClass(class_names);
        place_holder.text((is_live?'live':'not live'));
        resolve(is_live);
    });
  });
}

async function update_race_data(){
  var live_status = await get_live_status();
  if(live_status){
    for(tid of tracking_ids){
      console.log("Getting info of "+tid+" based on its last 60 seconds worth of data");
      var stats = await get_location_stats(tid);
      console.log("Stats from race server: ", stats);
      create_or_update_tile(tid, stats);
    }
  }
}

function get_location_stats(tracking_id){
  return new Promise(function(resolve, reject){
    $.get('/last_info/'+tracking_id, function(data){
      tracking_info[tracking_id]=data;
      resolve(tracking_info[tracking_id]);
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

function init_map(){
    map = new ol.Map({
        target: 'map',
        layers: [
          new ol.layer.Tile({
            source: new ol.source.OSM()
          })
        ],
        view: new ol.View({
          center: ol.proj.fromLonLat([37.41, 8.82]),
          zoom: 4
        })
      });
};

$(document).ready(async function(){
    is_live =  await get_live_status();
    tracking_ids = await get_tracking_ids();
    for(tracking_id of tracking_ids){
      tracking_info[tracking_id]={};
    }
    update_race_data();
    setInterval(update_race_data, UPDATE_INTERVAL*1000);
    init_map();
})