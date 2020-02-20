import paho.mqtt.client as mqtt
import gpxpy
import sys
from datetime import datetime, timedelta
import pandas as pd
import time
import json
import random

sample_json = {"bs":1,"tst":1581948338,"acc":65,"_type":"location","alt":3,"lon":3.7098169473835059,"vac":11,"lat":51.01335531674944,"batt":86,"conn":"w","tid":"ab"}
topic_name = 'owntracks/ghentmarathon/{}'
ABDI_GOAL_DURATION = 3960

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

def find_row(df, cum_dist):
    df_copy = df.copy()
    df_copy['prev_dist']=df_copy['distance'].shift(1)
    if cum_dist>0:
        row = df.loc[(df_copy.prev_dist<cum_dist) & (df_copy.distance>=cum_dist)].iloc[0]
    elif cum_dist>df.iloc[-1]['distance']:
        row = df.iloc[-1]
    else:
        row = df.iloc[0]
    return row

def randrange_float(start, stop, step):
    return random.randint(0, int((stop - start) / step)) * step + start

def broacast_mqtt_location(athlete, client, df, cum_dist, run_time, timestamp_now):
    row_obj = find_row(df, cum_dist)
    output = sample_json.copy()
    output['lat']=row_obj['lat']
    output['lon']=row_obj['lon']
    output['tst']=int(time.mktime(timestamp_now.timetuple()))
    print(output)
    client.publish(topic_name.format(athlete), json.dumps(output))

def get_finish_time_prediction(distance_completed, total_distance, elapsed_time_seconds, timestamp_now):
    if distance_completed>0 and elapsed_time_seconds>0:
        speed = distance_completed/elapsed_time_seconds
        distance_remaining = total_distance-distance_completed

        time_remaining = distance_remaining/speed
        
        return time_remaining, timestamp_now+timedelta(seconds=time_remaining)
    else:
        return ABDI_GOAL_DURATION, timestamp_now+timedelta(seconds=ABDI_GOAL_DURATION)

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
    exact_distance = points_df.iloc[-1]['distance']
    print("Total distance of the course ", exact_distance)
    start_date = datetime.now()
    # Simulate abdi running at 18.5 kph and starting 10min after first runner (15kph)
    speed_abdi = float(sys.argv[2])/3.6
    speed_first_runner = float(sys.argv[3])/3.6
    time_gap_start_min = float(sys.argv[4])
    time_gap_start_sec = 60*time_gap_start_min

    abdi_total_time = time_gap_start_sec+exact_distance/speed_abdi
    first_runner_total_time = exact_distance/speed_first_runner

    curr_elapsed_time_s = 0
    abdi_previous_s_distance = 0

    abdi_cum_distance = 0
    abdi_run_time = 0

    first_runner_cum_dist = 0
    first_runner_run_time = 0

    while min(first_runner_cum_dist, abdi_cum_distance)<exact_distance:
        timestamp_now = start_date+timedelta(seconds=curr_elapsed_time_s)
        print('Time', timestamp_now)
        print('Distance traveled previous second: ')
        print("Run time of Abdi: ", abdi_run_time)
        print("Run distance of Abdi: ", abdi_cum_distance)
        print("Run time of first runner: ", first_runner_run_time)
        print("Run distance of first runner: ", first_runner_cum_dist)
        # Broadcast location via MQTT 
        broacast_mqtt_location('abdi', client, points_df, abdi_cum_distance, abdi_run_time, timestamp_now)
        broacast_mqtt_location('first_runner', client, points_df, first_runner_cum_dist, first_runner_run_time, timestamp_now)
        
        curr_elapsed_time_s+=1
        if curr_elapsed_time_s>time_gap_start_sec and abdi_cum_distance<=exact_distance:
            abdi_run_time+=1
            distance_traveled_s = randrange_float((speed_abdi-0.55), (speed_abdi+0.55), 0.1)
            abdi_cum_distance+=distance_traveled_s
        
        if first_runner_cum_dist<=exact_distance:
            first_runner_run_time+=1
            distance_traveled_s = randrange_float((speed_first_runner-0.55), (speed_first_runner+0.55), 0.1)
            first_runner_cum_dist+=distance_traveled_s

        if curr_elapsed_time_s%30==0:
            time_remaining_abdi, arrival_datetime_abdi = get_finish_time_prediction(abdi_cum_distance, exact_distance, abdi_run_time, timestamp_now)
            time_remaining_first_runner, arrival_datetime_first_runner = get_finish_time_prediction(first_runner_cum_dist, exact_distance, first_runner_run_time, timestamp_now)

            print("Predictions on current pace (last 30 seconds):")        
            print("Abdi arrival prediction: {}({})".format(time_remaining_abdi, arrival_datetime_abdi))
            print("First runner arrival prediction: {} ({})".format(time_remaining_first_runner, arrival_datetime_first_runner))

        time.sleep(1)

