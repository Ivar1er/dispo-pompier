// admin.js
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
const logoutButton = document.getElementById("logout-btn"); // Le bouton de déconnexion

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
const editAgentIdInput = document.getElementById('editAgentId');
const editAgentPrenomInput = document.getElementById('editAgentPrenom');
const editAgentNomInput = document.getElementById('editAgentNom');
const editAgentNewPasswordInput = document.getElementById('editAgentNewPassword');
const editAgentGradesCheckboxes = document.getElementById('editAgentGradesCheckboxes');
const editAgentFonctionsCheckboxes = document.getElementById('editAgentFonctionsCheckboxes');
const editAgentMessage = document.getElementById('editAgentMessage');

// DOM Elements pour la vue "Gestion des Grades"
const addGradeForm = document.getElementById('addGradeForm');
const addGradeMessage = document.getElementById('addGradeMessage');
const gradesTableBody = document.getElementById('gradesTableBody');
const listGradesMessage = document.getElementById('listGradesMessage');

// DOM Elements pour la Modale de modification de grade
const editGradeModal = document.getElementById('editGradeModal');
const editGradeForm = document.getElementById('editGradeForm');
const editGradeIdInput = document.getElementById('editGradeId');
const editGradeNameInput = document.getElementById('editGradeName');
const editGradeMessage = document.getElementById('editGradeMessage');

// DOM Elements pour la vue "Gestion des Fonctions"
const addFonctionForm = document.getElementById('addFonctionForm');
const addFonctionMessage = document.getElementById('addFonctionMessage');
const fonctionsTableBody = document.getElementById('fonctionsTableBody');
const listFonctionsMessage = document.getElementById('listFonctionsMessage');

// DOM Elements pour la Modale de modification de fonction
const editFonctionModal = document.getElementById('editFonctionModal');
const editFonctionForm = document.getElementById('editFonctionForm');
const editFonctionIdInput = document.getElementById('editFonctionId');
const editFonctionNameInput = document.getElementById('editFonctionName');
const editFonctionMessage = document.getElementById('editFonctionMessage');

// Spinner de chargement
const loadingSpinner = document.getElementById('loading-spinner');


// **********************************************************
// NOUVELLE FONCTION UTILITAIRE POUR FAIRE DES REQUÊTES AUTHENTIFIÉES
// **********************************************************
async function authenticatedFetch(url, options = {}) {
    const token = localStorage.getItem('jwtToken');
    if (!token) {
        // Si pas de jeton, rediriger vers la page de connexion
        console.error("Aucun jeton d'authentification trouvé. Redirection vers la page de connexion.");
        // Nettoyer le local storage avant de rediriger
        localStorage.clear();
        window.location.href = 'login.html';
        // Arrêter l'exécution pour éviter d'autres erreurs
        throw new Error('Aucun jeton fourni.');
    }

    // Assurez-vous que les headers existent
    options.headers = {
        ...options.headers,
        'Authorization': `Bearer ${token}` // AJOUTÉ : Ajoute le jeton dans l'en-tête
    };

    const response = await fetch(url, options);

    // Gérer les erreurs d'authentification (jeton expiré ou invalide)
    if (response.status === 401 || response.status === 403) {
        console.error("Jeton invalide ou expiré. Déconnexion.");
        localStorage.clear(); // Nettoyer le local storage
        window.location.href = 'login.html'; // Rediriger vers la page de connexion
        // Arrêter l'exécution pour éviter d'autres erreurs
        throw new Error('Jeton invalide ou expiré.');
    }

    return response;
}

// **********************************************************
// NOUVELLE FONCTION POUR VÉRIFIER L'AUTHENTIFICATION ET LE RÔLE AU CHARGEMENT DE LA PAGE
// **********************************************************
async function checkAuth() {
    const token = localStorage.getItem('jwtToken');
    const userRole = localStorage.getItem('userRole');

    // Vérifier si le jeton et le rôle d'administrateur sont présents
    if (!token || userRole !== 'admin') {
        console.warn("Accès non autorisé ou jeton manquant/expiré. Redirection vers login.html");
        localStorage.clear(); // Nettoyer le local storage
        window.location.href = 'login.html';
        return false; // Non authentifié ou pas admin
    }

    // Mettre à jour le message de bienvenue avec les infos de l'utilisateur
    const userPrenom = localStorage.getItem('userPrenom');
    const userNom = localStorage.getItem('userNom');
    const welcomeMessage = document.getElementById('welcome-message');
    if (welcomeMessage) {
        welcomeMessage.textContent = `Bienvenue, ${userPrenom} ${userNom} (Administrateur)`;
    }

    return true; // Authentifié et admin
}


// **********************************************************
// MODIFIER TOUTES LES FONCTIONS QUI FONT DES REQUÊTES API POUR UTILISER authenticatedFetch
// **********************************************************

