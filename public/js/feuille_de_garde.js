// js/feuille_de_garde.js

const API_BASE_URL = "https://dispo-pompier.onrender.com";

// --- DOM Elements ---
const dateInput = document.getElementById('roster-date');
const prevDayButton = document.getElementById('prev-day-button');
const nextDayButton = document.getElementById('next-day-button');
const timeSlotButtonsContainer = document.getElementById('time-slot-buttons-container');
const availablePersonnelList = document.getElementById('available-personnel-list');
const onDutyAgentsGrid = document.getElementById('on-duty-agents-grid');
const rosterGrid = document.getElementById('roster-grid');
const loadingSpinner = document.getElementById('loading-spinner');
const generateAutoBtn = document.getElementById('generate-auto-btn');
const exportRosterPdfBtn = document.getElementById('export-roster-pdf');

// Modale d'affectation du personnel
const personnelAssignmentModal = document.getElementById('personnel-assignment-modal');
const personnelAssignmentModalTitle = document.getElementById('personnel-assignment-modal-title');
const availableAgentsInModalList = document.getElementById('available-agents-in-modal-list');
const engineRolesContainer = document.getElementById('engine-roles-container');
const closePersonnelAssignmentModalBtn = document.getElementById('close-personnel-assignment-modal-btn');

// Page de détails de l'engin
const engineDetailsPage = document.getElementById('engine-details-page');
const backToRosterBtn = document.getElementById('back-to-roster-btn');
const detailedEngineGrid = engineDetailsPage.querySelector('.engine-grid'); // Assurez-vous que l'ID est correct dans HTML

// Variables globales
let currentRosterDate = new Date();
let currentRosterConfig = {}; // Stores the time slots configuration for the selected date
let onDutyAgents = []; // Stores the IDs of agents currently on duty
let allAgentsData = []; // Stores full agent data (id, prenom, nom, qualifications, grades, functions)
let currentAvailablePersonnel = []; // Stores personnel available for the current time slot
let currentSelectedTimeSlot = null; // Stores the currently selected time slot ID (e.g., 'slot-jour', 'slot-nuit')
let currentEnginesConfig = []; // Stores the engine configurations for the current time slot
let currentAssignments = {}; // Stores manual assignments: { engineId: { roleId: agentId } }
let availableQualifications = []; // From admin.js or separate fetch
let availableGrades = []; // From admin.js or separate fetch
let availableFunctions = []; // From admin.js or separate fetch

// Default engine configurations (can be loaded from backend later)
const DEFAULT_ENGINES = [
    { id: 'vsav1', name: 'VSAV 1', qualifications: ['ca_vsav', 'eq_vsav'], roles: [
        { id: 'conducteur_vsav', name: 'Conducteur VSAV', requiredQual: ['ca_vsav'] },
        { id: 'chef_agr_vsav', name: 'Chef Agrès VSAV', requiredQual: [] },
        { id: 'equipier_vsav', name: 'Équipier VSAV', requiredQual: ['eq_vsav'] },
    ]},
    { id: 'fpt1', name: 'FPT 1', qualifications: ['ca_fpt', 'eq1_fpt', 'eq2_fpt'], roles: [
        { id: 'conducteur_fpt', name: 'Conducteur FPT', requiredQual: ['ca_fpt'] },
        { id: 'chef_agr_fpt', name: 'Chef Agrès FPT', requiredQual: [] },
        { id: 'equipier1_fpt', name: 'Équipier 1 FPT', requiredQual: ['eq1_fpt'] },
        { id: 'equipier2_fpt', name: 'Équipier 2 FPT', requiredQual: ['eq2_fpt'] },
    ]},
    // Add more engines as needed
];

// --- Utility Functions ---

/**
 * Displays or hides the loading spinner.
 * @param {boolean} isLoading - True to show, false to hide.
 */
function showLoading(isLoading) {
    if (isLoading) {
        loadingSpinner.classList.remove('hidden');
    } else {
        loadingSpinner.classList.add('hidden');
    }
}

/**
 * Formats a Date object to YYYY-MM-DD string.
 * @param {Date} date - The date object.
 * @returns {string} The formatted date string.
 */
