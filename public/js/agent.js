const days = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
// const agent = sessionStorage.getItem("agent"); // L'identifiant de l'agent est maintenant géré par la vérification de rôle
const agentPrenom = sessionStorage.getItem("agentPrenom");
const agentNom = sessionStorage.getItem("agentNom");

const API_BASE_URL = "https://dispo-pompier.onrender.com"; // Assurez-vous que cette URL est correcte

const horaires = [];

// Génère 48 créneaux de 30 min sur 24h (00:00-00:30, 00:30-01:00, ...)
for (let i = 0; i < 48; i++) {
  const hour = Math.floor(i / 2);
  const minute = (i % 2) * 30;

  const endMinute = (minute + 30) % 60;
  const endHour = (minute + 30 >= 60) ? (hour + 1) : hour;
  // Corrige le cas où l'heure de fin est 24:00 (devient 00:00 du jour suivant)
  const formattedEndHour = endHour % 24;

  const start = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  const end = `${formattedEndHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;

  horaires.push(`${start} - ${end}`);
}

// Décalage pour démarrer à 00:00 sur le tableau, et non 00:30
const decalage = Math.floor(horaires.length / 2); // Décalage de 12 heures (24 * 0.5)

// Définitions des éléments du DOM
const planningTableBody = document.getElementById("planningTableBody");
const weekSelect = document.getElementById("weekSelect");
const saveButton = document.getElementById("savePlanning");
const clearSelectionButton = document.getElementById("clearSelection");
const logoutButton = document.getElementById("logoutButton");
const loadingSpinner = document.getElementById("loadingSpinner");
const welcomeMessage = document.getElementById("welcomeMessage");
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');


document.addEventListener("DOMContentLoaded", async () => {
  // **Vérification du rôle de l'utilisateur au chargement de la page**
  const userRole = sessionStorage.getItem("userRole");
  const agent = sessionStorage.getItem("agent"); // L'identifiant 'agent' est toujours nécessaire pour les requêtes de planning

  // Vérifie si un rôle est défini et si ce rôle est bien 'agent'
  if (!userRole || userRole !== "agent" || !agent) {
    alert("Accès non autorisé. Vous devez être connecté en tant qu’agent.");
    sessionStorage.clear(); // Nettoie la session en cas d'accès non autorisé
    window.location.href = "index.html"; // Redirige vers la page de connexion
    return; // Arrête l'exécution du script
  }

  // Si l'utilisateur est bien un agent, continuer le chargement normal de la page
  if (welcomeMessage && agentPrenom && agentNom) {
    welcomeMessage.textContent = `Bienvenue, ${agentPrenom} ${agentNom} !`;
  }

  generateWeekOptions(); // Génère les options pour la sélection de la semaine
  // Sélectionne la semaine actuelle par défaut
  const currentWeek = getWeekNumber(new Date());
  weekSelect.value = currentWeek;

  // Charge le planning pour la semaine sélectionnée et l'agent connecté
  await loadPlanning(agent, currentWeek);

  // Écouteurs d'événements
  if (weekSelect) {
    weekSelect.addEventListener("change", async () => {
      showLoading(true);
      await loadPlanning(agent, weekSelect.value);
      showLoading(false);
    });
  }
  if (saveButton) {
    saveButton.addEventListener("click", savePlanning);
  }
  if (clearSelectionButton) {
    clearSelectionButton.addEventListener("click", clearSelectedCells);
  }
  if (logoutButton) {
    logoutButton.addEventListener("click", logout);
  }
  // Initialise le tableau des jours et les rend cliquables pour la sélection des plages
  generatePlanningTable();

  // Initialisation des onglets
  if (tabButtons.length > 0) {
    tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        const targetTabId = button.dataset.tab;
        openTab(targetTabId);
      });
    });
    // Ouvre le premier onglet par défaut
    openTab(tabButtons[0].dataset.tab);
  }

  // Initialise le comportement de sélection des cellules
  initCellSelection();

  showLoading(false);
});


// Fonction pour basculer les onglets
function openTab(tabId) {
  tabContents.forEach(tab => {
    tab.classList.remove('active');
  });
  tabButtons.forEach(button => {
    button.classList.remove('active');
  });

  document.getElementById(tabId).classList.add('active');
  document.querySelector(`.tab-button[data-tab="${tabId}"]`).classList.add('active');
}

// Fonction pour générer les options de semaine (actuelle + 5 prochaines)
function generateWeekOptions() {
  const select = document.getElementById("weekSelect");
  select.innerHTML = ""; // Vide les options existantes

  const today = new Date();
  const currentWeek = getWeekNumber(today);

  for (let i = 0; i < 6; i++) {
    const weekNum = (currentWeek + i - 1) % 52 + 1; // Ajuste pour les 52 semaines de l'année
    const option = document.createElement("option");
    option.value = weekNum;
    option.textContent = `Semaine ${weekNum}`;
    select.appendChild(option);
  }
}

// Fonction pour obtenir le numéro de semaine ISO
function getWeekNumber(d) {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return weekNo;
}


// Fonction pour générer le tableau de planning
function generatePlanningTable() {
  if (!planningTableBody) return; // S'assurer que l'élément existe

  planningTableBody.innerHTML = ""; // Vider le tableau existant

  // Créer l'en-tête du tableau des horaires
  const headerRow = planningTableBody.insertRow();
  headerRow.insertCell().textContent = "Heure"; // Cellule vide pour le coin

  days.forEach(day => {
    const th = document.createElement("th");
    th.textContent = day.charAt(0).toUpperCase() + day.slice(1); // Majuscule à la première lettre
    headerRow.appendChild(th);
  });

  // Créer les lignes pour chaque créneau horaire
  horaires.forEach(timeSlot => {
    const row = planningTableBody.insertRow();
    const timeCell = row.insertCell();
    timeCell.textContent = timeSlot;
    timeCell.classList.add("time-slot-header"); // Style l'en-tête de l'heure

    days.forEach(day => {
      const cell = row.insertCell();
      cell.dataset.day = day;
      cell.dataset.time = timeSlot;
      cell.classList.add("planning-cell"); // Ajoute une classe pour le styling et la sélection
    });
  });
}

// Variables pour la sélection par glisser-déposer
let isSelecting = false;
let startCell = null;

function initCellSelection() {
  if (!planningTableBody) return;

  planningTableBody.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('planning-cell')) {
      isSelecting = true;
      startCell = e.target;
      // Commence la sélection : si la cellule était sélectionnée, on la désélectionne, sinon on la sélectionne
      if (startCell.classList.contains('selected')) {
        startCell.classList.remove('selected');
      } else {
        startCell.classList.add('selected');
      }
      e.preventDefault(); // Empêche la sélection de texte
    }
  });

  planningTableBody.addEventListener('mouseover', (e) => {
    if (isSelecting && e.target.classList.contains('planning-cell')) {
      // Pour une sélection simple, on active/désactive la cellule sur survol
      // Si on veut une sélection par "zone", il faudrait un algorithme plus complexe ici
      // Pour l'instant, on se contente de toggle individuellement.
      // Ou bien, si l'objectif est de "remplir" une zone, il faut gérer ça.
      // Pour l'instant, je vais laisser un comportement simple de toggle.
      // Pour un vrai "glisser-déposer" de sélection de zone, il faudrait :
      // 1. Détecter la cellule de départ (startCell).
      // 2. Détecter la cellule actuelle survolée (e.target).
      // 3. Calculer toutes les cellules entre startCell et e.target (dans une grille).
      // 4. Appliquer la classe 'selected' à toutes ces cellules.
      // 5. Enlever la classe 'selected' des cellules qui ne sont plus dans la zone.
      // C'est un peu plus complexe, pour cette démo, on reste sur du simple click/toggle.
      // Si vous voulez le drag-selection de zone, dites-le moi, et je pourrai l'ajouter.

      // Version simplifiée: Bascule l'état de la cellule survolée si on est en mode sélection
       if (e.target !== startCell) { // Évite de re-toggle la cellule de départ
           e.target.classList.toggle('selected');
       }
    }
  });

  planningTableBody.addEventListener('mouseup', () => {
    isSelecting = false;
    startCell = null;
  });

  // Empêcher la sélection de texte lors du glisser-déposer
  planningTableBody.addEventListener('selectstart', (e) => {
    if (isSelecting) {
      e.preventDefault();
    }
  });
}


// Charge le planning de l'agent pour la semaine sélectionnée
async function loadPlanning(agentId, weekNumber) {
  showLoading(true);
  try {
    const response = await fetch(`${API_BASE_URL}/api/planning/${agentId}?week=${weekNumber}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Erreur lors du chargement du planning.');
    }

    // Réinitialiser toutes les cellules
    document.querySelectorAll('.planning-cell').forEach(cell => {
      cell.classList.remove('selected', 'available'); // Supprime aussi 'available' si vous utilisez une autre classe
    });

    // Appliquer le planning chargé
    if (data[weekNumber]) {
      const weekPlanning = data[weekNumber];
      days.forEach(day => {
        if (weekPlanning[day]) {
          weekPlanning[day].forEach(timeSlot => {
            const cell = document.querySelector(`.planning-cell[data-day="${day}"][data-time="${timeSlot}"]`);
            if (cell) {
              cell.classList.add('selected'); // Marque la cellule comme sélectionnée
            }
          });
        }
      });
    }
    // Assurer que le spinner est caché après le chargement
    showLoading(false);
  } catch (error) {
    console.error('Erreur de chargement du planning:', error);
    alert(`Erreur lors du chargement du planning : ${error.message}`);
    showLoading(false);
  }
}

