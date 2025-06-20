// admin.js

const days = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const API_BASE_URL = "https://dispo-pompier.onrender.com";

let currentWeek; // Ex: 25 (number)
let currentYear; // Ex: 2025 (number)
let currentDay = 'lundi'; // Jour actuel par défaut pour le planning (utilisé pour les onglets)
let planningData = {}; // Contiendra le planning global chargé de l'API { agentId: { week-X: { day: [slots] } } }
let agentDisplayInfos = {}; // Mapping dynamique agentId => {nom, prenom}
let availableQualifications = []; // Liste des qualifications disponibles chargée depuis l'API
let availableGrades = []; // Nouvelle: Liste des grades disponibles chargée depuis l'API
let availableFunctions = []; // Liste des fonctions disponibles

// Créneaux 30 min sur 24h, affichage de 7h à 7h le lendemain (synchronisé avec agent.js et serveur.js)
const START_HOUR = 7; 
const NUMBER_OF_SLOTS = 48; // Nombre total de créneaux de 30 min sur 24h

// Array of time strings for display, e.g., "07:00", "07:30", ...
const horairesDisplay = [];
for (let i = 0; i < NUMBER_OF_SLOTS + 1; i++) { // +1 pour l'heure de fin (7h le lendemain)
    const totalMinutes = START_HOUR * 60 + i * 30;
    const hour = Math.floor(totalMinutes / 60) % 24;
    const minute = totalMinutes % 60;
    horairesDisplay.push(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
}

/**
 * Converts a slot index (0-47) to a time string "HH:MM - HH:MM".
 * Must match the values used for saving/loading on server/agent.js.
 * @param {number} startIndex The slot index (0-47).
 * @returns {string} The formatted time string.
 */
function formatSlotTime(startIndex) {
    const totalMinutesStart = START_HOUR * 60 + startIndex * 30;
    const hourStart = Math.floor(totalMinutesStart / 60) % 24;
    const minuteStart = totalMinutesStart % 60;

    const totalMinutesEnd = START_HOUR * 60 + (startIndex + 1) * 30;
    const hourEnd = Math.floor(totalMinutesEnd / 60) % 24;
    const minuteEnd = totalMinutesEnd % 60;

    return `${String(hourStart).padStart(2, '0')}:${String(minuteStart).padStart(2, '0')} - ` +
           `${String(hourEnd).padStart(2, '0')}:${String(minuteEnd).padStart(2, '0')}`;
}


// --- DOM Elements pour la navigation principale (onglets) ---
const mainTabButtons = document.querySelectorAll('.main-tab');
const mainTabContents = document.querySelectorAll('.main-tab-content');

// --- DOM Elements pour la vue "Planning Global" ---
const planningControls = document.getElementById('planning-controls'); // Conteneur pour les contrôles de semaine/export
const weekSelect = document.getElementById("week-select");
const dateRangeDisplay = document.getElementById("date-range"); // Élément pour afficher la plage de dates
const planningContainer = document.getElementById("global-planning"); // Conteneur du tableau de planning
const tabButtons = document.querySelectorAll(".tab"); // Boutons de jour (Lundi, Mardi...)
const adminInfo = document.getElementById("admin-info");
const adminNameDisplay = document.getElementById('admin-name-display'); // Déclaré globalement ici
const logoutButton = document.getElementById("logout-btn"); // Bouton de déconnexion

// --- DOM Elements pour la vue "Gestion des Agents" ---
const addAgentFormElement = document.getElementById('add-agent-form');
const agentsTableBody = document.getElementById('agents-table-body');
const newAgentQualificationsCheckboxes = document.getElementById('newAgentQualificationsCheckboxes');
const newAgentGradesCheckboxes = document.getElementById('newAgentGradesCheckboxes');
const newAgentFunctionsCheckboxes = document.getElementById('newAgentFunctionsCheckboxes'); // Pour les fonctions

// Modale de modification d'agent
const editAgentModalElement = document.getElementById('editAgentModal');
const closeAgentButton = editAgentModalElement ? editAgentModalElement.querySelector('.close-button') : null;
const editAgentFormElement = document.getElementById('editAgentForm');
const editAgentIdInput = document.getElementById('editAgentId');
const editAgentFirstNameInput = document.getElementById('editAgentFirstName');
const editAgentLastNameInput = document.getElementById('editAgentLastName');
const editAgentNewPasswordInput = document.getElementById('editAgentNewPassword');
const qualificationsCheckboxes = document.getElementById('qualificationsCheckboxes');
const gradesCheckboxes = document.getElementById('gradesCheckboxes');
const functionsCheckboxes = document.getElementById('functionsCheckboxes'); // Pour les fonctions

// --- DOM Elements pour la vue "Gestion des Qualifications" ---
const addQualificationFormElement = document.getElementById('add-qualification-form');
const qualificationsTableBody = document.getElementById('qualifications-table-body');
const editQualificationModalElement = document.getElementById('editQualificationModal');
const closeQualificationButton = editQualificationModalElement ? editQualificationModalElement.querySelector('.close-button') : null;
const editQualificationFormElement = document.getElementById('editQualificationForm');

// --- DOM Elements pour la vue "Gestion des Grades" ---
const addGradeFormElement = document.getElementById('add-grade-form');
const gradesTableBody = document.getElementById('grades-table-body');
const editGradeModalElement = document.getElementById('editGradeModal');
const closeGradeButton = editGradeModalElement ? editGradeModalElement.querySelector('.close-button') : null;
const editGradeFormElement = document.getElementById('editGradeForm');

// --- DOM Elements pour la vue "Gestion des Fonctions" ---
const addFunctionFormElement = document.getElementById('add-function-form');
const functionsTableBody = document.getElementById('functions-table-body');
const editFunctionModalElement = document.getElementById('editFunctionModal');
const closeFunctionButton = editFunctionModalElement ? editFunctionModalElement.querySelector('.close-button') : null;
const editFunctionFormElement = document.getElementById('editFunctionForm');


// --- Fonctions utilitaires de date (synchronisées avec serveur.js et disponibles ici) ---

function getWeekNumber(d) {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1)/7);
  return weekNo;
}

