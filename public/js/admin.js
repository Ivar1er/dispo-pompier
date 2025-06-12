const days = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const API_BASE_URL = "https://dispo-pompier.onrender.com";

let currentWeek = getCurrentWeek();
let currentDay = 'lundi';
let planningData = {};
let agentDisplayInfos = {};
let availableGrades = [];
let availableFonctions = [];

// --- DOM Elements pour la navigation principale (onglets) ---
const mainTabButtons = document.querySelectorAll('.main-tab');
const mainTabContents = document.querySelectorAll('.main-tab-content');

// --- DOM Elements pour la vue "Planning Global" ---
// NOTE: 'planningControls' rÃ©fÃ¨re maintenant Ã  la SECTION entiÃ¨re du planning global,
// qui inclut les day-tabs et le planning-table.
const planningGlobalSection = document.getElementById('global-planning-view'); // RenommÃ© pour plus de clartÃ©
const weekSelect = document.getElementById("week-select");
const dateRangeDisplay = document.getElementById("date-range");
const planningContainer = document.getElementById("global-planning"); // L'ID pour le conteneur *rÃ©el* du tableau de planning
const tabButtons = document.querySelectorAll(".tab"); // Boutons de jour (Lundi, Mardi...)
const adminInfo = document.getElementById("admin-info");
const exportPdfButton = document.getElementById("export-pdf"); // RÃ©cupÃ©rer le bouton d'export PDF

// NOUVEAU: Le conteneur des contrÃ´les de semaine et d'export dans le header
const headerControlsPermanent = document.querySelector('.header-controls-permanent');


// --- DOM Elements pour la vue "Gestion des Agents" ---
const addAgentForm = document.getElementById('addAgentForm');
const newAgentGradesCheckboxes = document.getElementById('newAgentGradesCheckboxes');
const newAgentFonctionsCheckboxes = document.getElementById('newAgentFonctionsCheckboxes');
const addAgentMessage = document.getElementById('addAgentMessage');
const agentsTableBody = document.getElementById('agentsTableBody');
const listAgentsMessage = document.getElementById('listAgentsMessage');

// --- DOM Elements pour la Modale de modification d'agent ---
const editAgentModal = document.getElementById('editAgentModal');
const editAgentForm = document.getElementById('editAgentForm');
const closeAgentModalButton = editAgentModal ? editAgentModal.querySelector('.close-button') : null;
const gradesCheckboxes = document.getElementById('gradesCheckboxes');
const fonctionsCheckboxes = document.getElementById('fonctionsCheckboxes');
const editAgentMessage = document.getElementById('editAgentMessage');

// --- DOM Elements pour la vue "Gestion des Grades" ---
const addGradeForm = document.getElementById('addGradeForm');
const addGradeMessage = document.getElementById('addGradeMessage');
const gradesTableBody = document.getElementById('gradesTableBody');
const listGradesMessage = document.getElementById('listGradesMessage');

// --- DOM Elements pour la Modale de modification de grade ---
const editGradeModal = document.getElementById('editGradeModal');
const editGradeForm = document.getElementById('editGradeForm');
const closeGradeModalButton = editGradeModal ? editGradeModal.querySelector('.close-button') : null;
const editGradeMessage = document.getElementById('editGradeMessage');

// --- DOM Elements pour la vue "Gestion des Fonctions" ---
const addFonctionForm = document.getElementById('addFonctionForm');
const addFonctionMessage = document.getElementById('addFonctionMessage');
const fonctionsTableBody = document.getElementById('fonctionsTableBody');
const listFonctionsMessage = document.getElementById('listFonctionsMessage');

// --- DOM Elements pour la Modale de modification de fonction ---
const editFonctionModal = document.getElementById('editFonctionModal');
const editFonctionForm = document.getElementById('editFonctionForm');
const closeFonctionModalButton = editFonctionModal ? editFonctionModal.querySelector('.close-button') : null;
const editFonctionMessage = document.getElementById('editFonctionMessage');

// Global DOM Elements
const loadingSpinner = document.getElementById("loading-spinner");
const logoutButton = document.getElementById("logout-btn");

// --- Fonctions utilitaires ---
function showMessage(element, message, type = 'info') {
    element.textContent = message;
    element.style.display = 'block';
    if (type === 'success') {
        element.style.backgroundColor = "#dff0d8";
        element.style.borderColor = "#d6e9c6";
        element.style.color = "#3c763d";
    } else if (type === 'error') {
        element.style.backgroundColor = "#ffe6e6";
        element.style.borderColor = "#e6a4a4";
        element.style.color = "#a94442";
    } else { // info
        element.style.backgroundColor = "#d9edf7";
        element.style.borderColor = "#bce8f1";
        element.style.color = "#31708f";
    }

    setTimeout(() => {
        element.style.display = 'none';
        element.textContent = '';
        element.style.backgroundColor = "";
        element.style.borderColor = "";
        element.style.color = "";
    }, 3000);
}

