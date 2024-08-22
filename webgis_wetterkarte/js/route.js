// Hauptdatei
// Alles Rund um den Törnplaner


// Eigene Dateien
import '../style.css';
import { map } from './map';
import { addFirstCoordinate , addCoordinateInfo , addHeader } from './routes_table';
import { scalebarControl } from './map';

// Geladene Funktionen und Packages
import Feature from 'ol/Feature';
import 'ol/ol.css';
import {Draw, Modify, Snap} from 'ol/interaction.js';
import { Vector as VectorSource} from 'ol/source.js';
import { Vector as VectorLayer} from 'ol/layer.js';
import { get } from 'ol/proj.js';
import GeoJSON from 'ol/format/GeoJSON';
import { transform } from "ol/proj";
import { Overlay } from 'ol';
import { distance, length } from '@turf/turf';
import { v4 as uuidv4 } from 'uuid';
import { MultiLineString, Point } from 'ol/geom';
import { Circle, Fill, Stroke, Style } from 'ol/style';

// HTML Knöpfe
const save = document.getElementById("save-route");
const clear_features = document.getElementById("clear-features");
const toerns = document.getElementById("toerns");
const toern_add = document.getElementById("toern-add");
const toern_delete = document.getElementById("toern-delete");
const delete_message = document.getElementById("delete-message");
const routes = document.getElementById("routes");
const routes_add = document.getElementById("routes-add");
const routes_delete = document.getElementById("routes-delete");
const remove_latest = document.getElementById("remove-latest");
const routes_distance = document.getElementById("routes-distance");
const routes_zoom = document.getElementById("routes-zoom");
const routeOptions = document.getElementById('routeOptions');
const route_edit = document.getElementById('route-edit');
const toern_edit = document.getElementById('toern-edit');
const sm_km_toggle = document.getElementById('sm-km-toggle');

// URL der API
const api_url = 'http://localhost:8083'


// Source und Vektorlayer und Style der LineStrings für die Routen
var lineStyle = new Style({
  stroke: new Stroke({
      color: '#A10075',
      width: 3
  })
});
const source = new VectorSource();
const vector = new VectorLayer({
    source: source,
    style: function(feature) {
        let styles = [lineStyle];

        if (feature.getGeometry().getType() === 'LineString') {
            const coordinates = feature.getGeometry().getCoordinates();
            coordinates.forEach(coordinate => {
                styles.push(new Style({
                    geometry: new Point(coordinate),
                    image: new Circle({
                        radius: 3.5,
                        fill: new Fill({
                            color: '#ffcc33'
                        }),
                        stroke: new Stroke({
                            color: '#ffcc33',
                            width: 2
                        })
                    })
                }));
            });
        }
        return styles;
    }
});

// Interaktionen
let draw, snap;
const n_modify = new Modify({source: source});

// Overlay für Distanz und Kurs
const distanceOverlay = new Overlay({
  element: document.createElement('div'),
  positioning: 'bottom-center',
  offset: [0, -15],  // Label Offset relativ zum Cursor
  stopEvent: false   // Map Events trotz Overlay erlaubt
});

// Feature ID wird gesetzt weil modify sonst die Reihenfolge durcheinander bringt
let featureIdCounter = 0;
source.on('addfeature', (event) => {
    if (!event.feature.getId()) {
        event.feature.setId('feature_' + featureIdCounter++);
    }
});

// Am ende des modifys wieder nach ID sortieren
n_modify.on('modifyend', (event) => {
  let features = source.getFeatures().sort((a, b) => {
      return parseInt(a.getId().split("_")[1]) - parseInt(b.getId().split("_")[1]);
  });
  
  // Elle entfernen und die wieder sortierten wieder hinzufügen
  source.clear();
  source.addFeatures(features);
});


// Funktion zum Togglen von km auf nm
export let choice = 'km';
function smKmToggle() {
  if (choice === 'km') {
        choice = 'nm';
        scalebarControl.setUnits('nautical');
        document.getElementById('sm-km-toggle').title = 'Einheit -> Kilometer';
    } else {
        choice = 'km';
        scalebarControl.setUnits('metric');
        document.getElementById('sm-km-toggle').title = 'Einheit -> Seemeilen';
    }
}
// Toggle Button
sm_km_toggle.addEventListener('click', () => {
  smKmToggle();
  routes_table(event = undefined);  // Koordinatenanzeige wird aktualisiert
  routes_distance.textContent = sourceGetDistance().toFixed(2) + ' ' + choice;  // Gesamtdistanz wird neu berechnet
})

