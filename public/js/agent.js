const days = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const API_BASE_URL = "https://dispo-pompier.onrender.com"; // Assurez-vous que cette URL est correcte et accessible

let currentAgentId = sessionStorage.getItem("agent"); // L'identifiant de l'agent connecté
let agentQualifications = []; // Pour stocker les qualifications de l'agent
let currentWeekKey = `week-${getCurrentWeek()}`; // La clé de la semaine actuelle (ex: "week-24")
let currentDay = 'lundi'; // Le jour actuellement affiché
let agentPlanningData = {}; // Contiendra les disponibilités de l'agent pour toutes les semaines chargées
let initialPlanningState = {}; // Pour détecter les modifications non enregistrées

// Génère 48 créneaux de 30 min sur 24h (07:00-07:30, 07:30-08:00, ...)
const horaires = [];
const startHourDisplay = 7; // Heure de début des créneaux affichés

for (let i = 0; i < 48; i++) {
  const currentSlotHour = (startHourDisplay + Math.floor(i / 2)) % 24;
  const currentSlotMinute = (i % 2) * 30;

  const endSlotHour = (startHourDisplay + Math.floor((i + 1) / 2)) % 24;
  const endSlotMinute = ((i + 1) % 2) * 30;

  const start = `${String(currentSlotHour).padStart(2, '0')}:${String(currentSlotMinute).padStart(2, '0')}`;
  const end = `${String(endSlotHour).padStart(2, '0')}:${String(endSlotMinute).padStart(2, '0')}`;

  horaires.push(`${start} - ${end}`);
}

// Définitions des éléments du DOM (mis à jour pour correspondre à agent.html)
const agentPrenomSpan = document.getElementById("agent-prenom");
const agentNomSpan = document.getElementById("agent-nom");
const agentQualificationsDisplay = document.getElementById('agentQualificationsDisplay');
const weekSelect = document.getElementById("week-select"); // ID corrigé
const syntheseBtn = document.getElementById("synthese-btn"); // ID corrigé
const tabButtons = document.querySelectorAll('.tab'); // Classe corrigée
const planningContainer = document.getElementById("planning-container"); // ID corrigé (ce sera le conteneur des boutons)
const loadingSpinner = document.getElementById("loading-spinner");
const saveButton = document.getElementById("save-button"); // ID corrigé
const clearSelectionBtn = document.getElementById("clear-selection-btn"); // ID corrigé
const logoutButton = document.getElementById("logout-button"); // ID corrigé
const selectionInfo = document.getElementById("selection-info"); // Message d'info


