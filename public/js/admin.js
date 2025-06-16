const days = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const API_BASE_URL = "https://dispo-pompier.onrender.com";

let currentWeek; // Ex: 25 (number)
let currentDay = 'lundi'; // Jour actuel par défaut pour le planning
let planningData = {}; // Contiendra le planning global chargé de l'API { agentId: { week-X: { day: [slots] } } }
let agentDisplayInfos = {}; // Mapping dynamique agentId => {nom, prenom}
let availableQualifications = []; // Liste des qualifications disponibles chargée depuis l'API
let availableGrades = []; // Nouvelle: Liste des grades disponibles chargée depuis l'API

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

// --- DOM Elements pour la vue "Gestion des Agents" ---
const addAgentForm = document.getElementById('addAgentForm');
const newAgentQualificationsCheckboxes = document.getElementById('newAgentQualificationsCheckboxes');
const newAgentGradesCheckboxes = document.getElementById('newAgentGradesCheckboxes'); 
const addAgentMessage = document.getElementById('addAgentMessage');
const agentsTableBody = document.getElementById('agentsTableBody');
const listAgentsMessage = document.getElementById('listAgentsMessage');

// --- DOM Elements pour la Modale de modification d'agent et de qualifications ---
const editAgentModalElement = document.getElementById('editAgentModal'); 
const closeEditAgentModalButton = editAgentModalElement ? editAgentModalElement.querySelector('.close-button') : null; 
const editAgentFormElement = document.getElementById('editAgentForm'); 
const editAgentId = document.getElementById('editAgentId');
const editAgentNom = document.getElementById('editAgentNom');
const editAgentPrenom = document.getElementById('editAgentPrenom');
const editAgentNewPassword = document.getElementById('editAgentNewPassword');
const editAgentMessage = document.getElementById('editAgentMessage');
const qualificationsCheckboxesDiv = document.getElementById('qualificationsCheckboxes'); // Pour la modale de modification
const gradesCheckboxesDiv = document.getElementById('gradesCheckboxes'); // Pour la modale de modification
const qualificationsMessage = document.getElementById('qualificationsMessage'); 
const gradesMessage = document.getElementById('gradesMessage'); 


// --- DOM Elements pour la vue "Gestion des Qualifications" ---
const addQualificationFormElement = document.getElementById('addQualificationForm'); 
const addQualificationMessage = document.getElementById('addQualificationMessage');
const qualificationsTableBody = document.getElementById('qualificationsTableBody');
const listQualificationsMessage = document.getElementById('listQualificationsMessage');
const editQualificationModalElement = document.getElementById('editQualificationModal'); 
const closeQualButton = editQualificationModalElement ? editQualificationModalElement.querySelector('.close-button') : null;
const editQualificationFormElement = document.getElementById('editQualificationForm'); 
const editQualId = document.getElementById('editQualId');
const editQualName = document.getElementById('editQualName');
const editQualMessage = document.getElementById('editQualMessage');

// --- DOM Elements pour la vue "Gestion des Grades" ---
const addGradeFormElement = document.getElementById('addGradeForm'); 
const addGradeMessage = document.getElementById('addGradeMessage');
const gradesTableBody = document.getElementById('gradesTableBody');
const listGradesMessage = document.getElementById('listGradesMessage');
const editGradeModalElement = document.getElementById('editGradeModal'); 
const closeGradeButton = editGradeModalElement ? editGradeModalElement.querySelector('.close-button') : null;
const editGradeFormElement = document.getElementById('editGradeForm'); 
const editGradeId = document.getElementById('editGradeId');
const editGradeName = document.getElementById('editGradeName');
const editGradeMessage = document.getElementById('editGradeMessage');

// --- Global DOM Elements ---
const loadingSpinner = document.getElementById("loading-spinner");
const logoutButton = document.getElementById("logout-btn");


// Créneaux 30 min sur 24h
const horaires = [];
const startHourDisplay = 7;
for (let i = 0; i < 48; i++) {
  const currentSlotHour = (startHourDisplay + Math.floor(i / 2)) % 24;
  const currentSlotMinute = (i % 2) * 30;
  const endSlotHour = (startHourDisplay + Math.floor((i + 1) / 2)) % 24;
  const endSlotMinute = ((i + 1) % 2) * 30;
  const start = `${String(currentSlotHour).padStart(2, '0')}:${String(currentSlotMinute).padStart(2, '0')}`;
  const end = `${String(endSlotHour).padStart(2, '0')}:${String(endSlotMinute).padStart(2, '0')}`;
  horaires.push(`${start} - ${end}`);
}

// --- Helpers de date ---

/**
 * Calcule le numéro de semaine ISO 8601 pour une date donnée.
 * La semaine 1 est celle qui contient le premier jeudi de l'année.
 * @param {Date} date - La date pour laquelle calculer le numéro de semaine.
 * @returns {number} Le numéro de semaine ISO 8601.
 */
