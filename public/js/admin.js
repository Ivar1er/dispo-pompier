const days = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const API_BASE_URL = "https://dispo-pompier.onrender.com";

let currentWeek = getCurrentWeek(); // Semaine actuelle par défaut (définie ci-dessous)
let currentDay = 'lundi'; // Jour actuel par défaut pour le planning
let planningData = {}; // Contiendra le planning global chargé de l'API {agentId: {"week-XX": {day: [slots]}}}
let agentDisplayInfos = {}; // Mapping dynamique agentId => {nom, prenom}
let availableGrades = []; // Liste des grades disponibles chargée depuis l'API
let availableFonctions = []; // Nouvelle: Liste des fonctions disponibles chargée depuis l'API

// --- DOM Elements pour la navigation principale (onglets) ---
const mainTabButtons = document.querySelectorAll('.main-tab');
const mainTabContents = document.querySelectorAll('.main-tab-content');

// --- DOM Elements pour la vue "Planning Global" ---
const planningControls = document.getElementById('planning-controls');
const weekSelect = document.getElementById("week-select");
const dateRangeDisplay = document.getElementById("date-range");
const planningContainer = document.getElementById("global-planning"); // Conteneur pour le tableau du planning
const tabButtons = document.querySelectorAll(".tab"); // Boutons de jour (Lundi, Mardi...)
const adminInfo = document.getElementById("admin-info");

// --- DOM Elements pour la vue "Gestion des Agents" ---
const addAgentForm = document.getElementById('addAgentForm');
const newAgentGradesCheckboxes = document.getElementById('newAgentGradesCheckboxes');
const newAgentFonctionsCheckboxes = document.getElementById('newAgentFonctionsCheckboxes');
const addAgentMessage = document.getElementById('addAgentMessage');
const agentsTableBody = document.getElementById('agentsTableBody');
const listAgentsMessage = document.getElementById('listAgentsMessage');

// --- DOM Elements pour la Modale de modification d'agent ---
const editAgentModal = document.getElementById('editAgentModal');
const closeButton = editAgentModal ? editAgentModal.querySelector('.close-button') : null; // S'assurer que la modale existe avant de chercher
const editAgentForm = document.getElementById('editAgentForm');
const editAgentId = document.getElementById('editAgentId');
const editAgentNom = document.getElementById('editAgentNom');
const editAgentPrenom = document.getElementById('editAgentPrenom');
const editAgentNewPassword = document.getElementById('editAgentNewPassword');
const editAgentMessage = document.getElementById('editAgentMessage');
const gradesCheckboxesDiv = document.getElementById('gradesCheckboxes');
const fonctionsCheckboxesDiv = document.getElementById('fonctionsCheckboxes');


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

// --- Global DOM Elements ---
const loadingSpinner = document.getElementById("loading-spinner");
const logoutButton = document.getElementById("logout-btn");


document.addEventListener("DOMContentLoaded", async () => {
    // **Vérification du rôle administrateur au chargement de la page**
    const userRole = sessionStorage.getItem("userRole");
    // Pour la démo, le token est juste l'ID de l'utilisateur 'admin'
    // En production, il faudrait valider un JWT.
    const token = sessionStorage.getItem("token");

    if (!userRole || userRole !== "admin" || !token || token !== "admin") { // C'est la ligne cruciale pour la connexion admin
        console.error("Accès non autorisé. Vous devez être administrateur.");
        sessionStorage.clear(); // Nettoie la session
        window.location.href = "index.html"; // Redirige vers la page de connexion
        return; // Arrête l'exécution du reste du script
    }

    // --- S'assurer que toutes les modales sont masquées au chargement ---
    if (editAgentModal) editAgentModal.style.display = 'none';
    if (editGradeModal) editGradeModal.style.display = 'none';
    if (editFonctionModal) editFonctionModal.style.display = 'none';


    // --- Initialisation des onglets principaux ---
    mainTabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTabId = button.dataset.mainTab;
            openMainTab(targetTabId);
        });
    });

    // --- Initialisation des onglets de jour pour le planning global ---
    tabButtons.forEach(tab => {
        tab.addEventListener("click", () => {
            const day = tab.dataset.day;
            showDay(day);
        });
    });

    // --- Initialisation des fonctionnalités par défaut de la page ---
    // Charger la liste des grades et fonctions disponibles en premier
    await loadAvailableGrades();
    await loadAvailableFonctions();

    // Rendre les checkboxes pour le formulaire d'ajout d'agent après le chargement des données
    renderNewAgentGradesCheckboxes();
    renderNewAgentFonctionsCheckboxes();

    // Ouvrir l'onglet "Planning Global" par défaut au chargement
    await openMainTab('global-planning-view'); // Attendre que le planning soit chargé avant d'afficher


    // --- Écouteurs d'événements pour les contrôles du planning global ---
    if (weekSelect) {
        weekSelect.addEventListener("change", async () => {
            // currentWeek est déjà mis à jour dans populateWeekSelector si la sélection change
            const selectedWeekValue = weekSelect.value; // ex: "week-24"
            currentWeek = parseInt(selectedWeekValue.split('-')[1]); // Extraction du numéro
            updateDateRangeDisplay(currentWeek); // Met à jour la plage de dates
            await loadPlanningAndDisplay(); // Recharger et afficher le planning pour la nouvelle semaine
        });
    }
    if (document.getElementById("export-pdf")) {
        document.getElementById("export-pdf").addEventListener("click", exportPdf);
    }

    // --- Écouteurs d'événements pour la vue "Gestion des Agents" ---
    if (addAgentForm) {
        addAgentForm.addEventListener('submit', handleAddAgent);
    }
    if (agentsTableBody) {
        agentsTableBody.addEventListener('click', handleAgentActions);
    }

    // --- Écouteurs d'événements pour la Modale de modification d'agent ---
    if (closeButton) {
        closeButton.addEventListener('click', () => {
            editAgentModal.style.display = 'none';
        });
    }
    window.addEventListener('click', (event) => {
        if (event.target === editAgentModal) {
            editAgentModal.style.display = 'none';
        }
    });
    if (editAgentForm) {
        editAgentForm.addEventListener('submit', handleEditAgent);
    }

    // --- Écouteurs d'événements pour la vue "Gestion des Grades" ---
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

    // --- Écouteurs d'événements pour la vue "Gestion des Fonctions" ---
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


    // --- Écouteur pour la déconnexion ---
    if (logoutButton) {
        logoutButton.addEventListener("click", logout);
    }
});


