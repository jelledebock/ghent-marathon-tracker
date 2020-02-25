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
        parcours['cum_distance']=[]
        for(var i=0; i<track.length; i++){
          if(i>0){
            lat1 = track[i-1].latitude;
            lon1 = track[i-1].longitude;
            lat2 = track[i].latitude;
            lon2 = track[i].longitude;
            ele = track[i].elevation;
            var m_traveled = haversine({'latitude':lat1, 'longitude':lon1}, {'latitude':lat2, 'longitude': lon2}, {unit: 'meter'});
            calc_dist+=m_traveled;
            parcours['points'].push([lat2, lon2, ele]);
            parcours['cum_distance'].push(calc_dist);
            //console.log(parcours);
            //console.log('Cumm distance '+calc_dist);
          }
        }
        parcours['total_distance'] = calc_dist;
    });
} 

var find_in_course = function(location){
    if(!('points' in parcours)){
        console.log("Reloading parcours");
        load_parcours();
    }
    var last_proximity = Math.pow(2, 53); // 9 007 199 254 740 992
    var desired_proximity = 25;
    var i = 0;
    while(i<parcours['points'].length && last_proximity>desired_proximity){
        last_proximity = haversine({'latitude':location[0], 'longitude': location[1]},{'latitude':parcours.points[i][0], 'longitude': parcours.points[i][1]}, {unit: 'meter'});
        i+=1;
    };
    if(i+1<parcours.points.length){
        while(last_proximity>haversine({'latitude':location[0], 'longitude': location[1]},{'latitude':parcours.points[i+1][0], 'longitude': parcours.points[i+1][1]}, {unit: 'meter'})){
            last_proximity=haversine({'latitude':location[0], 'longitude': location[1]},{'latitude':parcours.points[i+1][0], 'longitude': parcours.points[i+1][1]}, {unit: 'meter'})
            i+=1;
        }
    }
    if(i==parcours.points.length){
        return null;
    }
    else{
        return [parcours.points[i], parcours.cum_distance[i], last_proximity];
    }
};

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
module.exports.find_in_course = find_in_course;
