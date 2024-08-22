# Installation 
## WebGIS
1. node installieren, wenn noch nicht geschehen (brew install node)
2. Projektverzeichnis normal initialisieren (npm create ol-app <name>)
3. turf und uuid installieren
    npm install @turf/turf
    npm install uuid
4. npm run
5. npm start
6. API starten (route_API_DB/route.py)

## Geoserver
1. Java 11 (JRE) installieren
2. Geoserver als binary laden
3. In Terminal  
3.1 Geoserv er umgebungsvariable
```export GEOSERVER_HOME=/pfad/zu/geoserver``` in .zprofile hinzufügen, sonst funktioniert das starten nicht
3.2 Java Umgebungsvariable
```export JAVA_HOME=/pfad/zu/JAVA``` in .zprofile hinzufügen, sonst funktioniert das starten nicht
4. Starten  
```/Applications/geoserver-2/bin/startup.sh```   
5. Stoppen  
```/Applications/geoserver-2/bin/shutdown.sh``` 
6. Öffnen unter http://localhost:8080/geoserver


Capabilities:
http://localhost:8080/geoserver/<Dienstname>/wms?request=GetCapabilities
Map:
http://localhost:8080/geoserver/<Dienstname>/wms?request=GetMap&layers=<Layername>




sudo rm -rf /Library/Java/JavaVirtualMachines/temurin-17.jre



CORS auf dem Geoserver aktivieren
Sie können CORS auf Ihrem Geoserver aktivieren, indem Sie die Konfigurationsdateien des Servers anpassen.
So aktivieren Sie CORS:
Geoserver-Installation:
Gehen Sie zum Ordner, in dem Geoserver installiert ist.
Suchen Sie nach dem Verzeichnis webapps und navigieren Sie zum geoserver-Verzeichnis.
web.xml bearbeiten:
Öffnen Sie die Datei web.xml, die sich normalerweise im Verzeichnis WEB-INF befindet.
Fügen Sie folgenden Filter am Ende des <web-app>-Tags hinzu (vor dem abschließenden </web-app>):
xml
Code kopieren
<filter>
    <filter-name>cross-origin</filter-name>
    <filter-class>org.eclipse.jetty.servlets.CrossOriginFilter</filter-class>
    <init-param>
        <param-name>allowedOrigins</param-name>
        <param-value>*</param-value> <!-- Hier können Sie spezifische Domains angeben, wenn nötig -->
    </init-param>
    <init-param>
        <param-name>allowedMethods</param-name>
        <param-value>GET,POST,HEAD</param-value>
    </init-param>
    <init-param>
        <param-name>allowedHeaders</param-name>
        <param-value>X-Requested-With,Content-Type,Accept,Origin</param-value>
    </init-param>
</filter>
<filter-mapping>
    <filter-name>cross-origin</filter-name>
    <url-pattern>/*</url-pattern>
</filter-mapping>
Neustart des Geoservers:
Starten Sie den Geoserver neu, damit die Änderungen wirksam werden.