function getMonday(d) {
  d = new Date(d);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0,0,0,0);
  return d;
}

function formatDate(d) {
  return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}`;
}

// Fonction pour obtenir la date au format YYYY-MM-DD (pour les appels API)
function formatDateToYYYYMMDD(date) {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Calcule les dates de début et de fin d'une semaine ISO (YYYY-Wnn).
 * @param {string} isoWeekString - L'identifiant de la semaine ISO (ex: "2025-W25").
 * @returns {object} Un objet avec startDate et endDate formatés en JJ/MM.
 */
function getDatesForISOWeek(isoWeekString) {
    const [yearStr, weekStr] = isoWeekString.split('-W');
    const year = parseInt(yearStr);
    const weekNum = parseInt(weekStr);

    // Commencez par le 4 janvier de l'année (toujours dans la première semaine ISO de l'année)
    const jan4 = new Date(year, 0, 4);
    const jan4DayOfWeek = (jan4.getDay() + 6) % 7; // Lundi = 0, Mardi = 1, etc.

    // Trouvez le premier lundi de l'année
    const firstMonday = new Date(jan4);
    firstMonday.setDate(jan4.getDate() - jan4DayOfWeek);

    // Calculez le lundi de la semaine spécifiée
    const targetMonday = new Date(firstMonday);
    targetMonday.setDate(firstMonday.getDate() + (weekNum - 1) * 7);

    const targetSunday = new Date(targetMonday);
    targetSunday.setDate(targetMonday.getDate() + 6);

    const format_dd_mm = (date) => {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        return `${day}/${month}`;
    };

    return {
        startDate: format_dd_mm(targetMonday),
        endDate: format_dd_mm(targetSunday)
    };
}


// --- Fonctions de modales (pour les messages à l'utilisateur) ---
function displayMessageModal(title, message, type = "info", callback = null) {
    let modal = document.getElementById('message-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'message-modal';
        modal.classList.add('modal');
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="modal-content ${type}">
        <span class="close-button">&times;</span>
        <h3 class="modal-title">${title}</h3>
        <p class="modal-message">${message}</p>
        ${type === 'question' ? '<div class="modal-actions"><button class="btn btn-primary" id="modal-confirm-btn">Oui</button><button class="btn btn-secondary" id="modal-cancel-btn">Annuler</button></div>' : ''}
      </div>
    `;
    modal.style.display = 'block';

    const closeButton = modal.querySelector('.close-button');
    if (closeButton) {
      closeButton.onclick = () => {
        modal.style.display = 'none';
        if (callback && type === 'question') callback(false); // Annuler si on ferme
      };
    }

    const confirmBtn = modal.querySelector('#modal-confirm-btn');
    if (confirmBtn) {
      confirmBtn.onclick = () => {
        modal.style.display = 'none';
        if (callback) callback(true);
      };
    }

    const cancelBtn = modal.querySelector('#modal-cancel-btn');
    if (cancelBtn) {
      cancelBtn.onclick = () => {
        modal.style.display = 'none';
        if (callback) callback(false);
      };
    }

    window.onclick = (event) => {
      if (event.target == modal && type !== 'question') {
        modal.style.display = 'none';
        if (callback && type === 'question') callback(false);
      }
    };
}


