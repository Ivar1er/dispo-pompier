const days = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const API_BASE_URL = "https://dispo-pompier.onrender.com";

let currentWeek = getCurrentWeek(); // Semaine actuelle par défaut
let currentDay = 'lundi'; // Jour actuel par défaut pour le planning
let planningData = {}; // Contiendra le planning global chargé de l'API
let agentDisplayInfos = {}; // Mapping dynamique agentId => {nom, prenom}
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
const newAgentIdInput = document.getElementById('newAgentId');
const newAgentNomInput = document.getElementById('newAgentNom');
const newAgentPrenomInput = document.getElementById('newAgentPrenom');
const newAgentPasswordInput = document.getElementById('newAgentPassword');
const addAgentMessage = document.getElementById('addAgentMessage');
const agentsTableBody = document.getElementById('agentsTableBody');
const listAgentsMessage = document.getElementById('listAgentsMessage');
const editAgentModal = document.getElementById('editAgentModal');
const closeAgentButton = editAgentModal ? editAgentModal.querySelector('.close-button') : null;
const editAgentForm = document.getElementById('editAgentForm');
const editAgentId = document.getElementById('editAgentId');
const editAgentNom = document.getElementById('editAgentNom');
const editAgentPrenom = document.getElementById('editAgentPrenom');
const editAgentPassword = document.getElementById('editAgentPassword');
const editAgentMessage = document.getElementById('editAgentMessage');
const newAgentGradesCheckboxes = document.getElementById('newAgentGradesCheckboxes');
const newAgentFonctionsCheckboxes = document.getElementById('newAgentFonctionsCheckboxes');
const gradesCheckboxesDiv = document.getElementById('gradesCheckboxes');
const fonctionsCheckboxesDiv = document.getElementById('fonctionsCheckboxes');
const gradesMessage = document.getElementById('gradesMessage');
const fonctionsMessage = document.getElementById('fonctionsMessage');

// --- DOM Elements pour la vue "Gestion des Grades" ---
const addGradeForm = document.getElementById('addGradeForm');
const addGradeMessage = document.getElementById('addGradeMessage');
const gradesTableBody = document.getElementById('gradesTableBody');
const listGradesMessage = document.getElementById('listGradesMessage');
const editGradeModal = document.getElementById('editGradeModal');
const closeGradeButton = editGradeModal ? editGradeModal.querySelector('.close-button') : null;
const editGradeForm = document.getElementById('editGradeForm');
const editGradeId = document.getElementById('editGradeId');
const editGradeName = document.getElementById('editGradeName');
const editGradeMessage = document.getElementById('editGradeMessage');

// --- DOM Elements pour la vue "Gestion des Fonctions" ---
const addFonctionForm = document.getElementById('addFonctionForm');
const addFonctionMessage = document.getElementById('addFonctionMessage');
const fonctionsTableBody = document.getElementById('fonctionsTableBody');
const listFonctionsMessage = document.getElementById('listFonctionsMessage');
const editFonctionModal = document.getElementById('editFonctionModal');
const closeFonctionButton = editFonctionModal ? editFonctionModal.querySelector('.close-button') : null;
const editFonctionForm = document.getElementById('editFonctionForm');
const editFonctionId = document.getElementById('editFonctionId');
const editFonctionName = document.getElementById('editFonctionName');
const editFonctionMessage = document.getElementById('editFonctionMessage');

// --- Variables pour le planning ---
let selectedAbsences = {}; // {agentId: {day: [slots]}}
let selectedGrades = {};
let selectedFonctions = {};

// Fonction utilitaire pour afficher les messages
function showMessage(element, message, isError = false) {
    element.textContent = message;
    element.style.color = isError ? 'red' : 'green';
}

