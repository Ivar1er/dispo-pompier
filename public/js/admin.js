// admin.js
const days = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const API_BASE_URL = "http://localhost:3000"; // IMPORTANT: Utilisez localhost pour les tests en local. Changez pour Render en prod.

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
const globalPlanningViewSection = document.getElementById('global-planning-view');
const weekSelect = document.getElementById("week-select");
const dateRangeDisplay = document.getElementById("date-range");
const tabButtons = document.querySelectorAll(".tab"); // Boutons de jour (Lundi, Mardi...)
const adminInfo = document.getElementById("admin-info"); // Message d'information général

const headerControlsPermanent = document.querySelector('.header-controls-permanent');
const exportPdfButton = document.getElementById("export-pdf");
const planningContainer = document.getElementById("global-planning"); // Nouveau : Assurez-vous que cet ID existe dans admin.html pour le tableau

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
const editAgentGradesCheckboxes = document.getElementById('editAgentGradesCheckboxes');
const editAgentFonctionsCheckboxes = document.getElementById('editAgentFonctionsCheckboxes');
const editAgentMessage = document.getElementById('editAgentMessage');

// --- DOM Elements pour la vue "Gestion des Grades" ---
const addGradeForm = document.getElementById('addGradeForm');
const addGradeMessage = document.getElementById('addGradeMessage');
const gradesTableBody = document.getElementById('gradesTableBody');
const listGradesMessage = document.getElementById('listGradesMessage');

// DOM Elements pour la Modale de modification de grade
const editGradeModal = document.getElementById('editGradeModal');
const editGradeForm = document.getElementById('editGradeForm');
const closeGradeModalButton = editGradeModal ? editGradeModal.querySelector('.close-button') : null;
const editGradeMessage = document.getElementById('editGradeMessage');

// --- DOM Elements pour la vue "Gestion des Fonctions" ---
const addFonctionForm = document.getElementById('addFonctionForm');
const addFonctionMessage = document.getElementById('addFonctionMessage');
const fonctionsTableBody = document.getElementById('fonctionsTableBody');
const listFonctionsMessage = document.getElementById('listFonctionsMessage');

// DOM Elements pour la Modale de modification de fonction
const editFonctionModal = document.getElementById('editFonctionModal');
const editFonctionForm = document.getElementById('editFonctionForm');
const closeFonctionModalButton = editFonctionModal ? editFonctionModal.querySelector('.close-button') : null;
const editFonctionMessage = document.getElementById('editFonctionMessage');

// --- DOM Elements pour la vue "Configuration Feuille de Garde" ---
const rosterConfigForm = document.getElementById('rosterConfigForm');
const rosterConfigGrid = rosterConfigForm ? rosterConfigForm.querySelector('.roster-config-grid') : null;
const rosterConfigMessage = document.getElementById('rosterConfigMessage');

// Global loading spinner
const loadingSpinner = document.getElementById('loading-spinner');

// --- Fonctions utilitaires générales ---

function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    var weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return weekNo;
}

function getDayName(date) {
    const days = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    return days[date.getDay()];
}

function getCurrentWeek() {
    return getWeekNumber(new Date());
}

function getWeekRange(weekNumber) {
    const jan1 = new Date(new Date().getFullYear(), 0, 1);
    const days = (weekNumber - 1) * 7;
    const startOfWeek = new Date(jan1.setDate(jan1.getDate() + days - (jan1.getDay() === 0 ? 6 : jan1.getDay() - 1)));
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    return `${startOfWeek.toLocaleDateString('fr-FR')} - ${endOfWeek.toLocaleDateString('fr-FR')}`;
}

function showMessage(element, message, type = 'info') {
    if (element) {
        element.textContent = message;
        element.className = `info-message ${type}`; // 'info', 'success', 'error'
        setTimeout(() => {
            element.textContent = '';
            element.className = 'info-message';
        }, 5000);
    }
}

// Global loading spinner function
function showLoading(isLoading, forPdf = false) {
    if (isLoading) {
        loadingSpinner.classList.remove("hidden");
        // Désactiver tous les contrôles (sauf le bouton de déconnexion)
        document.querySelectorAll('button, select, input, a').forEach(el => {
            if (el.id !== 'logout-btn') {
                el.disabled = true;
                if (el.tagName === 'A') el.classList.add('disabled-link');
            }
        });
        // Désactiver spécifiquement les boutons des onglets principaux
        mainTabButtons.forEach(btn => btn.disabled = true);

        if (forPdf) {
            adminInfo.textContent = "Génération du PDF en cours, veuillez patienter...";
            adminInfo.style.backgroundColor = "#fff3cd"; // Jaune clair pour l'info
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
            adminInfo.textContent = "Vue du planning global des agents."; // Message par défaut
            adminInfo.style.backgroundColor = "";
            adminInfo.style.borderColor = "";
            adminInfo.style.color = "";
        }
    }
}

// --- Fonctions d'authentification et de gestion de session ---