// --- Initialisation de l'affichage (login, etc.) ---
document.addEventListener('DOMContentLoaded', async () => {
    // Check if user is logged in and is admin
    const token = sessionStorage.getItem('jwtToken');
    const user = JSON.parse(sessionStorage.getItem('agent')); // 'agent' contient maintenant le rôle
    
    if (!token || !user || user.role !== 'admin') {
        // Rediriger vers la page de connexion si non admin ou non connecté
        window.location.href = 'login.html';
        return;
    }

    // Afficher le nom de l'administrateur
    if (adminNameDisplay && user.firstName && user.lastName) {
        adminNameDisplay.textContent = `${user.firstName} ${user.lastName}`;
    }

    // Charger les listes de qualifications, grades, fonctions
    await fetchQualifications();
    await fetchGrades();
    await fetchFunctions();

    // Initialiser les onglets
    mainTabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.dataset.mainTab;
            switchMainTab(targetTab);
        });
    });

    // Initialiser la sélection de semaine et le planning global
    populateWeekSelect();
    await updateWeekDisplay(); // Charge le planning global au démarrage

    // Écouteurs d'événements pour la navigation de semaine
    weekSelect.addEventListener('change', updateWeekDisplay);
    document.getElementById('prev-week-btn').addEventListener('click', navigateWeek.bind(null, -1));
    document.getElementById('next-week-btn').addEventListener('click', navigateWeek.bind(null, 1));
    document.getElementById('export-pdf').addEventListener('click', exportPlanningToPdf);


    // --- Écouteurs d'événements pour la vue "Gestion des Agents" ---
    if (addAgentFormElement) {
        addAgentFormElement.addEventListener('submit', handleAddAgent);
    } else {
        console.warn("Le formulaire d'ajout d'agent est introuvable dans admin.html.");
    }
    if (agentsTableBody) {
        agentsTableBody.addEventListener('click', handleAgentActions);
    } else {
        console.warn("Le corps de la table des agents est introuvable dans admin.html.");
    }
    if (editAgentModalElement && closeAgentButton) {
        closeAgentButton.addEventListener('click', () => {
            editAgentModalElement.style.display = 'none';
        });
    } else {
        console.warn("La modale d'édition d'agent ou son bouton de fermeture est introuvable dans admin.html.");
    }
    if (editAgentFormElement) {
        editAgentFormElement.addEventListener('submit', handleEditAgent);
    } else {
        console.warn("Le formulaire d'édition d'agent est introuvable dans admin.html.");
    }

    // --- Écouteurs d'événements pour la vue "Gestion des Qualifications" ---
    if (addQualificationFormElement) {
        addQualificationFormElement.addEventListener('submit', handleAddQualification);
    } else {
        console.warn("Le formulaire d'ajout de qualification est introuvable dans admin.html.");
    }
    if (qualificationsTableBody) {
        qualificationsTableBody.addEventListener('click', handleQualificationActions);
    } else {
        console.warn("Le corps de la table des qualifications est introuvable dans admin.html.");
    }
    if (editQualificationModalElement && closeQualificationButton) {
        closeQualificationButton.addEventListener('click', () => {
            editQualificationModalElement.style.display = 'none';
        });
    } else {
        console.warn("La modale d'édition de qualification ou son bouton de fermeture est introuvable dans admin.html.");
    }
    if (editQualificationFormElement) {
        editQualificationFormElement.addEventListener('submit', handleEditQualification);
    } else {
        console.warn("Le formulaire d'édition de qualification est introuvable dans admin.html.");
    }

    // --- Écouteurs d'événements pour la vue "Gestion des Grades" ---
    if (addGradeFormElement) {
        addGradeFormElement.addEventListener('submit', handleAddGrade);
    } else {
        console.warn("Le formulaire d'ajout de grade est introuvable dans admin.html.");
    }
    if (gradesTableBody) {
        gradesTableBody.addEventListener('click', handleGradeActions);
    } else {
        console.warn("Le corps de la table des grades est introuvable dans admin.html.");
    }
    if (editGradeModalElement && closeGradeButton) {
        closeGradeButton.addEventListener('click', () => {
            editGradeModalElement.style.display = 'none';
        });
    } else {
        console.warn("La modale d'édition de grade ou son bouton de fermeture est introuvable dans admin.html.");
    }
    if (editGradeFormElement) {
        editGradeFormElement.addEventListener('submit', handleEditGrade);
    } else {
        console.warn("Le formulaire d'édition de grade est introuvable dans admin.html.");
    }

    // --- Écouteurs d'événements pour la vue "Gestion des Fonctions" ---
    if (addFunctionFormElement) {
        addFunctionFormElement.addEventListener('submit', handleAddFunction);
    } else {
        console.warn("Le formulaire d'ajout de fonction est introuvable dans admin.html.");
    }
    if (functionsTableBody) {
        functionsTableBody.addEventListener('click', handleFunctionActions);
    } else {
        console.warn("Le corps de la table des fonctions est introuvable dans admin.html.");
    }
    if (editFunctionModalElement && closeFunctionButton) {
        closeFunctionButton.addEventListener('click', () => {
            editFunctionModalElement.style.display = 'none';
        });
    } else {
        console.warn("La modale d'édition de fonction ou son bouton de fermeture est introuvable dans admin.html.");
    }
    if (editFunctionFormElement) {
        editFunctionFormElement.addEventListener('submit', handleEditFunction);
    } else {
        console.warn("Le formulaire d'édition de fonction est introuvable dans admin.html.");
    }

    // --- Écouteur pour la déconnexion ---
    if (logoutButton) {
        logoutButton.addEventListener("click", logout);
    } else {
        console.warn("Le bouton de déconnexion est introuvable dans admin.html.");
    }

    // Charger les agents et afficher le premier onglet par défaut
    await fetchAndRenderAgents();
    // switchMainTab('global-planning-view'); // Déjà fait par l'appel à updateWeekDisplay

});

// --- Fonctions de navigation des onglets ---
function switchMainTab(tabId) {
    mainTabContents.forEach(content => {
        if (content.id === tabId) {
            content.classList.add('active');
        } else {
            content.classList.remove('active');
        }
    });
    mainTabButtons.forEach(button => {
        if (button.dataset.mainTab === tabId) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });

    // Masquer ou afficher les contrôles du planning global si nécessaire
    if (tabId === 'global-planning-view') {
        planningControls.style.display = 'flex';
        // Recharger le planning global à chaque fois que l'on revient sur cet onglet
        updateWeekDisplay();
    } else {
        planningControls.style.display = 'none';
    }

    // Recharger la liste des agents si on va sur l'onglet de gestion des agents
    if (tabId === 'agent-management-view') {
        fetchAndRenderAgents();
    }
    // Recharger la liste des qualifications si on va sur l'onglet de gestion des qualifications
    if (tabId === 'qualification-management-view') {
        fetchAndRenderQualifications();
    }
    // Recharger la liste des grades si on va sur l'onglet de gestion des grades
    if (tabId === 'grade-management-view') {
        fetchAndRenderGrades();
    }
    // Recharger la liste des fonctions si on va sur l'onglet de gestion des fonctions
    if (tabId === 'function-management-view') {
        fetchAndRenderFunctions();
    }
}


// --- Fonctions de gestion de la semaine (Planning Global) ---

function populateWeekSelect() {
    weekSelect.innerHTML = '';
    const today = new Date();
    const currentYearForSelect = today.getFullYear();
    const startYear = currentYearForSelect - 1; // Un an en arrière
    const endYear = currentYearForSelect + 2;   // Deux ans en avant

    for (let year = startYear; year <= endYear; year++) {
      for (let week = 1; week <= 53; week++) { // 53 semaines pour couvrir tous les cas
        const option = document.createElement('option');
        // Générer une date pour le lundi de la semaine ISO pour obtenir la plage de dates
        const mondayOfCurrentWeek = getMonday(new Date(year, 0, (week - 1) * 7 + 1));
        const sundayOfCurrentWeek = new Date(mondayOfCurrentWeek);
        sundayOfCurrentWeek.setDate(mondayOfCurrentWeek.getDate() + 6);

        // Simple check for year validity for ISO weeks
        if (getWeekNumber(mondayOfCurrentWeek) !== week || mondayOfCurrentWeek.getFullYear() !== year) {
            continue; 
        }

        const dates = `${formatDate(mondayOfCurrentWeek)} - ${formatDate(sundayOfCurrentWeek)}`;
        option.value = `${year}-W${week}`; // Format: "YYYY-WNN"
        option.textContent = `Semaine ${week} (${dates})`;
        weekSelect.appendChild(option);
      }
    }
    // Sélectionner la semaine courante
    currentYear = today.getFullYear();
    currentWeek = getWeekNumber(today);
    weekSelect.value = `${currentYear}-W${currentWeek}`;
}

