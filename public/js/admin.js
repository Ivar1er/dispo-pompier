const days = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const API_BASE_URL = "https://dispo-pompier.onrender.com"; // Assurez-vous que c'est la bonne URL de votre backend

let currentWeek = getCurrentWeek();
let currentDay = 'lundi';
let planningData = {}; // Cache pour stocker le planning par semaine
let agentDisplayInfos = {}; // Mapping agentId => {nom, prenom}
let availableGrades = [];
let availableFonctions = [];

// --- DOM Elements pour la navigation principale (onglets) ---
const mainTabButtons = document.querySelectorAll('.main-tab');
const mainTabContents = document.querySelectorAll('.main-tab-content');

// --- DOM Elements pour la vue "Planning Global" ---
// ATTENTION: Assurez-vous que votre admin.html a un <section id="global-planning-view">
const globalPlanningViewSection = document.getElementById('global-planning-view');
const weekSelect = document.getElementById("week-select");
const dateRangeDisplay = document.getElementById("date-range");
const tabButtons = document.querySelectorAll(".tab"); // Boutons de jour (Lundi, Mardi...)
const adminInfo = document.getElementById("admin-info"); // Message d'information général

// NOUVEAU: Le conteneur des contrôles de semaine et d'export qui est dans le header
const headerControlsPermanent = document.querySelector('.header-controls-permanent');
const exportPdfButton = document.getElementById("export-pdf");

// --- DOM Elements pour la vue "Gestion des Agents" ---
const addAgentForm = document.getElementById('addAgentForm');
const newAgentGradesCheckboxes = document.getElementById('newAgentGradesCheckboxes');
const newAgentFonctionsCheckboxes = document.getElementById('newAgentFonctionsCheckboxes');
const addAgentMessage = document.getElementById('addAgentMessage');
const agentsTableBody = document.getElementById('agentsTableBody');
const listAgentsMessage = document.getElementById('listAgentsMessage');

// DOM Elements pour la Modale de modification d'agent
const editAgentModal = document.getElementById('editAgentModal');
const editAgentForm = document.getElementById('editAgentForm');
const closeAgentModalButton = editAgentModal ? editAgentModal.querySelector('.close-button') : null;
const editAgentMessage = document.getElementById('editAgentMessage');

// DOM Elements pour les Grades
const addGradeForm = document.getElementById('addGradeForm');
const addGradeMessage = document.getElementById('addGradeMessage');
const gradesTableBody = document.getElementById('gradesTableBody');
const listGradesMessage = document.getElementById('listGradesMessage');

// Modale d'édition de grade
const editGradeModal = document.getElementById('editGradeModal');
const editGradeForm = document.getElementById('editGradeForm');
const closeGradeModalButton = editGradeModal ? editGradeModal.querySelector('.close-button') : null;
const editGradeMessage = document.getElementById('editGradeMessage');

// DOM Elements pour les Fonctions
const addFonctionForm = document.getElementById('addFonctionForm');
const addFonctionMessage = document.getElementById('addFonctionMessage');
const fonctionsTableBody = document.getElementById('fonctionsTableBody');
const listFonctionsMessage = document.getElementById('listFonctionsMessage');

// Modale d'édition de fonction
const editFonctionModal = document.getElementById('editFonctionModal');
const editFonctionForm = document.getElementById('editFonctionForm');
const closeFonctionModalButton = editFonctionModal ? editFonctionModal.querySelector('.close-button') : null;
const editFonctionMessage = document.getElementById('editFonctionMessage');

// DOM Elements pour le spinner de chargement
const loadingSpinner = document.getElementById('loading-spinner');

// --- Fonctions Utilitaires ---

function getCurrentWeek() {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const diff = now - startOfYear;
    const oneWeek = 1000 * 60 * 60 * 24 * 7;
    return Math.ceil(diff / oneWeek);
}

function getWeekDateRange(weekNumber) {
    const year = new Date().getFullYear(); // On suppose l'année actuelle
    const jan1 = new Date(year, 0, 1);
    const days = (weekNumber - 1) * 7;
    let startOfWeek = new Date(jan1.getFullYear(), jan1.getMonth(), jan1.getDate() + days);

    // Ajuster au lundi de la semaine si jan1 n'est pas un lundi
    const dayOfWeek = startOfWeek.getDay(); // 0 = Dimanche, 1 = Lundi, etc.
    const diff = startOfWeek.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Pour le lundi
    startOfWeek = new Date(startOfWeek.setDate(diff));

    const endOfWeek = new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate() + 6);

    const options = { day: 'numeric', month: 'short' };
    return `${startOfWeek.toLocaleDateString('fr-FR', options)} - ${endOfWeek.toLocaleDateString('fr-FR', options)}`;
}