/////////////////////////////////////////////////
//////////////    FUNKTIONEN    /////////////////
/////////////////////////////////////////////////


// FUNKTION -> Zeichnen Starten
function addInteractions() {
  draw = new Draw({
    source: source,
    type: 'LineString'
  });
  map.addInteraction(draw);
  snap = new Snap({source: source});
  map.addInteraction(snap);
};


// FUNKTION -> Zeichnen beenden
function removeInteractions() {
  map.removeInteraction(draw);
  map.removeInteraction(snap);
  map.removeLayer(vector);
  source.clear();
  distanceOverlay.setPosition(undefined); // DistanceOverlay auch weg
}


// FUNKTION -> Alle Options aus Listbox entfernen
function removeOptions(selectElement) {
  while (selectElement.options.length) {
      selectElement.remove(0);
  }
}


// FUNKTION -> Letztes Feature entfernen
function removeLatest () {
  let features = source.getFeatures();
  let lastFeature = features[features.length - 1];
  source.removeFeature(lastFeature);
};


// FUNKTION zum berechnen der Distanz aller LineStrings die gerade in der source sind
function sourceGetDistance() {
  let distance = 0
  if (source.getFeatures().length > 0) {
    source.forEachFeature( (f) => {
      const formatGeoJSON = new GeoJSON();
      const featureGeoJSON = formatGeoJSON.writeFeature(f, {
        dataProjection: 'EPSG:4326',
        featureProjection: 'EPSG:3857',
        decimals: 6
      });
      const lineGeoJson = JSON.parse(featureGeoJSON);
      distance += length(lineGeoJson, 'kilometers')   // Berechnung mit .turf/length
    })
    if (choice == 'nm') {
      distance = distance / 1.852216
    }
  } else {
    distance = 0
  }
  return distance
}


// FUNKTION zum erstellen einer Benachrichtigung, Länge 5 sekunden
function greeting_bottom_left(text, color) {
  const greeting = document.getElementById('greeting');
    greeting.textContent = text;
    greeting.style.display = 'block';
    greeting.style.top = '92%';
    greeting.style.position = 'absolute';
    greeting.style.backgroundColor = color
    setTimeout(() => {
      greeting.style.display = 'none';
    }, 5000);
}


// FUNKTION zum Berechnen des Kurses mit forward azimuth
function calculateBearing(start, end) {
  const lon1 = start[0] * Math.PI / 180.0;
  const lon2 = end[0] * Math.PI / 180.0;
  const lat1 = start[1] * Math.PI / 180.0;
  const lat2 = end[1] * Math.PI / 180.0;

  const dLon = lon2 - lon1;
  
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  
  let brng = Math.atan2(y, x) * 180.0 / Math.PI;

  // Auf Grad normalisiern
  brng = (brng + 360) % 360;

  brng = brng.toFixed(2)

  return brng;
}