function showLoading(isLoading, forPdf = false) {
    if (isLoading) {
        loadingSpinner.classList.remove("hidden");
        document.querySelectorAll('button, select, input, a').forEach(el => {
            if (el.id !== 'logout-btn') { // Ne pas dÃ©sactiver le bouton de dÃ©connexion
                el.disabled = true;
                if (el.tagName === 'A') el.classList.add('disabled-link'); // Ajoute une classe pour les liens
            }
        });
        mainTabButtons.forEach(btn => btn.disabled = true);

        if (forPdf) {
            adminInfo.textContent = "GÃ©nÃ©ration du PDF en cours, veuillez patienter...";
            adminInfo.style.backgroundColor = "#fff3cd";
            adminInfo.style.borderColor = "#ffeeba";
            adminInfo.style.color = "#856404";
        }
    } else {
        loadingSpinner.classList.add("hidden");
        // RÃ©activer les contrÃ´les globaux et ceux de l'onglet actif
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


// --- Fonctions de navigation ---
function showMainTab(tabName) {
    mainTabContents.forEach(content => {
        content.classList.remove('active');
    });
    mainTabButtons.forEach(button => {
        button.classList.remove('active');
    });

    const activeContent = document.getElementById(tabName);
    if (activeContent) {
        activeContent.classList.add('active');
    }
    const activeButton = document.querySelector(`.main-tab[data-main-tab="${tabName}"]`);
    if (activeButton) {
        activeButton.classList.add('active');
    }

    // GÃ©rer l'affichage des contrÃ´les permanents du header (sÃ©lecteur de semaine, export)
    if (tabName === 'global-planning-view') {
        headerControlsPermanent.style.display = 'flex'; // Afficher les contrÃ´les
        loadWeekPlanning(); // Charger le planning lorsque l'onglet est actif
    } else {
        headerControlsPermanent.style.display = 'none'; // Masquer les contrÃ´les
    }

    // Cacher ou afficher le message admin-info
    if (tabName === 'global-planning-view') {
        adminInfo.style.display = 'block';
        adminInfo.textContent = "Vue du planning global des agents.";
        adminInfo.style.backgroundColor = ""; // Reset styles
        adminInfo.style.borderColor = "";
        adminInfo.style.color = "";
    } else {
        adminInfo.style.display = 'none';
    }

    // Mettre Ã  jour l'Ã©tat des autres sections si elles doivent Ãªtre masquÃ©es par dÃ©faut.
    // Votre CSS `.main-tab-content` a dÃ©jÃ  `display: none;` et `.active` le met Ã  `display: block;`.
    // Donc cette logique est gÃ©rÃ©e par le CSS et l'ajout/suppression de la classe 'active'.
}

function showDay(day) {
    currentDay = day;
    tabButtons.forEach(button => {
        button.classList.remove('active');
        if (button.dataset.day === day) {
            button.classList.add('active');
        }
    });

    document.querySelectorAll('.day-content').forEach(content => {
        content.classList.remove('active');
        if (content.id === `${day}-planning`) {
            content.classList.add('active');
        }
    });

    renderPlanningTable(planningData[currentWeek], currentDay);
}

// --- Fonctions de gestion de semaine ---
function getCurrentWeek() {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const diff = now - startOfYear;
    const oneDay = 1000 * 60 * 60 * 24;
    const dayOfYear = Math.floor(diff / oneDay);
    return Math.ceil(dayOfYear / 7);
}

function getWeekRange(weekNumber) {
    const jan1 = new Date(new Date().getFullYear(), 0, 1);
    const daysOffset = (weekNumber - 1) * 7;
    const startDate = new Date(jan1.setDate(jan1.getDate() + daysOffset));
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6); // 6 jours aprÃ¨s le dÃ©but pour la fin de semaine

    const options = { day: '2-digit', month: '2-digit' };
    return `${startDate.toLocaleDateString('fr-FR', options)} au ${endDate.toLocaleDateString('fr-FR', options)}`;
}

function populateWeekSelect() {
    const currentYear = new Date().getFullYear();
    const weeksInYear = 52; // La plupart des annÃ©es ont 52, certaines 53
    weekSelect.innerHTML = ''; // Clear previous options

    for (let i = 1; i <= weeksInYear + 1; i++) { // +1 pour s'assurer d'avoir 53 si besoin
        const option = document.createElement('option');
        option.value = i;
        option.textContent = `Semaine ${i} (${getWeekRange(i)})`;
        if (i === currentWeek) {
            option.selected = true;
        }
        weekSelect.appendChild(option);
    }
    dateRangeDisplay.textContent = getWeekRange(currentWeek);
}

// --- Fonctions de chargement des donnÃ©es ---
async function fetchPlanningData(week) {
    showLoading(true);
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            window.location.href = 'index.html'; // Rediriger si pas de token
            return;
        }
        const response = await fetch(`${API_BASE_URL}/planning?week=${week}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) {
            if (response.status === 401) { // Unauthorized
                logout(); // DÃ©connecter l'utilisateur si le token est invalide
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        // Le format de l'API devrait Ãªtre un objet oÃ¹ les clÃ©s sont les IDs des agents
        // et les valeurs sont des objets avec les jours et les crÃ©neaux.
        planningData[week] = data.reduce((acc, agent) => {
            acc[agent.id] = agent.planning;
            return acc;
        }, {});
        console.log("Planning data fetched:", planningData[week]); // Debugging
        renderPlanningTable(planningData[week], currentDay);
    } catch (error) {
        console.error("Error fetching planning data:", error);
        showMessage(adminInfo, "Erreur lors du chargement du planning. Veuillez rÃ©essayer.", 'error');
    } finally {
        showLoading(false);
    }
}

async function fetchAgentDisplayInfos() {
    showLoading(true);
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/admin/agents`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) {
            if (response.status === 401) logout();
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const agents = await response.json();
        agentDisplayInfos = agents.reduce((acc, agent) => {
            acc[agent.id] = { nom: agent.nom, prenom: agent.prenom };
            return acc;
        }, {});
    } catch (error) {
        console.error("Error fetching agent display infos:", error);
        showMessage(adminInfo, "Erreur lors du chargement des informations des agents.", 'error');
    } finally {
        showLoading(false);
    }
}