// --- Fonctions de gestion des onglets principaux (Planning Global / Gestion Agents / Gestion Grades / Gestion Fonctions) ---
async function openMainTab(tabId) {
    mainTabContents.forEach(tab => {
        tab.classList.remove('active');
    });
    mainTabButtons.forEach(button => {
        button.classList.remove('active');
    });

    document.getElementById(tabId).classList.add('active');
    document.querySelector(`.main-tab[data-main-tab="${tabId}"]`).classList.add('active');

    // Gérer la visibilité des contrôles spécifiques au planning
    if (tabId === 'global-planning-view') {
        planningControls.style.display = 'flex'; // Affiche les contrôles
        await loadPlanningAndDisplay(); // Recharger le planning si on revient sur cet onglet
    } else {
        planningControls.style.display = 'none'; // Cache les contrôles
        if (tabId === 'agent-management-view') {
            await loadAgents(); // Recharger la liste des agents quand on va sur cet onglet
        } else if (tabId === 'grade-management-view') {
            await loadGradesList();
        } else if (tabId === 'fonction-management-view') {
            await loadFonctionsList();
        }
    }
}


// --- Fonctions Utilitaire pour les dates et semaines ---
function getCurrentWeek(date = new Date()) {
    const target = new Date(date.valueOf());
    target.setHours(0, 0, 0, 0);
    // Janvier 4 est toujours dans la semaine 1 (ISO 8601)
    target.setDate(target.getDate() + 3 - (target.getDay() + 6) % 7);
    const week1 = new Date(target.getFullYear(), 0, 4);
    return 1 + Math.round(((target.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}

function getWeekDateRange(weekNumber, year = new Date().getFullYear()) {
    // Calcul de la date du lundi de la semaine ISO spécifiée
    const jan4 = new Date(year, 0, 4);
    const dayOfWeekJan4 = jan4.getDay(); // 0 for Sunday, 1 for Monday
    const diffToMonday = jan4.getDate() - dayOfWeekJan4 + (dayOfWeekJan4 === 0 ? -6 : 1);
    const mondayOfJan4Week = new Date(year, 0, diffToMonday);

    const mondayOfTargetWeek = new Date(mondayOfJan4Week.getTime());
    mondayOfTargetWeek.setDate(mondayOfTargetWeek.getDate() + (weekNumber - 1) * 7);

    const sundayOfTargetWeek = new Date(mondayOfTargetWeek.getTime());
    sundayOfTargetWeek.setDate(mondayOfTargetWeek.getDate() + 6); // Le dimanche est 6 jours après le lundi

    const options = { day: '2-digit', month: '2-digit' };
    return `du ${mondayOfTargetWeek.toLocaleDateString('fr-FR', options)} au ${sundayOfTargetWeek.toLocaleDateString('fr-FR', options)}`;
}


function getMondayOfWeek(weekNum, year) {
    const jan4 = new Date(year, 0, 4);
    const dayOfWeekJan4 = jan4.getDay();
    const diffToMonday = jan4.getDate() - dayOfWeekJan4 + (dayOfWeekJan4 === 0 ? -6 : 1);
    const mondayOfJan4Week = new Date(year, 0, diffToMonday);

    const mondayOfTargetWeek = new Date(mondayOfJan4Week.getTime());
    mondayOfTargetWeek.setDate(mondayOfTargetWeek.getDate() + (weekNum - 1) * 7);
    return mondayOfTargetWeek;
}

function updateDateRangeDisplay(weekNum) {
    const range = getWeekDateRange(weekNum);
    dateRangeDisplay.textContent = range;
}

// --- Fonctions de gestion du Planning Global ---

// Charge les plannings et met à jour l'affichage de la semaine
async function loadPlanningAndDisplay() {
    showLoading(true);
    try {
        // La route /api/planning renvoie le planning de TOUS les agents, par JOUR.
        // ex: { "agent1": { "lundi": ["07:00 - 07:30"], "mardi": [...] }, "agent2": { ... } }
        const res = await fetch(`${API_BASE_URL}/api/planning`, {
             headers: { 'Authorization': `Bearer ${sessionStorage.getItem('token')}` } // Envoyer le token
        });
        if (!res.ok) {
            if (res.status === 404) {
                console.warn("Aucun planning global trouvé (404), initialisation à vide.");
                planningData = {}; // Assurez-vous que planningData est vide
            } else if (res.status === 401 || res.status === 403) {
                 displayMessage(adminInfo, "Session expirée ou non autorisée. Reconnexion requise.", true);
                 setTimeout(() => logout(), 2000);
                 return;
            }
            else {
                throw new Error(`Erreur chargement planning global: HTTP ${res.status}`);
            }
        }
        planningData = await res.json() || {};
        console.log("Planning Data Loaded:", planningData); // Pour le débogage

        // Récupérer la liste des agents depuis l'API pour un mapping dynamique (id -> nom/prénom)
        const agentsResponse = await fetch(`${API_BASE_URL}/api/agents/display-info`, {
            headers: { 'Authorization': `Bearer ${sessionStorage.getItem('token')}` } // Envoyer le token
        });
        const agentsData = await agentsResponse.json();
        agentDisplayInfos = {};
        agentsData.forEach(agent => {
            agentDisplayInfos[agent.id] = { nom: agent.nom, prenom: agent.prenom };
        });
        console.log("Agent Display Infos:", agentDisplayInfos); // Pour le débogage

        // Maintenant que les données sont chargées, peuple le sélecteur de semaine
        // Ici, nous ne pouvons pas récupérer les semaines depuis le backend car la structure
        // agent.json ne contient pas d'info de semaine. On génère des semaines autour de l'actuelle.
        populateWeekSelector();
        updateDateRangeDisplay(currentWeek); // Met à jour l'affichage de la plage de dates

        // Affiche le planning pour le jour actuel (par défaut 'lundi')
        showDay(currentDay);

    }
    catch (e) {
        console.error("Erreur lors du chargement ou de l'affichage du planning :", e);
        adminInfo.textContent = "Erreur lors du chargement du planning global. Veuillez réessayer.";
        adminInfo.style.backgroundColor = "#ffe6e6";
        adminInfo.style.borderColor = "#e6a4a4";
        adminInfo.style.color = "#a94442";
        planningData = {}; // Réinitialise les données du planning en cas d'erreur
    }
    finally {
        showLoading(false);
    }
}

// Met à jour les options du sélecteur de semaine
function populateWeekSelector() {
    weekSelect.innerHTML = "";
    const numberOfWeeksAroundCurrent = 5; // Afficher quelques semaines avant et après
    const currentYear = new Date().getFullYear();

    for (let i = -numberOfWeeksAroundCurrent; i <= numberOfWeeksAroundCurrent; i++) {
        const weekNum = getCurrentWeek() + i;
        if (weekNum > 0 && weekNum <= 53) { // Gestion des 52/53 semaines
            const opt = document.createElement("option");
            opt.value = `week-${weekNum}`; // Format "week-XX"
            opt.textContent = `Semaine ${weekNum} (${getWeekDateRange(weekNum, currentYear)})`;
            if (weekNum === currentWeek) {
                opt.selected = true;
            }
            weekSelect.appendChild(opt);
        }
    }
    // Assure que currentWeek correspond à la sélection initiale
    currentWeek = parseInt(weekSelect.value.split('-')[1]);
    updateDateRangeDisplay(currentWeek);
}

// Affiche le planning pour le jour sélectionné
function showDay(day) {
    currentDay = day;
    tabButtons.forEach(tab => {
        tab.classList.toggle("active", tab.dataset.day === day);
    });

    // Masquer tous les contenus des jours
    document.querySelectorAll('.day-content').forEach(content => {
        content.classList.remove('active');
    });
    // Afficher le contenu du jour actif
    const activeDayContent = document.getElementById(`${day}-planning`);
    if (activeDayContent) {
        activeDayContent.classList.add('active');
    }

    const tableContainer = document.getElementById(`${day}-planning-table`);
    if (!tableContainer) {
        console.error(`Conteneur de table pour le jour ${day} non trouvé.`);
        return;
    }
    tableContainer.innerHTML = ""; // Vide le planning existant pour ce jour

    const table = document.createElement("table");
    table.className = "planning-table";

    // Header (créneaux horaires)
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");

    const thAgent = document.createElement("th");
    thAgent.textContent = "Agent";
    headerRow.appendChild(thAgent);

    // MODIFICATION 1: Définition des créneaux horaires fixes
    const timeSlots = ['07:00-07:00']; // Nouveau créneau unique de 24h

    timeSlots.forEach(slot => {
        const th = document.createElement("th");
        th.textContent = slot;
        headerRow.appendChild(th);
    });
    // Ajout de la colonne Actions
    const thActions = document.createElement("th");
    thActions.textContent = "Actions";
    headerRow.appendChild(thActions);

    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Body (planning par agent)
    const tbody = document.createElement("tbody");

    // Filtrer les agents qui sont dans planningData et agentDisplayInfos
    const relevantAgentIds = Object.keys(planningData).filter(agentId => agentDisplayInfos[agentId]);
    const sortedAgentIds = relevantAgentIds.sort((a, b) => {
        const nameA = `${agentDisplayInfos[a].prenom} ${agentDisplayInfos[a].nom}`;
        const nameB = `${agentDisplayInfos[b].prenom} ${agentDisplayInfos[b].nom}`;
        return nameA.localeCompare(nameB);
    });


    if (sortedAgentIds.length === 0) {
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = timeSlots.length + 2; // Nombre de colonnes (agent + créneaux + actions)
        td.textContent = "Aucun agent ou planning disponible pour cette semaine/jour.";
        tr.appendChild(td);
        tbody.appendChild(tr);
    } else {
        sortedAgentIds.forEach(agentId => {
            // planningData[agentId] est { "week-XX": { "lundi": ["0-6h", "12-18h"] } }
            // On accède donc à planningData[agentId][`week-${currentWeek}`][day]
            const agentDayPlanning = planningData[agentId]?.[`week-${currentWeek}`]?.[day] || [];
            const agentInfo = agentDisplayInfos[agentId];

            const tr = document.createElement("tr");
            const tdAgent = document.createElement("td");
            tdAgent.textContent = `${agentInfo.prenom} ${agentInfo.nom}`;
            tr.appendChild(tdAgent);

            timeSlots.forEach(slot => {
                const td = document.createElement("td");
                td.classList.add('slot-cell');
                td.setAttribute("data-agent-id", agentId);
                td.setAttribute("data-day", day);
                td.setAttribute("data-time-slot", slot);

                // Vérifie si le créneau est occupé pour cet agent et ce jour
                if (agentDayPlanning.includes(slot)) {
                    td.classList.add('occupied');
                    // MODIFICATION 2: Afficher les heures de la plage au passage de la souris
                    // Le title attribute est une bonne façon de faire un tooltip simple
                    td.title = `Disponibilité: ${agentDayPlanning.join(', ')}`;
                } else {
                    td.classList.add('free'); // Assurez-vous d'avoir ce style en CSS
                    td.title = "Non disponible";
                }
                tr.appendChild(td);
            });

            // Colonne Actions
            const tdActions = document.createElement("td");
            const editButton = document.createElement("button");
            editButton.textContent = "Éditer";
            editButton.className = "btn btn-primary btn-sm edit-slot-btn";
            editButton.dataset.agentId = agentId;
            editButton.dataset.day = day;
            tdActions.appendChild(editButton);
            tr.appendChild(tdActions);

            tbody.appendChild(tr);
        });
    }

    table.appendChild(tbody);
    tableContainer.appendChild(table);

    // Ajouter les gestionnaires d'événements aux cellules de créneau
    tableContainer.querySelectorAll('.slot-cell').forEach(cell => {
        cell.addEventListener('click', async (event) => {
            const agentId = cell.dataset.agentId;
            const day = cell.dataset.day;
            const timeSlot = cell.dataset.timeSlot;
            const isCurrentlyOccupied = cell.classList.contains('occupied');
            const action = isCurrentlyOccupied ? 'remove' : 'add'; // Basculer l'état

            try {
                showLoading(true);
                const response = await fetch(`${API_BASE_URL}/api/planning/${agentId}/${day}/${timeSlot}`, {
                    method: 'PATCH', // Utiliser PATCH pour la mise à jour partielle
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${sessionStorage.getItem('token')}`
                    },
                    body: JSON.stringify({ action: action })
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Erreur lors de la mise à jour du créneau.');
                }

                // Mettre à jour l'état visuel après succès API
                cell.classList.toggle('occupied', action === 'add');
                cell.classList.toggle('free', action === 'remove');

                // Mettre à jour planningData en mémoire pour la cohérence
                if (!planningData[agentId][`week-${currentWeek}`]) {
                    planningData[agentId][`week-${currentWeek}`] = {};
                }
                if (!planningData[agentId][`week-${currentWeek}`][day]) {
                    planningData[agentId][`week-${currentWeek}`][day] = [];
                }

                const currentAgentSlots = planningData[agentId][`week-${currentWeek}`][day];
                if (action === 'add' && !currentAgentSlots.includes(timeSlot)) {
                    currentAgentSlots.push(timeSlot);
                    currentAgentSlots.sort(); // Garder trié
                } else if (action === 'remove' && currentAgentSlots.includes(timeSlot)) {
                    planningData[agentId][`week-${currentWeek}`][day] = currentAgentSlots.filter(s => s !== timeSlot);
                }
                // Update the title attribute after state change
                cell.title = currentAgentSlots.length > 0 ? `Disponibilité: ${currentAgentSlots.join(', ')}` : "Non disponible";


                displayMessage(adminInfo, `Créneau ${timeSlot} pour ${agentInfo.prenom} ${agentInfo.nom} le ${day} mis à jour.`);

            } catch (error) {
                console.error("Erreur lors de la mise à jour du créneau:", error);
                displayMessage(adminInfo, `Erreur lors de la mise à jour du créneau: ${error.message}`, true);
            } finally {
                showLoading(false);
            }
        });
    });

    // Ajouter les gestionnaires d'événements pour les boutons "Éditer"
    tableContainer.querySelectorAll('.edit-slot-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            const agentId = event.target.dataset.agentId;
            const day = event.target.dataset.day;
            console.log(`Clic sur le bouton "Éditer" pour l'agent ${agentId} le jour ${day}`);
            displayMessage(adminInfo, `Fonctionnalité d'édition détaillée à implémenter pour ${agentId} le ${day}.`);
            // Ici, vous pourriez ouvrir une modale pour éditer les créneaux plus finement,
            // ou naviguer vers une page d'édition spécifique.
        });
    });


    // Réinitialise le message d'info si tout va bien
    adminInfo.textContent = "Vue du planning global des agents.";
    adminInfo.style.backgroundColor = "";
    adminInfo.style.borderColor = "";
    adminInfo.style.color = "";
}


// --- Fonctions d'Export PDF ---
async function exportPdf() {
    const container = document.getElementById("global-planning-view"); // Utilise le conteneur principal de la vue
    const currentDayTableContainer = document.getElementById(`${currentDay}-planning-table`);
    const table = currentDayTableContainer ? currentDayTableContainer.querySelector('.planning-table') : null;

    if (!table) {
        console.warn("La table de planning est introuvable pour le jour actuel. Impossible d'exporter.");
        displayMessage(adminInfo, "La table du planning n'est pas affichée. Impossible d'exporter.", true);
        return;
    }

    // Sauvegarde les styles originaux
    const originalContainerOverflowX = container.style.overflowX;
    const originalTableWhiteSpace = table.style.whiteSpace;
    const originalTableLayout = table.style.tableLayout;

    showLoading(true, true);

    try {
        // Applique des styles temporaires pour l'export
        container.style.overflowX = "visible";
        table.style.whiteSpace = "nowrap";
        table.style.tableLayout = "auto"; // Permet aux colonnes de s'ajuster

        await new Promise(r => setTimeout(r, 100)); // Petit délai pour le rendu des styles

        const { jsPDF } = window.jspdf;

        const year = new Date().getFullYear();
        const mondayDate = getMondayOfWeek(currentWeek, year);
        const sundayDate = new Date(mondayDate);
        sundayDate.setDate(mondayDate.getDate() + 6);

        function formatDate(d) {
            return d.getDate().toString().padStart(2, '0') + '/' + (d.getMonth() + 1).toString().padStart(2, '0');
        }
        const title = `Planning Semaine ${currentWeek} du ${formatDate(mondayDate)} au ${formatDate(sundayDate)}`;
        const dayTitle = `Jour : ${currentDay.charAt(0).toUpperCase() + currentDay.slice(1)}`;

        const canvas = await html2canvas(table, {
            scale: 2, // Augmente l'échelle pour une meilleure qualité d'image dans le PDF
            useCORS: true,
            allowTaint: true,
            logging: false
        });

        const imgData = canvas.toDataURL("image/png");

        const pdf = new jsPDF({
            orientation: "landscape",
            unit: "mm",
            format: "a3"
        });

        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 10;

        const imgProps = pdf.getImageProperties(imgData);
        let pdfWidth = pageWidth - (2 * margin);
        let pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

        // Si l'image est trop grande pour la hauteur, la redimensionner proportionnellement
        const headerSpace = 30; // Espace pour le titre et les infos
        if (pdfHeight > pageHeight - (2 * margin + headerSpace)) {
            pdfHeight = pageHeight - (2 * margin + headerSpace);
            pdfWidth = (imgProps.width * pdfHeight) / imgProps.height;
        }

        const x = (pageWidth - pdfWidth) / 2; // Centrer l'image horizontalement
        const y = margin + headerSpace; // Positionner sous le texte de l'en-tête

        pdf.setFontSize(18);
        pdf.text(title, margin, margin + 10);
        pdf.setFontSize(14);
        pdf.text(dayTitle, margin, margin + 20);

        pdf.addImage(imgData, "PNG", x, y, pdfWidth, pdfHeight);
        pdf.save(`planning_${currentDay}_semaine${currentWeek}.pdf`);
        displayMessage(adminInfo, "Le PDF a été généré avec succès !");

    } catch (error) {
        console.error("Erreur lors de l'export PDF:", error);
        displayMessage(adminInfo, "Une erreur est survenue lors de la génération du PDF. Détails: " + error.message, true);
    } finally {
        // Rétablit les styles originaux
        container.style.overflowX = originalContainerOverflowX;
        if (table) {
            table.style.whiteSpace = originalTableWhiteSpace;
            table.style.tableLayout = originalTableLayout;
        }
        showLoading(false, true);
    }
}


// --- Fonctions de gestion des grades ---

async function loadAvailableGrades() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/grades`, {
            headers: { 'Authorization': `Bearer ${sessionStorage.getItem('token')}` }
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'Erreur lors du chargement des grades disponibles.');
        }
        availableGrades = data;
        console.log('Grades disponibles chargés:', availableGrades);
    } catch (error) {
        console.error('Erreur de chargement des grades:', error);
        if (adminInfo) { // Utiliser adminInfo pour les messages globaux
            displayMessage(adminInfo, `Erreur de chargement des grades: ${error.message}`, true);
        }
    }
}

function renderNewAgentGradesCheckboxes() {
    if (!newAgentGradesCheckboxes) return;

    newAgentGradesCheckboxes.innerHTML = '';
    if (availableGrades.length === 0) {
        newAgentGradesCheckboxes.textContent = 'Aucun grade disponible. Ajoutez-en d\'abord via la gestion des grades.';
        return;
    }

    availableGrades.forEach(grade => {
        const checkboxContainer = document.createElement('div');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `new-grade-${grade.id}`;
        checkbox.value = grade.id;
        checkbox.name = 'newAgentGrades'; // Important pour la soumission du formulaire

        const label = document.createElement('label');
        label.htmlFor = `new-grade-${grade.id}`;
        label.textContent = grade.name;

        checkboxContainer.appendChild(checkbox);
        checkboxContainer.appendChild(label);
        newAgentGradesCheckboxes.appendChild(checkboxContainer);
    });
}

function renderGradesCheckboxes(agentGrades = []) {
    if (!gradesCheckboxesDiv) return;

    gradesCheckboxesDiv.innerHTML = '';
    if (availableGrades.length === 0) {
        gradesCheckboxesDiv.textContent = 'Aucun grade disponible.';
        if (adminInfo) {
             displayMessage(adminInfo, 'Veuillez ajouter des grades via l\'administration.', false); // Pas une erreur rouge
        }
        return;
    }

    availableGrades.forEach(grade => {
        const checkboxContainer = document.createElement('div');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `edit-grade-${grade.id}`;
        checkbox.value = grade.id;
        checkbox.name = 'editAgentGrades'; // Important pour la soumission du formulaire
        checkbox.checked = agentGrades.includes(grade.id);

        const label = document.createElement('label');
        label.htmlFor = `edit-grade-${grade.id}`;
        label.textContent = grade.name;

        checkboxContainer.appendChild(checkbox);
        checkboxContainer.appendChild(label);
        gradesCheckboxesDiv.appendChild(checkboxContainer);
    });
    // if (gradesMessage) { gradesMessage.textContent = ''; } // Supprimé, utilisez adminInfo
}

// --- Fonctions de gestion des fonctions ---

async function loadAvailableFonctions() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/fonctions`, {
            headers: { 'Authorization': `Bearer ${sessionStorage.getItem('token')}` }
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'Erreur lors du chargement des fonctions disponibles.');
        }
        availableFonctions = data;
        console.log('Fonctions disponibles chargées:', availableFonctions);
    } catch (error) {
        console.error('Erreur de chargement des fonctions:', error);
        if (adminInfo) {
            displayMessage(adminInfo, `Erreur de chargement des fonctions: ${error.message}`, true);
        }
    }
}

function renderNewAgentFonctionsCheckboxes() {
    if (!newAgentFonctionsCheckboxes) return;

    newAgentFonctionsCheckboxes.innerHTML = '';
    if (availableFonctions.length === 0) {
        newAgentFonctionsCheckboxes.textContent = 'Aucune fonction disponible. Ajoutez-en d\'abord via la gestion des fonctions.';
        return;
    }

    availableFonctions.forEach(fonction => {
        const checkboxContainer = document.createElement('div');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `new-fonction-${fonction.id}`;
        checkbox.value = fonction.id;
        checkbox.name = 'newAgentFonctions'; // Important pour la soumission du formulaire

        const label = document.createElement('label');
        label.htmlFor = `new-fonction-${fonction.id}`;
        label.textContent = fonction.name;

        checkboxContainer.appendChild(checkbox);
        checkboxContainer.appendChild(label);
        newAgentFonctionsCheckboxes.appendChild(checkboxContainer);
    });
}

function renderFonctionsCheckboxes(agentFonctions = []) {
    if (!fonctionsCheckboxesDiv) return;

    fonctionsCheckboxesDiv.innerHTML = '';
    if (availableFonctions.length === 0) {
        fonctionsCheckboxesDiv.textContent = 'Aucune fonction disponible.';
        if (adminInfo) {
             displayMessage(adminInfo, 'Veuillez ajouter des fonctions via l\'administration.', false);
        }
        return;
    }

    availableFonctions.forEach(fonction => {
        const checkboxContainer = document.createElement('div');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `edit-fonction-${fonction.id}`;
        checkbox.value = fonction.id;
        checkbox.name = 'editAgentFonctions'; // Important pour la soumission du formulaire
        checkbox.checked = agentFonctions.includes(fonction.id);

        const label = document.createElement('label');
        label.htmlFor = `edit-fonction-${fonction.id}`;
        label.textContent = fonction.name;

        checkboxContainer.appendChild(checkbox);
        checkboxContainer.appendChild(label);
        fonctionsCheckboxesDiv.appendChild(checkboxContainer);
    });
    // if (fonctionsMessage) { fonctionsMessage.textContent = ''; } // Supprimé, utilisez adminInfo
}


// --- Fonctions CRUD pour les agents (Backend) ---

async function loadAgents() {
    displayMessage(adminInfo, 'Chargement des agents...', false);
    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/agents`, {
            headers: {
                'Authorization': `Bearer ${sessionStorage.getItem('token')}`
            }
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Erreur lors du chargement des agents.');
        }

        agentsTableBody.innerHTML = '';
        if (data.length === 0) {
            agentsTableBody.innerHTML = '<tr><td colspan="6">Aucun agent enregistré pour le moment.</td></tr>'; // Colspan ajusté
        } else {
            data.forEach(agent => {
                const row = agentsTableBody.insertRow();
                // Afficher les grades et fonctions dans la table
                // Les propriétés grade_nom et fonction_nom sont maintenant envoyées par le serveur
                row.innerHTML = `
                    <td>${agent.id}</td>
                    <td>${agent.nom}</td>
                    <td>${agent.prenom}</td>
                    <td>${agent.grade_nom || 'N/A'}</td>
                    <td>${agent.fonction_nom || 'N/A'}</td>
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
            });
        }
        displayMessage(adminInfo, '', false); // Effacer le message de chargement
    } catch (error) {
        console.error('Erreur de chargement des agents:', error);
        displayMessage(adminInfo, `Erreur : ${error.message}`, true);
        agentsTableBody.innerHTML = '<tr><td colspan="6">Impossible de charger la liste des agents.</td></tr>'; // Colspan ajusté
    }
}