// FUNKTION -> Koordinatentabelle neu erstellen
function routes_table(event) {
  const features = source.getFeatures();
  const totalFeatures = features.length;

  // Alle Koordinaten
  let allCoordinates = [];

  // Alle Koordinaten eines Features dem Array hinzufügen
  function handleFeature(feature) {
      const geometry = feature.getGeometry();
      console.log(geometry)
      if (geometry) {
          allCoordinates.push(...geometry.getCoordinates());
      }
  }

  // Wenn es nur ein Feature gibt, das eine Geometrie hat und die Tabelle nicht nach einem event neu erstellt wird
  // Wichtig wenn nur ein Feature aus der DB kommt
  // Darf aber nicht passieren, wenn eine Route neu angelegt wird, da dann bereits ein geometrieloses Feature in der Source
  if (totalFeatures === 1 && features[0].getGeometry() && event == undefined) {
      handleFeature(features[0]);
      return;
  }

  // Für Drawend alle außer das letzte und das dann mit eventgeom
  if (event != undefined) {
    console.log(event.feature)
    if (event.type == 'drawend') {

      // Wenn nur eins dann nur die eventgeom
      if (totalFeatures == 0) {
        handleFeature(event.feature);
        console.log(event.feature.getGeometry().getCoordinates())
        console.log(handleFeature(event.feature))
      }

      // Wenn mehr als eins dann erst source und dann eventgeom
      if (totalFeatures > 0) {
        for (let index = 0; index < totalFeatures; index++) {
            if (features[index].getGeometry()) {
              handleFeature(features[index]);
              console.log('sourceFeatureHandeled')
            } 
        };
        handleFeature(event.feature);
        console.log('eventFeaturehandeled')
      }
    } 
  }

  // Beim laden der features aus der DB immer alle laden
  if (event == undefined) {
    for (let index = 0; index < totalFeatures ; index++) {
      handleFeature(features[index]);
    }
  }

  // Doppelte Stützpunkte wenn ein nächster linestring gezeichnet wird entfernen
  console.log("All Coordinates:", allCoordinates);
  allCoordinates = allCoordinates.filter((value, index, self) => {
    return self.findIndex(arr => 
      arr.length === value.length &&
      arr.every((v, i) => v === value[i])
    ) === index;
  });

  // Tabelle entfernen bevor sie neu erstellt wird
  if (document.querySelector('.route-table-div') != undefined) {
    document.querySelector(".route-table-div").remove();
  }

  // Tabelle neu erstellen mit Funktionen aus js/route_table
  if (allCoordinates.length > 0) {
    // Header und erste Zeile
    addHeader();
    addFirstCoordinate(allCoordinates[0]);
    // Alle weiteren Stützpunkte
    for (let index = 1; index  < allCoordinates.length; index++) {

      const startpunkt =  transform(allCoordinates[index-1], 'EPSG:3857', 'EPSG:4326');
      const zielpunkt = transform(allCoordinates[index], 'EPSG:3857', 'EPSG:4326');

      let distanz = distance(startpunkt, zielpunkt, {units: 'kilometers'});   // distanz mit turf/distance
      if (choice == 'nm') {
        distanz = distanz / 1.852216
      }
      let kurs = calculateBearing(startpunkt, zielpunkt)    // Kurs mit eigener Funktion

      addCoordinateInfo(index, distanz.toFixed(2) + ' ' + choice, kurs + '°', allCoordinates[index])
    }
  }
}


// FUNKTION -> Routen eines Törns anzeigen
function routen_anzeigen (toern_id) {
  removeOptions(routes)
  fetch(api_url + '/get_routes/' + toern_id, {
    method: 'GET',
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    return response.json();
  })
  .then(data => {
    let alle_routen = data['features']
    for(let i = 0; i < alle_routen.length; i++) {
      let obj = alle_routen[i];
      let option = document.createElement("option");
      option.text = obj.route_name;
      option.id = obj.route_id;
      option.geom = obj.geometry;
      routes.add(option);
      };
  })
  .catch(error => {
    console.error('There was a problem with the fetch operation:', error.message);
  });
}

// FUNKTION -> Routengeometrien in source laden
async function route_laden (route_id) {

  source.clear()
  fetch(api_url + '/get_route/' + route_id, {
    method: 'GET',
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    return response.json();
  })
  .then(data => {
    const formatGeoJSON = new GeoJSON();

    const feature = formatGeoJSON.readFeature(data, {
      dataProjection: 'EPSG:4326',
      featureProjection: 'EPSG:3857',
    });
    
    // Wenn worher keine Geometrie gespeichert wurde feature ohne geom anlegen, damit Törn und Routeninfos getrackt werden können
    if (data['geometry'] == undefined) {
      let newfeature = new Feature ({
        type: 'route',
        route_id: data['route_id'],
        toern_id: data['toern_id'],
        toern_name: data['toern_name'],
        route_name: data['route_name'],
      });
      source.addFeature(newfeature);
    } else {
      // Sonst einfach hinzufügen
      let LineStrings = feature.getGeometry().getLineStrings()
      for (let i in LineStrings) {
        let feature_LineString = new Feature ({
          type: 'route',
          geometry: LineStrings[i],
          route_id: data['route_id'],
          toern_id: data['toern_id'],
          toern_name: data['toern_name'],
          route_name: data['route_name'],
        });
        source.addFeature(feature_LineString);
      }
    }
  })
  .catch(error => {
    console.error('There was a problem with the fetch operation:', error.message);
  });
  // Damit beim erstellen der Koordinatentabelle gewartet wird, sonst läuft das nicht
  return new Promise((resolve) => {
    setTimeout(() => {
        resolve();
    }, 1000);
  });
}