async function fetchGrades() {
    showLoading(true);
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/grades`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            if (response.status === 401) logout();
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        availableGrades = await response.json();
        console.log("Grades fetched:", availableGrades);
    } catch (error) {
        console.error("Error fetching grades:", error);
        showMessage(adminInfo, "Erreur lors du chargement des grades.", 'error');
    } finally {
        showLoading(false);
    }
}

async function fetchFonctions() {
    showLoading(true);
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/fonctions`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            if (response.status === 401) logout();
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        availableFonctions = await response.json();
        console.log("Fonctions fetched:", availableFonctions);
    } catch (error) {
        console.error("Error fetching fonctions:", error);
        showMessage(adminInfo, "Erreur lors du chargement des fonctions.", 'error');
    } finally {
        showLoading(false);
    }
}


// --- Fonctions de rendu du planning ---
function renderPlanningTable(weekPlanning, day) {
    const currentDayPlanningDiv = document.getElementById(`${day}-planning-table`);
    if (!currentDayPlanningDiv) {
        console.error(`Element for day planning table '${day}-planning-table' not found.`);
        return;
    }
    currentDayPlanningDiv.innerHTML = ''; // Clear existing table

    const table = document.createElement('table');
    table.classList.add('planning-table');

    // Create table header
    const thead = table.createTHead();
    const headerRow = thead.insertRow();
    headerRow.insertCell().textContent = 'Agent'; // First column for agent name

    // Add time slots (00:00 to 23:00)
    for (let i = 0; i < 24; i++) {
        const hour = String(i).padStart(2, '0');
        headerRow.insertCell().textContent = `${hour}h`;
    }
    headerRow.insertCell().textContent = 'Actions'; // Last column for actions

    // Create table body
    const tbody = table.createTBody();

    // Sort agents by last name then first name
    const sortedAgentIds = Object.keys(weekPlanning || {}).sort((idA, idB) => {
        const agentA = agentDisplayInfos[idA] || { nom: '', prenom: '' };
        const agentB = agentDisplayInfos[idB] || { nom: '', prenom: '' };
        const compareNom = agentA.nom.localeCompare(agentB.nom);
        if (compareNom !== 0) return compareNom;
        return agentA.prenom.localeCompare(agentB.prenom);
    });

    if (sortedAgentIds.length === 0) {
        const row = tbody.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 26; // Agent + 24 slots + Actions
        cell.textContent = "Aucun agent disponible pour cette semaine ou ce jour.";
        cell.style.textAlign = "center";
        currentDayPlanningDiv.appendChild(table);
        return;
    }

    sortedAgentIds.forEach(agentId => {
        const agentPlanningForDay = weekPlanning[agentId] ? weekPlanning[agentId][day] || Array(24).fill(0) : Array(24).fill(0);
        const agentInfo = agentDisplayInfos[agentId] || { nom: 'Inconnu', prenom: '' };

        const row = tbody.insertRow();
        row.dataset.agentId = agentId;

        // Agent Name Cell
        const nameCell = row.insertCell();
        nameCell.textContent = `${agentInfo.nom} ${agentInfo.prenom}`;

        // Planning Slots Cells
        for (let i = 0; i < 24; i++) {
            const slotCell = row.insertCell();
            slotCell.classList.add('slot-cell');

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.dataset.hour = i;
            checkbox.dataset.agentId = agentId;
            checkbox.checked = agentPlanningForDay[i] === 1;
            checkbox.classList.add('planning-checkbox');
            checkbox.disabled = true; // Disabled by default, enabled in edit mode

            slotCell.appendChild(checkbox);

            slotCell.classList.add(agentPlanningForDay[i] === 1 ? 'occupied' : 'free');
        }

        // Actions Cell
        const actionsCell = row.insertCell();
        actionsCell.classList.add('actions-cell');

        const editButton = document.createElement('button');
        editButton.textContent = 'Modifier';
        editButton.classList.add('btn', 'btn-primary', 'edit-planning-btn');
        editButton.dataset.agentId = agentId;
        actionsCell.appendChild(editButton);

        const saveButton = document.createElement('button');
        saveButton.textContent = 'Sauvegarder';
        saveButton.classList.add('btn', 'btn-success', 'save-planning-btn', 'hidden');
        saveButton.dataset.agentId = agentId;
        actionsCell.appendChild(saveButton);

        const cancelButton = document.createElement('button');
        cancelButton.textContent = 'Annuler';
        cancelButton.classList.add('btn', 'btn-secondary', 'cancel-planning-btn', 'hidden');
        cancelButton.dataset.agentId = agentId;
        actionsCell.appendChild(cancelButton);
    });

    currentDayPlanningDiv.appendChild(table);

    // Add event listeners for edit, save, cancel buttons
    addPlanningEventListeners();
}

function addPlanningEventListeners() {
    document.querySelectorAll('.edit-planning-btn').forEach(button => {
        button.removeEventListener('click', handleEditPlanning); // Ã‰viter les Ã©couteurs multiples
        button.addEventListener('click', handleEditPlanning);
    });
    document.querySelectorAll('.save-planning-btn').forEach(button => {
        button.removeEventListener('click', handleSavePlanning);
        button.addEventListener('click', handleSavePlanning);
    });
    document.querySelectorAll('.cancel-planning-btn').forEach(button => {
        button.removeEventListener('click', handleCancelPlanning);
        button.addEventListener('click', handleCancelPlanning);
    });
}

