const days = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const API_BASE_URL = "https://dispo-pompier.onrender.com";

let currentWeek = getCurrentWeek(); // Initialisé avec la fonction maintenant définie
let currentYear = new Date().getFullYear(); // Ajout de l'année courante
let currentDay = 'lundi';
let planningData = {};
let agentDisplayInfos = {};
let availableGrades = [];
let availableFonctions = [];

// --- Fonctions utilitaires pour la gestion des semaines (AJOUTÉES) ---

// Fonction pour obtenir le numéro de semaine ISO 8601
function getCurrentWeek(date = new Date()) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7)); // Set to nearest Thursday
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return weekNo;
}

// Fonction pour obtenir la date de début (Lundi) d'une semaine ISO 8601
function getWeekStartDate(weekNumber, year) {
    const jan4 = new Date(year, 0, 4);
    const day = jan4.getDay();
    const diff = (day <= 4 ? -day + 1 : -day + 8); // Day of first Monday of the year
    const firstMonday = new Date(jan4.valueOf() + diff * 24 * 60 * 60 * 1000);

    const targetDate = new Date(firstMonday.valueOf() + (weekNumber - 1) * 7 * 24 * 60 * 60 * 1000);
    return targetDate;
}

// Fonction pour formater une date en jj/mm/aaaa
function formatDate(date) {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
}
// --- FIN des Fonctions utilitaires pour la gestion des semaines ---


// --- DOM Elements pour la navigation principale (onglets) ---
const mainTabButtons = document.querySelectorAll('.main-tab');
const mainTabContents = document.querySelectorAll('.main-tab-content');

// --- DOM Elements pour la vue "Planning Global" ---
const planningGlobalSection = document.getElementById('global-planning-view');
const weekSelect = document.getElementById("week-select");
const dateRangeDisplay = document.getElementById("date-range");
const planningContainer = document.getElementById("global-planning");
const tabButtons = document.querySelectorAll(".tab");
const adminInfo = document.getElementById("admin-info");
const exportPdfButton = document.getElementById("export-pdf");

const headerControlsPermanent = document.querySelector('.header-controls-permanent');

// --- DOM Elements pour la vue "Gestion Agents" ---
const agentManagementView = document.getElementById('agent-management-view');
const agentsTableBody = document.getElementById('agentsTableBody');
const addAgentBtn = document.getElementById('addAgentBtn');
const addAgentModal = document.getElementById('addAgentModal');
const closeAddAgentModalButton = addAgentModal ? addAgentModal.querySelector('.close-button') : null;
const addAgentForm = document.getElementById('addAgentForm');
const listAgentsMessage = document.getElementById('listAgentsMessage');
const editAgentModal = document.getElementById('editAgentModal');
const closeAgentModalButton = editAgentModal ? editAgentModal.querySelector('.close-button') : null;
const editAgentForm = document.getElementById('editAgentForm');
const editAgentMessage = document.getElementById('editAgentMessage');
const deleteAgentBtn = document.getElementById('deleteAgentBtn');

// --- DOM Elements pour la vue "Gestion Qualifications" ---
const qualificationManagementView = document.getElementById('qualification-management-view');
const qualificationsTableBody = document.getElementById('qualificationsTableBody');
const addQualificationBtn = document.getElementById('addQualificationBtn');
const addQualificationModal = document.getElementById('addQualificationModal');
const closeAddQualificationModalButton = addQualificationModal ? addQualificationModal.querySelector('.close-button') : null;
const addQualificationForm = document.getElementById('addQualificationForm');
const listQualificationsMessage = document.getElementById('listQualificationsMessage');
const editQualificationModal = document.getElementById('editQualificationModal');
const closeQualificationModalButton = editQualificationModal ? editQualificationModal.querySelector('.close-button') : null;
const editQualificationForm = document.getElementById('editQualificationForm');
const editQualificationMessage = document.getElementById('editQualificationMessage');


// --- DOM Elements pour la vue "Gestion Grades" ---
const gradeManagementView = document.getElementById('grade-management-view');
const gradesTableBody = document.getElementById('gradesTableBody');
const addGradeBtn = document.getElementById('addGradeBtn');
const addGradeModal = document.getElementById('addGradeModal');
const closeAddGradeModalButton = addGradeModal ? addGradeModal.querySelector('.close-button') : null;
const addGradeForm = document.getElementById('addGradeForm');
const listGradesMessage = document.getElementById('listGradesMessage');
const editGradeModal = document.getElementById('editGradeModal');
const closeGradeModalButton = editGradeModal ? editGradeModal.querySelector('.close-button') : null;
const editGradeForm = document.getElementById('editGradeForm');
const editGradeMessage = document.getElementById('editGradeMessage');


// --- DOM Elements pour la vue "Gestion Fonctions" ---
const fonctionManagementView = document.getElementById('fonction-management-view');
const fonctionsTableBody = document.getElementById('fonctionsTableBody');
const addFonctionBtn = document.getElementById('addFonctionBtn');
const addFonctionModal = document.getElementById('addFonctionModal');
const closeAddFonctionModalButton = addFonctionModal ? addFonctionModal.querySelector('.close-button') : null;
const addFonctionForm = document.getElementById('addFonctionForm');
const listFonctionsMessage = document.getElementById('listFonctionsMessage');
const editFonctionModal = document.getElementById('editFonctionModal');
const closeFonctionModalButton = editFonctionModal ? editFonctionModal.querySelector('.close-button') : null;
const editFonctionForm = document.getElementById('editFonctionForm');
const editFonctionMessage = document.getElementById('editFonctionMessage');


// --- Autres DOM Elements ---
const loadingSpinner = document.getElementById("loading-spinner");
const logoutButton = document.getElementById('logout-btn');


// --- Fonctions d'affichage/masquage ---

function showLoading(isLoading) {
    if (loadingSpinner) {
        if (isLoading) {
            loadingSpinner.classList.remove("hidden");
        } else {
            loadingSpinner.classList.add("hidden");
        }
    }
}