function formatDateToYYYYMMDD(date) {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Parses a YYYY-MM-DD string to a Date object.
 * @param {string} dateString - The date string.
 * @returns {Date} The parsed date object.
 */
function parseYYYYMMDDToDate(dateString) {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
}

/**
 * Affiche une modale de message personnalisée.
 * (Copied from agent.js for consistency)
 * @param {string} title - Titre de la modale.
 * @param {string} message - Message à afficher.
 * @param {'info'|'success'|'error'|'warning'|'question'} type - Type de message pour le style.
 * @param {function(boolean)} [callback] - Fonction de rappel pour les confirmations (true si OK, false si Annuler/clic extérieur).
 */
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


// --- Data Fetching ---

/**
 * Fetches all available qualifications.
 */
async function fetchQualifications() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/qualifications`, {
            headers: { 'Authorization': `Bearer ${sessionStorage.getItem('jwtToken')}` }
        });
        if (!response.ok) throw new Error('Failed to fetch qualifications');
        availableQualifications = await response.json();
    } catch (error) {
        console.error('Error fetching qualifications:', error);
        displayMessageModal('Erreur', 'Impossible de charger la liste des qualifications.', 'error');
    }
}

/**
 * Fetches all available grades.
 */
async function fetchGrades() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/grades`, {
            headers: { 'Authorization': `Bearer ${sessionStorage.getItem('jwtToken')}` }
        });
        if (!response.ok) throw new Error('Failed to fetch grades');
        availableGrades = await response.json();
    } catch (error) {
        console.error('Error fetching grades:', error);
        displayMessageModal('Erreur', 'Impossible de charger la liste des grades.', 'error');
    }
}

/**
 * Fetches all available functions.
 */
async function fetchFunctions() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/functions`, {
            headers: { 'Authorization': `Bearer ${sessionStorage.getItem('jwtToken')}` }
        });
        if (!response.ok) throw new Error('Failed to fetch functions');
        availableFunctions = await response.json();
    } catch (error) {
        console.error('Error fetching functions:', error);
        displayMessageModal('Erreur', 'Impossible de charger la liste des fonctions.', 'error');
    }
}

/**
 * Fetches all agents from the server.
 */
async function fetchAllAgents() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/agents`, {
            headers: { 'Authorization': `Bearer ${sessionStorage.getItem('jwtToken')}` }
        });
        if (!response.ok) throw new Error('Failed to fetch all agents');
        allAgentsData = await response.json();
    } catch (error) {
        console.error('Error fetching all agents:', error);
        displayMessageModal('Erreur', 'Impossible de charger la liste de tous les agents.', 'error');
    }
}


/**
 * Fetches roster configuration for a given date.
 * This includes time slots and on-duty agents.
 * @param {string} dateKey - Date in YYYY-MM-DD format.
 */
async function fetchRosterConfig(dateKey) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/roster-config/${dateKey}`, {
            headers: { 'Authorization': `Bearer ${sessionStorage.getItem('jwtToken')}` }
        });
        if (!response.ok) throw new Error(`Failed to fetch roster config: ${response.statusText}`);
        const data = await response.json();
        // Set default time slots if none are configured
        if (!data.timeSlots || data.timeSlots.length === 0) {
            data.timeSlots = [
                { id: 'slot-jour', name: 'Jour (07:00 - 19:00)', startHour: 7, endHour: 19 },
                { id: 'slot-nuit', name: 'Nuit (19:00 - 07:00)', startHour: 19, endHour: 7 }
            ];
        }
        currentRosterConfig = data;
        onDutyAgents = data.onDutyAgents || []; // Initialize onDutyAgents from config
        return data;
    } catch (error) {
        console.error('Error fetching roster config:', error);
        displayMessageModal('Erreur', 'Impossible de charger la configuration de la feuille de garde.', 'error');
        currentRosterConfig = {}; // Reset on error
        onDutyAgents = [];
        return null;
    }
}

/**
 * Saves roster configuration for a given date.
 * @param {string} dateKey - Date in YYYY-MM-DD format.
 * @param {Array} timeSlots - Array of time slot objects.
 * @param {Array} onDutyAgentsIds - Array of agent IDs on duty.
 */
async function saveRosterConfig(dateKey, timeSlots, onDutyAgentsIds) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/roster-config/${dateKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionStorage.getItem('jwtToken')}`
            },
            body: JSON.stringify({ timeSlots, onDutyAgents: onDutyAgentsIds })
        });
        if (!response.ok) throw new Error(`Failed to save roster config: ${response.statusText}`);
        displayMessageModal('Succès', 'Configuration de la feuille de garde enregistrée.', 'success');
    } catch (error) {
        console.error('Error saving roster config:', error);
        displayMessageModal('Erreur', 'Impossible d\'enregistrer la configuration de la feuille de garde.', 'error');
    }
}

/**
 * Fetches agent availability and on-call status for a specific date.
 * This is used for both available personnel and automatic generation.
 * @param {string} dateKey - Date in YYYY-MM-DD format.
 */