function handleEditPlanning(event) {
    const agentId = event.target.dataset.agentId;
    const row = event.target.closest('tr');
    if (!row) return;

    // Store original state
    const checkboxes = row.querySelectorAll('.planning-checkbox');
    checkboxes.forEach(checkbox => {
        checkbox.dataset.originalChecked = checkbox.checked; // Store original state
        checkbox.disabled = false; // Enable for editing
        checkbox.addEventListener('change', updateSlotClass); // Add listener for immediate visual feedback
    });

    row.classList.add('editing-row');
    row.querySelector('.edit-planning-btn').classList.add('hidden');
    row.querySelector('.save-planning-btn').classList.remove('hidden');
    row.querySelector('.cancel-planning-btn').classList.remove('hidden');
}

function updateSlotClass(event) {
    const checkbox = event.target;
    const slotCell = checkbox.closest('.slot-cell');
    if (checkbox.checked) {
        slotCell.classList.remove('free');
        slotCell.classList.add('occupied');
    } else {
        slotCell.classList.remove('occupied');
        slotCell.classList.add('free');
    }
}

async function handleSavePlanning(event) {
    const agentId = event.target.dataset.agentId;
    const row = event.target.closest('tr');
    if (!row) return;

    const checkboxes = row.querySelectorAll('.planning-checkbox');
    const newPlanning = Array(24).fill(0);
    checkboxes.forEach(checkbox => {
        const hour = parseInt(checkbox.dataset.hour);
        newPlanning[hour] = checkbox.checked ? 1 : 0;
    });

    showLoading(true);
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/admin/planning/${agentId}/week/${currentWeek}/day/${currentDay}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ planning: newPlanning })
        });

        if (!response.ok) {
            if (response.status === 401) logout();
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        showMessage(adminInfo, `Planning de ${agentDisplayInfos[agentId].nom} mis Ã  jour avec succÃ¨s !`, 'success');
        console.log("Update successful:", result);

        // Update local planningData
        if (!planningData[currentWeek]) planningData[currentWeek] = {};
        if (!planningData[currentWeek][agentId]) planningData[currentWeek][agentId] = {};
        planningData[currentWeek][agentId][currentDay] = newPlanning;

        // Exit edit mode
        checkboxes.forEach(checkbox => {
            checkbox.disabled = true;
            checkbox.removeEventListener('change', updateSlotClass);
            delete checkbox.dataset.originalChecked; // Clean up stored state
        });
        row.classList.remove('editing-row');
        row.querySelector('.edit-planning-btn').classList.remove('hidden');
        row.querySelector('.save-planning-btn').classList.add('hidden');
        row.querySelector('.cancel-planning-btn').classList.add('hidden');

    } catch (error) {
        console.error("Error saving planning:", error);
        showMessage(adminInfo, "Erreur lors de la sauvegarde du planning. Veuillez rÃ©essayer.", 'error');
        // Revert to original state on error
        checkboxes.forEach(checkbox => {
            checkbox.checked = checkbox.dataset.originalChecked === 'true'; // Revert to original state
            updateSlotClass({ target: checkbox }); // Update visual state
            checkbox.disabled = true;
            checkbox.removeEventListener('change', updateSlotClass);
            delete checkbox.dataset.originalChecked;
        });
        row.classList.remove('editing-row');
        row.querySelector('.edit-planning-btn').classList.remove('hidden');
        row.querySelector('.save-planning-btn').classList.add('hidden');
        row.querySelector('.cancel-planning-btn').classList.add('hidden');
    } finally {
        showLoading(false);
    }
}

function handleCancelPlanning(event) {
    const row = event.target.closest('tr');
    if (!row) return;

    const checkboxes = row.querySelectorAll('.planning-checkbox');
    checkboxes.forEach(checkbox => {
        checkbox.checked = checkbox.dataset.originalChecked === 'true'; // Revert to original state
        updateSlotClass({ target: checkbox }); // Update visual state
        checkbox.disabled = true; // Disable again
        checkbox.removeEventListener('change', updateSlotClass); // Remove listener
        delete checkbox.dataset.originalChecked; // Clean up stored state
    });

    row.classList.remove('editing-row');
    row.querySelector('.edit-planning-btn').classList.remove('hidden');
    row.querySelector('.save-planning-btn').classList.add('hidden');
    row.querySelector('.cancel-planning-btn').classList.add('hidden');
}


// --- Fonction de chargement du planning pour la semaine sÃ©lectionnÃ©e ---
async function loadWeekPlanning() {
    if (!planningData[currentWeek]) { // Load only if not already loaded
        await fetchPlanningData(currentWeek);
    } else {
        renderPlanningTable(planningData[currentWeek], currentDay);
    }
}