function getCurrentISOWeek(date = new Date()) {
    const _date = new Date(date.getTime());
    _date.setHours(0, 0, 0, 0);
    _date.setDate(_date.getDate() + 3 - ((_date.getDay() + 6) % 7));
    const week1 = new Date(_date.getFullYear(), 0, 4);
    return (
        1 +
        Math.round(
            ((_date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7
        )
    );
}

/**
 * Récupère la plage de dates (début-fin) pour un numéro de semaine ISO donné.
 * @param {number} weekNumber - Le numéro de semaine ISO.
 * @param {number} year - L'année.
 * @returns {string} La plage de dates formatée (ex: "du 16/06 au 22/06").
 */
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
  const format = date => date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
  return `du ${format(start)} au ${format(end)}`;
}


function getMondayOfWeek(weekNum, year) {
    const simple = new Date(year, 0, 1 + (weekNum - 1) * 7);
    const dow = simple.getDay();
    if (dow <= 4) simple.setDate(simple.getDate() - dow + 1);
    else simple.setDate(simple.getDate() + 8 - dow);
    return simple;
}

// --- Fonctions de chargement des données ---

async function fetchAgentNames() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/agents/names`);
        const data = await response.json();
        if (response.ok) {
            agentDisplayInfos = data.reduce((acc, agent) => {
                acc[agent.id] = { prenom: agent.prenom, nom: agent.nom };
                return acc;
            }, {});
        } else {
            console.error('Erreur lors du chargement des noms d\'agents:', data.message);
        }
    } catch (error) {
        console.error('Erreur réseau lors du chargement des noms d\'agents:', error);
    }
}

async function loadPlanningData() {
    showLoading(true);
    try {
        // Cette route /api/planning est maintenant modifiée côté serveur pour agréger les données
        // par semaine et par jour à partir de AGENT_AVAILABILITY_DIR
        const response = await fetch(`${API_BASE_URL}/api/planning`); 
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Erreur lors du chargement du planning global.');

        planningData = data; 
        console.log("Planning Global Chargé:", planningData);

        await fetchAgentNames();
    } catch (error) {
        console.error('Erreur lors du chargement du planning global:', error);
        planningData = {}; // S'assure que c'est un objet vide en cas d'échec
        displayMessageModal("Erreur de Chargement", `Impossible de charger le planning global : ${error.message}`, "error");
    } finally {
        showLoading(false);
    }
}

// --- Fonctions de rendu ---

function renderPlanningGrid(day) {
    if (!planningContainer) return;
    planningContainer.innerHTML = ''; // Efface le contenu précédent

    const table = document.createElement('table');
    table.classList.add('global-planning-table');

    // En-tête (Créneaux Horaires)
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headerRow.innerHTML = '<th>Agent</th>'; // Première colonne pour le Nom de l'Agent

    // Réécrire les heures avec un format plus propre si nécessaire, et s'assurer de l'alignement
    horaires.forEach(slot => {
        const th = document.createElement('th');
        // Afficher seulement l'heure de début
        th.textContent = slot.split(' - ')[0]; 
        th.classList.add('time-header-cell'); // Ajout d'une classe pour le style
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Corps (Lignes d'agents)
    const tbody = document.createElement('tbody');
    
    const weekKey = `week-${currentWeek}`;

    // Filtrer les agents pour n'afficher que ceux ayant au moins un créneau renseigné pour le jour et la semaine actuels
    const filteredAgentIds = Object.keys(agentDisplayInfos).filter(agentId => {
        const agentPlanningForDay = planningData[agentId]?.[weekKey]?.[day];
        // L'agent est affiché si :
        // 1. Il a une entrée de planning pour la semaine et le jour, ET
        // 2. Cette entrée est un tableau, ET
        // 3. Ce tableau n'est pas vide (il contient au moins un créneau)
        return Array.isArray(agentPlanningForDay) && agentPlanningForDay.length > 0;
    }).sort((a, b) => {
        // Trie les agents par nom/prénom pour un affichage cohérent
        const nameA = agentDisplayInfos[a]?.nom || '';
        const nameB = agentDisplayInfos[b]?.nom || '';
        return nameA.localeCompare(nameB);
    });

    if (filteredAgentIds.length === 0) {
        const noAgentsRow = document.createElement('tr');
        noAgentsRow.innerHTML = `<td colspan="${horaires.length + 1}">Aucun agent avec des disponibilités renseignées pour ce jour de la semaine.</td>`;
        tbody.appendChild(noAgentsRow);
    } else {
        filteredAgentIds.forEach(agentId => {
            const agentRow = document.createElement('tr');
            const agentNameCell = document.createElement('td');
            agentNameCell.classList.add('agent-name-cell');

            const agentInfo = agentDisplayInfos[agentId];
            agentNameCell.textContent = `${agentInfo.prenom} ${agentInfo.nom}`;
            agentRow.appendChild(agentNameCell);

            const agentSpecificDayPlanning = planningData[agentId]?.[weekKey]?.[day];

            horaires.forEach(timeSlot => {
                const slotCell = document.createElement('td');
                slotCell.classList.add('time-slot-cell');
                slotCell.setAttribute("data-time", timeSlot);
                
                if (agentSpecificDayPlanning && agentSpecificDayPlanning.includes(timeSlot)) {
                    slotCell.classList.add('available-slot-cell'); // Classe pour disponible (vert)
                } else {
                    slotCell.classList.add('unavailable-slot-cell'); // Classe pour indisponible (gris/rouge pâle)
                }
                // Suppression du texte 'D' ou 'I' - la couleur suffit
                // slotCell.textContent = ''; 
                agentRow.appendChild(slotCell);
            });
            tbody.appendChild(agentRow);
        });
    }
    table.appendChild(tbody);
    planningContainer.appendChild(table);

    // Réinitialise le message d'info si tout va bien
    adminInfo.textContent = "Vue du planning global des agents.";
    adminInfo.style.backgroundColor = "";
    adminInfo.style.borderColor = "";
    adminInfo.style.color = "";
}

// Fonction pour mettre à jour l'affichage de la plage de dates
function updateDateRangeDisplay() {
    const weekNum = currentWeek; 
    const currentYear = new Date().getFullYear(); 
    dateRangeDisplay.textContent = getWeekDateRange(weekNum, currentYear);
}

// --- Fonctions de contrôle et d'initialisation ---

function generateWeekOptions() {
    const select = document.getElementById("week-select");
    select.innerHTML = "";
    const today = new Date();
    const currentWeekNumber = getCurrentISOWeek(today);
    const currentYear = today.getFullYear();
    for (let i = -2; i < 10; i++) { // Génère quelques semaines passées et futures
        const weekNum = currentWeekNumber + i;
        const option = document.createElement("option");
        option.value = `week-${weekNum}`;
        option.textContent = `Semaine ${weekNum} (${getWeekDateRange(weekNum, currentYear)})`;
        select.appendChild(option);
    }
}

function showLoading(isLoading, forPdf = false) {
    if (isLoading) {
        loadingSpinner.classList.remove("hidden");
        // Désactiver les contrôles globaux et ceux de l'onglet actif
        document.querySelectorAll('button, select, input, a').forEach(el => {
            if (el.id !== 'logout-btn') { // Ne pas désactiver le bouton de déconnexion
                el.disabled = true;
                if (el.tagName === 'A') el.classList.add('disabled-link'); // Ajoute une classe pour les liens
            }
        });
        // Pour les boutons principaux d'onglet, on peut les désactiver aussi
        mainTabButtons.forEach(btn => btn.disabled = true);

        if (forPdf) {
            adminInfo.textContent = "Génération du PDF en cours, veuillez patienter...";
            adminInfo.style.backgroundColor = "#fff3cd";
            adminInfo.style.borderColor = "#ffeeba";
            adminInfo.style.color = "#856404";
        }
    } else {
        loadingSpinner.classList.add("hidden");
        // Réactiver les contrôles globaux et ceux de l'onglet actif
        document.querySelectorAll('button, select, input, a').forEach(el => {
            if (el.id !== 'logout-btn') {
                el.disabled = false;
                if (el.tagName === 'A') el.classList.remove('disabled-link');
            }
        });
        mainTabButtons.forEach(btn => btn.disabled = false);


        if (forPdf) {
            adminInfo.textContent = "Vue du planning global des agents.";
            adminInfo.style.backgroundColor = "";
            adminInfo.style.borderColor = "";
            adminInfo.style.color = "";
        }
    }
}

// --- Fonctions d'authentification et de déconnexion ---
function logout() {
    sessionStorage.clear();
    window.location.href = "index.html";
}

// --- Modales (remplace alert() et confirm()) ---
/**
 * Affiche une modale de message personnalisée.
 * @param {string} title - Titre de la modale.
 * @param {string} message - Message à afficher.
 * @param {'info'|'success'|'error'|'warning'|'question'} type - Type de message pour le style.
 * @param {function(boolean)} [callback] - Fonction de rappel pour les confirmations.
 */
function displayMessageModal(title, message, type = "info", callback = null) {
    let modal = document.getElementById('message-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'message-modal';
        modal.classList.add('custom-modal', 'message-modal');
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="modal-content ${type}">
            <h2 class="modal-title">${title}</h2>
            <p class="modal-message">${message}</p>
            <div class="modal-actions">
                ${callback ? '<button id="modal-cancel-btn" class="btn btn-secondary">Annuler</button>' : ''}
                <button id="modal-ok-btn" class="btn btn-primary">OK</button>
            </div>
        </div>
    `;

    modal.style.display = 'flex';

    const okBtn = modal.querySelector('#modal-ok-btn');
    okBtn.onclick = () => {
        modal.style.display = 'none';
        if (callback) callback(true);
    };

    if (callback) {
        const cancelBtn = modal.querySelector('#modal-cancel-btn');
        cancelBtn.onclick = () => {
            modal.style.display = 'none';
            callback(false);
        };
    }

    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
            if (callback) callback(false); // Cliquer en dehors annule pour les confirmations
        }
    };
}

