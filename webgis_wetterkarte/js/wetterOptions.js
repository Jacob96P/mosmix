import { wetter, updateLayerLegend, map } from "./map";

wetterOptions.style.display = 'none';
let switchLayer = false;
let info_div = document.getElementById('info')
export let wetterEinheit = undefined;

// Funktion zum Öffnen der WetterOptions
function toggleWetterOptions() {
    const wetterOptions = document.getElementById('wetterOptions');
    if(wetterOptions.style.display === 'none' || wetterOptions.style.display === '') {
        wetterOptions.style.display = 'block';
    } else {
        wetterOptions.style.display = 'none';
        layerLegend.style.display = 'none';
        wetter.setVisible(false)
        info_div.style.display = 'none';
    }
  }
document.getElementById('wetter-overlay').addEventListener('click', toggleWetterOptions);


function wetterMapSwitcher (workspace, parameter, einheit) {
    // Layerparameter Updaten, damit richtige Karte angezeigt wird
    const layerLegend = document.getElementById('layerLegend');
    if (wetter.getSource().getParams().LAYERS != `${workspace}:${parameter}`) {
        wetter.getSource().updateParams({'LAYERS': `${workspace}:${parameter}`})
        updateLayerLegend(parameter);
        layerLegend.style.display = 'block';
        wetterEinheit = einheit;
        info_div.innerHTML = "";
        switchLayer = true;

    };
    // Karte an bzw. ausschalten
    if (wetter.getVisible() == false) {
        wetter.setVisible(true)
        layerLegend.style.display = 'block';
        info_div.style.display = 'block';
        wetterEinheit = einheit;
        updateLayerLegend(parameter);
    } else if  (wetter.getVisible() == true && switchLayer == false) {
        wetter.setVisible(false)
        layerLegend.style.display = 'none';
        info_div.style.display = 'none';
    }
};


// wetterOverlay
document.getElementById("temp-button").addEventListener('click', function() {
    wetterMapSwitcher('mosmix_wetter', 'data_temperatur', '°C');
});
document.getElementById("niederschlag-button").addEventListener('click', function() {
    wetterMapSwitcher('mosmix_wetter', 'data_niederschlag_letzte_stunde', 'mm');
});
document.getElementById("wind-button").addEventListener('click', function() {
    wetterMapSwitcher('mosmix_wetter', 'data_windgeschwindigkeit', 'kn');
});