// --- Fonctions de gestion des Agents ---
async function fetchAgents() {
    showLoading(true);
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/admin/agents`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) {
            if (response.status === 401) logout();
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const agents = await response.json();
        renderAgentsTable(agents);
    } catch (error) {
        console.error("Error fetching agents:", error);
        showMessage(listAgentsMessage, "Erreur lors du chargement des agents.", 'error');
    } finally {
        showLoading(false);
    }
}

function renderAgentsTable(agents) {
    agentsTableBody.innerHTML = '';
    if (agents.length === 0) {
        agentsTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Aucun agent enregistrÃ©.</td></tr>';
        return;
    }

    agents.forEach(agent => {
        const row = agentsTableBody.insertRow();
        row.dataset.agentId = agent.id;
        row.insertCell().textContent = agent.id;
        row.insertCell().textContent = agent.nom;
        row.insertCell().textContent = agent.prenom;
        row.insertCell().textContent = agent.grade ? agent.grade.name : 'N/A';
        row.insertCell().textContent = agent.fonction ? agent.fonction.name : 'N/A';

        const actionsCell = row.insertCell();
        const editBtn = document.createElement('button');
        editBtn.textContent = 'Modifier';
        editBtn.classList.add('btn', 'btn-primary', 'btn-small');
        editBtn.onclick = () => openEditAgentModal(agent);
        actionsCell.appendChild(editBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Supprimer';
        deleteBtn.classList.add('btn', 'btn-danger', 'btn-small');
        deleteBtn.onclick = () => deleteAgent(agent.id);
        actionsCell.appendChild(deleteBtn);
    });
}

async function addAgent(event) {
    event.preventDefault();
    showLoading(true);

    const newAgentId = document.getElementById('newAgentId').value;
    const newAgentNom = document.getElementById('newAgentNom').value;
    const newAgentPrenom = document.getElementById('newAgentPrenom').value;
    const newAgentPassword = document.getElementById('newAgentPassword').value;
    const selectedGrades = Array.from(document.querySelectorAll('#newAgentGradesCheckboxes input[type="checkbox"]:checked')).map(cb => cb.value);
    const selectedFonctions = Array.from(document.querySelectorAll('#newAgentFonctionsCheckboxes input[type="checkbox"]:checked')).map(cb => cb.value);


    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/admin/agents`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                id: newAgentId,
                nom: newAgentNom,
                prenom: newAgentPrenom,
                password: newAgentPassword,
                grades: selectedGrades,
                fonctions: selectedFonctions
            })
        });

        if (!response.ok) {
            if (response.status === 409) { // Conflict
                throw new Error("Un agent avec cet ID existe dÃ©jÃ .");
            }
            if (response.status === 401) logout();
            throw new Error(`Erreur HTTP! status: ${response.status}`);
        }

        const result = await response.json();
        showMessage(addAgentMessage, "Agent ajoutÃ© avec succÃ¨s!", 'success');
        addAgentForm.reset();
        await fetchAgents(); // Recharger la liste des agents
        await fetchAgentDisplayInfos(); // Mettre Ã  jour les infos d'affichage des agents
    } catch (error) {
        console.error("Error adding agent:", error);
        showMessage(addAgentMessage, `Erreur lors de l'ajout de l'agent: ${error.message}`, 'error');
    } finally {
        showLoading(false);
    }
}

async function deleteAgent(agentId) {
    if (!confirm(`ÃŠtes-vous sÃ»r de vouloir supprimer l'agent avec l'ID ${agentId} ?`)) {
        return;
    }
    showLoading(true);
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/admin/agents/${agentId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            if (response.status === 401) logout();
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        showMessage(listAgentsMessage, `Agent ${agentId} supprimÃ© avec succÃ¨s!`, 'success');
        await fetchAgents(); // Recharger la liste des agents
        await fetchAgentDisplayInfos(); // Mettre Ã  jour les infos d'affichage des agents
    } catch (error) {
        console.error("Error deleting agent:", error);
        showMessage(listAgentsMessage, "Erreur lors de la suppression de l'agent. Veuillez rÃ©essayer.", 'error');
    } finally {
        showLoading(false);
    }
}

function openEditAgentModal(agent) {
    document.getElementById('editAgentId').value = agent.id;
    document.getElementById('editAgentNom').value = agent.nom;
    document.getElementById('editAgentPrenom').value = agent.prenom;
    document.getElementById('editAgentNewPassword').value = ''; // Clear password field

    // Populate grades checkboxes
    gradesCheckboxes.innerHTML = '';
    availableGrades.forEach(grade => {
        const div = document.createElement('div');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `edit-grade-${grade.id}`;
        checkbox.value = grade.id;
        checkbox.checked = agent.grades && agent.grades.some(ag => ag.id === grade.id);
        const label = document.createElement('label');
        label.htmlFor = `edit-grade-${grade.id}`;
        label.textContent = grade.name;
        div.appendChild(checkbox);
        div.appendChild(label);
        gradesCheckboxes.appendChild(div);
    });

    // Populate fonctions checkboxes
    fonctionsCheckboxes.innerHTML = '';
    availableFonctions.forEach(fonction => {
        const div = document.createElement('div');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `edit-fonction-${fonction.id}`;
        checkbox.value = fonction.id;
        checkbox.checked = agent.fonctions && agent.fonctions.some(af => af.id === fonction.id);
        const label = document.createElement('label');
        label.htmlFor = `edit-fonction-${fonction.id}`;
        label.textContent = fonction.name;
        div.appendChild(checkbox);
        div.appendChild(label);
        fonctionsCheckboxes.appendChild(div);
    });

    editAgentMessage.textContent = ''; // Clear any previous messages
    editAgentModal.style.display = 'block';
}