function showInfoMessage(element, message, type = 'info') {
    element.textContent = message;
    element.className = `info-message ${type}`; // 'info', 'success', 'error'
    element.style.display = 'block';

    setTimeout(() => {
        element.style.display = 'none';
        element.textContent = '';
        element.className = 'info-message';
    }, 3000);
}

function showLoading(isLoading, forPdf = false) {
    if (isLoading) {
        loadingSpinner.classList.remove("hidden");
        document.querySelectorAll('button, select, input, a').forEach(el => {
            if (el.id !== 'logout-btn') { // Ne pas désactiver le bouton de déconnexion
                el.disabled = true;
                if (el.tagName === 'A') el.classList.add('disabled-link'); // Ajoute une classe pour les liens
            }
        });
        mainTabButtons.forEach(btn => btn.disabled = true);

        if (forPdf) {
            adminInfo.textContent = "Génération du PDF en cours, veuillez patienter...";
            adminInfo.style.backgroundColor = "#fff3cd";
            adminInfo.style.borderColor = "#ffeeba";
            adminInfo.style.color = "#856404";
        }
    } else {
        loadingSpinner.classList.add("hidden");
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

// --- Fonctions d'Authentification ---

async function checkAuth() {
    const token = localStorage.getItem('token');
    const username = localStorage.getItem('username'); // Récupérer le username aussi
    const role = localStorage.getItem('role');

    if (!token || !role || !username) { // Vérifier username aussi
        window.location.href = 'login.html';
        return false;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/verify-token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            // Le token n'est pas valide ou a expiré
            throw new Error('Token non valide ou expiré');
        }

        const data = await response.json();
        // Vérifier que le token est valide ET que le rôle est bien 'admin'
        if (data.isValid && data.role === 'admin') { // Utiliser data.role du serveur
            // Mettre à jour le message de bienvenue avec le nom d'utilisateur
            document.getElementById('welcome-message').textContent = `Bonjour, ${username} !`;
            return true;
        } else {
            // Token valide mais rôle non admin, ou isValid est false
            throw new Error('Accès non autorisé : rôle non admin ou validation échouée');
        }
    } catch (error) {
        console.error('Erreur de vérification du token:', error);
        handleLogout(); // Déconnecte l'utilisateur en cas d'erreur
        return false;
    }
}

function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('role');
    window.location.href = 'login.html';
}

// --- Fonctions de Gestion des Agents ---

async function fetchAgents() {
    showLoading(true);
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/api/agents`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) {
            throw new Error('Erreur lors de la récupération des agents');
        }
        const agents = await response.json();
        renderAgentsTable(agents);
        showLoading(false);
    } catch (error) {
        console.error('Erreur:', error);
        showInfoMessage(listAgentsMessage, 'Erreur lors du chargement des agents.', 'error');
        showLoading(false);
    }
}

async function addAgent(event) {
    event.preventDefault();
    showLoading(true);
    const formData = new FormData(addAgentForm);
    const agentData = {};
    formData.forEach((value, key) => {
        if (key === 'grades' || key === 'fonctions') {
            if (!agentData[key]) {
                agentData[key] = [];
            }
            agentData[key].push(value);
        } else {
            agentData[key] = value;
        }
    });

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/api/agents`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(agentData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Erreur lors de l\'ajout de l\'agent');
        }

        showInfoMessage(addAgentMessage, 'Agent ajouté avec succès!', 'success');
        addAgentForm.reset();
        await fetchAgents(); // Recharger la liste des agents après l'ajout
        await fetchAgentDisplayInfos(); // Mettre à jour la liste des noms/prénoms pour le planning
        populateNewAgentCheckboxes(); // Réinitialiser les checkboxes pour le prochain ajout
        showLoading(false);
    } catch (error) {
        console.error('Erreur:', error);
        showInfoMessage(addAgentMessage, error.message, 'error');
        showLoading(false);
    }
}

async function deleteAgent(id) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet agent ?')) {
        return;
    }
    showLoading(true);
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/api/agents/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Erreur lors de la suppression de l\'agent');
        }

        showInfoMessage(listAgentsMessage, 'Agent supprimé avec succès!', 'success');
        await fetchAgents(); // Recharger la liste des agents
        await fetchAgentDisplayInfos(); // Mettre à jour la liste des noms/prénoms pour le planning
        showLoading(false);
    } catch (error) {
        console.error('Erreur:', error);
        showInfoMessage(listAgentsMessage, error.message, 'error');
        showLoading(false);
    }
}