// Vérifie l'authentification via le backend
async function checkAuth() {
    showLoading(true);
    const token = localStorage.getItem('token');
    if (!token) {
        handleLogout(); // Pas de token, redirige
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

        const data = await response.json();

        if (response.ok && data.isValid) {
            document.getElementById('welcome-message').textContent = `Bienvenue, ${data.username} (${data.role})`;
            if (data.role === 'admin') {
                // Les sections d'administration sont gérées par les showMainTab
            } else {
                // Si l'utilisateur n'est pas admin, on le déconnecte (ou on limite l'accès)
                showMessage(adminInfo, 'Accès non autorisé. Vous n\'êtes pas administrateur.', 'error');
                handleLogout();
                return false;
            }
            return true;
        } else {
            // Token invalide ou expiré
            showMessage(adminInfo, `Erreur d'authentification: ${data.message || 'Token invalide'}`, 'error');
            handleLogout();
            return false;
        }
    } catch (error) {
        console.error('Erreur lors de la vérification du token:', error);
        showMessage(adminInfo, 'Erreur de communication avec le serveur d\'authentification.', 'error');
        handleLogout();
        return false;
    } finally {
        // Le spinner sera masqué une fois toutes les données chargées après l'authentification réussie
        // Ou immédiatement si la vérification échoue et redirige.
        showLoading(false); // Masquer le spinner si une erreur empêche la redirection
    }
}

// Gère la déconnexion
function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    // window.location.href = 'login.html'; // Redirection simple
    // Utiliser window.location.replace pour empêcher le retour arrière
    window.location.replace('login.html');
}

// Écouteur pour le bouton de déconnexion
const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
}

// --- Fonctions de gestion des onglets ---

function showMainTab(tabId) {
    mainTabContents.forEach(content => {
        content.classList.remove('active');
    });
    mainTabButtons.forEach(button => {
        button.classList.remove('active');
    });

    document.getElementById(tabId).classList.add('active');
    document.querySelector(`.main-tab[data-tab="${tabId}"]`).classList.add('active');

    // Cacher ou afficher les contrôles de planning en fonction de l'onglet
    if (tabId === 'global-planning-view') {
        headerControlsPermanent.style.display = 'flex';
        // Recharge le planning uniquement si la section devient active
        loadWeekPlanning(currentWeek);
        showDay(currentDay); // Afficher le jour actuel sélectionné (par défaut 'lundi')
    } else {
        headerControlsPermanent.style.display = 'none';
        // Pour les autres onglets, charger les données spécifiques
        if (tabId === 'agents-management-view') {
            fetchAgents();
        } else if (tabId === 'grades-management-view') {
            fetchGrades(); // Recharger pour s'assurer que la liste est à jour
        } else if (tabId === 'fonctions-management-view') {
            fetchFonctions(); // Recharger pour s'assurer que la liste est à jour
        } else if (tabId === 'roster-config-view') {
            fetchRosterConfig();
        }
    }
}

mainTabButtons.forEach(button => {
    button.addEventListener('click', () => {
        showMainTab(button.dataset.tab);
    });
});

function showDay(dayName) {
    tabButtons.forEach(button => {
        if (button.dataset.day === dayName) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });
    currentDay = dayName;
    renderPlanningTable(); // Re-render le tableau pour le jour sélectionné
}

tabButtons.forEach(button => {
    button.addEventListener('click', () => showDay(button.dataset.day));
});


// --- Fonctions de gestion du planning global ---

