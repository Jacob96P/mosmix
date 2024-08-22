# API für die Routen und Törns

from flask import Flask, jsonify, request
from flask_cors import CORS
import os
import json
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv
import ast

load_dotenv(override=True)
os.environ.get('HOME')

db_login = f"host={os.environ.get('DB_HOST')} \
port={os.environ.get('DB_PORT')} \
dbname={os.environ.get('DB_NAME')} \
user={os.environ.get('DB_USER')} \
password={os.environ.get('DB_PASS')}"

app = Flask(__name__)
app.config['DEBUG'] = True
app.config['JSON_AS_ASCII'] = False

CORS(app) # damit das Frontend-Script nicht auf demselben Server laufen muss wie das API


@app.route("/")
def root():
    return { "message": "Törnplaner API, WebGIS " }


# Törn erstellen
@app.route("/create_toern", methods=['POST'])
def create_toern():
    content = request.get_json()
    toern_id = content['toern_id']
    benutzer = content['benutzer']
    toern_name = content['toern_name']

    try:
        with psycopg2.connect(db_login) as con:
            cur = con.cursor(cursor_factory=psycopg2.extras.DictCursor)
            cur.execute(f'''
                    SELECT benutzer, toern_name
                    FROM toern
                    WHERE benutzer = '{benutzer}'
                    AND toern_name = '{toern_name}'
                    ;''')
            results = cur.fetchall()
            if len(results) > 0:
                raise NameError
            else:
                cur.execute(f"""
                        INSERT INTO toern
                        VALUES('{toern_id}', '{benutzer}', '{toern_name}')
                        ;""")
                
    except NameError as e:
        return { "status": 'duplikat', "message": "Dieser Törnname ist bereits vergeben" }
    
    except psycopg2.DatabaseError as e:
        return { "status": False, "message": "Ein Fehler ist aufgetreten!" }

    else:
        return { "status": True, "message": "Daten wurden eingefügt!" }


# Törn löschen
@app.route("/delete_toern", methods=['DELETE'])
def delete_toern():
    content = request.get_json()
    toern_id = content['toern_id']
    try:
        with psycopg2.connect(db_login) as con:
            cur = con.cursor(cursor_factory=psycopg2.extras.DictCursor)
            cur.execute(f"""
                        DELETE FROM toern
                        WHERE toern_id = '{toern_id}'
                        ;""")
            cur.execute(f"DELETE FROM route WHERE toern_id = '{toern_id}';")
    
    except psycopg2.DatabaseError as e:
        return { "status": False, "message": "Ein Fehler ist aufgetreten!" }
    else:
        return { "status": True, "message": "Datensatz gelöscht!" }


# /get Törns
@app.route('/get_toerns/<benutzer>', methods=['GET'])
def get_toerns(benutzer):
    try:
        with psycopg2.connect(db_login) as con:
            cur = con.cursor(cursor_factory=psycopg2.extras.DictCursor)
            cur.execute(f'''
                        SELECT toern_id, toern_name
                        FROM toern
                        WHERE benutzer = '{benutzer}'
                        ORDER by modified DESC
                        ;''')
            
            feature_collection = {}
            features = list()
            for row in cur.fetchall():
                feature = {
                    "toern_id": row['toern_id'],
                    "toern_name": row['toern_name']
                }
                features.append(feature)
            feature_collection.update( {"features": features} )
            return jsonify(feature_collection)
        
    except psycopg2.DatabaseError as e:
        return { "status": False, "message": "Ein Fehler ist aufgetreten!" }

    else:
        return { "status": True, "message": "Daten wurden eingefügt!" }


# Route speichern
@app.route("/save_geometry", methods=['POST'])
def save_route():
    content = request.get_json()
    route_id = content['route_id']
    geometry = json.dumps(content['geometry'], ensure_ascii=False)
    try:
        with psycopg2.connect(db_login) as con:
            cur = con.cursor(cursor_factory=psycopg2.extras.DictCursor)
            cur.execute(f"""
                        UPDATE  route
                        SET geom = ST_GeomFromGeoJson('{geometry}')
                        WHERE route_id = '{route_id}'
                        ;""")
    except psycopg2.DatabaseError as e:
        return { "status": False, "message": "Ein Fehler ist aufgetreten!" }

    else:
        return { "status": True, "message": "Daten wurden eingefügt!" }