// Fonction pour charger les données du planning d'une semaine spécifique
async function loadWeekPlanning() {
    showLoading(true);
    adminInfo.textContent = `Chargement du planning de la semaine ${currentWeek}...`;
    adminInfo.style.backgroundColor = "#fff3cd";
    adminInfo.style.borderColor = "#ffeeba";
    adminInfo.style.color = "#856404";

    try {
        const response = await authenticatedFetch(`${API_BASE_URL}/api/planning/${currentWeek}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        planningData[`week-${currentWeek}`] = await response.json();
        renderPlanningTable(); // Mettre à jour l'affichage
        updateAdminInfo("Planning chargé avec succès.", "success");
    } catch (error) {
        console.error("Erreur lors du chargement du planning :", error);
        updateAdminInfo(`Erreur lors du chargement du planning : ${error.message}`, "error");
    } finally {
        showLoading(false);
    }
}

// Fonction pour sauvegarder le planning
async function savePlanningData() {
    showLoading(true);
    try {
        const response = await authenticatedFetch(`${API_BASE_URL}/api/planning/${currentWeek}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(planningData[`week-${currentWeek}`])
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        updateAdminInfo(result.message, "success");
    } catch (error) {
        console.error("Erreur lors de la sauvegarde du planning :", error);
        updateAdminInfo(`Erreur lors de la sauvegarde du planning : ${error.message}`, "error");
    } finally {
        showLoading(false);
    }
}

// Fonction pour charger la liste des agents
async function fetchAgents() {
    showLoading(true);
    try {
        const response = await authenticatedFetch(`${API_BASE_URL}/api/agents`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const agents = await response.json();
        renderAgentsList(agents);
        listAgentsMessage.textContent = ''; // Clear previous messages
    } catch (error) {
        console.error("Erreur lors de la récupération des agents :", error);
        listAgentsMessage.textContent = `Erreur: ${error.message}`;
        listAgentsMessage.style.color = 'red';
    } finally {
        showLoading(false);
    }
}

// Fonction pour ajouter un agent
async function addAgent(event) {
    event.preventDefault();
    const id = document.getElementById('newAgentId').value;
    const prenom = document.getElementById('newAgentPrenom').value;
    const nom = document.getElementById('newAgentNom').value;
    const mdp = document.getElementById('newAgentPassword').value;

    const qualifications = Array.from(document.querySelectorAll('#newAgentQualificationsCheckboxes input[type="checkbox"]:checked'))
        .map(cb => cb.value);
    const grades = Array.from(document.querySelectorAll('#newAgentGradesCheckboxes input[type="checkbox"]:checked'))
        .map(cb => cb.value);
    const fonctions = Array.from(document.querySelectorAll('#newAgentFonctionsCheckboxes input[type="checkbox"]:checked'))
        .map(cb => cb.value);

    addAgentMessage.textContent = ''; // Clear previous messages

    try {
        const response = await authenticatedFetch(`${API_BASE_URL}/api/agents`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, prenom, nom, mdp, qualifications, grades, fonctions })
        });

        const data = await response.json();
        if (response.ok) {
            addAgentMessage.textContent = data.message;
            addAgentMessage.style.color = 'green';
            addAgentForm.reset();
            await fetchAgents(); // Recharger la liste des agents
            await fetchAgentDisplayInfos(); // Mettre à jour la liste déroulante de connexion
        } else {
            addAgentMessage.textContent = data.message || 'Erreur lors de l\'ajout de l\'agent.';
            addAgentMessage.style.color = 'red';
        }
    } catch (error) {
        console.error("Erreur lors de l'ajout de l'agent :", error);
        addAgentMessage.textContent = `Erreur serveur: ${error.message}`;
        addAgentMessage.style.color = 'red';
    }
}

// Fonction pour éditer un agent
async function editAgent(event) {
    event.preventDefault();
    const id = editAgentIdInput.value;
    const prenom = editAgentPrenomInput.value;
    const nom = editAgentNomInput.value;
    const newPassword = editAgentNewPasswordInput.value; // Peut être vide si pas de changement

    const qualifications = Array.from(document.querySelectorAll('#editAgentQualificationsCheckboxes input[type="checkbox"]:checked'))
        .map(cb => cb.value);
    const grades = Array.from(document.querySelectorAll('#editAgentGradesCheckboxes input[type="checkbox"]:checked'))
        .map(cb => cb.value);
    const fonctions = Array.from(document.querySelectorAll('#editAgentFonctionsCheckboxes input[type="checkbox"]:checked'))
        .map(cb => cb.value);

    editAgentMessage.textContent = '';

    try {
        const body = { prenom, nom, qualifications, grades, fonctions };
        if (newPassword) {
            body.newPassword = newPassword;
        }

        const response = await authenticatedFetch(`${API_BASE_URL}/api/agents/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        const data = await response.json();
        if (response.ok) {
            editAgentMessage.textContent = data.message;
            editAgentMessage.style.color = 'green';
            editAgentModal.style.display = 'none';
            await fetchAgents(); // Recharger la liste des agents
            await fetchAgentDisplayInfos(); // Mettre à jour la liste déroulante de connexion
        } else {
            editAgentMessage.textContent = data.message || 'Erreur lors de la modification de l\'agent.';
            editAgentMessage.style.color = 'red';
        }
    } catch (error) {
        console.error("Erreur lors de la modification de l'agent :", error);
        editAgentMessage.textContent = `Erreur serveur: ${error.message}`;
        editAgentMessage.style.color = 'red';
    }
}

// Fonction pour supprimer un agent
async function deleteAgent(agentId) {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer l'agent avec l'ID ${agentId} ?`)) {
        return;
    }
    listAgentsMessage.textContent = '';
    try {
        const response = await authenticatedFetch(`${API_BASE_URL}/api/agents/${agentId}`, {
            method: 'DELETE'
        });

        const data = await response.json();
        if (response.ok) {
            listAgentsMessage.textContent = data.message;
            listAgentsMessage.style.color = 'green';
            await fetchAgents(); // Recharger la liste des agents
            await fetchAgentDisplayInfos(); // Mettre à jour la liste déroulante de connexion
        } else {
            listAgentsMessage.textContent = data.message || 'Erreur lors de la suppression de l\'agent.';
            listAgentsMessage.style.color = 'red';
        }
    } catch (error) {
        console.error("Erreur lors de la suppression de l'agent :", error);
        listAgentsMessage.textContent = `Erreur serveur: ${error.message}`;
        listAgentsMessage.style.color = 'red';
    }
}

