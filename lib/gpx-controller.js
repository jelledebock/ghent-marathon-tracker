const gpxParse = require('parse-gpx');
const haversine = require('haversine');
const config = require('../config');
var parcours = {'total_distance':-1};

var load_parcours = function(){
    gpxParse(config.gpx_path).then(track =>{
        var calc_dist = 0;
        parcours['points']=[];
        for(var i=0; i<track.length; i++){
          if(i>0){
            lat1 = track[i-1].latitude;
            lon1 = track[i-1].longitude;
            lat2 = track[i].latitude;
            lon2 = track[i].longitude;
            ele = track[i].elevation;
            calc_dist+=haversine({'latitude':lat1, 'longitude':lon1}, {'latitude':lat2, 'longitude': lon2}, {unit: 'meter'});
            parcours['points'].push([lat2, lon2, ele]);
            //console.log(parcours);
            //console.log('Cumm distance '+calc_dist);
          }
        }
        parcours['total_distance'] = calc_dist;
    });
} 

module.exports.intialize = load_parcours;
module.exports.parcours = parcours;