function showMainTab(tabId) {
    mainTabContents.forEach(content => {
        content.classList.remove('active');
    });
    mainTabButtons.forEach(button => {
        button.classList.remove('active');
    });

    document.getElementById(tabId).classList.add('active');
    document.querySelector(`.main-tab[data-tab="${tabId}"]`).classList.add('active');

    // Cacher/afficher les contrôles de semaine et d'export en fonction de l'onglet
    if (headerControlsPermanent) {
        if (tabId === 'global-planning-view') {
            headerControlsPermanent.style.display = 'flex'; // ou 'block', selon votre CSS
        } else {
            headerControlsPermanent.style.display = 'none';
        }
    }

    // Charger les données spécifiques à l'onglet
    showLoading(true); // Afficher le spinner au début du chargement de l'onglet
    switch (tabId) {
        case 'global-planning-view':
            loadWeekPlanning(currentWeek, currentYear); // Appelle la fonction de chargement du planning
            break;
        case 'agent-management-view':
            fetchAgentDisplayInfos(); // Récupère et affiche les agents
            break;
        case 'qualification-management-view':
            fetchQualifications(); // Récupère et affiche les qualifications
            break;
        case 'grade-management-view':
            fetchGrades(); // Récupère et affiche les grades
            break;
        case 'fonction-management-view':
            fetchFonctions(); // Récupère et affiche les fonctions
            break;
    }
    // showLoading(false) sera appelé par les fonctions de chargement une fois qu'elles auront fini
}

// Fonction pour afficher le planning d'un jour spécifique
function showDay(day) {
    currentDay = day;
    // Cacher tous les onglets de jour
    document.querySelectorAll('.day-tab-content').forEach(tab => tab.classList.remove('active'));
    // Afficher l'onglet de jour sélectionné
    const selectedDayContent = document.getElementById(`day-${day}-content`);
    if (selectedDayContent) {
        selectedDayContent.classList.add('active');
    }

    // Mettre à jour l'état actif des boutons de jour
    tabButtons.forEach(button => {
        if (button.dataset.day === day) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });
}


// --- Fonctions de chargement de données et d'initialisation ---

async function populateWeekSelect() {
    if (!weekSelect) {
        console.error("Élément #week-select non trouvé.");
        return;
    }
    weekSelect.innerHTML = ''; // Nettoyer les options existantes
    const today = new Date();
    currentYear = today.getFullYear(); // Assurez-vous que l'année courante est à jour

    // Options pour les 5 semaines précédentes, la semaine actuelle, et les 5 semaines suivantes
    for (let i = -5; i <= 5; i++) {
        let date = new Date(today);
        date.setDate(today.getDate() + (i * 7)); // Avancer ou reculer de 'i' semaines

        const weekNo = getCurrentWeek(date);
        const year = date.getFullYear(); // L'année associée à cette semaine

        // Gérer le cas où la semaine traverse une année (ex: semaine 52/53 de l'année précédente)
        // La fonction getWeekStartDate gère déjà l'année correctement, donc on passe juste l'année de la date calculée
        const weekStartDate = getWeekStartDate(weekNo, year);
        const weekEndDate = new Date(weekStartDate);
        weekEndDate.setDate(weekEndDate.getDate() + 6); // Le dimanche de la semaine

        const option = document.createElement('option');
        option.value = `${weekNo}-${year}`;
        option.textContent = `Semaine ${weekNo} (${formatDate(weekStartDate)} - ${formatDate(weekEndDate)})`;
        weekSelect.appendChild(option);
    }

    // Sélectionner la semaine courante
    weekSelect.value = `${currentWeek}-${currentYear}`;
    updateDateRangeDisplay(); // Mettre à jour l'affichage de la plage de dates

    // Écouteur d'événement pour le changement de semaine
    weekSelect.addEventListener('change', (event) => {
        const [selectedWeek, selectedYear] = event.target.value.split('-').map(Number);
        currentWeek = selectedWeek;
        currentYear = selectedYear;
        updateDateRangeDisplay();
        loadWeekPlanning(currentWeek, currentYear); // Charger le nouveau planning
    });
}

// Met à jour l'affichage de la plage de dates sous le sélecteur de semaine
function updateDateRangeDisplay() {
    if (dateRangeDisplay) {
        const startDate = getWeekStartDate(currentWeek, currentYear);
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        dateRangeDisplay.textContent = `(${formatDate(startDate)} - ${formatDate(endDate)})`;
    }
}