// Gestion de la visibilité du spinner de chargement
function toggleLoading(isLoading, forPdf = false) {
    const loadingSpinner = document.getElementById("loading-spinner"); // Assurez-vous d'avoir un élément spinner dans votre HTML
    if (isLoading) {
        // loadingSpinner.classList.remove("hidden"); // Décommenter si vous avez un spinner
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
        // loadingSpinner.classList.add("hidden"); // Décommenter si vous avez un spinner
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


// Fonctions utilitaires pour les dates et semaines
function getCurrentWeek() {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const diff = now.getTime() - startOfYear.getTime();
    const oneWeek = 1000 * 60 * 60 * 24 * 7;
    return Math.ceil(diff / oneWeek);
}

function getWeekRange(weekNumber) {
    const jan1 = new Date(new Date().getFullYear(), 0, 1);
    const startOfWeek = new Date(jan1.getTime() + (weekNumber - 1) * 7 * 24 * 60 * 60 * 1000);
    // Ajuster au lundi le plus proche
    startOfWeek.setDate(startOfWeek.getDate() - (startOfWeek.getDay() + 6) % 7 + 1);

    const endOfWeek = new Date(startOfWeek.getTime() + 6 * 24 * 60 * 60 * 1000);
    return { start: startOfWeek, end: endOfWeek };
}

function formatDate(date) {
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Initialisation du sélecteur de semaine
function populateWeekSelect() {
    weekSelect.innerHTML = ''; // Clear previous options
    const currentYear = new Date().getFullYear();
    for (let i = 1; i <= 52; i++) { // Typically 52 weeks in a year
        const option = document.createElement('option');
        option.value = i;
        option.textContent = `Semaine ${i}`;
        if (i === currentWeek) {
            option.selected = true;
        }
        weekSelect.appendChild(option);
    }
    updateDateRange();
}

function updateDateRange() {
    const { start, end } = getWeekRange(parseInt(weekSelect.value));
    dateRangeDisplay.textContent = `Du ${formatDate(start)} au ${formatDate(end)}`;
}

// -----------------------------------------------------------
// Fonctions de navigation et de chargement des onglets
// -----------------------------------------------------------

function openMainTab(tabId) {
    mainTabContents.forEach(content => {
        content.classList.add('hidden');
    });
    mainTabButtons.forEach(button => {
        button.classList.remove('active');
    });

    document.getElementById(tabId).classList.remove('hidden');
    document.querySelector(`button[data-main-tab="${tabId}"]`).classList.add('active');

    // Charger les données spécifiques à l'onglet
    if (tabId === 'global-planning-view') {
        loadPlanning();
        openDayTab(currentDay); // Ouvre le planning du jour par défaut
    } else if (tabId === 'agent-management-view') {
        loadAgents();
        loadAvailableGrades(); // Recharger les grades pour le formulaire d'ajout
        loadAvailableFonctions(); // Recharger les fonctions pour le formulaire d'ajout
    }
    
    else if (tabId === 'grade-management-view') {
        loadGradesList();
    } else if (tabId === 'fonction-management-view') {
        loadFonctionsList();
    }
}

function openDayTab(day) {
    currentDay = day;
    tabButtons.forEach(button => {
        button.classList.remove('active');
    });
    document.querySelector(`.planning-day-tabs button[data-day="${day}"]`).classList.add('active');
    renderPlanningForDay(day);
}

// -----------------------------------------------------------
// Fonctions pour le planning global (global-planning-view)
// -----------------------------------------------------------

async function loadPlanning() {
    toggleLoading(true);
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            window.location.href = 'index.html';
            return;
        }
        const response = await fetch(`${API_BASE_URL}/planning?week=${currentWeek}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            throw new Error('Erreur de chargement du planning');
        }
        const data = await response.json();
        planningData = data.planning;
        agentDisplayInfos = data.agentDisplayInfos; // Store agent names
        availableGrades = data.availableGrades; // Store available grades
        availableFonctions = data.availableFonctions; // Store available fonctions

        // Initialiser selectedAbsences si non défini ou si la semaine change
        if (!selectedAbsences[currentWeek]) {
            selectedAbsences[currentWeek] = {};
            for (const day of days) {
                selectedAbsences[currentWeek][day] = {};
            }
        }

        // Pré-remplir selectedAbsences avec les données du planning
        for (const day of days) {
            if (planningData[day]) {
                for (const agentId in planningData[day]) {
                    selectedAbsences[currentWeek][day][agentId] = planningData[day][agentId];
                }
            }
        }
        renderPlanningForDay(currentDay);
    } catch (error) {
        console.error('Erreur lors du chargement du planning:', error);
        alert('Erreur lors du chargement du planning: ' + error.message);
    } finally {
        toggleLoading(false);
    }
}


function renderPlanningForDay(day) {
    const dayContent = document.getElementById('planning-day-content');
    dayContent.innerHTML = ''; // Clear previous content

    const agents = Object.values(agentDisplayInfos).sort((a, b) => {
        // Trier par grade (du plus haut au plus bas) puis par nom
        const gradeA = availableGrades.find(g => g.id === (a.grades[0] || ''));
        const gradeB = availableGrades.find(g => g.id === (b.grades[0] || ''));

        if (gradeA && gradeB) {
            if (gradeA.order !== gradeB.order) {
                return gradeB.order - gradeA.order; // Tri descendant par ordre de grade
            }
        }
        return a.nom.localeCompare(b.nom); // Puis par nom
    });


    // Création du tableau de planning
    const table = document.createElement('table');
    table.classList.add('planning-table');

    // En-tête du tableau
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    const headerColumns = ['Agent', 'Matin (06h-14h)', 'Après-midi (14h-22h)', 'Nuit (22h-06h)'];
    headerColumns.forEach(text => {
        const th = document.createElement('th');
        th.textContent = text;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Corps du tableau
    const tbody = document.createElement('tbody');
    if (agents.length === 0) {
        const noAgentsRow = document.createElement('tr');
        noAgentsRow.innerHTML = `<td colspan="4">Aucun agent à afficher.</td>`;
        tbody.appendChild(noAgentsRow);
    } else {
        agents.forEach(agent => {
            const row = document.createElement('tr');
            row.dataset.agentId = agent.id;

            // Cellule Agent
            const agentCell = document.createElement('td');
            agentCell.classList.add('agent-info-cell');
            agentCell.innerHTML = `
                <div class="agent-name">${agent.nom} ${agent.prenom}</div>
                <div class="agent-details">
                    <span class="agent-grade">${(availableGrades.find(g => g.id === (agent.grades[0] || '')) || {}).name || 'N/A'}</span>
                    <span class="agent-fonction">${(availableFonctions.find(f => f.id === (agent.fonctions[0] || '')) || {}).name || 'N/A'}</span>
                    </div>
            `;
            row.appendChild(agentCell);

            // Cellules de planning
            const timeSlots = ['morning', 'afternoon', 'night'];
            timeSlots.forEach(slot => {
                const cell = document.createElement('td');
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.dataset.agentId = agent.id;
                checkbox.dataset.day = day;
                checkbox.dataset.slot = slot;
                checkbox.checked = (selectedAbsences[currentWeek][day][agent.id] || []).includes(slot);
                checkbox.addEventListener('change', handleAbsenceChange);
                cell.appendChild(checkbox);
                row.appendChild(cell);
            });
            tbody.appendChild(row);
        });
    }
    table.appendChild(tbody);
    dayContent.appendChild(table);
}


async function handleAbsenceChange(event) {
    const { agentId, day, slot } = event.target.dataset;
    const isChecked = event.target.checked;

    if (!selectedAbsences[currentWeek][day][agentId]) {
        selectedAbsences[currentWeek][day][agentId] = [];
    }

    if (isChecked) {
        if (!selectedAbsences[currentWeek][day][agentId].includes(slot)) {
            selectedAbsences[currentWeek][day][agentId].push(slot);
        }
    } else {
        selectedAbsences[currentWeek][day][agentId] = selectedAbsences[currentWeek][day][agentId].filter(s => s !== slot);
    }

    await savePlanningChanges(agentId, day, selectedAbsences[currentWeek][day][agentId]);
}

async function savePlanningChanges(agentId, day, absences) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/planning/update-absence`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                week: currentWeek,
                day: day,
                agentId: agentId,
                absences: absences
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Erreur serveur lors de la sauvegarde: ${errorText}`);
        }
        // Pas besoin de recharger tout le planning, l'état local est déjà à jour
        adminInfo.textContent = "Planning mis à jour avec succès.";
        adminInfo.style.backgroundColor = "#d4edda";
        adminInfo.style.borderColor = "#c3e6cb";
        adminInfo.style.color = "#155724";
        setTimeout(() => adminInfo.textContent = "Vue du planning global des agents.", 3000);
    } catch (error) {
        console.error('Erreur lors de la sauvegarde du planning:', error);
        adminInfo.textContent = "Erreur lors de la sauvegarde: " + error.message;
        adminInfo.style.backgroundColor = "#f8d7da";
        adminInfo.style.borderColor = "#f5c6cb";
        adminInfo.style.color = "#721c24";
    }
}


// -----------------------------------------------------------
// Fonctions CRUD pour la gestion des agents (agent-management-view)
// -----------------------------------------------------------

async function loadAgents() {
    toggleLoading(true);
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/agents`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            throw new Error('Erreur de chargement des agents');
        }
        const agents = await response.json();
        agentsTableBody.innerHTML = ''; // Clear previous content

        if (agents.length === 0) {
            agentsTableBody.innerHTML = '<tr><td colspan="6">Aucun agent trouvé.</td></tr>'; // Corrigé colspan
            return;
        }

        agents.forEach(agent => {
            const row = document.createElement('tr');
            row.dataset.id = agent.id;

            // Afficher les grades et fonctions dans la table
            const gradeNames = (agent.grades || [])
                                .map(id => {
                                    const grade = availableGrades.find(g => g.id === id);
                                    return grade ? grade.name : id;
                                })
                                .join(', ');
            const fonctionNames = (agent.fonctions || [])
                                  .map(id => {
                                      const fonction = availableFonctions.find(f => f.id === id);
                                      return fonction ? fonction.name : id;
                                  })
                                  .join(', ');

            // SUPPRIMÉ : Afficher les qualifications dans la table
            // const qualificationNames = (agent.qualifications || [])
            //                             .map(id => {
            //                                 const qualification = availableQualifications.find(q => q.id === id);
            //                                 return qualification ? qualification.name : id;
            //                             })
            //                             .join(', ');

            row.innerHTML = `
                <td>${agent.id}</td>
                <td>${agent.nom}</td>
                <td>${agent.prenom}</td>
                <td>${gradeNames}</td>
                <td>${fonctionNames}</td>
                <td>
                    <button class="edit-btn btn-secondary"
                            data-id="${agent.id}"
                            data-nom="${agent.nom}"
                            data-prenom="${agent.prenom}"
                            data-grades='${JSON.stringify(agent.grades || [])}'
                            data-fonctions='${JSON.stringify(agent.fonctions || [])}'>Modifier</button>
                    <button class="delete-btn btn-danger" data-id="${agent.id}">Supprimer</button>
                </td>
            `;
            agentsTableBody.appendChild(row);
        });
    } catch (error) {
        console.error('Erreur lors du chargement des agents:', error);
        listAgentsMessage.textContent = 'Erreur: ' + error.message;
        listAgentsMessage.style.color = 'red';
    } finally {
        toggleLoading(false);
    }
}

async function handleAddAgent(event) {
    event.preventDefault();
    toggleLoading(true);

    const id = newAgentIdInput.value.trim();
    const nom = newAgentNomInput.value.trim();
    const prenom = newAgentPrenomInput.value.trim();
    const password = newAgentPasswordInput.value.trim();

    if (!id || !nom || !prenom || !password) {
        showMessage(addAgentMessage, 'Tous les champs sont requis.', true);
        toggleLoading(false);
        return;
    }

    // Récupérer les grades sélectionnés
    const selectedGrades = Array.from(newAgentGradesCheckboxes.querySelectorAll('input[type="checkbox"]:checked'))
                               .map(checkbox => checkbox.value);
    // Récupérer les fonctions sélectionnées
    const selectedFonctions = Array.from(newAgentFonctionsCheckboxes.querySelectorAll('input[type="checkbox"]:checked'))
                                 .map(checkbox => checkbox.value);

    // SUPPRIMÉ : Récupérer les qualifications sélectionnées
    // const selectedQualifications = Array.from(newAgentQualificationsCheckboxes.querySelectorAll('input[type="checkbox"]:checked'))
    //                                    .map(checkbox => checkbox.value);

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/agents`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ id, nom, prenom, password, grades: selectedGrades, fonctions: selectedFonctions }) // SUPPRIMÉ: qualifications
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Erreur lors de l\'ajout de l\'agent');
        }

        showMessage(addAgentMessage, 'Agent ajouté avec succès !');
        addAgentForm.reset();
        // Réinitialiser les checkboxes après l'ajout
        newAgentGradesCheckboxes.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
        newAgentFonctionsCheckboxes.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
        // SUPPRIMÉ : Réinitialiser les checkboxes de qualification
        // newAgentQualificationsCheckboxes.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
        loadAgents(); // Recharger la liste des agents
    } catch (error) {
        console.error('Erreur lors de l\'ajout de l\'agent:', error);
        showMessage(addAgentMessage, 'Erreur: ' + error.message, true);
    } finally {
        toggleLoading(false);
    }
}

async function handleAgentActions(event) {
    if (event.target.classList.contains('delete-btn')) {
        const agentId = event.target.dataset.id;
        if (confirm(`Êtes-vous sûr de vouloir supprimer l'agent ${agentId} ?`)) {
            toggleLoading(true);
            try {
                const token = localStorage.getItem('token');
                const response = await fetch(`${API_BASE_URL}/agents/${agentId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Erreur lors de la suppression de l\'agent');
                }
                showMessage(listAgentsMessage, 'Agent supprimé avec succès !');
                loadAgents();
            } catch (error) {
                console.error('Erreur lors de la suppression de l\'agent:', error);
                showMessage(listAgentsMessage, 'Erreur: ' + error.message, true);
            } finally {
                toggleLoading(false);
            }
        }
    } else if (event.target.classList.contains('edit-btn')) {
        const target = event.target;
        const agentId = target.dataset.id;
        const agentNom = target.dataset.nom;
        const agentPrenom = target.dataset.prenom;
        const agentGrades = JSON.parse(target.dataset.grades || '[]');
        const agentFonctions = JSON.parse(target.dataset.fonctions || '[]');

        // SUPPRIMÉ : Parse des qualifications de l'agent
        // const agentQualifications = JSON.parse(target.dataset.qualifications || '[]');

        editAgentId.value = agentId;
        editAgentNom.value = agentNom;
        editAgentPrenom.value = agentPrenom;
        editAgentPassword.value = ''; // Clear password field for security

        // Charger et rendre les checkboxes pour les grades
        await loadAvailableGrades(); // Assurez-vous que les grades sont chargés
        renderGradesCheckboxes(agentGrades);

        // Charger et rendre les checkboxes pour les fonctions
        await loadAvailableFonctions(); // Assurez-vous que les fonctions sont chargées
        renderFonctionsCheckboxes(agentFonctions);

        // SUPPRIMÉ : Charger et rendre les checkboxes pour les qualifications
        // await loadAvailableQualifications(); // Assurez-vous que les qualifications sont chargées
        // renderQualificationsCheckboxes(agentQualifications);

        editAgentModal.style.display = 'block';
    }
}

async function handleEditAgent(event) {
    event.preventDefault();
    toggleLoading(true);

    const id = editAgentId.value;
    const nom = editAgentNom.value.trim();
    const prenom = editAgentPrenom.value.trim();
    const newPassword = editAgentPassword.value.trim();

    if (!nom || !prenom) {
        showMessage(editAgentMessage, 'Nom et prénom sont requis.', true);
        toggleLoading(false);
        return;
    }

    // Récupérer les grades sélectionnés
    const selectedGrades = Array.from(gradesCheckboxesDiv.querySelectorAll('input[type="checkbox"]:checked'))
                               .map(checkbox => checkbox.value);
    // Récupérer les fonctions sélectionnées
    const selectedFonctions = Array.from(fonctionsCheckboxesDiv.querySelectorAll('input[type="checkbox"]:checked'))
                                 .map(checkbox => checkbox.value);

    // SUPPRIMÉ : Récupérer les qualifications sélectionnées
    // const selectedQualifications = Array.from(qualificationsCheckboxesDiv.querySelectorAll('input[type="checkbox"]:checked'))
    //                                    .map(checkbox => checkbox.value);

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/agents/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ nom, prenom, newPassword, grades: selectedGrades, fonctions: selectedFonctions }) // SUPPRIMÉ: qualifications
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Erreur lors de la mise à jour de l\'agent');
        }

        showMessage(editAgentMessage, 'Agent mis à jour avec succès !');
        editAgentModal.style.display = 'none';
        loadAgents(); // Recharger la liste des agents
    } catch (error) {
        console.error('Erreur lors de la mise à jour de l\'agent:', error);
        showMessage(editAgentMessage, 'Erreur: ' + error.message, true);
    } finally {
        toggleLoading(false);
    }
}

// -----------------------------------------------------------
// Fonctions pour les grades (commun avec qualifications et fonctions)
// -----------------------------------------------------------

async function loadAvailableGrades() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/grades`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            throw new Error('Erreur de chargement des grades disponibles');
        }
        availableGrades = await response.json();
        // S'assurer que les grades sont triés par ordre croissant d'importance
        availableGrades.sort((a, b) => (a.order || 0) - (b.order || 0));
        renderNewAgentGradesCheckboxes();
    } catch (error) {
        console.error('Erreur lors du chargement des grades disponibles:', error);
        // Gérer l'erreur, par exemple afficher un message
    }
}

function renderNewAgentGradesCheckboxes() {
    newAgentGradesCheckboxes.innerHTML = ''; // Clear previous content
    if (availableGrades.length === 0) {
        newAgentGradesCheckboxes.textContent = 'Aucun grade disponible.';
        return;
    }
    availableGrades.forEach(grade => {
        const div = document.createElement('div');
        div.classList.add('checkbox-item');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `new-agent-grade-${grade.id}`;
        checkbox.value = grade.id;
        const label = document.createElement('label');
        label.htmlFor = `new-agent-grade-${grade.id}`;
        label.textContent = grade.name;
        div.appendChild(checkbox);
        div.appendChild(label);
        newAgentGradesCheckboxes.appendChild(div);
    });
}

function renderGradesCheckboxes(agentGrades = []) {
    gradesCheckboxesDiv.innerHTML = ''; // Clear previous content
    if (availableGrades.length === 0) {
        gradesCheckboxesDiv.textContent = 'Aucun grade disponible.';
        return;
    }
    availableGrades.forEach(grade => {
        const div = document.createElement('div');
        div.classList.add('checkbox-item');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `edit-agent-grade-${grade.id}`;
        checkbox.value = grade.id;
        checkbox.checked = agentGrades.includes(grade.id); // Check if agent has this grade
        const label = document.createElement('label');
        label.htmlFor = `edit-agent-grade-${grade.id}`;
        label.textContent = grade.name;
        div.appendChild(checkbox);
        div.appendChild(label);
        gradesCheckboxesDiv.appendChild(div);
    });
}

// -----------------------------------------------------------
// Fonctions pour les fonctions (commun avec grades et qualifications)
// -----------------------------------------------------------

async function loadAvailableFonctions() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/fonctions`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            throw new Error('Erreur de chargement des fonctions disponibles');
        }
        availableFonctions = await response.json();
        // Trier les fonctions si un ordre est défini
        availableFonctions.sort((a, b) => (a.order || 0) - (b.order || 0));
        renderNewAgentFonctionsCheckboxes();
    } catch (error) {
        console.error('Erreur lors du chargement des fonctions disponibles:', error);
        // Gérer l'erreur
    }
}

function renderNewAgentFonctionsCheckboxes() {
    newAgentFonctionsCheckboxes.innerHTML = ''; // Clear previous content
    if (availableFonctions.length === 0) {
        newAgentFonctionsCheckboxes.textContent = 'Aucune fonction disponible.';
        return;
    }
    availableFonctions.forEach(fonction => {
        const div = document.createElement('div');
        div.classList.add('checkbox-item');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `new-agent-fonction-${fonction.id}`;
        checkbox.value = fonction.id;
        const label = document.createElement('label');
        label.htmlFor = `new-agent-fonction-${fonction.id}`;
        label.textContent = fonction.name;
        div.appendChild(checkbox);
        div.appendChild(label);
        newAgentFonctionsCheckboxes.appendChild(div);
    });
}

function renderFonctionsCheckboxes(agentFonctions = []) {
    fonctionsCheckboxesDiv.innerHTML = ''; // Clear previous content
    if (availableFonctions.length === 0) {
        fonctionsCheckboxesDiv.textContent = 'Aucune fonction disponible.';
        return;
    }
    availableFonctions.forEach(fonction => {
        const div = document.createElement('div');
        div.classList.add('checkbox-item');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `edit-agent-fonction-${fonction.id}`;
        checkbox.value = fonction.id;
        checkbox.checked = agentFonctions.includes(fonction.id); // Check if agent has this fonction
        const label = document.createElement('label');
        label.htmlFor = `edit-agent-fonction-${fonction.id}`;
        label.textContent = fonction.name;
        div.appendChild(checkbox);
        div.appendChild(label);
        fonctionsCheckboxesDiv.appendChild(div);
    });
}

// -----------------------------------------------------------
// Fonctions CRUD pour la gestion des qualifications
// SUPPRIMÉES : Toutes les fonctions liées à la gestion des qualifications.
// -----------------------------------------------------------
// async function loadAvailableQualifications() { ... }
// function renderNewAgentQualificationsCheckboxes() { ... }
// function renderQualificationsCheckboxes(agentQualifications = []) { ... }
// async function loadQualificationsList() { ... }
// async function handleAddQualification(event) { ... }
// async function handleQualificationActions(event) { ... }
// async function handleEditQualification(event) { ... }


// -----------------------------------------------------------
// Fonctions CRUD pour la gestion des grades (grade-management-view)
// -----------------------------------------------------------

async function loadGradesList() {
    toggleLoading(true);
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/grades`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            throw new Error('Erreur de chargement des grades');
        }
        const grades = await response.json();
        gradesTableBody.innerHTML = ''; // Clear previous content

        if (grades.length === 0) {
            gradesTableBody.innerHTML = '<tr><td colspan="3">Aucun grade trouvé.</td></tr>';
            return;
        }

        grades.forEach(grade => {
            const row = document.createElement('tr');
            row.dataset.id = grade.id;
            row.innerHTML = `
                <td>${grade.id}</td>
                <td>${grade.name}</td>
                <td>
                    <button class="edit-btn btn-secondary" data-id="${grade.id}" data-name="${grade.name}">Modifier</button>
                    <button class="delete-btn btn-danger" data-id="${grade.id}">Supprimer</button>
                </td>
            `;
            gradesTableBody.appendChild(row);
        });
    } catch (error) {
        console.error('Erreur lors du chargement des grades:', error);
        listGradesMessage.textContent = 'Erreur: ' + error.message;
        listGradesMessage.style.color = 'red';
    } finally {
        toggleLoading(false);
    }
}

