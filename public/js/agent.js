const days = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const API_BASE_URL = ""; // Ancien: "https://dispo-pompier.onrender.com"

let currentAgentId = sessionStorage.getItem("agent"); // L'identifiant de l'agent connecté
let agentQualifications = []; // Pour stocker les qualifications de l'agent
let agentGrade = {}; // Pour stocker le grade de l'agent
let agentFonction = {}; // Pour stocker la fonction de l'agent
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

// DOM Elements
const agentPrenomSpan = document.getElementById("agent-prenom");
const agentNomSpan = document.getElementById("agent-nom");
const agentQualificationsDisplay = document.getElementById("agentQualificationsDisplay");
const weekSelect = document.getElementById("week-select");
const tabButtons = document.querySelectorAll(".tab");
const planningContainer = document.getElementById("planning-container");
const saveButton = document.getElementById("save-button");
const clearSelectionBtn = document.getElementById("clear-selection-btn");
const logoutButton = document.getElementById('logout-btn');
const syntheseBtn = document.getElementById('synthese-btn');
const loadingSpinner = document.getElementById("loading-spinner");
const infoMessageElement = document.getElementById("selection-info");

// Variables pour la sélection par glisser-déposer
let isDragging = false;
let startSlot = null;
let endSlot = null;
let currentDaySlots = []; // Pour stocker les créneaux pour le jour actif
let selectedSlots = new Set(); // Pour stocker les créneaux actuellement sélectionnés (visuel)
let originalSelectedSlots = new Set(); // Pour restaurer si annuler la sélection

// Fonctions utilitaires
function getCurrentWeek() {
  const today = new Date();
  const date = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
}

// Récupère la date de début et de fin d'une semaine donnée
function getStartAndEndDateOfWeek(weekNum, year = new Date().getFullYear()) {
    const date = new Date(year, 0, 1 + (weekNum - 1) * 7);
    const day = date.getDay();
    const diff = (day <= 4 ? 1 : 8) - day; // calculate diff to Monday
    date.setDate(date.getDate() + diff);
    const monday = new Date(date);
    const sunday = new Date(date);
    sunday.setDate(date.getDate() + 6);
    return `${monday.toLocaleDateString('fr-FR')} - ${sunday.toLocaleDateString('fr-FR')}`;
}

// Fonction pour afficher des messages
function displayMessage(element, message, isError = true) {
  if (element) {
    element.textContent = message;
    element.style.color = isError ? 'red' : 'green';
    element.style.display = 'block';
    setTimeout(() => {
      element.textContent = '';
      element.style.display = 'none';
    }, 5000);
  }
}