async function openEditAgentModal(agentId) {
    showLoading(true);
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/api/agents/${agentId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) {
            throw new Error('Agent non trouvé');
        }
        const agent = await response.json();

        document.getElementById('editAgentId').value = agent._id;
        document.getElementById('editNom').value = agent.nom;
        document.getElementById('editPrenom').value = agent.prenom;
        document.getElementById('editTel').value = agent.tel;
        document.getElementById('editEmail').value = agent.email;
        document.getElementById('editRole').value = agent.role;
        document.getElementById('editPassword').value = ''; // Ne pas pré-remplir le mot de passe pour des raisons de sécurité

        // Remplir les checkboxes de grades pour l'édition
        const editAgentGradesCheckboxes = document.getElementById('editAgentGradesCheckboxes');
        editAgentGradesCheckboxes.innerHTML = ''; // Nettoyer
        availableGrades.forEach(grade => {
            const div = document.createElement('div');
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.id = `edit-grade-${grade._id}`;
            input.name = 'grades';
            input.value = grade._id;
            if (agent.grades && agent.grades.includes(grade._id)) {
                input.checked = true;
            }
            const label = document.createElement('label');
            label.htmlFor = `edit-grade-${grade._id}`;
            label.textContent = grade.name;
            div.appendChild(input);
            div.appendChild(label);
            editAgentGradesCheckboxes.appendChild(div);
        });

        // Remplir les checkboxes de fonctions pour l'édition
        const editAgentFonctionsCheckboxes = document.getElementById('editAgentFonctionsCheckboxes');
        editAgentFonctionsCheckboxes.innerHTML = ''; // Nettoyer
        availableFonctions.forEach(fonction => {
            const div = document.createElement('div');
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.id = `edit-fonction-${fonction._id}`;
            input.name = 'fonctions';
            input.value = fonction._id;
            if (agent.fonctions && agent.fonctions.includes(fonction._id)) {
                input.checked = true;
            }
            const label = document.createElement('label');
            label.htmlFor = `edit-fonction-${fonction._id}`;
            label.textContent = fonction.name;
            div.appendChild(input);
            div.appendChild(label);
            editAgentFonctionsCheckboxes.appendChild(div);
        });


        editAgentModal.style.display = 'block';
        showLoading(false);
    } catch (error) {
        console.error('Erreur:', error);
        showInfoMessage(listAgentsMessage, 'Erreur lors du chargement des détails de l\'agent.', 'error');
        showLoading(false);
    }
}


async function editAgent(event) {
    event.preventDefault();
    showLoading(true);
    const agentId = document.getElementById('editAgentId').value;
    const agentData = {
        nom: document.getElementById('editNom').value,
        prenom: document.getElementById('editPrenom').value,
        tel: document.getElementById('editTel').value,
        email: document.getElementById('editEmail').value,
        role: document.getElementById('editRole').value,
        grades: Array.from(document.querySelectorAll('#editAgentGradesCheckboxes input[name="grades"]:checked')).map(cb => cb.value),
        fonctions: Array.from(document.querySelectorAll('#editAgentFonctionsCheckboxes input[name="fonctions"]:checked')).map(cb => cb.value)
    };

    const password = document.getElementById('editPassword').value;
    if (password) {
        agentData.password = password; // Inclure le mot de passe seulement s'il est rempli
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/api/agents/${agentId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(agentData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Erreur lors de la modification de l\'agent');
        }

        showInfoMessage(editAgentMessage, 'Agent modifié avec succès!', 'success');
        editAgentModal.style.display = 'none';
        await fetchAgents(); // Recharger la liste des agents
        await fetchAgentDisplayInfos(); // Mettre à jour la liste des noms/prénoms pour le planning
        showLoading(false);
    } catch (error) {
        console.error('Erreur:', error);
        showInfoMessage(editAgentMessage, error.message, 'error');
        showLoading(false);
    }
}

