import paho.mqtt.client as mqtt
import gpxpy
import sys
from datetime import datetime, timedelta
import pandas as pd
import time
import json

sample_json = {"bs":1,"tst":1581948338,"acc":65,"_type":"location","alt":3,"lon":3.7098169473835059,"vac":11,"lat":51.01335531674944,"batt":86,"conn":"w","tid":"ab"}
topic_name = 'owntracks/ghentmarathon/{}'

# The callback for when the client receives a CONNACK response from the server.
def on_connect(client, userdata, flags, rc):
    print("Connected with result code "+str(rc))

# The callback for when a PUBLISH message is received from the server.
def on_message(client, userdata, msg):
    print(msg.topic+" "+str(msg.payload))

def process_gpx_file(gpx_path):
    gpx_file = open(gpx_path, 'r')
    gpx = gpxpy.parse(gpx_file)
    points = []
    cum_dist = 0
    prev_lat, prev_lon = None, None
    for track in gpx.tracks:
        for segment in track.segments:
            start = segment.points[0].time
            for point in segment.points:
                if prev_lat and prev_lon:
                    cum_dist+=gpxpy.geo.haversine_distance(prev_lat, prev_lon, point.latitude, point.longitude)
                prev_lat, prev_lon = point.latitude, point.longitude
                points.append([point.latitude, point.longitude, point.time, (point.time-start).total_seconds(), cum_dist])
    return points

def broacast_mqtt_location(athlete, client, df, athlete_speed, total_elapsed_for_athlete):
    client.publish(topic_name.format(athlete), json.dumps(sample_json))

if __name__ == "__main__": 
    client = mqtt.Client()
    client.on_connect = on_connect
    client.on_message = on_message

    client.connect("broker.hivemq.com", 1883, 60)
    parcours_gpx = sys.argv[1]

    points = process_gpx_file(parcours_gpx)
    points_df = pd.DataFrame(points, columns=['lat','lon','timestamp','duration','distance'])
    points_df['timestamp']=pd.to_datetime(points_df['timestamp'])
    points_df = points_df.set_index('timestamp')
    points_df = points_df.resample('1s').interpolate(method='linear')
    start_date = datetime.now()
    # Simulate abdi running at 18.5 kph and starting 10min after first runner (15kph)
    speed_abdi = float(sys.argv[2])/3.6
    speed_first_runner = float(sys.argv[3])/3.6
    time_gap_start_min = float(sys.argv[4])
    time_gap_start_sec = 60*time_gap_start_min

    abdi_total_time = time_gap_start_sec + points_df.iloc[-1]['distance']/speed_abdi
    first_runner_total_time = points_df.iloc[-1]['distance']/speed_first_runner

    print("Abdi will arrive from now in {} seconds.".format(abdi_total_time))
    print("First will arrive from now in {} seconds.".format(first_runner_total_time))

    curr_elapsed_time_s = 0
    abdi_elapsed_running_time = 0
    first_runner_elapsed_running_time = 0
    while curr_elapsed_time_s<max(abdi_total_time, first_runner_total_time):
        print('Time', start_date+timedelta(seconds=curr_elapsed_time_s))
        print("Run time of Abdi: ", abdi_elapsed_running_time)
        print("Run time of first runner: ", first_runner_elapsed_running_time)
        first_runner_elapsed_running_time+=1
        # Broadcast location via MQTT 
        broacast_mqtt_location('abdi', client, points_df, speed_abdi, abdi_elapsed_running_time)
        broacast_mqtt_location('first_runner', client, points_df, speed_first_runner, first_runner_elapsed_running_time)
        curr_elapsed_time_s+=1
        if curr_elapsed_time_s>time_gap_start_sec:
            abdi_elapsed_running_time+=1
        time.sleep(1)

