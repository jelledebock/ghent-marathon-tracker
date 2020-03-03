function create_or_update_tile(tracking_id, data){
    //First try to find the tracking tile (if not create one)
    var tracking_html = tracking_data_html(tracking_id, data);
    var elem = $("div.tracking-info[data-tid='"+tracking_id+"'");
    console.log(elem);
    if(elem.length){
        //Updating
        console.log("Updating!");
        elem.html(tracking_html);
    }
    else{
        //Creating a new one
        elem = $('<div class="col col-md-3 tracking-info" data-tid="'+tracking_id+'">');
        elem.html(tracking_html);
        $('div.race-status-bar').append(elem);
    }
}

function tracking_data_html(tid, tracking_data){
    var html = '<div class="athlete-name"><i class="fas fa-running"></i> '+tid+'</div><div class="athlete-data-row">';
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
        html+="<p>Not yet running</p>";
    }
    html+='</div>';
    return html;    
}