// Charge le planning pour la semaine et l'année sélectionnées
async function loadWeekPlanning(weekNumber, year) {
    showLoading(true);
    try {
        const response = await fetch(`${API_BASE_URL}/api/planning/${weekNumber}/${year}`);
        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status}`);
        }
        planningData = await response.json();
        console.log(`Planning chargé pour Semaine ${weekNumber}, Année ${year}:`, planningData);
        generatePlanningTable(planningData); // Générer le tableau HTML
    } catch (error) {
        console.error('Erreur lors du chargement du planning de la semaine:', error);
        // Afficher un message d'erreur à l'utilisateur
        planningContainer.innerHTML = `<p class="error-message">Impossible de charger le planning pour la semaine ${weekNumber} de ${year}.</p>`;
    } finally {
        showLoading(false);
    }
}


// Génère le tableau HTML du planning
function generatePlanningTable(data) {
    if (!planningContainer) {
        console.error("Élément #global-planning non trouvé.");
        return;
    }
    planningContainer.innerHTML = ''; // Nettoyer le contenu précédent

    const table = document.createElement('table');
    table.classList.add('planning-table');

    // En-tête du tableau (jours et horaires)
    const thead = document.createElement('thead');
    let headerHtml = '<tr><th>Agent / Heure</th>';
    for (let i = 0; i < 48; i++) {
        const hour = Math.floor(i / 2) + 7; // 7h00 -> 30h00 (6h du mat le jour suivant)
        const minute = (i % 2) * 30;
        headerHtml += `<th>${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}</th>`;
    }
    headerHtml += '</tr>';
    thead.innerHTML = headerHtml;
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    // Filtrer les agents non "admin" pour l'affichage dans le planning
    const nonAdminAgents = Object.values(agentDisplayInfos).filter(agent => agent.role !== 'admin').sort((a, b) => a.username.localeCompare(b.username));

    nonAdminAgents.forEach(agent => {
        days.forEach(day => {
            const row = document.createElement('tr');
            row.id = `agent-${agent.username}-${day}-row`; // ID pour la ligne spécifique
            row.classList.add('planning-row');
            if (day !== currentDay) {
                row.style.display = 'none'; // Masquer les lignes des jours non actifs
            }

            const agentCell = document.createElement('td');
            agentCell.classList.add('agent-name-cell');
            agentCell.innerHTML = `<span class="agent-username">${agent.username}</span><br><span class="agent-qualifs">${agent.qualifications.join(', ')}</span><br><span class="agent-grade">${agent.grade || ''}</span><br><span class="agent-fonction">${agent.fonction || ''}</span>`;
            row.appendChild(agentCell);

            const agentDayPlanning = data[agent.username] && data[agent.username][day] ? data[agent.username][day] : new Array(48).fill(0);

            agentDayPlanning.forEach((slotValue, slotIndex) => {
                const cell = document.createElement('td');
                cell.classList.add('slot-cell');
                cell.dataset.agent = agent.username;
                cell.dataset.day = day;
                cell.dataset.slot = slotIndex;

                // Définir la classe en fonction de la valeur du slot
                if (slotValue === 0) {
                    cell.classList.add('slot-absent'); // Rouge
                    cell.textContent = 'X';
                } else if (slotValue === 1) {
                    cell.classList.add('slot-present'); // Vert
                    cell.textContent = 'V';
                } else if (slotValue === 2) {
                    cell.classList.add('slot-standby'); // Orange
                    cell.textContent = 'S';
                }

                // Gérer le clic pour changer la valeur
                cell.addEventListener('click', () => {
                    const newValue = (slotValue + 1) % 3; // 0 -> 1 -> 2 -> 0
                    updateSlotOnServer(agent.username, day, slotIndex, newValue);
                });
                row.appendChild(cell);
            });
            tbody.appendChild(row);
        });
    });
    table.appendChild(tbody);
    planningContainer.appendChild(table);
}


// Met à jour un slot sur le serveur et rafraîchit le tableau
async function updateSlotOnServer(username, day, slotIndex, newValue) {
    showLoading(true);
    try {
        const response = await fetch(`${API_BASE_URL}/api/planning/agent/${username}/${currentWeek}/${currentYear}/slot`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ day, slot: slotIndex, value: newValue })
        });

        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status}`);
        }

        const result = await response.json();
        console.log('Mise à jour du slot réussie:', result);

        // Mettre à jour localement le planningData et rafraîchir l'affichage
        if (!planningData[username]) planningData[username] = {};
        if (!planningData[username][day]) planningData[username][day] = new Array(48).fill(0);
        planningData[username][day][slotIndex] = newValue;

        // Mettre à jour directement la cellule dans le DOM
        const cell = document.querySelector(`.slot-cell[data-agent="${username}"][data-day="${day}"][data-slot="${slotIndex}"]`);
        if (cell) {
            cell.classList.remove('slot-absent', 'slot-present', 'slot-standby');
            if (newValue === 0) {
                cell.classList.add('slot-absent');
                cell.textContent = 'X';
            } else if (newValue === 1) {
                cell.classList.add('slot-present');
                cell.textContent = 'V';
            } else if (newValue === 2) {
                cell.classList.add('slot-standby');
                cell.textContent = 'S';
            }
        }
    } catch (error) {
        console.error('Erreur lors de la mise à jour du slot:', error);
        alert('Erreur lors de la mise à jour du slot: ' + error.message);
    } finally {
        showLoading(false);
    }
}


// --- Fonctions de gestion des agents ---