/**
 * Fonction asynchrone pour simuler confirm() avec la modale personnalisée.
 * @param {string} message - Message de confirmation.
 * @returns {Promise<boolean>} Une promesse qui résout avec true si l'utilisateur confirme, false sinon.
 */
async function confirmModal(message) {
    return new Promise((resolve) => {
        displayMessageModal("Confirmation", message, "question", (result) => {
            resolve(result);
        });
    });
}

// Remplacement des fonctions natives alert et confirm pour utiliser les modales personnalisées
window.alert = displayMessageModal.bind(null, "Information");
window.confirm = confirmModal;


// --- Initialisation au chargement du DOM ---
document.addEventListener("DOMContentLoaded", async () => {
    const userRole = sessionStorage.getItem("userRole");
    if (!userRole || userRole !== "admin") {
        displayMessageModal("Accès non autorisé", "Vous devez être connecté en tant qu’administrateur.", "error", () => {
            sessionStorage.clear();
            window.location.href = "index.html";
        });
        return;
    }

    // --- Initialisation des onglets principaux ---
    mainTabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTabId = button.dataset.mainTab;
            openMainTab(targetTabId);
        });
    });

    // --- Initialisation des onglets de jour pour le planning global ---
    tabButtons.forEach(tab => {
        tab.addEventListener("click", () => {
            const day = tab.dataset.day;
            showDay(day);
        });
    });

    // --- Initialisation des fonctionnalités par défaut de la page ---
    // Charger la liste des qualifications, grades et fonctions disponibles en premier
    await loadAvailableQualifications();
    await loadAvailableGrades(); 

    // Rendre les checkboxes pour le formulaire d'ajout d'agent après le chargement des données
    renderNewAgentQualificationsCheckboxes();
    renderNewAgentGradesCheckboxes(); 

    // Définir la semaine actuelle par défaut AVANT de charger les données pour que le sélecteur soit correct
    currentWeek = getCurrentISOWeek(new Date());
    // Générer les options du sélecteur de semaine
    generateWeekOptions();


    // Charger les données initiales du planning global
    await loadPlanningData(); // Ceci appellera updateWeekSelector interne

    // S'assurer que le sélecteur de semaine affiche la semaine actuelle par défaut
    const currentWeekAsString = `week-${currentWeek}`;
    if (weekSelect) {
        weekSelect.value = currentWeekAsString;
    }

    // Ouvrir l'onglet "Planning Global" par default au chargement
    await openMainTab('global-planning-view'); 

    // --- Écouteurs d'événements pour les contrôles du planning global ---
    if (weekSelect) {
        weekSelect.addEventListener("change", async () => {
            currentWeek = parseInt(weekSelect.value.split('-')[1]); 
            updateDateRangeDisplay(); 
            await loadPlanningData(); 
            showDay(currentDay); 
        });
    }
    if (document.getElementById("export-pdf")) {
        document.getElementById("export-pdf").addEventListener("click", exportPdf);
    }

    // --- Écouteurs d'événements pour la vue "Gestion des Agents" ---
    if (addAgentForm) {
        addAgentForm.addEventListener('submit', handleAddAgent);
    }
    if (agentsTableBody) {
        agentsTableBody.addEventListener('click', handleAgentActions);
    }

    // --- Écouteurs d'événements pour la Modale de modification d'agent ---
    if (closeEditAgentModalButton) { 
        closeEditAgentModalButton.addEventListener('click', () => { 
            editAgentModalElement.style.display = 'none'; 
        });
    }
    window.addEventListener('click', (event) => {
        if (event.target == editAgentModalElement) { 
            editAgentModalElement.style.display = 'none'; 
        }
    });
    if (editAgentFormElement) { 
        editAgentFormElement.addEventListener('submit', handleEditAgent); 
    }

    // --- Écouteurs d'événements pour la vue "Gestion des Qualifications" ---
    if (addQualificationFormElement) { 
        addQualificationFormElement.addEventListener('submit', handleAddQualification); 
    }
    if (qualificationsTableBody) {
        qualificationsTableBody.addEventListener('click', handleQualificationActions);
    }
    if (closeQualButton) {
        closeQualButton.addEventListener('click', () => {
            editQualificationModalElement.style.display = 'none'; 
        });
    }
    if (editQualificationFormElement) { 
        editQualificationFormElement.addEventListener('submit', handleEditQualification); 
    }

    // --- Écouteurs d'événements pour la vue "Gestion des Grades" ---
    if (addGradeFormElement) { 
        addGradeFormElement.addEventListener('submit', handleAddGrade); 
    }
    if (gradesTableBody) {
        gradesTableBody.addEventListener('click', handleGradeActions);
    }
    if (closeGradeButton) {
        closeGradeButton.addEventListener('click', () => {
            editGradeModalElement.style.display = 'none'; 
        });
    }
    if (editGradeFormElement) { 
        editGradeFormElement.addEventListener('submit', handleEditGrade); 
    }

    // --- Écouteur pour la déconnexion ---
    if (logoutButton) {
        logoutButton.addEventListener("click", logout);
    }
});


// --- Fonctions de gestion des onglets principaux (Planning Global / Gestion Agents / Gestion Qualifications / Gestion Grades) ---
async function openMainTab(tabId) {
    mainTabContents.forEach(tab => {
        tab.classList.remove('active');
    });
    mainTabButtons.forEach(button => {
        button.classList.remove('active');
    });

    document.getElementById(tabId).classList.add('active');
    document.querySelector(`.main-tab[data-main-tab="${tabId}"]`).classList.add('active');

    // Gérer la visibilité des contrôles spécifiques au planning
    if (tabId === 'global-planning-view') {
        planningControls.style.display = 'flex'; 
        showDay(currentDay); 
    } else {
        planningControls.style.display = 'none'; 
        if (tabId === 'agent-management-view') {
            await loadAgents(); 
        } else if (tabId === 'qualification-management-view') {
            await loadQualificationsList();
        } else if (tabId === 'grade-management-view') {
            await loadGradesList();
        }
    }
}


