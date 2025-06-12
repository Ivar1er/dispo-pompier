const days = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const API_BASE_URL = "https://dispo-pompier.onrender.com";

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
const agentsTableBody = document.querySelector('#agents-table tbody');
const addAgentModal = document.getElementById('addAgentModal');
const editAgentModal = document.getElementById('editAgentModal');
const editAgentForm = document.getElementById('editAgentForm');
const addAgentBtn = document.getElementById('add-agent-btn');
const agentManagementMessage = document.getElementById('agent-management-message');
const addAgentQualificationsSelect = document.getElementById('addAgentQualifications');
const editAgentQualificationsSelect = document.getElementById('editAgentQualifications');
const addAgentGradeSelect = document.getElementById('addAgentGrade');
const editAgentGradeSelect = document.getElementById('editAgentGrade');
const addAgentFonctionSelect = document.getElementById('addAgentFonction');
const editAgentFonctionSelect = document.getElementById('editAgentFonction');

// --- DOM Elements pour la vue "Gestion des Qualifications" ---
const addQualificationBtn = document.getElementById('add-qualification-btn');
const addQualificationModal = document.getElementById('addQualificationModal');
const addQualificationForm = document.getElementById('addQualificationForm');
const qualificationManagementMessage = document.getElementById('qualification-management-message');
const qualificationsTableBody = document.querySelector('#qualifications-table tbody');
const editQualificationModal = document.getElementById('editQualificationModal');
const editQualificationForm = document.getElementById('editQualificationForm');

// --- DOM Elements pour la vue "Gestion des Grades" ---
const addGradeBtn = document.getElementById('add-grade-btn');
const addGradeModal = document.getElementById('addGradeModal');
const addGradeForm = document.getElementById('addGradeForm');
const gradeManagementMessage = document.getElementById('grade-management-message');
const gradesTableBody = document.querySelector('#grades-table tbody');
const editGradeModal = document.getElementById('editGradeModal');
const editGradeForm = document.getElementById('editGradeForm');

// --- DOM Elements pour la vue "Gestion des Fonctions" ---
const addFonctionBtn = document.getElementById('add-fonction-btn');
const addFonctionModal = document.getElementById('addFonctionModal');
const addFonctionForm = document.getElementById('addFonctionForm');
const fonctionManagementMessage = document.getElementById('fonction-management-message');
const fonctionsTableBody = document.querySelector('#fonctions-table tbody');
const editFonctionModal = document.getElementById('editFonctionModal');
const editFonctionForm = document.getElementById('editFonctionForm');

const loadingSpinner = document.getElementById('loading-spinner');

// --- Fonctions utilitaires ---
function getCurrentWeek() {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const diff = now.getTime() - startOfYear.getTime();
    const oneDay = 1000 * 60 * 60 * 24;
    const day = Math.floor(diff / oneDay);
    return Math.ceil(day / 7);
}

function getStartAndEndDateOfWeek(weekNumber) {
    const jan1 = new Date(new Date().getFullYear(), 0, 1);
    const firstDayOfWeek = new Date(jan1.getTime() + (weekNumber - 1) * 7 * 24 * 60 * 60 * 1000);

    // Ajuster au bon jour de la semaine (lundi)
    let dayOfWeek = firstDayOfWeek.getDay();
    let diff = firstDayOfWeek.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Ajuste pour que lundi soit le 1er jour (0 pour dimanche)
    firstDayOfWeek.setDate(diff);

    const endDate = new Date(firstDayOfWeek);
    endDate.setDate(firstDayOfWeek.getDate() + 6);

    const options = { day: 'numeric', month: 'numeric', year: 'numeric' };
    return `${firstDayOfWeek.toLocaleDateString('fr-FR', options)} - ${endDate.toLocaleDateString('fr-FR', options)}`;
}