async function handleAddAgent(event) {
    event.preventDefault();
    const id = document.getElementById('newAgentId').value.trim();
    const nom = document.getElementById('newAgentNom').value.trim();
    const prenom = document.getElementById('newAgentPrenom').value.trim();
    const password = document.getElementById('newAgentPassword').value.trim();

    // Récupérer les grades sélectionnés
    const selectedGrades = Array.from(newAgentGradesCheckboxes.querySelectorAll('input[type="checkbox"]:checked'))
                                       .map(checkbox => checkbox.value);
    // Récupérer les fonctions sélectionnées
    const selectedFonctions = Array.from(newAgentFonctionsCheckboxes.querySelectorAll('input[type="checkbox"]:checked'))
                                       .map(checkbox => checkbox.value);

    displayMessage(addAgentMessage, 'Ajout en cours...', false);

    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/agents`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionStorage.getItem('token')}`
            },
            body: JSON.stringify({ id, nom, prenom, password, grades: selectedGrades, fonctions: selectedFonctions })
        });
        const data = await response.json();

        if (response.ok) {
            displayMessage(addAgentMessage, data.message, false);
            addAgentForm.reset();
            // Réinitialiser les checkboxes après l'ajout
            newAgentGradesCheckboxes.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
            newAgentFonctionsCheckboxes.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
            loadAgents(); // Recharger la liste
        } else {
            displayMessage(addAgentMessage, `Erreur : ${data.message}`, true);
        }
    } catch (error) {
        console.error('Erreur lors de l\'ajout de l\'agent:', error);
        displayMessage(addAgentMessage, 'Erreur réseau lors de l\'ajout de l\'agent.', true);
    }
}