function renderAgentsTable(agents) {
    agentsTableBody.innerHTML = ''; // Nettoyer le tableau
    if (agents.length === 0) {
        agentsTableBody.innerHTML = '<tr><td colspan="7">Aucun agent trouvé.</td></tr>';
        return;
    }
    agents.forEach(agent => {
        const row = agentsTableBody.insertRow();
        row.dataset.id = agent._id; // Stocker l'ID sur la ligne

        const gradeNames = agent.grades && agent.grades.length > 0
            ? agent.grades.map(gradeId => {
                const grade = availableGrades.find(g => g._id === gradeId);
                return grade ? grade.name : 'Inconnu';
            }).join(', ')
            : 'Aucun';

        const fonctionNames = agent.fonctions && agent.fonctions.length > 0
            ? agent.fonctions.map(fonctionId => {
                const fonction = availableFonctions.find(f => f._id === fonctionId);
                return fonction ? fonction.name : 'Inconnue';
            }).join(', ')
            : 'Aucune';

        row.insertCell().textContent = agent.nom;
        row.insertCell().textContent = agent.prenom;
        row.insertCell().textContent = agent.tel;
        row.insertCell().textContent = agent.email;
        row.insertCell().textContent = agent.role;
        row.insertCell().textContent = gradeNames; // Afficher les noms des grades
        row.insertCell().textContent = fonctionNames; // Afficher les noms des fonctions

        const actionsCell = row.insertCell();
        const editBtn = document.createElement('button');
        editBtn.textContent = 'Modifier';
        editBtn.classList.add('btn', 'btn-edit');
        editBtn.onclick = () => openEditAgentModal(agent._id);
        actionsCell.appendChild(editBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Supprimer';
        deleteBtn.classList.add('btn', 'btn-danger');
        deleteBtn.onclick = () => deleteAgent(agent._id);
        actionsCell.appendChild(deleteBtn);
    });
}

// Fonction pour récupérer les noms et prénoms de tous les agents pour l'affichage dans le planning
async function fetchAgentDisplayInfos() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/api/agents/display-info`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) {
            throw new Error('Erreur lors de la récupération des noms/prénoms des agents');
        }
        const data = await response.json();
        agentDisplayInfos = data.reduce((acc, agent) => {
            acc[agent._id] = `${agent.nom} ${agent.prenom}`;
            return acc;
        }, {});
    } catch (error) {
        console.error('Erreur fetchAgentDisplayInfos:', error);
        // Gérer l'erreur, peut-être afficher un message à l'utilisateur
    }
}

// --- Fonctions de Gestion des Grades ---

async function fetchGrades() {
    showLoading(true);
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/api/grades`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            throw new Error('Erreur lors de la récupération des grades');
        }
        const grades = await response.json();
        availableGrades = grades; // Stocke les grades globalement
        renderGradesTable(grades);
        showLoading(false);
    } catch (error) {
        console.error('Erreur fetchGrades:', error);
        showInfoMessage(listGradesMessage, 'Erreur lors du chargement des grades.', 'error');
        showLoading(false);
    }
}