// --- Fonctions de gestion du Planning Global ---

async function loadPlanningAndDisplay() {
    showLoading(true);
    try {
        const res = await fetch(`${API_BASE_URL}/api/planning`);
        if (!res.ok) {
            if (res.status === 404) {
                console.warn("Aucun planning global trouvé (404), initialisation à vide.");
                planningData = {};
            } else {
                throw new Error(`Erreur chargement planning global: HTTP ${res.status}`);
            }
        }
        planningData = await res.json() || {};

        const agentsResponse = await fetch(`${API_BASE_URL}/api/admin/agents`, {
            headers: { 'X-User-Role': 'admin' }
        });
        const agentsData = await agentsResponse.json();
        agentDisplayInfos = {};
        agentsData.forEach(agent => {
            agentDisplayInfos[agent._id] = { nom: agent.nom, prenom: agent.prenom };
        });

        const allWeeksSet = new Set();
        for (const agentKey in planningData) {
            if (!agentDisplayInfos[agentKey]) {
                console.warn(`Agent avec la clé '${agentKey}' trouvé dans /api/planning mais pas dans la liste des agents ou non mappable.`);
                continue; 
            }
            const weeks = Object.keys(planningData[agentKey]);
            weeks.forEach(w => allWeeksSet.add(w));
        }

        if (allWeeksSet.size === 0) {
            allWeeksSet.add(`week-${getCurrentISOWeek()}`); 
        }

        updateWeekSelector(allWeeksSet); 

    } catch (e) {
        console.error("Erreur lors du chargement ou de l'affichage du planning :", e);
        adminInfo.textContent = "Erreur lors du chargement du planning global. Veuillez réessayer.";
        adminInfo.style.backgroundColor = "#ffe6e6";
        adminInfo.style.borderColor = "#e6a4a4";
        adminInfo.style.color = "#a94442";
        planningData = {}; 
    } finally {
        showLoading(false);
    }
}

function updateWeekSelector(availableWeeks) {
    weekSelect.innerHTML = "";
    const sortedWeeks = Array.from(availableWeeks).sort((a, b) => {
        return parseInt(a.split("-")[1]) - parseInt(b.split("-")[1]);
    });

    sortedWeeks.forEach(weekKey => {
        const opt = document.createElement("option");
        opt.value = weekKey;
        const weekNum = parseInt(weekKey.split("-")[1]);
        const dateRange = getWeekDateRange(weekNum);
        opt.textContent = `Semaine ${weekNum} (${dateRange})`;
        weekSelect.appendChild(opt);
    });

    // Sélectionne la semaine actuelle par défaut
    const currentWeekAsString = `week-${getCurrentISOWeek()}`;
    if (sortedWeeks.includes(currentWeekAsString)) {
        weekSelect.value = currentWeekAsString;
        currentWeek = getCurrentISOWeek(); // Assurer que currentWeek est bien à jour
    } else if (sortedWeeks.length > 0) {
        weekSelect.value = sortedWeeks[0];
        currentWeek = parseInt(sortedWeeks[0].split("-")[1]);
    } else {
        // Si aucune semaine n'est disponible (aucun planning), ajoute la semaine actuelle
        const currentWeekKeyDefault = `week-${getCurrentISOWeek()}`;
        const opt = document.createElement("option");
        opt.value = currentWeekKeyDefault;
        const dateRange = getWeekDateRange(getCurrentISOWeek());
        opt.textContent = `Semaine ${getCurrentISOWeek()} (${dateRange})`;
        weekSelect.appendChild(opt);
        weekSelect.value = currentWeekKeyDefault;
        currentWeek = getCurrentISOWeek();
    }

    updateDateRangeDisplay(); 
}