function populateWeekSelect() {
    weekSelect.innerHTML = ''; // Vide les options existantes
    const currentYear = new Date().getFullYear();
    const numberOfWeeks = getWeekNumber(new Date(currentYear, 11, 31)); // Nombre de semaines dans l'année

    for (let i = 1; i <= numberOfWeeks; i++) {
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

weekSelect.addEventListener('change', (event) => {
    currentWeek = parseInt(event.target.value);
    dateRangeDisplay.textContent = getWeekRange(currentWeek);
    loadWeekPlanning(currentWeek); // Recharge les données du planning pour la nouvelle semaine
});

// Charge le planning pour une semaine donnée depuis l'API
async function loadWeekPlanning(weekNumber) {
    showLoading(true);
    planningData = {}; // Réinitialise le cache pour la nouvelle semaine

    const token = localStorage.getItem('token');
    if (!token) {
        showMessage(adminInfo, "Authentification requise pour charger le planning.", 'error');
        showLoading(false);
        handleLogout();
        return;
    }

    try {
        for (const day of days) {
            const response = await fetch(`${API_BASE_URL}/api/planning/week/${weekNumber}/day/${day}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (response.ok) {
                planningData[day] = await response.json();
            } else {
                // Gérer les cas où le fichier n'existe pas encore (404) ou autre erreur
                console.warn(`Planning non trouvé pour la semaine ${weekNumber}, jour ${day}.`);
                planningData[day] = []; // Initialise un tableau vide
            }
        }
        renderPlanningTable(); // Affiche le planning du jour sélectionné
    } catch (error) {
        console.error('Erreur lors du chargement du planning:', error);
        showMessage(adminInfo, 'Erreur lors du chargement du planning.', 'error');
    } finally {
        showLoading(false);
    }
}

// Rend le tableau du planning pour le jour actuel
function renderPlanningTable() {
    if (!planningContainer) {
        console.error("L'élément #global-planning est introuvable.");
        return;
    }

    const currentDayPlanning = planningData[currentDay] || [];
    const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0') + ':00');

    let tableHTML = `
        <table class="planning-table">
            <thead>
                <tr>
                    <th>Agent</th>
                    ${hours.map(h => `<th>${h}</th>`).join('')}
                </tr>
            </thead>
            <tbody>
    `;

    // Trier les agents par nom pour un affichage cohérent
    const sortedAgentDisplayInfos = Object.values(agentDisplayInfos).sort((a, b) => {
        const nameA = `${a.nom} ${a.prenom}`.toLowerCase();
        const nameB = `${b.nom} ${b.prenom}`.toLowerCase();
        return nameA.localeCompare(nameB);
    });


    if (sortedAgentDisplayInfos.length === 0) {
        tableHTML += `<tr><td colspan="${hours.length + 1}">Aucun agent disponible.</td></tr>`;
    } else {
        sortedAgentDisplayInfos.forEach(agentInfo => {
            const agentPlanning = currentDayPlanning.find(p => p.agentId === agentInfo._id);
            tableHTML += `
                <tr>
                    <td>${agentInfo.nom} ${agentInfo.prenom}</td>
                    ${hours.map((_, index) => {
                const isOccupied = agentPlanning && agentPlanning.slots[index] === 1;
                return `<td class="slot-cell ${isOccupied ? 'occupied' : 'free'}"
                                data-agent-id="${agentInfo._id}"
                                data-slot-index="${index}"></td>`;
            }).join('')}
                </tr>
            `;
        });
    }

    tableHTML += `
            </tbody>
        </table>
    `;
    planningContainer.innerHTML = tableHTML;

    // Ajouter les écouteurs d'événements pour les cellules du planning
    planningContainer.querySelectorAll('.slot-cell').forEach(cell => {
        cell.addEventListener('click', toggleSlot);
    });
}

// Gère le clic sur un créneau pour le basculer
async function toggleSlot(event) {
    const cell = event.target;
    const agentId = cell.dataset.agentId;
    const slotIndex = parseInt(cell.dataset.slotIndex);
    const isOccupied = cell.classList.contains('occupied');
    const newOccupiedStatus = isOccupied ? 0 : 1; // Bascule l'état

    const token = localStorage.getItem('token');
    if (!token) {
        showMessage(adminInfo, "Authentification requise pour modifier le planning.", 'error');
        handleLogout();
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/planning/${agentId}/${currentWeek}/${currentDay}/${slotIndex}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ isOccupied: newOccupiedStatus })
        });

        if (response.ok) {
            // Mettre à jour le cache local et le DOM
            const agentPlanning = planningData[currentDay].find(p => p.agentId === agentId);
            if (agentPlanning) {
                agentPlanning.slots[slotIndex] = newOccupiedStatus;
            } else {
                // Si l'agent n'avait pas encore de ligne, l'ajouter
                planningData[currentDay].push({ agentId, slots: Array(24).fill(0).map((val, idx) => idx === slotIndex ? newOccupiedStatus : val) });
            }
            cell.classList.toggle('occupied', newOccupiedStatus === 1);
            cell.classList.toggle('free', newOccupiedStatus === 0);
            showMessage(adminInfo, 'Créneau mis à jour avec succès.', 'success');
        } else {
            const errorData = await response.json();
            showMessage(adminInfo, `Erreur lors de la mise à jour: ${errorData.message}`, 'error');
        }
    } catch (error) {
        console.error('Erreur réseau lors de la mise à jour du créneau:', error);
        showMessage(adminInfo, 'Erreur réseau lors de la mise à jour du créneau.', 'error');
    }
}

// --- Fonctions de gestion des agents ---

// Charger les infos d'affichage des agents (ID, nom, prénom)
async function fetchAgentDisplayInfos() {
    const token = localStorage.getItem('token');
    if (!token) return; // Pas de token, pas de chargement

    try {
        const response = await fetch(`${API_BASE_URL}/api/agents/display-info`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            const data = await response.json();
            agentDisplayInfos = data.reduce((acc, agent) => {
                acc[agent._id] = { nom: agent.nom, prenom: agent.prenom };
                return acc;
            }, {});
        } else {
            console.error("Impossible de charger les infos d'affichage des agents:", response.statusText);
        }
    } catch (error) {
        console.error("Erreur réseau lors du chargement des infos d'affichage des agents:", error);
    }
}


// Charger tous les agents pour la liste de gestion
async function fetchAgents() {
    showLoading(true);
    const token = localStorage.getItem('token');
    if (!token) {
        showMessage(listAgentsMessage, "Authentification requise pour charger les agents.", 'error');
        showLoading(false);
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/agents`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (response.ok) {
            const agents = await response.json();
            renderAgentsTable(agents);
            showMessage(listAgentsMessage, `Chargement de ${agents.length} agents réussi.`, 'success');
        } else {
            const errorData = await response.json();
            showMessage(listAgentsMessage, `Erreur lors du chargement des agents: ${errorData.message}`, 'error');
        }
    } catch (error) {
        console.error('Erreur réseau lors du chargement des agents:', error);
        showMessage(listAgentsMessage, 'Erreur réseau lors du chargement des agents.', 'error');
    } finally {
        showLoading(false);
    }
}

function renderAgentsTable(agents) {
    agentsTableBody.innerHTML = ''; // Vide le tableau

    if (agents.length === 0) {
        agentsTableBody.innerHTML = '<tr><td colspan="8">Aucun agent à afficher.</td></tr>';
        return;
    }

    agents.forEach(agent => {
        const row = agentsTableBody.insertRow();
        row.dataset.agentId = agent._id; // Stocke l'ID pour les actions

        row.innerHTML = `
            <td>${agent.nom}</td>
            <td>${agent.prenom}</td>
            <td>${agent.email}</td>
            <td>${agent.tel || 'N/A'}</td>
            <td>${agent.role}</td>
            <td>${agent.grades.map(g => g.name).join(', ') || 'Aucun'}</td>
            <td>${agent.fonctions.map(f => f.name).join(', ') || 'Aucune'}</td>
            <td>
                <button class="btn btn-sm btn-info edit-agent-btn" data-id="${agent._id}">Modifier</button>
                <button class="btn btn-sm btn-danger delete-agent-btn" data-id="${agent._id}">Supprimer</button>
            </td>
        `;
    });

    // Attacher les écouteurs d'événements après le rendu
    document.querySelectorAll('.edit-agent-btn').forEach(button => {
        button.addEventListener('click', (e) => openEditAgentModal(e.target.dataset.id));
    });
    document.querySelectorAll('.delete-agent-btn').forEach(button => {
        button.addEventListener('click', (e) => deleteAgent(e.target.dataset.id));
    });
}

// Remplir les checkboxes de grades et fonctions pour l'ajout/édition
function populateNewAgentCheckboxes() {
    if (newAgentGradesCheckboxes) {
        newAgentGradesCheckboxes.innerHTML = '';
        availableGrades.forEach(grade => {
            newAgentGradesCheckboxes.innerHTML += `
                <label><input type="checkbox" name="newAgentGrade" value="${grade._id}"> ${grade.name}</label>
            `;
        });
    }

    if (newAgentFonctionsCheckboxes) {
        newAgentFonctionsCheckboxes.innerHTML = '';
        availableFonctions.forEach(fonction => {
            newAgentFonctionsCheckboxes.innerHTML += `
                <label><input type="checkbox" name="newAgentFonction" value="${fonction._id}"> ${fonction.name}</label>
            `;
        });
    }

    // Pour la modale d'édition, si elle existe
    if (editAgentGradesCheckboxes) {
        editAgentGradesCheckboxes.innerHTML = '';
        availableGrades.forEach(grade => {
            editAgentGradesCheckboxes.innerHTML += `
                <label><input type="checkbox" name="editAgentGrade" value="${grade._id}"> ${grade.name}</label>
            `;
        });
    }
    if (editAgentFonctionsCheckboxes) {
        editAgentFonctionsCheckboxes.innerHTML = '';
        availableFonctions.forEach(fonction => {
            editAgentFonctionsCheckboxes.innerHTML += `
                <label><input type="checkbox" name="editAgentFonction" value="${fonction._id}"> ${fonction.name}</label>
            `;
        });
    }
}


// Ajouter un agent
async function addAgent(event) {
    event.preventDefault();
    showLoading(true);

    const nom = document.getElementById('newAgentNom').value;
    const prenom = document.getElementById('newAgentPrenom').value;
    const tel = document.getElementById('newAgentTel').value;
    const email = document.getElementById('newAgentEmail').value;
    const password = document.getElementById('newAgentPassword').value;
    const role = document.getElementById('newAgentRole').value;

    const selectedGrades = Array.from(document.querySelectorAll('input[name="newAgentGrade"]:checked'))
        .map(cb => cb.value);
    const selectedFonctions = Array.from(document.querySelectorAll('input[name="newAgentFonction"]:checked'))
        .map(cb => cb.value);

    const token = localStorage.getItem('token');
    if (!token) {
        showMessage(addAgentMessage, "Authentification requise pour ajouter un agent.", 'error');
        showLoading(false);
        handleLogout();
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/agents`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ nom, prenom, tel, email, password, role, grades: selectedGrades, fonctions: selectedFonctions })
        });

        if (response.ok) {
            const data = await response.json();
            showMessage(addAgentMessage, data.message, 'success');
            addAgentForm.reset();
            populateNewAgentCheckboxes(); // Réinitialiser les checkboxes après l'ajout
            fetchAgents(); // Recharger la liste des agents
        } else {
            const errorData = await response.json();
            showMessage(addAgentMessage, `Erreur: ${errorData.message}`, 'error');
        }
    } catch (error) {
        console.error('Erreur réseau lors de l\'ajout de l\'agent:', error);
        showMessage(addAgentMessage, 'Erreur réseau lors de l\'ajout de l\'agent.', 'error');
    } finally {
        showLoading(false);
    }
}

if (addAgentForm) {
    addAgentForm.addEventListener('submit', addAgent);
}

// Ouvrir la modale d'édition d'agent
async function openEditAgentModal(agentId) {
    showLoading(true);
    const token = localStorage.getItem('token');
    if (!token) {
        showMessage(editAgentMessage, "Authentification requise.", 'error');
        showLoading(false);
        handleLogout();
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/agents/${agentId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (response.ok) {
            const agent = await response.json();
            document.getElementById('editAgentId').value = agent._id;
            document.getElementById('editAgentNom').value = agent.nom;
            document.getElementById('editAgentPrenom').value = agent.prenom;
            document.getElementById('editAgentTel').value = agent.tel || '';
            document.getElementById('editAgentEmail').value = agent.email;
            document.getElementById('editAgentRole').value = agent.role;

            // Remplir et cocher les checkboxes de grades
            const gradeCheckboxes = document.querySelectorAll('input[name="editAgentGrade"]');
            gradeCheckboxes.forEach(cb => {
                cb.checked = agent.grades.includes(cb.value);
            });

            // Remplir et cocher les checkboxes de fonctions
            const fonctionCheckboxes = document.querySelectorAll('input[name="editAgentFonction"]');
            fonctionCheckboxes.forEach(cb => {
                cb.checked = agent.fonctions.includes(cb.value);
            });

            editAgentModal.style.display = 'block';
        } else {
            const errorData = await response.json();
            showMessage(listAgentsMessage, `Erreur: ${errorData.message}`, 'error');
        }
    } catch (error) {
        console.error('Erreur réseau lors de la récupération de l\'agent pour édition:', error);
        showMessage(listAgentsMessage, 'Erreur réseau.', 'error');
    } finally {
        showLoading(false);
    }
}

// Soumettre les modifications de l'agent
async function editAgent(event) {
    event.preventDefault();
    showLoading(true);

    const id = document.getElementById('editAgentId').value;
    const nom = document.getElementById('editAgentNom').value;
    const prenom = document.getElementById('editAgentPrenom').value;
    const tel = document.getElementById('editAgentTel').value;
    const email = document.getElementById('editAgentEmail').value;
    const password = document.getElementById('editAgentPassword').value; // Peut être vide
    const role = document.getElementById('editAgentRole').value;

    const selectedGrades = Array.from(document.querySelectorAll('input[name="editAgentGrade"]:checked'))
        .map(cb => cb.value);
    const selectedFonctions = Array.from(document.querySelectorAll('input[name="editAgentFonction"]:checked'))
        .map(cb => cb.value);

    const updateData = { nom, prenom, tel, email, role, grades: selectedGrades, fonctions: selectedFonctions };
    if (password) { // Ajouter le mot de passe seulement s'il est renseigné
        updateData.password = password;
    }

    const token = localStorage.getItem('token');
    if (!token) {
        showMessage(editAgentMessage, "Authentification requise pour modifier un agent.", 'error');
        showLoading(false);
        handleLogout();
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/agents/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(updateData)
        });

        if (response.ok) {
            const data = await response.json();
            showMessage(editAgentMessage, data.message, 'success');
            editAgentModal.style.display = 'none';
            fetchAgents(); // Recharger la liste des agents
        } else {
            const errorData = await response.json();
            showMessage(editAgentMessage, `Erreur: ${errorData.message}`, 'error');
        }
    } catch (error) {
        console.error('Erreur réseau lors de la mise à jour de l\'agent:', error);
        showMessage(editAgentMessage, 'Erreur réseau lors de la mise à jour de l\'agent.', 'error');
    } finally {
        showLoading(false);
    }
}

if (editAgentForm) {
    editAgentForm.addEventListener('submit', editAgent);
}
if (closeAgentModalButton) {
    closeAgentModalButton.addEventListener('click', () => editAgentModal.style.display = 'none');
}

// Supprimer un agent
async function deleteAgent(agentId) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet agent ?')) {
        return;
    }
    showLoading(true);
    const token = localStorage.getItem('token');
    if (!token) {
        showMessage(listAgentsMessage, "Authentification requise pour supprimer un agent.", 'error');
        showLoading(false);
        handleLogout();
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/agents/${agentId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            showMessage(listAgentsMessage, data.message, 'success');
            fetchAgents(); // Recharger la liste des agents
        } else {
            const errorData = await response.json();
            showMessage(listAgentsMessage, `Erreur: ${errorData.message}`, 'error');
        }
    } catch (error) {
        console.error('Erreur réseau lors de la suppression de l\'agent:', error);
        showMessage(listAgentsMessage, 'Erreur réseau lors de la suppression de l\'agent.', 'error');
    } finally {
        showLoading(false);
    }
}

// --- Fonctions de gestion des grades ---

async function fetchGrades() {
    const token = localStorage.getItem('token');
    if (!token) {
        showMessage(listGradesMessage, "Authentification requise pour charger les grades.", 'error');
        return;
    }
    try {
        const response = await fetch(`${API_BASE_URL}/api/grades`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            availableGrades = await response.json();
            renderGradesTable(availableGrades);
            populateNewAgentCheckboxes(); // Mettre à jour les checkboxes d'agent
        } else {
            const errorData = await response.json();
            showMessage(listGradesMessage, `Erreur: ${errorData.message}`, 'error');
        }
    } catch (error) {
        console.error('Erreur réseau lors du chargement des grades:', error);
        showMessage(listGradesMessage, 'Erreur réseau lors du chargement des grades.', 'error');
    }
}

function renderGradesTable(grades) {
    gradesTableBody.innerHTML = '';
    if (grades.length === 0) {
        gradesTableBody.innerHTML = '<tr><td colspan="2">Aucun grade à afficher.</td></tr>';
        return;
    }
    grades.forEach(grade => {
        const row = gradesTableBody.insertRow();
        row.innerHTML = `
            <td>${grade.name}</td>
            <td>
                <button class="btn btn-sm btn-info edit-grade-btn" data-id="${grade._id}">Modifier</button>
                <button class="btn btn-sm btn-danger delete-grade-btn" data-id="${grade._id}">Supprimer</button>
            </td>
        `;
    });
    document.querySelectorAll('.edit-grade-btn').forEach(button => {
        button.addEventListener('click', (e) => openEditGradeModal(e.target.dataset.id));
    });
    document.querySelectorAll('.delete-grade-btn').forEach(button => {
        button.addEventListener('click', (e) => deleteGrade(e.target.dataset.id));
    });
}

async function addGrade(event) {
    event.preventDefault();
    showLoading(true);
    const name = document.getElementById('newGradeName').value;
    const token = localStorage.getItem('token');
    if (!token) { showMessage(addGradeMessage, "Authentification requise.", 'error'); showLoading(false); return; }
    try {
        const response = await fetch(`${API_BASE_URL}/api/grades`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ name })
        });
        if (response.ok) {
            const data = await response.json();
            showMessage(addGradeMessage, data.message, 'success');
            addGradeForm.reset();
            fetchGrades();
        } else {
            const errorData = await response.json();
            showMessage(addGradeMessage, `Erreur: ${errorData.message}`, 'error');
        }
    } catch (error) {
        console.error('Erreur réseau lors de l\'ajout du grade:', error);
        showMessage(addGradeMessage, 'Erreur réseau lors de l\'ajout du grade.', 'error');
    } finally { showLoading(false); }
}
if (addGradeForm) addGradeForm.addEventListener('submit', addGrade);

async function openEditGradeModal(gradeId) {
    showLoading(true);
    const token = localStorage.getItem('token');
    if (!token) { showMessage(editGradeMessage, "Authentification requise.", 'error'); showLoading(false); return; }
    try {
        const response = await fetch(`${API_BASE_URL}/api/grades`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            const grades = await response.json();
            const grade = grades.find(g => g._id === gradeId);
            if (grade) {
                document.getElementById('editGradeId').value = grade._id;
                document.getElementById('editGradeName').value = grade.name;
                editGradeModal.style.display = 'block';
            } else {
                showMessage(listGradesMessage, 'Grade non trouvé.', 'error');
            }
        } else {
            const errorData = await response.json();
            showMessage(listGradesMessage, `Erreur: ${errorData.message}`, 'error');
        }
    } catch (error) {
        console.error('Erreur réseau lors de la récupération du grade pour édition:', error);
        showMessage(listGradesMessage, 'Erreur réseau.', 'error');
    } finally { showLoading(false); }
}

async function editGrade(event) {
    event.preventDefault();
    showLoading(true);
    const id = document.getElementById('editGradeId').value;
    const name = document.getElementById('editGradeName').value;
    const token = localStorage.getItem('token');
    if (!token) { showMessage(editGradeMessage, "Authentification requise.", 'error'); showLoading(false); return; }
    try {
        const response = await fetch(`${API_BASE_URL}/api/grades/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ name })
        });
        if (response.ok) {
            const data = await response.json();
            showMessage(editGradeMessage, data.message, 'success');
            editGradeModal.style.display = 'none';
            fetchGrades();
        } else {
            const errorData = await response.json();
            showMessage(editGradeMessage, `Erreur: ${errorData.message}`, 'error');
        }
    } catch (error) {
        console.error('Erreur réseau lors de la mise à jour du grade:', error);
        showMessage(editGradeMessage, 'Erreur réseau lors de la mise à jour du grade.', 'error');
    } finally { showLoading(false); }
}
if (editGradeForm) editGradeForm.addEventListener('submit', editGrade);
if (closeGradeModalButton) closeGradeModalButton.addEventListener('click', () => editGradeModal.style.display = 'none');