function showLoading(isLoading) {
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

// --- Fonctions d'authentification ---
async function authenticateAndRedirect() {
    const token = sessionStorage.getItem('jwtToken');
    const isAdmin = sessionStorage.getItem('isAdmin'); // Récupérer le statut admin

    if (!token || isAdmin === 'true') { // Si pas de token OU si l'utilisateur est admin
        sessionStorage.clear(); // Nettoyer le stockage
        window.location.href = 'login.html'; // Rediriger vers la page de connexion
        return false;
    }
    // L'utilisateur est authentifié et n'est pas admin
    return true;
}

// Fonction pour récupérer les données de l'agent connecté
async function fetchAgentData() {
    showLoading(true);
    try {
        const token = sessionStorage.getItem('jwtToken');
        const response = await fetch(`${API_BASE_URL}/api/users/${currentAgentId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                sessionStorage.clear();
                window.location.href = 'login.html';
            }
            throw new Error('Erreur lors du chargement des données de l\'agent.');
        }

        const agentData = await response.json();
        agentPrenomSpan.textContent = agentData.prenom;
        agentNomSpan.textContent = agentData.nom;
        agentQualifications = agentData.qualifications; // Stocke les IDs des qualifications
        agentGrade = agentData.grade; // Stocke l'ID du grade
        agentFonction = agentData.fonction; // Stocke l'ID de la fonction
        await displayAgentQualifications(); // Affiche les noms des qualifications
        await displayAgentGradeAndFonction(); // Affiche le nom du grade et de la fonction

    } catch (error) {
        console.error('Erreur lors de la récupération des données de l\'agent :', error);
        displayMessage(infoMessageElement, 'Erreur lors du chargement des informations de l\'agent.', true);
    } finally {
        showLoading(false);
    }
}

// Fonction pour récupérer les qualifications et les afficher
async function displayAgentQualifications() {
    try {
        const token = sessionStorage.getItem('jwtToken');
        const response = await fetch(`${API_BASE_URL}/api/qualifications`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Erreur lors du chargement des qualifications.');
        const allQualifications = await response.json();

        const qualificationNames = agentQualifications.map(qId => {
            const qual = allQualifications.find(aq => aq.id === qId);
            return qual ? qual.name : '';
        }).filter(name => name !== ''); // Filtrer les noms vides

        if (qualificationNames.length > 0) {
            agentQualificationsDisplay.textContent = `Qualifications: ${qualificationNames.join(', ')}.`;
        } else {
            agentQualificationsDisplay.textContent = 'Aucune qualification attribuée.';
        }
    } catch (error) {
        console.error('Erreur lors de l\'affichage des qualifications:', error);
        agentQualificationsDisplay.textContent = 'Erreur de chargement des qualifications.';
    }
}

// Fonction pour récupérer et afficher le grade et la fonction de l'agent
async function displayAgentGradeAndFonction() {
    let gradeName = 'Non attribué';
    let fonctionName = 'Non attribuée';

    try {
        const token = sessionStorage.getItem('jwtToken');

        // Récupérer les grades
        const gradesResponse = await fetch(`${API_BASE_URL}/api/grades`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!gradesResponse.ok) throw new Error('Erreur lors du chargement des grades.');
        const allGrades = await gradesResponse.json();
        const foundGrade = allGrades.find(g => g.id === agentGrade);
        if (foundGrade) {
            gradeName = foundGrade.name;
        }

        // Récupérer les fonctions
        const fonctionsResponse = await fetch(`${API_BASE_URL}/api/fonctions`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!fonctionsResponse.ok) throw new Error('Erreur lors du chargement des fonctions.');
        const allFonctions = await fonctionsResponse.json();
        const foundFonction = allFonctions.find(f => f.id === agentFonction);
        if (foundFonction) {
            fonctionName = foundFonction.name;
        }

    } catch (error) {
        console.error('Erreur lors de l\'affichage du grade et de la fonction:', error);
        gradeName = 'Erreur';
        fonctionName = 'Erreur';
    } finally {
        // Mettre à jour l'affichage des qualifications avec le grade et la fonction
        // Vous devrez ajuster l'élément HTML pour afficher ces infos. Pour l'instant, je les ajoute au même endroit.
        if (agentQualificationsDisplay) {
            agentQualificationsDisplay.textContent += ` Grade: ${gradeName}, Fonction: ${fonctionName}.`;
        }
    }
}


// --- Fonctions de gestion du planning ---

async function loadAgentPlanning(agentId, weekKey) {
  showLoading(true);
  try {
    const token = sessionStorage.getItem('jwtToken');
    const response = await fetch(`${API_BASE_URL}/api/planning/${agentId}?week=${weekKey.replace('week-', '')}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
    }

    const data = await response.json();
    agentPlanningData[weekKey] = data.slots || {}; // Stocke les créneaux de la semaine
    initialPlanningState = JSON.parse(JSON.stringify(agentPlanningData[weekKey])); // Copie profonde pour détecter les changements
    displayPlanningGrid(currentDay);
  } catch (error) {
    console.error(`Erreur lors du chargement du planning de l'agent ${agentId} pour la semaine ${weekKey} :`, error);
    displayMessage(infoMessageElement, `Impossible de charger votre planning pour la semaine ${weekKey.replace('week-', '')}. ${error.message}`, true);
    planningContainer.innerHTML = '<p class="info-message">Impossible de charger le planning. Vérifiez la connexion ou contactez le support.</p>';
    agentPlanningData[weekKey] = {}; // Assurez-vous que c'est un objet vide en cas d'erreur
    initialPlanningState = {};
    displayPlanningGrid(currentDay); // Affiche une grille vide
  } finally {
    showLoading(false);
  }
}


function displayPlanningGrid(day) {
  planningContainer.innerHTML = ''; // Nettoyer la grille existante
  currentDaySlots = []; // Réinitialiser pour le nouveau jour
  selectedSlots.clear(); // Réinitialiser la sélection visuelle
  originalSelectedSlots.clear(); // Réinitialiser l'état initial pour le jour

  const currentWeekPlanning = agentPlanningData[currentWeekKey] || {};
  const slotsForDay = currentWeekPlanning[day] || [];

  // Recrée la grille
  horaires.forEach((slot, index) => {
    const slotButton = document.createElement('button');
    slotButton.classList.add('slot-button');
    slotButton.dataset.slot = slot; // Ex: "07:00 - 07:30"
    slotButton.dataset.index = index; // Pour le glisser-déposer
    slotButton.textContent = slot;

    // Si le créneau est enregistré pour ce jour, le marquer comme sélectionné
    if (slotsForDay.includes(slot)) {
        slotButton.classList.add('selected');
        selectedSlots.add(slot);
        originalSelectedSlots.add(slot); // Ajoute aussi à l'état initial
    }

    slotButton.addEventListener('mousedown', (e) => startDrag(e, slot, index));
    slotButton.addEventListener('mouseenter', (e) => duringDrag(e, slot, index));
    planningContainer.appendChild(slotButton);
    currentDaySlots.push(slotButton); // Stocke la référence aux boutons pour un accès facile
  });

  // Mettre à jour l'état du bouton "Enregistrer"
  updateSaveButtonState();
}

function updateSaveButtonState() {
    const currentDayPlanning = agentPlanningData[currentWeekKey]?.[currentDay] || [];
    const currentSelectedSlotsArray = Array.from(selectedSlots).sort();
    const originalSelectedSlotsArray = Array.from(originalSelectedSlots).sort();

    // Comparaison des ensembles de créneaux (après tri pour comparaison fiable)
    const hasChanges = currentSelectedSlotsArray.length !== originalSelectedSlotsArray.length ||
                       !currentSelectedSlotsArray.every((val, index) => val === originalSelectedSlotsArray[index]);

    saveButton.disabled = !hasChanges; // Active le bouton si des changements ont été faits
}


// --- Fonctions de Glisser-Déposer ---

function startDrag(e, slot, index) {
  if (e.button !== 0) return; // Seulement pour le clic gauche de la souris
  isDragging = true;
  startSlot = index;
  endSlot = index;
  updateSelection(index, index);
  document.addEventListener('mouseup', endDrag);
}

function duringDrag(e, slot, index) {
  if (!isDragging) return;
  endSlot = index;
  updateSelection(startSlot, endSlot);
}

function endDrag() {
  isDragging = false;
  startSlot = null;
  endSlot = null;
  document.removeEventListener('mouseup', endDrag);

  // Appliquer la sélection aux données de planning (agentPlanningData)
  const currentDayPlanning = agentPlanningData[currentWeekKey]?.[currentDay] || [];
  const updatedDayPlanning = Array.from(selectedSlots).sort(); // Sortir pour maintenir un ordre cohérent

  // Mettre à jour le planning de l'agent pour la semaine et le jour actuels
  if (!agentPlanningData[currentWeekKey]) {
      agentPlanningData[currentWeekKey] = {};
  }
  agentPlanningData[currentWeekKey][currentDay] = updatedDayPlanning;

  // Mettre à jour l'état du bouton "Enregistrer"
  updateSaveButtonState();
}


function updateSelection(startIndex, endIndex) {
    // Déterminer la plage de sélection
    const minIndex = Math.min(startIndex, endIndex);
    const maxIndex = Math.max(startIndex, endIndex);

    // Effacer toutes les sélections visuelles et réinitialiser selectedSlots
    currentDaySlots.forEach(btn => btn.classList.remove('selected'));
    selectedSlots.clear();

    // Appliquer la sélection visuelle à la plage déterminée et ajouter à selectedSlots
    for (let i = minIndex; i <= maxIndex; i++) {
        const slotButton = currentDaySlots[i];
        if (slotButton) {
            slotButton.classList.add('selected');
            selectedSlots.add(slotButton.dataset.slot);
        }
    }
}

// --- Sauvegarde et Effacement ---

saveButton.addEventListener('click', async () => {
  showLoading(true);
  try {
    // Obtenir les créneaux sélectionnés pour le jour actuel
    const selectedSlotsForCurrentDay = Array.from(selectedSlots).sort();

    const token = sessionStorage.getItem('jwtToken');
    const payload = {
      agentId: currentAgentId,
      week: parseInt(currentWeekKey.replace('week-', '')),
      day: currentDay,
      slots: selectedSlotsForCurrentDay
    };

    const response = await fetch(`${API_BASE_URL}/api/planning`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Erreur lors de l\'enregistrement du planning.');
    }

    displayMessage(infoMessageElement, 'Planning enregistré avec succès !', false);
    // Mettre à jour l'état initial après sauvegarde réussie
    initialPlanningState[currentDay] = [...selectedSlotsForCurrentDay];
    updateSaveButtonState();

  } catch (error) {
    console.error('Erreur lors de l\'enregistrement du planning :', error);
    displayMessage(infoMessageElement, 'Erreur lors de l\'enregistrement du planning: ' + error.message, true);
  } finally {
    showLoading(false);
  }
});