async function handleAddGrade(event) {
    event.preventDefault();
    toggleLoading(true);

    const id = document.getElementById('newGradeId').value.trim();
    const name = document.getElementById('newGradeName').value.trim();

    if (!id || !name) {
        showMessage(addGradeMessage, 'Identifiant et nom sont requis.', true);
        toggleLoading(false);
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/grades`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ id, name })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Erreur lors de l\'ajout du grade');
        }

        showMessage(addGradeMessage, 'Grade ajouté avec succès !');
        addGradeForm.reset();
        loadGradesList(); // Recharger la liste des grades
        loadAvailableGrades(); // Recharger les grades pour les checkboxes d'agent
    } catch (error) {
        console.error('Erreur lors de l\'ajout du grade:', error);
        showMessage(addGradeMessage, 'Erreur: ' + error.message, true);
    } finally {
        toggleLoading(false);
    }
}

async function handleGradeActions(event) {
    if (event.target.classList.contains('delete-btn')) {
        const gradeId = event.target.dataset.id;
        if (confirm(`Êtes-vous sûr de vouloir supprimer le grade ${gradeId} ? Cela affectera les agents qui l'ont.`)) {
            toggleLoading(true);
            try {
                const token = localStorage.getItem('token');
                const response = await fetch(`${API_BASE_URL}/grades/${gradeId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Erreur lors de la suppression du grade');
                }
                showMessage(listGradesMessage, 'Grade supprimé avec succès !');
                loadGradesList();
                loadAgents(); // Recharger les agents pour rafraîchir les grades affichés
                loadAvailableGrades(); // Mettre à jour les listes de sélection
            } catch (error) {
                console.error('Erreur lors de la suppression du grade:', error);
                showMessage(listGradesMessage, 'Erreur: ' + error.message, true);
            } finally {
                toggleLoading(false);
            }
        }
    } else if (event.target.classList.contains('edit-btn')) {
        const gradeId = event.target.dataset.id;
        const gradeName = event.target.dataset.name;
        editGradeId.value = gradeId;
        editGradeName.value = gradeName;
        editGradeModal.style.display = 'block';
    }
}

async function handleEditGrade(event) {
    event.preventDefault();
    toggleLoading(true);

    const id = editGradeId.value;
    const name = editGradeName.value.trim();

    if (!name) {
        showMessage(editGradeMessage, 'Le nom du grade est requis.', true);
        toggleLoading(false);
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/grades/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Erreur lors de la mise à jour du grade');
        }

        showMessage(editGradeMessage, 'Grade mis à jour avec succès !');
        editGradeModal.style.display = 'none';
        loadGradesList();
        loadAgents(); // Recharger les agents pour rafraîchir les grades affichés
        loadAvailableGrades(); // Mettre à jour les listes de sélection
    } catch (error) {
        console.error('Erreur lors de la mise à jour du grade:', error);
        showMessage(editGradeMessage, 'Erreur: ' + error.message, true);
    } finally {
        toggleLoading(false);
    }
}


// -----------------------------------------------------------
// Fonctions CRUD pour la gestion des fonctions (fonction-management-view)
// -----------------------------------------------------------

async function loadFonctionsList() {
    toggleLoading(true);
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/fonctions`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            throw new Error('Erreur de chargement des fonctions');
        }
        const fonctions = await response.json();
        fonctionsTableBody.innerHTML = ''; // Clear previous content

        if (fonctions.length === 0) {
            fonctionsTableBody.innerHTML = '<tr><td colspan="3">Aucune fonction trouvée.</td></tr>';
            return;
        }

        fonctions.forEach(fonction => {
            const row = document.createElement('tr');
            row.dataset.id = fonction.id;
            row.innerHTML = `
                <td>${fonction.id}</td>
                <td>${fonction.name}</td>
                <td>
                    <button class="edit-btn btn-secondary" data-id="${fonction.id}" data-name="${fonction.name}">Modifier</button>
                    <button class="delete-btn btn-danger" data-id="${fonction.id}">Supprimer</button>
                </td>
            `;
            fonctionsTableBody.appendChild(row);
        });
    } catch (error) {
        console.error('Erreur lors du chargement des fonctions:', error);
        listFonctionsMessage.textContent = 'Erreur: ' + error.message;
        listFonctionsMessage.style.color = 'red';
    } finally {
        toggleLoading(false);
    }
}

async function handleAddFonction(event) {
    event.preventDefault();
    toggleLoading(true);

    const id = document.getElementById('newFonctionId').value.trim();
    const name = document.getElementById('newFonctionName').value.trim();

    if (!id || !name) {
        showMessage(addFonctionMessage, 'Identifiant et nom sont requis.', true);
        toggleLoading(false);
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/fonctions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ id, name })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Erreur lors de l\'ajout de la fonction');
        }

        showMessage(addFonctionMessage, 'Fonction ajoutée avec succès !');
        addFonctionForm.reset();
        loadFonctionsList(); // Recharger la liste des fonctions
        loadAvailableFonctions(); // Recharger les fonctions pour les checkboxes d'agent
    } catch (error) {
        console.error('Erreur lors de l\'ajout de la fonction:', error);
        showMessage(addFonctionMessage, 'Erreur: ' + error.message, true);
    } finally {
        toggleLoading(false);
    }
}

