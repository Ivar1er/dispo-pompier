const days = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const API_BASE_URL = ""; // Ancien: "https://dispo-pompier.onrender.com"

let currentWeek = getCurrentWeek(); // Semaine actuelle par défaut
let currentDay = 'lundi'; // Jour actuel par défaut pour le planning
let planningData = {}; // Contiendra le planning global chargé de l'API
let agentDisplayInfos = {}; // Mapping dynamique agentId => {nom, prenom}
let availableQualifications = []; // Liste des qualifications disponibles chargée depuis l'API
let availableGrades = []; // Liste des grades disponibles chargée depuis l'API
let availableFonctions = []; // Nouvelle: Liste des fonctions disponibles chargée depuis l'API

// --- DOM Elements pour la navigation principale (onglets) ---
const mainTabButtons = document.querySelectorAll('.main-tab');
const mainTabContents = document.querySelectorAll('.main-tab-content');

// --- DOM Elements pour la vue "Planning Global" ---
const planningControls = document.getElementById('planning-controls'); // Conteneur pour les contrôles de semaine/export
const weekSelect = document.getElementById("week-select");
const dateRangeDisplay = document.getElementById("date-range"); // Rétabli, car il y a un p#date-range dans le HTML
const planningContainer = document.getElementById("global-planning");
const tabButtons = document.querySelectorAll(".tab"); // Boutons de jour (Lundi, Mardi...)
const adminInfo = document.getElementById("admin-info");

// --- DOM Elements pour la vue "Gestion des Agents" ---
const addAgentForm = document.getElementById('addAgentForm');
const agentsListBody = document.getElementById('agentsListBody');
const addAgentMessage = document.getElementById('addAgentMessage');
const editAgentForm = document.getElementById('editAgentForm');
const editAgentMessage = document.getElementById('editAgentMessage');
const editAgentModal = document.getElementById('editAgentModal');

// --- DOM Elements pour la vue "Gestion des Qualifications" ---
const qualificationsListBody = document.getElementById('qualificationsListBody');
const addQualificationForm = document.getElementById('addQualificationForm');
const addQualificationMessage = document.getElementById('addQualificationMessage');
const addQualificationModal = document.getElementById('addQualificationModal');
const editQualificationForm = document.getElementById('editQualificationForm');
const editQualificationMessage = document.getElementById('editQualificationMessage');
const editQualificationModal = document.getElementById('editQualificationModal');
const addQualificationBtn = document.getElementById('addQualificationBtn');

// --- DOM Elements pour la vue "Gestion des Grades" ---
const gradesListBody = document.getElementById('gradesListBody');
const addGradeForm = document.getElementById('addGradeForm');
const addGradeMessage = document.getElementById('addGradeMessage');
const addGradeModal = document.getElementById('addGradeModal');
const editGradeForm = document.getElementById('editGradeForm');
const editGradeMessage = document.getElementById('editGradeMessage');
const editGradeModal = document.getElementById('editGradeModal');
const addGradeBtn = document.getElementById('addGradeBtn');

// --- DOM Elements pour la vue "Gestion des Fonctions" ---
const fonctionsListBody = document.getElementById('fonctionsListBody');
const addFonctionForm = document.getElementById('addFonctionForm');
const addFonctionMessage = document.getElementById('addFonctionMessage');
const addFonctionModal = document.getElementById('addFonctionModal');
const editFonctionForm = document.getElementById('editFonctionForm');
const editFonctionMessage = document.getElementById('editFonctionMessage');
const editFonctionModal = document.getElementById('editFonctionModal');
const addFonctionBtn = document.getElementById('addFonctionBtn');


// --- DOM Elements globaux ---
const loadingSpinner = document.getElementById("loading-spinner");
const logoutButton = document.getElementById('logout-btn');


// --- Fonctions utilitaires ---

// Récupère le numéro de semaine ISO de la date actuelle
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

// Fonction pour afficher des messages (erreurs ou succès)
function displayMessage(element, message, isError = true) {
    element.textContent = message;
    element.style.color = isError ? 'red' : 'green';
    element.style.display = 'block';
    setTimeout(() => {
        element.textContent = '';
        element.style.display = 'none';
    }, 5000);
}

// Fonction pour activer/désactiver le spinner et les contrôles
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


// --- Fonctions d'authentification et de redirection ---

async function authenticateAndRedirect() {
    const token = sessionStorage.getItem('jwtToken');
    const isAdmin = sessionStorage.getItem('isAdmin');

    if (!token || isAdmin !== 'true') { // Vérifier si isAdmin est 'true' (string)
        sessionStorage.clear(); // Nettoyer le stockage si non authentifié ou non admin
        window.location.href = 'login.html'; // Rediriger vers la page de connexion
        return false;
    }
    // Si l'utilisateur est admin et a un token, on peut charger les données
    return true;
}

