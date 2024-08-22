import psycopg2
import psycopg2.extras
import os
from dotenv import load_dotenv


load_dotenv(override=True)
os.environ.get('HOME')

db_login = f"host={os.environ.get('DB_HOST')} \
port={os.environ.get('DB_PORT')} \
dbname={os.environ.get('DB_NAME')} \
user={os.environ.get('DB_USER')} \
password={os.environ.get('DB_PASS')}"

try:
    with psycopg2.connect(db_login) as con:
        cur = con.cursor(cursor_factory=psycopg2.extras.DictCursor)
        cur.execute(f'''
                DROP TABLE IF EXISTS toern CASCADE;
                CREATE TABLE IF NOT EXISTS toern
                (
                    toern_id UUID,
                    benutzer VARCHAR,
                    toern_name VARCHAR,
                    modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY(toern_id)
                );

                DROP TABLE IF EXISTS route;
                CREATE TABLE IF NOT EXISTS route
                (
                    route_id UUID,
                    toern_id UUID,
                    benutzer VARCHAR,
                    toern_name VARCHAR,
                    route_name VARCHAR,
                    geom GEOMETRY,
                    modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY(route_id),
                    CONSTRAINT fk_toern_id
                    FOREIGN KEY(toern_id)
                    REFERENCES toern(toern_id)
                    ON DELETE CASCADE
                );
                ;''')
                
except Exception as e:
    print("Error: ", e)