// Sauvegarde le planning actuel
async function savePlanning() {
  const agentId = sessionStorage.getItem("agent");
  const weekNumber = weekSelect.value;
  const currentPlanning = {};

  document.querySelectorAll('.planning-cell.selected').forEach(cell => {
    const day = cell.dataset.day;
    const time = cell.dataset.time;
    if (!currentPlanning[day]) {
      currentPlanning[day] = [];
    }
    currentPlanning[day].push(time);
  });

  const dataToSend = {
    [weekNumber]: currentPlanning // Englobe le planning dans l'objet de la semaine
  };

  showLoading(true, saveButton);
  try {
    const response = await fetch(`${API_BASE_URL}/api/planning/${agentId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dataToSend),
    });

    const data = await response.json();

    if (response.ok) {
      alert("Planning enregistré avec succès !");
    } else {
      throw new Error(data.message || "Erreur lors de l'enregistrement.");
    }
    showLoading(false, saveButton);
  } catch (err) {
    console.error("Erreur lors de l'enregistrement du planning :", err);
    alert(`Erreur lors de l'enregistrement du planning : ${err.message}`);
    showLoading(false, saveButton);
  }
}

// Efface toutes les sélections de cellules sur le planning affiché
function clearSelectedCells() {
  document.querySelectorAll('.planning-cell.selected').forEach(cell => {
    cell.classList.remove('selected');
  });
  alert("La sélection actuelle a été effacée. N'oubliez pas d'enregistrer vos modifications !");
}


function logout() {
  // Optionnel: Appeler un endpoint de déconnexion côté serveur si vous utilisez des sessions ou JWT
  // fetch(`${API_BASE_URL}/api/logout`, { method: 'POST' })
  //   .then(res => res.json())
  //   .finally(() => {
        sessionStorage.clear(); // Efface toutes les données de session
        window.location.href = "index.html";
  //   });
}

function showLoading(isLoading, button = null) {
  if (isLoading) {
    if (loadingSpinner) loadingSpinner.classList.remove("hidden");
    if (button) button.disabled = true;
    if (saveButton) saveButton.disabled = true;
    if (clearSelectionButton) clearSelectionButton.disabled = true;
    if (logoutButton) logoutButton.disabled = true;
    tabButtons.forEach(btn => btn.disabled = true);
    if (weekSelect) weekSelect.disabled = true;
  } else {
    if (loadingSpinner) loadingSpinner.classList.add("hidden");
    if (button) button.disabled = false;
    if (saveButton) saveButton.disabled = false;
    if (clearSelectionButton) clearSelectionButton.disabled = false;
    if (logoutButton) logoutButton.disabled = false;
    tabButtons.forEach(btn => btn.disabled = false);
    if (weekSelect) weekSelect.disabled = false;
  }
}

// Fonction utilitaire pour éviter l'outline sur les éléments focusables mais non cliquables par défaut
document.addEventListener('focusin', function(e) {
  if (e.target.matches('button, select, input, a')) {
    e.target.classList.add('focused-element');
  }
});

document.addEventListener('focusout', function(e) {
  if (e.target.matches('button, select, input, a')) {
    e.target.classList.remove('focused-element');
  }
});