// Fonction pour vérifier l'authentification et rediriger
async function checkAuthAndRedirect() {
    const token = sessionStorage.getItem('token');
    const isAdmin = sessionStorage.getItem('isAdmin') === 'true'; // Convertir en booléen
    if (!token || !isAdmin) {
        alert("Vous n'êtes pas autorisé à accéder à cette page.");
        sessionStorage.clear(); // Effacer les données de session potentiellement invalides
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

function showLoading(isLoading, forPdf = false) {
    if (isLoading) {
        if (loadingSpinner) loadingSpinner.classList.remove("hidden");
        // Désactiver tous les contrôles globaux et ceux de l'onglet actif
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
        if (loadingSpinner) loadingSpinner.classList.add("hidden");
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


// --- Fonctions de chargement des données ---

// Charge la liste des agents pour les afficher dans le tableau de gestion
async function fetchAgentsForDisplay() {
    showLoading(true);
    try {
        const token = sessionStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/api/agents/display-info`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Erreur de chargement des agents.');
        const agents = await response.json();
        agentDisplayInfos = agents.reduce((acc, agent) => {
            acc[agent.id] = { nom: agent.nom, prenom: agent.prenom };
            return acc;
        }, {});
        renderAgentsTable(agents); // Rendre le tableau des agents
    } catch (error) {
        console.error('Erreur lors du chargement des agents:', error);
        agentManagementMessage.textContent = 'Erreur lors du chargement des agents: ' + error.message;
        agentManagementMessage.style.backgroundColor = "#f8d7da";
        agentManagementMessage.style.borderColor = "#f5c6cb";
        agentManagementMessage.style.color = "#721c24";
    } finally {
        showLoading(false);
    }
}

// Charge toutes les qualifications
async function fetchQualifications() {
    try {
        const token = sessionStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/api/qualifications`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Erreur de chargement des qualifications.');
        availableQualifications = await response.json();
        renderQualificationsTable(availableQualifications);
        populateSelect(addAgentQualificationsSelect, availableQualifications, true); // Populate multi-select
        populateSelect(editAgentQualificationsSelect, availableQualifications, true);
    } catch (error) {
        console.error('Erreur lors du chargement des qualifications:', error);
        qualificationManagementMessage.textContent = 'Erreur lors du chargement des qualifications: ' + error.message;
    }
}

// Charge tous les grades
async function fetchGrades() {
    try {
        const token = sessionStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/api/grades`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Erreur de chargement des grades.');
        availableGrades = await response.json();
        renderGradesTable(availableGrades);
        populateSelect(addAgentGradeSelect, availableGrades);
        populateSelect(editAgentGradeSelect, availableGrades);
    } catch (error) {
        console.error('Erreur lors du chargement des grades:', error);
        gradeManagementMessage.textContent = 'Erreur lors du chargement des grades: ' + error.message;
    }
}

// Charge toutes les fonctions
async function fetchFonctions() {
    try {
        const token = sessionStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/api/fonctions`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Erreur de chargement des fonctions.');
        availableFonctions = await response.json();
        renderFonctionsTable(availableFonctions);
        populateSelect(addAgentFonctionSelect, availableFonctions);
        populateSelect(editAgentFonctionSelect, availableFonctions);
    } catch (error) {
        console.error('Erreur lors du chargement des fonctions:', error);
        fonctionManagementMessage.textContent = 'Erreur lors du chargement des fonctions: ' + error.message;
    }
}


// Charge le planning global pour une semaine spécifique
async function loadPlanningForWeek(weekNumber) {
    showLoading(true);
    planningContainer.innerHTML = ''; // Nettoyer le contenu précédent
    adminInfo.textContent = `Chargement du planning pour la semaine ${weekNumber}...`;
    adminInfo.style.backgroundColor = "#e2e3e5";
    adminInfo.style.borderColor = "#d6d8db";
    adminInfo.style.color = "#383d41";

    try {
        const token = sessionStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/api/plannings/week/${weekNumber}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            if (response.status === 404) {
                planningData = {}; // Aucun planning trouvé, initialiser vide
                adminInfo.textContent = `Aucun planning trouvé pour la semaine ${weekNumber}.`;
            } else {
                throw new Error(`Erreur lors du chargement du planning: ${response.statusText}`);
            }
        } else {
            planningData = await response.json();
            adminInfo.textContent = `Vue du planning global des agents.`;
        }
        renderGlobalPlanning();
    } catch (error) {
        console.error('Erreur lors du chargement du planning global:', error);
        adminInfo.textContent = `Erreur: ${error.message}`;
        adminInfo.style.backgroundColor = "#f8d7da";
        adminInfo.style.borderColor = "#f5c6cb";
        adminInfo.style.color = "#721c24";
    } finally {
        showLoading(false);
    }
}

async function loadInitialData() {
    await fetchQualifications();
    await fetchGrades();
    await fetchFonctions();
    await fetchAgentsForDisplay(); // Doit être appelé après les grades et fonctions pour les selects
    await loadPlanningForWeek(currentWeek);
}


// --- Fonctions de rendu HTML ---

// Remplir un <select>
function populateSelect(selectElement, options, isMultiple = false) {
    selectElement.innerHTML = ''; // Clear existing options
    if (!isMultiple) {
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = '-- Sélectionner --';
        selectElement.appendChild(defaultOption);
    }
    options.forEach(option => {
        const opt = document.createElement('option');
        opt.value = option.id; // Utilisez l'ID pour la valeur
        opt.textContent = option.name;
        selectElement.appendChild(opt);
    });
}


// Rend le tableau des agents
function renderAgentsTable(agents) {
    agentsTableBody.innerHTML = '';
    if (agents.length === 0) {
        agentsTableBody.innerHTML = '<tr><td colspan="8">Aucun agent enregistré.</td></tr>';
        return;
    }
    agents.forEach(agent => {
        const row = agentsTableBody.insertRow();
        row.dataset.agentId = agent.id; // Stocke l'ID de l'agent sur la ligne

        row.insertCell().textContent = agent.id;
        row.insertCell().textContent = agent.nom;
        row.insertCell().textContent = agent.prenom;
        row.insertCell().textContent = agent.isAdmin ? 'Oui' : 'Non';
        row.insertCell().textContent = agent.qualifications ? agent.qualifications.map(q => availableQualifications.find(aq => aq.id === q)?.name || q).join(', ') : '';
        row.insertCell().textContent = agent.grade ? availableGrades.find(g => g.id === agent.grade)?.name || agent.grade : '';
        row.insertCell().textContent = agent.fonction ? availableFonctions.find(f => f.id === agent.fonction)?.name || agent.fonction : '';


        const actionsCell = row.insertCell();
        const editBtn = document.createElement('button');
        editBtn.textContent = 'Modifier';
        editBtn.classList.add('btn', 'btn-edit');
        editBtn.onclick = () => openEditAgentModal(agent);
        actionsCell.appendChild(editBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Supprimer';
        deleteBtn.classList.add('btn', 'btn-delete');
        deleteBtn.onclick = () => handleDeleteAgent(agent.id);
        actionsCell.appendChild(deleteBtn);
    });
}

// Rend le tableau des qualifications
function renderQualificationsTable(qualifications) {
    qualificationsTableBody.innerHTML = '';
    if (qualifications.length === 0) {
        qualificationsTableBody.innerHTML = '<tr><td colspan="2">Aucune qualification enregistrée.</td></tr>';
        return;
    }
    qualifications.forEach(q => {
        const row = qualificationsTableBody.insertRow();
        row.insertCell().textContent = q.name;
        const actionsCell = row.insertCell();
        const editBtn = document.createElement('button');
        editBtn.textContent = 'Modifier';
        editBtn.classList.add('btn', 'btn-edit');
        editBtn.onclick = () => openEditQualificationModal(q);
        actionsCell.appendChild(editBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Supprimer';
        deleteBtn.classList.add('btn', 'btn-delete');
        deleteBtn.onclick = () => handleDeleteQualification(q.id);
        actionsCell.appendChild(deleteBtn);
    });
}

// Rend le tableau des grades
function renderGradesTable(grades) {
    gradesTableBody.innerHTML = '';
    if (grades.length === 0) {
        gradesTableBody.innerHTML = '<tr><td colspan="2">Aucun grade enregistré.</td></tr>';
        return;
    }
    grades.forEach(g => {
        const row = gradesTableBody.insertRow();
        row.insertCell().textContent = g.name;
        const actionsCell = row.insertCell();
        const editBtn = document.createElement('button');
        editBtn.textContent = 'Modifier';
        editBtn.classList.add('btn', 'btn-edit');
        editBtn.onclick = () => openEditGradeModal(g);
        actionsCell.appendChild(editBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Supprimer';
        deleteBtn.classList.add('btn', 'btn-delete');
        deleteBtn.onclick = () => handleDeleteGrade(g.id);
        actionsCell.appendChild(deleteBtn);
    });
}

// Rend le tableau des fonctions
function renderFonctionsTable(fonctions) {
    fonctionsTableBody.innerHTML = '';
    if (fonctions.length === 0) {
        fonctionsTableBody.innerHTML = '<tr><td colspan="2">Aucune fonction enregistrée.</td></tr>';
        return;
    }
    fonctions.forEach(f => {
        const row = fonctionsTableBody.insertRow();
        row.insertCell().textContent = f.name;
        const actionsCell = row.insertCell();
        const editBtn = document.createElement('button');
        editBtn.textContent = 'Modifier';
        editBtn.classList.add('btn', 'btn-edit');
        editBtn.onclick = () => openEditFonctionModal(f);
        actionsCell.appendChild(editBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Supprimer';
        deleteBtn.classList.add('btn', 'btn-delete');
        deleteBtn.onclick = () => handleDeleteFonction(f.id);
        actionsCell.appendChild(deleteBtn);
    });
}


// Rend le planning global
function renderGlobalPlanning() {
    planningContainer.innerHTML = ''; // Nettoyer le contenu existant

    // Générer les en-têtes d'heures (07:00, 08:00, etc.)
    const headerHours = document.getElementById('header-hours');
    headerHours.innerHTML = '';
    for (let i = 7; i < 24; i++) {
        const hourDiv = document.createElement('div');
        hourDiv.classList.add('hour-marker');
        hourDiv.textContent = `${String(i).padStart(2, '0')}:00`;
        headerHours.appendChild(hourDiv);
    }
    for (let i = 0; i < 7; i++) { // Ajouter les heures de minuit à 6h du matin
        const hourDiv = document.createElement('div');
        hourDiv.classList.add('hour-marker');
        hourDiv.textContent = `${String(i).padStart(2, '0')}:00`;
        headerHours.appendChild(hourDiv);
    }

    const horaires = []; // Créneaux de 30 minutes de 07:00 à 07:00 le lendemain
    for (let i = 0; i < 48; i++) {
        const currentSlotHour = (7 + Math.floor(i / 2)) % 24;
        const currentSlotMinute = (i % 2) * 30;
        horaires.push(`${String(currentSlotHour).padStart(2, '0')}:${String(currentSlotMinute).padStart(2, '0')}`);
    }

    // Créer la colonne des noms d'agents
    const agentNameColumn = document.createElement('div');
    agentNameColumn.classList.add('agent-name-column');
    const emptyCell = document.createElement('div');
    emptyCell.classList.add('day-header');
    agentNameColumn.appendChild(emptyCell); // Cellule vide pour l'alignement avec les jours

    // Ajouter les noms des agents au début de chaque ligne
    Object.keys(planningData).forEach(agentId => {
        const agentInfo = agentDisplayInfos[agentId] || { nom: 'Inconnu', prenom: 'Agent' };
        const agentDiv = document.createElement('div');
        agentDiv.classList.add('agent-name-cell');
        agentDiv.textContent = `${agentInfo.prenom} ${agentInfo.nom}`;
        agentNameColumn.appendChild(agentDiv);
    });
    planningContainer.appendChild(agentNameColumn);


    days.forEach(day => {
        const dayColumn = document.createElement('div');
        dayColumn.classList.add('day-column');
        dayColumn.innerHTML = `<div class="day-header">${day.charAt(0).toUpperCase() + day.slice(1)}</div>`;

        Object.keys(planningData).forEach(agentId => {
            const agentPlanningForDay = planningData[agentId][day] || [];
            const agentRowDiv = document.createElement('div');
            agentRowDiv.classList.add('agent-row-slots');

            horaires.forEach(slot => {
                const slotDiv = document.createElement('div');
                slotDiv.classList.add('time-slot');
                if (agentPlanningForDay.includes(slot)) {
                    slotDiv.classList.add('selected');
                }
                agentRowDiv.appendChild(slotDiv);
            });
            dayColumn.appendChild(agentRowDiv);
        });
        planningContainer.appendChild(dayColumn);
    });
}

// Met à jour l'affichage de la plage de dates
function updateDateRangeDisplay() {
    dateRangeDisplay.textContent = getStartAndEndDateOfWeek(currentWeek);
}


// --- Fonctions de gestion des agents ---

// Ouvre la modale d'ajout d'agent
function openAddAgentModal() {
    addAgentForm.reset(); // Réinitialiser le formulaire
    populateSelect(addAgentQualificationsSelect, availableQualifications, true); // Re-populate multi-select
    populateSelect(addAgentGradeSelect, availableGrades);
    populateSelect(addAgentFonctionSelect, availableFonctions);
    addAgentMessage.textContent = '';
    addAgentModal.style.display = 'block';
}

// Ouvre la modale de modification d'agent
function openEditAgentModal(agent) {
    document.getElementById('editAgentOriginalId').value = agent.id; // Stocker l'ID original
    document.getElementById('editAgentIdDisplay').value = agent.id; // Afficher l'ID
    document.getElementById('editAgentNom').value = agent.nom;
    document.getElementById('editAgentPrenom').value = agent.prenom;
    document.getElementById('editAgentIsAdmin').checked = agent.isAdmin;

    // Remplir les sélecteurs de qualifications, grades, fonctions
    populateSelect(editAgentQualificationsSelect, availableQualifications, true);
    populateSelect(editAgentGradeSelect, availableGrades);
    populateSelect(editAgentFonctionSelect, availableFonctions);

    // Sélectionner les qualifications existantes de l'agent
    const currentQualifications = agent.qualifications || [];
    Array.from(editAgentQualificationsSelect.options).forEach(option => {
        option.selected = currentQualifications.includes(option.value);
    });

    // Sélectionner le grade existant de l'agent
    editAgentGradeSelect.value = agent.grade || '';

    // Sélectionner la fonction existante de l'agent
    editAgentFonctionSelect.value = agent.fonction || '';

    editAgentModal.style.display = 'block';
}

// Gère la soumission du formulaire d'ajout d'agent
async function handleAddAgentFormSubmit(event) {
    event.preventDefault();
    const id = document.getElementById('addAgentId').value;
    const nom = document.getElementById('addAgentNom').value;
    const prenom = document.getElementById('addAgentPrenom').value;
    const mdp = document.getElementById('addAgentMdp').value;
    const isAdmin = document.getElementById('addAgentIsAdmin').checked;
    const qualifications = Array.from(addAgentQualificationsSelect.selectedOptions).map(option => option.value);
    const grade = addAgentGradeSelect.value;
    const fonction = addAgentFonctionSelect.value;

    try {
        const token = sessionStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/api/add-agent`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ id, nom, prenom, mdp, isAdmin, qualifications, grade, fonction })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Erreur lors de l\'ajout de l\'agent.');
        addAgentMessage.textContent = 'Agent ajouté avec succès!';
        addAgentMessage.style.backgroundColor = "#d4edda";
        addAgentMessage.style.borderColor = "#c3e6cb";
        addAgentMessage.style.color = "#155724";
        await fetchAgentsForDisplay(); // Recharger la liste des agents
        addAgentForm.reset(); // Réinitialiser le formulaire
    } catch (error) {
        console.error('Erreur lors de l\'ajout de l\'agent:', error);
        addAgentMessage.textContent = 'Erreur: ' + error.message;
        addAgentMessage.style.backgroundColor = "#f8d7da";
        addAgentMessage.style.borderColor = "#f5c6cb";
        addAgentMessage.style.color = "#721c24";
    }
}

// Gère la soumission du formulaire de modification d'agent
async function handleEditAgentFormSubmit(event) {
    event.preventDefault();
    const originalId = document.getElementById('editAgentOriginalId').value;
    const nom = document.getElementById('editAgentNom').value;
    const prenom = document.getElementById('editAgentPrenom').value;
    const mdp = document.getElementById('editAgentMdp').value; // Peut être vide
    const isAdmin = document.getElementById('editAgentIsAdmin').checked;
    const qualifications = Array.from(editAgentQualificationsSelect.selectedOptions).map(option => option.value);
    const grade = editAgentGradeSelect.value;
    const fonction = editAgentFonctionSelect.value;

    const updateData = { nom, prenom, isAdmin, qualifications, grade, fonction };
    if (mdp) {
        updateData.mdp = mdp;
    }

    try {
        const token = sessionStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/api/edit-agent/${originalId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(updateData)
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Erreur lors de la modification de l\'agent.');
        alert('Agent mis à jour avec succès!');
        editAgentModal.style.display = 'none';
        await fetchAgentsForDisplay(); // Recharger la liste des agents
        await loadPlanningForWeek(currentWeek); // Recharger le planning global si l'agent modifié était visible
    } catch (error) {
        console.error('Erreur lors de la modification de l\'agent:', error);
        alert('Erreur lors de la modification de l\'agent: ' + error.message);
    }
}

// Gère la suppression d'un agent
async function handleDeleteAgent(agentId) {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer l'agent ${agentId} ?`)) return;

    try {
        const token = sessionStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/api/delete-agent/${agentId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Erreur lors de la suppression de l\'agent.');
        }
        alert('Agent supprimé avec succès!');
        await fetchAgentsForDisplay(); // Recharger la liste des agents
        await loadPlanningForWeek(currentWeek); // Recharger le planning global
    } catch (error) {
        console.error('Erreur lors de la suppression de l\'agent:', error);
        alert('Erreur lors de la suppression de l\'agent: ' + error.message);
    }
}


// --- Fonctions de gestion des qualifications ---
function openAddQualificationModal() {
    addQualificationForm.reset();
    addQualificationMessage.textContent = '';
    addQualificationModal.style.display = 'block';
}

async function handleAddQualificationFormSubmit(event) {
    event.preventDefault();
    const name = document.getElementById('addQualificationName').value;
    try {
        const token = sessionStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/api/qualifications`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ name })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Erreur lors de l\'ajout de la qualification.');
        addQualificationMessage.textContent = 'Qualification ajoutée!';
        addQualificationMessage.style.backgroundColor = "#d4edda";
        addQualificationMessage.style.borderColor = "#c3e6cb";
        addQualificationMessage.style.color = "#155724";
        await fetchQualifications();
        addQualificationForm.reset();
    } catch (error) {
        console.error('Erreur:', error);
        addQualificationMessage.textContent = 'Erreur: ' + error.message;
        addQualificationMessage.style.backgroundColor = "#f8d7da";
        addQualificationMessage.style.borderColor = "#f5c6cb";
        addQualificationMessage.style.color = "#721c24";
    }
}

function openEditQualificationModal(qualification) {
    document.getElementById('editQualificationId').value = qualification.id;
    document.getElementById('editQualificationName').value = qualification.name;
    document.getElementById('editQualificationMessage').textContent = '';
    editQualificationModal.style.display = 'block';
}

async function handleEditQualificationFormSubmit(event) {
    event.preventDefault();
    const id = document.getElementById('editQualificationId').value;
    const name = document.getElementById('editQualificationName').value;
    try {
        const token = sessionStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/api/qualifications/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ name })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Erreur lors de la mise à jour.');
        document.getElementById('editQualificationMessage').textContent = 'Qualification mise à jour!';
        document.getElementById('editQualificationMessage').style.backgroundColor = "#d4edda";
        document.getElementById('editQualificationMessage').style.borderColor = "#c3e6cb";
        document.getElementById('editQualificationMessage').style.color = "#155724";
        await fetchQualifications();
        await fetchAgentsForDisplay(); // Pour mettre à jour les agents si leurs qualifications sont affichées
    } catch (error) {
        console.error('Erreur:', error);
        document.getElementById('editQualificationMessage').textContent = 'Erreur: ' + error.message;
        document.getElementById('editQualificationMessage').style.backgroundColor = "#f8d7da";
        document.getElementById('editQualificationMessage').style.borderColor = "#f5c6cb";
        document.getElementById('editQualificationMessage').style.color = "#721c24";
    }
}

async function handleDeleteQualification(id) {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette qualification ?")) return;
    try {
        const token = sessionStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/api/qualifications/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Erreur lors de la suppression.');
        }
        alert('Qualification supprimée!');
        await fetchQualifications();
        await fetchAgentsForDisplay(); // Pour rafraîchir l'affichage des agents
    } catch (error) {
        console.error('Erreur:', error);
        alert('Erreur lors de la suppression de la qualification: ' + error.message);
    }
}

// --- Fonctions de gestion des grades ---
function openAddGradeModal() {
    addGradeForm.reset();
    addGradeMessage.textContent = '';
    addGradeModal.style.display = 'block';
}

async function handleAddGradeFormSubmit(event) {
    event.preventDefault();
    const name = document.getElementById('addGradeName').value;
    try {
        const token = sessionStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/api/grades`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ name })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Erreur lors de l\'ajout du grade.');
        addGradeMessage.textContent = 'Grade ajouté!';
        addGradeMessage.style.backgroundColor = "#d4edda";
        addGradeMessage.style.borderColor = "#c3e6cb";
        addGradeMessage.style.color = "#155724";
        await fetchGrades();
        addGradeForm.reset();
    } catch (error) {
        console.error('Erreur:', error);
        addGradeMessage.textContent = 'Erreur: ' + error.message;
        addGradeMessage.style.backgroundColor = "#f8d7da";
        addGradeMessage.style.borderColor = "#f5c6cb";
        addGradeMessage.style.color = "#721c24";
    }
}

function openEditGradeModal(grade) {
    document.getElementById('editGradeId').value = grade.id;
    document.getElementById('editGradeName').value = grade.name;
    document.getElementById('editGradeMessage').textContent = ''; // Assurez-vous que cet élément existe
    editGradeModal.style.display = 'block';
}

async function handleEditGradeFormSubmit(event) {
    event.preventDefault();
    const id = document.getElementById('editGradeId').value;
    const name = document.getElementById('editGradeName').value;
    try {
        const token = sessionStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/api/grades/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ name })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Erreur lors de la mise à jour.');
        document.getElementById('editGradeMessage').textContent = 'Grade mis à jour!';
        document.getElementById('editGradeMessage').style.backgroundColor = "#d4edda";
        document.getElementById('editGradeMessage').style.borderColor = "#c3e6cb";
        document.getElementById('editGradeMessage').style.color = "#155724";
        await fetchGrades();
        await fetchAgentsForDisplay(); // Pour mettre à jour les agents si leurs grades sont affichés
    } catch (error) {
        console.error('Erreur:', error);
        document.getElementById('editGradeMessage').textContent = 'Erreur: ' + error.message;
        document.getElementById('editGradeMessage').style.backgroundColor = "#f8d7da";
        document.getElementById('editGradeMessage').style.borderColor = "#f5c6cb";
        document.getElementById('editGradeMessage').style.color = "#721c24";
    }
}