async function editAgent(event) {
    event.preventDefault();
    showLoading(true);

    const agentId = document.getElementById('editAgentId').value;
    const nom = document.getElementById('editAgentNom').value;
    const prenom = document.getElementById('editAgentPrenom').value;
    const newPassword = document.getElementById('editAgentNewPassword').value;
    const selectedGrades = Array.from(document.querySelectorAll('#gradesCheckboxes input[type="checkbox"]:checked')).map(cb => cb.value);
    const selectedFonctions = Array.from(document.querySelectorAll('#fonctionsCheckboxes input[type="checkbox"]:checked')).map(cb => cb.value);

    const updateData = { nom, prenom, grades: selectedGrades, fonctions: selectedFonctions };
    if (newPassword) {
        updateData.password = newPassword;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/admin/agents/${agentId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(updateData)
        });

        if (!response.ok) {
            if (response.status === 401) logout();
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        showMessage(editAgentMessage, "Agent mis Ã  jour avec succÃ¨s!", 'success');
        editAgentModal.style.display = 'none';
        await fetchAgents(); // Recharger la liste des agents
        await fetchAgentDisplayInfos(); // Mettre Ã  jour les infos d'affichage des agents
        await loadWeekPlanning(); // Recharger le planning si l'agent modifiÃ© a un impact sur le planning affichÃ©
    } catch (error) {
        console.error("Error updating agent:", error);
        showMessage(editAgentMessage, `Erreur lors de la mise Ã  jour de l'agent: ${error.message}`, 'error');
    } finally {
        showLoading(false);
    }
}

// --- Fonctions de gestion des Grades ---
async function fetchAndRenderGrades() {
    showLoading(true);
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/grades`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            if (response.status === 401) logout();
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const grades = await response.json();
        gradesTableBody.innerHTML = '';
        if (grades.length === 0) {
            gradesTableBody.innerHTML = '<tr><td colspan="3" style="text-align: center;">Aucun grade enregistrÃ©.</td></tr>';
            return;
        }
        grades.forEach(grade => {
            const row = gradesTableBody.insertRow();
            row.insertCell().textContent = grade.id;
            row.insertCell().textContent = grade.name;
            const actionsCell = row.insertCell();
            const editBtn = document.createElement('button');
            editBtn.textContent = 'Modifier';
            editBtn.classList.add('btn', 'btn-primary', 'btn-small');
            editBtn.onclick = () => openEditGradeModal(grade);
            actionsCell.appendChild(editBtn);

            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'Supprimer';
            deleteBtn.classList.add('btn', 'btn-danger', 'btn-small');
            deleteBtn.onclick = () => deleteGrade(grade.id);
            actionsCell.appendChild(deleteBtn);
        });
    } catch (error) {
        console.error("Error fetching grades for table:", error);
        showMessage(listGradesMessage, "Erreur lors du chargement des grades.", 'error');
    } finally {
        showLoading(false);
    }
}

async function addGrade(event) {
    event.preventDefault();
    showLoading(true);
    const newGradeId = document.getElementById('newGradeId').value;
    const newGradeName = document.getElementById('newGradeName').value;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/grades`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ id: newGradeId, name: newGradeName })
        });

        if (!response.ok) {
            if (response.status === 409) {
                throw new Error("Un grade avec cet ID existe dÃ©jÃ .");
            }
            if (response.status === 401) logout();
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        showMessage(addGradeMessage, "Grade ajoutÃ© avec succÃ¨s!", 'success');
        addGradeForm.reset();
        await fetchGrades(); // Refresh global grades list
        await fetchAndRenderGrades(); // Refresh table
    } catch (error) {
        console.error("Error adding grade:", error);
        showMessage(addGradeMessage, `Erreur lors de l'ajout du grade: ${error.message}`, 'error');
    } finally {
        showLoading(false);
    }
}

async function deleteGrade(gradeId) {
    if (!confirm(`ÃŠtes-vous sÃ»r de vouloir supprimer le grade avec l'ID ${gradeId} ?`)) {
        return;
    }
    showLoading(true);
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/grades/${gradeId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            if (response.status === 401) logout();
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        showMessage(listGradesMessage, `Grade ${gradeId} supprimÃ© avec succÃ¨s!`, 'success');
        await fetchGrades(); // Refresh global grades list
        await fetchAndRenderGrades(); // Refresh table
    } catch (error) {
        console.error("Error deleting grade:", error);
        showMessage(listGradesMessage, "Erreur lors de la suppression du grade. Veuillez rÃ©essayer.", 'error');
    } finally {
        showLoading(false);
    }
}

function openEditGradeModal(grade) {
    document.getElementById('editGradeId').value = grade.id;
    document.getElementById('editGradeName').value = grade.name;
    editGradeMessage.textContent = '';
    editGradeModal.style.display = 'block';
}

async function editGrade(event) {
    event.preventDefault();
    showLoading(true);
    const gradeId = document.getElementById('editGradeId').value;
    const gradeName = document.getElementById('editGradeName').value;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/grades/${gradeId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name: gradeName })
        });

        if (!response.ok) {
            if (response.status === 401) logout();
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        showMessage(editGradeMessage, "Grade mis Ã  jour avec succÃ¨s!", 'success');
        editGradeModal.style.display = 'none';
        await fetchGrades(); // Refresh global grades list
        await fetchAndRenderGrades(); // Refresh table
    } catch (error) {
        console.error("Error updating grade:", error);
        showMessage(editGradeMessage, "Erreur lors de la mise Ã  jour du grade. Veuillez rÃ©essayer.", 'error');
    } finally {
        showLoading(false);
    }
}