function showDay(day) {
    currentDay = day;
    tabButtons.forEach(tab => {
        tab.classList.toggle("active", tab.dataset.day === day);
    });

    planningContainer.innerHTML = ""; 

    const table = document.createElement("table");
    table.className = "planning-table";

    // Header (créneaux horaires)
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");

    const thAgent = document.createElement("th");
    thAgent.textContent = "Agent";
    thAgent.classList.add('agent-header-cell'); // Ajout d'une classe pour le style
    headerRow.appendChild(thAgent);

    horaires.forEach(slotString => { 
        const th = document.createElement("th");
        th.textContent = slotString.split(' - ')[0]; // Affiche seulement l'heure de début (ex: "07:00")
        th.classList.add('time-header-cell'); // Ajout d'une classe pour le style
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Body (planning par agent)
    const tbody = document.createElement("tbody");

    const weekKey = `week-${currentWeek}`;

    const filteredAgentIds = Object.keys(agentDisplayInfos).filter(agentId => {
        const agentPlanningForDay = planningData[agentId]?.[weekKey]?.[day];
        return Array.isArray(agentPlanningForDay) && agentPlanningForDay.length > 0;
    }).sort((a, b) => {
        const nameA = agentDisplayInfos[a]?.nom || '';
        const nameB = agentDisplayInfos[b]?.nom || '';
        return nameA.localeCompare(nameB);
    });


    if (filteredAgentIds.length === 0) {
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = 1 + horaires.length; 
        td.textContent = "Aucun agent avec des disponibilités renseignées pour ce jour de la semaine.";
        tr.appendChild(td);
        tbody.appendChild(tr);
    } else {
        filteredAgentIds.forEach(agentId => {
            const agentSpecificDayPlanning = planningData[agentId]?.[weekKey]?.[day]; 
            const agentInfo = agentDisplayInfos[agentId]; 

            const tr = document.createElement("tr");
            const tdAgent = document.createElement("td");
            tdAgent.classList.add('agent-name-cell'); // Ajout d'une classe pour le style
            if (agentInfo) {
                tdAgent.textContent = `${agentInfo.prenom} ${agentInfo.nom}`; 
            } else {
                tdAgent.textContent = `Agent ID: ${agentId} (Nom inconnu)`; 
            }
            tr.appendChild(tdAgent);

            horaires.forEach(slotString => { 
                const td = document.createElement("td");
                td.classList.add('slot-cell');
                td.setAttribute("data-time", slotString);
                
                if (agentSpecificDayPlanning && agentSpecificDayPlanning.includes(slotString)) {
                    td.classList.add('available-slot-cell'); // Disponible (vert)
                } else {
                    td.classList.add('unavailable-slot-cell'); // Indisponible (gris/rouge pâle)
                }
                // Supprime le texte 'D' ou 'I'
                // td.textContent = ''; 
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
    }

    table.appendChild(tbody);
    planningContainer.appendChild(table);

    adminInfo.textContent = "Vue du planning global des agents.";
    adminInfo.style.backgroundColor = "";
    adminInfo.style.borderColor = "";
    adminInfo.style.color = "";
}


// --- Fonctions d'Export PDF ---
async function exportPdf() {
    const container = document.getElementById("global-planning");
    const table = container.querySelector('.planning-table');

    if (!table) {
        console.warn("La table de planning est introuvable. Impossible d'exporter.");
        displayMessageModal("Erreur d'Export", "La table de planning est introuvable. Assurez-vous que l'onglet 'Planning Global' est actif.", "error");
        return;
    }

    const originalContainerOverflowX = container.style.overflowX;
    const originalTableWhiteSpace = table.style.whiteSpace;

    showLoading(true, true);

    try {
        container.style.overflowX = "visible";
        table.style.whiteSpace = "nowrap";

        await new Promise(r => setTimeout(r, 100)); 

        const { jsPDF } = window.jspdf;

        const year = new Date().getFullYear();
        const mondayDate = getMondayOfWeek(currentWeek, year);
        const sundayDate = new Date(mondayDate);
        sundayDate.setDate(mondayDate.getDate() + 6);

        function formatDate(d) {
            return d.getDate().toString().padStart(2, '0') + '/' + (d.getMonth() + 1).toString().padStart(2, '0');
        }
        const title = `Planning Semaine ${currentWeek} du ${formatDate(mondayDate)} au ${formatDate(sundayDate)}`;

        const canvas = await html2canvas(table, {
            scale: 2, 
            scrollY: -window.scrollY,
            useCORS: true,
            allowTaint: true,
        });

        const imgData = canvas.toDataURL("image/png");

        const pdf = new jsPDF({
            orientation: "landscape",
            unit: "mm",
            format: "a3"
        });

        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 10;

        const imgProps = pdf.getImageProperties(imgData);
        let pdfWidth = pageWidth - 2 * margin;
        let pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

        if (pdfHeight > pageHeight - (2 * margin + 30)) {
            pdfHeight = pageHeight - (2 * margin + 30);
            pdfWidth = (imgProps.width * pdfHeight) / imgProps.height;
        }

        const x = (pageWidth - pdfWidth) / 2;
        const y = margin + 25;

        pdf.setFontSize(18);
        pdf.text(title, margin, margin + 5);
        pdf.setFontSize(14);
        pdf.text(`Jour : ${currentDay.charAt(0).toUpperCase() + currentDay.slice(1)}`, margin, margin + 12);

        if (canvas.width > pageWidth * 2) { 
            pdf.setFontSize(8);
            pdf.setTextColor(100);
            pdf.text("Note: Le planning a été ajusté pour tenir sur la page. Certains détails peuvent apparaître plus petits.", margin, margin + 18);
            pdf.setTextColor(0);
        }

        pdf.addImage(imgData, "PNG", x, y, pdfWidth, pdfHeight);
        pdf.save(`planning_${currentDay}_semaine${currentWeek}.pdf`);
        displayMessageModal("Génération PDF", "Le PDF a été généré avec succès !", "success");
        console.log("Le PDF a été généré avec succès !");

    } catch (error) {
        console.error("Erreur lors de l'export PDF:", error);
        displayMessageModal("Erreur d'Export", "Une erreur est survenue lors de la génération du PDF. Veuillez réessayer ou contacter l'administrateur. Détails: " + error.message, "error");
    } finally {
        container.style.overflowX = originalContainerOverflowX;
        table.style.whiteSpace = originalTableWhiteSpace;
        showLoading(false, true);
    }
}


// --- Fonctions de gestion des qualifications (Frontend) ---

async function loadAvailableQualifications() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/qualifications`, {
            headers: { 'X-User-Role': 'admin' }
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'Erreur lors du chargement des qualifications disponibles.');
        }
        availableQualifications = data;
        console.log('Qualifications disponibles chargées:', availableQualifications);
    } catch (error) {
        console.error('Erreur de chargement des qualifications:', error);
        if (qualificationsMessage) {
            qualificationsMessage.textContent = `Erreur de chargement des qualifications: ${error.message}`;
            qualificationsMessage.style.color = 'red';
        }
    }
}

function renderNewAgentQualificationsCheckboxes() {
    if (!newAgentQualificationsCheckboxes) return;

    newAgentQualificationsCheckboxes.innerHTML = '';
    if (availableQualifications.length === 0) {
        newAgentQualificationsCheckboxes.textContent = 'Aucune qualification disponible. Ajoutez-en d\'abord via la gestion des qualifications.';
        return;
    }

    availableQualifications.forEach(qualification => {
        const checkboxContainer = document.createElement('div');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `new-qual-${qualification.id}`;
        checkbox.value = qualification.id;

        const label = document.createElement('label');
        label.htmlFor = `new-qual-${qualification.id}`;
        label.textContent = qualification.name;

        checkboxContainer.appendChild(checkbox);
        checkboxContainer.appendChild(label);
        newAgentQualificationsCheckboxes.appendChild(checkboxContainer);
    });
}

function renderQualificationsCheckboxes(agentQualifications = []) {
    if (!qualificationsCheckboxesDiv) return;

    qualificationsCheckboxesDiv.innerHTML = '';
    if (availableQualifications.length === 0) {
        qualificationsCheckboxesDiv.textContent = 'Aucune qualification disponible.';
        if (qualificationsMessage) {
             qualificationsMessage.textContent = 'Veuillez ajouter des qualifications via l\'administration.';
             qualificationsMessage.style.color = 'orange';
        }
        return;
    }

    availableQualifications.forEach(qualification => {
        const checkboxContainer = document.createElement('div');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `edit-qual-${qualification.id}`;
        checkbox.value = qualification.id;
        checkbox.checked = agentQualifications.includes(qualification.id);

        const label = document.createElement('label');
        label.htmlFor = `edit-qual-${qualification.id}`;
        label.textContent = qualification.name;

        checkboxContainer.appendChild(checkbox);
        checkboxContainer.appendChild(label);
        qualificationsCheckboxesDiv.appendChild(checkboxContainer);
    });
    if (qualificationsMessage) {
        qualificationsMessage.textContent = ''; 
    }
}

// --- Fonctions de gestion des grades (Frontend) ---

async function loadAvailableGrades() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/grades`, {
            headers: { 'X-User-Role': 'admin' }
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'Erreur lors du chargement des grades disponibles.');
        }
        availableGrades = data;
        console.log('Grades disponibles chargés:', availableGrades);
    } catch (error) {
        console.error('Erreur de chargement des grades:', error);
        if (gradesMessage) {
            gradesMessage.textContent = `Erreur de chargement des grades: ${error.message}`;
            gradesMessage.style.color = 'red';
        }
    }
}

function renderNewAgentGradesCheckboxes() {
    if (!newAgentGradesCheckboxes) return;

    newAgentGradesCheckboxes.innerHTML = '';
    if (availableGrades.length === 0) {
        newAgentGradesCheckboxes.textContent = 'Aucun grade disponible. Ajoutez-en d\'abord via la gestion des grades.';
        return;
    }

    availableGrades.forEach(grade => {
        const checkboxContainer = document.createElement('div');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `new-grade-${grade.id}`;
        checkbox.value = grade.id;

        const label = document.createElement('label');
        label.htmlFor = `new-grade-${grade.id}`;
        label.textContent = grade.name;

        checkboxContainer.appendChild(checkbox);
        checkboxContainer.appendChild(label);
        newAgentGradesCheckboxes.appendChild(checkboxContainer);
    });
}

function renderGradesCheckboxes(agentGrades = []) {
    if (!gradesCheckboxesDiv) return;

    gradesCheckboxesDiv.innerHTML = '';
    if (availableGrades.length === 0) {
        gradesCheckboxesDiv.textContent = 'Aucun grade disponible.';
        if (gradesMessage) {
             gradesMessage.textContent = 'Veuillez ajouter des grades via l\'administration.';
             gradesMessage.style.color = 'orange';
        }
        return;
    }

    availableGrades.forEach(grade => {
        const checkboxContainer = document.createElement('div');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `edit-grade-${grade.id}`;
        checkbox.value = grade.id;
        checkbox.checked = agentGrades.includes(grade.id);

        const label = document.createElement('label');
        label.htmlFor = `edit-grade-${grade.id}`;
        label.textContent = grade.name;

        checkboxContainer.appendChild(checkbox);
        checkboxContainer.appendChild(label);
        gradesCheckboxesDiv.appendChild(checkboxContainer);
    });
    if (gradesMessage) {
        gradesMessage.textContent = '';
    }
}


// --- Fonctions CRUD pour les agents (Backend) ---

async function loadAgents() {
    listAgentsMessage.textContent = 'Chargement des agents...';
    listAgentsMessage.style.color = 'blue';
    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/agents`, {
            headers: {
                'X-User-Role': 'admin'
            }
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Erreur lors du chargement des agents.');
        }

        agentsTableBody.innerHTML = '';
        if (data.length === 0) {
            // Colspan ajusté pour 6 colonnes (ID, Nom, Prénom, Qualifs, Grades, Actions)
            agentsTableBody.innerHTML = '<tr><td colspan="6">Aucun agent enregistré pour le moment.</td></tr>'; 
        } else {
            data.forEach(agent => {
                const row = agentsTableBody.insertRow();
                // Afficher les qualifications dans la table
                const qualNames = (agent.qualifications || [])
                                    .map(id => {
                                        const qual = availableQualifications.find(q => q.id === id);
                                        return qual ? qual.name : id;
                                    })
                                    .join(', ');

                // Afficher les grades dans la table
                const gradeNames = (agent.grades || [])
                                    .map(id => {
                                        const grade = availableGrades.find(g => g.id === id);
                                        return grade ? grade.name : id;
                                    })
                                    .join(', ');

                row.innerHTML = `
                    <td>${agent._id}</td>
                    <td>${agent.nom}</td>
                    <td>${agent.prenom}</td>
                    <td>${qualNames}</td>
                    <td>${gradeNames}</td>
                    <td>
                        <button class="edit-btn btn-secondary"
                            data-id="${agent._id}"
                            data-nom="${agent.nom}"
                            data-prenom="${agent.prenom}"
                            data-qualifications='${JSON.stringify(agent.qualifications || [])}'
                            data-grades='${JSON.stringify(agent.grades || [])}'>Modifier</button>
                        <button class="delete-btn btn-danger" data-id="${agent._id}">Supprimer</button>
                    </td>
                `;
            });
        }
        listAgentsMessage.textContent = '';
    } catch (error) {
        console.error('Erreur de chargement des agents:', error);
        listAgentsMessage.textContent = `Erreur : ${error.message}`;
        listAgentsMessage.style.color = 'red';
        agentsTableBody.innerHTML = '<tr><td colspan="6">Impossible de charger la liste des agents.</td></tr>'; // Colspan ajusté
    }
}

async function handleAddAgent(event) {
    event.preventDefault();
    const id = document.getElementById('newAgentId').value.trim();
    const nom = document.getElementById('newAgentNom').value.trim();
    const prenom = document.getElementById('newAgentPrenom').value.trim();
    const password = document.getElementById('newAgentPassword').value.trim();

    // Récupérer les qualifications sélectionnées pour le nouvel agent
    const selectedQualifications = Array.from(newAgentQualificationsCheckboxes.querySelectorAll('input[type="checkbox"]:checked'))
                                       .map(checkbox => checkbox.value);
    // Récupérer les grades sélectionnés
    const selectedGrades = Array.from(newAgentGradesCheckboxes.querySelectorAll('input[type="checkbox"]:checked'))
                                       .map(checkbox => checkbox.value);

    addAgentMessage.textContent = 'Ajout en cours...';
    addAgentMessage.style.color = 'blue';

    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/agents`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-Role': 'admin'
            },
            body: JSON.stringify({ id, nom, prenom, password, qualifications: selectedQualifications, grades: selectedGrades })
        });
        const data = await response.json();

        if (response.ok) {
            addAgentMessage.textContent = data.message;
            addAgentMessage.style.color = 'green';
            addAgentForm.reset();
            // Réinitialiser les checkboxes après l'ajout
            newAgentQualificationsCheckboxes.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
            newAgentGradesCheckboxes.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false); 
            loadAgents(); // Recharger la liste
        } else {
            addAgentMessage.textContent = `Erreur : ${data.message}`;
            addAgentMessage.style.color = 'red';
        }
    } catch (error) {
        console.error('Erreur lors de l\'ajout de l\'agent:', error);
        addAgentMessage.textContent = 'Erreur réseau lors de l\'ajout de l\'agent.';
        addAgentMessage.style.color = 'red';
    }
}