async function fetchAgentDisplayInfos() {
    showLoading(true);
    try {
        const response = await fetch(`${API_BASE_URL}/api/users`);
        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status}`);
        }
        const users = await response.json();
        // Filtrer les utilisateurs de rôle 'admin' pour l'affichage dans la gestion des agents
        agentDisplayInfos = users.filter(user => user.role !== 'admin').reduce((acc, user) => {
            acc[user.username] = { ...user, qualifications: user.qualifications || [] };
            return acc;
        }, {});
        renderAgentsTable();
    } catch (error) {
        console.error('Erreur lors de la récupération des informations des agents:', error);
        if (listAgentsMessage) {
            listAgentsMessage.textContent = 'Erreur lors du chargement des agents.';
            listAgentsMessage.style.color = 'red';
        }
    } finally {
        showLoading(false);
    }
}

function renderAgentsTable() {
    if (!agentsTableBody) {
        console.error("Élément #agentsTableBody non trouvé.");
        return;
    }
    agentsTableBody.innerHTML = '';
    const agents = Object.values(agentDisplayInfos);

    if (agents.length === 0) {
        listAgentsMessage.textContent = 'Aucun agent disponible.';
        listAgentsMessage.style.color = 'orange';
        return;
    } else {
        listAgentsMessage.textContent = '';
    }

    agents.forEach(agent => {
        const row = agentsTableBody.insertRow();
        row.insertCell().textContent = agent.username;
        row.insertCell().textContent = agent.role;
        row.insertCell().textContent = agent.qualifications.join(', ');
        row.insertCell().textContent = agent.grade || 'N/A';
        row.insertCell().textContent = agent.fonction || 'N/A';

        const actionsCell = row.insertCell();
        const editBtn = document.createElement('button');
        editBtn.textContent = 'Modifier';
        editBtn.classList.add('btn', 'btn-secondary', 'btn-small');
        editBtn.addEventListener('click', () => openEditAgentModal(agent.username));
        actionsCell.appendChild(editBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Supprimer';
        deleteBtn.classList.add('btn', 'btn-danger', 'btn-small', 'ml-2');
        deleteBtn.addEventListener('click', () => deleteAgent(agent.username));
        actionsCell.appendChild(deleteBtn);
    });
}

// Ouvre la modale d'ajout d'agent
function openAddAgentModal() {
    if (addAgentModal) {
        addAgentModal.style.display = 'block';
        if (addAgentForm) {
            addAgentForm.reset();
            const qualificationsCheckboxes = addAgentForm.querySelectorAll('input[name="qualification"]');
            qualificationsCheckboxes.forEach(checkbox => checkbox.checked = false);
            const gradeSelect = addAgentForm.querySelector('#addAgentGrade');
            if (gradeSelect) gradeSelect.innerHTML = '<option value="">Sélectionner un grade</option>';
            populateGradeSelect(gradeSelect);
            const fonctionSelect = addAgentForm.querySelector('#addAgentFonction');
            if (fonctionSelect) fonctionSelect.innerHTML = '<option value="">Sélectionner une fonction</option>';
            populateFonctionSelect(fonctionSelect);
            addAgentForm.querySelector('#addAgentMessage').textContent = '';
        }
        populateQualificationsCheckboxes(addAgentForm.querySelector('#addAgentQualificationsContainer'), 'addAgentQualification');
    }
}

async function addAgent(event) {
    event.preventDefault();
    showLoading(true);
    const form = event.target;
    const username = form.addAgentUsername.value.trim();
    const password = form.addAgentPassword.value.trim();
    const role = form.addAgentRole.value;
    const grade = form.addAgentGrade.value;
    const fonction = form.addAgentFonction.value;
    const selectedQualifications = Array.from(form.querySelectorAll('input[name="addAgentQualification"]:checked'))
                                       .map(cb => cb.value);

    if (!username || !password || !role) {
        form.querySelector('#addAgentMessage').textContent = 'Tous les champs marqués * sont requis.';
        form.querySelector('#addAgentMessage').style.color = 'red';
        showLoading(false);
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, role, qualifications: selectedQualifications, grade, fonction })
        });
        const data = await response.json();
        if (response.ok) {
            form.querySelector('#addAgentMessage').textContent = data.message;
            form.querySelector('#addAgentMessage').style.color = 'green';
            form.reset();
            addAgentModal.style.display = 'none'; // Fermer la modale après succès
            fetchAgentDisplayInfos(); // Recharger la liste des agents
        } else {
            form.querySelector('#addAgentMessage').textContent = data.message || 'Erreur lors de l\'ajout de l\'agent.';
            form.querySelector('#addAgentMessage').style.color = 'red';
        }
    } catch (error) {
        console.error('Erreur réseau lors de l\'ajout de l\'agent:', error);
        form.querySelector('#addAgentMessage').textContent = 'Erreur réseau. Veuillez réessayer.';
        form.querySelector('#addAgentMessage').style.color = 'red';
    } finally {
        showLoading(false);
    }
}

async function openEditAgentModal(username) {
    const agent = agentDisplayInfos[username];
    if (!agent) {
        alert('Agent non trouvé pour modification.');
        return;
    }

    if (editAgentModal && editAgentForm) {
        editAgentModal.style.display = 'block';
        editAgentForm.querySelector('#editAgentUsernameDisplay').textContent = agent.username;
        editAgentForm.querySelector('#editAgentOriginalUsername').value = agent.username;
        editAgentForm.querySelector('#editAgentRole').value = agent.role;

        // Remplir les qualifications
        const qualificationsContainer = editAgentForm.querySelector('#editAgentQualificationsContainer');
        populateQualificationsCheckboxes(qualificationsContainer, 'editAgentQualification', agent.qualifications);

        // Remplir les grades
        const gradeSelect = editAgentForm.querySelector('#editAgentGrade');
        if (gradeSelect) {
            gradeSelect.innerHTML = '<option value="">Sélectionner un grade</option>';
            await populateGradeSelect(gradeSelect, agent.grade);
        }

        // Remplir les fonctions
        const fonctionSelect = editAgentForm.querySelector('#editAgentFonction');
        if (fonctionSelect) {
            fonctionSelect.innerHTML = '<option value="">Sélectionner une fonction</option>';
            await populateFonctionSelect(fonctionSelect, agent.fonction);
        }

        editAgentForm.querySelector('#editAgentPassword').value = ''; // Laisser vide pour ne pas modifier
        editAgentForm.querySelector('#editAgentMessage').textContent = '';
    }
}

async function editAgent(event) {
    event.preventDefault();
    showLoading(true);
    const form = event.target;
    const originalUsername = form.editAgentOriginalUsername.value.trim();
    const newPassword = form.editAgentPassword.value.trim();
    const role = form.editAgentRole.value;
    const grade = form.editAgentGrade.value;
    const fonction = form.editAgentFonction.value;
    const selectedQualifications = Array.from(form.querySelectorAll('input[name="editAgentQualification"]:checked'))
                                       .map(cb => cb.value);

    try {
        const updateData = { role, qualifications: selectedQualifications, grade, fonction };
        if (newPassword) {
            updateData.password = newPassword;
        }

        const response = await fetch(`${API_BASE_URL}/api/users/${originalUsername}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData)
        });
        const data = await response.json();
        if (response.ok) {
            form.querySelector('#editAgentMessage').textContent = data.message;
            form.querySelector('#editAgentMessage').style.color = 'green';
            setTimeout(() => {
                editAgentModal.style.display = 'none';
                fetchAgentDisplayInfos(); // Recharger la liste des agents
            }, 1000);
        } else {
            form.querySelector('#editAgentMessage').textContent = data.message || 'Erreur lors de la modification de l\'agent.';
            form.querySelector('#editAgentMessage').style.color = 'red';
        }
    } catch (error) {
        console.error('Erreur réseau lors de la modification de l\'agent:', error);
        form.querySelector('#editAgentMessage').textContent = 'Erreur réseau. Veuillez réessayer.';
        form.querySelector('#editAgentMessage').style.color = 'red';
    } finally {
        showLoading(false);
    }
}

async function deleteAgent(username) {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer l'agent ${username} ? Cette action est irréversible.`)) {
        return;
    }
    showLoading(true);
    try {
        const response = await fetch(`${API_BASE_URL}/api/users/${username}`, {
            method: 'DELETE'
        });
        const data = await response.json();
        if (response.ok) {
            alert(data.message);
            fetchAgentDisplayInfos(); // Recharger la liste des agents
        } else {
            alert(data.message || 'Erreur lors de la suppression de l\'agent.');
        }
    } catch (error) {
        console.error('Erreur réseau lors de la suppression de l\'agent:', error);
        alert('Erreur réseau. Veuillez réessayer.');
    } finally {
        showLoading(false);
    }
}

