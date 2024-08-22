// Layerauswahl

import { openstreetmap, satellit, openseamap } from "./map";

// Funktion zum Öffnen der Auswahls
function toggleOptions() {
    const options = document.getElementById('layerOptions');
    if(options.style.display === 'none' || options.style.display === '') {
      options.style.display = 'block';
    } else {
      options.style.display = 'none';
    }
  }
document.getElementById('toggleControl').addEventListener('click', toggleOptions);

// EventListener zum Schließen wenn außerhalb des Fensters geklickt wird
document.addEventListener('click', function(event) {
  const control = document.getElementById('layerControl');
  const options = document.getElementById('layerOptions');
  if (!control.contains(event.target)) {  
      options.style.display = 'none'; 
  }
});
  
// Baselayer
document.getElementById("baseLayer1").onclick = function() {
if (openstreetmap.getVisible() == false) {
    openstreetmap.setVisible(true)
    satellit.setVisible(false)
}
};
document.getElementById("baseLayer2").onclick = function() {
if (openstreetmap.getVisible() == true) {
    satellit.setVisible(true)
    openstreetmap.setVisible(false)
}
};

// Overlay1
document.getElementById("overlay1").onclick = function() {
if (openseamap.getVisible() == false) {
    openseamap.setVisible(true)
} else {
    openseamap.setVisible(false)
}
};