async function handleDeleteGrade(id) {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce grade ?")) return;
    try {
        const token = sessionStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/api/grades/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Erreur lors de la suppression.');
        }
        alert('Grade supprimé!');
        await fetchGrades();
        await fetchAgentsForDisplay(); // Pour rafraîchir l'affichage des agents
    } catch (error) {
        console.error('Erreur:', error);
        alert('Erreur lors de la suppression du grade: ' + error.message);
    }
}

// --- Fonctions de gestion des fonctions ---
function openAddFonctionModal() {
    addFonctionForm.reset();
    fonctionManagementMessage.textContent = ''; // Assurez-vous que cet élément existe
    addFonctionModal.style.display = 'block';
}

async function handleAddFonctionFormSubmit(event) {
    event.preventDefault();
    const name = document.getElementById('addFonctionName').value;
    try {
        const token = sessionStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/api/fonctions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ name })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Erreur lors de l\'ajout de la fonction.');
        fonctionManagementMessage.textContent = 'Fonction ajoutée!';
        fonctionManagementMessage.style.backgroundColor = "#d4edda";
        fonctionManagementMessage.style.borderColor = "#c3e6cb";
        fonctionManagementMessage.style.color = "#155724";
        await fetchFonctions();
        addFonctionForm.reset();
    } catch (error) {
        console.error('Erreur:', error);
        fonctionManagementMessage.textContent = 'Erreur: ' + error.message;
        fonctionManagementMessage.style.backgroundColor = "#f8d7da";
        fonctionManagementMessage.style.borderColor = "#f5c6cb";
        fonctionManagementMessage.style.color = "#721c24";
    }
}