async function populateQualificationsCheckboxes(container, namePrefix, selectedQuals = []) {
    if (!container) return;
    container.innerHTML = '<h4>Qualifications:</h4>';
    try {
        const response = await fetch(`${API_BASE_URL}/api/qualifications`);
        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status}`);
        }
        const qualifications = await response.json();
        qualifications.forEach(qual => {
            const div = document.createElement('div');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `${namePrefix}-${qual.id}`;
            checkbox.name = namePrefix;
            checkbox.value = qual.name;
            checkbox.checked = selectedQuals.includes(qual.name);

            const label = document.createElement('label');
            label.htmlFor = `${namePrefix}-${qual.id}`;
            label.textContent = qual.name;

            div.appendChild(checkbox);
            div.appendChild(label);
            container.appendChild(div);
        });
    } catch (error) {
        console.error('Erreur lors du chargement des qualifications pour les checkboxes:', error);
        container.innerHTML = '<p style="color:red;">Erreur lors du chargement des qualifications.</p>';
    }
}


// --- Fonctions de gestion des qualifications ---
async function fetchQualifications() {
    showLoading(true);
    try {
        const response = await fetch(`${API_BASE_URL}/api/qualifications`);
        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status}`);
        }
        availableQualifications = await response.json();
        renderQualificationsTable();
    } catch (error) {
        console.error('Erreur lors de la récupération des qualifications:', error);
        if (listQualificationsMessage) {
            listQualificationsMessage.textContent = 'Erreur lors du chargement des qualifications.';
            listQualificationsMessage.style.color = 'red';
        }
    } finally {
        showLoading(false);
    }
}

function renderQualificationsTable() {
    if (!qualificationsTableBody) {
        console.error("Élément #qualificationsTableBody non trouvé.");
        return;
    }
    qualificationsTableBody.innerHTML = '';
    if (availableQualifications.length === 0) {
        listQualificationsMessage.textContent = 'Aucune qualification disponible.';
        listQualificationsMessage.style.color = 'orange';
        return;
    } else {
        listQualificationsMessage.textContent = '';
    }

    availableQualifications.forEach(qual => {
        const row = qualificationsTableBody.insertRow();
        row.insertCell().textContent = qual.name;

        const actionsCell = row.insertCell();
        const editBtn = document.createElement('button');
        editBtn.textContent = 'Modifier';
        editBtn.classList.add('btn', 'btn-secondary', 'btn-small');
        editBtn.addEventListener('click', () => openEditQualificationModal(qual.id, qual.name));
        actionsCell.appendChild(editBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Supprimer';
        deleteBtn.classList.add('btn', 'btn-danger', 'btn-small', 'ml-2');
        deleteBtn.addEventListener('click', () => deleteQualification(qual.id));
        actionsCell.appendChild(deleteBtn);
    });
}

function openAddQualificationModal() {
    if (addQualificationModal) {
        addQualificationModal.style.display = 'block';
        if (addQualificationForm) {
            addQualificationForm.reset();
            addQualificationForm.querySelector('#addQualificationMessage').textContent = '';
        }
    }
}

async function addQualification(event) {
    event.preventDefault();
    showLoading(true);
    const form = event.target;
    const name = form.addQualificationName.value.trim();

    if (!name) {
        form.querySelector('#addQualificationMessage').textContent = 'Nom de qualification requis.';
        form.querySelector('#addQualificationMessage').style.color = 'red';
        showLoading(false);
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/qualifications`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        const data = await response.json();
        if (response.ok) {
            form.querySelector('#addQualificationMessage').textContent = data.message;
            form.querySelector('#addQualificationMessage').style.color = 'green';
            form.reset();
            addQualificationModal.style.display = 'none';
            fetchQualifications();
        } else {
            form.querySelector('#addQualificationMessage').textContent = data.message || 'Erreur lors de l\'ajout de la qualification.';
            form.querySelector('#addQualificationMessage').style.color = 'red';
        }
    } catch (error) {
        console.error('Erreur réseau lors de l\'ajout de qualification:', error);
        form.querySelector('#addQualificationMessage').textContent = 'Erreur réseau. Veuillez réessayer.';
        form.querySelector('#addQualificationMessage').style.color = 'red';
    } finally {
        showLoading(false);
    }
}

function openEditQualificationModal(id, name) {
    if (editQualificationModal && editQualificationForm) {
        editQualificationModal.style.display = 'block';
        editQualificationForm.querySelector('#editQualificationId').value = id;
        editQualificationForm.querySelector('#editQualificationName').value = name;
        editQualificationForm.querySelector('#editQualificationMessage').textContent = '';
    }
}

async function editQualification(event) {
    event.preventDefault();
    showLoading(true);
    const form = event.target;
    const id = form.editQualificationId.value;
    const name = form.editQualificationName.value.trim();

    if (!name) {
        form.querySelector('#editQualificationMessage').textContent = 'Nom de qualification requis.';
        form.querySelector('#editQualificationMessage').style.color = 'red';
        showLoading(false);
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/qualifications/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        const data = await response.json();
        if (response.ok) {
            form.querySelector('#editQualificationMessage').textContent = data.message;
            form.querySelector('#editQualificationMessage').style.color = 'green';
            setTimeout(() => {
                editQualificationModal.style.display = 'none';
                fetchQualifications();
            }, 1000);
        } else {
            form.querySelector('#editQualificationMessage').textContent = data.message || 'Erreur lors de la modification de la qualification.';
            form.querySelector('#editQualificationMessage').style.color = 'red';
        }
    } catch (error) {
        console.error('Erreur réseau lors de la modification de qualification:', error);
        form.querySelector('#editQualificationMessage').textContent = 'Erreur réseau. Veuillez réessayer.';
        form.querySelector('#editQualificationMessage').style.color = 'red';
    } finally {
        showLoading(false);
    }
}

async function deleteQualification(id) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette qualification ?')) {
        return;
    }
    showLoading(true);
    try {
        const response = await fetch(`${API_BASE_URL}/api/qualifications/${id}`, {
            method: 'DELETE'
        });
        const data = await response.json();
        if (response.ok) {
            alert(data.message);
            fetchQualifications();
        } else {
            alert(data.message || 'Erreur lors de la suppression de la qualification.');
        }
    } catch (error) {
        console.error('Erreur réseau lors de la suppression de qualification:', error);
        alert('Erreur réseau. Veuillez réessayer.');
    } finally {
        showLoading(false);
    }
}

// --- Fonctions de gestion des Grades ---
async function fetchGrades() {
    showLoading(true);
    try {
        const response = await fetch(`${API_BASE_URL}/api/grades`);
        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status}`);
        }
        availableGrades = await response.json();
        renderGradesTable();
    } catch (error) {
        console.error('Erreur lors de la récupération des grades:', error);
        if (listGradesMessage) {
            listGradesMessage.textContent = 'Erreur lors du chargement des grades.';
            listGradesMessage.style.color = 'red';
        }
    } finally {
        showLoading(false);
    }
}