async function handleAgentActions(event) {
    const target = event.target;
    const agentId = target.dataset.id;

    if (!agentId) return;

    if (target.classList.contains('edit-btn')) {
        editAgentId.value = agentId;
        editAgentNom.value = target.dataset.nom;
        editAgentPrenom.value = target.dataset.prenom;
        editAgentNewPassword.value = ''; // Toujours vider le champ mot de passe

        // Récupérer les grades et fonctions de l'agent depuis le dataset
        const agentGrades = JSON.parse(target.dataset.grades || '[]');
        const agentFonctions = JSON.parse(target.dataset.fonctions || '[]');

        renderGradesCheckboxes(agentGrades);
        renderFonctionsCheckboxes(agentFonctions);

        editAgentModal.style.display = 'block';
    } else if (target.classList.contains('delete-btn')) {
        // Utiliser une modale personnalisée si alert()/confirm() sont interdits
        if (confirm(`Êtes-vous sûr de vouloir supprimer l'agent ${agentId} ?`)) {
            try {
                const response = await fetch(`${API_BASE_URL}/api/admin/agents/${agentId}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${sessionStorage.getItem('token')}`
                    }
                });
                const data = await response.json();

                if (response.ok) {
                    displayMessage(adminInfo, data.message, false);
                    loadAgents(); // Recharger la liste
                } else {
                    displayMessage(adminInfo, `Erreur lors de la suppression : ${data.message}`, true);
                }
            } catch (error) {
                console.error('Erreur lors de la suppression de l\'agent:', error);
                displayMessage(adminInfo, 'Erreur réseau lors de la suppression de l\'agent.', true);
            }
        }
    }
}