async function updateWeekDisplay() {
    const selectedWeekValue = weekSelect.value;
    const [yearStr, weekStr] = selectedWeekValue.split('-W');
    currentYear = parseInt(yearStr);
    currentWeek = parseInt(weekStr);

    const { startDate, endDate } = getDatesForISOWeek(selectedWeekValue);
    dateRangeDisplay.textContent = `Du ${startDate} au ${endDate}`;

    await loadAndRenderGlobalPlanning(currentYear, currentWeek);
}

async function navigateWeek(direction) {
    let newWeekNumber = currentWeek + direction;
    let newYear = currentYear;

    if (newWeekNumber < 1) {
        newYear--;
        newWeekNumber = getWeekNumber(new Date(newYear, 11, 31)); // Dernière semaine de l'année précédente
    } else {
        const maxWeek = getWeekNumber(new Date(newYear, 11, 31)); // Dernière semaine de l'année actuelle
        if (newWeekNumber > maxWeek) {
            newYear++;
            newWeekNumber = 1;
        }
    }
    weekSelect.value = `${newYear}-W${newWeekNumber}`;
    await updateWeekDisplay();
}

// --- Fonctions de chargement et d'affichage du Planning Global ---

async function loadGlobalPlanning() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/planning`, {
            headers: {
                'Authorization': `Bearer ${sessionStorage.getItem('jwtToken')}`
            }
        });
        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status}`);
        }
        const data = await response.json();
        return data; // { agentId: { week-X: { day: [slots] } } }
    } catch (error) {
        console.error('Erreur lors du chargement du planning global :', error);
        displayMessageModal('Erreur de chargement', 'Impossible de charger le planning global. Veuillez réessayer.', 'error');
        return {};
    }
}

async function loadAgentDisplayInfos() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/agents`, {
            headers: {
                'Authorization': `Bearer ${sessionStorage.getItem('jwtToken')}`
            }
        });
        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status}`);
        }
        const agents = await response.json();
        agents.forEach(agent => {
            agentDisplayInfos[agent._id] = { prenom: agent.prenom, nom: agent.nom };
        });
    } catch (error) {
        console.error('Erreur lors du chargement des infos des agents :', error);
        displayMessageModal('Erreur', 'Impossible de charger les informations des agents.', 'error');
    }
}

async function loadAndRenderGlobalPlanning(year, weekNumber) {
    await loadAgentDisplayInfos(); // Charger les noms des agents
    planningData = await loadGlobalPlanning(); // Charger toutes les données de planning

    renderGlobalPlanningTable(year, weekNumber);
}

function renderGlobalPlanningTable(year, weekNumber) {
    planningContainer.innerHTML = ''; // Vide le conteneur actuel

    // Crée l'en-tête du tableau avec les heures
    const headerRow = document.createElement('div');
    headerRow.classList.add('planning-grid-header');

    const emptyCell = document.createElement('div');
    emptyCell.classList.add('header-cell', 'sticky-header-cell'); // Cellule vide pour le coin
    headerRow.appendChild(emptyCell);

    // Ajoute les heures de 7h à 7h le lendemain
    horairesDisplay.forEach(time => {
        const hourCell = document.createElement('div');
        hourCell.classList.add('header-cell');
        hourCell.textContent = time;
        headerRow.appendChild(hourCell);
    });
    planningContainer.appendChild(headerRow);

    const currentWeekKey = `week-${weekNumber}`; // Clé de semaine correcte

    // Boucle sur chaque jour de la semaine
    days.forEach(dayName => {
        const dayRow = document.createElement('div');
        dayRow.classList.add('planning-grid-row');

        // Cellule du nom du jour
        const dayNameCell = document.createElement('div');
        dayNameCell.classList.add('day-name-cell', 'sticky-day-name');
        dayNameCell.textContent = dayName.charAt(0).toUpperCase() + dayName.slice(1);
        dayRow.appendChild(dayNameCell);

        // Crée une sous-grille pour les créneaux horaires de ce jour
        const daySlotsGrid = document.createElement('div');
        daySlotsGrid.classList.add('day-slots-grid'); // Cette classe aura les styles CSS pour la grille d'agents

        // Parcourt tous les agents pour ce jour et cette semaine
        const agentsInOrder = Object.keys(agentDisplayInfos).sort((a,b) => {
            const nameA = `${agentDisplayInfos[a].prenom} ${agentDisplayInfos[a].nom}`;
            const nameB = `${agentDisplayInfos[b].prenom} ${agentDisplayInfos[b].nom}`;
            return nameA.localeCompare(nameB);
        });

        agentsInOrder.forEach(agentId => {
            const agentRow = document.createElement('div');
            agentRow.classList.add('agent-slot-row'); // Ligne pour chaque agent dans la sous-grille

            // Cellule pour le nom de l'agent
            const agentNameCell = document.createElement('div');
            agentNameCell.classList.add('agent-name-slot-cell');
            const agentInfo = agentDisplayInfos[agentId];
            agentNameCell.textContent = agentInfo ? `${agentInfo.prenom} ${agentInfo.nom}` : `Agent ${agentId}`;
            agentRow.appendChild(agentNameCell);

            // Créneaux horaires de l'agent
            const agentWeekPlanning = planningData[agentId] || {};
            const agentDaySlots = agentWeekPlanning[currentWeekKey] ? agentWeekPlanning[currentWeekKey][dayName] : [];

            // Créer les 48 cellules pour les créneaux horaires
            for (let i = 0; i < NUMBER_OF_SLOTS; i++) {
                const slotCell = document.createElement('div');
                slotCell.classList.add('slot-cell');

                // Vérifier si le créneau est présent dans les disponibilités de l'agent
                const isAvailable = agentDaySlots.includes(formatSlotTime(i)); // Compare la chaîne de temps

                if (isAvailable) {
                    slotCell.classList.add('available');
                } else {
                    slotCell.classList.add('unavailable');
                }
                agentRow.appendChild(slotCell);
            }
            daySlotsGrid.appendChild(agentRow);
        });
        dayRow.appendChild(daySlotsGrid); // Ajoute la sous-grille au jour
        planningContainer.appendChild(dayRow);
    });
}