function renderGradesTable() {
    if (!gradesTableBody) {
        console.error("Élément #gradesTableBody non trouvé.");
        return;
    }
    gradesTableBody.innerHTML = '';
    if (availableGrades.length === 0) {
        listGradesMessage.textContent = 'Aucun grade disponible.';
        listGradesMessage.style.color = 'orange';
        return;
    } else {
        listGradesMessage.textContent = '';
    }

    availableGrades.forEach(grade => {
        const row = gradesTableBody.insertRow();
        row.insertCell().textContent = grade.name;

        const actionsCell = row.insertCell();
        const editBtn = document.createElement('button');
        editBtn.textContent = 'Modifier';
        editBtn.classList.add('btn', 'btn-secondary', 'btn-small');
        editBtn.addEventListener('click', () => openEditGradeModal(grade.id, grade.name));
        actionsCell.appendChild(editBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Supprimer';
        deleteBtn.classList.add('btn', 'btn-danger', 'btn-small', 'ml-2');
        deleteBtn.addEventListener('click', () => deleteGrade(grade.id));
        actionsCell.appendChild(deleteBtn);
    });
}

async function populateGradeSelect(selectElement, selectedGradeName = null) {
    if (!selectElement) return;
    selectElement.innerHTML = '<option value="">Sélectionner un grade</option>'; // Option par défaut
    try {
        const response = await fetch(`${API_BASE_URL}/api/grades`);
        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status}`);
        }
        const grades = await response.json();
        grades.forEach(grade => {
            const option = document.createElement('option');
            option.value = grade.name;
            option.textContent = grade.name;
            if (selectedGradeName && grade.name === selectedGradeName) {
                option.selected = true;
            }
            selectElement.appendChild(option);
        });
    } catch (error) {
        console.error('Erreur lors du chargement des grades pour le sélecteur:', error);
    }
}

function openAddGradeModal() {
    if (addGradeModal) {
        addGradeModal.style.display = 'block';
        if (addGradeForm) {
            addGradeForm.reset();
            addGradeForm.querySelector('#addGradeMessage').textContent = '';
        }
    }
}

async function addGrade(event) {
    event.preventDefault();
    showLoading(true);
    const form = event.target;
    const name = form.addGradeName.value.trim();

    if (!name) {
        form.querySelector('#addGradeMessage').textContent = 'Nom de grade requis.';
        form.querySelector('#addGradeMessage').style.color = 'red';
        showLoading(false);
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/grades`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        const data = await response.json();
        if (response.ok) {
            form.querySelector('#addGradeMessage').textContent = data.message;
            form.querySelector('#addGradeMessage').style.color = 'green';
            form.reset();
            addGradeModal.style.display = 'none';
            fetchGrades();
        } else {
            form.querySelector('#addGradeMessage').textContent = data.message || 'Erreur lors de l\'ajout du grade.';
            form.querySelector('#addGradeMessage').style.color = 'red';
        }
    } catch (error) {
        console.error('Erreur réseau lors de l\'ajout de grade:', error);
        form.querySelector('#addGradeMessage').textContent = 'Erreur réseau. Veuillez réessayer.';
        form.querySelector('#addGradeMessage').style.color = 'red';
    } finally {
        showLoading(false);
    }
}

function openEditGradeModal(id, name) {
    if (editGradeModal && editGradeForm) {
        editGradeModal.style.display = 'block';
        editGradeForm.querySelector('#editGradeId').value = id;
        editGradeForm.querySelector('#editGradeName').value = name;
        editGradeForm.querySelector('#editGradeMessage').textContent = '';
    }
}

async function editGrade(event) {
    event.preventDefault();
    showLoading(true);
    const form = event.target;
    const id = form.editGradeId.value;
    const name = form.editGradeName.value.trim();

    if (!name) {
        form.querySelector('#editGradeMessage').textContent = 'Nom de grade requis.';
        form.querySelector('#editGradeMessage').style.color = 'red';
        showLoading(false);
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/grades/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        const data = await response.json();
        if (response.ok) {
            form.querySelector('#editGradeMessage').textContent = data.message;
            form.querySelector('#editGradeMessage').style.color = 'green';
            setTimeout(() => {
                editGradeModal.style.display = 'none';
                fetchGrades();
            }, 1000);
        } else {
            form.querySelector('#editGradeMessage').textContent = data.message || 'Erreur lors de la modification du grade.';
            form.querySelector('#editGradeMessage').style.color = 'red';
        }
    } catch (error) {
        console.error('Erreur réseau lors de la modification de grade:', error);
        form.querySelector('#editGradeMessage').textContent = 'Erreur réseau. Veuillez réessayer.';
        form.querySelector('#editGradeMessage').style.color = 'red';
    } finally {
        showLoading(false);
    }
}