// Fonction pour récupérer les données de l'administrateur et les afficher
async function fetchAdminData() {
    showLoading(true);
    try {
        const token = sessionStorage.getItem('jwtToken');
        const response = await fetch(`${API_BASE_URL}/api/admin/data`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                // Token invalide ou non autorisé
                sessionStorage.clear();
                window.location.href = 'login.html';
            }
            throw new Error('Erreur lors du chargement des données admin.');
        }

        const data = await response.json();
        // Vous pouvez utiliser ces données pour initialiser l'interface admin
        adminInfo.textContent = `Bienvenue Administrateur ${data.prenom} ${data.nom} ! Vue du planning global des agents.`;

    } catch (error) {
        console.error('Erreur lors de la récupération des données admin :', error);
        displayMessage(adminInfo, 'Erreur lors du chargement des données admin.', true);
    } finally {
        showLoading(false);
    }
}


// --- Gestion des Onglets Principaux ---
mainTabButtons.forEach(button => {
    button.addEventListener('click', () => {
        const targetTab = button.dataset.mainTab;

        // Désactiver tous les onglets
        mainTabButtons.forEach(btn => btn.classList.remove('active'));
        mainTabContents.forEach(content => content.classList.remove('active'));

        // Activer l'onglet cliqué
        button.classList.add('active');
        document.getElementById(targetTab).classList.add('active');

        // Recharger les données si nécessaire pour le nouvel onglet
        if (targetTab === 'agent-management-view') {
            loadAgents(); // Recharger les agents à chaque fois qu'on va sur l'onglet de gestion
            loadQualifications();
            loadGrades();
            loadFonctions();
        } else if (targetTab === 'global-planning-view') {
            loadPlanningForWeek(currentWeek); // Recharger le planning global
        }
    });
});


// --- Fonctions de Gestion du Planning Global ---

async function loadPlanningForWeek(week) {
    showLoading(true);
    try {
        const token = sessionStorage.getItem('jwtToken');
        const response = await fetch(`${API_BASE_URL}/api/planning/global?week=${week}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status}`);
        }
        planningData = await response.json(); // Le planning global contient 'agents' et 'slots'
        await fetchAgentDisplayInfos(); // Récupérer les noms/prénoms pour affichage
        displayPlanning(planningData);
        updateDateRangeDisplay(week);
    } catch (error) {
        console.error('Erreur lors du chargement du planning global :', error);
        displayMessage(adminInfo, 'Impossible de charger le planning global. ' + error.message, true);
        planningContainer.innerHTML = '<p class="info-message">Impossible de charger le planning. Vérifiez la connexion ou contactez le support.</p>';
    } finally {
        showLoading(false);
    }
}

// Charger les noms/prénoms des agents pour l'affichage (ne devrait pas être protégé par JWT)
async function fetchAgentDisplayInfos() {
    try {
        // Cette route n'a pas besoin d'être authentifiée car elle est pour l'affichage public
        const response = await fetch(`${API_BASE_URL}/api/agents/display-info`);
        if (!response.ok) {
            throw new Error('Erreur lors du chargement des informations d\'affichage des agents.');
        }
        const agents = await response.json();
        agentDisplayInfos = agents.reduce((acc, agent) => {
            acc[agent.id] = { prenom: agent.prenom, nom: agent.nom };
            return acc;
        }, {});
    } catch (error) {
        console.error('Erreur lors du chargement des informations d\'affichage des agents :', error);
        // Ne pas afficher d'erreur critique car le planning peut encore s'afficher sans noms complets
    }
}


function displayPlanning(data) {
    if (!data || Object.keys(data.slots).length === 0) {
        planningContainer.innerHTML = '<p class="info-message">Aucun planning n\'est disponible pour cette semaine.</p>';
        return;
    }

    let tableHTML = `
        <table class="planning-table">
            <thead>
                <tr>
                    <th>Créneau</th>
                    ${days.map(day => `<th>${day.charAt(0).toUpperCase() + day.slice(1)}</th>`).join('')}
                </tr>
            </thead>
            <tbody>
    `;

    // Générer les créneaux horaires (par exemple, de 7h00 à 7h00 le lendemain)
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


    horaires.forEach(slot => {
        tableHTML += `<tr><td>${slot}</td>`;
        days.forEach(day => {
            const daySlots = data.slots[day] || {};
            const agentsInSlot = daySlots[slot] || [];
            if (agentsInSlot.length > 0) {
                const agentNames = agentsInSlot.map(agentId => {
                    const agentInfo = agentDisplayInfos[agentId];
                    return agentInfo ? `${agentInfo.prenom} ${agentInfo.nom}` : agentId;
                }).join('<br>');
                tableHTML += `<td class="occupied-slot">${agentNames}</td>`;
            } else {
                tableHTML += `<td class="empty-slot"></td>`;
            }
        });
        tableHTML += `</tr>`;
    });

    tableHTML += `</tbody></table>`;
    planningContainer.innerHTML = tableHTML;
}