// --- Fonctions de gestion des Fonctions ---
async function fetchAndRenderFonctions() {
    showLoading(true);
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/fonctions`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            if (response.status === 401) logout();
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const fonctions = await response.json();
        fonctionsTableBody.innerHTML = '';
        if (fonctions.length === 0) {
            fonctionsTableBody.innerHTML = '<tr><td colspan="3" style="text-align: center;">Aucune fonction enregistrÃ©e.</td></tr>';
            return;
        }
        fonctions.forEach(fonction => {
            const row = fonctionsTableBody.insertRow();
            row.insertCell().textContent = fonction.id;
            row.insertCell().textContent = fonction.name;
            const actionsCell = row.insertCell();
            const editBtn = document.createElement('button');
            editBtn.textContent = 'Modifier';
            editBtn.classList.add('btn', 'btn-primary', 'btn-small');
            editBtn.onclick = () => openEditFonctionModal(fonction);
            actionsCell.appendChild(editBtn);

            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'Supprimer';
            deleteBtn.classList.add('btn', 'btn-danger', 'btn-small');
            deleteBtn.onclick = () => deleteFonction(fonction.id);
            actionsCell.appendChild(deleteBtn);
        });
    } catch (error) {
        console.error("Error fetching fonctions for table:", error);
        showMessage(listFonctionsMessage, "Erreur lors du chargement des fonctions.", 'error');
    } finally {
        showLoading(false);
    }
}

async function addFonction(event) {
    event.preventDefault();
    showLoading(true);
    const newFonctionId = document.getElementById('newFonctionId').value;
    const newFonctionName = document.getElementById('newFonctionName').value;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/fonctions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ id: newFonctionId, name: newFonctionName })
        });

        if (!response.ok) {
            if (response.status === 409) {
                throw new Error("Une fonction avec cet ID existe dÃ©jÃ .");
            }
            if (response.status === 401) logout();
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        showMessage(addFonctionMessage, "Fonction ajoutÃ©e avec succÃ¨s!", 'success');
        addFonctionForm.reset();
        await fetchFonctions(); // Refresh global fonctions list
        await fetchAndRenderFonctions(); // Refresh table
    } catch (error) {
        console.error("Error adding fonction:", error);
        showMessage(addFonctionMessage, `Erreur lors de l'ajout de la fonction: ${error.message}`, 'error');
    } finally {
        showLoading(false);
    }
}

async function deleteFonction(fonctionId) {
    if (!confirm(`ÃŠtes-vous sÃ»r de vouloir supprimer la fonction avec l'ID ${fonctionId} ?`)) {
        return;
    }
    showLoading(true);
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/fonctions/${fonctionId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            if (response.status === 401) logout();
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        showMessage(listFonctionsMessage, `Fonction ${fonctionId} supprimÃ©e avec succÃ¨s!`, 'success');
        await fetchFonctions(); // Refresh global fonctions list
        await fetchAndRenderFonctions(); // Refresh table
    } catch (error) {
        console.error("Error deleting fonction:", error);
        showMessage(listFonctionsMessage, "Erreur lors de la suppression de la fonction. Veuillez rÃ©essayer.", 'error');
    } finally {
        showLoading(false);
    }
}

function openEditFonctionModal(fonction) {
    document.getElementById('editFonctionId').value = fonction.id;
    document.getElementById('editFonctionName').value = fonction.name;
    editFonctionMessage.textContent = '';
    editFonctionModal.style.display = 'block';
}

async function editFonction(event) {
    event.preventDefault();
    showLoading(true);
    const fonctionId = document.getElementById('editFonctionId').value;
    const fonctionName = document.getElementById('editFonctionName').value;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/fonctions/${fonctionId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name: fonctionName })
        });

        if (!response.ok) {
            if (response.status === 401) logout();
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        showMessage(editFonctionMessage, "Fonction mise Ã  jour avec succÃ¨s!", 'success');
        editFonctionModal.style.display = 'none';
        await fetchFonctions(); // Refresh global fonctions list
        await fetchAndRenderFonctions(); // Refresh table
    } catch (error) {
        console.error("Error updating fonction:", error);
        showMessage(editFonctionMessage, "Erreur lors de la mise Ã  jour de la fonction. Veuillez rÃ©essayer.", 'error');
    } finally {
        showLoading(false);
    }
}