async function deleteGrade(gradeId) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce grade ?')) return;
    showLoading(true);
    const token = localStorage.getItem('token');
    if (!token) { showMessage(listGradesMessage, "Authentification requise.", 'error'); showLoading(false); return; }
    try {
        const response = await fetch(`${API_BASE_URL}/api/grades/${gradeId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            const data = await response.json();
            showMessage(listGradesMessage, data.message, 'success');
            fetchGrades();
            fetchAgents(); // Recharger les agents car leurs grades pourraient être affectés
        } else {
            const errorData = await response.json();
            showMessage(listGradesMessage, `Erreur: ${errorData.message}`, 'error');
        }
    } catch (error) {
        console.error('Erreur réseau lors de la suppression du grade:', error);
        showMessage(listGradesMessage, 'Erreur réseau lors de la suppression du grade.', 'error');
    } finally { showLoading(false); }
}

// --- Fonctions de gestion des fonctions ---

async function fetchFonctions() {
    const token = localStorage.getItem('token');
    if (!token) {
        showMessage(listFonctionsMessage, "Authentification requise pour charger les fonctions.", 'error');
        return;
    }
    try {
        const response = await fetch(`${API_BASE_URL}/api/fonctions`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            availableFonctions = await response.json();
            renderFonctionsTable(availableFonctions);
            populateNewAgentCheckboxes(); // Mettre à jour les checkboxes d'agent
        } else {
            const errorData = await response.json();
            showMessage(listFonctionsMessage, `Erreur: ${errorData.message}`, 'error');
        }
    } catch (error) {
        console.error('Erreur réseau lors du chargement des fonctions:', error);
        showMessage(listFonctionsMessage, 'Erreur réseau lors du chargement des fonctions.', 'error');
    }
}

function renderFonctionsTable(fonctions) {
    fonctionsTableBody.innerHTML = '';
    if (fonctions.length === 0) {
        fonctionsTableBody.innerHTML = '<tr><td colspan="2">Aucune fonction à afficher.</td></tr>';
        return;
    }
    fonctions.forEach(fonction => {
        const row = fonctionsTableBody.insertRow();
        row.innerHTML = `
            <td>${fonction.name}</td>
            <td>
                <button class="btn btn-sm btn-info edit-fonction-btn" data-id="${fonction._id}">Modifier</button>
                <button class="btn btn-sm btn-danger delete-fonction-btn" data-id="${fonction._id}">Supprimer</button>
            </td>
        `;
    });
    document.querySelectorAll('.edit-fonction-btn').forEach(button => {
        button.addEventListener('click', (e) => openEditFonctionModal(e.target.dataset.id));
    });
    document.querySelectorAll('.delete-fonction-btn').forEach(button => {
        button.addEventListener('click', (e) => deleteFonction(e.target.dataset.id));
    });
}

async function addFonction(event) {
    event.preventDefault();
    showLoading(true);
    const name = document.getElementById('newFonctionName').value;
    const token = localStorage.getItem('token');
    if (!token) { showMessage(addFonctionMessage, "Authentification requise.", 'error'); showLoading(false); return; }
    try {
        const response = await fetch(`${API_BASE_URL}/api/fonctions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ name })
        });
        if (response.ok) {
            const data = await response.json();
            showMessage(addFonctionMessage, data.message, 'success');
            addFonctionForm.reset();
            fetchFonctions();
        } else {
            const errorData = await response.json();
            showMessage(addFonctionMessage, `Erreur: ${errorData.message}`, 'error');
        }
    } catch (error) {
        console.error('Erreur réseau lors de l\'ajout de la fonction:', error);
        showMessage(addFonctionMessage, 'Erreur réseau lors de l\'ajout de la fonction.', 'error');
    } finally { showLoading(false); }
}
if (addFonctionForm) addFonctionForm.addEventListener('submit', addFonction);