function updateDateRangeDisplay(week) {
    dateRangeDisplay.textContent = getStartAndEndDateOfWeek(week);
}

// Événement pour le changement de semaine
weekSelect.addEventListener('change', (event) => {
    currentWeek = parseInt(event.target.value);
    loadPlanningForWeek(currentWeek);
});


// --- Fonctions de Gestion des Agents ---

async function loadAgents() {
    showLoading(true);
    try {
        const token = sessionStorage.getItem('jwtToken');
        const response = await fetch(`${API_BASE_URL}/api/users`, { // Route pour obtenir tous les agents
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status}`);
        }
        const agents = await response.json();
        displayAgents(agents);
    } catch (error) {
        console.error('Erreur lors du chargement des agents :', error);
        displayMessage(addAgentMessage, 'Impossible de charger la liste des agents. ' + error.message, true);
        agentsListBody.innerHTML = '<tr><td colspan="7">Erreur lors du chargement des agents.</td></tr>';
    } finally {
        showLoading(false);
    }
}

async function fetchQualificationsAndPopulateMultiSelect(selectElement, selectedQualifications = []) {
    showLoading(true);
    try {
        const token = sessionStorage.getItem('jwtToken');
        const response = await fetch(`${API_BASE_URL}/api/qualifications`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Erreur lors du chargement des qualifications');
        availableQualifications = await response.json(); // Stocke les qualifications
        selectElement.innerHTML = '';
        availableQualifications.forEach(q => {
            const option = document.createElement('option');
            option.value = q.id;
            option.textContent = q.name;
            if (selectedQualifications.includes(q.id)) {
                option.selected = true;
            }
            selectElement.appendChild(option);
        });
    } catch (error) {
        console.error('Erreur lors du chargement des qualifications pour select:', error);
        displayMessage(addAgentMessage, 'Impossible de charger les qualifications.', true);
    } finally {
        showLoading(false);
    }
}

async function fetchGradesAndPopulateSelect(selectElement, selectedGradeId = '') {
    showLoading(true);
    try {
        const token = sessionStorage.getItem('jwtToken');
        const response = await fetch(`${API_BASE_URL}/api/grades`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Erreur lors du chargement des grades');
        availableGrades = await response.json(); // Stocke les grades
        selectElement.innerHTML = '<option value="">-- Sélectionner un grade --</option>'; // Option par défaut
        availableGrades.forEach(g => {
            const option = document.createElement('option');
            option.value = g.id;
            option.textContent = g.name;
            if (selectedGradeId === g.id) {
                option.selected = true;
            }
            selectElement.appendChild(option);
        });
    } catch (error) {
        console.error('Erreur lors du chargement des grades pour select:', error);
        displayMessage(addAgentMessage, 'Impossible de charger les grades.', true);
    } finally {
        showLoading(false);
    }
}

async function fetchFonctionsAndPopulateSelect(selectElement, selectedFonctionId = '') {
    showLoading(true);
    try {
        const token = sessionStorage.getItem('jwtToken');
        const response = await fetch(`${API_BASE_URL}/api/fonctions`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Erreur lors du chargement des fonctions');
        availableFonctions = await response.json(); // Stocke les fonctions
        selectElement.innerHTML = '<option value="">-- Sélectionner une fonction --</option>'; // Option par défaut
        availableFonctions.forEach(f => {
            const option = document.createElement('option');
            option.value = f.id;
            option.textContent = f.name;
            if (selectedFonctionId === f.id) {
                option.selected = true;
            }
            selectElement.appendChild(option);
        });
    } catch (error) {
        console.error('Erreur lors du chargement des fonctions pour select:', error);
        displayMessage(addAgentMessage, 'Impossible de charger les fonctions.', true);
    } finally {
        showLoading(false);
    }
}


function displayAgents(agents) {
    agentsListBody.innerHTML = '';
    if (agents.length === 0) {
        agentsListBody.innerHTML = '<tr><td colspan="7">Aucun agent enregistré.</td></tr>';
        return;
    }
    agents.forEach(agent => {
        const row = agentsListBody.insertRow();
        row.insertCell(0).textContent = agent.id;
        row.insertCell(1).textContent = agent.prenom;
        row.insertCell(2).textContent = agent.nom;
        row.insertCell(3).textContent = agent.isAdmin ? 'Oui' : 'Non';

        // Afficher les noms des qualifications
        const qualificationNames = agent.qualifications.map(qId => {
            const qual = availableQualifications.find(aq => aq.id === qId);
            return qual ? qual.name : qId;
        }).join(', ');
        row.insertCell(4).textContent = qualificationNames;

        // Afficher le nom du grade
        const gradeName = availableGrades.find(g => g.id === agent.grade)?.name || 'N/A';
        row.insertCell(5).textContent = gradeName;

        // Afficher le nom de la fonction
        const fonctionName = availableFonctions.find(f => f.id === agent.fonction)?.name || 'N/A';
        row.insertCell(6).textContent = fonctionName;


        const actionsCell = row.insertCell(7);
        const editButton = document.createElement('button');
        editButton.textContent = 'Modifier';
        editButton.className = 'btn btn-edit';
        editButton.addEventListener('click', () => openEditAgentModal(agent));
        actionsCell.appendChild(editButton);

        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Supprimer';
        deleteButton.className = 'btn btn-delete';
        deleteButton.addEventListener('click', () => deleteAgent(agent.id));
        actionsCell.appendChild(deleteButton);
    });
}

async function handleAddAgentFormSubmit(event) {
    event.preventDefault();
    showLoading(true);

    const formData = new FormData(addAgentForm);
    const newAgent = {
        id: formData.get('addAgentId'),
        prenom: formData.get('addAgentPrenom'),
        nom: formData.get('addAgentNom'),
        mdp: formData.get('addAgentMdp'), // Le mot de passe sera haché côté serveur
        isAdmin: formData.get('addAgentIsAdmin') === 'on', // Checkbox
        qualifications: Array.from(formData.getAll('addAgentQualifications')), // Multi-select
        grade: formData.get('addAgentGrade'),
        fonction: formData.get('addAgentFonction')
    };

    try {
        const token = sessionStorage.getItem('jwtToken');
        const response = await fetch(`${API_BASE_URL}/api/users`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(newAgent)
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'Erreur lors de l\'ajout de l\'agent.');
        }
        displayMessage(addAgentMessage, 'Agent ajouté avec succès !', false);
        addAgentForm.reset();
        loadAgents(); // Recharger la liste des agents
    } catch (error) {
        console.error('Erreur lors de l\'ajout de l\'agent :', error);
        displayMessage(addAgentMessage, error.message, true);
    } finally {
        showLoading(false);
    }
}

async function openEditAgentModal(agent) {
    document.getElementById('editAgentId').value = agent.id; // L'ID ne doit pas être modifiable
    document.getElementById('displayAgentId').textContent = agent.id; // Afficher l'ID
    document.getElementById('editAgentPrenom').value = agent.prenom;
    document.getElementById('editAgentNom').value = agent.nom;
    document.getElementById('editAgentMdp').value = ''; // Laisser vide pour ne pas envoyer le hash existant
    document.getElementById('editAgentIsAdmin').checked = agent.isAdmin;

    // Populer les sélecteurs de qualifications, grades et fonctions
    await fetchQualificationsAndPopulateMultiSelect(document.getElementById('editAgentQualifications'), agent.qualifications);
    await fetchGradesAndPopulateSelect(document.getElementById('editAgentGrade'), agent.grade);
    await fetchFonctionsAndPopulateSelect(document.getElementById('editAgentFonction'), agent.fonction);

    editAgentModal.style.display = 'block';
}

async function handleEditAgentFormSubmit(event) {
    event.preventDefault();
    showLoading(true);

    const agentId = document.getElementById('editAgentId').value;
    const formData = new FormData(editAgentForm);
    const updatedAgent = {
        prenom: formData.get('editAgentPrenom'),
        nom: formData.get('editAgentNom'),
        mdp: formData.get('editAgentMdp'), // Peut être vide si pas de changement
        isAdmin: formData.get('editAgentIsAdmin') === 'on',
        qualifications: Array.from(formData.getAll('editAgentQualifications')),
        grade: formData.get('editAgentGrade'),
        fonction: formData.get('editAgentFonction')
    };

    try {
        const token = sessionStorage.getItem('jwtToken');
        const response = await fetch(`${API_BASE_URL}/api/users/${agentId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(updatedAgent)
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'Erreur lors de la modification de l\'agent.');
        }
        displayMessage(editAgentMessage, 'Agent modifié avec succès !', false);
        editAgentModal.style.display = 'none';
        loadAgents(); // Recharger la liste des agents
    } catch (error) {
        console.error('Erreur lors de la modification de l\'agent :', error);
        displayMessage(editAgentMessage, error.message, true);
    } finally {
        showLoading(false);
    }
}

