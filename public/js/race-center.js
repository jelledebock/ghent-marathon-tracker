var is_live = false;

function get_live_status(){
    $.get('/race_status', function(data){
        is_live = data['is_live'];
        var place_holder = $('#race-status');
        var class_names = 'btn '+(is_live?'btn-success':'btn-danger');
        place_holder.removeClass();
        place_holder.addClass(class_names);
        place_holder.text((is_live?'live':'not live'));
    });
}

$(document).ready(function(){
    get_live_status();
    setInterval(get_live_status, 5000);
})