async function openEditFonctionModal(fonctionId) {
    showLoading(true);
    const token = localStorage.getItem('token');
    if (!token) { showMessage(editFonctionMessage, "Authentification requise.", 'error'); showLoading(false); return; }
    try {
        const response = await fetch(`${API_BASE_URL}/api/fonctions`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            const fonctions = await response.json();
            const fonction = fonctions.find(f => f._id === fonctionId);
            if (fonction) {
                document.getElementById('editFonctionId').value = fonction._id;
                document.getElementById('editFonctionName').value = fonction.name;
                editFonctionModal.style.display = 'block';
            } else {
                showMessage(listFonctionsMessage, 'Fonction non trouvée.', 'error');
            }
        } else {
            const errorData = await response.json();
            showMessage(listFonctionsMessage, `Erreur: ${errorData.message}`, 'error');
        }
    } catch (error) {
        console.error('Erreur réseau lors de la récupération de la fonction pour édition:', error);
        showMessage(listFonctionsMessage, 'Erreur réseau.', 'error');
    } finally { showLoading(false); }
}

async function editFonction(event) {
    event.preventDefault();
    showLoading(true);
    const id = document.getElementById('editFonctionId').value;
    const name = document.getElementById('editFonctionName').value;
    const token = localStorage.getItem('token');
    if (!token) { showMessage(editFonctionMessage, "Authentification requise.", 'error'); showLoading(false); return; }
    try {
        const response = await fetch(`${API_BASE_URL}/api/fonctions/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ name })
        });
        if (response.ok) {
            const data = await response.json();
            showMessage(editFonctionMessage, data.message, 'success');
            editFonctionModal.style.display = 'none';
            fetchFonctions();
        } else {
            const errorData = await response.json();
            showMessage(editFonctionMessage, `Erreur: ${errorData.message}`, 'error');
        }
    } catch (error) {
        console.error('Erreur réseau lors de la mise à jour de la fonction:', error);
        showMessage(editFonctionMessage, 'Erreur réseau lors de la mise à jour de la fonction.', 'error');
    } finally { showLoading(false); }
}
if (editFonctionForm) editFonctionForm.addEventListener('submit', editFonction);
if (closeFonctionModalButton) closeFonctionModalButton.addEventListener('click', () => editFonctionModal.style.display = 'none');


async function deleteFonction(fonctionId) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette fonction ?')) return;
    showLoading(true);
    const token = localStorage.getItem('token');
    if (!token) { showMessage(listFonctionsMessage, "Authentification requise.", 'error'); showLoading(false); return; }
    try {
        const response = await fetch(`${API_BASE_URL}/api/fonctions/${fonctionId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            const data = await response.json();
            showMessage(listFonctionsMessage, data.message, 'success');
            fetchFonctions();
            fetchAgents(); // Recharger les agents car leurs fonctions pourraient être affectées
        } else {
            const errorData = await response.json();
            showMessage(listFonctionsMessage, `Erreur: ${errorData.message}`, 'error');
        }
    } catch (error) {
        console.error('Erreur réseau lors de la suppression de la fonction:', error);
        showMessage(listFonctionsMessage, 'Erreur réseau lors de la suppression de la fonction.', 'error');
    } finally { showLoading(false); }
}

// --- Fonctions de gestion de la configuration de la feuille de garde ---

async function fetchRosterConfig() {
    showLoading(true);
    const token = localStorage.getItem('token');
    if (!token) { showMessage(rosterConfigMessage, "Authentification requise pour charger la configuration.", 'error'); showLoading(false); return; }
    try {
        const response = await fetch(`${API_BASE_URL}/api/roster-config`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            const config = await response.json();
            renderRosterConfigForm(config.agents_per_slot || {});
        } else {
            const errorData = await response.json();
            showMessage(rosterConfigMessage, `Erreur: ${errorData.message}`, 'error');
        }
    } catch (error) {
        console.error('Erreur réseau lors du chargement de la configuration de la feuille de garde:', error);
        showMessage(rosterConfigMessage, 'Erreur réseau lors du chargement de la configuration.', 'error');
    } finally { showLoading(false); }
}

function renderRosterConfigForm(currentConfig) {
    if (!rosterConfigGrid) return;
    rosterConfigGrid.innerHTML = '';
    const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0') + ':00');

    hours.forEach(hour => {
        const div = document.createElement('div');
        div.classList.add('form-group');
        div.innerHTML = `
            <label for="agents-${hour}">Agents requis à ${hour} :</label>
            <input type="number" id="agents-${hour}" min="0" value="${currentConfig[hour] || 0}" data-hour="${hour}">
        `;
        rosterConfigGrid.appendChild(div);
    });
}

async function saveRosterConfig(event) {
    event.preventDefault();
    showLoading(true);
    const agentsPerSlot = {};
    rosterConfigGrid.querySelectorAll('input[type="number"]').forEach(input => {
        agentsPerSlot[input.dataset.hour] = parseInt(input.value);
    });

    const token = localStorage.getItem('token');
    if (!token) { showMessage(rosterConfigMessage, "Authentification requise pour sauvegarder la configuration.", 'error'); showLoading(false); return; }
    try {
        const response = await fetch(`${API_BASE_URL}/api/roster-config`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ agents_per_slot: agentsPerSlot })
        });
        if (response.ok) {
            const data = await response.json();
            showMessage(rosterConfigMessage, data.message, 'success');
        } else {
            const errorData = await response.json();
            showMessage(rosterConfigMessage, `Erreur: ${errorData.message}`, 'error');
        }
    } catch (error) {
        console.error('Erreur réseau lors de la sauvegarde de la configuration de la feuille de garde:', error);
        showMessage(rosterConfigMessage, 'Erreur réseau lors de la sauvegarde de la configuration.', 'error');
    } finally { showLoading(false); }
}
if (rosterConfigForm) rosterConfigForm.addEventListener('submit', saveRosterConfig);