async function addGrade(event) {
    event.preventDefault();
    showLoading(true);
    const gradeName = document.getElementById('addGradeName').value;
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/api/grades`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name: gradeName })
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Erreur lors de l\'ajout du grade');
        }
        showInfoMessage(addGradeMessage, 'Grade ajouté avec succès!', 'success');
        addGradeForm.reset();
        await fetchGrades(); // Recharger les grades
        populateNewAgentCheckboxes(); // Mettre à jour les checkboxes d'agent
        showLoading(false);
    } catch (error) {
        console.error('Erreur addGrade:', error);
        showInfoMessage(addGradeMessage, error.message, 'error');
        showLoading(false);
    }
}

async function deleteGrade(id) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce grade ?')) {
        return;
    }
    showLoading(true);
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/api/grades/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Erreur lors de la suppression du grade');
        }
        showInfoMessage(listGradesMessage, 'Grade supprimé avec succès!', 'success');
        await fetchGrades(); // Recharger les grades
        populateNewAgentCheckboxes(); // Mettre à jour les checkboxes d'agent
        showLoading(false);
    } catch (error) {
        console.error('Erreur deleteGrade:', error);
        showInfoMessage(listGradesMessage, error.message, 'error');
        showLoading(false);
    }
}

async function openEditGradeModal(gradeId) {
    showLoading(true);
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/api/grades/${gradeId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            throw new Error('Grade non trouvé');
        }
        const grade = await response.json();
        document.getElementById('editGradeId').value = grade._id;
        document.getElementById('editGradeName').value = grade.name;
        editGradeModal.style.display = 'block';
        showLoading(false);
    } catch (error) {
        console.error('Erreur openEditGradeModal:', error);
        showInfoMessage(listGradesMessage, 'Erreur lors du chargement des détails du grade.', 'error');
        showLoading(false);
    }
}

async function editGrade(event) {
    event.preventDefault();
    showLoading(true);
    const gradeId = document.getElementById('editGradeId').value;
    const gradeName = document.getElementById('editGradeName').value;
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/api/grades/${gradeId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name: gradeName })
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Erreur lors de la modification du grade');
        }
        showInfoMessage(editGradeMessage, 'Grade modifié avec succès!', 'success');
        editGradeModal.style.display = 'none';
        await fetchGrades(); // Recharger les grades
        populateNewAgentCheckboxes(); // Mettre à jour les checkboxes d'agent
        showLoading(false);
    } catch (error) {
        console.error('Erreur editGrade:', error);
        showInfoMessage(editGradeMessage, error.message, 'error');
        showLoading(false);
    }
}

function renderGradesTable(grades) {
    gradesTableBody.innerHTML = '';
    if (grades.length === 0) {
        gradesTableBody.innerHTML = '<tr><td colspan="3">Aucun grade trouvé.</td></tr>';
        return;
    }
    grades.forEach(grade => {
        const row = gradesTableBody.insertRow();
        row.insertCell().textContent = grade.name;
        const actionsCell = row.insertCell();
        const editBtn = document.createElement('button');
        editBtn.textContent = 'Modifier';
        editBtn.classList.add('btn', 'btn-edit');
        editBtn.onclick = () => openEditGradeModal(grade._id);
        actionsCell.appendChild(editBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Supprimer';
        deleteBtn.classList.add('btn', 'btn-danger');
        deleteBtn.onclick = () => deleteGrade(grade._id);
        actionsCell.appendChild(deleteBtn);
    });
}

// --- Fonctions de Gestion des Fonctions ---

async function fetchFonctions() {
    showLoading(true);
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/api/fonctions`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            throw new Error('Erreur lors de la récupération des fonctions');
        }
        const fonctions = await response.json();
        availableFonctions = fonctions; // Stocke les fonctions globalement
        renderFonctionsTable(fonctions);
        showLoading(false);
    } catch (error) {
        console.error('Erreur fetchFonctions:', error);
        showInfoMessage(listFonctionsMessage, 'Erreur lors du chargement des fonctions.', 'error');
        showLoading(false);
    }
}

async function addFonction(event) {
    event.preventDefault();
    showLoading(true);
    const fonctionName = document.getElementById('addFonctionName').value;
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/api/fonctions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name: fonctionName })
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Erreur lors de l\'ajout de la fonction');
        }
        showInfoMessage(addFonctionMessage, 'Fonction ajoutée avec succès!', 'success');
        addFonctionForm.reset();
        await fetchFonctions(); // Recharger les fonctions
        populateNewAgentCheckboxes(); // Mettre à jour les checkboxes d'agent
        showLoading(false);
    } catch (error) {
        console.error('Erreur addFonction:', error);
        showInfoMessage(addFonctionMessage, error.message, 'error');
        showLoading(false);
    }
}

async function deleteFonction(id) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette fonction ?')) {
        return;
    }
    showLoading(true);
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/api/fonctions/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Erreur lors de la suppression de la fonction');
        }
        showInfoMessage(listFonctionsMessage, 'Fonction supprimée avec succès!', 'success');
        await fetchFonctions(); // Recharger les fonctions
        populateNewAgentCheckboxes(); // Mettre à jour les checkboxes d'agent
        showLoading(false);
    } catch (error) {
        console.error('Erreur deleteFonction:', error);
        showInfoMessage(listFonctionsMessage, error.message, 'error');
        showLoading(false);
    }
}

async function openEditFonctionModal(fonctionId) {
    showLoading(true);
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/api/fonctions/${fonctionId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            throw new Error('Fonction non trouvée');
        }
        const fonction = await response.json();
        document.getElementById('editFonctionId').value = fonction._id;
        document.getElementById('editFonctionName').value = fonction.name;
        editFonctionModal.style.display = 'block';
        showLoading(false);
    } catch (error) {
        console.error('Erreur openEditFonctionModal:', error);
        showInfoMessage(listFonctionsMessage, 'Erreur lors du chargement des détails de la fonction.', 'error');
        showLoading(false);
    }
}

