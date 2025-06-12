const API_BASE_URL = ""; // Ancien: "https://dispo-pompier.onrender.com"

// Créneaux horaires de 07:00 à 07:00 le lendemain
const horaires = [];
const startHourDisplay = 7; // Heure de début des créneaux

for (let i = 0; i < 48; i++) { // 48 créneaux de 30 minutes = 24 heures
    const currentSlotHour = (startHourDisplay + Math.floor(i / 2)) % 24;
    const currentSlotMinute = (i % 2) * 30;

    const endSlotHour = (startHourDisplay + Math.floor((i + 1) / 2)) % 24;
    const endSlotMinute = ((i + 1) % 2) * 30;

    const start = `${String(currentSlotHour).padStart(2, '0')}:${String(currentSlotMinute).padStart(2, '0')}`;
    const end = `${String(endSlotHour).padStart(2, '0')}:${String(endSlotMinute).padStart(2, '0')}`;

    horaires.push(`${start} - ${end}`);
}

// DOM Elements
const rosterDateInput = document.getElementById('roster-date');
const prevDayButton = document.getElementById('prev-day-button');
const nextDayButton = document.getElementById('next-day-button');
const refreshButton = document.getElementById('refresh-button');
const availablePersonnelList = document.getElementById('available-personnel-list');
const onDutyAgentsGrid = document.getElementById('on-duty-agents-grid');
const saveRosterBtn = document.getElementById('save-roster-btn');
const generateRosterBtn = document.getElementById('generate-roster-btn');
const rosterGridContainer = document.getElementById('roster-grid');
const loadingSpinner = document.querySelector('.loading-message'); // Utilise le message de chargement comme spinner
const engineDetailsPage = document.getElementById('engine-details-page');
const rosterConfigPage = document.getElementById('roster-config-page');
const backToRosterBtn = document.getElementById('back-to-roster-btn');
const vehicleTypeSelect = document.getElementById('vehicle-type-select');
const addVehicleBtn = document.getElementById('add-vehicle-btn');
const vehiclesListContainer = document.getElementById('vehicles-list-container');


// State variables
let currentRosterDate = new Date();
let availableAgents = []; // Tous les agents disponibles (pour la liste de gauche)
let onDutyAgents = []; // Agents actuellement sur la feuille de garde
let vehicles = []; // Liste des véhicules configurés
let allQualifications = []; // Toutes les qualifications possibles (pour l'affichage)
let allGrades = []; // Tous les grades possibles
let allFonctions = []; // Toutes les fonctions possibles


// --- Fonctions utilitaires ---