async function handleEditAgent(event) {
    event.preventDefault();
    const id = editAgentId.value.trim();
    const nom = editAgentNom.value.trim();
    const prenom = editAgentPrenom.value.trim();
    const newPassword = editAgentNewPassword.value.trim();

    // Récupérer les grades sélectionnés
    const selectedGrades = Array.from(gradesCheckboxesDiv.querySelectorAll('input[type="checkbox"]:checked'))
                                       .map(checkbox => checkbox.value);
    // Récupérer les fonctions sélectionnées
    const selectedFonctions = Array.from(fonctionsCheckboxesDiv.querySelectorAll('input[type="checkbox"]:checked'))
                                       .map(checkbox => checkbox.value);


    displayMessage(editAgentMessage, 'Mise à jour en cours...', false);

    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/agents/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionStorage.getItem('token')}`
            },
            body: JSON.stringify({ nom, prenom, newPassword, grades: selectedGrades, fonctions: selectedFonctions })
        });
        const data = await response.json();

        if (response.ok) {
            displayMessage(editAgentMessage, data.message, false);
            loadAgents(); // Recharger la liste des agents
            // editAgentModal.style.display = 'none'; // Optionnel: fermer la modale après succès
        } else {
            displayMessage(editAgentMessage, `Erreur : ${data.message}`, true);
        }
    } catch (error) {
        console.error('Erreur lors de la mise à jour de l\'agent:', error);
        displayMessage(editAgentMessage, 'Erreur réseau lors de la mise à jour de l\'agent.', true);
    }
}

// --- Fonctions CRUD pour la gestion des grades ---

async function loadGradesList() {
    displayMessage(adminInfo, 'Chargement des grades...', false);
    try {
        const response = await fetch(`${API_BASE_URL}/api/grades`, {
            headers: { 'Authorization': `Bearer ${sessionStorage.getItem('token')}` }
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Erreur lors du chargement des grades.');
        }

        gradesTableBody.innerHTML = '';
        if (data.length === 0) {
            gradesTableBody.innerHTML = '<tr><td colspan="3">Aucun grade enregistré pour le moment.</td></tr>';
        } else {
            data.forEach(grade => {
                const row = gradesTableBody.insertRow();
                row.innerHTML = `
                    <td>${grade.id}</td>
                    <td>${grade.name}</td>
                    <td>
                        <button class="edit-btn btn-secondary" data-id="${grade.id}" data-name="${grade.name}">Modifier</button>
                        <button class="delete-btn btn-danger" data-id="${grade.id}">Supprimer</button>
                    </td>
                `;
            });
        }
        displayMessage(adminInfo, '', false);
    } catch (error) {
        console.error('Erreur de chargement des grades:', error);
        displayMessage(adminInfo, `Erreur : ${error.message}`, true);
        gradesTableBody.innerHTML = '<tr><td colspan="3">Impossible de charger la liste des grades.</td></tr>';
    }
}

async function handleAddGrade(event) {
    event.preventDefault();
    const id = document.getElementById('newGradeId').value.trim();
    const name = document.getElementById('newGradeName').value.trim();

    displayMessage(addGradeMessage, 'Ajout en cours...', false);

    try {
        const response = await fetch(`${API_BASE_URL}/api/grades`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionStorage.getItem('token')}`
            },
            body: JSON.stringify({ id, name })
        });
        const data = await response.json();

        if (response.ok) {
            displayMessage(addGradeMessage, data.message, false);
            addGradeForm.reset();
            await loadAvailableGrades();
            await loadGradesList();
            renderNewAgentGradesCheckboxes();
        } else {
            displayMessage(addGradeMessage, `Erreur : ${data.message}`, true);
        }
    } catch (error) {
        console.error('Erreur lors de l\'ajout du grade:', error);
        displayMessage(addGradeMessage, 'Erreur réseau lors de l\'ajout du grade.', true);
    }
}