// --- Fonctions de gestion des Agents ---

async function fetchAndRenderAgents() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/agents`, {
            headers: {
                'Authorization': `Bearer ${sessionStorage.getItem('jwtToken')}`
            }
        });
        if (!response.ok) throw new Error('Failed to fetch agents');
        const agents = await response.json();
        renderAgentsTable(agents);
    } catch (error) {
        console.error('Error fetching agents:', error);
        displayMessageModal('Erreur', 'Impossible de charger la liste des agents.', 'error');
    }
}

function renderAgentsTable(agents) {
    agentsTableBody.innerHTML = '';
    agents.forEach(agent => {
        const row = agentsTableBody.insertRow();
        row.dataset.agentId = agent._id;
        row.innerHTML = `
            <td>${agent.prenom}</td>
            <td>${agent.nom}</td>
            <td>${agent._id}</td>
            <td>${agent.qualifications.map(id => availableQualifications.find(q => q.id === id)?.name || id).join(', ')}</td>
            <td>${agent.grades.map(id => availableGrades.find(g => g.id === id)?.name || id).join(', ')}</td>
            <td>${agent.functions.map(id => availableFunctions.find(f => f.id === id)?.name || id).join(', ')}</td>
            <td>
                <button class="btn btn-sm btn-secondary edit-agent-btn" data-id="${agent._id}">Modifier</button>
                <button class="btn btn-sm btn-danger delete-agent-btn" data-id="${agent._id}">Supprimer</button>
            </td>
        `;
    });
}

async function handleAddAgent(event) {
    event.preventDefault();
    const id = document.getElementById('newAgentId').value.trim();
    const nom = document.getElementById('newAgentLastName').value.trim();
    const prenom = document.getElementById('newAgentFirstName').value.trim();
    const password = document.getElementById('newAgentPassword').value.trim();
    const selectedQualifications = Array.from(newAgentQualificationsCheckboxes.querySelectorAll('input:checked')).map(cb => cb.value);
    const selectedGrades = Array.from(newAgentGradesCheckboxes.querySelectorAll('input:checked')).map(cb => cb.value);
    const selectedFunctions = Array.from(newAgentFunctionsCheckboxes.querySelectorAll('input:checked')).map(cb => cb.value);

    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/agents`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionStorage.getItem('jwtToken')}`
            },
            body: JSON.stringify({ id, nom, prenom, password, qualifications: selectedQualifications, grades: selectedGrades, functions: selectedFunctions })
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Échec de l\'ajout de l\'agent.');
        }
        displayMessageModal('Succès', 'Agent ajouté avec succès.', 'success');
        addAgentFormElement.reset();
        await fetchAndRenderAgents();
    } catch (error) {
        console.error('Erreur lors de l\'ajout de l\'agent:', error);
        displayMessageModal('Erreur', error.message, 'error');
    }
}

async function handleAgentActions(event) {
    const target = event.target;
    const agentId = target.dataset.id;

    if (target.classList.contains('edit-agent-btn')) {
        await populateEditAgentModal(agentId);
        editAgentModalElement.style.display = 'block';
    } else if (target.classList.contains('delete-agent-btn')) {
        displayMessageModal('Confirmer la suppression', 'Voulez-vous vraiment supprimer cet agent et toutes ses données de planning ?', 'question', async (confirmed) => {
            if (confirmed) {
                await deleteAgent(agentId);
            }
        });
    }
}

async function populateEditAgentModal(agentId) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/agents/${agentId}`, {
            headers: {
                'Authorization': `Bearer ${sessionStorage.getItem('jwtToken')}`
            }
        });
        if (!response.ok) throw new Error('Failed to fetch agent details');
        const agent = await response.json();

        editAgentIdInput.value = agent._id;
        editAgentFirstNameInput.value = agent.prenom;
        editAgentLastNameInput.value = agent.nom;
        editAgentNewPasswordInput.value = ''; // Toujours vider le champ du mot de passe

        // Gérer les qualifications existantes
        qualificationsCheckboxes.innerHTML = '';
        availableQualifications.forEach(q => {
            const div = document.createElement('div');
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.id = `edit-qual-${q.id}`;
            input.name = 'qualifications';
            input.value = q.id;
            input.checked = agent.qualifications.includes(q.id);
            const label = document.createElement('label');
            label.htmlFor = `edit-qual-${q.id}`;
            label.textContent = q.name;
            div.appendChild(input);
            div.appendChild(label);
            qualificationsCheckboxes.appendChild(div);
        });

        // Gérer les grades existants
        gradesCheckboxes.innerHTML = '';
        availableGrades.forEach(g => {
            const div = document.createElement('div');
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.id = `edit-grade-${g.id}`;
            input.name = 'grades';
            input.value = g.id;
            input.checked = agent.grades.includes(g.id);
            const label = document.createElement('label');
            label.htmlFor = `edit-grade-${g.id}`;
            label.textContent = g.name;
            div.appendChild(input);
            div.appendChild(label);
            gradesCheckboxes.appendChild(div);
        });

        // Gérer les fonctions existantes
        functionsCheckboxes.innerHTML = '';
        availableFunctions.forEach(f => {
            const div = document.createElement('div');
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.id = `edit-function-${f.id}`;
            input.name = 'functions';
            input.value = f.id;
            input.checked = agent.functions.includes(f.id);
            const label = document.createElement('label');
            label.htmlFor = `edit-function-${f.id}`;
            label.textContent = f.name;
            div.appendChild(input);
            div.appendChild(label);
            functionsCheckboxes.appendChild(div);
        });

    } catch (error) {
        console.error('Error populating edit agent modal:', error);
        displayMessageModal('Erreur', 'Impossible de charger les détails de l\'agent pour modification.', 'error');
    }
}

