const days = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const agent = sessionStorage.getItem("agent");
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

// Décalage pour démarrer à 07:00 au lieu de 00:00
const startIndex = horaires.findIndex(h => h.startsWith("07:00"));
// S'assurer que le décalage ne crée pas de doublons ou ne manque pas de créneaux
const horairesDecales = horaires.slice(startIndex).concat(horaires.slice(0, startIndex));

let planningDataAgent = {}; // Contiendra le planning complet chargé de l'API
let isDragging = false; // Pour la sélection par glissé
let dragStartIndex = -1; // Index de début de la sélection par glissé

// DOM Elements
const weekSelect = document.getElementById("week-select");
const dateRangeDisplay = document.getElementById("date-range");
const planningContainer = document.getElementById("planning-container");
const saveButton = document.getElementById("save-button");
const clearSelectionButton = document.getElementById("clear-selection-btn");
const logoutButton = document.getElementById("logout-button");
const loadingSpinner = document.getElementById("loading-spinner");
const tabButtons = document.querySelectorAll(".tab");
const agentPrenomSpan = document.getElementById("agent-prenom");
const agentNomSpan = document.getElementById("agent-nom");


document.addEventListener("DOMContentLoaded", async () => {
  if (!agent || agent === "admin") {
    alert("Vous devez être connecté en tant qu’agent.");
    window.location.href = "index.html";
    return;
  }

  // Afficher le nom et prénom de l'agent
  if (agentPrenomSpan) agentPrenomSpan.textContent = agentPrenom;
  if (agentNomSpan) agentNomSpan.textContent = agentNom;


  await loadAgentPlanning(); // Charge le planning au démarrage

  // Initialiser le sélecteur de semaine
  const currentWeek = getCurrentISOWeek();
  const allWeeks = [];
  for (let i = currentWeek; i < currentWeek + 8; i++) { // Afficher les 8 prochaines semaines
    allWeeks.push(i);
  }

  if (weekSelect) {
    weekSelect.innerHTML = "";
    allWeeks.forEach(week => {
      const option = document.createElement("option");
      option.value = week;
      option.textContent = `Semaine ${week} (${getWeekDateRange(week)})`;
      weekSelect.appendChild(option);
    });
    weekSelect.value = currentWeek; // Sélectionner la semaine actuelle
  }

  updateDisplay(currentWeek); // Afficher le planning de la semaine actuelle (Lundi)

  // Écouteurs d'événements
  if (weekSelect) {
    weekSelect.addEventListener("change", () => {
      const selectedWeek = +weekSelect.value;
      updateDisplay(selectedWeek);
    });
  }

  if (tabButtons.length > 0) {
    tabButtons.forEach(tab => {
      tab.addEventListener("click", (event) => {
        const day = event.target.dataset.day;
        const week = +weekSelect.value;
        showDay(day, week);
      });
    });
  }

  if (saveButton) saveButton.addEventListener("click", saveAgentPlanning);
  if (clearSelectionButton) clearSelectionButton.addEventListener("click", clearCurrentDaySelection);
  if (logoutButton) logoutButton.addEventListener("click", logout);
});


// Fonctions utilitaires
function getCurrentISOWeek() {
  const date = new Date();
  const target = new Date(date.valueOf());
  target.setDate(target.getDate() + 3 - (target.getDay() + 6) % 7);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  return 1 + Math.round(((target - firstThursday) / 86400000 - 3 + (firstThursday.getDay() + 6) % 7) / 7);
}

function getWeekDateRange(weekNumber, year = new Date().getFullYear()) {
  const simple = new Date(year, 0, 1 + (weekNumber - 1) * 7);
  const dow = simple.getDay() || 7;
  const ISOweekStart = new Date(simple);
  if (dow <= 4) {
    ISOweekStart.setDate(simple.getDate() - dow + 1);
  } else {
    ISOweekStart.setDate(simple.getDate() + 8 - dow);
  }

  const start = new Date(ISOweekStart);
  const end = new Date(ISOweekStart);
  end.setDate(start.getDate() + 6);

  const format = date => date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit"
  });

  return `du ${format(start)} au ${format(end)}`;
}

async function loadAgentPlanning() {
  showLoading(true);
  try {
    const response = await fetch(`${API_BASE_URL}/api/planning/${agent}`);
    if (!response.ok) {
      if (response.status === 404) {
        // Le planning n'existe pas encore pour cet agent, c'est normal
        planningDataAgent = {};
      } else {
        throw new Error(`Erreur HTTP ${response.status}`);
      }
    } else {
      planningDataAgent = await response.json();
    }
  } catch (err) {
    console.error("Erreur lors du chargement du planning :", err);
    alert("Erreur lors du chargement du planning. Veuillez réessayer.");
    planningDataAgent = {}; // Initialise un planning vide en cas d'erreur
  } finally {
    showLoading(false);
  }
}

function updateDisplay(weekNumber) {
  if (dateRangeDisplay) {
    dateRangeDisplay.textContent = getWeekDateRange(weekNumber);
  }
  showDay('lundi', weekNumber); // Affiche toujours le Lundi par défaut
}