async function handleGradeActions(event) {
    const target = event.target;
    const gradeId = target.dataset.id;

    if (!gradeId) return;

    if (target.classList.contains('edit-btn')) {
        editGradeId.value = gradeId;
        editGradeName.value = target.dataset.name;
        editGradeMessage.textContent = '';
        editGradeModal.style.display = 'block';
    } else if (target.classList.contains('delete-btn')) {
        if (confirm(`Êtes-vous sûr de vouloir supprimer le grade "${gradeId}" ? Cela le retirera aussi des agents qui le possèdent.`)) {
            try {
                const response = await fetch(`${API_BASE_URL}/api/grades/${gradeId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${sessionStorage.getItem('token')}` }
                });
                const data = await response.json();

                if (response.ok) {
                    displayMessage(adminInfo, data.message, false);
                    await loadAvailableGrades();
                    await loadGradesList();
                    renderNewAgentGradesCheckboxes();
                    loadAgents(); // Recharger la liste des agents pour refléter les suppressions
                } else {
                    displayMessage(adminInfo, `Erreur lors de la suppression : ${data.message}`, true);
                }
            } catch (error) {
                console.error('Erreur lors de la suppression du grade:', error);
                displayMessage(adminInfo, 'Erreur réseau lors de la suppression du grade.', true);
            }
        }
    }
}