async function handleAgentActions(event) {
    const target = event.target;
    const agentId = target.dataset.id;

    if (!agentId) {
        console.error("Agent ID non trouvé pour l'action.");
        return;
    }

    if (target.classList.contains('edit-btn')) {
        editAgentId.value = agentId;
        editAgentNom.value = target.dataset.nom;
        editAgentPrenom.value = target.dataset.prenom;
        editAgentNewPassword.value = '';
        editAgentMessage.textContent = '';

        // Récupérer les qualifications et grades de l'agent depuis le dataset
        const agentQualifications = JSON.parse(target.dataset.qualifications || '[]');
        const agentGrades = JSON.parse(target.dataset.grades || '[]'); 

        renderQualificationsCheckboxes(agentQualifications); // Remplir les checkboxes
        renderGradesCheckboxes(agentGrades); // Remplir les checkboxes de grades

        editAgentModalElement.style.display = 'block'; 
    } else if (target.classList.contains('delete-btn')) {
        const confirmed = await confirmModal(`Êtes-vous sûr de vouloir supprimer l'agent ${agentId} ?`); 
        if (confirmed) {
            try {
                const response = await fetch(`${API_BASE_URL}/api/admin/agents/${agentId}`, {
                    method: 'DELETE',
                    headers: {
                        'X-User-Role': 'admin'
                    }
                });
                const data = await response.json();

                if (response.ok) {
                    displayMessageModal("Succès", data.message, "success"); 
                    loadAgents(); // Recharger la liste
                } else {
                    displayMessageModal("Erreur", `Erreur lors de la suppression : ${data.message}`, "error"); 
                }
            } catch (error) {
                console.error('Erreur lors de la suppression de l\'agent:', error);
                displayMessageModal("Erreur", 'Erreur réseau lors de la suppression de l\'agent.', "error"); 
            }
        }
    }
}

