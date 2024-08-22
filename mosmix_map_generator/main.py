##################################
# MOSMIX2Map
##################################
# Maindatei zum AUslesen von MOSMIX-Daten vom DWD und anschließendem Erstellen von Wetterkarten in Form von GeoTiffs
# Angepasst an die Anforderungen aus diesem Projekt - für andere Parameter/Datenquellen/Gebiete müssen Anpassungen vorgenommen werden
# durch erweterung der stationen in stationen.csv prinzipiell auf ganz Deutschland oder größere Gebiete anwendbar. Datendichte aber in Deutschland am höchsten

### Parameter werden in der config.ini definiert. ###

## Parameters: Connection ##
# :param    DB_HOST             PostgreSQL DB_HOST
# :param    DB_PORT             PostgreSQL DB_PORT
# :param    DB_USER             PostgreSQL DB_USER
# :param    DB_PASS             PostgreSQL DB_PASS
# :param    DB_NAME             PostgreSQL DB_NAME
# :param    table_name          Tabele name of Table where MOSMIX-Data will be saved for Import, see tabelle_mosmix.sql for creation of the table

## Parameters: Releative Paths in Derectory 'mosmix_map_generator' ## 
# :param    save_dir            Directory to save mosmix-kml-Files
# :param    parameter_file      csv-File with parameter Definition
# :param    stationen_file      csv-File with all Stations used, in this case 130
# :param    logfile_dir         Directory where logfiles are generated 
# :param    mosaic_dir          Data-dir of Geoserver from where the maps can be published and updated
# :param    base_url            MOSMIX-L/single_stations-Directory on OpenData Portal of DWD 

##################################





###########
# IMPORTS #
###########
import pandas as pd
import os
import configparser
import datetime
import shapely.geometry as sgeom
from pathlib import Path
import logging
import mosmix_processor_module
import mosmix_map_generator_module

##########
# VARDEF #
##########
# get the current script directory path
currentScriptDirectoryPath = Path(__file__).parent.resolve()
configFilePath = os.path.join(currentScriptDirectoryPath, 'config.ini')

# init configParser and open file
config = configparser.ConfigParser()
config_result = config.read(configFilePath, encoding='utf8')

# SET Parameters - paths
save_dir = os.path.join(currentScriptDirectoryPath, config.get('pfade', 'save_dir'))
parameter_file = os.path.join(currentScriptDirectoryPath, config.get('pfade', 'parameter_file'))
stationen_file = os.path.join(currentScriptDirectoryPath, config.get('pfade', 'stationen_file'))
logfile_dir = os.path.join(currentScriptDirectoryPath, config.get('pfade', 'logfile_dir'))
mosaic_dir = config.get('pfade', 'mosaic_dir') 
base_url = config.get('pfade', 'base_url') 

# SET Parameters - Database
db_conn = f"host={config.get('connection', 'DB_HOST')} \
    port={config.get('connection', 'DB_PORT')} \
    dbname={config.get('connection', 'DB_NAME')} \
    user={config.get('connection', 'DB_USER')} \
    password={config.get('connection', 'DB_PASS')}"
table_name = config.get('connection', 'table_name')

##########
# LOGGER #
##########
if not Path(logfile_dir).is_dir():
    os.mkdir(logfile_dir)
logger = logging.getLogger(__name__)
logfile_name = os.path.join(logfile_dir, f"LOG_{datetime.datetime.now().strftime('%Y_%m_%d__%H_%M')}")
logging.basicConfig(filename = logfile_name, encoding='utf-8', level=logging.DEBUG)






##########
# ABLAUF #
##########







# START DATENIMPORT
startTime = datetime.datetime.now()
logger.info('Starting skript ..')

#####
# Es wird über die Stationen iteriert, jede Station wird dabei eine Instanz der Klasse poi_processor_module.PoiProcessor 
# Alle Variablen zur Konfiguration werden bei der Instanzierung übergeben und kommen aus der config.ini-Datei
# Dazu gehören auch die 2 csv-Dateiein aus denen die Stationen und Wetterparameter ausgelesen werden
#####