async function deleteAgent(agentId) {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer l'agent ${agentId} ?`)) {
        return;
    }
    showLoading(true);
    try {
        const token = sessionStorage.getItem('jwtToken');
        const response = await fetch(`${API_BASE_URL}/api/users/${agentId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'Erreur lors de la suppression de l\'agent.');
        }
        displayMessage(addAgentMessage, 'Agent supprimé avec succès !', false); // Utilisez le message de l'onglet add
        loadAgents(); // Recharger la liste
    } catch (error) {
        console.error('Erreur lors de la suppression de l\'agent :', error);
        displayMessage(addAgentMessage, error.message, true);
    } finally {
        showLoading(false);
    }
}


// --- Fonctions de Gestion des Qualifications ---

async function loadQualifications() {
    showLoading(true);
    try {
        const token = sessionStorage.getItem('jwtToken');
        const response = await fetch(`${API_BASE_URL}/api/qualifications`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error(`Erreur HTTP: ${response.status}`);
        availableQualifications = await response.json(); // Met à jour la variable globale
        displayQualifications(availableQualifications);
    } catch (error) {
        console.error('Erreur lors du chargement des qualifications:', error);
        displayMessage(addQualificationMessage, 'Impossible de charger les qualifications. ' + error.message, true);
        qualificationsListBody.innerHTML = '<tr><td colspan="3">Erreur lors du chargement des qualifications.</td></tr>';
    } finally {
        showLoading(false);
    }
}

function displayQualifications(qualifications) {
    qualificationsListBody.innerHTML = '';
    if (qualifications.length === 0) {
        qualificationsListBody.innerHTML = '<tr><td colspan="3">Aucune qualification enregistrée.</td></tr>';
        return;
    }
    qualifications.forEach(q => {
        const row = qualificationsListBody.insertRow();
        row.insertCell(0).textContent = q.id;
        row.insertCell(1).textContent = q.name;
        const actionsCell = row.insertCell(2);
        const editButton = document.createElement('button');
        editButton.textContent = 'Modifier';
        editButton.className = 'btn btn-edit';
        editButton.addEventListener('click', () => openEditQualificationModal(q));
        actionsCell.appendChild(editButton);

        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Supprimer';
        deleteButton.className = 'btn btn-delete';
        deleteButton.addEventListener('click', () => deleteQualification(q.id));
        actionsCell.appendChild(deleteButton);
    });
}

function openAddQualificationModal() {
    addQualificationForm.reset();
    addQualificationMessage.textContent = '';
    addQualificationModal.style.display = 'block';
}

async function handleAddQualificationFormSubmit(event) {
    event.preventDefault();
    showLoading(true);
    const newQualName = document.getElementById('addQualificationName').value.trim();
    if (!newQualName) {
        displayMessage(addQualificationMessage, 'Le nom de la qualification est requis.', true);
        showLoading(false);
        return;
    }
    try {
        const token = sessionStorage.getItem('jwtToken');
        const response = await fetch(`${API_BASE_URL}/api/qualifications`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name: newQualName })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Erreur lors de l\'ajout.');
        displayMessage(addQualificationMessage, 'Qualification ajoutée avec succès !', false);
        addQualificationModal.style.display = 'none';
        loadQualifications(); // Recharger la liste et la variable globale
    } catch (error) {
        console.error('Erreur ajout qualification:', error);
        displayMessage(addQualificationMessage, error.message, true);
    } finally {
        showLoading(false);
    }
}

function openEditQualificationModal(qualification) {
    document.getElementById('editQualificationId').value = qualification.id;
    document.getElementById('editQualificationName').value = qualification.name;
    editQualificationModal.style.display = 'block';
}

async function handleEditQualificationFormSubmit(event) {
    event.preventDefault();
    showLoading(true);
    const qualId = document.getElementById('editQualificationId').value;
    const updatedQualName = document.getElementById('editQualificationName').value.trim();
    if (!updatedQualName) {
        displayMessage(editQualificationMessage, 'Le nom est requis.', true);
        showLoading(false);
        return;
    }
    try {
        const token = sessionStorage.getItem('jwtToken');
        const response = await fetch(`${API_BASE_URL}/api/qualifications/${qualId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name: updatedQualName })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Erreur lors de la modification.');
        displayMessage(editQualificationMessage, 'Qualification modifiée avec succès !', false);
        editQualificationModal.style.display = 'none';
        loadQualifications(); // Recharger la liste et la variable globale
    } catch (error) {
        console.error('Erreur modification qualification:', error);
        displayMessage(editQualificationMessage, error.message, true);
    } finally {
        showLoading(false);
    }
}