// --- Fonctions d'export PDF ---

if (exportPdfButton) {
    exportPdfButton.addEventListener('click', async () => {
        showLoading(true, true); // Active le spinner avec message spécifique
        const currentYear = new Date().getFullYear();
        const doc = new window.jspdf.jsPDF();
        let yPos = 10;
        const pageHeight = doc.internal.pageSize.height;
        const marginLeft = 10;
        const lineHeight = 7;
        const agentNameWidth = 40;
        const slotWidth = 8;
        const headerColor = '#007bff'; // Bleu principal
        const occupiedColor = '#28a745'; // Vert pour occupé
        const freeColor = '#e0e0e0'; // Gris pour libre

        // Ajout du titre
        doc.setFontSize(20);
        doc.text(`Planning Global des Agents - Semaine ${currentWeek} (${getWeekRange(currentWeek)})`, marginLeft, yPos);
        yPos += 10;

        // Préparer les entêtes de colonne
        const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0') + ':00');
        const headers = ['Agent', ...hours];
        const columnWidths = [agentNameWidth, ...Array(24).fill(slotWidth)];
        const tableStartHeight = yPos;

        for (const day of days) {
            if (yPos + lineHeight * 3 > pageHeight) { // Vérifier si une nouvelle page est nécessaire
                doc.addPage();
                yPos = 10; // Réinitialiser yPos pour la nouvelle page
            }

            // Titre du jour
            doc.setFontSize(16);
            doc.text(day.charAt(0).toUpperCase() + day.slice(1), marginLeft, yPos);
            yPos += lineHeight;

            // Dessiner l'entête du tableau pour chaque jour
            doc.setFontSize(8);
            doc.setFillColor(headerColor);
            doc.setTextColor(255, 255, 255); // Texte blanc
            doc.rect(marginLeft, yPos, columnWidths.reduce((a, b) => a + b), lineHeight, 'F');
            let currentX = marginLeft;
            headers.forEach((header, i) => {
                doc.text(header, currentX + 2, yPos + lineHeight / 2 + 1, { align: 'left', baseline: 'middle' });
                currentX += columnWidths[i];
            });
            yPos += lineHeight;
            doc.setTextColor(0, 0, 0); // Revenir au texte noir

            const currentDayPlanning = planningData[day] || [];
            const sortedAgentDisplayInfos = Object.values(agentDisplayInfos).sort((a, b) => {
                const nameA = `${a.nom} ${a.prenom}`.toLowerCase();
                const nameB = `${b.nom} ${b.prenom}`.toLowerCase();
                return nameA.localeCompare(nameB);
            });

            if (sortedAgentDisplayInfos.length === 0) {
                if (yPos + lineHeight > pageHeight) { doc.addPage(); yPos = 10; }
                doc.text('Aucun agent disponible pour ce jour.', marginLeft, yPos);
                yPos += lineHeight * 2;
            } else {
                sortedAgentDisplayInfos.forEach(agentInfo => {
                    if (yPos + lineHeight > pageHeight) { // Nouvelle page si pas assez de place
                        doc.addPage();
                        yPos = 10;
                        // Redessiner l'entête du tableau sur la nouvelle page
                        doc.setFontSize(8);
                        doc.setFillColor(headerColor);
                        doc.setTextColor(255, 255, 255);
                        doc.rect(marginLeft, yPos, columnWidths.reduce((a, b) => a + b), lineHeight, 'F');
                        currentX = marginLeft;
                        headers.forEach((header, i) => {
                            doc.text(header, currentX + 2, yPos + lineHeight / 2 + 1, { align: 'left', baseline: 'middle' });
                            currentX += columnWidths[i];
                        });
                        yPos += lineHeight;
                        doc.setTextColor(0, 0, 0);
                    }

                    const agentPlanning = currentDayPlanning.find(p => p.agentId === agentInfo._id);
                    currentX = marginLeft;
                    doc.setFontSize(7);
                    doc.text(`${agentInfo.prenom} ${agentInfo.nom}`, currentX + 2, yPos + lineHeight / 2 + 1, { align: 'left', baseline: 'middle' });
                    currentX += agentNameWidth;

                    hours.forEach((_, index) => {
                        const isOccupied = agentPlanning && agentPlanning.slots[index] === 1;
                        doc.setFillColor(isOccupied ? occupiedColor : freeColor);
                        doc.rect(currentX, yPos, slotWidth, lineHeight, 'F');
                        doc.setDrawColor(200, 200, 200); // Couleur de bordure pour les cases
                        doc.rect(currentX, yPos, slotWidth, lineHeight, 'S'); // Dessine la bordure
                        currentX += slotWidth;
                    });
                    yPos += lineHeight;
                });
                yPos += lineHeight; // Espace entre les jours
            }
        }
        doc.save(`Planning_Semaine_${currentWeek}_${currentYear}.pdf`);
        showMessage(adminInfo, 'PDF généré avec succès !', 'success');
        showLoading(false, true); // Masque le spinner après la génération
    });
}


// --- Initialisation au chargement de la page ---
document.addEventListener('DOMContentLoaded', async () => {
    // debugger; // Ajoutez un debugger ici pour stopper l'exécution et inspecter

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
});