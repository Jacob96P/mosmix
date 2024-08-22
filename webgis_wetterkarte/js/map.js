// Map, Layer, Koordinatenanzeige und Maßstab

import { Map, View } from 'ol';
import { fromLonLat } from 'ol/proj';
import XYZ from 'ol/source/XYZ';
import TileLayer from 'ol/layer/Tile';
import { Style } from 'ol/style';
import OSM from 'ol/source/OSM';
import TileWMS from 'ol/source/TileWMS';
import {ScaleLine } from 'ol/control.js';
import { transform } from "ol/proj";
import { toStringHDMS } from "ol/coordinate";
import { WMSCapabilities } from 'ol/format';
import { choice } from './route';
import { wetterEinheit} from './wetterOptions'

//Map wird erstellt und exportiert
export let map = new Map({
  target: 'map'
});
// Wo die App startet
const map_view = new View({
  center: fromLonLat([11.3, 54.8]),
  zoom: 8.8,
});
map.setView(map_view);

// Baselayer
export const openstreetmap = new TileLayer({
  id: 'openstreetmap',
  title: 'OpenStreetMap',
  type: 'base',
  visible: true,
  source: new OSM()
});
export const satellit = new TileLayer({
  id: 'satellit',
  title: 'ArcGIS World Imagery',
  type: 'base',
  visible: false,
  source: new XYZ({
      url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
  })
});

// Overlay-Layer
export const openseamap = new TileLayer ({
  id: 'openseamap',
  title: 'OpenSeaMap',
  visible: false,
  source: new XYZ({
      url: 'http://tiles.openseamap.org/seamark/{z}/{x}/{y}.png'
      //z,x,y sind parameter die je nach zoomstufe bei aufruf angepasst werden
  }),
  style: (feature, resolution) => { //ist der funktionskörper, jetzt kommt was zu funktion gehört
      let idx = feature.get('OBJECTID');
      let styleCache = {};
      styleCache[idx] = [
          new Style({
              zIndex: 990 //damit symbol ganz oben liegt und nicht verdeckt wird
          })
      ];
      return styleCache[idx];
  }
});

let wetterSource = new TileWMS({
  url: 'http://localhost:8080/geoserver/wms',
  params: {'LAYERS': 'mosmix_wetter:data_temperatur', 'TILED': true},
  serverType: 'geoserver',
  transition: 0,
  crossOrigin: 'anonymous'
})
// Wetter-Overlay-Layer
export const wetter = new TileLayer({
  id: 'wetter',
  title: 'Temperatur',
  visible: false,
  source: wetterSource,
  zIndex: 1000
});

export function updateLayerTime(time) {
  wetter.getSource().updateParams({'TIME': time});
}


const parser = new WMSCapabilities();
fetch('http://localhost:8080/geoserver/mosmix_wetter/wms?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetCapabilities&layer=data_temperatur')
.then(function (response) {
    return response.text();
})
.then(function (text) {
    const result = parser.read(text)
    let layers = result.Capability.Layer.Layer
    layers.forEach((layer) => {
      console.log(layer)
    })
});

export async function getStyleName(layerName) {
  const parser = new WMSCapabilities();
  
  try {
    const response = await fetch('http://localhost:8080/geoserver/mosmix_wetter/wms?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetCapabilities');
    const text = await response.text();
    const result = parser.read(text);
    const layers = result.Capability.Layer.Layer;

    // Stilnamen extrahieren
    for (let layer of layers) {
      if (layer.Name === layerName) {
        return layer.Style[0].Name;
      }
    }
    
    // Fallback, wenn der Layer nicht gefunden wurde
    throw new Error(`Layer ${layerName} not found`);
  } catch (error) {
    console.error("Fehler beim Abrufen des Stilnamens:", error);
    return null;
  }
}

// Funktion zum Abrufen der Legende für den aktuellen Layer und Style
export async function updateLayerLegend(layerName) {
  console.log(layerName);

  try {
    const styleName = await getStyleName(layerName);
    
    if (styleName) {
      const legendUrl = `http://localhost:8080/geoserver/wms?REQUEST=GetLegendGraphic&VERSION=1.3.0&FORMAT=image/png&WIDTH=20&HEIGHT=20&LAYER=${layerName}&STYLE=${styleName}`;
      console.log(legendUrl);

      // Legendenbild-Container finden oder erstellen
      let legendContainer = document.getElementById('layerLegend');

      // Legendenbild einfügen
      legendContainer.innerHTML = `<img src="${legendUrl}" alt="Legende für ${layerName}" />`;
      console.log(legendContainer.innerHTML);
    }
  } catch (error) {
    console.error("Error updating legend:", error);
  }
}



// Layer der map hinzufügen
map.addLayer(openstreetmap);
map.addLayer(satellit)
map.addLayer(openseamap);
map.addLayer(wetter);




// Koordinatenanzeige unten rechts
function coords_pointermove(event) {
    let coord3857 = event.coordinate;
    let coord4326 = transform(coord3857, 'EPSG:3857', 'EPSG:4326');
    document.getElementById('mouseCoord4326').innerHTML = toStringHDMS(coord4326);
}
map.on('pointermove', event => {
  coords_pointermove(event);
});


// Scalebar unten links
// const scaleBarOptionsContainer = document.getElementById('scaleBarOptions');
let scalebarControl;
let unit 
if (choice == 'km') {
  unit = 'metric'
} else {
  unit = 'nautical'
}
function scaleControl() {
    scalebarControl = new ScaleLine({
      units: unit,
      bar: true,
      steps: 4,
      minWidth: 140,
    });
  return scalebarControl;
}

map.addControl(scaleControl())

export { scalebarControl }

// GetFeatureInfo
map.on('singleclick', function (evt) {
  document.getElementById('info').innerHTML = '';
  const viewResolution = /** @type {number} */ (map_view.getResolution());
  const url = wetterSource.getFeatureInfoUrl(
    evt.coordinate,
    viewResolution,
    'EPSG:3857',
    {'INFO_FORMAT': 'text/html'},
  );
  if (url) {
    fetch(url)
      .then((response) => response.text())
      .then((html) => {
        // Parsen des HTML-Textes
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Extrahiere den Wert der "GRAY_INDEX"-Spalte
        const grayIndexElement = doc.querySelector('td:last-child'); // Annahme: Der "GRAY_INDEX"-Wert ist die letzte Zelle in einer Tabelle
        if (grayIndexElement) {
          let info_div = document.getElementById('info')
          const grayIndexValue = grayIndexElement.textContent;
          info_div.innerHTML = `${Math.round(grayIndexValue)} ${wetterEinheit}`;
        }
      });
  }
});