// FUNKTION -> Route Zeichnen
function draw_route (route_id) {

  // Alle Interactions usw. hinzufügen
  removeInteractions()
  const extent = get('EPSG:3857').getExtent().slice();
  extent[0] += extent[0];
  extent[2] += extent[2];
  map.addLayer(vector);
  vector.setZIndex(2)

  map.addInteraction(n_modify);
  addInteractions();
  map.addOverlay(distanceOverlay);

  source.routeID = route_id
  console.log('neue routeID', source.routeID)

  let distanz

  // Bei Drawstart Check ob Line String da anfängt wo der vorige aufhört
  // Wenn nicht wird neues feature entfernt
  draw.on('drawstart', (event) => {
    const features = source.getFeatures();
    const totalFeatures = features.length;
    if (totalFeatures === 1 && features[0].getGeometry()) {
      const sourceLength = source.getFeatures().length
      const sourceLastFeature = source.getFeatures()[sourceLength - 1] // weil letzts eventfeature noch ohne geom
      const sourceLastFeatureCoordinates = sourceLastFeature.getGeometry().getCoordinates()
      const coordinatesLength = sourceLastFeatureCoordinates.length

      const sourceLastPoint = sourceLastFeatureCoordinates[coordinatesLength - 1]

      const eventFirstPoint = event.feature.getGeometry().getCoordinates()[0]

      if (eventFirstPoint[0] != sourceLastPoint[0] && eventFirstPoint[1] != sourceLastPoint[1]) {
        console.log("moin")
        draw.abortDrawing()
        greeting_bottom_left('Die Route muss zusammenhängend sein.', '#e7481b')
      }
    }
  }) 
    
  draw.on('drawstart', (event) => {

    // Distanz- und Kurs-Overlay
    event.feature.getGeometry().on('change', (e) => {

        let geom = e.target;
        
        // Koordinaten des letzten Stützpunktes
        let coordinates = geom.getCoordinates();
        let webMercPointCoords = coordinates[coordinates.length - 2];
        let wgsPointCoords = transform(webMercPointCoords, 'EPSG:3857', 'EPSG:4326');

        // Koordinaten der Maus beim draggen
        let webMercMouseCoords = coordinates[coordinates.length -1];
        let wgsMouseCoords = transform(webMercMouseCoords, 'EPSG:3857', 'EPSG:4326');

        // Distanz mit Turf/distance
        distanz = distance(wgsPointCoords, wgsMouseCoords, {units: 'kilometers'});

        if (choice == 'nm') {
          distanz = distanz / 1.852216
        }

        // Kurs mit eigener Funktion
        let kurs = calculateBearing(wgsPointCoords, wgsMouseCoords)

        // Overlay-Text aktualisieren
        distanceOverlay.getElement().innerHTML = distanz.toFixed(2) + ' ' + choice + ' | ' + kurs + '°';

        // Overlay.Position aktualisieren
        let overlayPosition = e.target.getLastCoordinate();
        distanceOverlay.setPosition(overlayPosition);

    });
    // Overlay wenn neuer Stützpunkt gesetzt ist entfernen
    draw.on('drawend', (event) => {
      distanceOverlay.setPosition(undefined);  
    }); 
  })

  // Nach modify Tabelle + Distanzberechnung aktualisieren
  // Mache ich nicht, modify bringt die Reihenfolge der source durcheinander, Koordinaten werden in falscher Reihenfolge angezeigt (allgemeines Problem bei modify)
  // Habs doch gemacht
  n_modify.on('modifyend', (event) => {
    routes_table(event = undefined)

    let distance_all = sourceGetDistance()
    routes_distance.textContent = distance_all.toFixed(2) + ' ' + choice;
  })

  // Nach drawend Tabelle + Distanzberechnung aktualisieren
  draw.on('drawend', (event) => {
    draw.finishDrawing()
    routes_table(event)
    
    let distance_all = sourceGetDistance() + distanz
    routes_distance.textContent = distance_all.toFixed(2) + ' ' + choice;
  }); 
}


// FUNKTION -> Route Speichern
function save_geometry () {

  let route_id = source.routeID;
  console.log('neue routeID', source.routeID)

  // In MultiLineString umschreiben, da die so in DB abgelegt werden können
  let source_multiLineString = new Feature({
    type: 'route',
		geometry: new MultiLineString([])
  })
  source.forEachFeature( (f) => {
    source_multiLineString.getGeometry().appendLineString(f.getGeometry())
  })

  // Projektion ändern
  const formatGeoJSON = new GeoJSON();
  const featureGeoJSON = formatGeoJSON.writeFeature(source_multiLineString, {
    dataProjection: 'EPSG:4326',
    featureProjection: 'EPSG:3857',
    decimals: 6
  });
  const featureObj = JSON.parse(featureGeoJSON);

  const data = {
    "route_id": route_id,
    "geometry": featureObj.geometry
  }
  fetch(api_url + '/save_geometry' , {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8'
    },
    body: JSON.stringify(data)
  })
  .then(response => response.json())
  .then(data => {
    console.log('Success: ', data);

    // Benachrichtigung bei erfolgreichem Speichern
    greeting_bottom_left('Route gespeichert', '#28A745')
  })
  .catch( (error) => {
    console.error('Error: ', error)
  }); 
}