function openEditFonctionModal(fonction) {
    document.getElementById('editFonctionId').value = fonction.id;
    document.getElementById('editFonctionName').value = fonction.name;
    document.getElementById('editFonctionMessage').textContent = ''; // Assurez-vous que cet élément existe
    editFonctionModal.style.display = 'block';
}

async function handleEditFonctionFormSubmit(event) {
    event.preventDefault();
    const id = document.getElementById('editFonctionId').value;
    const name = document.getElementById('editFonctionName').value;
    try {
        const token = sessionStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/api/fonctions/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ name })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Erreur lors de la mise à jour.');
        document.getElementById('editFonctionMessage').textContent = 'Fonction mise à jour!';
        document.getElementById('editFonctionMessage').style.backgroundColor = "#d4edda";
        document.getElementById('editFonctionMessage').style.borderColor = "#c3e6cb";
        document.getElementById('editFonctionMessage').style.color = "#155724";
        await fetchFonctions();
        await fetchAgentsForDisplay(); // Pour mettre à jour les agents si leurs fonctions sont affichées
    } catch (error) {
        console.error('Erreur:', error);
        document.getElementById('editFonctionMessage').textContent = 'Erreur: ' + error.message;
        document.getElementById('editFonctionMessage').style.backgroundColor = "#f8d7da";
        document.getElementById('editFonctionMessage').style.borderColor = "#f5c6cb";
        document.getElementById('editFonctionMessage').style.color = "#721c24";
    }
}