async function deleteGrade(id) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce grade ?')) {
        return;
    }
    showLoading(true);
    try {
        const response = await fetch(`${API_BASE_URL}/api/grades/${id}`, {
            method: 'DELETE'
        });
        const data = await response.json();
        if (response.ok) {
            alert(data.message);
            fetchGrades();
        } else {
            alert(data.message || 'Erreur lors de la suppression du grade.');
        }
    } catch (error) {
        console.error('Erreur réseau lors de la suppression de grade:', error);
        alert('Erreur réseau. Veuillez réessayer.');
    } finally {
        showLoading(false);
    }
}


// --- Fonctions de gestion des Fonctions ---
async function fetchFonctions() {
    showLoading(true);
    try {
        const response = await fetch(`${API_BASE_URL}/api/fonctions`);
        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status}`);
        }
        availableFonctions = await response.json();
        renderFonctionsTable();
    } catch (error) {
        console.error('Erreur lors de la récupération des fonctions:', error);
        if (listFonctionsMessage) {
            listFonctionsMessage.textContent = 'Erreur lors du chargement des fonctions.';
            listFonctionsMessage.style.color = 'red';
        }
    } finally {
        showLoading(false);
    }
}

function renderFonctionsTable() {
    if (!fonctionsTableBody) {
        console.error("Élément #fonctionsTableBody non trouvé.");
        return;
    }
    fonctionsTableBody.innerHTML = '';
    if (availableFonctions.length === 0) {
        listFonctionsMessage.textContent = 'Aucune fonction disponible.';
        listFonctionsMessage.style.color = 'orange';
        return;
    } else {
        listFonctionsMessage.textContent = '';
    }

    availableFonctions.forEach(fonction => {
        const row = fonctionsTableBody.insertRow();
        row.insertCell().textContent = fonction.name;

        const actionsCell = row.insertCell();
        const editBtn = document.createElement('button');
        editBtn.textContent = 'Modifier';
        editBtn.classList.add('btn', 'btn-secondary', 'btn-small');
        editBtn.addEventListener('click', () => openEditFonctionModal(fonction.id, fonction.name));
        actionsCell.appendChild(editBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Supprimer';
        deleteBtn.classList.add('btn', 'btn-danger', 'btn-small', 'ml-2');
        deleteBtn.addEventListener('click', () => deleteFonction(fonction.id));
        actionsCell.appendChild(deleteBtn);
    });
}

async function populateFonctionSelect(selectElement, selectedFonctionName = null) {
    if (!selectElement) return;
    selectElement.innerHTML = '<option value="">Sélectionner une fonction</option>'; // Option par défaut
    try {
        const response = await fetch(`${API_BASE_URL}/api/fonctions`);
        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status}`);
        }
        const fonctions = await response.json();
        fonctions.forEach(fonction => {
            const option = document.createElement('option');
            option.value = fonction.name;
            option.textContent = fonction.name;
            if (selectedFonctionName && fonction.name === selectedFonctionName) {
                option.selected = true;
            }
            selectElement.appendChild(option);
        });
    } catch (error) {
        console.error('Erreur lors du chargement des fonctions pour le sélecteur:', error);
    }
}

function openAddFonctionModal() {
    if (addFonctionModal) {
        addFonctionModal.style.display = 'block';
        if (addFonctionForm) {
            addFonctionForm.reset();
            addFonctionForm.querySelector('#addFonctionMessage').textContent = '';
        }
    }
}

async function addFonction(event) {
    event.preventDefault();
    showLoading(true);
    const form = event.target;
    const name = form.addFonctionName.value.trim();

    if (!name) {
        form.querySelector('#addFonctionMessage').textContent = 'Nom de fonction requis.';
        form.querySelector('#addFonctionMessage').style.color = 'red';
        showLoading(false);
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/fonctions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        const data = await response.json();
        if (response.ok) {
            form.querySelector('#addFonctionMessage').textContent = data.message;
            form.querySelector('#addFonctionMessage').style.color = 'green';
            form.reset();
            addFonctionModal.style.display = 'none';
            fetchFonctions();
        } else {
            form.querySelector('#addFonctionMessage').textContent = data.message || 'Erreur lors de l\'ajout de la fonction.';
            form.querySelector('#addFonctionMessage').style.color = 'red';
        }
    } catch (error) {
        console.error('Erreur réseau lors de l\'ajout de fonction:', error);
        form.querySelector('#addFonctionMessage').textContent = 'Erreur réseau. Veuillez réessayer.';
        form.querySelector('#addFonctionMessage').style.color = 'red';
    } finally {
        showLoading(false);
    }
}

function openEditFonctionModal(id, name) {
    if (editFonctionModal && editFonctionForm) {
        editFonctionModal.style.display = 'block';
        editFonctionForm.querySelector('#editFonctionId').value = id;
        editFonctionForm.querySelector('#editFonctionName').value = name;
        editFonctionForm.querySelector('#editFonctionMessage').textContent = '';
    }
}

async function editFonction(event) {
    event.preventDefault();
    showLoading(true);
    const form = event.target;
    const id = form.editFonctionId.value;
    const name = form.editFonctionName.value.trim();

    if (!name) {
        form.querySelector('#editFonctionMessage').textContent = 'Nom de fonction requis.';
        form.querySelector('#editFonctionMessage').style.color = 'red';
        showLoading(false);
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/fonctions/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        const data = await response.json();
        if (response.ok) {
            form.querySelector('#editFonctionMessage').textContent = data.message;
            form.querySelector('#editFonctionMessage').style.color = 'green';
            setTimeout(() => {
                editFonctionModal.style.display = 'none';
                fetchFonctions();
            }, 1000);
        } else {
            form.querySelector('#editFonctionMessage').textContent = data.message || 'Erreur lors de la modification de la fonction.';
            form.querySelector('#editFonctionMessage').style.color = 'red';
        }
    } catch (error) {
        console.error('Erreur réseau lors de la modification de fonction:', error);
        form.querySelector('#editFonctionMessage').textContent = 'Erreur réseau. Veuillez réessayer.';
        form.querySelector('#editFonctionMessage').style.color = 'red';
    } finally {
        showLoading(false);
    }
}