async function handleEditGrade(event) {
    event.preventDefault();
    const id = editGradeId.value.trim();
    const name = editGradeName.value.trim();

    displayMessage(editGradeMessage, 'Mise à jour en cours...', false);

    try {
        const response = await fetch(`${API_BASE_URL}/api/grades/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionStorage.getItem('token')}`
            },
            body: JSON.stringify({ name })
        });
        const data = await response.json();

        if (response.ok) {
            displayMessage(editGradeMessage, data.message, false);
            await loadAvailableGrades();
            await loadGradesList();
            renderNewAgentGradesCheckboxes();
            loadAgents(); // Refresh agents list to update displayed grade names
            // editGradeModal.style.display = 'none';
        } else {
            displayMessage(editGradeMessage, `Erreur : ${data.message}`, true);
        }
    } catch (error) {
        console.error('Erreur lors de la mise à jour du grade:', error);
        displayMessage(editGradeMessage, 'Erreur réseau lors de la mise à jour du grade.', true);
    }
}


// --- Fonctions CRUD pour la gestion des fonctions ---

async function loadFonctionsList() {
    displayMessage(adminInfo, 'Chargement des fonctions...', false);
    try {
        const response = await fetch(`${API_BASE_URL}/api/fonctions`, {
            headers: { 'Authorization': `Bearer ${sessionStorage.getItem('token')}` }
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Erreur lors du chargement des fonctions.');
        }

        fonctionsTableBody.innerHTML = '';
        if (data.length === 0) {
            fonctionsTableBody.innerHTML = '<tr><td colspan="3">Aucune fonction enregistrée pour le moment.</td></tr>';
        } else {
            data.forEach(fonction => {
                const row = fonctionsTableBody.insertRow();
                row.innerHTML = `
                    <td>${fonction.id}</td>
                    <td>${fonction.name}</td>
                    <td>
                        <button class="edit-btn btn-secondary" data-id="${fonction.id}" data-name="${fonction.name}">Modifier</button>
                        <button class="delete-btn btn-danger" data-id="${fonction.id}">Supprimer</button>
                    </td>
                `;
            });
        }
        displayMessage(adminInfo, '', false);
    }
    catch (error) {
        console.error('Erreur de chargement des fonctions:', error);
        displayMessage(adminInfo, `Erreur : ${error.message}`, true);
        fonctionsTableBody.innerHTML = '<tr><td colspan="3">Impossible de charger la liste des fonctions.</td></tr>';
    }
}

async function handleAddFonction(event) {
    event.preventDefault();
    const id = document.getElementById('newFonctionId').value.trim();
    const name = document.getElementById('newFonctionName').value.trim();

    displayMessage(addFonctionMessage, 'Ajout en cours...', false);

    try {
        const response = await fetch(`${API_BASE_URL}/api/fonctions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionStorage.getItem('token')}`
            },
            body: JSON.stringify({ id, name })
        });
        const data = await response.json();

        if (response.ok) {
            displayMessage(addFonctionMessage, data.message, false);
            addFonctionForm.reset();
            await loadAvailableFonctions();
            await loadFonctionsList();
            renderNewAgentFonctionsCheckboxes();
        } else {
            displayMessage(addFonctionMessage, `Erreur : ${data.message}`, true);
        }
    } catch (error) {
        console.error('Erreur lors de l\'ajout de la fonction:', error);
        displayMessage(addFonctionMessage, 'Erreur réseau lors de l\'ajout de la fonction.', true);
    }
}