async function deleteQualification(qualId) {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer la qualification ${qualId} ?`)) {
        return;
    }
    showLoading(true);
    try {
        const token = sessionStorage.getItem('jwtToken');
        const response = await fetch(`${API_BASE_URL}/api/qualifications/${qualId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Erreur lors de la suppression.');
        displayMessage(addQualificationMessage, 'Qualification supprimée avec succès !', false);
        loadQualifications();
    } catch (error) {
        console.error('Erreur suppression qualification:', error);
        displayMessage(addQualificationMessage, error.message, true);
    } finally {
        showLoading(false);
    }
}


// --- Fonctions de Gestion des Grades ---

async function loadGrades() {
    showLoading(true);
    try {
        const token = sessionStorage.getItem('jwtToken');
        const response = await fetch(`${API_BASE_URL}/api/grades`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error(`Erreur HTTP: ${response.status}`);
        availableGrades = await response.json(); // Met à jour la variable globale
        displayGrades(availableGrades);
    } catch (error) {
        console.error('Erreur lors du chargement des grades:', error);
        displayMessage(addGradeMessage, 'Impossible de charger les grades. ' + error.message, true);
        gradesListBody.innerHTML = '<tr><td colspan="3">Erreur lors du chargement des grades.</td></tr>';
    } finally {
        showLoading(false);
    }
}

function displayGrades(grades) {
    gradesListBody.innerHTML = '';
    if (grades.length === 0) {
        gradesListBody.innerHTML = '<tr><td colspan="3">Aucun grade enregistré.</td></tr>';
        return;
    }
    grades.forEach(g => {
        const row = gradesListBody.insertRow();
        row.insertCell(0).textContent = g.id;
        row.insertCell(1).textContent = g.name;
        const actionsCell = row.insertCell(2);
        const editButton = document.createElement('button');
        editButton.textContent = 'Modifier';
        editButton.className = 'btn btn-edit';
        editButton.addEventListener('click', () => openEditGradeModal(g));
        actionsCell.appendChild(editButton);

        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Supprimer';
        deleteButton.className = 'btn btn-delete';
        deleteButton.addEventListener('click', () => deleteGrade(g.id));
        actionsCell.appendChild(deleteButton);
    });
}

function openAddGradeModal() {
    addGradeForm.reset();
    addGradeMessage.textContent = '';
    addGradeModal.style.display = 'block';
}

async function handleAddGradeFormSubmit(event) {
    event.preventDefault();
    showLoading(true);
    const newGradeName = document.getElementById('addGradeName').value.trim();
    if (!newGradeName) {
        displayMessage(addGradeMessage, 'Le nom du grade est requis.', true);
        showLoading(false);
        return;
    }
    try {
        const token = sessionStorage.getItem('jwtToken');
        const response = await fetch(`${API_BASE_URL}/api/grades`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name: newGradeName })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Erreur lors de l\'ajout.');
        displayMessage(addGradeMessage, 'Grade ajouté avec succès !', false);
        addGradeModal.style.display = 'none';
        loadGrades(); // Recharger la liste et la variable globale
    } catch (error) {
        console.error('Erreur ajout grade:', error);
        displayMessage(addGradeMessage, error.message, true);
    } finally {
        showLoading(false);
    }
}

