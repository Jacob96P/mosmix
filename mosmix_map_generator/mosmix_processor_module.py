###########
# IMPORTS #
###########
import requests
import os
import shutil
import sys
import datetime
from zipfile import ZipFile
from xml.dom.minidom import parse
import psycopg2
import psycopg2.extras
import shapely

class MosmixProcessor:
    def __init__ (self, logger, db_conn, stationsname, stationsid, shape, parameter, baseUrl, saveDirectory, tableName):
        """
        :param self:instanzvariable
        :param logger: logger von der Main Methode
        :param stationsName: Name der Messstation
        :param id: dwd-id der Messstation
        :param shape: Lokation der Messstation
        :param fileName: Dateiname der csv-Datei die für die Station galaden wird
        :param parameter: Dictionary der Parameter die abgespeichert werden sollen
        :param aktuelleDaten: Zwischenspeichervariable für die Daten die aus der csv ausgelesen wurden und im nächsten Schritt in die Datenbank geschrieben werden
        :param baseUrl: Basis-URL von der die poi-Daten vom dwd geladen werden
        :param saveDirectory: Ordner in dem die csv-Dateien abgespeichert werden sollen
        :param loeschZeitpunkt: Zeitpunkt ab dem Daten aus der Datenbank gelöscht werden sollen (soll: alles älter als 14 tage)

        """
        self.logger = logger
        self.db_conn = db_conn
        self.stationsName = stationsname
        self.stationsid = stationsid
        self.shape = shape
        self.parameter = parameter
        self.baseUrl = baseUrl
        self.tableName = tableName
        self.saveDirectory = saveDirectory
        self.fileName = ""
        self.aktuelleDaten = {}
    
    def download_file(self):
        """
        Lädt die kmz-Datei (file_name) der Station vom dwd von der angegebenen base_url runter und legt sie am angegebenen Ort (saveDir) ab Außerdem wird die Datei noch entpackt.
        """
        self.logger.info(f"Die kmz-Datei für Station {self.stationsName} wird vom Deutschen Wetterdienst geladen...")
        file_name = f"MOSMIX_L_LATEST_{str(self.stationsid)}.kmz"
        url = f"{self.baseUrl}/{str(self.stationsid)}/kml/{file_name}"
        save_path = f"{self.saveDirectory}/{file_name}"
        try:
            if(not os.path.exists(self.saveDirectory)):
                try:
                    os.mkdir(self.saveDirectory)
                except Exception:
                    sys.exit(f"directory {self.saveDirectory} not found")
            response = requests.get(url)
            if response.status_code == 200:
                with open(save_path, 'wb') as file:
                    file.write(response.content)
                with ZipFile(save_path, 'r') as zObject:
                    zObject.extractall(path=self.saveDirectory)
                    self.fileName = zObject.namelist()[0]
                self.logger.info(f"Datei {self.fileName} wurde heruntergeladen und unter {save_path} gespeichert.")
        except Exception as e:
            self.logger.error(f"Fehler in Mosmix_Station.download_file() für Station {self.stationsName}, ", e)
    
    def Alte_Dateien_loeschen(self):
        """
        Zum löschen der kml und kmz Dateien nach dem Import.
        """
        self.logger.info(f"Die kmz-Datei wird entfernt")
        try:
            shutil.rmtree(self.saveDirectory)
        except Exception as e:
            self.logger.error(f"Fehler in Mosmix_Station.Alte_Dateien_loeschen() für Station {self.stationsName}, ", e)

    def Daten_auslesen(self):
        '''
        Die Wetterdaten aus den mit der Methode download_file() geladenen kml-Dateien werden ausgelesen und im Dictionary self.aktuelleDaten zwischengepeichert
        '''
        self.logger.info(f"Daten für Station {self.stationsName} werden aus kml-File ausgelesen....")
        try:
            file_path = f'{self.saveDirectory}/{self.fileName}'
            document = parse(file_path)
            data_dict = {}
            timeStep=document.getElementsByTagName("dwd:TimeStep")
            raw_data_list=[]
            Forecast=document.getElementsByTagName("dwd:Forecast")
            for i in range(len(self.parameter['parameter_name'])):
                for x in Forecast:
                    typ=x.getAttribute("dwd:elementName")
                    if typ==self.parameter['parameter_name'][i]:
                        value=x.getElementsByTagName("dwd:value")
                        raw_data=value.item(0).firstChild.nodeValue.split(' ')
                        for item in reversed(raw_data):
                            if item=="":
                                raw_data.pop(raw_data.index(item))
                        raw_data_list.append(raw_data)
                        
            for item in timeStep:
                j=timeStep.index(item)
                datetime_obj = datetime.datetime.strptime(item.firstChild.nodeValue, '%Y-%m-%dT%H:%M:%S.%fZ')
                res = {self.parameter['parameter_tabelle'][i]: raw_data_list[i][j] for i in range(len(self.parameter['parameter_tabelle']))}
                data_dict[datetime_obj] = res
            self.aktuelleDaten=data_dict
        except Exception as e:
            self.logger.error(f"Fehler in Poi_Station.Daten_auslesen() für Station {self.stationsName}, ", e)

    def Mosmix_tabelle_truncaten(self):
        '''
        Tabelle leeren
        '''
        self.logger.info(f"Daten der Station {self.stationsName} werden gelöscht")
        try:
            with psycopg2.connect(self.db_conn) as con:
                cur = con.cursor(cursor_factory=psycopg2.extras.DictCursor)
                cur.execute(f"DELETE FROM {self.tableName} WHERE stationsid = '{self.stationsid}';")
                self.logger.info(f"Daten der Station {self.stationsName} gelöscht")
        except psycopg2.OperationalError as e:
            self.logger.error(f"Fehler beim Löschen der Daten für Station {self.stationsName}, Exception: psycopg2.OperationalError: {e}") 
        except TypeError as e:
            self.logger.error(f"Fehler beim Löschen der Daten für Station {self.stationsName}, Exception: TypeError: {e}") 
        except Exception as e:
            self.logger.error(f"Fehler beim Löschen der Daten für Station {self.stationsName}, andere Exception: {e}") 

    def Mosmix_tabelle_updaten(self):
        '''
        Macht die Tabelle leer und füllt Sie mit den neuen Vorhersagedaten
        '''
        self.logger.info(f"Neue Daten für Station {self.stationsName} werden eingefügt...")
        fields_list = []
        insertData_list = []
        for key, value in self.aktuelleDaten.items():
            try:
                fields = ['stationsname', 'stationsid', 'shape', 'zeitpunkt']
                insertData = [self.stationsName, self.stationsid, self.shape, key]
                # Testen ob INT oder STRING oder NIX, damit entsprechend eingetragen werden kann
                for key2, value2 in value.items():
                    if self.is_int(value2):
                        fields.append(key2)
                        insertData.append(int(value2))
                    elif self.is_float(value2.replace(',', '.')):
                        fields.append(key2)
                        insertData.append(float(value2.replace(',', '.')))
                    else:
                        fields.append(key2)
                        insertData.append(None) # Wenn keine Zahl drin, dann None (null)
                fields_list.append(fields)
                insertData_list.append(insertData)
            except Exception as e:
                self.logger.error(f"Fehler in Poi_tabelle_updaten für Station {self.stationsName}, Exception: ", e)
        
        # Daten schreiben
        try:
            with psycopg2.connect(self.db_conn) as con:
                cur = con.cursor(cursor_factory=psycopg2.extras.DictCursor)
                for i in range(len(fields_list)):
                    spalten = ','.join(fields_list[i])
                    values = ','.join(
                        f"'{str(element)}'" if isinstance(element, (str, datetime.datetime))
                        else 'NULL' if element is None 
                        else f"ST_GeomFromText('{element}', 4326)" if isinstance(element, shapely.geometry.point.Point)
                        else str(element)
                        for element in insertData_list[i]
                    )
                    cur.execute(f'''INSERT INTO {self.tableName} ({spalten})
                                VALUES({values})''')
                    self.logger.info(f'NEUER DATENSATZ: Bei der Station {insertData_list[i][0]} zum Zeitpunkt {insertData_list[i][3]} wurde ein neuer Datensatz eingetragen!')
        except psycopg2.OperationalError as e:
            self.logger.error(f"Fehler beim Einfügen neuer Daten für Station {self.stationsName}, Exception: psycopg2.OperationalError: {e}") 
        except Exception as e:
            self.logger.error(f"Fehler beim Einfügen neuer Daten für Station {self.stationsName}, andere Exception: {e}")


    def Einheiten_anpassen(self):
        '''
        Temperatur in °C
        Druck in hPa
        Windgeschwindigkeit in knoten
        windboen_letzte_stunde in knoten
        '''
        self.logger.info(f'Bei Station {self.stationsName} werden die Einheiten temperatur und druck_auf_meereshoehe angepasst')
        try:
            with psycopg2.connect(self.db_conn) as con:
                cur = con.cursor(cursor_factory=psycopg2.extras.DictCursor)
                cur.execute(f"""UPDATE {self.tableName}
                    SET druck_auf_meereshoehe = druck_auf_meereshoehe / 100
                    WHERE stationsid = '{self.stationsid}';"""
                )
                cur.execute(f"""UPDATE {self.tableName}
                    SET temperatur = ROUND(CAST(temperatur - 273.15 AS numeric), 1)
                            WHERE stationsid = '{self.stationsid}';"""
                )
                cur.execute(f"""UPDATE {self.tableName}
                    SET windgeschwindigkeit = ROUND(CAST(windgeschwindigkeit * 1.94384 AS numeric), 1)
                            WHERE stationsid = '{self.stationsid}';"""
                )
                cur.execute(f"""UPDATE {self.tableName}
                    SET windboen_letzte_stunde = ROUND(CAST(windboen_letzte_stunde * 1.94384 AS numeric), 1)
                            WHERE stationsid = '{self.stationsid}';"""
                )
                self.logger.info(f'EINHEITEN ANGEPASST: Bei Station {self.stationsName} wurden die Einheiten temperatur, druck_auf_meereshoehe, Windgeschwindigkeit und windboen_letzte_stunde angepasst')
        except psycopg2.OperationalError as e:
            self.logger.error(f"Fehler beim Anpassen der Einheiten für Station {self.stationsName}, Exception: psycopg2.OperationalError: {e}") 
        except TypeError as e:
            self.logger.error(f"Fehler beim Anpassen der Einheiten für Station {self.stationsName}, Exception: TypeError: {e}") 
        except Exception as e:
            self.logger.error(f"Fehler beim Anpassen der Einheiten für Station {self.stationsName}, andere Exception: {e}")

    def parameter_eigenschaft_liste(self, eigenschaft):
        '''
        Gibt eine Eigenschaft der Parameter als sortierte Liste zurück
        input die header der parameter.csv
        Input:
        eigenschaft -> "parameter" (zurück kommt Liste mit Parameterbezeichnung), "einheit" oder "surface_description"
        '''
        for key, value in self.parameter.items():
            if key == eigenschaft:
                return value
    
    def is_float(self, string):
        '''
        Prüft ob der ein String in ein Float umgewandelt werden kann.
        Notwendig um Daten aus csv-Datei richtig abzuspeichern
        Input: String
        '''
        try:
            float(string)
            return True
        except ValueError:
            return False
    
    def is_int(self, string):
        '''
        Prüft ob der ein String in ein Int umgewandelt werden kann.
        Notwendig um Daten aus csv-Datei richtig abzuspeichern
        Input: String
        '''
        try:
            int(string)
            return True
        except ValueError:
            return False