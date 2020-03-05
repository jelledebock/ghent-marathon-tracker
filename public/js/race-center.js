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
      if(!data || data['is_live']==false){
        console.log(tracking_id+" doesn't seem to be running");
        resolve(data);
      }
      else{
        tracking_info[tracking_id]=data;
        if(tracking_id in tracking_markers){
          console.log("Updating marker "+tracking_id);
          tracking_markers[tracking_id].getFeatures()[0].getGeometry().setCoordinates(ol.proj.transform([data['current_location'][1], data['current_location'][0]], 'EPSG:4326', 'EPSG:3857'));
        }
        else{
          tracking_markers[tracking_id] = new ol.source.Vector({features:[new ol.Feature({
                        geometry: new ol.geom.Point(ol.proj.fromLonLat([data['current_location'][1], data['current_location'][0]])),
                        name: 'Location of '+tracking_id,
                        id: tracking_id
          })]});
          tracking_markers[tracking_id].getFeatures()[0].setStyle(get_icon(tracking_id));
          tracking_markers[tracking_id].getFeatures()[0].getGeometry().setCoordinates(ol.proj.transform([data['current_location'][1], data['current_location'][0]], 'EPSG:4326', 'EPSG:3857'));        
        }

        map.addLayer(new ol.layer.Vector({source: tracking_markers[tracking_id]}));

        resolve(tracking_info[tracking_id]);
      }
    });
  });
}
  

function get_icon(tracking_id){
  if(tracking_id=='abdi'){
    _colour=' #FF0000';
  }
  else if(tracking_id=='first_runner'){
    _colour=' #0000FF';
  }
  else{
    _colour=' #008000';
  }
  var iconStyle = new ol.style.Style({
    image: new ol.style.Icon({
      colour: _colour,
      anchorXUnits: 'fraction',
      anchorYUnits: 'pixels',
      src: 'data/runner.svg',
      scale: 1.1
    })
  });
  return iconStyle;
}

function add_popup(map){
  var element = document.getElementById('popup');

  var popup = new ol.Overlay({
    element: element,
    positioning: 'bottom-center',
    stopEvent: false,
    offset: [0, 0]
  });
  map.addOverlay(popup);

  // display popup on click
  map.on('click', function(evt) {
    var feature = map.forEachFeatureAtPixel(evt.pixel,
      function(feature) {
        return feature;
      });
    if (feature) {
      console.log("Showing popup");
      console.log(element);
      var coordinates = feature.getGeometry().getCoordinates();
      popup.setPosition(coordinates);
      $(element).popover({
        placement: 'top',
        html: true,
        content: feature.get('name')
      });
      $(element).popover('show');
    } else {
      $(element).popover('destroy');
    }
  });

  // change mouse cursor when over marker
  map.on('pointermove', function(e) {
    if (e.dragging) {
      $(element).popover('destroy');
      return;
    }
    var pixel = map.getEventPixel(e.originalEvent);
    var hit = map.hasFeatureAtPixel(pixel);
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
    add_popup(map);
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