//////////////////////////////////////////////////////////////////
//////////////////////    BUTTONS   //////////////////////////////
//////////////////////////////////////////////////////////////////


// BUTTON -> Letztes Feature entfernen
remove_latest.addEventListener('click', () => {
  removeLatest()
  routes_table(event = undefined)
});


// BUTTON -> Alle Features aus Source entfernen
clear_features.addEventListener('click', () => {
  source.clear()
  routes_table(event = undefined)
});


// BUTTON -> Törn erstellen und hinzufügen
toern_add.addEventListener("click", () => {
  const toern_id = uuidv4();
  let toern_name = prompt("Bitte geben Sie den Namen des Törns ein:");
  if (toern_name === null || toern_name.trim() === "" || /[!-\/:-@[-`{-~]/.test(toern_name)) {
    alert("Bitte geben Sie einen gültigen Törnnamen ein. \nSonderzeichen sind nicht erlaubt ");
    return;
  }
  let duplikat = undefined;
  const data = {
    "toern_id": toern_id,
    "benutzer": localStorage.getItem('username'),
    "toern_name": toern_name,
  }
  fetch(api_url + '/create_toern', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8'
    },
    body: JSON.stringify(data)
  })
  .then(response => response.json())
  .then(data => {
    if (data['status'] == 'duplikat') {
      console.log('NameError: ', data);
      duplikat = true;
      alert("Dieser Törnname existiert bereits.");
		  return;
    } else { 
      console.log('Success: ', data); 
        let option = document.createElement("option");
        if (duplikat == undefined) {
          option.text = toern_name;
          option.id = toern_id;
          toerns.add(option);
          option.selected = true;
        }
      }
  })
  .catch( (error) => {
    console.error('Error: ', error)
  }); 
  source.clear()
});


// BUTTON -> Törn löschen und entfernen
toern_delete.addEventListener("click", () => {
  let selIndex = toerns.selectedIndex;
  let toern_name = toerns.options[selIndex].text;
  let toern_id = toerns.options[selIndex].id;
  let isConfirmed = confirm("Den Törn wirklich löschen?");
    if (isConfirmed) {
      toerns.remove(selIndex);
      routes.innerHTML = ""
      try {
        fetch(api_url + '/delete_toern' , {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json; charset=utf-8'
          },
          body: JSON.stringify( { 'toern_id': toern_id } )
        })
        .then( response => response.json() )
        .then( data => {
          if (data['status'] = true) {
            greeting_bottom_left('Der Törn "' + toern_name + '" wurde gelöscht' , '#28A745')
          }
        })
        .catch( error => {
          delete_message.innerHTML = error;
          setTimeout(delete_message, 500);
        });
      } catch (error) { }
    } else {  }
});


// BUTTON DBLCLICK -> Routen eines Törns in Listbox anzeigen
toerns.addEventListener("dblclick", () => {
  let selIndex = toerns.selectedIndex;
  let toern_id = toerns.options[selIndex].id;
  routen_anzeigen(toern_id)
});


// BUTTON -> Routen eines Törns in Listbox anzeigen
toern_edit.addEventListener("click", () => {
  let selIndex = toerns.selectedIndex;
  let toern_id = toerns.options[selIndex].id;
  routen_anzeigen(toern_id)
});


// BUTTON -> Route erstellen, in Listbox anzeigen und Features zeichnen
routes_add.addEventListener("click", () => {
  let selIndex = toerns.selectedIndex;
  let toern_name = toerns.options[selIndex].text;
  let toern_id = toerns.options[selIndex].id;
  const route_id = uuidv4();
  let geometry = null;
  let route_name = prompt("Bitte geben Sie den Namen der Route ein:");
  if (route_name === null || route_name.trim() === "" || /[!-\/:-@[-`{-~]/.test(route_name)) {
    alert("Bitte geben Sie einen gültigen Namen ein. \nSonderzeichen sind nicht erlaubt ");
    return;
  }
  let duplikat = undefined;
  const data = {
    "route_id": route_id,
    "toern_id": toern_id,
    "benutzer": localStorage.getItem('username'),
    "toern_name": toern_name,
    "route_name": route_name,
    "geometry": geometry
  }
  fetch(api_url + '/create_route', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8'
    },
    body: JSON.stringify(data)
  })
  .then(response => response.json())
  .then(data => {
    if (data['status'] == 'duplikat') {
      console.log('NameError: ', data);
      duplikat = true;
      alert("Dieser Routenname existiert bereits.");
		  return;
    } else { 
      console.log('Success: ', data); 
        let option = document.createElement("option");
        if (duplikat == undefined) {
          option.text = route_name;
          option.id = route_id;
          option.geom = geometry;
          routes.add(option);
          option.selected = true;
        }
      }
  })
  .catch( (error) => {
    console.error('Error: ', error)
  });
  draw_route(route_id);
  source.routeID = route_id;
  console.log('neue routeID', source.routeID)
  distanceOverlay.setPosition(undefined);
  routeOptions.style.display = 'block';
  routes_table();
  routes_distance.textContent = sourceGetDistance().toFixed(2) + ' ' + choice;
});