document.addEventListener("DOMContentLoaded", async () => {
  const userRole = sessionStorage.getItem("userRole");
  const agentPrenom = sessionStorage.getItem("agentPrenom");
  const agentNom = sessionStorage.getItem("agentNom");

  // Vérification du rôle et de l'agent connecté
  if (!userRole || userRole !== "agent" || !currentAgentId) {
    alert("Accès non autorisé. Vous devez être connecté en tant qu’agent.");
    sessionStorage.clear();
    window.location.href = "index.html";
    return;
  }

  // Afficher le message de bienvenue
  if (agentPrenomSpan && agentNomSpan) {
    agentPrenomSpan.textContent = agentPrenom || '';
    agentNomSpan.textContent = agentNom || '';
  }

  // Charger les qualifications de l'agent
  await loadAgentQualifications(currentAgentId);
  displayAgentQualifications();

  generateWeekOptions(); // Génère les options pour la sélection de la semaine
  weekSelect.value = currentWeekKey; // Sélectionne la semaine actuelle par défaut

  // Charge le planning pour la semaine et le jour actuels au démarrage
  await loadPlanningForAgent(currentAgentId, currentWeekKey, currentDay);

  // Écouteurs d'événements
  if (weekSelect) {
    weekSelect.addEventListener("change", async () => {
      // Proposer d'enregistrer avant de changer de semaine
      if (hasUnsavedChanges()) {
        if (!confirm("Vous avez des modifications non enregistrées pour le jour actuel. Voulez-vous les enregistrer maintenant ?")) {
          // Si l'utilisateur annule, réinitialiser le sélecteur à l'ancienne valeur
          weekSelect.value = currentWeekKey;
          return;
        }
        await savePlanning(); // Tenter d'enregistrer les modifications
      }
      currentWeekKey = weekSelect.value;
      await loadPlanningForAgent(currentAgentId, currentWeekKey, currentDay);
    });
  }
  if (saveButton) {
    saveButton.addEventListener("click", savePlanning);
  }
  if (clearSelectionBtn) {
    clearSelectionBtn.addEventListener("click", clearSelectedCells);
  }
  if (logoutButton) {
    logoutButton.addEventListener("click", logout);
  }
  if (syntheseBtn) {
    // Déjà un lien href="synthese.html" dans l'HTML, pas besoin de JS ici à moins d'une logique complexe
  }

  // Initialisation des onglets (jours de la semaine)
  if (tabButtons.length > 0) {
    tabButtons.forEach(button => {
      button.addEventListener('click', async () => {
        const targetDay = button.dataset.day;
        // Proposer d'enregistrer avant de changer de jour
        if (hasUnsavedChanges()) {
          if (!confirm("Vous avez des modifications non enregistrées pour le jour actuel. Voulez-vous les enregistrer maintenant ?")) {
            // Si l'utilisateur annule, ne pas changer de jour
            return;
          }
          await savePlanning(); // Tenter d'enregistrer les modifications
        }
        currentDay = targetDay;
        // Changer la classe active pour le bouton d'onglet
        tabButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        renderPlanningGrid(currentDay); // Afficher le planning pour le nouveau jour sous forme de grille de boutons
      });
    });
    // Ouvre le premier onglet par défaut au démarrage
    // Le HTML a déjà un .tab.active par défaut sur Lundi
    renderPlanningGrid(currentDay); // Affiche le planning pour le jour 'lundi' initial
  }

  // Initialise le comportement de sélection des cellules (glisser-déposer)
  initCellSelection();

  showLoading(false);
});


// --- Fonctions de gestion des qualifications de l'agent ---

// Charge les qualifications de l'agent connecté depuis le serveur
async function loadAgentQualifications(agentId) {
    try {
        // Nouvelle route API pour récupérer les informations d'un agent spécifique, y compris les qualifications
        // NOTE: Cette route est protégée par `authorizeAdmin` côté serveur. Pour un usage sécurisé
        // en production où l'agent accède à ses propres informations, il faudrait une route séparée
        // ou un système de token JWT pour autoriser l'agent à accéder à ses propres données sans être 'admin'.
        const response = await fetch(`${API_BASE_URL}/api/admin/agents/${agentId}`, {
             headers: { 'X-User-Role': 'admin' } // Temporaire: Simule un accès admin pour récupérer les infos de l'agent
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Erreur lors du chargement des qualifications de l\'agent.');
        }
        agentQualifications = data.qualifications || [];
        console.log(`Qualifications de ${agentId}:`, agentQualifications);
    } catch (error) {
        console.error('Erreur de chargement des qualifications de l\'agent:', error);
        // Vous pouvez afficher un message d'erreur à l'utilisateur si nécessaire
        if (agentQualificationsDisplay) {
            agentQualificationsDisplay.textContent = 'Impossible de charger vos qualifications.';
            agentQualificationsDisplay.style.color = 'red';
        }
    }
}

// Affiche les qualifications de l'agent sur la page
function displayAgentQualifications() {
    if (agentQualificationsDisplay) {
        if (agentQualifications.length > 0) {
            agentQualificationsDisplay.innerHTML = 'Vos qualifications : ' + agentQualifications.map(q => `<span class="qualification-tag">${q}</span>`).join(', ');
        } else {
            agentQualificationsDisplay.textContent = 'Vous n\'avez pas de qualifications attribuées.';
        }
    }
}