clearSelectionBtn.addEventListener('click', () => {
    // Effacer toutes les sélections visuelles
    currentDaySlots.forEach(btn => btn.classList.remove('selected'));
    selectedSlots.clear(); // Vider l'ensemble des créneaux sélectionnés

    // Mettre à jour les données du planning pour le jour actuel (le vider)
    if (agentPlanningData[currentWeekKey]) {
        agentPlanningData[currentWeekKey][currentDay] = [];
    }
    
    updateSaveButtonState(); // Mettre à jour l'état du bouton "Enregistrer"
    displayMessage(infoMessageElement, 'Sélection effacée. N\'oubliez pas d\'enregistrer !', false);
});


// --- Événements et Initialisation ---

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Authentifier et rediriger si nécessaire
  const isAuthenticated = await authenticateAndRedirect();
  if (!isAuthenticated) return;

  // 2. Récupérer les données de l'agent connecté
  await fetchAgentData();

  // 3. Initialiser le sélecteur de semaine
  populateWeekSelect();

  // 4. Charger le planning de l'agent pour la semaine actuelle
  await loadAgentPlanning(currentAgentId, currentWeekKey);

  // 5. Initialiser les écouteurs d'événements
  weekSelect.addEventListener('change', async (event) => {
    currentWeekKey = `week-${event.target.value}`;
    await loadAgentPlanning(currentAgentId, currentWeekKey);
  });

  tabButtons.forEach(button => {
    button.addEventListener('click', (event) => {
      // Retirer la classe 'active' de tous les onglets
      tabButtons.forEach(btn => btn.classList.remove('active'));
      // Ajouter la classe 'active' à l'onglet cliqué
      event.target.classList.add('active');
      currentDay = event.target.dataset.day;
      displayPlanningGrid(currentDay);
    });
  });

  // Ajouter l'écouteur de déconnexion
  logoutButton.addEventListener('click', () => {
    sessionStorage.clear();
    window.location.href = 'login.html';
  });

  // Initialiser la sélection de l'onglet du jour actuel
  const today = new Date();
  const todayDayName = days[today.getDay()];
  const currentDayTab = document.querySelector(`.tab[data-day="${todayDayName}"]`);
  if (currentDayTab) {
      currentDayTab.click(); // Simule un clic pour afficher le planning du jour actuel
  } else {
      // Si le jour actuel n'est pas dans les onglets (ex: dimanche si votre semaine commence lundi)
      // Ou si pour une raison quelconque l'onglet n'est pas trouvé, revenir au lundi.
      document.querySelector(`.tab[data-day="lundi"]`).click();
  }

  document.addEventListener('mouseup', endDrag); // Global mouseup pour arrêter le drag partout
});

// Fonction pour populer le sélecteur de semaine
function populateWeekSelect() {
  const currentYear = new Date().getFullYear();
  const totalWeeks = 52; // Peut être ajusté si une année a 53 semaines

  weekSelect.innerHTML = '';
  for (let i = 1; i <= totalWeeks; i++) {
    const option = document.createElement('option');
    option.value = i;
    option.textContent = `Semaine ${i} (${getStartAndEndDateOfWeek(i)})`;
    if (i === getCurrentWeek()) {
      option.selected = true;
    }
    weekSelect.appendChild(option);
  }
}