function showDay(day, weekNumber = weekSelect.value) {
  // Désactiver tous les onglets et activer le bon
  tabButtons.forEach(tab => tab.classList.remove("active"));
  const activeTab = document.querySelector(`.tab[data-day="${day}"]`);
  if (activeTab) {
    activeTab.classList.add("active");
  }

  if (planningContainer) {
    planningContainer.innerHTML = "";
  } else {
    return; // Arrête l'exécution si le conteneur n'est pas là
  }


  const weekKey = `week-${weekNumber}`;
  const selectedSlotsForDay = planningDataAgent[weekKey]?.[day] || [];

  horairesDecales.forEach((horaire, index) => {
    const button = document.createElement("button");
    button.className = "slot-button";
    button.dataset.horaireIndex = index; // Pour la sélection par plage
    button.textContent = horaire;

    if (selectedSlotsForDay.includes(horaire)) {
      button.classList.add("selected");
    }

    // Gestion de la sélection/désélection et de la sélection par glissé
    button.addEventListener("click", () => {
      // Si on clique sur un bouton alors qu'on est en train de glisser, on finalise le glissé
      if (isDragging) {
        isDragging = false; // Arrête le glissé
        dragStartIndex = -1; // Réinitialise
        return; // Le clic a déjà géré la sélection
      }
      // Sinon, on gère un clic simple pour (dé)sélectionner
      button.classList.toggle("selected");
    });

    button.addEventListener("mousedown", (e) => {
      if (e.button === 0) { // Clic gauche
        isDragging = true;
        dragStartIndex = index;
        button.classList.toggle("selected"); // Toggle l'état du premier élément cliqué
      }
    });

    button.addEventListener("mouseenter", () => {
      if (isDragging && dragStartIndex !== -1) {
        // Sélectionne/désélectionne les créneaux entre dragStartIndex et l'index actuel
        const currentActiveDay = document.querySelector(".tab.active").dataset.day;
        selectRange(currentActiveDay, dragStartIndex, index);
      }
    });

    planningContainer.appendChild(button);
  });

  // Gère la fin du glissé n'importe où sur le document
  document.removeEventListener("mouseup", handleMouseUp); // Éviter les écouteurs multiples
  document.addEventListener("mouseup", handleMouseUp);
}

// Fonction séparée pour le handleMouseUp pour pouvoir le remove/add
function handleMouseUp() {
  if (isDragging) {
    isDragging = false;
    dragStartIndex = -1;
  }
}

function selectRange(day, startIndex, endIndex) {
  const minIndex = Math.min(startIndex, endIndex);
  const maxIndex = Math.max(startIndex, endIndex);

  const allButtons = Array.from(planningContainer.children); // Récupère tous les boutons du jour
  if (startIndex < 0 || startIndex >= allButtons.length) {
      // startIndex invalide, ne peut pas déterminer l'état initial.
      return;
  }
  const initialSelectedState = allButtons[startIndex].classList.contains("selected"); // État initial du premier bouton cliqué


  for (let i = 0; i < allButtons.length; i++) {
    const btn = allButtons[i];
    const btnIndex = parseInt(btn.dataset.horaireIndex);

    if (btnIndex >= minIndex && btnIndex <= maxIndex) {
      if (initialSelectedState) {
        btn.classList.add("selected");
      } else {
        btn.classList.remove("selected");
      }
    }
  }
}

async function saveAgentPlanning() {
  showLoading(true, saveButton);
  saveButton.textContent = "Enregistrement...";

  const week = weekSelect.value;
  const weekKey = `week-${week}`;
  const currentDay = document.querySelector(".tab.active").dataset.day;

  // Récupère les créneaux réellement sélectionnés sur la page
  const selectedSlotsOnPage = Array.from(planningContainer.querySelectorAll(".slot-button.selected"))
    .map(btn => btn.textContent.trim());

  // Met à jour le planningDataAgent avec la sélection actuelle du jour
  planningDataAgent = {
    ...planningDataAgent,
    [weekKey]: {
      ...(planningDataAgent[weekKey] || {}),
      [currentDay]: selectedSlotsOnPage
    }
  };

  try {
    const response = await fetch(`${API_BASE_URL}/api/planning/${agent}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(planningDataAgent) // Envoie tout le planning mis à jour
    });

    if (response.ok) {
      alert("Vos créneaux ont été enregistrés avec succès !");
      // Recharger le planning après sauvegarde pour s'assurer de la cohérence
      await loadAgentPlanning();
      showDay(currentDay, +week); // Réafficher le jour actif
    } else {
      const errorData = await response.json();
      alert(`Erreur lors de l’enregistrement : ${errorData.message || 'Une erreur est survenue.'}`);
    }
  } catch (err) {
    console.error("Erreur lors de l’enregistrement :", err);
    alert("Impossible d'enregistrer les créneaux. Veuillez vérifier votre connexion.");
  } finally {
    showLoading(false, saveButton);
    saveButton.textContent = "Enregistrer mes créneaux";
  }
}

function clearCurrentDaySelection() {
  const currentDay = document.querySelector(".tab.active").dataset.day;
  const weekKey = `week-${weekSelect.value}`;

  // Supprime tous les créneaux du jour actuellement sélectionné dans le planningDataAgent
  if (planningDataAgent[weekKey] && planningDataAgent[weekKey][currentDay]) {
    planningDataAgent[weekKey][currentDay] = []; // Vide le tableau des créneaux pour ce jour
  }

  // Réafficher le jour pour refléter la suppression
  showDay(currentDay, +weekSelect.value);

  // Informer l'utilisateur, mais ne pas enregistrer automatiquement
  alert("La sélection actuelle a été effacée. N'oubliez pas d'enregistrer vos modifications !");
}


function logout() {
  sessionStorage.clear(); // Efface toutes les données de session
  window.location.href = "index.html";
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