// --- Fonctions Utilitaire pour les dates et semaines ---
function getCurrentWeek(date = new Date()) {
  const target = new Date(date.valueOf());
  target.setDate(target.getDate() + 3 - (target.getDay() + 6) % 7);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const weekNo = Math.ceil((((target - firstThursday) / 86400000) + 1) / 7);
  return weekNo;
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


// Génère les options de semaine (actuelle + 5 prochaines)
function generateWeekOptions() {
  const select = document.getElementById("week-select");
  select.innerHTML = ""; // Vide les options existantes

  const today = new Date();
  const currentWeekNumber = getCurrentWeek(today);
  const currentYear = today.getFullYear();

  for (let i = 0; i < 6; i++) { // Génère la semaine actuelle + 5 prochaines (total 6)
    const weekNum = currentWeekNumber + i;
    const option = document.createElement("option");
    option.value = `week-${weekNum}`; // Format de la valeur pour correspondre au backend
    const dateRange = getWeekDateRange(weekNum, currentYear);
    option.textContent = `Semaine ${weekNum} (${dateRange})`;
    select.appendChild(option);
  }
}


// Rendu des créneaux horaires sous forme de grille de boutons
function renderPlanningGrid(day) {
    if (!planningContainer) return;

    planningContainer.innerHTML = ''; // Vide tout le contenu précédent

    const currentWeekPlanning = agentPlanningData[currentWeekKey] || {};
    const dayPlanning = currentWeekPlanning[day] || []; // Créneaux occupés pour le jour actuel

    horaires.forEach(timeSlot => {
        const button = document.createElement("button");
        button.classList.add("slot-button"); // Applique la classe CSS
        button.dataset.day = day;
        button.dataset.time = timeSlot;
        button.textContent = timeSlot; // Affiche le créneau complet (ex: 07:00 - 07:30)

        if (dayPlanning.includes(timeSlot)) {
            button.classList.add('selected'); // Marque comme sélectionné si déjà disponible
        }
        planningContainer.appendChild(button);
    });
}


// Variables pour la sélection par glisser-déposer
let isSelecting = false;
let startCell = null; // Référence au bouton de début de sélection
let initialSelectionState = null; // True si le bouton de départ était 'selected', False sinon

function initCellSelection() {
  if (!planningContainer) return;

  // Écouteur sur le conteneur parent des boutons pour la délégation d'événements
  planningContainer.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('slot-button')) {
      isSelecting = true;
      startCell = e.target;
      initialSelectionState = startCell.classList.contains('selected'); // État initial du bouton de départ

      // Inverse l'état du bouton de départ
      startCell.classList.toggle('selected');

      e.preventDefault(); // Empêche la sélection de texte
    }
  });

  planningContainer.addEventListener('mouseover', (e) => {
    if (isSelecting && e.target.classList.contains('slot-button')) {
        // Applique le même état que le bouton de départ à tous les boutons survolés
        if (initialSelectionState) { // Si le bouton de départ était sélectionné, on désélectionne les survolés
            e.target.classList.remove('selected');
        } else { // Si le bouton de départ n'était PAS sélectionné, on sélectionne les survolés
            e.target.classList.add('selected');
        }
    }
  });

  // Écouteurs globaux pour gérer la fin du glisser n'importe où sur la page
  document.addEventListener('mouseup', () => {
    isSelecting = false;
    startCell = null;
    initialSelectionState = null;
  });

  // Empêche la sélection de texte pendant le glisser
  document.addEventListener('selectstart', (e) => {
    if (isSelecting) {
      e.preventDefault();
    }
  });
}

// Vérifie si des modifications non enregistrées existent pour le jour actuel
function hasUnsavedChanges() {
    // Collecte les créneaux sélectionnés actuellement sur la page
    const currentSelectedSlots = Array.from(planningContainer.querySelectorAll('.slot-button.selected')).map(btn => btn.dataset.time);
    // Récupère l'état sauvegardé pour le jour actuel depuis initialPlanningState
    const savedSlotsForDay = initialPlanningState[currentWeekKey]?.[currentDay] || [];

    // Compare les longueurs pour une vérification rapide
    if (currentSelectedSlots.length !== savedSlotsForDay.length) {
        return true;
    }

    // Convertit les tableaux en Set pour une comparaison plus efficace des contenus
    const currentSet = new Set(currentSelectedSlots);
    const savedSet = new Set(savedSlotsForDay);

    // Vérifie si tous les éléments du set actuel sont dans le set sauvegardé
    for (const slot of currentSet) {
        if (!savedSet.has(slot)) {
            return true;
        }
    }
    // Vérifie si tous les éléments du set sauvegardé sont dans le set actuel
    for (const slot of savedSet) {
        if (!currentSet.has(slot)) {
            return true;
        }
    }
    return false; // Pas de changements
}