// Fonction d'authentification et de redirection
async function authenticateAndRedirect() {
    const token = sessionStorage.getItem('jwtToken');
    const isAdmin = sessionStorage.getItem('isAdmin');

    if (!token || isAdmin !== 'true') { // Seuls les admins peuvent accéder à cette page
        sessionStorage.clear();
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

// Fonction pour obtenir le numéro de semaine ISO 8601
function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    var weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return weekNo;
}

// Fonction pour obtenir le nom du jour en français
function getDayName(date) {
    const days = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    return days[date.getDay()];
}

// Fonction pour formater la date en YYYY-MM-DD
function formatDateToYYYYMMDD(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Fonction pour parser une date YYYY-MM-DD en objet Date
function parseDateYYYYMMDD(dateString) {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
}

// Fonction pour obtenir la date pour une semaine et un jour donnés
function getDateForWeekAndDay(weekNum, dayName, year = new Date().getFullYear()) {
    const simple = new Date(year, 0, 1 + (weekNum - 1) * 7);
    const dow = simple.getDay(); // day of week
    const ISOweekStart = new Date(simple);
    if (dow <= 4) {
        ISOweekStart.setDate(simple.getDate() - dow + 1);
    } else {
        ISOweekStart.setDate(simple.getDate() + 8 - dow);
    }

    const daysMap = {
        'lundi': 0, 'mardi': 1, 'mercredi': 2, 'jeudi': 3, 'vendredi': 4, 'samedi': 5, 'dimanche': 6
    };
    const dayOffset = daysMap[dayName];
    if (dayOffset === undefined) return null;

    const targetDate = new Date(ISOweekStart);
    targetDate.setDate(ISOweekStart.getDate() + dayOffset);
    return targetDate;
}

function showLoading(isLoading) {
    if (isLoading) {
        if (loadingSpinner) loadingSpinner.classList.remove('hidden');
        document.body.classList.add('loading-active');
        // Désactiver tous les boutons et inputs pour éviter les clics pendant le chargement
        document.querySelectorAll('button, input, select, a').forEach(el => el.disabled = true);
    } else {
        if (loadingSpinner) loadingSpinner.classList.add('hidden');
        document.body.classList.remove('loading-active');
        // Réactiver tous les boutons et inputs
        document.querySelectorAll('button, input, select, a').forEach(el => el.disabled = false);
    }
}
// Ajout d'un style pour le body.loading-active dans le CSS (pas ici, mais à noter pour le CSS)
// Cela désactivera les événements de souris et changera le curseur sur tout le corps.


// --- Fonctions de chargement des données ---

async function fetchAllPersonnel() {
    showLoading(true);
    try {
        const token = sessionStorage.getItem('jwtToken');
        const response = await fetch(`${API_BASE_URL}/api/users`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Échec du chargement du personnel.');
        availableAgents = await response.json();
        await fetchAllQualifications(); // Charger les qualifications
        await fetchAllGrades(); // Charger les grades
        await fetchAllFonctions(); // Charger les fonctions
        displayAvailablePersonnel();
    } catch (error) {
        console.error('Erreur lors du chargement du personnel disponible:', error);
        alert('Erreur lors du chargement du personnel: ' + error.message);
        availablePersonnelList.innerHTML = '<p class="error-message">Erreur de chargement du personnel.</p>';
    } finally {
        showLoading(false);
    }
}

async function fetchAllQualifications() {
    try {
        const token = sessionStorage.getItem('jwtToken');
        const response = await fetch(`${API_BASE_URL}/api/qualifications`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Échec du chargement des qualifications.');
        allQualifications = await response.json();
    } catch (error) {
        console.error('Erreur lors du chargement de toutes les qualifications:', error);
        allQualifications = []; // Assurer que c'est un tableau vide en cas d'erreur
    }
}

async function fetchAllGrades() {
    try {
        const token = sessionStorage.getItem('jwtToken');
        const response = await fetch(`${API_BASE_URL}/api/grades`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Échec du chargement des grades.');
        allGrades = await response.json();
    } catch (error) {
        console.error('Erreur lors du chargement de tous les grades:', error);
        allGrades = [];
    }
}

async function fetchAllFonctions() {
    try {
        const token = sessionStorage.getItem('jwtToken');
        const response = await fetch(`${API_BASE_URL}/api/fonctions`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Échec du chargement des fonctions.');
        allFonctions = await response.json();
    } catch (error) {
        console.error('Erreur lors du chargement de toutes les fonctions:', error);
        allFonctions = [];
    }
}


async function loadRosterForDate(date) {
    showLoading(true);
    try {
        const token = sessionStorage.getItem('jwtToken');
        const formattedDate = formatDateToYYYYMMDD(date);
        const response = await fetch(`${API_BASE_URL}/api/roster/daily?date=${formattedDate}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.status === 404) { // Pas de feuille de garde pour cette date
            onDutyAgents = [];
            vehicles = [];
            displayOnDutyAgents();
            displayVehicles();
            generateEmptyRosterGrid();
            console.log(`Aucune feuille de garde trouvée pour le ${formattedDate}.`);
            return;
        }

        if (!response.ok) {
            throw new Error('Échec du chargement de la feuille de garde.');
        }

        const data = await response.json();
        onDutyAgents = data.onDutyAgents || [];
        vehicles = data.vehicles || [];
        displayOnDutyAgents();
        displayVehicles();
        // displayRoster(data.roster); // La feuille de garde elle-même est générée à partir des agents
        generateRosterGrid(); // Régénérer la grille une fois les agents et véhicules chargés

    } catch (error) {
        console.error('Erreur lors du chargement de la feuille de garde:', error);
        alert('Erreur lors du chargement de la feuille de garde: ' + error.message);
        onDutyAgents = [];
        vehicles = [];
        displayOnDutyAgents();
        displayVehicles();
        generateEmptyRosterGrid(); // Afficher une grille vide en cas d'erreur
    } finally {
        showLoading(false);
    }
}

// --- Fonctions d'affichage et de manipulation ---

function displayAvailablePersonnel() {
    availablePersonnelList.innerHTML = '';
    if (availableAgents.length === 0) {
        availablePersonnelList.innerHTML = '<p>Aucun personnel disponible.</p>';
        return;
    }

    availableAgents.forEach(agent => {
        const agentDiv = document.createElement('div');
        agentDiv.classList.add('agent-card');
        agentDiv.draggable = true;
        agentDiv.dataset.agentId = agent.id;

        // Ajouter les qualifications, grades et fonctions à l'affichage
        const qualNames = agent.qualifications.map(qId => {
            const qual = allQualifications.find(aq => aq.id === qId);
            return qual ? qual.name : 'Inconnue';
        }).join(', ');
        const gradeName = allGrades.find(g => g.id === agent.grade)?.name || 'N/A';
        const fonctionName = allFonctions.find(f => f.id === agent.fonction)?.name || 'N/A';


        agentDiv.innerHTML = `
            <p><strong>${agent.prenom} ${agent.nom}</strong> (${agent.id})</p>
            <p class="agent-details">Grade: ${gradeName} | Fonction: ${fonctionName}</p>
            <p class="agent-details">Qualifications: ${qualNames || 'Aucune'}</p>
        `;
        agentDiv.addEventListener('dragstart', dragStart);
        availablePersonnelList.appendChild(agentDiv);
    });
}

function displayOnDutyAgents() {
    onDutyAgentsGrid.innerHTML = '';
    // Créer 10 cases pour les agents d'astreinte
    for (let i = 0; i < 10; i++) {
        const dropZone = document.createElement('div');
        dropZone.classList.add('on-duty-drop-zone');
        dropZone.dataset.index = i;
        dropZone.addEventListener('dragover', dragOver);
        dropZone.addEventListener('drop', drop);
        dropZone.addEventListener('dragleave', dragLeave);

        const currentAgent = onDutyAgents[i];
        if (currentAgent) {
            const agentDiv = document.createElement('div');
            agentDiv.classList.add('agent-card');
            agentDiv.draggable = true;
            agentDiv.dataset.agentId = currentAgent.id;

            const qualNames = currentAgent.qualifications.map(qId => {
                const qual = allQualifications.find(aq => aq.id === qId);
                return qual ? qual.name : 'Inconnue';
            }).join(', ');
            const gradeName = allGrades.find(g => g.id === currentAgent.grade)?.name || 'N/A';
            const fonctionName = allFonctions.find(f => f.id === currentAgent.fonction)?.name || 'N/A';

            agentDiv.innerHTML = `
                <p><strong>${currentAgent.prenom} ${currentAgent.nom}</strong> (${currentAgent.id})</p>
                <p class="agent-details">Grade: ${gradeName} | Fonction: ${fonctionName}</p>
                <p class="agent-details">Qualifications: ${qualNames || 'Aucune'}</p>
                <button class="remove-agent-btn" data-agent-id="${currentAgent.id}" data-index="${i}">&times;</button>
            `;
            agentDiv.addEventListener('dragstart', dragStart);
            dropZone.appendChild(agentDiv);
        }
        onDutyAgentsGrid.appendChild(dropZone);
    }
    // Ajouter les écouteurs pour les boutons de suppression
    document.querySelectorAll('.remove-agent-btn').forEach(button => {
        button.addEventListener('click', removeAgentFromOnDuty);
    });
}

function displayVehicles() {
    vehiclesListContainer.innerHTML = '';
    if (vehicles.length === 0) {
        vehiclesListContainer.innerHTML = '<p>Aucun véhicule configuré.</p>';
    }
    vehicles.forEach(vehicle => {
        const vehicleDiv = document.createElement('div');
        vehicleDiv.classList.add('vehicle-item');
        vehicleDiv.innerHTML = `
            <span>${vehicle.type}</span>
            <button class="remove-vehicle-btn" data-vehicle-id="${vehicle.id}">&times;</button>
        `;
        vehiclesListContainer.appendChild(vehicleDiv);
    });
    document.querySelectorAll('.remove-vehicle-btn').forEach(button => {
        button.addEventListener('click', removeVehicle);
    });
}

function addVehicle() {
    const type = vehicleTypeSelect.value;
    if (!type) {
        alert('Veuillez sélectionner un type de véhicule.');
        return;
    }
    const newVehicle = {
        id: `veh-${Date.now()}`, // Simple ID unique
        type: type
    };
    vehicles.push(newVehicle);
    displayVehicles();
}

function removeVehicle(event) {
    const vehicleIdToRemove = event.target.dataset.vehicleId;
    vehicles = vehicles.filter(v => v.id !== vehicleIdToRemove);
    displayVehicles();
}

// --- Fonctions de Drag & Drop ---
let draggedAgentId = null;

function dragStart(e) {
    draggedAgentId = e.target.dataset.agentId;
    e.dataTransfer.setData('text/plain', draggedAgentId);
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => e.target.classList.add('dragging'), 0); // Ajouter la classe après un court délai
}

function dragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    e.target.closest('.on-duty-drop-zone').classList.add('drag-over'); // Ajouter un feedback visuel
}

function dragLeave(e) {
    e.target.closest('.on-duty-drop-zone').classList.remove('drag-over');
}

function drop(e) {
    e.preventDefault();
    e.target.closest('.on-duty-drop-zone').classList.remove('drag-over'); // Retirer le feedback visuel

    const dropZone = e.target.closest('.on-duty-drop-zone');
    const index = parseInt(dropZone.dataset.index);

    if (dropZone.children.length > 0 && !dropZone.querySelector('.dragging')) {
        // La drop zone contient déjà un agent et ce n'est pas le même agent qui est déplacé sur lui-même
        alert('Cette case est déjà occupée.');
        return;
    }

    const agentToAdd = availableAgents.find(agent => agent.id === draggedAgentId);
    if (agentToAdd) {
        // Vérifier si l'agent est déjà dans la liste d'astreinte
        const existingIndex = onDutyAgents.findIndex(agent => agent && agent.id === agentToAdd.id);
        if (existingIndex !== -1) {
            // Si l'agent existe déjà, on le déplace
            onDutyAgents[existingIndex] = null; // Vide l'ancienne position
        }

        onDutyAgents[index] = agentToAdd; // Placer l'agent dans la nouvelle position
        // Filtrer les nulls pour s'assurer que la liste est propre si nécessaire (ex: avant sauvegarde)
        onDutyAgents = onDutyAgents.filter(Boolean);
        onDutyAgents.length = 10; // S'assurer que le tableau a toujours une taille fixe si désiré, sinon ne pas faire ça
        // Pour les positions vides, mettre null
        for (let i = 0; i < 10; i++) {
            if (!onDutyAgents[i]) onDutyAgents[i] = null;
        }

        displayOnDutyAgents(); // Rafraîchir l'affichage
        // Ré-afficher la liste du personnel disponible au cas où un agent aurait été déplacé de là
        // (optionnel, si vous voulez que les agents disparaissent de la liste dispo quand ils sont d'astreinte)
        // displayAvailablePersonnel();
    }
}

function removeAgentFromOnDuty(event) {
    const agentIdToRemove = event.target.dataset.agentId;
    const indexToRemove = parseInt(event.target.dataset.index);
    if (onDutyAgents[indexToRemove] && onDutyAgents[indexToRemove].id === agentIdToRemove) {
        onDutyAgents[indexToRemove] = null; // Supprimer l'agent de cette position
        // Si vous voulez le remettre dans la liste des agents disponibles, ajoutez la logique ici
        // availableAgents.push(agentIdToRemove);
        displayOnDutyAgents();
        // displayAvailablePersonnel(); // Optionnel
    }
}


// --- Fonctions de sauvegarde et génération ---

async function saveRosterConfig() {
    showLoading(true);
    try {
        const token = sessionStorage.getItem('jwtToken');
        const formattedDate = formatDateToYYYYMMDD(currentRosterDate);
        // Filtrer les nulls de onDutyAgents avant de sauvegarder
        const actualOnDutyAgents = onDutyAgents.filter(agent => agent !== null);

        const configData = {
            date: formattedDate,
            onDutyAgents: actualOnDutyAgents, // Seuls les agents non-null
            vehicles: vehicles
        };

        const response = await fetch(`${API_BASE_URL}/api/roster/daily`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(configData)
        });

        if (!response.ok) {
            throw new Error('Échec de la sauvegarde de la configuration de la feuille de garde.');
        }

        const result = await response.json();
        alert(result.message);
    } catch (error) {
        console.error('Erreur lors de la sauvegarde de la configuration de la feuille de garde:', error);
        alert('Erreur lors de la sauvegarde de la configuration: ' + error.message);
    } finally {
        showLoading(false);
    }
}

async function generateRosterGrid() {
    showLoading(true);
    rosterGridContainer.innerHTML = '<p class="loading-message">Génération de la feuille de garde...</p>';

    try {
        // Préparer les données de planning des agents d'astreinte pour la date actuelle
        const dateString = formatDateToYYYYMMDD(currentRosterDate);
        const weekNum = getWeekNumber(currentRosterDate);
        const dayName = getDayName(currentRosterDate);

        // Récupérer le planning de chaque agent d'astreinte pour la semaine en cours
        const agentPlannings = {};
        const fetchPromises = onDutyAgents.filter(agent => agent !== null).map(async agent => {
            const token = sessionStorage.getItem('jwtToken');
            const response = await fetch(`${API_BASE_URL}/api/planning/${agent.id}?week=${weekNum}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                agentPlannings[agent.id] = data.slots;
            } else {
                console.warn(`Impossible de récupérer le planning de l'agent ${agent.id}.`);
                agentPlannings[agent.id] = {};
            }
        });
        await Promise.all(fetchPromises);

        // Créer la grille de la feuille de garde
        let tableHTML = `
            <table class="roster-table">
                <thead>
                    <tr>
                        <th>Créneau</th>
        `;

        // Ajouter les colonnes pour les véhicules
        vehicles.forEach(veh => {
            tableHTML += `<th class="vehicle-column" data-vehicle-id="${veh.id}">${veh.type}</th>`;
        });

        tableHTML += `
                        <th>Dispo Générale</th>
                    </tr>
                </thead>
                <tbody>
        `;

        horaires.forEach(slot => {
            tableHTML += `<tr><td class="slot-time">${slot}</td>`;

            vehicles.forEach(veh => {
                tableHTML += `<td class="slot-cell" data-slot="${slot}" data-vehicle-id="${veh.id}">
                                <div class="assigned-agents"></div>
                                <button class="assign-agent-btn" data-slot="${slot}" data-vehicle-id="${veh.id}">+</button>
                            </td>`;
            });

            // Cellule de disponibilité générale
            // Trouver tous les agents d'astreinte disponibles pour ce créneau et ce jour
            const availableForSlot = onDutyAgents.filter(agent => {
                if (!agent) return false;
                const planning = agentPlannings[agent.id];
                return planning && planning[dayName] && planning[dayName].includes(slot);
            });
            const availableAgentNames = availableForSlot.map(agent => `${agent.prenom.charAt(0)}. ${agent.nom.split(' ')[0]}`); // ex: M. Bruneau
            const availableAgentIds = availableForSlot.map(agent => agent.id);

            tableHTML += `<td class="general-availability" data-available-agents="${availableAgentIds.join(',') || ''}">`;
            if (availableAgentNames.length > 0) {
                tableHTML += `<span>${availableAgentNames.join(', ')}</span>`;
            } else {
                tableHTML += `<span class="no-agents">Aucun</span>`;
            }
            tableHTML += `</td></tr>`;
        });

        tableHTML += `
                </tbody>
            </table>
        `;
        rosterGridContainer.innerHTML = tableHTML;

        // Ajouter les écouteurs pour les boutons d'assignation
        document.querySelectorAll('.assign-agent-btn').forEach(button => {
            button.addEventListener('click', openEngineDetailsPage);
        });

    } catch (error) {
        console.error('Erreur lors de la génération de la grille de feuille de garde:', error);
        rosterGridContainer.innerHTML = `<p class="error-message">Erreur lors de la génération de la feuille de garde: ${error.message}</p>`;
    } finally {
        showLoading(false);
    }
}

function generateEmptyRosterGrid() {
    rosterGridContainer.innerHTML = '<p class="info-message">Aucune feuille de garde configurée pour cette date. Utilisez les contrôles ci-dessus pour ajouter des agents d\'astreinte et des véhicules, puis sauvegardez et générez.</p>';
}

// --- Gestion de la page de détails du véhicule ---

let currentSelectedSlot = null;
let currentSelectedVehicleId = null;

function openEngineDetailsPage(event) {
    const slot = event.target.dataset.slot;
    const vehicleId = event.target.dataset.vehicleId;

    currentSelectedSlot = slot;
    currentSelectedVehicleId = vehicleId;

    // Afficher la page de détails
    rosterConfigPage.style.display = 'none';
    engineDetailsPage.style.display = 'block';

    // Générer la grille de détails du véhicule
    renderEngineDetailsGrid(slot, vehicleId);
}

function renderEngineDetailsGrid(slot, vehicleId) {
    const engineGrid = engineDetailsPage.querySelector('.engine-grid');
    engineGrid.innerHTML = ''; // Nettoyer la grille

    const selectedVehicle = vehicles.find(v => v.id === vehicleId);
    if (!selectedVehicle) {
        engineGrid.innerHTML = '<p class="error-message">Véhicule non trouvé.</p>';
        return;
    }

    let gridHTML = `
        <h3>Affectation pour ${selectedVehicle.type} - Créneau ${slot}</h3>
        <div class="engine-assignment-areas">
            <div class="engine-area chief">
                <h4>Chef d'Agrès</h4>
                <div class="drop-zone" data-role="chief" data-vehicle="${vehicleId}" data-slot="${slot}"></div>
            </div>
            <div class="engine-area driver">
                <h4>Conducteur</h4>
                <div class="drop-zone" data-role="driver" data-vehicle="${vehicleId}" data-slot="${slot}"></div>
            </div>
            <div class="engine-area others">
                <h4>Équipiers</h4>
                <div class="drop-zone" data-role="others" data-vehicle="${vehicleId}" data-slot="${slot}"></div>
                <div class="drop-zone" data-role="others" data-vehicle="${vehicleId}" data-slot="${slot}"></div>
                <div class="drop-zone" data-role="others" data-vehicle="${vehicleId}" data-slot="${slot}"></div>
                <div class="drop-zone" data-role="others" data-vehicle="${vehicleId}" data-slot="${slot}"></div>
            </div>
        </div>
        <button id="save-assignment-btn" class="btn btn-primary">Sauvegarder l'affectation</button>
    `;
    engineGrid.innerHTML = gridHTML;

    // Rendre les agents disponibles (ceux d'astreinte qui sont disponibles pour ce slot)
    const generalAvailabilityCell = rosterGridContainer.querySelector(`td[data-slot="${slot}"].general-availability`);
    const availableAgentIdsForSlot = generalAvailabilityCell ? generalAvailabilityCell.dataset.availableAgents.split(',').filter(id => id) : [];
    
    // Filtre les agents réellement sur astreinte ET disponibles sur ce slot
    const agentsToAssign = onDutyAgents.filter(agent => agent && availableAgentIdsForSlot.includes(agent.id));
    
    const assignableAgentsContainer = document.createElement('div');
    assignableAgentsContainer.classList.add('assignable-agents-list');
    assignableAgentsContainer.innerHTML = '<h4>Agents disponibles pour l\'affectation :</h4>';
    
    agentsToAssign.forEach(agent => {
        const agentCard = document.createElement('div');
        agentCard.classList.add('agent-card');
        agentCard.draggable = true;
        agentCard.dataset.agentId = agent.id;
        agentCard.textContent = `${agent.prenom} ${agent.nom}`;
        agentCard.addEventListener('dragstart', dragStartAssign);
        assignableAgentsContainer.appendChild(agentCard);
    });
    engineGrid.appendChild(assignableAgentsContainer);

    // Ajouter les écouteurs de drag & drop pour les zones d'affectation
    document.querySelectorAll('.engine-assignment-areas .drop-zone').forEach(zone => {
        zone.addEventListener('dragover', dragOverAssign);
        zone.addEventListener('drop', dropAssign);
        zone.addEventListener('dragleave', dragLeaveAssign);
    });
    
    // Gérer le bouton de sauvegarde d'affectation
    document.getElementById('save-assignment-btn').addEventListener('click', saveAssignment);
}

function dragStartAssign(e) {
    draggedAgentId = e.target.dataset.agentId;
    e.dataTransfer.setData('text/plain', draggedAgentId);
    e.dataTransfer.effectAllowed = 'move';
}

function dragOverAssign(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    e.target.classList.add('drag-over');
}

function dragLeaveAssign(e) {
    e.target.classList.remove('drag-over');
}

function dropAssign(e) {
    e.preventDefault();
    e.target.classList.remove('drag-over');

    const dropZone = e.target;
    const role = dropZone.dataset.role;
    const slot = dropZone.dataset.slot;
    const vehicleId = dropZone.dataset.vehicle;

    // Empêcher d'ajouter un agent si la case est déjà occupée (sauf pour "others")
    if (role !== 'others' && dropZone.children.length > 0) {
        alert(`Un ${role} est déjà assigné à ce véhicule.`);
        return;
    }

    const agentToAssign = onDutyAgents.find(agent => agent && agent.id === draggedAgentId);
    if (agentToAssign) {
        const agentCard = document.createElement('div');
        agentCard.classList.add('assigned-agent-card');
        agentCard.dataset.agentId = agentToAssign.id;
        agentCard.innerHTML = `${agentToAssign.prenom.charAt(0)}. ${agentToAssign.nom.split(' ')[0]} <button class="remove-assigned-agent-btn" data-agent-id="${agentToAssign.id}">&times;</button>`;
        dropZone.appendChild(agentCard);

        agentCard.querySelector('.remove-assigned-agent-btn').addEventListener('click', removeAssignedAgent);
    }
}

function removeAssignedAgent(event) {
    event.target.closest('.assigned-agent-card').remove();
}

async function saveAssignment() {
    showLoading(true);
    const assignedAgents = {};
    document.querySelectorAll('.engine-assignment-areas .drop-zone').forEach(zone => {
        const role = zone.dataset.role;
        assignedAgents[role] = assignedAgents[role] || [];
        zone.querySelectorAll('.assigned-agent-card').forEach(card => {
            assignedAgents[role].push(card.dataset.agentId);
        });
    });

    const assignmentData = {
        date: formatDateToYYYYMMDD(currentRosterDate),
        slot: currentSelectedSlot,
        vehicleId: currentSelectedVehicleId,
        assignments: assignedAgents
    };

    try {
        const token = sessionStorage.getItem('jwtToken');
        const response = await fetch(`${API_BASE_URL}/api/roster/assign`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(assignmentData)
        });

        if (!response.ok) {
            throw new Error('Échec de la sauvegarde de l\'affectation.');
        }

        const result = await response.json();
        alert(result.message);
        // Mettre à jour l'affichage de la grille principale après sauvegarde
        // Ici, il faudrait idéalement rafraîchir seulement la cellule affectée,
        // mais pour simplifier, on peut régénérer toute la grille.
        generateRosterGrid(); // Régénère la grille principale
        backToRosterBtn.click(); // Retourne à la page principale de la feuille de garde
    } catch (error) {
        console.error('Erreur lors de la sauvegarde de l\'affectation:', error);
        alert('Erreur de sauvegarde de l\'affectation: ' + error.message);
    } finally {
        showLoading(false);
    }
}


// --- Événements et initialisation globale ---

document.addEventListener('DOMContentLoaded', async () => {
    const isAuthenticated = await authenticateAndRedirect();
    if (!isAuthenticated) return;

    // Initialiser la date d'aujourd'hui
    rosterDateInput.value = formatDateToYYYYMMDD(currentRosterDate);

    // Charger toutes les données initiales
    await fetchAllPersonnel(); // Charge le personnel et les qualifications/grades/fonctions
    await loadRosterForDate(currentRosterDate); // Charge la config de la feuille de garde pour la date

    // Événements
    rosterDateInput.addEventListener('change', (event) => {
        currentRosterDate = parseDateYYYYMMDD(event.target.value);
        loadRosterForDate(currentRosterDate);
    });

    prevDayButton.addEventListener('click', () => {
        currentRosterDate.setDate(currentRosterDate.getDate() - 1);
        rosterDateInput.value = formatDateToYYYYMMDD(currentRosterDate);
        loadRosterForDate(currentRosterDate);
    });

    nextDayButton.addEventListener('click', () => {
        currentRosterDate.setDate(currentRosterDate.getDate() + 1);
        rosterDateInput.value = formatDateToYYYYMMDD(currentRosterDate);
        loadRosterForDate(currentRosterDate);
    });

    refreshButton.addEventListener('click', () => loadRosterForDate(currentRosterDate));
    saveRosterBtn.addEventListener('click', saveRosterConfig);
    generateRosterBtn.addEventListener('click', generateRosterGrid);
    addVehicleBtn.addEventListener('click', addVehicle);
    backToRosterBtn.addEventListener('click', () => {
        engineDetailsPage.style.display = 'none';
        rosterConfigPage.style.display = 'block';
    });

    // Gestion du dragend pour nettoyer la classe 'dragging'
    document.addEventListener('dragend', (e) => {
        if (e.target.classList.contains('dragging')) {
            e.target.classList.remove('dragging');
        }
    });
});