function openEditGradeModal(grade) {
    document.getElementById('editGradeId').value = grade.id;
    document.getElementById('editGradeName').value = grade.name;
    editGradeModal.style.display = 'block';
}

async function handleEditGradeFormSubmit(event) {
    event.preventDefault();
    showLoading(true);
    const gradeId = document.getElementById('editGradeId').value;
    const updatedGradeName = document.getElementById('editGradeName').value.trim();
    if (!updatedGradeName) {
        displayMessage(editGradeMessage, 'Le nom est requis.', true);
        showLoading(false);
        return;
    }
    try {
        const token = sessionStorage.getItem('jwtToken');
        const response = await fetch(`${API_BASE_URL}/api/grades/${gradeId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name: updatedGradeName })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Erreur lors de la modification.');
        displayMessage(editGradeMessage, 'Grade modifié avec succès !', false);
        editGradeModal.style.display = 'none';
        loadGrades(); // Recharger la liste et la variable globale
    } catch (error) {
        console.error('Erreur modification grade:', error);
        displayMessage(editGradeMessage, error.message, true);
    } finally {
        showLoading(false);
    }
}

async function deleteGrade(gradeId) {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer le grade ${gradeId} ?`)) {
        return;
    }
    showLoading(true);
    try {
        const token = sessionStorage.getItem('jwtToken');
        const response = await fetch(`${API_BASE_URL}/api/grades/${gradeId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Erreur lors de la suppression.');
        displayMessage(addGradeMessage, 'Grade supprimé avec succès !', false);
        loadGrades();
    } catch (error) {
        console.error('Erreur suppression grade:', error);
        displayMessage(addGradeMessage, error.message, true);
    } finally {
        showLoading(false);
    }
}

// --- Fonctions de Gestion des Fonctions ---

async function loadFonctions() {
    showLoading(true);
    try {
        const token = sessionStorage.getItem('jwtToken');
        const response = await fetch(`${API_BASE_URL}/api/fonctions`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error(`Erreur HTTP: ${response.status}`);
        availableFonctions = await response.json(); // Met à jour la variable globale
        displayFonctions(availableFonctions);
    } catch (error) {
        console.error('Erreur lors du chargement des fonctions:', error);
        displayMessage(addFonctionMessage, 'Impossible de charger les fonctions. ' + error.message, true);
        fonctionsListBody.innerHTML = '<tr><td colspan="3">Erreur lors du chargement des fonctions.</td></tr>';
    } finally {
        showLoading(false);
    }
}

function displayFonctions(fonctions) {
    fonctionsListBody.innerHTML = '';
    if (fonctions.length === 0) {
        fonctionsListBody.innerHTML = '<tr><td colspan="3">Aucune fonction enregistrée.</td></tr>';
        return;
    }
    fonctions.forEach(f => {
        const row = fonctionsListBody.insertRow();
        row.insertCell(0).textContent = f.id;
        row.insertCell(1).textContent = f.name;
        const actionsCell = row.insertCell(2);
        const editButton = document.createElement('button');
        editButton.textContent = 'Modifier';
        editButton.className = 'btn btn-edit';
        editButton.addEventListener('click', () => openEditFonctionModal(f));
        actionsCell.appendChild(editButton);

        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Supprimer';
        deleteButton.className = 'btn btn-delete';
        deleteButton.addEventListener('click', () => deleteFonction(f.id));
        actionsCell.appendChild(deleteButton);
    });
}

function openAddFonctionModal() {
    addFonctionForm.reset();
    addFonctionMessage.textContent = '';
    addFonctionModal.style.display = 'block';
}

async function handleAddFonctionFormSubmit(event) {
    event.preventDefault();
    showLoading(true);
    const newFonctionName = document.getElementById('addFonctionName').value.trim();
    if (!newFonctionName) {
        displayMessage(addFonctionMessage, 'Le nom de la fonction est requis.', true);
        showLoading(false);
        return;
    }
    try {
        const token = sessionStorage.getItem('jwtToken');
        const response = await fetch(`${API_BASE_URL}/api/fonctions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name: newFonctionName })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Erreur lors de l\'ajout.');
        displayMessage(addFonctionMessage, 'Fonction ajoutée avec succès !', false);
        addFonctionModal.style.display = 'none';
        loadFonctions(); // Recharger la liste et la variable globale
    } catch (error) {
        console.error('Erreur ajout fonction:', error);
        displayMessage(addFonctionMessage, error.message, true);
    } finally {
        showLoading(false);
    }
}