// Charge le planning de l'agent pour la semaine et le jour actuels
async function loadPlanningForAgent(agentId, weekKey, day) {
  showLoading(true);
  try {
    const response = await fetch(`${API_BASE_URL}/api/planning/${agentId}`); // Ne pas filtrer par semaine ici
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Erreur lors du chargement du planning.');
    }

    agentPlanningData = data; // Stocke toutes les données de planning de l'agent
    initialPlanningState = JSON.parse(JSON.stringify(data)); // Copie profonde pour détecter les changements

    renderPlanningGrid(day); // Affiche les créneaux pour le jour sélectionné sous forme de grille de boutons
  } catch (error) {
    console.error('Erreur de chargement du planning:', error);
    alert(`Erreur lors du chargement du planning : ${error.message}`);
    // Si erreur de chargement, réinitialise le planning local
    agentPlanningData = {};
    initialPlanningState = {};
    renderPlanningGrid(day); // Afficher une grille vide ou un message
  } finally {
    showLoading(false);
  }
}

// Sauvegarde le planning actuel pour l'agent
async function savePlanning() {
  const selectedSlotsForCurrentDay = Array.from(planningContainer.querySelectorAll('.slot-button.selected')).map(btn => btn.dataset.time);

  // Mettre à jour l'objet agentPlanningData avec les nouvelles sélections du jour actuel
  if (!agentPlanningData[currentWeekKey]) {
      agentPlanningData[currentWeekKey] = {};
  }
  agentPlanningData[currentWeekKey][currentDay] = selectedSlotsForCurrentDay;

  showLoading(true, saveButton);
  try {
    const response = await fetch(`${API_BASE_URL}/api/planning/${currentAgentId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(agentPlanningData), // Envoie tout l'objet de planning mis à jour
    });

    const data = await response.json();

    if (response.ok) {
      alert("Planning enregistré avec succès !");
      // Après sauvegarde réussie, mettre à jour l'état initial pour refléter le dernier enregistrement
      initialPlanningState = JSON.parse(JSON.stringify(agentPlanningData));
    } else {
      throw new Error(data.message || "Erreur lors de l'enregistrement.");
    }
  } catch (err) {
    console.error("Erreur lors de l'enregistrement du planning :", err);
    alert(`Erreur lors de l'enregistrement du planning : ${err.message}`);
  } finally {
    showLoading(false, saveButton);
  }
}

// Efface toutes les sélections de cellules sur le planning affiché
function clearSelectedCells() {
  planningContainer.querySelectorAll('.slot-button.selected').forEach(button => {
    button.classList.remove('selected');
  });
  alert("La sélection actuelle a été effacée. N'oubliez pas d'enregistrer vos modifications !");
}


function logout() {
  sessionStorage.clear();
  window.location.href = "index.html";
}

// Fonction pour gérer l'affichage du spinner de chargement et désactiver/réactiver les contrôles
function showLoading(isLoading, button = null) {
  if (isLoading) {
    if (loadingSpinner) loadingSpinner.classList.remove("hidden");
    // Désactiver tous les boutons et sélecteurs pertinents
    if (saveButton) saveButton.disabled = true;
    if (clearSelectionBtn) clearSelectionBtn.disabled = true;
    if (logoutButton) logoutButton.disabled = true;
    if (syntheseBtn) syntheseBtn.classList.add('disabled');
    tabButtons.forEach(btn => btn.disabled = true);
    if (weekSelect) weekSelect.disabled = true;
    // Désactiver également les boutons de créneaux pendant le chargement
    planningContainer.querySelectorAll('.slot-button').forEach(btn => btn.disabled = true);
  } else {
    if (loadingSpinner) loadingSpinner.classList.add("hidden");
    // Réactiver tous les boutons et sélecteurs pertinents
    if (saveButton) saveButton.disabled = false;
    if (clearSelectionBtn) clearSelectionBtn.disabled = false;
    if (logoutButton) logoutButton.disabled = false;
    if (syntheseBtn) syntheseBtn.classList.remove('disabled');
    tabButtons.forEach(btn => btn.disabled = false);
    if (weekSelect) weekSelect.disabled = false;
    // Réactiver les boutons de créneaux après le chargement
    planningContainer.querySelectorAll('.slot-button').forEach(btn => btn.disabled = false);
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