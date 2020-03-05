var is_live = false;
var map;

var parcours;
var tracking_markers = {};

var gpx_source;

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
      if(tracking_id in tracking_markers){
        tracking_markers[tracking_id].setGeometry(new ol.geom.Point([data['current_location'][1], data['current_location'][0]]));
      }
      else{
        tracking_markers[tracking_id] = new ol.layer.Vector({
          source: new ol.source.Vector({
              features: [
                  new ol.Feature({
                      geometry: new ol.geom.Point(ol.proj.fromLonLat([data['current_location'][1], data['current_location'][0]]))
                  })
              ]
          })         
        });
        map.addLayer(tracking_markers[tracking_id]);
        var interaction = set_popup(tracking_markers[tracking_id], tracking_id);
        map.addInteraction(interaction);
      }
      resolve(tracking_info[tracking_id]);
    });
  });
}

function set_popup(marker, tracking_id){
  return new ol.interaction.Select(
    marker, {
      hover: true,
      onBeforeSelect: function(feature) {
         // add code to create tooltip/popup
         popup = new ol.popup.FramedCloud(
            "",
            feature.geometry.getBounds().getCenterLonLat(),
            new OpenLayers.Size(100,100),
            "<div>"+tracking_id+"</div>",
            null,
            true,
            null);
  
         feature.popup = popup;
  
         map.addPopup(popup);
         // return false to disable selection and redraw
         // or return true for default behaviour
         return true;
      },
      onUnselect: function(feature) {
         // remove tooltip
         map.removePopup(feature.popup);
         feature.popup.destroy();
         feature.popup=null;
      }
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
    gpx_source = new ol.source.Vector({
      url: 'data/parcours.gpx',
      format: new ol.format.GPX()
    });
    parcours = new ol.layer.Vector({
      source: gpx_source,
      style: function(feature) {
        return style[feature.getGeometry().getType()];
      }
    });
    map.addLayer(parcours);
    gpx_source.once('change',function(e){
      if(gpx_source.getState() === 'ready') {
        var extent = gpx_source.getExtent();
        console.log(extent);
        map.getView().fit(extent, map.getSize());
    }
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

var style = {
  'Point': new ol.style.Style({
    image: new ol.style.Circle({
      fill: new ol.style.Fill({
        color: 'rgba(255,255,0,0.4)'
      }),
      radius: 5,
      stroke: new ol.style.Stroke({
        color: '#ff0',
        width: 1
      })
    })
  }),
  'LineString': new ol.style.Style({
    stroke: new ol.style.Stroke({
      color: '#00008b',
      width: 3
    })
  }),
  'MultiLineString': new ol.style.Style({
    stroke: new ol.style.Stroke({
      color: '#00008b',
      width: 3
    })
  })
};