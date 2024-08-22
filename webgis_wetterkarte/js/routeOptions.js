// Dragbares Fenster mit Tabelle zur Route und Werkzeugkasten

let isDragging = false;
let offsetX, offsetY;
const draggable_height = 30; 

// Oben im Fenster Maus gedrückt
routeOptions.addEventListener('mousedown', (e) => {
    const rect = routeOptions.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;

    // Nur oben draggable
    if (offsetY <= draggable_height) {
        isDragging = true;
    }
});

// Wenn dann gedragt wird wird das Fenster mit verschoben
document.addEventListener('mousemove', (e) => {
    if (isDragging) {
        routeOptions.style.left = (e.clientX - offsetX) + 'px';
        routeOptions.style.top = (e.clientY - offsetY) + 'px';
    }
});

// Wenn losgelassen wird mit dem verschieben aufhören
document.addEventListener('mouseup', () => {
    isDragging = false;
});