async function handleEditAgent(event) {
    event.preventDefault();
    const agentId = editAgentIdInput.value;
    const nom = editAgentLastNameInput.value.trim();
    const prenom = editAgentFirstNameInput.value.trim();
    const newPassword = editAgentNewPasswordInput.value.trim();
    const selectedQualifications = Array.from(qualificationsCheckboxes.querySelectorAll('input:checked')).map(cb => cb.value);
    const selectedGrades = Array.from(gradesCheckboxes.querySelectorAll('input:checked')).map(cb => cb.value);
    const selectedFunctions = Array.from(functionsCheckboxes.querySelectorAll('input:checked')).map(cb => cb.value);

    const updateData = { nom, prenom, qualifications: selectedQualifications, grades: selectedGrades, functions: selectedFunctions };
    if (newPassword) {
        updateData.newPassword = newPassword;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/agents/${agentId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionStorage.getItem('jwtToken')}`
            },
            body: JSON.stringify(updateData)
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Échec de la mise à jour de l\'agent.');
        }
        displayMessageModal('Succès', 'Agent mis à jour avec succès.', 'success');
        editAgentModalElement.style.display = 'none';
        await fetchAndRenderAgents(); // Rafraîchir la liste des agents
    } catch (error) {
        console.error('Erreur lors de la mise à jour de l\'agent:', error);
        displayMessageModal('Erreur', error.message, 'error');
    }
}

async function deleteAgent(agentId) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/agents/${agentId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${sessionStorage.getItem('jwtToken')}`
            }
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Échec de la suppression de l\'agent.');
        }
        displayMessageModal('Succès', 'Agent et ses plannings supprimés avec succès.', 'success');
        await fetchAndRenderAgents();
        await updateWeekDisplay(); // Recharger le planning global après suppression
    } catch (error) {
        console.error('Erreur lors de la suppression de l\'agent:', error);
        displayMessageModal('Erreur', error.message, 'error');
    }
}


// --- Fonctions de gestion des Qualifications ---

async function fetchQualifications() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/qualifications`, {
            headers: { 'Authorization': `Bearer ${sessionStorage.getItem('jwtToken')}` }
        });
        if (!response.ok) throw new Error('Failed to fetch qualifications');
        availableQualifications = await response.json();
        renderQualificationsTable(availableQualifications);
        // Mettre à jour les checkboxes d'ajout d'agent
        renderCheckboxes(newAgentQualificationsCheckboxes, availableQualifications, 'newAgentQual');
    } catch (error) {
        console.error('Error fetching qualifications:', error);
        displayMessageModal('Erreur', 'Impossible de charger la liste des qualifications.', 'error');
    }
}

function renderQualificationsTable(qualifications) {
    qualificationsTableBody.innerHTML = '';
    qualifications.forEach(q => {
        const row = qualificationsTableBody.insertRow();
        row.dataset.qualId = q.id;
        row.innerHTML = `
            <td>${q.name}</td>
            <td>${q.id}</td>
            <td>
                <button class="btn btn-sm btn-secondary edit-qual-btn" data-id="${q.id}">Modifier</button>
                <button class="btn btn-sm btn-danger delete-qual-btn" data-id="${q.id}">Supprimer</button>
            </td>
        `;
    });
}

async function handleAddQualification(event) {
    event.preventDefault();
    const id = document.getElementById('newQualificationId').value.trim();
    const name = document.getElementById('newQualificationName').value.trim();
    try {
        const response = await fetch(`${API_BASE_URL}/api/qualifications`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionStorage.getItem('jwtToken')}`
            },
            body: JSON.stringify({ id, name })
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Échec de l\'ajout de la qualification.');
        }
        displayMessageModal('Succès', 'Qualification ajoutée avec succès.', 'success');
        addQualificationFormElement.reset();
        await fetchQualifications();
        await fetchAndRenderAgents(); // Rafraîchir la liste des agents car leurs qualifications peuvent être impactées
    } catch (error) {
        console.error('Erreur lors de l\'ajout de la qualification:', error);
        displayMessageModal('Erreur', error.message, 'error');
    }
}

async function handleQualificationActions(event) {
    const target = event.target;
    const qualId = target.dataset.id;
    if (target.classList.contains('edit-qual-btn')) {
        const qual = availableQualifications.find(q => q.id === qualId);
        if (qual) {
            document.getElementById('editQualId').value = qual.id;
            document.getElementById('editQualName').value = qual.name;
            editQualificationModalElement.style.display = 'block';
        }
    } else if (target.classList.contains('delete-qual-btn')) {
        displayMessageModal('Confirmer la suppression', 'Voulez-vous vraiment supprimer cette qualification ? Elle sera retirée de tous les agents qui la possèdent.', 'question', async (confirmed) => {
            if (confirmed) {
                await deleteQualification(qualId);
            }
        });
    }
}

async function handleEditQualification(event) {
    event.preventDefault();
    const id = document.getElementById('editQualId').value;
    const name = document.getElementById('editQualName').value.trim();
    try {
        const response = await fetch(`${API_BASE_URL}/api/qualifications/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionStorage.getItem('jwtToken')}`
            },
            body: JSON.stringify({ name })
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Échec de la mise à jour de la qualification.');
        }
        displayMessageModal('Succès', 'Qualification mise à jour avec succès.', 'success');
        editQualificationModalElement.style.display = 'none';
        await fetchQualifications();
        await fetchAndRenderAgents(); // Rafraîchir la liste des agents
    } catch (error) {
        console.error('Erreur lors de la mise à jour de la qualification:', error);
        displayMessageModal('Erreur', error.message, 'error');
    }
}

async function deleteQualification(id) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/qualifications/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${sessionStorage.getItem('jwtToken')}`
            }
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Échec de la suppression de la qualification.');
        }
        displayMessageModal('Succès', 'Qualification supprimée avec succès.', 'success');
        await fetchQualifications();
        await fetchAndRenderAgents(); // Rafraîchir la liste des agents
    } catch (error) {
        console.error('Erreur lors de la suppression de la qualification:', error);
        displayMessageModal('Erreur', error.message, 'error');
    }
}

// --- Fonctions de gestion des Grades ---

async function fetchGrades() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/grades`, {
            headers: { 'Authorization': `Bearer ${sessionStorage.getItem('jwtToken')}` }
        });
        if (!response.ok) throw new Error('Failed to fetch grades');
        availableGrades = await response.json();
        renderGradesTable(availableGrades);
        // Mettre à jour les checkboxes d'ajout d'agent
        renderCheckboxes(newAgentGradesCheckboxes, availableGrades, 'newAgentGrade');
    } catch (error) {
        console.error('Error fetching grades:', error);
        displayMessageModal('Erreur', 'Impossible de charger la liste des grades.', 'error');
    }
}

