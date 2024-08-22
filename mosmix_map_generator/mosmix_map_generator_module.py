###########
# IMPORTS #
###########
import psycopg2
import psycopg2.extras
import pandas as pd
from shapely import wkt
import numpy as np
from scipy.interpolate import griddata
from osgeo import gdal, osr
import os
from pathlib import Path
import glob
import subprocess

class MosmixMapGenerator:
    def __init__ (self, logger, db_conn, mosaic_dir, tableName, zeitschritt = 1):
        """
        :param self:instanzvariable
        :param logger: logger von der Main Methode
        :param baseUrl: Basis-URL von der die poi-Daten vom dwd geladen werden
        :param zeitschritt: Abstand zwischen Zeitschritten in Stunden, dafault == 1
        """
        self.logger = logger
        self.conn = psycopg2.connect(db_conn)
        self.tableName = tableName
        self.mosaic_dir = mosaic_dir
        self.zeitpunkte = []
        self.zeitschritt = zeitschritt
        self.mosaic_index_files = []

    def get_Zeitpunkte(self):
        '''
        input: 
        zeitschritt: Abstand zwischen Zeitschritten in Stunden, dafault == 1
        Mach ich nicht mit sqlalchemy auch wenn es empfohlen wird
        Dauert mindestens 3x so lange wie normal mit psycopg2 
        db_conn = f"postgresql+psycopg2://{config.get('connection', 'DB_USER')}:{config.get('connection', 'DB_PASS')}@{config.get('connection', 'DB_HOST')}:{config.get('connection', 'DB_PORT')}/{config.get('connection', 'DB_NAME')}"
        conn = create_engine(db_conn) # Verbindung db mit sqalchemy
        '''
        try:
            curs = self.conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
            curs.execute(f"""
                        SELECT DISTINCT(zeitpunkt) as zeitpunkt 
                        FROM {self.tableName} 
                        WHERE (CAST(EXTRACT(HOUR FROM zeitpunkt) AS INTEGER) % {self.zeitschritt} = 0)
                        ORDER BY zeitpunkt ASC;
            """)
            self.zeitpunkte = [row['zeitpunkt'] for row in curs.fetchall()]
            return self.zeitpunkte
        except Exception as e:
            self.logger.warning(f'Error: Fehler in getZeitpunkte(). {e}')

    def delete_old_files(self, parameter):
        # Alle Files mit der Endung .tif finden
        file_pattern = os.path.join(self.mosaic_dir, 'data_' + parameter, '*.tif')
        files_to_delete = glob.glob(file_pattern)

        # Files löschen
        for file_path in files_to_delete:
            try:
                os.remove(file_path)
            except Exception as e:
                self.logger.error(f'Fehler beim Löschen der Datei {file_path}: {e}')

    def get_Data(self, zeitpunkt, parameter):
        '''
        returnt einen df für einen bestimmten zeitpunkt mit allen parametern aus der db
        '''
        df_dict = {}
        try:
            query = f"""
            SELECT stationsid, stationsname, ST_AsText(shape) as shape, 
            {parameter}
            FROM {self.tableName}
            WHERE zeitpunkt = '{zeitpunkt}';
            """
            # Daten in DF laden
            df = pd.read_sql(query, con = self.conn)
            # Latitude und Longitude extrahieren
            df['geometry'] = df['shape'].apply(wkt.loads)
            df['latitude'] = df['geometry'].apply(lambda geom: geom.y)
            df['longitude'] = df['geometry'].apply(lambda geom: geom.x)
            df = df.drop(columns='geometry')
            # Dict hinzufügen
            df_dict[f'{zeitpunkt}'] = df
            # Verbindung schließen
            return df
        except Exception as e:
            self.logger.warning(f'Error: Fehler beim laden der Daten: Parameter {parameter} zum Zeitpunkt {zeitpunkt}!, {e}')

    def interp_to_grid(self, df, parameter, nachkommastellen, zeitpunkt, steps_gitter_lon = 500, steps_gitter_lat = 500, null2nodata = False):
        '''
        inputs: 
        df: df mit den feldern ['latitude','longitude', '<parameter>'] der stationen
        steps_gitter_lon: Anzahl gitterpunkte in y richtung
        steps_gitter_lat: Anzahl gitterpunkte in x richtung
        output: ndarray als output von scipy.griddata (Interpolation)
        Interpoliert Temperaturdaten eines Zeitpunktes zu einem Grid
        Grid wird anschließend in raster_to_GeoTiff als GeoTiff abgespeichert
        '''
        try:
            parameter = df[parameter].values

            # Gitter für Interpolation definieren
            grid_lon = np.linspace(df['longitude'].min(), df['longitude'].max(), steps_gitter_lon)
            grid_lat = np.linspace(df['latitude'].min(), df['latitude'].max(), steps_gitter_lat)
            grid_lon, grid_lat = np.meshgrid(grid_lon, grid_lat)
            points = np.vstack((df['latitude'], df['longitude'])).T
            # Interpolieren
            interp_grid = griddata(points, parameter, (grid_lat, grid_lon), method='linear') # auswahl aus {‘linear’, ‘nearest’, ‘cubic’}, linear sieht für mich am besten aus
            interp_grid = np.flipud(interp_grid)  # Raster läuft von oben nach unten, Bilder von unten nach oben, deshalb umsrehen
            # Runden
            interp_grid = np.round(interp_grid, nachkommastellen)
            # No Data Value setzen 
            interp_grid = np.nan_to_num(interp_grid, nan=-999)
            if null2nodata:
                interp_grid = np.where(interp_grid == 0, -999, interp_grid)
            return interp_grid
        except Exception as e:
            self.logger.warning(f'Error: Fehler beim interpolieren des df: Parameter {parameter} zum Zeitpunkt {zeitpunkt}. {e}')

    def to_GeoTiff(self, df, grid, zeitpunkt, zeitschritt_count, parameter, nachkommastellen):
        '''
        Input sind das interp grid und der df für die bbox
        '''
        try:
            zeitpunkt_string = zeitpunkt.strftime('%Y%m%d%H')
            date_part = zeitpunkt_string[:8]
            time_part = zeitpunkt_string[8:] + '00'
            zeitpunkt_string = f"{date_part}T{time_part}"

            if zeitschritt_count < 10:
                zeitschritt_count = f'00{str(zeitschritt_count)}'
            elif zeitschritt_count < 100:
                zeitschritt_count = f'0{str(zeitschritt_count)}'
            else:
                zeitschritt_count = str(zeitschritt_count)
            dir = os.path.join(self.mosaic_dir, f'data_{parameter}')
            if not Path(dir).is_dir():
                os.mkdir(dir)

            file_name = f'{parameter}{zeitschritt_count}_{zeitpunkt_string}.tif'
            output_file = os.path.join(self.mosaic_dir, dir, file_name)

            # GeoTIFF-Datei erstellen
            driver = gdal.GetDriverByName('GTiff')
            if nachkommastellen != 0:
                dataset = driver.Create(output_file, grid.shape[1], grid.shape[0], 1, gdal.GDT_Float32)
            elif nachkommastellen == 0:
                dataset = driver.Create(output_file, grid.shape[1], grid.shape[0], 1, gdal.GDT_Int16)

            # Temperaturdaten ins erste Band schreiben
            band = dataset.GetRasterBand(1)
            band.WriteArray(grid)

            band.SetNoDataValue(-999)

            # Georeferenzierung der Pixel
            # Damit die Pixel auf der Karte dort angezeigt werden wo sie hingehören
            # Dazu pixelgrößen definieren aus bbox und pixelanzahl in lat und lon
            x_min = df['longitude'].min()
            x_max = df['longitude'].max()
            y_min = df['latitude'].min()
            y_max = df['latitude'].max()
            pixel_width = (x_max - x_min) / grid.shape[1]
            pixel_height = (y_max - y_min) / grid.shape[0]
            # Geotransformation
            dataset.SetGeoTransform((x_min, pixel_width, 0, y_max, 0, -pixel_height))

            # Projektion (WGS84)
            srs = osr.SpatialReference()
            srs.ImportFromEPSG(4326)
            dataset.SetProjection(srs.ExportToWkt())

            # Datei schließen
            dataset.FlushCache()
            dataset = None

            self.mosaic_index_files.append(file_name)
        except Exception as e:
            self.logger.warning(f'Error: Fehler beim erstellen des GeoTiff, Parameter {parameter} zum Zeitpunkt {zeitpunkt}. {e}')
    
    def update_mosaic_index(self, mosaic_index_table, name_arbeitsbereich, name_imagemosaic_store, parameter):
        try:
            # Indextabelle leeren
            curs = self.conn.cursor()
            update_statement = f"DELETE FROM {mosaic_index_table}"
            print(update_statement)
            curs.execute(update_statement)
            self.logger.info(f'Indextabelle {mosaic_index_table} geleert!')

            # Neue Indexe einfügen
            command = f'''
            curl -v -u admin:geoserver -XPOST -H "Content-type: text/plain" \
            -d "{self.mosaic_dir}/data_{parameter}" \
            "http://localhost:8080/geoserver/rest/workspaces/{name_arbeitsbereich}/coveragestores/{name_imagemosaic_store}/external.imagemosaic"
            '''
            result = subprocess.run(command, shell=True, capture_output=True, text=True)

            if result.returncode == 0:
                self.logger.info(f'Indextabelle {mosaic_index_table} geupdated!')
            else:
                self.logger.warning(f'FEHLER: Indextabelle {mosaic_index_table} konnte nicht geupdated werden!')
        except Exception as e:
            self.logger.warning(f'Error: Fehler beim updaten der index-Tabelle "{mosaic_index_table}" . {e}')

    def process_param(self, parameter, nachkommastellen, name_arbeitsbereich, name_image_mosaic_store, mosaic_index_table = "", update_index = True, null2nodata = False):
        try:
            self.logger.info(f'Wetterkarten für Parameter {parameter} werden erstellt...')
            self.delete_old_files(parameter)
            zeitschritt_count = 0
            self.mosaic_index_files = []
            for zeitpunkt in self.zeitpunkte:
                df = self.get_Data(zeitpunkt, parameter)
                grid = self.interp_to_grid(df, 
                                           parameter, 
                                           nachkommastellen, 
                                           zeitpunkt, 
                                           null2nodata=null2nodata)
                zeitschritt_count = zeitschritt_count + self.zeitschritt
                self.to_GeoTiff(df, grid, zeitpunkt, zeitschritt_count, parameter, nachkommastellen)
            self.logger.info(f'Alle GeoTIFFs für Parameter {parameter} erstellt!')

            if update_index:
                self.update_mosaic_index(mosaic_index_table, name_arbeitsbereich, name_image_mosaic_store, parameter)

        except Exception as e:
            self.logger.warning(f'ERROR: Fehler in process_param(), Parameter {parameter}, {e}')
    
    def close_db_connection(self):
        self.conn.close()