async function handleFonctionActions(event) {
    const target = event.target;
    const fonctionId = target.dataset.id;

    if (!fonctionId) return;

    if (target.classList.contains('edit-btn')) {
        editFonctionId.value = fonctionId;
        editFonctionName.value = target.dataset.name;
        editFonctionMessage.textContent = '';
        editFonctionModal.style.display = 'block';
    } else if (target.classList.contains('delete-btn')) {
        if (confirm(`Êtes-vous sûr de vouloir supprimer la fonction "${fonctionId}" ? Cela la retirera aussi des agents qui la possèdent.`)) {
            try {
                const response = await fetch(`${API_BASE_URL}/api/fonctions/${fonctionId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${sessionStorage.getItem('token')}` }
                });
                const data = await response.json();

                if (response.ok) {
                    displayMessage(adminInfo, data.message, false);
                    await loadAvailableFonctions();
                    await loadFonctionsList();
                    renderNewAgentFonctionsCheckboxes();
                    loadAgents(); // Recharger la liste des agents pour refléter les suppressions
                } else {
                    displayMessage(adminInfo, `Erreur lors de la suppression : ${data.message}`, true);
                }
            } catch (error) {
                console.error('Erreur lors de la suppression de la fonction:', error);
                displayMessage(adminInfo, 'Erreur réseau lors de la suppression de la fonction.', true);
            }
        }
    }
}

async function handleEditFonction(event) {
    event.preventDefault();
    const id = editFonctionId.value.trim();
    const name = editFonctionName.value.trim();

    displayMessage(editFonctionMessage, 'Mise à jour en cours...', false);

    try {
        const response = await fetch(`${API_BASE_URL}/api/fonctions/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionStorage.getItem('token')}`
            },
            body: JSON.stringify({ name })
        });
        const data = await response.json();

        if (response.ok) {
            displayMessage(editFonctionMessage, data.message, false);
            await loadAvailableFonctions();
            await loadFonctionsList();
            renderNewAgentFonctionsCheckboxes();
            loadAgents(); // Refresh agents list to update displayed function names
            // editFonctionModal.style.display = 'none';
        } else {
            displayMessage(editFonctionMessage, `Erreur : ${data.message}`, true);
        }
    } catch (error) {
        console.error('Erreur lors de la mise à jour de la fonction:', error);
        displayMessage(editFonctionMessage, 'Erreur réseau lors de la mise à jour de la fonction.', true);
    }
}


function logout() {
    sessionStorage.clear();
    window.location.href = "index.html";
}

// --- Fonction pour gérer l'affichage du spinner de chargement et désactiver/réactiver les contrôles ---
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