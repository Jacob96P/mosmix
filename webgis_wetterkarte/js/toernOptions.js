// Törnfenster

let options = document.getElementById('toernOptions');

// Funktion zum Togglen des Fensters wenn auf die Fläche gedrückt wird
function toggleOptions() {
    if (options.style.display === 'none' || options.style.display === '') {
        options.style.display = 'block';
        document.getElementById("toern-title").textContent = "Törnplaner";
    } else {
        options.style.display = 'none';
        document.getElementById("toern-title").textContent = "";
    }
}

document.getElementById('toernControl').addEventListener('click', toggleOptions);