async function handleEditAgent(event) {
    event.preventDefault();
    const id = editAgentId.value.trim();
    const nom = editAgentNom.value.trim();
    const prenom = editAgentPrenom.value.trim();
    const newPassword = editAgentNewPassword.value.trim();

    // Récupérer les qualifications sélectionnées
    const selectedQualifications = Array.from(qualificationsCheckboxesDiv.querySelectorAll('input[type="checkbox"]:checked'))
                                       .map(checkbox => checkbox.value);
    // Récupérer les grades sélectionnés
    const selectedGrades = Array.from(gradesCheckboxesDiv.querySelectorAll('input[type="checkbox"]:checked'))
                                       .map(checkbox => checkbox.value);


    editAgentMessage.textContent = 'Mise à jour en cours...';
    editAgentMessage.style.color = 'blue';

    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/agents/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-User-Role': 'admin'
            },
            body: JSON.stringify({ nom, prenom, newPassword, qualifications: selectedQualifications, grades: selectedGrades })
        });
        const data = await response.json();

        if (response.ok) {
            editAgentMessage.textContent = data.message;
            editAgentMessage.style.color = 'green';
            loadAgents(); // Recharger la liste des agents
        } else {
            editAgentMessage.textContent = `Erreur : ${data.message}`;
            editAgentMessage.style.color = 'red';
        }
    } catch (error) {
        console.error('Erreur lors de la mise à jour de l\'agent:', error);
        editAgentMessage.textContent = 'Erreur réseau lors de la mise à jour de l\'agent.';
        editAgentMessage.style.color = 'red';
    }
}

// --- Fonctions CRUD pour la gestion des qualifications (Frontend) ---

async function loadQualificationsList() {
    listQualificationsMessage.textContent = 'Chargement des qualifications...';
    listQualificationsMessage.style.color = 'blue';
    try {
        const response = await fetch(`${API_BASE_URL}/api/qualifications`, {
            headers: { 'X-User-Role': 'admin' }
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Erreur lors du chargement des qualifications.');
        }

        qualificationsTableBody.innerHTML = '';
        if (data.length === 0) {
            qualificationsTableBody.innerHTML = '<tr><td colspan="3">Aucune qualification enregistrée pour le moment.</td></tr>';
        } else {
            data.forEach(qual => {
                const row = qualificationsTableBody.insertRow();
                row.innerHTML = `
                    <td>${qual.id}</td>
                    <td>${qual.name}</td>
                    <td>
                        <button class="edit-btn btn-secondary" data-id="${qual.id}" data-name="${qual.name}">Modifier</button>
                        <button class="delete-btn btn-danger" data-id="${qual.id}">Supprimer</button>
                    </td>
                `;
            });
        }
        listQualificationsMessage.textContent = '';
    } catch (error) {
        console.error('Erreur de chargement des qualifications:', error);
        listQualificationsMessage.textContent = `Erreur : ${error.message}`;
        listQualificationsMessage.style.color = 'red';
        qualificationsTableBody.innerHTML = '<tr><td colspan="3">Impossible de charger la liste des qualifications.</td></tr>';
    }
}

async function handleAddQualification(event) {
    event.preventDefault();
    const id = document.getElementById('newQualId').value.trim();
    const name = document.getElementById('newQualName').value.trim();

    addQualificationMessage.textContent = 'Ajout en cours...';
    addQualificationMessage.style.color = 'blue';

    try {
        const response = await fetch(`${API_BASE_URL}/api/qualifications`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-Role': 'admin'
            },
            body: JSON.stringify({ id, name })
        });
        const data = await response.json();

        if (response.ok) {
            addQualificationMessage.textContent = data.message;
            addQualificationMessage.style.color = 'green';
            addQualificationFormElement.reset(); 
            await loadAvailableQualifications(); // Recharger la liste des qualifications disponibles
            await loadQualificationsList(); // Recharger la liste affichée dans la table
            renderNewAgentQualificationsCheckboxes(); // Mettre à jour les checkboxes d'agent
        } else {
            addQualificationMessage.textContent = `Erreur : ${data.message}`;
            addQualificationMessage.style.color = 'red';
        }
    } catch (error) {
        console.error('Erreur lors de l\'ajout de la qualification:', error);
        addQualificationMessage.textContent = 'Erreur réseau lors de l\'ajout de la qualification.';
        addQualificationMessage.style.color = 'red';
    }
}

async function handleQualificationActions(event) {
    const target = event.target;
    const qualId = target.dataset.id;

    if (!qualId) return;

    if (target.classList.contains('edit-btn')) {
        editQualId.value = qualId;
        editQualName.value = target.dataset.name;
        editQualMessage.textContent = '';
        editQualificationModalElement.style.display = 'block'; 
    } else if (target.classList.contains('delete-btn')) {
        const confirmed = await confirmModal(`Êtes-vous sûr de vouloir supprimer la qualification "${qualId}" ? Cela la retirera aussi des agents qui la possèdent.`); 
        if (confirmed) {
            try {
                const response = await fetch(`${API_BASE_URL}/api/qualifications/${qualId}`, {
                    method: 'DELETE',
                    headers: { 'X-User-Role': 'admin' }
                });
                const data = await response.json();

                if (response.ok) {
                    displayMessageModal("Succès", data.message, "success"); 
                    await loadAvailableQualifications(); 
                    await loadQualificationsList(); 
                    renderNewAgentQualificationsCheckboxes(); 
                    loadAgents(); 
                } else {
                    displayMessageModal("Erreur", `Erreur lors de la suppression : ${data.message}`, "error"); 
                }
            } catch (error) {
                console.error('Erreur lors de la suppression de la qualification:', error);
                displayMessageModal("Erreur", 'Erreur réseau lors de la suppression de la qualification.', "error"); 
            }
        }
    }
}