function openEditFonctionModal(fonction) {
    document.getElementById('editFonctionId').value = fonction.id;
    document.getElementById('editFonctionName').value = fonction.name;
    editFonctionModal.style.display = 'block';
}

async function handleEditFonctionFormSubmit(event) {
    event.preventDefault();
    showLoading(true);
    const fonctionId = document.getElementById('editFonctionId').value;
    const updatedFonctionName = document.getElementById('editFonctionName').value.trim();
    if (!updatedFonctionName) {
        displayMessage(editFonctionMessage, 'Le nom est requis.', true);
        showLoading(false);
        return;
    }
    try {
        const token = sessionStorage.getItem('jwtToken');
        const response = await fetch(`${API_BASE_URL}/api/fonctions/${fonctionId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name: updatedFonctionName })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Erreur lors de la modification.');
        displayMessage(editFonctionMessage, 'Fonction modifiée avec succès !', false);
        editFonctionModal.style.display = 'none';
        loadFonctions(); // Recharger la liste et la variable globale
    } catch (error) {
        console.error('Erreur modification fonction:', error);
        displayMessage(editFonctionMessage, error.message, true);
    } finally {
        showLoading(false);
    }
}

async function deleteFonction(fonctionId) {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer la fonction ${fonctionId} ?`)) {
        return;
    }
    showLoading(true);
    try {
        const token = sessionStorage.getItem('jwtToken');
        const response = await fetch(`${API_BASE_URL}/api/fonctions/${fonctionId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Erreur lors de la suppression.');
        displayMessage(addFonctionMessage, 'Fonction supprimée avec succès !', false);
        loadFonctions();
    } catch (error) {
        console.error('Erreur suppression fonction:', error);
        displayMessage(addFonctionMessage, error.message, true);
    } finally {
        showLoading(false);
    }
}


// --- Événements et Initialisation ---

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Authentifier et rediriger si nécessaire
    const isAuthenticated = await authenticateAndRedirect();
    if (!isAuthenticated) return;

    // 2. Initialiser les contrôles de semaine et charger le planning
    populateWeekSelect();
    loadPlanningForWeek(currentWeek); // Charge le planning global de la semaine actuelle
    fetchAdminData(); // Charge les données de l'admin (nom, prénom)

    // Initialiser les écouteurs pour la gestion des agents, qualifications, grades, fonctions
    // (Ils ne sont chargés que lorsque l'onglet correspondant est actif)
    // Mais les écouteurs des boutons d'ajout/modification/suppression doivent être actifs.

    addAgentForm.addEventListener('submit', handleAddAgentFormSubmit);
    editAgentForm.addEventListener('submit', handleEditAgentFormSubmit);
    addQualificationBtn.addEventListener('click', openAddQualificationModal);
    addQualificationForm.addEventListener('submit', handleAddQualificationFormSubmit);
    editQualificationForm.addEventListener('submit', handleEditQualificationFormSubmit);
    addGradeBtn.addEventListener('click', openAddGradeModal);
    addGradeForm.addEventListener('submit', handleAddGradeFormSubmit);
    editGradeForm.addEventListener('submit', handleEditGradeFormSubmit);
    addFonctionBtn.addEventListener('click', openAddFonctionModal);
    addFonctionForm.addEventListener('submit', handleAddFonctionFormSubmit);
    editFonctionForm.addEventListener('submit', handleEditFonctionFormSubmit);


    // Gestion des fermetures de modales
    document.querySelectorAll('.modal .close-button').forEach(button => {
        button.addEventListener('click', (event) => {
            event.target.closest('.modal').style.display = 'none';
        });
    });

    window.addEventListener('click', (event) => {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
        }
    });

    // Export PDF
    document.getElementById('export-pdf').addEventListener('click', exportPlanningToPdf);


    // Déconnexion
    document.getElementById('logout-btn').addEventListener('click', () => {
        sessionStorage.clear();
        window.location.href = 'login.html';
    });

    // Sélection de l'onglet par défaut (Planning Global)
    document.querySelector('.main-tab[data-main-tab="global-planning-view"]').click();
});


// Exportation du planning en PDF
async function exportPlanningToPdf() {
    showLoading(true, true); // Activer le spinner, et indiquer que c'est pour le PDF

    const planningElement = document.getElementById('global-planning'); // Le conteneur du tableau

    // Crée une copie du tableau du planning avec les styles en ligne pour une meilleure capture
    const clonedPlanningElement = planningElement.cloneNode(true);
    clonedPlanningElement.style.width = 'fit-content'; // Ajuster la largeur au contenu pour le PDF
    clonedPlanningElement.style.height = 'auto';
    clonedPlanningElement.style.padding = '20px'; // Ajouter un peu de padding
    clonedPlanningElement.style.backgroundColor = '#fff'; // Fond blanc
    clonedPlanningElement.style.border = '1px solid #ccc';


    // Appliquer les styles des classes CSS directement aux éléments clonés
    // (C'est un exemple simplifié, une solution plus robuste pourrait impliquer une bibliothèque CSS-in-JS ou des hacks)
    const table = clonedPlanningElement.querySelector('.planning-table');
    if (table) {
        table.style.borderCollapse = 'collapse';
        table.style.width = '100%';
        table.style.maxWidth = 'none'; // Pas de max-width
        table.style.fontSize = '10px'; // Taille de police plus petite pour le PDF

        const cells = table.querySelectorAll('th, td');
        cells.forEach(cell => {
            cell.style.border = '1px solid #ddd';
            cell.style.padding = '4px 6px';
            cell.style.textAlign = 'center';
            cell.style.verticalAlign = 'top'; // Alignement en haut pour les noms
        });

        const headers = table.querySelectorAll('th');
        headers.forEach(header => {
            header.style.backgroundColor = '#f2f2f2';
            header.style.fontWeight = 'bold';
            header.style.textTransform = 'capitalize';
        });

        const occupiedSlots = table.querySelectorAll('.occupied-slot');
        occupiedSlots.forEach(slot => {
            slot.style.backgroundColor = '#d4edda'; // Couleur verte claire
            slot.style.color = '#155724'; // Texte vert foncé
        });
    }

    // Temporairement ajouter l'élément cloné au DOM pour qu'html2canvas puisse le voir
    document.body.appendChild(clonedPlanningElement);

    try {
        const canvas = await html2canvas(clonedPlanningElement, {
            scale: 2, // Augmente la résolution pour une meilleure qualité PDF
            useCORS: true, // Important si des images externes sont utilisées
            logging: true, // Activer les logs pour le débogage de html2canvas
        });

        // Supprimer l'élément cloné du DOM après la capture
        document.body.removeChild(clonedPlanningElement);

        const imgData = canvas.toDataURL('image/png');
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('l', 'mm', 'a4'); // 'l' pour paysage, 'mm' pour millimètres, 'a4' format

        // Calculer les dimensions de l'image pour qu'elle s'adapte à la page A4 en paysage
        const imgWidth = 297; // A4 landscape width in mm
        const pageHeight = 210; // A4 landscape height in mm
        const imgHeight = canvas.height * imgWidth / canvas.width;
        let heightLeft = imgHeight;

        let position = 0;

        doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;

        while (heightLeft >= 0) {
            position = heightLeft - imgHeight;
            doc.addPage();
            doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
        }

        doc.save(`Planning_Semaine_${currentWeek}.pdf`);

        displayMessage(adminInfo, 'PDF généré avec succès !', false);

    } catch (error) {
        console.error('Erreur lors de la génération du PDF:', error);
        displayMessage(adminInfo, 'Erreur lors de la génération du PDF: ' + error.message, true);
    } finally {
        showLoading(false); // Désactiver le spinner
    }
}