async function handleDeleteFonction(id) {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette fonction ?")) return;
    try {
        const token = sessionStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/api/fonctions/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Erreur lors de la suppression.');
        }
        alert('Fonction supprimée!');
        await fetchFonctions();
        await fetchAgentsForDisplay(); // Pour rafraîchir l'affichage des agents
    } catch (error) {
        console.error('Erreur:', error);
        alert('Erreur lors de la suppression de la fonction: ' + error.message);
    }
}


// --- Fonctions d'exportation PDF ---

async function exportPlanningToPdf() {
    showLoading(true, true); // True pour le mode PDF

    const planningElement = document.getElementById('global-planning');
    const adminInfo = document.getElementById('admin-info');

    // Récupérer le texte de la plage de dates
    const dateRangeText = dateRangeDisplay.textContent;

    try {
        // Rendre le contenu HTML en un canvas
        const canvas = await html2canvas(planningElement, { scale: 2 }); // Scale pour une meilleure résolution
        const imgData = canvas.toDataURL('image/png');

        // Initialiser jsPDF
        // Assurez-vous que jspdf est correctement chargé via le CDN dans admin.html
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('landscape'); // 'landscape' pour un format paysage

        // Calculer les dimensions de l'image pour qu'elle s'adapte à la page PDF
        const imgWidth = 280; // Largeur pour un format A4 paysage (297mm - 17mm de marges)
        const pageHeight = doc.internal.pageSize.height;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        let heightLeft = imgHeight;
        let position = 0;

        // Ajouter un titre et la plage de dates
        doc.setFontSize(18);
        doc.text("Planning Global des Agents", 148, 15, null, null, "center"); // Centré
        doc.setFontSize(12);
        doc.text(`Semaine : ${dateRangeText}`, 148, 25, null, null, "center"); // Centré

        // Première image (peut contenir plusieurs pages)
        doc.addImage(imgData, 'PNG', 7, 35, imgWidth, imgHeight); // Y position décalée pour le titre

        heightLeft -= pageHeight - 35; // Réduit la hauteur restante par la hauteur de la première page

        // Si l'image est plus grande que la page, ajouter des pages supplémentaires
        while (heightLeft >= 0) {
            position = heightLeft - imgHeight; // Position négative pour le haut de l'image sur la nouvelle page
            doc.addPage();
            doc.addImage(imgData, 'PNG', 7, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
        }

        doc.save(`planning_semaine_${currentWeek}.pdf`);
        adminInfo.textContent = "Planning exporté avec succès.";
        adminInfo.style.backgroundColor = ""; // Reset styles
        adminInfo.style.borderColor = "";
        adminInfo.style.color = "";

    } catch (error) {
        console.error("Erreur lors de l'exportation PDF:", error);
        adminInfo.textContent = `Erreur lors de l'exportation PDF: ${error.message}`;
        adminInfo.style.backgroundColor = "#f8d7da"; // Light red for error
        adminInfo.style.borderColor = "#f5c6cb";
        adminInfo.style.color = "#721c24";
    } finally {
        showLoading(false, true);
    }
}


// --- Initialisation des événements ---

document.addEventListener("DOMContentLoaded", async () => {
    if (await checkAuthAndRedirect()) {
        populateWeekSelect();
        updateDateRangeDisplay();
        renderHeaderHours(); // Initialiser les heures avant le chargement des plannings
        await loadInitialData(); // Charge toutes les données initiales
    }
});

weekSelect.addEventListener("change", async (event) => {
    currentWeek = parseInt(event.target.value);
    updateDateRangeDisplay();
    await loadPlanningForWeek(currentWeek);
});

// Gestionnaires d'événements pour les onglets principaux
mainTabButtons.forEach(button => {
    button.addEventListener('click', () => {
        const targetTabId = button.dataset.mainTab;

        mainTabButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');

        mainTabContents.forEach(content => {
            content.style.display = 'none';
        });
        document.getElementById(targetTabId).style.display = 'block';

        // Recharger les données spécifiques à l'onglet si nécessaire
        if (targetTabId === 'agent-management-view') {
            fetchAgentsForDisplay();
            fetchQualifications(); // S'assurer que les qualifications sont à jour pour les sélecteurs
            fetchGrades();
            fetchFonctions();
        } else if (targetTabId === 'qualification-management-view') {
            fetchQualifications();
        } else if (targetTabId === 'grade-management-view') {
            fetchGrades();
        } else if (targetTabId === 'fonction-management-view') {
            fetchFonctions();
        }
    });
});

// Événements pour la gestion des agents
addAgentBtn.addEventListener('click', openAddAgentModal);
addAgentForm.addEventListener('submit', handleAddAgentFormSubmit);
editAgentForm.addEventListener('submit', handleEditAgentFormSubmit);


// Événements pour la gestion des qualifications
addQualificationBtn.addEventListener('click', openAddQualificationModal);
addQualificationForm.addEventListener('submit', handleAddQualificationFormSubmit);
editQualificationForm.addEventListener('submit', handleEditQualificationFormSubmit);

// Événements pour la gestion des grades
addGradeBtn.addEventListener('click', openAddGradeModal);
addGradeForm.addEventListener('submit', handleAddGradeFormSubmit);
editGradeForm.addEventListener('submit', handleEditGradeFormSubmit);

// Événements pour la gestion des fonctions
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


// Initialisation des semaines dans le sélecteur
function populateWeekSelect() {
    const currentYear = new Date().getFullYear();
    const totalWeeks = 52; // Ou calculez dynamiquement si nécessaire

    weekSelect.innerHTML = '';
    for (let i = 1; i <= totalWeeks; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = `Semaine ${i} (${getStartAndEndDateOfWeek(i)})`;
        if (i === currentWeek) {
            option.selected = true;
        }
        weekSelect.appendChild(option);
    }
}

// Déconnexion
document.getElementById('logout-btn').addEventListener('click', () => {
    sessionStorage.clear();
    window.location.href = 'login.html';
});