async function fetchAgentAvailabilityAndOnCall(dateKey) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/agent-availability/${dateKey}`, {
            headers: { 'Authorization': `Bearer ${sessionStorage.getItem('jwtToken')}` }
        });
        if (!response.ok) throw new Error(`Failed to fetch agent availability: ${response.statusText}`);
        const data = await response.json();
        currentAvailablePersonnel = data.available || [];
        // No need to update onDutyAgents here, as it's managed by drag-and-drop and roster config save
        return data;
    } catch (error) {
        console.error('Error fetching agent availability:', error);
        displayMessageModal('Erreur', 'Impossible de charger les disponibilités des agents.', 'error');
        return { available: [], onCall: [] };
    }
}


// --- Rendering Functions ---

/**
 * Renders time slot buttons (Jour/Nuit) based on currentRosterConfig.
 */
function renderTimeSlotButtons() {
    timeSlotButtonsContainer.innerHTML = '';
    if (!currentRosterConfig.timeSlots || currentRosterConfig.timeSlots.length === 0) {
        timeSlotButtonsContainer.innerHTML = '<p>Aucun créneau horaire configuré.</p>';
        return;
    }

    currentRosterConfig.timeSlots.forEach(slot => {
        const button = document.createElement('button');
        button.classList.add('time-slot-btn');
        button.dataset.slotId = slot.id;
        button.textContent = slot.name;
        if (currentSelectedTimeSlot === slot.id) {
            button.classList.add('active');
        }
        button.addEventListener('click', () => {
            currentSelectedTimeSlot = slot.id;
            updateTimeSlotSelection();
            renderRosterGrid(); // Re-render roster for new time slot
        });
        timeSlotButtonsContainer.appendChild(button);
    });

    // Select the first time slot by default if none is selected
    if (!currentSelectedTimeSlot && currentRosterConfig.timeSlots.length > 0) {
        currentSelectedTimeSlot = currentRosterConfig.timeSlots[0].id;
        timeSlotButtonsContainer.querySelector(`[data-slot-id="${currentSelectedTimeSlot}"]`).classList.add('active');
    }
}

/**
 * Updates the active state of time slot buttons.
 */
function updateTimeSlotSelection() {
    document.querySelectorAll('.time-slot-btn').forEach(btn => {
        if (btn.dataset.slotId === currentSelectedTimeSlot) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

/**
 * Renders the list of available personnel for drag & drop.
 * @param {Array} personnel - Array of available personnel objects.
 */
function renderAvailablePersonnel(personnel) {
    availablePersonnelList.innerHTML = '';
    if (personnel.length === 0) {
        availablePersonnelList.innerHTML = '<p class="info-message">Aucun personnel disponible pour la date sélectionnée.</p>';
        return;
    }

    personnel.forEach(agent => {
        const agentDiv = document.createElement('div');
        agentDiv.classList.add('agent-card', 'draggable');
        agentDiv.dataset.agentId = agent.id;
        agentDiv.setAttribute('draggable', 'true');

        agentDiv.innerHTML = `
            <span class="agent-name">${agent.username}</span>
            <div class="agent-qualifications">
                ${agent.qualifications.map(qId => {
                    const qual = availableQualifications.find(aq => aq.id === qId);
                    return qual ? `<span class="qualification-tag">${qual.name}</span>` : '';
                }).join('')}
            </div>
        `;
        availablePersonnelList.appendChild(agentDiv);
    });
    addDragAndDropListeners();
}

/**
 * Renders the grid of agents currently on duty (drag & drop target).
 */
function renderOnDutyAgentsGrid() {
    onDutyAgentsGrid.innerHTML = '';
    if (onDutyAgents.length === 0) {
        onDutyAgentsGrid.innerHTML = '<div class="placeholder-text">Faites glisser les agents disponibles ici</div>';
    } else {
        onDutyAgents.forEach(agentId => {
            const agent = allAgentsData.find(a => a._id === agentId);
            if (agent) {
                const agentDiv = document.createElement('div');
                agentDiv.classList.add('agent-card', 'on-duty-agent');
                agentDiv.dataset.agentId = agent._id;
                agentDiv.innerHTML = `
                    <span class="agent-name">${agent.prenom} ${agent.nom}</span>
                    <button class="remove-on-duty-btn" data-agent-id="${agent._id}">&times;</button>
                `;
                onDutyAgentsGrid.appendChild(agentDiv);
            }
        });
    }
    addOnDutyRemoveListeners();
    addOnDutyDragAndDropListeners(); // Add drop listeners for reordering
}

/**
 * Renders the main roster grid (engines and assigned personnel).
 */
function renderRosterGrid() {
    rosterGrid.innerHTML = '';
    rosterGrid.classList.remove('loading-message'); // Hide loading message

    if (!currentSelectedTimeSlot) {
        rosterGrid.innerHTML = '<p class="info-message">Sélectionnez un créneau horaire (Jour/Nuit) pour voir la feuille de garde.</p>';
        return;
    }

    // Filter engines based on selected time slot (if any specific config exists)
    // For now, use DEFAULT_ENGINES, but this could be dynamic from currentRosterConfig
    currentEnginesConfig = DEFAULT_ENGINES; 

    if (currentEnginesConfig.length === 0) {
        rosterGrid.innerHTML = '<p class="info-message">Aucun engin configuré pour ce créneau horaire.</p>';
        return;
    }

    // Header row for engine roles
    const headerRow = document.createElement('div');
    headerRow.classList.add('roster-header-row');
    headerRow.innerHTML = '<div class="header-cell engine-name-header">Engin</div>';
    // Get all unique roles from all engines for header
    const allRoles = new Set();
    currentEnginesConfig.forEach(engine => {
        engine.roles.forEach(role => allRoles.add(role.name));
    });
    const sortedRoles = Array.from(allRoles).sort();
    sortedRoles.forEach(roleName => {
        headerRow.innerHTML += `<div class="header-cell role-header">${roleName}</div>`;
    });
    rosterGrid.appendChild(headerRow);

    // Render each engine row
    currentEnginesConfig.forEach(engine => {
        const engineRow = document.createElement('div');
        engineRow.classList.add('engine-row');
        engineRow.dataset.engineId = engine.id;

        const engineNameCell = document.createElement('div');
        engineNameCell.classList.add('engine-name-cell');
        engineNameCell.textContent = engine.name;
        engineRow.appendChild(engineNameCell);

        // Cells for each role, with "Affecter" button
        sortedRoles.forEach(roleName => {
            const roleCell = document.createElement('div');
            roleCell.classList.add('role-assignment-cell');
            const role = engine.roles.find(r => r.name === roleName);

            let assignedAgentId = currentAssignments[engine.id]?.[role?.id];
            if (assignedAgentId) {
                const assignedAgent = allAgentsData.find(a => a._id === assignedAgentId);
                if (assignedAgent) {
                    roleCell.innerHTML = `
                        <span class="assigned-agent-name">${assignedAgent.prenom} ${assignedAgent.nom}</span>
                        <button class="clear-assignment-btn" data-engine-id="${engine.id}" data-role-id="${role.id}">&times;</button>
                    `;
                    roleCell.classList.add('assigned');
                }
            } else if (role) { // Only show 'Affecter' if the role exists for this engine
                roleCell.innerHTML = `<button class="assign-btn" data-engine-id="${engine.id}" data-role-id="${role.id}">Affecter</button>`;
            } else {
                roleCell.innerHTML = '<span class="no-role">-</span>'; // If role not applicable for this engine
                roleCell.classList.add('no-role-cell');
            }
            engineRow.appendChild(roleCell);
        });
        rosterGrid.appendChild(engineRow);
    });
    addAssignmentListeners(); // Add listeners for assign/clear buttons
}

/**
 * Renders the engine details page.
 * @param {string} engineId - The ID of the engine to display.
 */
function renderEngineDetails(engineId) {
    const engine = DEFAULT_ENGINES.find(e => e.id === engineId);
    if (!engine) {
        displayMessageModal('Erreur', 'Engin non trouvé.', 'error');
        return;
    }

    detailedEngineGrid.innerHTML = '';
    engineDetailsPage.style.display = 'flex'; // Show the details page

    // Display engine name
    const engineNameHeader = document.createElement('h2');
    engineNameHeader.textContent = engine.name;
    detailedEngineGrid.appendChild(engineNameHeader);

    // Render roles and assigned personnel
    engine.roles.forEach(role => {
        const roleDiv = document.createElement('div');
        roleDiv.classList.add('engine-detail-role');

        const assignedAgentId = currentAssignments[engine.id]?.[role.id];
        let assignedAgentName = 'Non affecté';
        if (assignedAgentId) {
            const assignedAgent = allAgentsData.find(a => a._id === assignedAgentId);
            if (assignedAgent) {
                assignedAgentName = `${assignedAgent.prenom} ${assignedAgent.nom}`;
            }
        }
        
        roleDiv.innerHTML = `
            <h3>${role.name}</h3>
            <p>Affecté: <span class="assigned-person">${assignedAgentName}</span></p>
            ${role.requiredQual.length > 0 ? 
                `<p>Qualifications requises: <span class="required-qual">${role.requiredQual.map(qId => availableQualifications.find(aq => aq.id === qId)?.name || qId).join(', ')}</span></p>` : ''
            }
        `;
        detailedEngineGrid.appendChild(roleDiv);
    });
}


// --- Event Handlers ---

/**
 * Handles date input change.
 */
async function handleDateChange() {
    currentRosterDate = dateInput.value ? parseYYYYMMDDToDate(dateInput.value) : new Date();
    await loadAndRenderAllData();
}

/**
 * Handles navigation to previous/next day.
 * @param {number} direction - -1 for previous, 1 for next.
 */
async function navigateDay(direction) {
    currentRosterDate.setDate(currentRosterDate.getDate() + direction);
    dateInput.value = formatDateToYYYYMMDD(currentRosterDate);
    await loadAndRenderAllData();
}

/**
 * Handles drag start event for agent cards.
 * @param {DragEvent} e - The drag event.
 */
function handleDragStart(e) {
    e.dataTransfer.setData('text/plain', e.target.dataset.agentId);
    e.dataTransfer.effectAllowed = 'move';
    e.target.classList.add('dragging');
}

/**
 * Handles drag over event for drop zones.
 * @param {DragEvent} e - The drag event.
 */
function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (e.target.classList.contains('on-duty-agents-grid') || e.target.closest('.on-duty-agents-grid')) {
        e.currentTarget.classList.add('drag-over');
    }
}

/**
 * Handles drag leave event for drop zones.
 * @param {DragEvent} e - The drag event.
 */
function handleDragLeave(e) {
    e.currentTarget.classList.remove('drag-over');
}

/**
 * Handles drop event for on-duty agents grid.
 * @param {DragEvent} e - The drop event.
 */
async function handleDropOnDuty(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    const agentId = e.dataTransfer.getData('text/plain');

    // If dropping onto an existing on-duty agent, reorder
    const targetAgentCard = e.target.closest('.agent-card.on-duty-agent');
    if (targetAgentCard) {
        const targetAgentId = targetAgentCard.dataset.agentId;
        const draggedIndex = onDutyAgents.indexOf(agentId);
        const targetIndex = onDutyAgents.indexOf(targetAgentId);

        if (draggedIndex !== -1 && targetIndex !== -1) {
            const [removed] = onDutyAgents.splice(draggedIndex, 1);
            onDutyAgents.splice(targetIndex, 0, removed);
        }
    } else if (!onDutyAgents.includes(agentId)) {
        onDutyAgents.push(agentId);
    }
    
    await saveRosterConfig(formatDateToYYYYMMDD(currentRosterDate), currentRosterConfig.timeSlots, onDutyAgents);
    renderOnDutyAgentsGrid();
}

/**
 * Handles removing an agent from on-duty list.
 * @param {Event} e - The click event.
 */
async function handleRemoveOnDutyAgent(e) {
    const agentIdToRemove = e.target.dataset.agentId;
    onDutyAgents = onDutyAgents.filter(id => id !== agentIdToRemove);
    await saveRosterConfig(formatDateToYYYYMMDD(currentRosterDate), currentRosterConfig.timeSlots, onDutyAgents);
    renderOnDutyAgentsGrid();
    // Also remove from any manual assignment if they were assigned
    for (const engineId in currentAssignments) {
        for (const roleId in currentAssignments[engineId]) {
            if (currentAssignments[engineId][roleId] === agentIdToRemove) {
                delete currentAssignments[engineId][roleId];
            }
        }
    }
    renderRosterGrid();
}

/**
 * Handles assignment button click for manual assignment modal.
 * @param {Event} e - The click event.
 */
function handleAssignButtonClick(e) {
    const engineId = e.target.dataset.engineId;
    const roleId = e.target.dataset.roleId;

    openPersonnelAssignmentModal(engineId, roleId);
}

/**
 * Handles clearing a manual assignment.
 * @param {Event} e - The click event.
 */
function handleClearAssignment(e) {
    const engineId = e.target.dataset.engineId;
    const roleId = e.target.dataset.roleId;
    
    if (currentAssignments[engineId]) {
        delete currentAssignments[engineId][roleId];
    }
    // Save assignments (this can be done on page leave or explicitly)
    // For now, re-render to reflect the change
    renderRosterGrid();
    displayMessageModal('Affectation Effacée', 'L\'affectation a été retirée.', 'info');
}


// --- Assignment Modal Logic ---

let currentModalAssignment = { engineId: null, roleId: null };

function openPersonnelAssignmentModal(engineId, roleId) {
    currentModalAssignment = { engineId, roleId };
    personnelAssignmentModalTitle.textContent = `Affecter personnel à ${DEFAULT_ENGINES.find(e => e.id === engineId)?.name || 'Engin'} - ${DEFAULT_ENGINES.find(e => e.id === engineId)?.roles.find(r => r.id === roleId)?.name || 'Rôle'}`;

    renderAvailableAgentsInModal();
    renderEngineRolesInModal();

    personnelAssignmentModal.style.display = 'block';
}

function closePersonnelAssignmentModal() {
    personnelAssignmentModal.style.display = 'none';
}

function renderAvailableAgentsInModal() {
    availableAgentsInModalList.innerHTML = '';
    const agentsForModal = onDutyAgents.map(agentId => allAgentsData.find(a => a._id === agentId)).filter(Boolean); // Only on-duty agents
    
    if (agentsForModal.length === 0) {
        availableAgentsInModalList.innerHTML = '<p class="info-message">Aucun agent d\'astreinte.</p>';
        return;
    }

    agentsForModal.forEach(agent => {
        const agentDiv = document.createElement('div');
        agentDiv.classList.add('agent-card', 'draggable');
        agentDiv.dataset.agentId = agent._id;
        agentDiv.setAttribute('draggable', 'true');
        agentDiv.textContent = `${agent.prenom} ${agent.nom}`;
        availableAgentsInModalList.appendChild(agentDiv);
    });
    // Add drag listeners for agents within the modal
    availableAgentsInModalList.querySelectorAll('.draggable').forEach(item => {
        item.addEventListener('dragstart', handleDragStart);
    });
}

function renderEngineRolesInModal() {
    engineRolesContainer.innerHTML = '';
    const engine = DEFAULT_ENGINES.find(e => e.id === currentModalAssignment.engineId);
    if (!engine) return;

    const targetRole = engine.roles.find(r => r.id === currentModalAssignment.roleId);
    if (!targetRole) return;

    const roleDropZone = document.createElement('div');
    roleDropZone.classList.add('role-drop-zone');
    roleDropZone.dataset.roleId = targetRole.id;
    
    let assignedAgentId = currentAssignments[engine.id]?.[targetRole.id];
    if (assignedAgentId) {
        const assignedAgent = allAgentsData.find(a => a._id === assignedAgentId);
        roleDropZone.innerHTML = `
            <p>${targetRole.name}:</p>
            <div class="assigned-agent-in-modal" data-agent-id="${assignedAgentId}">
                ${assignedAgent.prenom} ${assignedAgent.nom}
                <button class="remove-modal-assignment-btn" data-agent-id="${assignedAgentId}">&times;</button>
            </div>
        `;
    } else {
        roleDropZone.innerHTML = `
            <p>${targetRole.name}:</p>
            <div class="placeholder-text">Déposez l'agent ici</div>
        `;
    }

    engineRolesContainer.appendChild(roleDropZone);

    // Add drag/drop listeners for the role drop zone
    roleDropZone.addEventListener('dragover', handleModalDragOver);
    roleDropZone.addEventListener('dragleave', handleModalDragLeave);
    roleDropZone.addEventListener('drop', handleModalDrop);

    // Add listener for removing assignment in modal
    const removeModalAssignmentBtn = roleDropZone.querySelector('.remove-modal-assignment-btn');
    if (removeModalAssignmentBtn) {
        removeModalAssignmentBtn.addEventListener('click', handleRemoveModalAssignment);
    }
}

function handleModalDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    e.currentTarget.classList.add('drag-over');
}

function handleModalDragLeave(e) {
    e.currentTarget.classList.remove('drag-over');
}

function handleModalDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    const agentId = e.dataTransfer.getData('text/plain');
    const roleId = e.currentTarget.dataset.roleId;
    const engineId = currentModalAssignment.engineId;

    if (!currentAssignments[engineId]) {
        currentAssignments[engineId] = {};
    }
    // Check if agent already assigned to another role in same engine
    let alreadyAssignedToRole = false;
    for (const rId in currentAssignments[engineId]) {
        if (currentAssignments[engineId][rId] === agentId && rId !== roleId) {
            alreadyAssignedToRole = true;
            break;
        }
    }

    if (alreadyAssignedToRole) {
        displayMessageModal('Affectation multiple', 'Cet agent est déjà affecté à un autre rôle sur cet engin. Veuillez le retirer de cet autre rôle d\'abord.', 'warning');
        return;
    }

    currentAssignments[engineId][roleId] = agentId;
    renderEngineRolesInModal(); // Re-render modal role section
    renderRosterGrid(); // Re-render main roster grid
}

function handleRemoveModalAssignment(e) {
    const assignedAgentCard = e.target.closest('.assigned-agent-in-modal');
    const agentIdToRemove = assignedAgentCard.dataset.agentId;
    const roleId = e.target.closest('.role-drop-zone').dataset.roleId;
    const engineId = currentModalAssignment.engineId;

    if (currentAssignments[engineId]) {
        delete currentAssignments[engineId][roleId];
    }
    renderEngineRolesInModal();
    renderRosterGrid();
}


// --- Automatic Generation Logic ---

/**
 * Generates a roster automatically based on available personnel and engine requirements.
 */
async function generateAutomaticRoster() {
    displayMessageModal('Génération Automatique', 'Tentative de génération automatique de la feuille de garde...', 'info');
    
    // Reset current assignments
    currentAssignments = {};

    const dateKey = formatDateToYYYYMMDD(currentRosterDate);
    const availabilityData = await fetchAgentAvailabilityAndOnCall(dateKey); // Fetch all availability

    const personnelWithAvailability = availabilityData.available.filter(agent => {
        // Check if agent is in the onDutyAgents list (draggable list)
        return onDutyAgents.includes(agent.id);
    }).map(agent => ({
        ...agent,
        // Convert availability from "HH:MM - HH:MM" strings to { start, end } index ranges
        availableSlotsIndices: agent.availabilities.flatMap(slotStr => {
            // Find the index of the slot string in a full 24h cycle (00:00-23:30)
            const [startTime] = slotStr.split(' - ');
            const [hour, minute] = startTime.split(':').map(Number);
            const slotIndex = (hour * 2 + (minute / 30) + 48 - 14) % 48; // Adjust based on START_HOUR (7)
            return slotIndex;
        }).sort((a, b) => a - b)
    }));

    // Filter agents for the current time slot (Jour/Nuit)
    const currentSlot = currentRosterConfig.timeSlots.find(slot => slot.id === currentSelectedTimeSlot);
    if (!currentSlot) {
        displayMessageModal('Erreur', 'Créneau horaire non trouvé pour la génération automatique.', 'error');
        return;
    }

    // Determine the relevant slot indices for the current time slot (e.g., 7:00-19:00 for day)
    const relevantSlotIndices = [];
    let startIdx = (currentSlot.startHour * 2 + (currentSlot.startHour % 1) * 30 / 30);
    let endIdx = (currentSlot.endHour * 2 + (currentSlot.endHour % 1) * 30 / 30);

    if (currentSlot.startHour < currentSlot.endHour) { // Same day
        for (let i = startIdx; i < endIdx; i++) {
            relevantSlotIndices.push(i);
        }
    } else { // Overnight slot
        for (let i = startIdx; i < 48; i++) { // From start to end of day
            relevantSlotIndices.push(i);
        }
        for (let i = 0; i < endIdx; i++) { // From start of next day to end hour
            relevantSlotIndices.push(i);
        }
    }
    
    const availablePersonnelForSlot = personnelWithAvailability.filter(agent => 
        relevantSlotIndices.some(slotIdx => agent.availableSlotsIndices.includes(slotIdx))
    );

    const usedAgents = new Set();
    const sortedEngines = [...DEFAULT_ENGINES].sort((a,b) => a.id.localeCompare(b.id)); // Sort for consistent assignment

    sortedEngines.forEach(engine => {
        engine.roles.forEach(role => {
            // Try to find a suitable agent
            const foundAgent = availablePersonnelForSlot.find(agent => 
                !usedAgents.has(agent.id) && // Agent not already used
                role.requiredQual.every(reqQual => agent.qualifications.includes(reqQual)) && // Has required qualifications
                relevantSlotIndices.some(slotIdx => agent.availableSlotsIndices.includes(slotIdx)) // Agent available in slot
            );

            if (foundAgent) {
                if (!currentAssignments[engine.id]) {
                    currentAssignments[engine.id] = {};
                }
                currentAssignments[engine.id][role.id] = foundAgent.id;
                usedAgents.add(foundAgent.id);
            }
        });
    });

    renderRosterGrid(); // Re-render with new assignments
    displayMessageModal('Génération terminée', 'La feuille de garde a été générée automatiquement.', 'success');
}


// --- Initialization and Event Listeners Setup ---

async function loadAndRenderAllData() {
    showLoading(true);
    const dateKey = formatDateToYYYYMMDD(currentRosterDate);
    
    await fetchRosterConfig(dateKey); // Loads time slots and onDutyAgents
    await fetchAllAgents(); // Loads all agent details for display
    await fetchAgentAvailabilityAndOnCall(dateKey); // Populates currentAvailablePersonnel

    renderTimeSlotButtons();
    renderOnDutyAgentsGrid();
    renderAvailablePersonnel(currentAvailablePersonnel.filter(agent => !onDutyAgents.includes(agent.id))); // Filter out on-duty agents
    renderRosterGrid(); // Initial render of the main roster grid

    showLoading(false);
}

function addDragAndDropListeners() {
    document.querySelectorAll('.agent-card.draggable').forEach(item => {
        item.addEventListener('dragstart', handleDragStart);
    });
    onDutyAgentsGrid.addEventListener('dragover', handleDragOver);
    onDutyAgentsGrid.addEventListener('dragleave', handleDragLeave);
    onDutyAgentsGrid.addEventListener('drop', handleDropOnDuty);
}

function addOnDutyRemoveListeners() {
    document.querySelectorAll('.remove-on-duty-btn').forEach(button => {
        button.addEventListener('click', handleRemoveOnDutyAgent);
    });
}

function addOnDutyDragAndDropListeners() {
    // Allows reordering within on-duty grid
    onDutyAgentsGrid.querySelectorAll('.agent-card.on-duty-agent').forEach(card => {
        card.addEventListener('dragstart', handleDragStart);
    });
    onDutyAgentsGrid.addEventListener('dragover', handleDragOver);
    onDutyAgentsGrid.addEventListener('dragleave', handleDragLeave);
    onDutyAgentsGrid.addEventListener('drop', handleDropOnDuty); // Same drop handler for reordering
}

function addAssignmentListeners() {
    document.querySelectorAll('.assign-btn').forEach(btn => {
        btn.addEventListener('click', handleAssignButtonClick);
    });
    document.querySelectorAll('.clear-assignment-btn').forEach(btn => {
        btn.addEventListener('click', handleClearAssignment);
    });
    // Add click listener for engine rows to show details
    document.querySelectorAll('.engine-row').forEach(row => {
        row.addEventListener('click', (e) => {
            // Prevent click on buttons from triggering details page
            if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
                return;
            }
            renderEngineDetails(row.dataset.engineId);
        });
    });
}


document.addEventListener('DOMContentLoaded', async () => {
    // Check if user is logged in and is admin
    const token = sessionStorage.getItem('jwtToken');
    const user = JSON.parse(sessionStorage.getItem('agent'));
    
    if (!token || !user || user.role !== 'admin') {
        window.location.href = 'login.html';
        return;
    }

    // Fetch initial data for qualifications, grades, functions
    await fetchQualifications();
    await fetchGrades();
    await fetchFunctions();

    // Set today's date
    dateInput.value = formatDateToYYYYMMDD(currentRosterDate);

    // Initial load and render
    await loadAndRenderAllData();

    // Event listeners
    dateInput.addEventListener('change', handleDateChange);
    prevDayButton.addEventListener('click', () => navigateDay(-1));
    nextDayButton.addEventListener('click', () => navigateDay(1));
    generateAutoBtn.addEventListener('click', generateAutomaticRoster);
    exportRosterPdfBtn.addEventListener('click', exportRosterToPdf);
    closePersonnelAssignmentModalBtn.addEventListener('click', closePersonnelAssignmentModal);
    backToRosterBtn.addEventListener('click', () => {
        engineDetailsPage.style.display = 'none'; // Hide details page
    });
});

// --- PDF Export Logic for Roster ---
function exportRosterToPdf() {
    const rosterContentToExport = document.querySelector('.roster-content');
    
    const options = {
        scale: 2, // Increase resolution
        useCORS: true,
        allowTaint: true,
        ignoreElements: (element) => {
            // Do not ignore anything essential, but hide temporary elements if any
            return false;
        }
    };

    // Temporarily adjust styles for export to avoid issues with sticky headers, etc.
    const stickyElements = document.querySelectorAll('.roster-header, .roster-header-row .header-cell, .engine-name-cell');
    stickyElements.forEach(el => {
        el.style.position = 'static';
        el.style.left = 'auto';
        el.style.top = 'auto';
        el.style.zIndex = 'auto';
        el.style.width = 'auto';
        el.style.minWidth = 'auto';
        el.style.maxWidth = 'auto';
        el.style.flexShrink = '0';
    });

    html2canvas(rosterContentToExport, options).then(canvas => {
        // Restore original styles
        stickyElements.forEach(el => {
            el.style.position = '';
            el.style.left = '';
            el.style.top = '';
            el.style.zIndex = '';
            el.style.width = '';
            el.style.minWidth = '';
            el.style.maxWidth = '';
            el.style.flexShrink = '';
        });

        const imgData = canvas.toDataURL('image/png');
        const { jsPDF } = window.jspdf;

        const pdf = new jsPDF('landscape', 'mm', 'a4');
        const imgWidth = 280; // A4 landscape width minus margins
        const pageHeight = 200; // A4 landscape height minus margins
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
        
        pdf.save(`feuille_de_garde_${formatDateToYYYYMMDD(currentRosterDate)}.pdf`);
        displayMessageModal('Exportation PDF', 'La feuille de garde a été exportée en PDF.', 'info');
    }).catch(error => {
        console.error('Erreur lors de la création du PDF de la feuille de garde :', error);
        displayMessageModal('Erreur', 'Impossible d\'exporter la feuille de garde en PDF. Veuillez réessayer.', 'error');
        // Ensure styles are restored even on error
        stickyElements.forEach(el => {
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