# Stationen einlesen
df_stationen = pd.read_csv(stationen_file)
stationsids = df_stationen['id'].to_list()

for index, row in df_stationen.iterrows():
    MosmixStation = mosmix_processor_module.MosmixProcessor(
        db_conn = db_conn,
        stationsname = row['Stationsname'],
        stationsid = row['id'], 
        shape = sgeom.Point(row['lon'], row['lat']),
        logger = logger, 
        parameter = pd.read_csv(parameter_file).to_dict(orient='list'),
        tableName = table_name,
        baseUrl = base_url,
        saveDirectory = save_dir
        )
    
    MosmixStation.download_file()

    MosmixStation.Daten_auslesen()

    MosmixStation.Mosmix_tabelle_truncaten()

    MosmixStation.Mosmix_tabelle_updaten()

    MosmixStation.Einheiten_anpassen()

    MosmixStation.Alte_Dateien_loeschen()

# END DATENIMPORT
logger.info(f"ERTIG: Import- bzw. Updateprozess abgeschlossen!")
scriptDuration = str(datetime.datetime.now() - startTime).split('.', maxsplit=1)[0]
logger.info(f'Importdauer: {scriptDuration}')









# START KARTENERSTELLUNG
logger.info(f"Beginne mit Kartenerstellung...")
startTime = datetime.datetime.now()

# Initiieren und alle Zeitpunkte speichern
MapGenerator = mosmix_map_generator_module.MosmixMapGenerator(logger = logger, 
                                                              db_conn = db_conn, 
                                                              tableName = table_name, 
                                                              mosaic_dir = mosaic_dir, 
                                                              zeitschritt=2)
MapGenerator.get_Zeitpunkte()

# TEMPERATUR: GeoTIFFs erstellen
MapGenerator.process_param(parameter = 'temperatur', 
                           nachkommastellen = 0, 
                           name_arbeitsbereich = 'mosmix_wetter', 
                           name_image_mosaic_store = 'mosmix_temperatur',
                           mosaic_index_table = 'wetter.data_temperatur',
                           update_index = False)


# WINDGESCHWINDIGKEIT: GeoTIFFs erstellen
MapGenerator.process_param(parameter = 'windgeschwindigkeit', 
                           nachkommastellen = 0, 
                           name_arbeitsbereich = 'mosmix_wetter', 
                           name_image_mosaic_store = 'mosmix_windgeschwindigkeit', 
                           mosaic_index_table = 'wetter.data_windgeschwindigkeit',
                           update_index = False)


# NIEDERSCHLAG : GeoTIFFs erstellen
MapGenerator.process_param(parameter = 'niederschlag_letzte_stunde', 
                           nachkommastellen = 0,
                           name_arbeitsbereich = 'mosmix_wetter', 
                           name_image_mosaic_store = 'mosmix_niederschlag_letzte_stunde', 
                           mosaic_index_table = 'wetter.data_niederschlag_letzte_stunde', 
                           null2nodata=True,
                           update_index = False)


# WINDRICHTUNG: : GeoTIFFs erstellen
# MapGenerator.process_param(parameter = 'windrichtung', 
#                            nachkommastellen = 0, 
#                            name_arbeitsbereich = 'mosmix_wetter', 
#                            name_image_mosaic_store = 'mosmix_windrichtung', 
#                            mosaic_index_table = 'wetter.data_windrichtung',
#                            update_index = False)


# DB Connection schließen
MapGenerator.close_db_connection()


# END KARTENERSTELLUNG
logger.info(f"Kartenerstellung abgeschlossen!")
scriptDuration = str(datetime.datetime.now() - startTime).split('.', maxsplit=1)[0]
logger.info(f'Dauer Kartenerstellung: {scriptDuration}')