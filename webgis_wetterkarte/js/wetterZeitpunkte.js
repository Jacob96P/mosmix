import { WMSCapabilities } from 'ol/format';
import { updateLayerTime } from "./map";

zeitauswahl.style.display = 'none';

let currentIndex = 0;
// Funktion zum Öffnen der zeitpunkte
function toggleZeitpunkte() {
    const zeitauswahlOptions = document.getElementById('zeitauswahl');
    if(zeitauswahlOptions.style.display === 'none' || wetterOptions.style.display === '') {
        zeitauswahlOptions.style.display = 'block';
    } else {
        zeitauswahlOptions.style.display = 'none';
    }
  }
document.getElementById('wetter-overlay').addEventListener('click', toggleZeitpunkte);

const parser = new WMSCapabilities();
fetch('http://localhost:8080/geoserver/mosmix_wetter/wms?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetCapabilities&layer=data_temperatur')
.then(function (response) {
    return response.text();
})
.then(function (text) {
    const result = parser.read(text)
    const timeValues = result.Capability.Layer.Layer[0].Dimension[0].values.split(',');
    console.log(timeValues);
    populateTimepoints(timeValues)
});

function populateTimepoints(timeValues)  {
    const timepointsContainer = document.getElementById('zeitpunkte');
    timepointsContainer.innerHTML = ''; // Leeren der bestehenden Zeitpunkte
    console.log(timeValues)
    timeValues.forEach((time, index) => {
        const timepointDiv = document.createElement('div');
        const date = new Date(time);
        timepointDiv.className = 'zeitpunkt';
        timepointDiv.setAttribute('data-time', time);
        timepointDiv.textContent = formatTimeLabel(date);
        timepointDiv.addEventListener('click', () => {
            currentIndex = index;
            highlightTimepoint(index);
            updateLayerTime(timeValues[index]);
        });
        timepointsContainer.appendChild(timepointDiv);
    });

    // Highlighten des ersten Zeitpunktes
    highlightTimepoint(0);
}

function formatTimeLabel(date) {
    const options = { weekday: 'short', hour: '2-digit'};
    let formattedDate = date.toLocaleDateString('de-DE', options);
    formattedDate = formattedDate.replace(',', '').replace(' Uhr', 'h');
    return formattedDate;
}

document.querySelectorAll('.zeitpunkt').forEach((zeitpunkt, index) => {
    zeitpunkt.addEventListener('click', () => {
        currentIndex = index; // Aktualisiere currentIndex auf den Index des geklickten Zeitpunkts
        highlightTimepoint(currentIndex);
    });
});

// Initiales Highlighting des ersten Zeitpunkts
highlightTimepoint(currentIndex);

function highlightTimepoint(index) {
    const zeitpunkte = document.querySelectorAll('.zeitpunkt');
    zeitpunkte.forEach((zeitpunkt, i) => {
        if (i === index) {
            zeitpunkt.classList.add('active');
        } else {
            zeitpunkt.classList.remove('active');
        }
    });
}