function renderGradesTable(grades) {
    gradesTableBody.innerHTML = '';
    grades.forEach(g => {
        const row = gradesTableBody.insertRow();
        row.dataset.gradeId = g.id;
        row.innerHTML = `
            <td>${g.name}</td>
            <td>${g.id}</td>
            <td>
                <button class="btn btn-sm btn-secondary edit-grade-btn" data-id="${g.id}">Modifier</button>
                <button class="btn btn-sm btn-danger delete-grade-btn" data-id="${g.id}">Supprimer</button>
            </td>
        `;
    });
}

async function handleAddGrade(event) {
    event.preventDefault();
    const id = document.getElementById('newGradeId').value.trim();
    const name = document.getElementById('newGradeName').value.trim();
    try {
        const response = await fetch(`${API_BASE_URL}/api/grades`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionStorage.getItem('jwtToken')}`
            },
            body: JSON.stringify({ id, name })
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Échec de l\'ajout du grade.');
        }
        displayMessageModal('Succès', 'Grade ajouté avec succès.', 'success');
        addGradeFormElement.reset();
        await fetchGrades();
        await fetchAndRenderAgents(); // Rafraîchir la liste des agents
    } catch (error) {
        console.error('Erreur lors de l\'ajout du grade:', error);
        displayMessageModal('Erreur', error.message, 'error');
    }
}

async function handleGradeActions(event) {
    const target = event.target;
    const gradeId = target.dataset.id;
    if (target.classList.contains('edit-grade-btn')) {
        const grade = availableGrades.find(g => g.id === gradeId);
        if (grade) {
            document.getElementById('editGradeId').value = grade.id;
            document.getElementById('editGradeName').value = grade.name;
            editGradeModalElement.style.display = 'block';
        }
    } else if (target.classList.contains('delete-grade-btn')) {
        displayMessageModal('Confirmer la suppression', 'Voulez-vous vraiment supprimer ce grade ? Il sera retiré de tous les agents qui le possèdent.', 'question', async (confirmed) => {
            if (confirmed) {
                await deleteGrade(gradeId);
            }
        });
    }
}

async function handleEditGrade(event) {
    event.preventDefault();
    const id = document.getElementById('editGradeId').value;
    const name = document.getElementById('editGradeName').value.trim();
    try {
        const response = await fetch(`${API_BASE_URL}/api/grades/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionStorage.getItem('jwtToken')}`
            },
            body: JSON.stringify({ name })
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Échec de la mise à jour du grade.');
        }
        displayMessageModal('Succès', 'Grade mis à jour avec succès.', 'success');
        editGradeModalElement.style.display = 'none';
        await fetchGrades();
        await fetchAndRenderAgents(); // Rafraîchir la liste des agents
    } catch (error) {
        console.error('Erreur lors de la mise à jour du grade:', error);
        displayMessageModal('Erreur', error.message, 'error');
    }
}

async function deleteGrade(id) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/grades/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${sessionStorage.getItem('jwtToken')}`
            }
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Échec de la suppression du grade.');
        }
        displayMessageModal('Succès', 'Grade supprimé avec succès.', 'success');
        await fetchGrades();
        await fetchAndRenderAgents(); // Rafraîchir la liste des agents
    } catch (error) {
        console.error('Erreur lors de la suppression du grade:', error);
        displayMessageModal('Erreur', error.message, 'error');
    }
}

// --- Fonctions de gestion des Fonctions ---

async function fetchFunctions() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/functions`, {
            headers: { 'Authorization': `Bearer ${sessionStorage.getItem('jwtToken')}` }
        });
        if (!response.ok) throw new Error('Failed to fetch functions');
        availableFunctions = await response.json();
        renderFunctionsTable(availableFunctions);
        // Mettre à jour les checkboxes d'ajout d'agent
        renderCheckboxes(newAgentFunctionsCheckboxes, availableFunctions, 'newAgentFunction');
    } catch (error) {
        console.error('Error fetching functions:', error);
        displayMessageModal('Erreur', 'Impossible de charger la liste des fonctions.', 'error');
    }
}

function renderFunctionsTable(functions) {
    functionsTableBody.innerHTML = '';
    functions.forEach(f => {
        const row = functionsTableBody.insertRow();
        row.dataset.functionId = f.id;
        row.innerHTML = `
            <td>${f.name}</td>
            <td>${f.id}</td>
            <td>
                <button class="btn btn-sm btn-secondary edit-func-btn" data-id="${f.id}">Modifier</button>
                <button class="btn btn-sm btn-danger delete-func-btn" data-id="${f.id}">Supprimer</button>
            </td>
        `;
    });
}

async function handleAddFunction(event) {
    event.preventDefault();
    const id = document.getElementById('newFunctionId').value.trim();
    const name = document.getElementById('newFunctionName').value.trim();
    try {
        const response = await fetch(`${API_BASE_URL}/api/functions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionStorage.getItem('jwtToken')}`
            },
            body: JSON.stringify({ id, name })
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Échec de l\'ajout de la fonction.');
        }
        displayMessageModal('Succès', 'Fonction ajoutée avec succès.', 'success');
        addFunctionFormElement.reset();
        await fetchFunctions();
        await fetchAndRenderAgents(); // Rafraîchir la liste des agents
    } catch (error) {
        console.error('Erreur lors de l\'ajout de la fonction:', error);
        displayMessageModal('Erreur', error.message, 'error');
    }
}

async function handleFunctionActions(event) {
    const target = event.target;
    const funcId = target.dataset.id;
    if (target.classList.contains('edit-func-btn')) {
        const func = availableFunctions.find(f => f.id === funcId);
        if (func) {
            document.getElementById('editFunctionId').value = func.id;
            document.getElementById('editFunctionName').value = func.name;
            editFunctionModalElement.style.display = 'block';
        }
    } else if (target.classList.contains('delete-func-btn')) {
        displayMessageModal('Confirmer la suppression', 'Voulez-vous vraiment supprimer cette fonction ? Elle sera retirée de tous les agents qui la possèdent.', 'question', async (confirmed) => {
            if (confirmed) {
                await deleteFunction(funcId);
            }
        });
    }
}

async function handleEditFunction(event) {
    event.preventDefault();
    const id = document.getElementById('editFunctionId').value;
    const name = document.getElementById('editFunctionName').value.trim();
    try {
        const response = await fetch(`${API_BASE_URL}/api/functions/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionStorage.getItem('jwtToken')}`
            },
            body: JSON.stringify({ name })
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Échec de la mise à jour de la fonction.');
        }
        displayMessageModal('Succès', 'Fonction mise à jour avec succès.', 'success');
        editFunctionModalElement.style.display = 'none';
        await fetchFunctions();
        await fetchAndRenderAgents(); // Rafraîchir la liste des agents
    } catch (error) {
        console.error('Erreur lors de la mise à jour de la fonction:', error);
        displayMessageModal('Erreur', error.message, 'error');
    }
}

async function deleteFunction(id) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/functions/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${sessionStorage.getItem('jwtToken')}`
            }
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Échec de la suppression de la fonction.');
        }
        displayMessageModal('Succès', 'Fonction supprimée avec succès.', 'success');
        await fetchFunctions();
        await fetchAndRenderAgents(); // Rafraîchir la liste des agents
    } catch (error) {
        console.error('Erreur lors de la suppression de la fonction:', error);
        displayMessageModal('Erreur', error.message, 'error');
    }
}


