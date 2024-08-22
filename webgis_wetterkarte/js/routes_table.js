// Funktionen für Tabelle mit Informationen zur Route 

import { transform } from "ol/proj";
import { toStringHDMS } from "ol/coordinate";

// Header der Tabelle erstellen mit dazugehörigen Klassen
function addHeader() {

    var tableDiv = document.createElement("div");
    tableDiv.classList.add('route-table-div');

    var table = document.createElement("table");
    table.classList.add('route-table')

    const tHead = document.createElement('thead');    

    const tHeadTR = document.createElement('tr');    

    const tHeadTH_Punkt = document.createElement('th'); 
    tHeadTH_Punkt.textContent = '';
    tHeadTR.appendChild(tHeadTH_Punkt)

    const tHeadTH_Koordinaten = document.createElement('th');  
    tHeadTH_Koordinaten.textContent = 'Koordinaten';
    tHeadTR.appendChild(tHeadTH_Koordinaten)

    const tHeadTH_Distanz = document.createElement('th');    
    tHeadTH_Distanz.textContent = 'Distanz';
    tHeadTR.appendChild(tHeadTH_Distanz)

    const tHeadTH_Kurs = document.createElement('th');    
    tHeadTH_Kurs.classList.add('absorbing-column')
    tHeadTH_Kurs.textContent = 'Kurs';
    tHeadTR.appendChild(tHeadTH_Kurs)

    tHead.appendChild(tHeadTR)
    table.appendChild(tHead)
    tableDiv.appendChild(table)

    var parentDiv = document.querySelector(".route-options");
    parentDiv.insertBefore(tableDiv, parentDiv.firstChild);
}

// Erste Koordinate in Tabelle einfügen. Ohne Infos, da Startpunkt
function addFirstCoordinate(coordinate) {

    coordinate = transform(coordinate, 'EPSG:3857', 'EPSG:4326');
    coordinate = toStringHDMS(coordinate)

    const tBody = document.createElement("tbody");

    const tBodyTR = document.createElement("tr");

    const tBodyTD_Punkt = document.createElement("td");
    tBodyTD_Punkt.textContent = '0';

    const tBodyTD_Koord = document.createElement("td");
    tBodyTD_Koord.textContent = coordinate;

    const tBodyTD_Distanz = document.createElement("td");
    tBodyTD_Distanz.textContent = '';

    const tBodyTD_Kurs = document.createElement("td");
    tBodyTD_Kurs.textContent = '';

    tBodyTR.appendChild(tBodyTD_Punkt);
    tBodyTR.appendChild(tBodyTD_Koord);
    tBodyTR.appendChild(tBodyTD_Distanz);
    tBodyTR.appendChild(tBodyTD_Kurs);

    tBody.appendChild(tBodyTR)

    var parent = document.querySelector(".route-table");
    parent.appendChild(tBody)
}

// Funktion für jede weitere Koordinate mit Infos
function addCoordinateInfo(punkt, distance, bearing, coordinate) {

    coordinate = transform(coordinate, 'EPSG:3857', 'EPSG:4326');
    coordinate = toStringHDMS(coordinate)

    const tBody = document.createElement("tbody");

    const tBodyTR = document.createElement("tr");
    if (punkt % 2 === 0) {
        tBodyTR.style.backgroundColor = '#h7k8h6'
    } else {
        tBodyTR.style.backgroundColor = '#f2f2f2'
    }

    const tBodyTD_Punkt = document.createElement("td");
    tBodyTD_Punkt.textContent = punkt;

    const tBodyTD_Koord = document.createElement("td");
    tBodyTD_Koord.textContent = coordinate;

    const tBodyTD_Distanz = document.createElement("td");
    tBodyTD_Distanz.textContent = distance;

    const tBodyTD_Kurs = document.createElement("td");
    tBodyTD_Kurs.textContent = bearing;

    tBodyTR.appendChild(tBodyTD_Punkt);
    tBodyTR.appendChild(tBodyTD_Koord);
    tBodyTR.appendChild(tBodyTD_Distanz);
    tBodyTR.appendChild(tBodyTD_Kurs);

    tBody.appendChild(tBodyTR)

    var parent = document.querySelector(".route-table");
    parent.appendChild(tBody)
}


export { addFirstCoordinate , addCoordinateInfo , addHeader}