# Route löschen
@app.route("/delete_route", methods=['DELETE'])
def delete_route():
    content = request.get_json()
    route_id = content['route_id']
    try:
        with psycopg2.connect(db_login) as con:
            cur = con.cursor(cursor_factory=psycopg2.extras.DictCursor)
            cur.execute(f"""
                        DELETE FROM route
                        WHERE route_id = '{route_id}'
                        ;""")
    
    except psycopg2.DatabaseError as e:
        return { "status": False, "message": "Ein Fehler ist aufgetreten!" }
    else:
        return { "status": True, "message": "Datensatz gelöscht!" }


# Route erstellen
@app.route("/create_route", methods=['POST'])
def create_route():
    content = request.get_json()
    route_id = content['route_id']
    toern_id = content['toern_id']
    benutzer = content['benutzer']
    toern_name = content['toern_name']
    route_name = content['route_name']

    try:
        with psycopg2.connect(db_login) as con:
            cur = con.cursor(cursor_factory=psycopg2.extras.DictCursor)
            cur.execute(f"""
                        INSERT INTO route
                        VALUES('{route_id}', '{toern_id}', '{benutzer}', '{toern_name}', '{route_name}',
                        NULL)
                        ;""")
            
    except psycopg2.DatabaseError as e:
        return { "status": False, "message": "Ein Fehler ist aufgetreten!" }

    else:
        return { "status": True, "message": "Daten wurden eingefügt!" }


# /get routen
# Zum Hinzufügen der Routen eines Törns zur Listbox
@app.route('/get_routes/<toern_id>', methods=['GET'])
def get_routes_by_toern_id(toern_id):
    with psycopg2.connect(db_login) as con:
        cur = con.cursor(cursor_factory=psycopg2.extras.DictCursor)
        cur.execute(f'''
                    SELECT route_id, route_name, ST_AsGeoJSON(geom) as geomasgeojson 
                    FROM route
                    WHERE toern_id = '{toern_id}'
                    ORDER by modified DESC
                    ;''')
        
        feature_collection = {}
        features = list()
        for row in cur.fetchall():
            geometry = row['geomasgeojson']
            # Weil beim erstellen einer neuen Route initial immer ein Feature ohne geom erstellt wird
            if geometry == None:
                feature = {
                    "route_id": row['route_id'],
                    "route_name": row['route_name'],
                    "geometry": 'null'
                }
            else:
                feature = {
                    "route_id": row['route_id'],
                    "route_name": row['route_name'],
                    "geometry": ast.literal_eval(row['geomasgeojson'])
                }
            features.append(feature)
        feature_collection.update( {"features": features} )
        return jsonify(feature_collection)


# /get route mit Geometrie
# Zum hinzufügen einer Route zur source
@app.route('/get_route/<route_id>')
def get_route_by_route_id(route_id):
    with psycopg2.connect(db_login) as con:
        cur = con.cursor(cursor_factory=psycopg2.extras.DictCursor)

        cur.execute(f'''
                    SELECT route_id, route_name, toern_id, toern_name, ST_AsGeoJSON(geom) as geomasgeojson 
                    FROM route
                    WHERE route_id = '{route_id}'
                    ;''')
        
        data = cur.fetchone()
        # Falls leere Geometrie, wenn route erstellt wurde aber dann nichts gespeichert wurde
        if data['geomasgeojson'] == None:
            feature = {
                "type": "Feature",
                "route_id": data['route_id'],
                "toern_id": data['toern_id'],
                "toern_name": data['toern_name'],
                "route_name": data['route_name'],
            }
        else:
            feature = {
                "type": "Feature",
                "route_id": data['route_id'],
                "toern_id": data['toern_id'],
                "toern_name": data['toern_name'],
                "route_name": data['route_name'],
                "geometry": ast.literal_eval(data['geomasgeojson'])
            }
        return jsonify(feature)


if __name__ == '__main__':
    port = 8083
    app.run(host= '0.0.0.0', port=port)