async function deleteFonction(id) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette fonction ?')) {
        return;
    }
    showLoading(true);
    try {
        const response = await fetch(`${API_BASE_URL}/api/fonctions/${id}`, {
            method: 'DELETE'
        });
        const data = await response.json();
        if (response.ok) {
            alert(data.message);
            fetchFonctions();
        } else {
            alert(data.message || 'Erreur lors de la suppression de la fonction.');
        }
    } catch (error) {
        console.error('Erreur réseau lors de la suppression de fonction:', error);
        alert('Erreur réseau. Veuillez réessayer.');
    } finally {
        showLoading(false);
    }
}

// Fonction pour l'export PDF (utilisée par le bouton "Exporter en PDF")
async function exportPlanningToPdf() {
    showLoading(true);
    const element = document.getElementById('global-planning'); // Le conteneur du tableau de planning
    if (!element) {
        console.error("Élément 'global-planning' non trouvé pour l'export PDF.");
        alert("Impossible de générer le PDF : élément de planning introuvable.");
        showLoading(false);
        return;
    }

    try {
        // Options pour html2canvas
        const options = {
            scale: 2, // Augmente la résolution pour une meilleure qualité d'image
            useCORS: true, // Important si vous avez des images chargées depuis des origines différentes
            logging: true,
            allowTaint: true
        };

        const canvas = await html2canvas(element, options);
        const imgData = canvas.toDataURL('image/png');
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('landscape'); // 'landscape' pour le format paysage

        // Calculer les dimensions pour s'adapter à la page PDF
        const imgWidth = 297; // Largeur de la page A4 en mm (paysage)
        const pageHeight = 210; // Hauteur de la page A4 en mm (paysage)
        const imgHeight = canvas.height * imgWidth / canvas.width;
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

        // Ajouter un titre et une date
        pdf.setFontSize(16);
        pdf.text(`Planning Semaine ${currentWeek} - ${currentYear}`, 14, 10);
        pdf.setFontSize(10);
        pdf.text(`Exporté le : ${new Date().toLocaleDateString('fr-FR')}`, 14, 18);

        pdf.save(`planning_semaine_${currentWeek}_${currentYear}.pdf`);
    } catch (error) {
        console.error('Erreur lors de l\'exportation PDF:', error);
        alert('Erreur lors de l\'exportation du planning en PDF. Veuillez vérifier la console pour plus de détails.');
    } finally {
        showLoading(false);
    }
}


// --- Initialisation des écouteurs d'événements et chargement initial ---
document.addEventListener('DOMContentLoaded', async () => {
    // Écouteurs pour la navigation principale (onglets)
    mainTabButtons.forEach(button => {
        button.addEventListener('click', () => {
            showMainTab(button.dataset.tab);
        });
    });

    // Écouteurs pour les boutons de jour du planning
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            showDay(button.dataset.day);
        });
    });

    // Écouteur pour le bouton de déconnexion
    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            localStorage.clear();
            window.location.href = 'login.html'; // Redirige vers la page de connexion
        });
    }

    // Écouteur pour le bouton d'export PDF
    if (exportPdfButton) {
        exportPdfButton.addEventListener('click', exportPlanningToPdf);
    }

    // Écouteurs pour les modales d'agents
    if (addAgentBtn) {
        addAgentBtn.addEventListener('click', openAddAgentModal);
    }
    if (closeAddAgentModalButton) {
        closeAddAgentModalButton.addEventListener('click', () => addAgentModal.style.display = 'none');
    }
    if (addAgentForm) {
        addAgentForm.addEventListener('submit', addAgent);
    }
    if (editAgentForm) {
        editAgentForm.addEventListener('submit', editAgent);
    }
    if (closeAgentModalButton) {
        closeAgentModalButton.addEventListener('click', () => editAgentModal.style.display = 'none');
    }


    // Écouteurs pour les modales de qualifications
    if (addQualificationBtn) {
        addQualificationBtn.addEventListener('click', openAddQualificationModal);
    }
    if (closeAddQualificationModalButton) {
        closeAddQualificationModalButton.addEventListener('click', () => addQualificationModal.style.display = 'none');
    }
    if (addQualificationForm) {
        addQualificationForm.addEventListener('submit', addQualification);
    }
    if (editQualificationForm) {
        editQualificationForm.addEventListener('submit', editQualification);
    }
    if (closeQualificationModalButton) {
        closeQualificationModalButton.addEventListener('click', () => editQualificationModal.style.display = 'none');
    }

    // Écouteurs pour les modales de grades
    if (addGradeBtn) {
        addGradeBtn.addEventListener('click', openAddGradeModal);
    }
    if (closeAddGradeModalButton) {
        closeAddGradeModalButton.addEventListener('click', () => addGradeModal.style.display = 'none');
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

    // Écouteurs pour les modales de fonctions
    if (addFonctionBtn) {
        addFonctionBtn.addEventListener('click', openAddFonctionModal);
    }
    if (closeAddFonctionModalButton) {
        closeAddFonctionModalButton.addEventListener('click', () => addFonctionModal.style.display = 'none');
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

    // Fermer les modales en cliquant à l'extérieur
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
        if (event.target === addAgentModal) {
            addAgentModal.style.display = 'none';
        }
        if (event.target === addQualificationModal) {
            addQualificationModal.style.display = 'none';
        }
        if (event.target === addGradeModal) {
            addGradeModal.style.display = 'none';
        }
        if (event.target === addFonctionModal) {
            addFonctionModal.style.display = 'none';
        }
    });


    // Chargement initial des données
    showLoading(true);
    await populateWeekSelect();
    await fetchAgentDisplayInfos(); // Important pour que generatePlanningTable puisse filtrer les admins
    await fetchQualifications(); // Pour les popups de gestion agents
    await fetchGrades(); // Pour les popups de gestion agents
    await fetchFonctions(); // Pour les popups de gestion agents

    // Afficher l'onglet par défaut (Planning Global) et charger ses données
    showMainTab('global-planning-view'); // Ceci appellera loadWeekPlanning()
    showDay('lundi'); // Afficher le planning du Lundi par défaut
    showLoading(false); // S'assurer que le spinner est masqué après tout le chargement initial
});

// Le `loadWeekPlanning` au niveau global a été supprimé car `showMainTab` s'en occupe.