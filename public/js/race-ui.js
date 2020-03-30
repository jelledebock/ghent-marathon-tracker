function create_or_update_tile(tracking_id, data, real_name){
    //First try to find the tracking tile (if not create one)
    var tracking_html = tracking_data_html(tracking_id, data, real_name);
    var elem = $("div.tracking-info[data-tid='"+tracking_id+"'");
    console.log(elem);
    if(elem.length){
        //Updating
        console.log("Updating!");
        elem.html(tracking_html);
    }
    else{
        //Creating a new one
        elem = $('<div class="tracking-info" data-tid="'+tracking_id+'">');
        elem.html(tracking_html);
        $('div.race-status-bar').append(elem);
    }
}

function tracking_data_html(tid, tracking_data, real_name){
    var html = '<div class="athlete-name"><i class="fas fa-running"></i> '+real_name+'</div><div class="athlete-data-row">';
    if(tracking_data['is_live']){
        html+="<div class='tracking-info-data'><i class='fas fa-tachometer-alt'></i> <span class='speed'>"+Math.floor(tracking_data['speed_m_s']*3.6)+" km/u</span></div>";
        html+="<div class='tracking-info-data'><i class='fas fa-clock'></i> <span class='elapsed_time'>"+tracking_data['run_time']+"</span></div>";
        html+="<div class='tracking-info-data'><i class='fas fa-route'></i> <span class='elapsed_time'>"+Math.round(tracking_data['location_in_gpx']['distance_done']/10)/100+ "km</span></div>";
        html+="<div class='tracking-predictions'>";
        html+="<span> <b>IDLab predictions</b></span>";
        if('prediction' in tracking_data){
            html+="<div><i class='fas fa-calculator'></i></i><span class='predict_time'> "+tracking_data['prediction'][2]+"</span></div>";
        }
        else{
            html+="<div><i class='fas fa-calculator'></i></i> <span class='predict_time'> N/A</span></div>";
        }
        html+='</div>';
    }
    else{
        html+="<p>Nog niet aan het lopen</p>";
    }
    html+='</div>';
    return html;    
}

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


  function get_icon(tracking_id){
    if(tracking_id=='abdi'){
      img_src='/data/abdi-face.png';
    }
    else if(tracking_id=='first_runner'){
      img_src='/data/first-runner.png';
    }
    else{
      img_src='/data/runner.svg';
    }
    var iconStyle = new ol.style.Style({
      image: new ol.style.Icon({
        anchorXUnits: 'fraction',
        anchorYUnits: 'pixels',
        anchorOrigin: 'bottom-right',
        src: img_src,
        scale: 1.0
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

var tracking_markers = {};

function create_or_update_marker(tracking_id, data, real_name){
    tracking_info[tracking_id]=data;
    if(tracking_id in tracking_markers){
      console.log("Updating marker "+tracking_id);
      tracking_markers[tracking_id].getFeatures()[0].getGeometry().setCoordinates(ol.proj.transform([data['current_location'][1], data['current_location'][0]], 'EPSG:4326', 'EPSG:3857'));
    }
    else{
      tracking_markers[tracking_id] = new ol.source.Vector({features:[new ol.Feature({
                    geometry: new ol.geom.Point(ol.proj.fromLonLat([data['current_location'][1], data['current_location'][0]])),
                    name: 'Locatie van:'+real_name,
                    id: tracking_id
      })]});
      tracking_markers[tracking_id].getFeatures()[0].setStyle(get_icon(tracking_id));
      tracking_markers[tracking_id].getFeatures()[0].getGeometry().setCoordinates(ol.proj.transform([data['current_location'][1], data['current_location'][0]], 'EPSG:4326', 'EPSG:3857'));        
    }

    map.addLayer(new ol.layer.Vector({source: tracking_markers[tracking_id]}));

    return tracking_info[tracking_id];
}