async function handleFonctionActions(event) {
    if (event.target.classList.contains('delete-btn')) {
        const fonctionId = event.target.dataset.id;
        if (confirm(`Êtes-vous sûr de vouloir supprimer la fonction ${fonctionId} ? Cela affectera les agents qui l'ont.`)) {
            toggleLoading(true);
            try {
                const token = localStorage.getItem('token');
                const response = await fetch(`${API_BASE_URL}/fonctions/${fonctionId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Erreur lors de la suppression de la fonction');
                }
                showMessage(listFonctionsMessage, 'Fonction supprimée avec succès !');
                loadFonctionsList();
                loadAgents(); // Recharger les agents pour rafraîchir les fonctions affichées
                loadAvailableFonctions(); // Mettre à jour les listes de sélection
            } catch (error) {
                console.error('Erreur lors de la suppression de la fonction:', error);
                showMessage(listFonctionsMessage, 'Erreur: ' + error.message, true);
            } finally {
                toggleLoading(false);
            }
        }
    } else if (event.target.classList.contains('edit-btn')) {
        const fonctionId = event.target.dataset.id;
        const fonctionName = event.target.dataset.name;
        editFonctionId.value = fonctionId;
        editFonctionName.value = fonctionName;
        editFonctionModal.style.display = 'block';
    }
}

async function handleEditFonction(event) {
    event.preventDefault();
    toggleLoading(true);

    const id = editFonctionId.value;
    const name = editFonctionName.value.trim();

    if (!name) {
        showMessage(editFonctionMessage, 'Le nom de la fonction est requis.', true);
        toggleLoading(false);
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/fonctions/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Erreur lors de la mise à jour de la fonction');
        }

        showMessage(editFonctionMessage, 'Fonction mise à jour avec succès !');
        editFonctionModal.style.display = 'none';
        loadFonctionsList();
        loadAgents(); // Recharger les agents pour rafraîchir les fonctions affichées
        loadAvailableFonctions(); // Mettre à jour les listes de sélection
    } catch (error) {
        console.error('Erreur lors de la mise à jour de la fonction:', error);
        showMessage(editFonctionMessage, 'Erreur: ' + error.message, true);
    } finally {
        toggleLoading(false);
    }
}


// -----------------------------------------------------------
// Initialisation des écouteurs d'événements
// -----------------------------------------------------------

document.addEventListener("DOMContentLoaded", async () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    populateWeekSelect();
    await loadPlanning(); // Charge le planning initial et les infos d'agent
    await loadAvailableGrades(); // Charge les grades disponibles
    await loadAvailableFonctions(); // Charge les fonctions disponibles

    // SUPPRIMÉ : Pas besoin de charger les qualifications disponibles
    // await loadAvailableQualifications();

    // Gestion des onglets principaux
    mainTabButtons.forEach(button => {
        button.addEventListener('click', () => {
            openMainTab(button.dataset.mainTab);
        });
    });

    // Gestion des onglets de jour (Planning Global)
    tabButtons.forEach(button => {
        button.addEventListener('click', () => openDayTab(button.dataset.day));
    });

    // Gestion des événements du Planning Global
    weekSelect.addEventListener('change', async (event) => {
        currentWeek = parseInt(event.target.value);
        updateDateRange();
        await loadPlanning();
        openDayTab(currentDay); // S'assurer que le planning du jour actuel est affiché pour la nouvelle semaine
    });

    // Événements pour la gestion des agents
    if (addAgentForm) {
        addAgentForm.addEventListener('submit', handleAddAgent);
    }
    if (agentsTableBody) {
        agentsTableBody.addEventListener('click', handleAgentActions);
    }
    if (closeAgentButton) {
        closeAgentButton.addEventListener('click', () => {
            editAgentModal.style.display = 'none';
        });
    }
    window.addEventListener('click', (event) => {
        if (event.target == editAgentModal) {
            editAgentModal.style.display = 'none';
        }
        
        if (event.target == editGradeModal) {
            editGradeModal.style.display = 'none';
        }
        if (event.target == editFonctionModal) {
            editFonctionModal.style.display = 'none';
        }
    });
    if (editAgentForm) {
        editAgentForm.addEventListener('submit', handleEditAgent);
    }

    // Événements pour la gestion des grades
    if (addGradeForm) {
        addGradeForm.addEventListener('submit', handleAddGrade);
    }
    if (gradesTableBody) {
        gradesTableBody.addEventListener('click', handleGradeActions);
    }
    if (closeGradeButton) {
        closeGradeButton.addEventListener('click', () => {
            editGradeModal.style.display = 'none';
        });
    }
    if (editGradeForm) {
        editGradeForm.addEventListener('submit', handleEditGrade);
    }

    // Événements pour la gestion des fonctions
    if (addFonctionForm) {
        addFonctionForm.addEventListener('submit', handleAddFonction);
    }
    if (fonctionsTableBody) {
        fonctionsTableBody.addEventListener('click', handleFonctionActions);
    }
    if (closeFonctionButton) {
        closeFonctionButton.addEventListener('click', () => {
            editFonctionModal.style.display = 'none';
        });
    }
    if (editFonctionForm) {
        editFonctionForm.addEventListener('submit', handleEditFonction);
    }

    // Initialisation de l'onglet actif au chargement
    openMainTab('global-planning-view'); // Ouvre le planning global par défaut

    // Gérer la déconnexion
    document.getElementById('logout-btn').addEventListener('click', () => {
        localStorage.removeItem('token');
        window.location.href = 'index.html';
    });

    // Exporter en PDF
    document.getElementById('export-pdf').addEventListener('click', async () => {
        toggleLoading(true, true); // Active le chargement avec un message spécifique pour le PDF

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // Récupérer le planning global de la semaine
        const planningDiv = document.getElementById('global-planning');

        // Créer une copie du planning pour la manipulation sans affecter l'affichage réel
        const planningClone = planningDiv.cloneNode(true);
        planningClone.style.display = 'block'; // S'assurer qu'il est visible pour html2canvas

        // Supprimer les boutons de jour et autres contrôles qui ne devraient pas être dans le PDF
        const dayTabs = planningClone.querySelector('.planning-day-tabs');
        if (dayTabs) dayTabs.remove();

        const weekControls = document.getElementById('planning-controls');
        if (weekControls) weekControls.style.display = 'none'; // Temporarily hide controls for PDF

        // Afficher les onglets de contenu des jours pour les capturer dans le PDF
        const planningDayContent = planningClone.querySelector('#planning-day-content');
        if (planningDayContent) planningDayContent.style.display = 'block';

        // Pour chaque jour, générer une page
        let yOffset = 10;
        const pageHeight = doc.internal.pageSize.height;
        const pageWidth = doc.internal.pageSize.width;
        const margin = 10;

        // Ajouter le titre pour la semaine
        doc.setFontSize(16);
        const { start, end } = getWeekRange(currentWeek);
        const weekTitle = `Planning de la semaine du ${formatDate(start)} au ${formatDate(end)}`;
        doc.text(weekTitle, pageWidth / 2, yOffset, { align: 'center' });
        yOffset += 15;

        for (const day of days) {
            // Créer un conteneur temporaire pour chaque tableau de jour
            const tempContainer = document.createElement('div');
            tempContainer.style.width = `${planningDiv.offsetWidth}px`; // Assurez-vous d'avoir la bonne largeur
            tempContainer.style.padding = '10px';
            tempContainer.style.boxSizing = 'border-box';
            tempContainer.innerHTML = `<h3>${day.charAt(0).toUpperCase() + day.slice(1)}</h3>`; // Titre du jour
            const table = planningClone.querySelector(`[data-day="${day}"]`).closest('.planning-table'); // Assurez-vous que c'est le bon sélecteur
            if (table) {
                tempContainer.appendChild(table.cloneNode(true)); // Cloner le tableau spécifique du jour
                document.body.appendChild(tempContainer); // Ajouter temporairement au DOM pour html2canvas

                await html2canvas(tempContainer, { scale: 2, useCORS: true }).then(canvas => {
                    const imgData = canvas.toDataURL('image/png');
                    const imgWidth = 190; // Largeur pour s'adapter à la page (pageWidth - 2*margin)
                    const imgHeight = (canvas.height * imgWidth) / canvas.width;

                    if (yOffset + imgHeight > pageHeight - margin) {
                        doc.addPage();
                        yOffset = margin; // Réinitialiser le décalage pour la nouvelle page
                    }

                    doc.addImage(imgData, 'PNG', margin, yOffset, imgWidth, imgHeight);
                    yOffset += imgHeight + 10; // Espacement après l'image
                });
                document.body.removeChild(tempContainer); // Supprimer le conteneur temporaire
            }
        }

        doc.save(`planning_semaine_${currentWeek}.pdf`);
        toggleLoading(false, true); // Désactive le chargement
        if (weekControls) weekControls.style.display = ''; // Restore controls display
    });
});