async function editFonction(event) {
    event.preventDefault();
    showLoading(true);
    const fonctionId = document.getElementById('editFonctionId').value;
    const fonctionName = document.getElementById('editFonctionName').value;
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/api/fonctions/${fonctionId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name: fonctionName })
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Erreur lors de la modification de la fonction');
        }
        showInfoMessage(editFonctionMessage, 'Fonction modifiée avec succès!', 'success');
        editFonctionModal.style.display = 'none';
        await fetchFonctions(); // Recharger les fonctions
        populateNewAgentCheckboxes(); // Mettre à jour les checkboxes d'agent
        showLoading(false);
    } catch (error) {
        console.error('Erreur editFonction:', error);
        showInfoMessage(editFonctionMessage, error.message, 'error');
        showLoading(false);
    }
}

function renderFonctionsTable(fonctions) {
    fonctionsTableBody.innerHTML = '';
    if (fonctions.length === 0) {
        fonctionsTableBody.innerHTML = '<tr><td colspan="3">Aucune fonction trouvée.</td></tr>';
        return;
    }
    fonctions.forEach(fonction => {
        const row = fonctionsTableBody.insertRow();
        row.insertCell().textContent = fonction.name;
        const actionsCell = row.insertCell();
        const editBtn = document.createElement('button');
        editBtn.textContent = 'Modifier';
        editBtn.classList.add('btn', 'btn-edit');
        editBtn.onclick = () => openEditFonctionModal(fonction._id);
        actionsCell.appendChild(editBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Supprimer';
        deleteBtn.classList.add('btn', 'btn-danger');
        deleteBtn.onclick = () => deleteFonction(fonction._id);
        actionsCell.appendChild(deleteBtn);
    });
}


// Fonctions pour peupler les checkboxes des formulaires d'agents (grades et fonctions)
async function populateNewAgentCheckboxes() {
    if (!newAgentGradesCheckboxes || !newAgentFonctionsCheckboxes) return;

    newAgentGradesCheckboxes.innerHTML = '';
    availableGrades.forEach(grade => {
        const div = document.createElement('div');
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.id = `add-grade-${grade._id}`;
        input.name = 'grades';
        input.value = grade._id;
        const label = document.createElement('label');
        label.htmlFor = `add-grade-${grade._id}`;
        label.textContent = grade.name;
        div.appendChild(input);
        div.appendChild(label);
        newAgentGradesCheckboxes.appendChild(div);
    });

    newAgentFonctionsCheckboxes.innerHTML = '';
    availableFonctions.forEach(fonction => {
        const div = document.createElement('div');
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.id = `add-fonction-${fonction._id}`;
        input.name = 'fonctions';
        input.value = fonction._id;
        const label = document.createElement('label');
        label.htmlFor = `add-fonction-${fonction._id}`;
        label.textContent = fonction.name;
        div.appendChild(input);
        div.appendChild(label);
        newAgentFonctionsCheckboxes.appendChild(div);
    });
}


// --- Fonctions de Gestion du Planning ---

async function fetchPlanningData(week, day) {
    showLoading(true);
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/api/planning/week/${week}/day/${day}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) {
            throw new Error('Erreur lors de la récupération du planning');
        }
        const data = await response.json();
        // Mettre à jour le cache planningData
        if (!planningData[`week-${week}`]) {
            planningData[`week-${week}`] = {};
        }
        planningData[`week-${week}`][day] = data; // Stocke directement les données du jour

        renderPlanningTable(data);
        showLoading(false);
    } catch (error) {
        console.error('Erreur fetchPlanningData:', error);
        showInfoMessage(adminInfo, 'Erreur lors du chargement du planning.', 'error');
        // Vider le planning si erreur pour éviter d'afficher des données obsolètes
        renderPlanningTable([]);
        showLoading(false);
    }
}

async function updatePlanningSlot(agentId, weekNumber, dayName, slotIndex, isOccupied) {
    showLoading(true);
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/api/planning/${agentId}/${weekNumber}/${dayName}/${slotIndex}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ isOccupied })
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Erreur lors de la mise à jour du créneau');
        }
        // Pas besoin de recharger toutes les données, juste rafraîchir le créneau
        // Ou recharger le planning du jour si la mise à jour est complexe
        await fetchPlanningData(currentWeek, currentDay); // Recharger le jour actuel pour s'assurer de la cohérence
        showLoading(false);
    } catch (error) {
        console.error('Erreur updatePlanningSlot:', error);
        showInfoMessage(adminInfo, error.message, 'error');
        showLoading(false);
    }
}