async function handleEditQualification(event) {
    event.preventDefault();
    const id = editQualId.value.trim();
    const name = editQualName.value.trim();

    editQualMessage.textContent = 'Mise à jour en cours...';
    editQualMessage.style.color = 'blue';

    try {
        const response = await fetch(`${API_BASE_URL}/api/qualifications/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-User-Role': 'admin'
            },
            body: JSON.stringify({ name })
        });
        const data = await response.json();

        if (response.ok) {
            editQualMessage.textContent = data.message;
            editQualMessage.style.color = 'green';
            await loadAvailableQualifications();
            await loadQualificationsList();
            renderNewAgentQualificationsCheckboxes();
            loadAgents(); 
        } else {
            editQualMessage.textContent = `Erreur : ${data.message}`;
            editQualMessage.style.color = 'red';
        }
    } catch (error) {
        console.error('Erreur lors de la mise à jour de la qualification:', error);
        editQualMessage.textContent = 'Erreur réseau lors de la mise à jour de la qualification.';
        editQualMessage.style.color = 'red';
    }
}

// --- Fonctions CRUD pour la gestion des grades (Frontend) ---

async function loadGradesList() {
    listGradesMessage.textContent = 'Chargement des grades...';
    listGradesMessage.style.color = 'blue';
    try {
        const response = await fetch(`${API_BASE_URL}/api/grades`, {
            headers: { 'X-User-Role': 'admin' }
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Erreur lors du chargement des grades.');
        }

        gradesTableBody.innerHTML = '';
        if (data.length === 0) {
            gradesTableBody.innerHTML = '<tr><td colspan="3">Aucun grade enregistré pour le moment.</td></tr>';
        } else {
            data.forEach(grade => {
                const row = gradesTableBody.insertRow();
                row.innerHTML = `
                    <td>${grade.id}</td>
                    <td>${grade.name}</td>
                    <td>
                        <button class="edit-btn btn-secondary" data-id="${grade.id}" data-name="${grade.name}">Modifier</button>
                        <button class="delete-btn btn-danger" data-id="${grade.id}">Supprimer</button>
                    </td>
                `;
            });
        }
        listGradesMessage.textContent = '';
    }
     catch (error) {
        console.error('Erreur de chargement des grades:', error);
        listGradesMessage.textContent = `Erreur : ${error.message}`;
        listGradesMessage.style.color = 'red';
        gradesTableBody.innerHTML = '<tr><td colspan="3">Impossible de charger la liste des grades.</td></tr>';
    }
}

async function handleAddGrade(event) {
    event.preventDefault();
    const id = document.getElementById('newGradeId').value.trim();
    const name = document.getElementById('newGradeName').value.trim();

    addGradeMessage.textContent = 'Ajout en cours...';
    addGradeMessage.style.color = 'blue';

    try {
        const response = await fetch(`${API_BASE_URL}/api/grades`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-Role': 'admin'
            },
            body: JSON.stringify({ id, name })
        });
        const data = await response.json();

        if (response.ok) {
            addGradeMessage.textContent = data.message;
            addGradeMessage.style.color = 'green';
            addGradeFormElement.reset(); 
            await loadAvailableGrades();
            await loadGradesList();
            renderNewAgentGradesCheckboxes(); 
        } else {
            addGradeMessage.textContent = `Erreur : ${data.message}`;
            addGradeMessage.style.color = 'red';
        }
    } catch (error) {
        console.error('Erreur lors de l\'ajout du grade:', error);
        addGradeMessage.textContent = 'Erreur réseau lors de l\'ajout du grade.';
        addGradeMessage.style.color = 'red';
    }
}

async function handleGradeActions(event) {
    const target = event.target;
    const gradeId = target.dataset.id;

    if (!gradeId) return;

    if (target.classList.contains('edit-btn')) {
        editGradeId.value = gradeId;
        editGradeName.value = target.dataset.name;
        editGradeMessage.textContent = '';
        editGradeModalElement.style.display = 'block'; 
    } else if (target.classList.contains('delete-btn')) {
        const confirmed = await confirmModal(`Êtes-vous sûr de vouloir supprimer le grade "${gradeId}" ? Cela le retirera aussi des agents qui le possèdent.`); 
        if (confirmed) {
            try {
                const response = await fetch(`${API_BASE_URL}/api/grades/${gradeId}`, {
                    method: 'DELETE',
                    headers: { 'X-User-Role': 'admin' }
                });
                const data = await response.json();

                if (response.ok) {
                    displayMessageModal("Succès", data.message, "success"); 
                    await loadAvailableGrades();
                    await loadGradesList();
                    renderNewAgentGradesCheckboxes();
                    loadAgents(); 
                } else {
                    displayMessageModal("Erreur", `Erreur lors de la suppression : ${data.message}`, "error"); 
                }
            } catch (error) {
                console.error('Erreur lors de la suppression du grade:', error);
                displayMessageModal("Erreur", 'Erreur réseau lors de la suppression du grade.', "error"); 
            }
        }
    }
}

async function handleEditGrade(event) {
    event.preventDefault();
    const id = editGradeId.value.trim();
    const name = editGradeName.value.trim();

    editGradeMessage.textContent = 'Mise à jour en cours...';
    editGradeMessage.style.color = 'blue';

    try {
        const response = await fetch(`${API_BASE_URL}/api/grades/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-User-Role': 'admin'
            },
            body: JSON.stringify({ name })
        });
        const data = await response.json();

        if (response.ok) {
            editGradeMessage.textContent = data.message;
            editGradeMessage.style.color = 'green';
            await loadAvailableGrades();
            await loadGradesList();
            renderNewAgentGradesCheckboxes();
            loadAgents(); 
        } else {
            editGradeMessage.textContent = `Erreur : ${data.message}`;
            editGradeMessage.style.color = 'red';
        }
    } catch (error) {
        console.error('Erreur lors de la mise à jour du grade:', error);
        editGradeMessage.textContent = 'Erreur réseau lors de la mise à jour du grade.';
        editGradeMessage.style.color = 'red';
    }
}


function logout() {
    sessionStorage.clear();
    window.location.href = "index.html";
}

function showLoading(isLoading, forPdf = false) {
    if (isLoading) {
        loadingSpinner.classList.remove("hidden");
        // Désactiver les contrôles globaux et ceux de l'onglet actif
        document.querySelectorAll('button, select, input, a').forEach(el => {
            if (el.id !== 'logout-btn') { // Ne pas désactiver le bouton de déconnexion
                el.disabled = true;
                if (el.tagName === 'A') el.classList.add('disabled-link'); // Ajoute une classe pour les liens
            }
        });
        // Pour les boutons principaux d'onglet, on peut les désactiver aussi
        mainTabButtons.forEach(btn => btn.disabled = true);

        if (forPdf) {
            adminInfo.textContent = "Génération du PDF en cours, veuillez patienter...";
            adminInfo.style.backgroundColor = "#fff3cd";
            adminInfo.style.borderColor = "#ffeeba";
            adminInfo.style.color = "#856404";
        }
    } else {
        loadingSpinner.classList.add("hidden");
        // Réactiver les contrôles globaux et ceux de l'onglet actif
        document.querySelectorAll('button, select, input, a').forEach(el => {
            if (el.id !== 'logout-btn') {
                el.disabled = false;
                if (el.tagName === 'A') el.classList.remove('disabled-link');
            }
        });
        mainTabButtons.forEach(btn => btn.disabled = false);


        if (forPdf) {
            adminInfo.textContent = "Vue du planning global des agents.";
            adminInfo.style.backgroundColor = "";
            adminInfo.style.borderColor = "";
            adminInfo.style.color = "";
        }
    }
}