// Fonction pour obtenir toutes les qualifications (utilisée pour les checkboxes)
async function fetchQualifications() {
    try {
        const response = await authenticatedFetch(`${API_BASE_URL}/api/qualifications`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error("Erreur lors de la récupération des qualifications :", error);
        // Vous pouvez décider de rediriger ou afficher un message spécifique ici
        return []; // Retourne un tableau vide en cas d'erreur
    }
}

// Fonctions pour gérer les grades
async function fetchGrades() {
    showLoading(true);
    try {
        const response = await authenticatedFetch(`${API_BASE_URL}/api/grades`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        availableGrades = await response.json();
        renderGradesList(); // Afficher les grades
        populateNewAgentCheckboxes(); // Mettre à jour les checkboxes d'agent
    } catch (error) {
        console.error("Erreur lors de la récupération des grades :", error);
        listGradesMessage.textContent = `Erreur: ${error.message}`;
        listGradesMessage.style.color = 'red';
    } finally {
        showLoading(false);
    }
}

async function addGrade(event) {
    event.preventDefault();
    const id = document.getElementById('newGradeId').value;
    const name = document.getElementById('newGradeName').value;
    addGradeMessage.textContent = '';
    try {
        const response = await authenticatedFetch(`${API_BASE_URL}/api/grades`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, name })
        });
        const data = await response.json();
        if (response.ok) {
            addGradeMessage.textContent = data.message;
            addGradeMessage.style.color = 'green';
            addGradeForm.reset();
            await fetchGrades(); // Recharger la liste
        } else {
            addGradeMessage.textContent = data.message || 'Erreur lors de l\'ajout du grade.';
            addGradeMessage.style.color = 'red';
        }
    } catch (error) {
        console.error("Erreur lors de l'ajout du grade :", error);
        addGradeMessage.textContent = `Erreur serveur: ${error.message}`;
        addGradeMessage.style.color = 'red';
    }
}

async function editGrade(event) {
    event.preventDefault();
    const id = editGradeIdInput.value;
    const name = editGradeNameInput.value;
    editGradeMessage.textContent = '';
    try {
        const response = await authenticatedFetch(`${API_BASE_URL}/api/grades/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        const data = await response.json();
        if (response.ok) {
            editGradeMessage.textContent = data.message;
            editGradeMessage.style.color = 'green';
            editGradeModal.style.display = 'none';
            await fetchGrades();
        } else {
            editGradeMessage.textContent = data.message || 'Erreur lors de la modification du grade.';
            editGradeMessage.style.color = 'red';
        }
    } catch (error) {
        console.error("Erreur lors de la modification du grade :", error);
        editGradeMessage.textContent = `Erreur serveur: ${error.message}`;
        editGradeMessage.style.color = 'red';
    }
}

async function deleteGrade(gradeId) {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer le grade ${gradeId} ?`)) return;
    listGradesMessage.textContent = '';
    try {
        const response = await authenticatedFetch(`${API_BASE_URL}/api/grades/${gradeId}`, { method: 'DELETE' });
        const data = await response.json();
        if (response.ok) {
            listGradesMessage.textContent = data.message;
            listGradesMessage.style.color = 'green';
            await fetchGrades();
        } else {
            listGradesMessage.textContent = data.message || 'Erreur lors de la suppression du grade.';
            listGradesMessage.style.color = 'red';
        }
    } catch (error) {
        console.error("Erreur lors de la suppression du grade :", error);
        listGradesMessage.textContent = `Erreur serveur: ${error.message}`;
        listGradesMessage.style.color = 'red';
    }
}