function renderPlanningTable(dayPlanning) {
    const planningTableBody = document.getElementById('planningTableBody'); // Assurez-vous d'avoir cet ID dans votre HTML
    if (!planningTableBody) {
        console.error("Élément 'planningTableBody' introuvable dans le DOM.");
        return;
    }
    planningTableBody.innerHTML = ''; // Nettoyer le tableau

    const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0') + ':00');

    // Assurez-vous que agentDisplayInfos est rempli avant d'appeler cette fonction
    if (Object.keys(agentDisplayInfos).length === 0) {
        planningTableBody.innerHTML = '<tr><td colspan="25">Chargement des agents...</td></tr>';
        return;
    }

    // Sort agents by last name, then first name for consistent display
    const sortedAgentIds = Object.keys(agentDisplayInfos).sort((idA, idB) => {
        const nameA = agentDisplayInfos[idA];
        const nameB = agentDisplayInfos[idB];
        const [nomA, prenomA] = nameA.split(' ');
        const [nomB, prenomB] = nameB.split(' ');

        if (nomA < nomB) return -1;
        if (nomA > nomB) return 1;
        if (prenomA < prenomB) return -1;
        if (prenomA > prenomB) return 1;
        return 0;
    });


    sortedAgentIds.forEach(agentId => {
        const agentName = agentDisplayInfos[agentId] || `Agent ${agentId}`;
        const row = planningTableBody.insertRow();
        row.insertCell().textContent = agentName; // Colonne pour le nom de l'agent

        const agentSlots = dayPlanning.find(item => item.agentId === agentId);
        const slots = agentSlots ? agentSlots.slots : Array(24).fill(0); // 0 pour libre, 1 pour occupé

        hours.forEach((hour, index) => {
            const cell = row.insertCell();
            cell.classList.add('slot-cell');
            const isOccupied = slots[index] === 1;
            if (isOccupied) {
                cell.classList.add('occupied');
            } else {
                cell.classList.add('free');
            }
            cell.dataset.agentId = agentId;
            cell.dataset.slotIndex = index;
            cell.dataset.isOccupied = isOccupied ? 'true' : 'false';

            cell.addEventListener('click', async () => {
                const newIsOccupied = !isOccupied;
                await updatePlanningSlot(agentId, currentWeek, currentDay, index, newIsOccupied ? 1 : 0);
            });
        });
    });
}


function populateWeekSelect() {
    weekSelect.innerHTML = ''; // Nettoyer les options existantes
    const currentYear = new Date().getFullYear();
    const numberOfWeeks = 52; // La plupart des années ont 52 semaines, parfois 53

    for (let i = 1; i <= numberOfWeeks; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = `Semaine ${i}`;
        weekSelect.appendChild(option);
    }
    weekSelect.value = currentWeek; // Sélectionne la semaine actuelle
    dateRangeDisplay.textContent = getWeekDateRange(currentWeek);
}

// Fonction pour charger et afficher le planning de la semaine et du jour sélectionnés
async function loadWeekPlanning() {
    const selectedWeek = weekSelect.value;
    currentWeek = selectedWeek; // Mettre à jour la semaine globale
    dateRangeDisplay.textContent = getWeekDateRange(selectedWeek);

    // Charger le planning pour le jour actuel de la semaine sélectionnée
    await fetchPlanningData(currentWeek, currentDay);
}


// --- Fonctions de Gestion des Onglets et de l'Interface ---

function showMainTab(tabId) {
    mainTabContents.forEach(content => {
        content.classList.remove('active');
    });
    mainTabButtons.forEach(button => {
        button.classList.remove('active');
    });

    const targetTab = document.getElementById(tabId);
    if (targetTab) {
        targetTab.classList.add('active');
        const correspondingButton = document.querySelector(`.main-tab[data-tab="${tabId}"]`);
        if (correspondingButton) {
            correspondingButton.classList.add('active');
        }
    }

    // Gérer l'affichage des contrôles spécifiques à l'onglet "Planning Global"
    if (tabId === 'global-planning-view') {
        // Affiche les contrôles de semaine et d'export PDF
        headerControlsPermanent.style.display = 'flex'; // ou 'block', selon votre CSS
        // S'assurer que le planning est chargé pour la semaine et le jour en cours
        fetchPlanningData(currentWeek, currentDay);
    } else {
        // Cache ces contrôles pour les autres onglets
        headerControlsPermanent.style.display = 'none';
    }
}

function showDay(dayName) {
    currentDay = dayName; // Met à jour le jour global

    tabButtons.forEach(button => {
        button.classList.remove('active');
    });
    const clickedButton = document.querySelector(`.tab[data-day="${dayName}"]`);
    if (clickedButton) {
        clickedButton.classList.add('active');
    }

    // Charger le planning pour le jour sélectionné
    fetchPlanningData(currentWeek, currentDay);
}