// BUTTON -> Route löschen und aus Listbox entfernen
routes_delete.addEventListener("click", () => {
  let selIndex = routes.selectedIndex;
  let route_name = routes.options[selIndex].text;
  let route_id = routes.options[selIndex].id;

  let isConfirmed = confirm("Route wirklich löschen?");
  if (isConfirmed) {
    routes.remove(selIndex);
    try {
      fetch(api_url + '/delete_route' , {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json; charset=utf-8'
        },
        body: JSON.stringify( { 'route_id': route_id } )
      })
      .then( response => response.json() )
      .then( data => {
        if (data['status'] = true) {
          greeting_bottom_left('Die Route "' + route_name + '" wurde gelöscht' , '#e7481b')
          if (source.routeID == route_id) {
            removeInteractions()
          }
        }
      })
      .catch( error => {
        delete_message.innerHTML = error;
        setTimeout(delete_message, 500);
      });
    } catch (error) { }
  } else {  }
})


// BUTTON -> Auf Route zoomen
routes_zoom.addEventListener('click', () => {
  let extent = source.getExtent();
    
    if (extent) {   // Weil undefined wenn keine source leer
        map.getView().fit(extent, {
            size: map.getSize(),
            maxZoom: 18,  
            padding: [120, 120, 120, 120]   // damit nicht komplett rangezoomt wird
        });
      }
})


// BUTTON DBLCLICK -> Features der Route in Source laden, bearbeiten starten und Routenfenster Öffnen
routes.addEventListener("dblclick", () => {
  let selIndex = routes.selectedIndex;
  let route_id = routes.options[selIndex].id;
  removeInteractions()
  source.routeID = route_id;
  // Asynchron weil Routen erst geladen werden müssen bevor Tabelle erstellt wird
  (async function() {
    await route_laden(route_id);
    routes_table(event = undefined);
    if (sourceGetDistance() == undefined) {
      routes_distance.textContent = '- -';
    } else {
      routes_distance.textContent = sourceGetDistance().toFixed(2) + ' ' + choice;
    }
    })();
  draw_route(route_id);
  source.routeID = route_id;
  routeOptions.style.display = 'block';
  routes_distance.textContent = sourceGetDistance().toFixed(2) + ' ' + choice;
});


// BUTTON -> Features der Route in Source laden und bearbeiten starten und Routenfenster Öffnen
route_edit.addEventListener("click", () => {
  let selIndex = routes.selectedIndex;
  let route_id = routes.options[selIndex].id;
  removeInteractions()
  source.routeID = route_id;
  // Asynchron weil Routen erst geladen werden müssen bevor Tabelle erstellt wird
  (async function() {
    await route_laden(route_id);
    routes_table(event = undefined);
  routes_distance.textContent = sourceGetDistance().toFixed(2) + ' ' + choice;
    })();
  draw_route(route_id);
  source.routeID = route_id;
  routes_table(event = undefined)
  routeOptions.style.display = 'block';
  routes_distance.textContent = sourceGetDistance().toFixed(2) + ' ' + choice;
});


// BUTTON -> Route speichern
save.addEventListener("click", () => {
  source.forEachFeature( (f) => {
    console.log(f)
  })
  console.log(source.routeID)
  save_geometry();
});


// BUTTON -> Routenplaner beenden, Routenfenster schließen
document.getElementById('close-routeOptions').addEventListener('click', () => {
  routeOptions.style.display = 'none';
  removeInteractions();
  source.routeID = undefined;
});