// Fonctions utilitaires pour les checkboxes de qualifications/grades/fonctions
function renderCheckboxes(container, items, namePrefix) {
    container.innerHTML = '';
    items.forEach(item => {
        const div = document.createElement('div');
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.id = `${namePrefix}-${item.id}`;
        input.name = namePrefix;
        input.value = item.id;
        const label = document.createElement('label');
        label.htmlFor = `${namePrefix}-${item.id}`;
        label.textContent = item.name;
        div.appendChild(input);
        div.appendChild(label);
        container.appendChild(div);
    });
}

// --- Fonctions d'exportation PDF ---
function exportPlanningToPdf() {
    const planningSection = document.querySelector('.planning-section'); // Section du planning à exporter
    
    // Options de html2canvas (vous pouvez ajuster)
    const options = {
        scale: 2, // Augmente la résolution
        useCORS: true, // Important si des images/ressources proviennent d'autres origines
        allowTaint: true, // Permet de capturer des éléments avec des origines différentes
        ignoreElements: (element) => {
            // Ignorer les éléments spécifiques si nécessaire
            // Ne pas ignorer les cellules de noms car elles sont essentielles
            // Revertir temporairement les styles sticky est la meilleure approche.
            return false; 
        }
    };

    // Temporairement masquer les éléments sticky pour ne pas les dupliquer ou les déformer dans le PDF
    const stickyHeaders = document.querySelectorAll('.sticky-header-cell, .sticky-day-name, .agent-name-slot-cell');
    stickyHeaders.forEach(el => {
        el.style.position = 'static';
        el.style.left = 'auto';
        el.style.top = 'auto';
        el.style.zIndex = 'auto';
        el.style.width = 'auto'; // Réinitialiser la largeur
        el.style.minWidth = 'auto'; // Réinitialiser min-width
        el.style.maxWidth = 'auto'; // Réinitialiser max-width
        el.style.flexShrink = '0'; // Assurez-vous qu'ils ne se réduisent pas
    });

    html2canvas(planningSection, options).then(canvas => {
        // Restaurer les styles sticky
        stickyHeaders.forEach(el => {
            el.style.position = ''; // Revert to original CSS
            el.style.left = '';
            el.style.top = '';
            el.style.zIndex = '';
            el.style.width = '';
            el.style.minWidth = '';
            el.style.maxWidth = '';
            el.style.flexShrink = '';
        });

        const imgData = canvas.toDataURL('image/png');
        const { jsPDF } = window.jspdf; // Accéder à jspdf via window

        const pdf = new jsPDF('landscape', 'mm', 'a4'); // Paysage, mm, A4
        const imgWidth = 280; // Largeur pour A4 en paysage (297mm - marges)
        const pageHeight = 200; // Hauteur pour A4 en paysage (210mm - marges)
        const imgHeight = canvas.height * imgWidth / canvas.width;
        let heightLeft = imgHeight;

        let position = 0;

        pdf.addImage(imgData, 'PNG', 5, 5 + position, imgWidth, imgHeight);
        heightLeft -= pageHeight;

        while (heightLeft >= 0) {
            position = heightLeft - imgHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', 5, 5 + position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
        }
        
        pdf.save(`planning_global_semaine_${currentWeek}_${currentYear}.pdf`);
        displayMessageModal('Exportation PDF', 'Le planning a été exporté en PDF.', 'info');
    }).catch(error => {
        console.error('Erreur lors de la création du PDF :', error);
        displayMessageModal('Erreur', 'Impossible d\'exporter le planning en PDF. Veuillez réessayer.', 'error');
        // Restaurer les styles sticky même en cas d'erreur
        stickyHeaders.forEach(el => {
            el.style.position = ''; 
            el.style.left = '';
            el.style.top = '';
            el.style.zIndex = '';
            el.style.width = '';
            el.style.minWidth = '';
            el.style.maxWidth = '';
            el.style.flexShrink = '';
        });
    });
}

// --- Déconnexion ---
function logout() {
    sessionStorage.removeItem('jwtToken');
    sessionStorage.removeItem('agent'); // Supprimer aussi les infos de l'agent
    window.location.href = 'login.html'; // Rediriger vers la page de connexion
}
