// Login, Logout und Laden der Törns

const api_url = 'http://localhost:8083'

// Funktion zum Laden und Anzeigen der Törns des Nutzers beim Start
function meine_toerns (benutzer) {
  fetch(api_url + '/get_toerns/' + benutzer, {
    method: 'GET',
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    return response.json();
  })
  .then(data => {
    let alle_toerns = data['features']
    for(let i = 0; i < alle_toerns.length; i++) {
      let obj = alle_toerns[i];
      let option = document.createElement("option");
      option.text = obj.toern_name;
      option.id = obj.toern_id;
      toerns.add(option);
      };
  })
  .catch(error => {
    console.error('There was a problem with the fetch operation:', error.message);
  });
}

// Login-Blocker
document.addEventListener('DOMContentLoaded', function() {

    const loginModal = document.getElementById('loginModal');
    const usernameInput = document.getElementById('usernameInput');
    const loginButton = document.getElementById('loginBtn');

    usernameInput.focus();

    const savedUsername = localStorage.getItem('username');
    // Wenn kein Username im Speicher hinterlegt ist
    if (!savedUsername) {
        loginModal.style.display = 'block';
        if ( localStorage.getItem('logout') ) {
          window.onload = function() {
            const greeting = document.getElementById('greeting');
  
            greeting.textContent = "Erfolgreich ausgeloggt!";
            greeting.style.display = 'block';
          
            setTimeout(() => {
              greeting.style.display = 'none';
            }, 5000);
          }
        } 
    // Wenn der User in dem Browser bereits eingeloggt war
    } else {
        loginModal.style.display = 'none';
        window.onload = function() {
          const greeting = document.getElementById('greeting');

          greeting.textContent = "Willkommen zurück, " + savedUsername + "!";
          greeting.style.display = 'block';
        
          setTimeout(() => {
            greeting.style.display = 'none';
          }, 5000);
        }
        meine_toerns(localStorage.getItem('username'))
    }

    // Check ob Username valide
    const login = function() {
        const username = usernameInput.value.trim();
        if (/^[a-zA-Z]+$/.test(username)) {
            localStorage.setItem('username', username);
            loginModal.style.display = 'none';

            const greeting = document.getElementById('greeting');
            greeting.style.display = '';
            greeting.textContent = "Herzlich Wilkommen, " + localStorage.getItem('username') + "!";
            greeting.style.display = 'block';
          
            setTimeout(() => {
              greeting.style.display = 'none';
            }, 5000);
            
            // Jetzt können die Törns geladen werden
            meine_toerns(localStorage.getItem('username'))

        } else {
            alert('Bitte geben Sie einen validen Benutzernamen ein. \nEs sind nur gewöhnliche Buchstaben erlaubt.');
        } 
      }

    // Login Button mit Maus und Enter 'klickbar'
    loginButton.addEventListener('click', login)
    usernameInput.addEventListener('keydown', function(event) {
        if (event.keyCode === 13) {  // 13 ist Enter
            login();
        }
    })

});

// Logout 
document.getElementById('logoutControl').addEventListener('click', () => {
  localStorage.removeItem('username');
  location.reload();
  localStorage.setItem('logout', true)
})