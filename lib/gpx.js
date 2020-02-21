const gpxParse = require('parse-gpx');
const haversine = require('haversine');
const config = require('../config');
const request = require('request');
const fs = require('fs');

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

var download_from_web = async function(url, file_description){
  const file = fs.createWriteStream(file_description);
  await new Promise((resolve, reject) => {
      let stream = request({
          /* Here you should specify the exact link to the file you are trying to download */
          uri: url,
          headers: {
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
              'Accept-Encoding': 'gzip, deflate, br',
              'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8,ro;q=0.7,ru;q=0.6,la;q=0.5,pt;q=0.4,de;q=0.3',
              'Cache-Control': 'max-age=0',
              'Connection': 'keep-alive',
              'Upgrade-Insecure-Requests': '1',
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3440.106 Safari/537.36'
          },
          /* GZIP true for most of the websites now, disable it if you don't need it */
          gzip: true
      })
      .pipe(file)
      .on('finish', () => {
          console.log(`The file is finished downloading.`);
          resolve();
      })
      .on('error', (error) => {
          reject(error);
      })
  })
  .catch(error => {
      console.log(`Something happened: ${error}`);
  });
  return file_description;
}

module.exports.intialize = load_parcours;
module.exports.parcours = parcours;
module.exports.download_gpx = download_from_web;