// --- Fonctions d'export PDF ---
async function exportPlanningToPdf() {
    showLoading(true, true); // showLoading with forPdf = true
    const { jsPDF } = window.jspdf;

    try {
        // SÃ©lectionner la section du planning global (la section active)
        const planningContent = document.getElementById('global-planning-view'); // Utilisez l'ID de la section principale

        // Temporarily ensure all day contents are visible for HTML2Canvas to capture them.
        // Or capture one by one and combine later. For simplicity, let's try making them all visible.
        // This might cause layout issues, so a better approach is to render each day individually for PDF.
        // For this example, let's just capture the currently active day's planning table.
        // A full PDF export of all days would require a more complex loop and append logic.
        const activeDayContent = document.querySelector('.day-content.active');
        if (!activeDayContent) {
            throw new Error("Aucun planning de jour actif Ã  exporter.");
        }

        const tableToExport = activeDayContent.querySelector('.planning-table');
        if (!tableToExport) {
            throw new Error("Tableau de planning introuvable pour l'exportation.");
        }

        // Clone the table to avoid modifying the displayed table and fix sticky headers/columns for PDF
        const clonedTable = tableToExport.cloneNode(true);
        clonedTable.style.position = 'static'; // Remove sticky positioning
        clonedTable.style.left = 'auto';
        clonedTable.style.right = 'auto';
        clonedTable.querySelectorAll('th, td').forEach(cell => {
            cell.style.position = 'static'; // Remove sticky for cells
            cell.style.left = 'auto';
            cell.style.right = 'auto';
            cell.style.backgroundColor = ''; // Reset background for consistent PDF colors
            cell.style.boxShadow = 'none'; // Remove shadows
        });

        // Create a temporary div to render the cloned table for html2canvas
        const tempDiv = document.createElement('div');
        tempDiv.style.position = 'absolute';
        tempDiv.style.left = '-9999px'; // Off-screen
        tempDiv.style.width = `${tableToExport.scrollWidth}px`; // Match original scroll width
        tempDiv.style.backgroundColor = 'white'; // Ensure white background for PDF
        tempDiv.appendChild(clonedTable);
        document.body.appendChild(tempDiv);

        // Convert the cloned table to an image
        const canvas = await html2canvas(tempDiv, {
            scale: 2, // Higher scale for better quality
            logging: true,
            useCORS: true,
            windowWidth: tempDiv.scrollWidth,
            windowHeight: tempDiv.scrollHeight + 50 // Add some buffer
        });

        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('landscape', 'pt', 'a4'); // 'landscape' for wider tables
        const imgWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        let heightLeft = imgHeight;
        let position = 0;

        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;

        while (heightLeft >= 0) {
            position = heightLeft - imgHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
        }

        pdf.save(`planning_semaine_${currentWeek}_${currentDay}.pdf`);

        document.body.removeChild(tempDiv); // Clean up temporary div
        showMessage(adminInfo, "PDF gÃ©nÃ©rÃ© avec succÃ¨s!", 'success');

    } catch (error) {
        console.error("Erreur lors de l'exportation PDF:", error);
        showMessage(adminInfo, `Ã‰chec de la gÃ©nÃ©ration du PDF: ${error.message}`, 'error');
    } finally {
        showLoading(false);
    }
}


// --- Fonction de dÃ©connexion ---
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole'); // Supprimer le rÃ´le de l'utilisateur
    window.location.href = 'index.html'; // Rediriger vers la page de connexion
}

// --- Initialisation au chargement du DOM ---
document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    const userRole = localStorage.getItem('userRole');

    if (!token || userRole !== 'admin') {
        logout();
        return;
    }

    // Gestion des onglets principaux
    mainTabButtons.forEach(button => {
        button.addEventListener('click', (event) => {
            const tabName = event.target.dataset.mainTab;
            showMainTab(tabName);
        });
    });

    // Gestion des onglets de jour dans le planning
    tabButtons.forEach(button => {
        button.addEventListener('click', (event) => {
            const day = event.target.dataset.day;
            showDay(day);
        });
    });

    // Ã‰couteur pour le changement de semaine
    weekSelect.addEventListener('change', (event) => {
        currentWeek = parseInt(event.target.value);
        dateRangeDisplay.textContent = getWeekRange(currentWeek);
        loadWeekPlanning();
    });

    // Ã‰couteur pour le bouton d'export PDF
    if (exportPdfButton) {
        exportPdfButton.addEventListener('click', exportPlanningToPdf);
    }

    // Ã‰couteur pour le bouton de dÃ©connexion
    if (logoutButton) {
        logoutButton.addEventListener("click", logout);
    }

    // Initialisation des formulaires et modales
    if (addAgentForm) {
        addAgentForm.addEventListener('submit', addAgent);
    }
    if (editAgentForm) {
        editAgentForm.addEventListener('submit', editAgent);
    }
    if (closeAgentModalButton) {
        closeAgentModalButton.addEventListener('click', () => editAgentModal.style.display = 'none');
    }
    if (addGradeForm) {
        addGradeForm.addEventListener('submit', addGrade);
    }
    if (editGradeForm) {
        editGradeForm.addEventListener('submit', editGrade);
    }
    if (closeGradeModalButton) {
        closeGradeModalButton.addEventListener('click', () => editGradeModal.style.display = 'none');
    }
    if (addFonctionForm) {
        addFonctionForm.addEventListener('submit', addFonction);
    }
    if (editFonctionForm) {
        editFonctionForm.addEventListener('submit', editFonction);
    }
    if (closeFonctionModalButton) {
        closeFonctionModalButton.addEventListener('click', () => editFonctionModal.style.display = 'none');
    }

    // Fermer les modales en cliquant Ã  l'extÃ©rieur
    window.addEventListener('click', (event) => {
        if (event.target === editAgentModal) {
            editAgentModal.style.display = 'none';
        }
        if (event.target === editGradeModal) {
            editGradeModal.style.display = 'none';
        }
        if (event.target === editFonctionModal) {
            editFonctionModal.style.display = 'none';
        }
    });

    // Chargement initial des donnÃ©es
    showLoading(true);
    await populateWeekSelect();
    await fetchAgentDisplayInfos();
    await fetchGrades();
    await fetchFonctions();

    // Afficher l'onglet par dÃ©faut (Planning Global) et charger ses donnÃ©es
    showMainTab('global-planning-view'); // Ceci appellera loadWeekPlanning()
    showDay('lundi'); // Afficher le planning du Lundi par dÃ©faut
    showLoading(false); // S'assurer que le spinner est masquÃ© aprÃ¨s tout le chargement initial
});

// ExÃ©cuter le chargement initial du planning dÃ¨s que la page est chargÃ©e et que le tab global planning est actif
// Cette ligne est maintenant gÃ©rÃ©e par `showMainTab('global-planning-view');` dans DOMContentLoaded
// loadWeekPlanning();