// --- Initialisation des Écouteurs d'Événements ---

// Bouton de déconnexion
document.getElementById('logout-btn').addEventListener('click', handleLogout);

// Sélecteur de semaine
if (weekSelect) {
    weekSelect.addEventListener('change', loadWeekPlanning);
}

// Bouton d'export PDF
if (exportPdfButton) {
    exportPdfButton.addEventListener('click', async () => {
        showLoading(true, true); // Active le spinner avec message PDF
        try {
            // Options pour html2canvas pour cibler uniquement le tableau de planning
            const planningTable = document.getElementById('planning-table'); // ID de votre table de planning
            if (!planningTable) {
                throw new Error("Tableau de planning introuvable pour l'export PDF.");
            }

            const canvas = await html2canvas(planningTable, {
                scale: 2, // Augmente la résolution pour une meilleure qualité
                useCORS: true, // Important si des images/ressources viennent d'une autre origine
                logging: false // Désactive le logging pour html2canvas
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jspdf.jsPDF({
                orientation: 'landscape', // Orientation paysage
                unit: 'px', // Unités en pixels
                format: [canvas.width, canvas.height] // Dimensions du PDF basées sur le canvas
            });

            pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
            pdf.save(`planning_semaine_${currentWeek}_jour_${currentDay}.pdf`);
            showInfoMessage(adminInfo, 'PDF généré avec succès!', 'success');
        } catch (error) {
            console.error("Erreur lors de la génération du PDF:", error);
            showInfoMessage(adminInfo, `Erreur lors de la génération du PDF: ${error.message}`, 'error');
        } finally {
            showLoading(false, true); // Désactive le spinner
        }
    });
}

// Listeners pour les boutons de jour (Lundi, Mardi, etc.)
tabButtons.forEach(button => {
    button.addEventListener('click', () => {
        showDay(button.dataset.day);
    });
});

// Listeners pour les boutons des onglets principaux (Planning Global, Gestion Agents, etc.)
mainTabButtons.forEach(button => {
    button.addEventListener('click', () => {
        showMainTab(button.dataset.tab);
    });
});

// Gestion des formulaires
if (addAgentForm) {
    addAgentForm.addEventListener('submit', addAgent);
}

if (editAgentForm) {
    editAgentForm.addEventListener('submit', editAgent);
}
if (closeAgentModalButton) {
    closeAgentModalButton.addEventListener('click', () => editAgentModal.style.display = 'none');
}

// Gestion des grades
if (addGradeForm) {
    addGradeForm.addEventListener('submit', addGrade);
}
if (editGradeForm) {
    editGradeForm.addEventListener('submit', editGrade);
}
if (closeGradeModalButton) {
    closeGradeModalButton.addEventListener('click', () => editGradeModal.style.display = 'none');
}

// Gestion des fonctions
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
});


// -------------------------------------------------------------------
// NOUVEAU: SEUL ET UNIQUE écouteur d'événement DOMContentLoaded pour admin.js
// La logique d'authentification est maintenant la première chose exécutée.
// -------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
    showLoading(true); // Active le spinner dès le début

    const isAuthenticated = await checkAuth(); // Tente de vérifier l'authentification

    if (isAuthenticated) {
        // Si l'utilisateur est authentifié et admin, charger toutes les données
        // et initialiser l'interface complète.
        
        // Charger les informations d'affichage des agents (nom/prénom)
        await fetchAgentDisplayInfos(); 
        
        // Charger les grades et fonctions disponibles (pour les formulaires)
        await fetchGrades();
        await fetchFonctions();
        
        // Charger la liste des agents (pour la section de gestion des agents)
        await fetchAgents(); 
        
        // Pré-remplir les selecteurs et checkboxes (dépend des grades/fonctions)
        populateWeekSelect();
        populateNewAgentCheckboxes(); 

        // Afficher l'onglet par défaut (Planning Global) et charger ses données
        // showMainTab déclenchera automatiquement le chargement du planning du jour
        showMainTab('global-planning-view'); 
        showDay('lundi'); // S'assure que le premier jour est sélectionné et affiché

        showLoading(false); // Masque le spinner une fois tout chargé
    } else {
        // Si non authentifié, checkAuth aura déjà redirigé vers login.html.
        // On s'assure juste que le spinner est caché au cas où une erreur
        // bloquerait la redirection immédiate.
        showLoading(false);
    }
});