// Fonctions pour gérer les fonctions
async function fetchFonctions() {
    showLoading(true);
    try {
        const response = await authenticatedFetch(`${API_BASE_URL}/api/fonctions`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        availableFonctions = await response.json();
        renderFonctionsList(); // Afficher les fonctions
        populateNewAgentCheckboxes(); // Mettre à jour les checkboxes d'agent
    } catch (error) {
        console.error("Erreur lors de la récupération des fonctions :", error);
        listFonctionsMessage.textContent = `Erreur: ${error.message}`;
        listFonctionsMessage.style.color = 'red';
    } finally {
        showLoading(false);
    }
}

async function addFonction(event) {
    event.preventDefault();
    const id = document.getElementById('newFonctionId').value;
    const name = document.getElementById('newFonctionName').value;
    addFonctionMessage.textContent = '';
    try {
        const response = await authenticatedFetch(`${API_BASE_URL}/api/fonctions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, name })
        });
        const data = await response.json();
        if (response.ok) {
            addFonctionMessage.textContent = data.message;
            addFonctionMessage.style.color = 'green';
            addFonctionForm.reset();
            await fetchFonctions(); // Recharger la liste
        } else {
            addFonctionMessage.textContent = data.message || 'Erreur lors de l\'ajout de la fonction.';
            addFonctionMessage.style.color = 'red';
        }
    } catch (error) {
        console.error("Erreur lors de l'ajout de la fonction :", error);
        addFonctionMessage.textContent = `Erreur serveur: ${error.message}`;
        addFonctionMessage.style.color = 'red';
    }
}

async function editFonction(event) {
    event.preventDefault();
    const id = editFonctionIdInput.value;
    const name = editFonctionNameInput.value;
    editFonctionMessage.textContent = '';
    try {
        const response = await authenticatedFetch(`${API_BASE_URL}/api/fonctions/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        const data = await response.json();
        if (response.ok) {
            editFonctionMessage.textContent = data.message;
            editFonctionMessage.style.color = 'green';
            editFonctionModal.style.display = 'none';
            await fetchFonctions();
        } else {
            editFonctionMessage.textContent = data.message || 'Erreur lors de la modification de la fonction.';
            editFonctionMessage.style.color = 'red';
        }
    } catch (error) {
        console.error("Erreur lors de la modification de la fonction :", error);
        editFonctionMessage.textContent = `Erreur serveur: ${error.message}`;
        editFonctionMessage.style.color = 'red';
    }
}

async function deleteFonction(fonctionId) {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer la fonction ${fonctionId} ?`)) return;
    listFonctionsMessage.textContent = '';
    try {
        const response = await authenticatedFetch(`${API_BASE_URL}/api/fonctions/${fonctionId}`, { method: 'DELETE' });
        const data = await response.json();
        if (response.ok) {
            listFonctionsMessage.textContent = data.message;
            listFonctionsMessage.style.color = 'green';
            await fetchFonctions();
        } else {
            listFonctionsMessage.textContent = data.message || 'Erreur lors de la suppression de la fonction.';
            listFonctionsMessage.style.color = 'red';
        }
    } catch (error) {
        console.error("Erreur lors de la suppression de la fonction :", error);
        listFonctionsMessage.textContent = `Erreur serveur: ${error.message}`;
        listFonctionsMessage.style.color = 'red';
    }
}

// Fonction pour charger la configuration de la feuille de garde
async function fetchRosterConfig() {
    showLoading(true);
    try {
        const response = await authenticatedFetch(`${API_BASE_URL}/api/roster-config`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const config = await response.json();
        // Ici, vous devrez mettre à jour l'interface utilisateur avec la config chargée
        // Par exemple: document.getElementById('rosterConfigInput').value = JSON.stringify(config, null, 2);
        console.log("Configuration de la feuille de garde chargée:", config);
    } catch (error) {
        console.error("Erreur lors de la récupération de la configuration de la feuille de garde :", error);
        // Gérer l'affichage de l'erreur dans l'UI
    } finally {
        showLoading(false);
    }
}

// Fonction pour sauvegarder la configuration de la feuille de garde
async function saveRosterConfig(event) {
    event.preventDefault();
    showLoading(true);
    try {
        // Supposons que vous avez un formulaire ou une zone de texte pour la config
        const configData = JSON.parse(document.getElementById('rosterConfigInput').value); // Récupérer la config depuis l'UI
        const response = await authenticatedFetch(`${API_BASE_URL}/api/roster-config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(configData)
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const result = await response.json();
        console.log("Configuration de la feuille de garde sauvegardée:", result.message);
        // Afficher un message de succès
    } catch (error) {
        console.error("Erreur lors de la sauvegarde de la configuration de la feuille de garde :", error);
        // Afficher un message d'erreur
    } finally {
        showLoading(false);
    }
}

// Fonctions pour gérer les feuilles de garde quotidiennes (similaires aux plannings)
async function fetchDailyRoster(date) { // date format YYYY-MM-DD
    showLoading(true);
    try {
        const response = await authenticatedFetch(`${API_BASE_URL}/api/daily-roster/${date}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const roster = await response.json();
        console.log(`Feuille de garde pour ${date} chargée:`, roster);
        // Mettre à jour l'UI avec la feuille de garde chargée
    } catch (error) {
        console.error(`Erreur lors du chargement de la feuille de garde pour ${date} :`, error);
        // Gérer l'affichage de l'erreur
    } finally {
        showLoading(false);
    }
}

async function saveDailyRoster(date, rosterData) { // date format YYYY-MM-DD, rosterData est l'objet à sauvegarder
    showLoading(true);
    try {
        const response = await authenticatedFetch(`${API_BASE_URL}/api/daily-roster/${date}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(rosterData)
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const result = await response.json();
        console.log(`Feuille de garde pour ${date} sauvegardée:`, result.message);
        // Afficher un message de succès
    } catch (error) {
        console.error(`Erreur lors de la sauvegarde de la feuille de garde pour ${date} :`, error);
        // Afficher un message d'erreur
    } finally {
        showLoading(false);
    }
}


// --- Fonctions utilitaires diverses (celles qui étaient déjà là) ---

function updateAdminInfo(message, type) {
    adminInfo.textContent = message;
    if (type === "success") {
        adminInfo.style.backgroundColor = "#d4edda";
        adminInfo.style.borderColor = "#c3e6cb";
        adminInfo.style.color = "#155724";
    } else if (type === "error") {
        adminInfo.style.backgroundColor = "#f8d7da";
        adminInfo.style.borderColor = "#f5c6cb";
        adminInfo.style.color = "#721c24";
    } else {
        adminInfo.style.backgroundColor = "#fff3cd";
        adminInfo.style.borderColor = "#ffeeba";
        adminInfo.style.color = "#856404";
    }
    // Fade out message after 3 seconds
    setTimeout(() => {
        adminInfo.textContent = "Vue du planning global des agents."; // Ou un message par défaut
        adminInfo.style.backgroundColor = "";
        adminInfo.style.borderColor = "";
        adminInfo.style.color = "";
    }, 3000);
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


function showMainTab(tabId) {
    mainTabContents.forEach(content => {
        if (content.id === tabId) {
            content.classList.add('active');
        } else {
            content.classList.remove('active');
        }
    });

    mainTabButtons.forEach(button => {
        if (button.dataset.tab === tabId) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });

    // Cacher ou afficher les contrôles de semaine/PDF selon l'onglet actif
    if (tabId === 'global-planning-view') {
        headerControlsPermanent.style.display = 'flex'; // ou 'block', 'grid' selon votre CSS
        loadWeekPlanning(); // Recharger le planning quand on revient sur cet onglet
    } else {
        headerControlsPermanent.style.display = 'none';
    }

    // Gérer les chargements spécifiques à chaque onglet
    if (tabId === 'agent-management-view') {
        fetchAgents();
        fetchGrades(); // Recharger les grades pour les checkboxes
        fetchFonctions(); // Recharger les fonctions pour les checkboxes
    } else if (tabId === 'grade-management-view') {
        fetchGrades();
    } else if (tabId === 'fonction-management-view') {
        fetchFonctions();
    }
    // Ajoutez d'autres onglets ici si nécessaire
}

function showDay(day) {
    currentDay = day;
    tabButtons.forEach(button => {
        if (button.dataset.day === day) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });
    renderPlanningTable(); // S'assure que le planning est re-rendu pour le jour sélectionné
}


function getCurrentWeek() {
    const today = new Date();
    const firstDayOfYear = new Date(today.getFullYear(), 0, 1);
    const pastDaysOfYear = (today - firstDayOfYear) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

function getStartAndEndDateOfWeek(weekNumber) {
    const today = new Date();
    const year = today.getFullYear();
    const jan1 = new Date(year, 0, 1);
    const days = (weekNumber - 1) * 7;
    let date = new Date(jan1.getFullYear(), 0, 1 + days);

    // Ajuster au lundi de la semaine (ISO-8601)
    let day = date.getDay(); // 0 for Sunday, 1 for Monday
    let diff = date.getDate() - day + (day === 0 ? -6 : 1); // Ajuster pour que lundi soit le 1er jour (et non dimanche)
    date.setDate(diff);

    const monday = new Date(date);
    const sunday = new Date(date);
    sunday.setDate(date.getDate() + 6);

    const options = { day: 'numeric', month: 'short' };
    return `${monday.toLocaleDateString('fr-FR', options)} - ${sunday.toLocaleDateString('fr-FR', options)}`;
}

function populateWeekSelect() {
    weekSelect.innerHTML = ''; // Clear existing options
    const currentYear = new Date().getFullYear();
    const maxWeeks = 52; // Simplifié, pourrait être 53 pour certaines années

    for (let i = 1; i <= maxWeeks; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = `Semaine ${i} (${getStartAndEndDateOfWeek(i)})`;
        if (i === currentWeek) {
            option.selected = true;
        }
        weekSelect.appendChild(option);
    }
}

// Fonction pour charger les informations d'affichage des agents (non protégée par JWT)
// Cette fonction reste non protégée car elle est utilisée sur la page de connexion
// pour remplir la liste déroulante des agents avant même que l'utilisateur ne se connecte.
async function fetchAgentDisplayInfos() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/agents/display-info`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        agentDisplayInfos = data.reduce((acc, agent) => {
            acc[agent.id] = { prenom: agent.prenom, nom: agent.nom };
            return acc;
        }, {});
    } catch (error) {
        console.error("Erreur lors du chargement des informations d'affichage des agents :", error);
    }
}

function renderPlanningTable() {
    const tableBody = document.getElementById('planning-table-body');
    tableBody.innerHTML = ''; // Clear existing content

    const agentsPlanning = planningData[`week-${currentWeek}`] || {};
    const agentsIds = Object.keys(agentDisplayInfos); // Utilisez les IDs des agents pour ordonner

    // Créez une carte des rôles pour les cellules (utile pour la couleur)
    const roleColors = {
        'Chef': '#007bff', // Bleu principal
        'Equipier': '#28a745', // Vert
        'Conducteur': '#ffc107', // Jaune
        'Sapeur': '#6c757d', // Gris
        // Ajoutez d'autres rôles et leurs couleurs
    };

    agentsIds.sort((a, b) => {
        const nameA = `${agentDisplayInfos[a].nom} ${agentDisplayInfos[a].prenom}`.toLowerCase();
        const nameB = `${agentDisplayInfos[b].nom} ${agentDisplayInfos[b].prenom}`.toLowerCase();
        return nameA.localeCompare(nameB);
    }).forEach(agentId => {
        const agentName = `${agentDisplayInfos[agentId].nom} ${agentDisplayInfos[agentId].prenom}`;
        const row = tableBody.insertRow();
        const nameCell = row.insertCell();
        nameCell.textContent = agentName;
        nameCell.classList.add('agent-name-cell');

        const dayPlanning = agentsPlanning[agentId] ? agentsPlanning[agentId][currentDay] : [];

        for (let i = 0; i < 24; i++) { // 24 heures
            const slotCell = row.insertCell();
            slotCell.classList.add('slot-cell');
            const slot = dayPlanning ? dayPlanning[i] : null;

            if (slot && slot.type === 'occupied') {
                slotCell.classList.add('occupied');
                slotCell.title = slot.role || 'Occupé'; // Afficher le rôle ou "Occupé"
                slotCell.style.backgroundColor = roleColors[slot.role] || '#007bff'; // Appliquer la couleur du rôle
            } else {
                slotCell.classList.add('free');
                slotCell.style.backgroundColor = ''; // Assurer que la couleur est réinitialisée
            }

            // Ajouter l'écouteur d'événement de clic pour basculer
            slotCell.addEventListener('click', () => toggleSlot(agentId, currentDay, i, slotCell));
        }
    });
}

function toggleSlot(agentId, day, hour, cell) {
    if (!planningData[`week-${currentWeek}`]) {
        planningData[`week-${currentWeek}`] = {};
    }
    if (!planningData[`week-${currentWeek}`][agentId]) {
        planningData[`week-${currentWeek}`][agentId] = {};
    }
    if (!planningData[`week-${currentWeek}`][agentId][day]) {
        planningData[`week-${currentWeek}`][agentId][day] = Array(24).fill(null); // Initialize with nulls
    }

    const currentSlot = planningData[`week-${currentWeek}`][agentId][day][hour];
    const roleColors = {
        'Chef': '#007bff', // Bleu principal
        'Equipier': '#28a745', // Vert
        'Conducteur': '#ffc107', // Jaune
        'Sapeur': '#6c757d', // Gris
        // Ajoutez d'autres rôles et leurs couleurs
    };

    if (cell.classList.contains('occupied')) {
        // Passe de 'occupied' (un rôle spécifique) à 'free'
        cell.classList.remove('occupied');
        cell.classList.add('free');
        cell.title = ''; // Supprime le tooltip
        cell.style.backgroundColor = ''; // Supprime la couleur spécifique au rôle
        planningData[`week-${currentWeek}`][agentId][day][hour] = null; // Supprime l'entrée du planning
    } else {
        // Passe de 'free' à 'occupied' (demander le rôle)
        const role = prompt("Entrez le rôle pour ce créneau (ex: Chef, Equipier, Conducteur, Sapeur) :");
        if (role) {
            cell.classList.remove('free');
            cell.classList.add('occupied');
            cell.title = role; // Ajoute le tooltip
            cell.style.backgroundColor = roleColors[role] || '#007bff'; // Couleur par défaut si non trouvé
            planningData[`week-${currentWeek}`][agentId][day][hour] = { type: 'occupied', role: role };
        } else {
            // Si l'utilisateur annule ou ne saisit rien, ne pas changer l'état
            return;
        }
    }

    // Sauvegarder automatiquement après chaque modification (ou ajouter un bouton de sauvegarde)
    savePlanningData();
}

// Rend les listes de grades et fonctions
function renderGradesList() {
    const gradesTableBody = document.getElementById('gradesTableBody');
    gradesTableBody.innerHTML = '';
    availableGrades.forEach(grade => {
        const row = gradesTableBody.insertRow();
        row.insertCell().textContent = grade.id;
        row.insertCell().textContent = grade.name;
        const actionsCell = row.insertCell();
        const editBtn = document.createElement('button');
        editBtn.textContent = 'Modifier';
        editBtn.className = 'btn btn-secondary btn-small';
        editBtn.onclick = () => openEditGradeModal(grade);
        actionsCell.appendChild(editBtn);
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Supprimer';
        deleteBtn.className = 'btn btn-danger btn-small';
        deleteBtn.onclick = () => deleteGrade(grade.id);
        actionsCell.appendChild(deleteBtn);
    });
}

function renderFonctionsList() {
    const fonctionsTableBody = document.getElementById('fonctionsTableBody');
    fonctionsTableBody.innerHTML = '';
    availableFonctions.forEach(fonction => {
        const row = fonctionsTableBody.insertRow();
        row.insertCell().textContent = fonction.id;
        row.insertCell().textContent = fonction.name;
        const actionsCell = row.insertCell();
        const editBtn = document.createElement('button');
        editBtn.textContent = 'Modifier';
        editBtn.className = 'btn btn-secondary btn-small';
        editBtn.onclick = () => openEditFonctionModal(fonction);
        actionsCell.appendChild(editBtn);
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Supprimer';
        deleteBtn.className = 'btn btn-danger btn-small';
        deleteBtn.onclick = () => deleteFonction(fonction.id);
        actionsCell.appendChild(deleteBtn);
    });
}

async function renderAgentsList(agents) {
    agentsTableBody.innerHTML = ''; // Clear existing agents
    const qualifications = await fetchQualifications(); // Fetch qualifications to display their names

    agents.forEach(agent => {
        const row = agentsTableBody.insertRow();
        row.insertCell().textContent = agent.id;
        row.insertCell().textContent = agent.prenom;
        row.insertCell().textContent = agent.nom;
        // Afficher les grades de l'agent
        const agentGrades = agent.grades.map(gradeId => {
            const foundGrade = availableGrades.find(g => g.id === gradeId);
            return foundGrade ? foundGrade.name : gradeId;
        }).join(', ');
        row.insertCell().textContent = agentGrades;

        // Afficher les fonctions de l'agent
        const agentFonctions = agent.fonctions.map(fonctionId => {
            const foundFonction = availableFonctions.find(f => f.id === fonctionId);
            return foundFonction ? foundFonction.name : fonctionId;
        }).join(', ');
        row.insertCell().textContent = agentFonctions;

        const actionsCell = row.insertCell();
        const editBtn = document.createElement('button');
        editBtn.textContent = 'Modifier';
        editBtn.className = 'btn btn-secondary btn-small';
        editBtn.onclick = () => openEditAgentModal(agent, qualifications);
        actionsCell.appendChild(editBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Supprimer';
        deleteBtn.className = 'btn btn-danger btn-small';
        deleteBtn.onclick = () => deleteAgent(agent.id);
        actionsCell.appendChild(deleteBtn);
    });
}

async function populateNewAgentCheckboxes() {
    // Qualifications
    const qualifications = await fetchQualifications();
    const newAgentQualificationsCheckboxes = document.getElementById('newAgentQualificationsCheckboxes');
    newAgentQualificationsCheckboxes.innerHTML = '';
    qualifications.forEach(q => {
        const div = document.createElement('div');
        div.innerHTML = `<input type="checkbox" id="newQual-${q.id}" value="${q.id}">
                         <label for="newQual-${q.id}">${q.name}</label>`;
        newAgentQualificationsCheckboxes.appendChild(div);
    });

    // Grades
    newAgentGradesCheckboxes.innerHTML = '';
    availableGrades.forEach(grade => {
        const div = document.createElement('div');
        div.innerHTML = `<input type="checkbox" id="newGrade-${grade.id}" value="${grade.id}">
                         <label for="newGrade-${grade.id}">${grade.name}</label>`;
        newAgentGradesCheckboxes.appendChild(div);
    });

    // Fonctions
    newAgentFonctionsCheckboxes.innerHTML = '';
    availableFonctions.forEach(fonction => {
        const div = document.createElement('div');
        div.innerHTML = `<input type="checkbox" id="newFonction-${fonction.id}" value="${fonction.id}">
                         <label for="newFonction-${fonction.id}">${fonction.name}</label>`;
        newAgentFonctionsCheckboxes.appendChild(div);
    });
}

async function openEditAgentModal(agent, allQualifications) {
    editAgentModal.style.display = 'block';
    editAgentIdInput.value = agent.id;
    editAgentPrenomInput.value = agent.prenom;
    editAgentNomInput.value = agent.nom;
    editAgentNewPasswordInput.value = ''; // Toujours vider le champ mot de passe

    // Qualifications
    const editQualCheckboxes = document.getElementById('editAgentQualificationsCheckboxes');
    editQualCheckboxes.innerHTML = '';
    allQualifications.forEach(q => {
        const div = document.createElement('div');
        const isChecked = agent.qualifications && agent.qualifications.includes(q.id);
        div.innerHTML = `<input type="checkbox" id="editQual-${q.id}" value="${q.id}" ${isChecked ? 'checked' : ''}>
                         <label for="editQual-${q.id}">${q.name}</label>`;
        editQualCheckboxes.appendChild(div);
    });

    // Grades
    editAgentGradesCheckboxes.innerHTML = '';
    availableGrades.forEach(grade => {
        const div = document.createElement('div');
        const isChecked = agent.grades && agent.grades.includes(grade.id);
        div.innerHTML = `<input type="checkbox" id="editGrade-${grade.id}" value="${grade.id}" ${isChecked ? 'checked' : ''}>
                         <label for="editGrade-${grade.id}">${grade.name}</label>`;
        editAgentGradesCheckboxes.appendChild(div);
    });

    // Fonctions
    editAgentFonctionsCheckboxes.innerHTML = '';
    availableFonctions.forEach(fonction => {
        const div = document.createElement('div');
        const isChecked = agent.fonctions && agent.fonctions.includes(fonction.id);
        div.innerHTML = `<input type="checkbox" id="editFonction-${fonction.id}" value="${fonction.id}" ${isChecked ? 'checked' : ''}>
                         <label for="editFonction-${fonction.id}">${fonction.name}</label>`;
        editFonctionsCheckboxes.appendChild(div);
    });
}

function openEditGradeModal(grade) {
    editGradeModal.style.display = 'block';
    editGradeIdInput.value = grade.id;
    editGradeNameInput.value = grade.name;
    editGradeMessage.textContent = '';
}

function openEditFonctionModal(fonction) {
    editFonctionModal.style.display = 'block';
    editFonctionIdInput.value = fonction.id;
    editFonctionNameInput.value = fonction.name;
    editFonctionMessage.textContent = '';
}

// Fonction pour exporter le planning en PDF
async function exportPlanningToPdf() {
    showLoading(true, true); // Activer le spinner, en mode PDF
    try {
        const table = document.querySelector('.planning-table');
        const dayName = currentDay.charAt(0).toUpperCase() + currentDay.slice(1);
        const dateRange = dateRangeDisplay.textContent;
        const docTitle = `Planning Caserne - Semaine ${currentWeek} - ${dayName} (${dateRange})`;

        // Utiliser html2canvas pour capturer le tableau
        const canvas = await html2canvas(table, {
            scale: 2, // Augmente la résolution pour une meilleure qualité
            useCORS: true // Nécessaire si des images/ressources proviennent d'une autre origine
        });

        const imgData = canvas.toDataURL('image/png');
        const pdf = new jspdf.jsPDF('landscape', 'mm', 'a4'); // 'landscape' pour le format paysage

        const imgWidth = 280; // Largeur de l'image sur le PDF en mm (pour A4 paysage)
        const pageHeight = pdf.internal.pageSize.height;
        const imgHeight = canvas.height * imgWidth / canvas.width;
        let heightLeft = imgHeight;

        let position = 10; // Marge supérieure initiale

        pdf.setFontSize(18);
        pdf.text(docTitle, 10, position); // Titre du document
        position += 20; // Espacement après le titre

        pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;

        // Si le tableau est plus long qu'une page, ajouter de nouvelles pages
        while (heightLeft >= 0) {
            position = heightLeft - imgHeight + 10; // Réajuster la position pour la nouvelle page
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
        }

        pdf.save(`${docTitle}.pdf`);
        updateAdminInfo("PDF généré avec succès.", "success");
    } catch (error) {
        console.error("Erreur lors de l'exportation PDF :", error);
        updateAdminInfo(`Erreur lors de l'exportation PDF : ${error.message}`, "error");
    } finally {
        showLoading(false, true); // Désactiver le spinner
    }
}


// **********************************************************
// ÉCOUTEURS D'ÉVÉNEMENTS
// **********************************************************
document.addEventListener('DOMContentLoaded', async () => {
    // Initialisation du spinner
    showLoading(true);

    // Vérification de l'authentification et du rôle au chargement de la page
    const isAuthenticated = await checkAuth();

    if (isAuthenticated) {
        // Associer les écouteurs d'événements pour les onglets principaux
        mainTabButtons.forEach(button => {
            button.addEventListener('click', () => showMainTab(button.dataset.tab));
        });

        // Associer les écouteurs d'événements pour les boutons de jour
        tabButtons.forEach(button => {
            button.addEventListener('click', () => showDay(button.dataset.day));
        });

        // Écouteur pour le sélecteur de semaine
        weekSelect.addEventListener('change', (event) => {
            currentWeek = parseInt(event.target.value);
            dateRangeDisplay.textContent = getStartAndEndDateOfWeek(currentWeek);
            loadWeekPlanning();
        });

        // Écouteur pour le bouton d'export PDF
        if (exportPdfButton) {
            exportPdfButton.addEventListener('click', exportPlanningToPdf);
        }

        // Écouteur pour le bouton de déconnexion
        if (logoutButton) {
            logoutButton.addEventListener('click', logout);
        }

        // Écouteurs pour les formulaires de gestion des agents
        if (addAgentForm) {
            addAgentForm.addEventListener('submit', addAgent);
        }
        if (editAgentForm) {
            editAgentForm.addEventListener('submit', editAgent);
        }
        // Fermeture de la modale d'édition d'agent
        const closeAgentModalButton = editAgentModal.querySelector('.close-button');
        if (closeAgentModalButton) {
            closeAgentModalButton.addEventListener('click', () => editAgentModal.style.display = 'none');
        }

        // Écouteurs pour les formulaires de gestion des grades
        if (addGradeForm) {
            addGradeForm.addEventListener('submit', addGrade);
        }
        if (editGradeForm) {
            editGradeForm.addEventListener('submit', editGrade);
        }
        // Fermeture de la modale d'édition de grade
        const closeGradeModalButton = editGradeModal.querySelector('.close-button');
        if (closeGradeModalButton) {
            closeGradeModalButton.addEventListener('click', () => editGradeModal.style.display = 'none');
        }

        // Écouteurs pour les formulaires de gestion des fonctions
        if (addFonctionForm) {
            addFonctionForm.addEventListener('submit', addFonction);
        }
        if (editFonctionForm) {
            editFonctionForm.addEventListener('submit', editFonction);
        }
        // Fermeture de la modale d'édition de fonction
        const closeFonctionModalButton = editFonctionModal.querySelector('.close-button');
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

        // Chargement initial des données
        await fetchAgentDisplayInfos(); // Récupère les noms/prénoms des agents
        await fetchGrades(); // Récupère les grades
        await fetchFonctions(); // Récupère les fonctions
        await fetchAgents(); // Charge la liste des agents pour la vue de gestion des agents

        // Populate les selecteurs et checkboxes
        populateWeekSelect(); // Remplit le selecteur de semaine
        populateNewAgentCheckboxes(); // Remplit les checkboxes pour l'ajout d'agent

        // Afficher l'onglet par défaut (Planning Global) et charger ses données
        showMainTab('global-planning-view'); // Ceci appellera loadWeekPlanning() et rendra le planning du `currentDay` ('lundi')
        showDay('lundi'); // S'assure que le premier jour est sélectionné et affiché

        showLoading(false); // Masque le spinner une fois tout chargé
    } else {
        // Si non authentifié (checkAuth aura déjà redirigé), assure juste que le spinner est caché.
        showLoading(false);
    }
});