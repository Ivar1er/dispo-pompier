const days = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const API_BASE_URL = "https://dispo-pompier.onrender.com";

let currentWeek = getCurrentWeek(); // Semaine actuelle par défaut
let currentDay = 'lundi'; // Jour actuel par défaut pour le planning
let planningData = {}; // Contiendra le planning global chargé de l'API
let agentDisplayInfos = {}; // Mapping dynamique agentId => {nom, prenom}
let availableQualifications = []; // Liste des qualifications disponibles chargée depuis l'API
let availableGrades = []; // Nouvelle: Liste des grades disponibles chargée depuis l'API
let availableFunctions = []; // Nouvelle: Liste des fonctions disponibles chargée depuis l'API

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
const newAgentQualificationsCheckboxes = document.getElementById('newAgentQualificationsCheckboxes');
const newAgentGradesCheckboxes = document.getElementById('newAgentGradesCheckboxes'); // Nouveau
const newAgentFunctionsCheckboxes = document.getElementById('newAgentFunctionsCheckboxes'); // Nouveau
const addAgentMessage = document.getElementById('addAgentMessage');
const agentsTableBody = document.getElementById('agentsTableBody');
const listAgentsMessage = document.getElementById('listAgentsMessage');

// --- DOM Elements pour la Modale de modification d'agent et de qualifications ---
const editAgentModal = document.getElementById('editAgentModal');
const closeButton = editAgentModal.querySelector('.close-button');
const editAgentForm = document.getElementById('editAgentForm');
const editAgentId = document.getElementById('editAgentId');
const editAgentNom = document.getElementById('editAgentNom');
const editAgentPrenom = document.getElementById('editAgentPrenom');
const editAgentNewPassword = document.getElementById('editAgentNewPassword');
const editAgentMessage = document.getElementById('editAgentMessage');
const qualificationsCheckboxesDiv = document.getElementById('qualificationsCheckboxes'); // Pour la modale de modification
const gradesCheckboxesDiv = document.getElementById('gradesCheckboxes'); // Nouveau: Pour la modale de modification
const functionsCheckboxesDiv = document.getElementById('functionsCheckboxes'); // Nouveau: Pour la modale de modification
const qualificationsMessage = document.getElementById('qualificationsMessage'); // For the edit modal
const gradesMessage = document.getElementById('gradesMessage'); // Nouveau: Pour la modale de modification des grades
const functionsMessage = document.getElementById('functionsMessage'); // Nouveau: Pour la modale de modification des fonctions


// --- DOM Elements pour la vue "Gestion des Qualifications" ---
const addQualificationForm = document.getElementById('addQualificationForm');
const addQualificationMessage = document.getElementById('addQualificationMessage');
const qualificationsTableBody = document.getElementById('qualificationsTableBody');
const listQualificationsMessage = document.getElementById('listQualificationsMessage');
const editQualificationModal = document.getElementById('editQualificationModal'); // Nouvelle modale
const closeQualButton = editQualificationModal ? editQualificationModal.querySelector('.close-button') : null;
const editQualificationForm = document.getElementById('editQualificationForm');
const editQualId = document.getElementById('editQualId');
const editQualName = document.getElementById('editQualName');
const editQualMessage = document.getElementById('editQualMessage');

// --- DOM Elements pour la vue "Gestion des Grades" (Nouveau) ---
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

// --- DOM Elements pour la vue "Gestion des Fonctions" (Nouveau) ---
const addFunctionForm = document.getElementById('addFunctionForm');
const addFunctionMessage = document.getElementById('addFunctionMessage');
const functionsTableBody = document.getElementById('functionsTableBody');
const listFunctionsMessage = document.getElementById('listFunctionsMessage');
const editFunctionModal = document.getElementById('editFunctionModal');
const closeFunctionButton = editFunctionModal ? editFunctionModal.querySelector('.close-button') : null;
const editFunctionForm = document.getElementById('editFunctionForm');
const editFunctionId = document.getElementById('editFunctionId');
const editFunctionName = document.getElementById('editFunctionName');
const editFunctionMessage = document.getElementById('editFunctionMessage');

// --- Global DOM Elements ---
const loadingSpinner = document.getElementById("loading-spinner");
const logoutButton = document.getElementById("logout-btn");


document.addEventListener("DOMContentLoaded", async () => {
    // **Vérification du rôle administrateur au chargement de la page**
    const userRole = sessionStorage.getItem("userRole");
    if (!userRole || userRole !== "admin") {
        console.error("Accès non autorisé. Vous devez être administrateur.");
        sessionStorage.clear();
        window.location.href = "index.html";
        return;
    }

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
    // Charger la liste des qualifications, grades et fonctions disponibles en premier
    await loadAvailableQualifications();
    await loadAvailableGrades(); // Nouveau
    await loadAvailableFunctions(); // Nouveau

    // Rendre les checkboxes pour le formulaire d'ajout d'agent après le chargement des données
    renderNewAgentQualificationsCheckboxes();
    renderNewAgentGradesCheckboxes(); // Nouveau
    renderNewAgentFunctionsCheckboxes(); // Nouveau

    // Ouvrir l'onglet "Planning Global" par default au chargement
    await openMainTab('global-planning-view'); // Attendre que le planning soit chargé avant d'afficher


    // --- Écouteurs d'événements pour les contrôles du planning global ---
    if (weekSelect) {
        weekSelect.addEventListener("change", async () => {
            currentWeek = parseInt(weekSelect.value.split('-')[1]); // Mise à jour de currentWeek
            await loadPlanningAndDisplay(); // Recharger et afficher le planning
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
        if (event.target == editAgentModal) {
            editAgentModal.style.display = 'none';
        }
    });
    if (editAgentForm) {
        editAgentForm.addEventListener('submit', handleEditAgent);
    }

    // --- Écouteurs d'événements pour la vue "Gestion des Qualifications" ---
    if (addQualificationForm) {
        addQualificationForm.addEventListener('submit', handleAddQualification);
    }
    if (qualificationsTableBody) {
        qualificationsTableBody.addEventListener('click', handleQualificationActions);
    }
    if (closeQualButton) {
        closeQualButton.addEventListener('click', () => {
            editQualificationModal.style.display = 'none';
        });
    }
    if (editQualificationForm) {
        editQualificationForm.addEventListener('submit', handleEditQualification);
    }

    // --- Écouteurs d'événements pour la vue "Gestion des Grades" (Nouveau) ---
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

    // --- Écouteurs d'événements pour la vue "Gestion des Fonctions" (Nouveau) ---
    if (addFunctionForm) {
        addFunctionForm.addEventListener('submit', handleAddFunction);
    }
    if (functionsTableBody) {
        functionsTableBody.addEventListener('click', handleFunctionActions);
    }
    if (closeFunctionButton) {
        closeFunctionButton.addEventListener('click', () => {
            editFunctionModal.style.display = 'none';
        });
    }
    if (editFunctionForm) {
        editFunctionForm.addEventListener('submit', handleEditFunction);
    }


    // --- Écouteur pour la déconnexion ---
    if (logoutButton) {
        logoutButton.addEventListener("click", logout);
    }
});


// --- Fonctions de gestion des onglets principaux (Planning Global / Gestion Agents / Gestion Qualifications / Gestion Grades / Gestion Fonctions) ---
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
        } else if (tabId === 'qualification-management-view') { // Nouveau
            await loadQualificationsList();
        } else if (tabId === 'grade-management-view') { // Nouveau
            await loadGradesList();
        } else if (tabId === 'function-management-view') { // Nouveau
            await loadFunctionsList();
        }
    }
}


// --- Fonctions Utilitaire pour les dates et semaines ---
function getCurrentWeek(date = new Date()) {
    const target = new Date(date.valueOf());
    target.setDate(target.getDate() + 3 - (target.getDay() + 6) % 7);
    const firstThursday = new Date(target.getFullYear(), 0, 4);
    const weekNum = 1 + Math.round(((target - firstThursday) / 86400000 - 3 + (firstThursday.getDay() + 6) % 7) / 7);
    return weekNum;
}

function getWeekDateRange(weekNumber, year = new Date().getFullYear()) {
    const simple = new Date(year, 0, 1 + (weekNumber - 1) * 7);
    const dow = simple.getDay() || 7;
    const ISOweekStart = new Date(simple);
    if (dow <= 4) {
        ISOweekStart.setDate(simple.getDate() - dow + 1);
    } else {
        ISOweekStart.setDate(simple.getDate() + 8 - dow);
    }

    const start = new Date(ISOweekStart);
    const end = new Date(ISOweekStart);
    end.setDate(start.getDate() + 6);

    const format = date => date.toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit"
    });

    return `du ${format(start)} au ${format(end)}`;
}

function getMondayOfWeek(weekNum, year) {
    const simple = new Date(year, 0, 1 + (weekNum - 1) * 7);
    const dow = simple.getDay();
    if (dow <= 4) simple.setDate(simple.getDate() - dow + 1);
    else simple.setDate(simple.getDate() + 8 - dow);
    return simple;
}

// --- Fonctions de gestion du Planning Global ---

// Charge les plannings et met à jour l'affichage de la semaine
async function loadPlanningAndDisplay() {
    showLoading(true);
    try {
        const res = await fetch(`${API_BASE_URL}/api/planning`);
        if (!res.ok) {
            if (res.status === 404) {
                console.warn("Aucun planning global trouvé (404), initialisation à vide.");
                planningData = {};
            } else {
                throw new Error(`Erreur chargement planning global: HTTP ${res.status}`);
            }
        }
        planningData = await res.json() || {};

        // Récupérer la liste des agents depuis l'API pour un mapping dynamique
        const agentsResponse = await fetch(`${API_BASE_URL}/api/admin/agents`, {
            headers: { 'X-User-Role': 'admin' } // Toujours envoyer ce header pour la démo
        });
        const agentsData = await agentsResponse.json();
        agentDisplayInfos = {};
        agentsData.forEach(agent => {
            // **********************************************
            // MISE À JOUR 1 dans admin.js : Utiliser agent._id
            // Le backend renvoie maintenant '_id' au lieu de 'id' pour l'identifiant unique de l'agent.
            // **********************************************
            agentDisplayInfos[agent._id] = { nom: agent.nom, prenom: agent.prenom };
        });

        const allWeeksSet = new Set();
        // Le `agentKey` ici correspondra aux clés reçues de l'API /api/planning (ex: 'bruneaum', 'marechain')
        for (const agentKey in planningData) {
            // Filtrer les agents qui ne sont pas dans agentDisplayInfos (ex: admin, ou agents supprimés)
            // L'agentKey doit correspondre à agent._id (qui était l'ancien agent.id)
            if (!agentDisplayInfos[agentKey]) {
                console.warn(`Agent avec la clé '${agentKey}' trouvé dans /api/planning mais pas dans la liste des agents ou non mappable.`);
                continue; // Important de continuer pour ne pas bloquer le reste
            }
            const weeks = Object.keys(planningData[agentKey]);
            weeks.forEach(w => allWeeksSet.add(w));
        }

        if (allWeeksSet.size === 0) {
            allWeeksSet.add(`week-${getCurrentWeek()}`);
        }

        updateWeekSelector(allWeeksSet); // Met à jour le sélecteur de semaine
        showDay(currentDay); // Affiche le planning pour le jour actuel

    } catch (e) {
        console.error("Erreur lors du chargement ou de l'affichage du planning :", e);
        adminInfo.textContent = "Erreur lors du chargement du planning global. Veuillez réessayer.";
        adminInfo.style.backgroundColor = "#ffe6e6";
        adminInfo.style.borderColor = "#e6a4a4";
        adminInfo.style.color = "#a94442";
        planningData = {}; // Réinitialise les données du planning en cas d'erreur
    } finally {
        showLoading(false);
    }
}

// Met à jour les options du sélecteur de semaine
function updateWeekSelector(availableWeeks) {
    weekSelect.innerHTML = "";
    const sortedWeeks = Array.from(availableWeeks).sort((a, b) => {
        return parseInt(a.split("-")[1]) - parseInt(b.split("-")[1]);
    });

    sortedWeeks.forEach(weekKey => {
        const opt = document.createElement("option");
        opt.value = weekKey;
        const weekNum = parseInt(weekKey.split("-")[1]);
        const dateRange = getWeekDateRange(weekNum);
        opt.textContent = `Semaine ${weekNum} (${dateRange})`;
        weekSelect.appendChild(opt);
    });

    // Sélectionne la semaine actuelle si elle existe, sinon la première semaine disponible
    if (sortedWeeks.includes(`week-${currentWeek}`)) {
        weekSelect.value = `week-${currentWeek}`;
    } else if (sortedWeeks.length > 0) {
        weekSelect.value = sortedWeeks[0];
        currentWeek = parseInt(sortedWeeks[0].split("-")[1]);
    } else {
        // Si aucune semaine n'est disponible (aucun planning), ajoute la semaine actuelle
        const currentWeekKey = `week-${getCurrentWeek()}`;
        const opt = document.createElement("option");
        opt.value = currentWeekKey;
        const dateRange = getWeekDateRange(getCurrentWeek());
        opt.textContent = `Semaine ${getCurrentWeek()} (${dateRange})`;
        weekSelect.appendChild(opt);
        weekSelect.value = currentWeekKey;
        currentWeek = getCurrentWeek();
    }

    // MODIFICATION: Vider le contenu de dateRangeDisplay pour enlever les dates redondantes
    dateRangeDisplay.textContent = "";
}

// Affiche le planning pour le jour sélectionné
function showDay(day) {
    currentDay = day;
    tabButtons.forEach(tab => {
        tab.classList.toggle("active", tab.dataset.day === day);
    });

    planningContainer.innerHTML = ""; // Vide le planning existant

    const table = document.createElement("table");
    table.className = "planning-table";

    // Header (créneaux horaires)
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");

    const thAgent = document.createElement("th");
    thAgent.textContent = "Agent";
    headerRow.appendChild(thAgent);

    const allTimeSlots = [];
    // Génère les créneaux horaires de 07:00 à 07:00 du jour suivant
    const startHour = 7; // Heure de début
    for (let i = 0; i < 48; i++) { // 48 créneaux de 30 minutes = 24 heures
        const currentSlotHour = (startHour + Math.floor(i / 2)) % 24;
        const currentSlotMinute = (i % 2) * 30;

        const endSlotHour = (startHour + Math.floor((i + 1) / 2)) % 24;
        const endSlotMinute = ((i + 1) % 2) * 30;

        const slotString = `${String(currentSlotHour).padStart(2, '0')}:${String(currentSlotMinute).padStart(2, '0')} - ${String(endSlotHour).padStart(2, '0')}:${String(endSlotMinute).padStart(2, '0')}`;
        allTimeSlots.push(slotString);

        const th = document.createElement("th");
        if (currentSlotMinute === 0) { // Regroupe 00:00-00:30 et 00:30-01:00 sous une entête 00:00
            th.textContent = `${String(currentSlotHour).padStart(2, '0')}:00`;
            th.colSpan = 2; // S'étend sur deux colonnes (00 et 30 minutes)
        } else {
            th.style.display = "none"; // Cache la deuxième colonne du créneau horaire
        }
        headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Body (planning par agent)
    const tbody = document.createElement("tbody");

    const weekKey = `week-${currentWeek}`;

    // Récupère les IDs des agents à partir de agentDisplayInfos et les trie
    const sortedAgentIds = Object.keys(agentDisplayInfos).sort();

    if (sortedAgentIds.length === 0) {
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = 1 + allTimeSlots.length;
        td.textContent = "Aucun agent ou planning disponible.";
        tr.appendChild(td);
        tbody.appendChild(tr);
    } else {
        sortedAgentIds.forEach(agentId => {
            // L'agentId ici est l'agent._id (ex: 'bruneaum')
            const slots = planningData[agentId]?.[weekKey]?.[day] || []; // Récupère les créneaux de l'agent pour ce jour
            const agentInfo = agentDisplayInfos[agentId]; // Récupère le nom/prénom

            const tr = document.createElement("tr");
            const tdAgent = document.createElement("td");
            // S'assurer que agentInfo n'est pas undefined
            if (agentInfo) {
                tdAgent.textContent = `${agentInfo.prenom} ${agentInfo.nom}`; // Affiche Prénom Nom
            } else {
                tdAgent.textContent = `Agent ID: ${agentId} (Nom inconnu)`; // Fallback si info manquante
            }
            tr.appendChild(tdAgent);

            allTimeSlots.forEach(slotString => {
                const td = document.createElement("td");
                td.classList.add('slot-cell');
                td.setAttribute("data-time", slotString);
                if (slots.includes(slotString)) {
                    td.classList.add('occupied'); // Marque la cellule comme occupée
                }
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
    }

    table.appendChild(tbody);
    planningContainer.appendChild(table);

    // Réinitialise le message d'info si tout va bien
    adminInfo.textContent = "Vue du planning global des agents.";
    adminInfo.style.backgroundColor = "";
    adminInfo.style.borderColor = "";
    adminInfo.style.color = "";
}


// --- Fonctions d'Export PDF ---
async function exportPdf() {
    const container = document.getElementById("global-planning");
    const table = container.querySelector('.planning-table');

    if (!table) {
        console.warn("La table de planning est introuvable. Impossible d'exporter.");
        return;
    }

    // Stocke les styles originaux
    const originalContainerOverflowX = container.style.overflowX;
    const originalTableWhiteSpace = table.style.whiteSpace;

    showLoading(true, true);

    try {
        container.style.overflowX = "visible";
        table.style.whiteSpace = "nowrap";

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

        const canvas = await html2canvas(table, {
            scale: 2, // Augmente l'échelle pour une meilleure qualité d'image dans le PDF
            scrollY: -window.scrollY,
            useCORS: true,
            allowTaint: true,
            // background: '#ffffff',
            // logging: true
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
        let pdfWidth = pageWidth - 2 * margin;
        let pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

        if (pdfHeight > pageHeight - (2 * margin + 30)) {
            pdfHeight = pageHeight - (2 * margin + 30);
            pdfWidth = (imgProps.width * pdfHeight) / imgProps.height;
        }

        const x = (pageWidth - pdfWidth) / 2;
        const y = margin + 25;

        pdf.setFontSize(18);
        pdf.text(title, margin, margin + 5);
        pdf.setFontSize(14);
        pdf.text(`Jour : ${currentDay.charAt(0).toUpperCase() + currentDay.slice(1)}`, margin, margin + 12);

        if (canvas.width > pageWidth * 2) { // Si l'image est très large, indiquer une potentielle compression
            pdf.setFontSize(8);
            pdf.setTextColor(100);
            pdf.text("Note: Le planning a été ajusté pour tenir sur la page. Certains détails peuvent apparaître plus petits.", margin, margin + 18);
            pdf.setTextColor(0);
        }

        pdf.addImage(imgData, "PNG", x, y, pdfWidth, pdfHeight);
        pdf.save(`planning_${currentDay}_semaine${currentWeek}.pdf`);
        console.log("Le PDF a été généré avec succès !");

    } catch (error) {
        console.error("Erreur lors de l'export PDF:", error);
        console.error("Une erreur est survenue lors de la génération du PDF. Veuillez réessayer ou contacter l'administrateur. Détails: " + error.message);
    } finally {
        container.style.overflowX = originalContainerOverflowX;
        table.style.whiteSpace = originalTableWhiteSpace;
        showLoading(false, true);
    }
}


// --- Fonctions de gestion des qualifications (Frontend) ---

// Fonction pour charger la liste de toutes les qualifications possibles depuis le serveur
async function loadAvailableQualifications() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/qualifications`, {
            headers: { 'X-User-Role': 'admin' }
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'Erreur lors du chargement des qualifications disponibles.');
        }
        availableQualifications = data;
        console.log('Qualifications disponibles chargées:', availableQualifications);
    } catch (error) {
        console.error('Erreur de chargement des qualifications:', error);
        if (qualificationsMessage) {
            qualificationsMessage.textContent = `Erreur de chargement des qualifications: ${error.message}`;
            qualificationsMessage.style.color = 'red';
        }
    }
}

// Fonction pour générer les cases à cocher des qualifications pour le formulaire d'ajout d'agent
function renderNewAgentQualificationsCheckboxes() {
    if (!newAgentQualificationsCheckboxes) return;

    newAgentQualificationsCheckboxes.innerHTML = '';
    if (availableQualifications.length === 0) {
        newAgentQualificationsCheckboxes.textContent = 'Aucune qualification disponible. Ajoutez-en d\'abord via la gestion des qualifications.';
        return;
    }

    availableQualifications.forEach(qualification => {
        const checkboxContainer = document.createElement('div');
        // Pas de classes Tailwind, on s'appuie sur le CSS
        // checkboxContainer.classList.add('flex', 'items-center');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `new-qual-${qualification.id}`;
        checkbox.value = qualification.id;
        // Pas de classes Tailwind
        // checkbox.classList.add('form-checkbox', 'h-4', 'w-4', 'text-blue-600', 'rounded', 'border-gray-300', 'focus:ring-blue-500');

        const label = document.createElement('label');
        label.htmlFor = `new-qual-${qualification.id}`;
        label.textContent = qualification.name;
        // Pas de classes Tailwind
        // label.classList.add('ml-2', 'text-gray-700', 'text-sm');

        checkboxContainer.appendChild(checkbox);
        checkboxContainer.appendChild(label);
        newAgentQualificationsCheckboxes.appendChild(checkboxContainer);
    });
}

// Fonction pour générer les cases à cocher des qualifications dans la modale de modification d'agent
function renderQualificationsCheckboxes(agentQualifications = []) {
    if (!qualificationsCheckboxesDiv) return;

    qualificationsCheckboxesDiv.innerHTML = '';
    if (availableQualifications.length === 0) {
        qualificationsCheckboxesDiv.textContent = 'Aucune qualification disponible.';
        if (qualificationsMessage) {
             qualificationsMessage.textContent = 'Veuillez ajouter des qualifications via l\'administration.';
             qualificationsMessage.style.color = 'orange';
        }
        return;
    }

    availableQualifications.forEach(qualification => {
        const checkboxContainer = document.createElement('div');
        // Pas de classes Tailwind
        // checkboxContainer.classList.add('flex', 'items-center');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `edit-qual-${qualification.id}`;
        checkbox.value = qualification.id;
        checkbox.checked = agentQualifications.includes(qualification.id);
        // Pas de classes Tailwind
        // checkbox.classList.add('form-checkbox', 'h-4', 'w-4', 'text-blue-600', 'rounded', 'border-gray-300', 'focus:ring-blue-500');

        const label = document.createElement('label');
        label.htmlFor = `edit-qual-${qualification.id}`;
        label.textContent = qualification.name;
        // Pas de classes Tailwind
        // label.classList.add('ml-2', 'text-gray-700', 'text-sm');

        checkboxContainer.appendChild(checkbox);
        checkboxContainer.appendChild(label);
        qualificationsCheckboxesDiv.appendChild(checkboxContainer);
    });
    if (qualificationsMessage) {
        qualificationsMessage.textContent = ''; // Clear message if qualifications are loaded
    }
}

// --- Fonctions de gestion des grades (Frontend - Nouveau) ---

async function loadAvailableGrades() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/grades`, {
            headers: { 'X-User-Role': 'admin' }
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'Erreur lors du chargement des grades disponibles.');
        }
        availableGrades = data;
        console.log('Grades disponibles chargés:', availableGrades);
    } catch (error) {
        console.error('Erreur de chargement des grades:', error);
        if (gradesMessage) {
            gradesMessage.textContent = `Erreur de chargement des grades: ${error.message}`;
            gradesMessage.style.color = 'red';
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
        if (gradesMessage) {
             gradesMessage.textContent = 'Veuillez ajouter des grades via l\'administration.';
             gradesMessage.style.color = 'orange';
        }
        return;
    }

    availableGrades.forEach(grade => {
        const checkboxContainer = document.createElement('div');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `edit-grade-${grade.id}`;
        checkbox.value = grade.id;
        checkbox.checked = agentGrades.includes(grade.id);

        const label = document.createElement('label');
        label.htmlFor = `edit-grade-${grade.id}`;
        label.textContent = grade.name;

        checkboxContainer.appendChild(checkbox);
        checkboxContainer.appendChild(label);
        gradesCheckboxesDiv.appendChild(checkboxContainer);
    });
    if (gradesMessage) {
        gradesMessage.textContent = '';
    }
}

// --- Fonctions de gestion des fonctions (Frontend - Nouveau) ---

async function loadAvailableFunctions() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/functions`, {
            headers: { 'X-User-Role': 'admin' }
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'Erreur lors du chargement des fonctions disponibles.');
        }
        availableFunctions = data;
        console.log('Fonctions disponibles chargées:', availableFunctions);
    } catch (error) {
        console.error('Erreur de chargement des fonctions:', error);
        if (functionsMessage) {
            functionsMessage.textContent = `Erreur de chargement des fonctions: ${error.message}`;
            functionsMessage.style.color = 'red';
        }
    }
}

function renderNewAgentFunctionsCheckboxes() {
    if (!newAgentFunctionsCheckboxes) return;

    newAgentFunctionsCheckboxes.innerHTML = '';
    if (availableFunctions.length === 0) {
        newAgentFunctionsCheckboxes.textContent = 'Aucune fonction disponible. Ajoutez-en d\'abord via la gestion des fonctions.';
        return;
    }

    availableFunctions.forEach(func => {
        const checkboxContainer = document.createElement('div');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `new-func-${func.id}`;
        checkbox.value = func.id;

        const label = document.createElement('label');
        label.htmlFor = `new-func-${func.id}`;
        label.textContent = func.name;

        checkboxContainer.appendChild(checkbox);
        checkboxContainer.appendChild(label);
        newAgentFunctionsCheckboxes.appendChild(checkboxContainer);
    });
}

function renderFunctionsCheckboxes(agentFunctions = []) {
    if (!functionsCheckboxesDiv) return;

    functionsCheckboxesDiv.innerHTML = '';
    if (availableFunctions.length === 0) {
        functionsCheckboxesDiv.textContent = 'Aucune fonction disponible.';
        if (functionsMessage) {
             functionsMessage.textContent = 'Veuillez ajouter des fonctions via l\'administration.';
             functionsMessage.style.color = 'orange';
        }
        return;
    }

    availableFunctions.forEach(func => {
        const checkboxContainer = document.createElement('div');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `edit-func-${func.id}`;
        checkbox.value = func.id;
        checkbox.checked = agentFunctions.includes(func.id);

        const label = document.createElement('label');
        label.htmlFor = `edit-func-${func.id}`;
        label.textContent = func.name;

        checkboxContainer.appendChild(checkbox);
        checkboxContainer.appendChild(label);
        functionsCheckboxesDiv.appendChild(checkboxContainer);
    });
    if (functionsMessage) {
        functionsMessage.textContent = '';
    }
}


// --- Fonctions CRUD pour les agents (Backend) ---

async function loadAgents() {
    listAgentsMessage.textContent = 'Chargement des agents...';
    listAgentsMessage.style.color = 'blue';
    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/agents`, {
            headers: {
                'X-User-Role': 'admin'
            }
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Erreur lors du chargement des agents.');
        }

        agentsTableBody.innerHTML = '';
        if (data.length === 0) {
            agentsTableBody.innerHTML = '<tr><td colspan="7">Aucun agent enregistré pour le moment.</td></tr>'; // Colspan ajusté pour 7 colonnes (ID, Nom, Prénom, Qualifs, Grades, Fonctions, Actions)
        } else {
            data.forEach(agent => {
                const row = agentsTableBody.insertRow();
                // Afficher les qualifications dans la table
                const qualNames = (agent.qualifications || [])
                                    .map(id => {
                                        const qual = availableQualifications.find(q => q.id === id);
                                        return qual ? qual.name : id;
                                    })
                                    .join(', ');

                // Afficher les grades dans la table (Nouveau)
                const gradeNames = (agent.grades || [])
                                    .map(id => {
                                        const grade = availableGrades.find(g => g.id === id);
                                        return grade ? grade.name : id;
                                    })
                                    .join(', ');

                // Afficher les fonctions dans la table (Nouveau)
                const functionNames = (agent.functions || [])
                                    .map(id => {
                                        const func = availableFunctions.find(f => f.id === id);
                                        return func ? func.name : id;
                                    })
                                    .join(', ');

                row.innerHTML = `
                    <td>${agent._id}</td>
                    <td>${agent.nom}</td>
                    <td>${agent.prenom}</td>
                    <td>${qualNames}</td>
                    <td>${gradeNames}</td>
                    <td>${functionNames}</td>
                    <td>
                        <button class="edit-btn btn-secondary"
                            data-id="${agent._id}"
                            data-nom="${agent.nom}"
                            data-prenom="${agent.prenom}"
                            data-qualifications='${JSON.stringify(agent.qualifications || [])}'
                            data-grades='${JSON.stringify(agent.grades || [])}'
                            data-functions='${JSON.stringify(agent.functions || [])}'>Modifier</button>
                        <button class="delete-btn btn-danger" data-id="${agent._id}">Supprimer</button>
                    </td>
                `;
            });
        }
        listAgentsMessage.textContent = '';
    } catch (error) {
        console.error('Erreur de chargement des agents:', error);
        listAgentsMessage.textContent = `Erreur : ${error.message}`;
        listAgentsMessage.style.color = 'red';
        agentsTableBody.innerHTML = '<tr><td colspan="7">Impossible de charger la liste des agents.</td></tr>'; // Colspan ajusté
    }
}

async function handleAddAgent(event) {
    event.preventDefault();
    const id = document.getElementById('newAgentId').value.trim();
    const nom = document.getElementById('newAgentNom').value.trim();
    const prenom = document.getElementById('newAgentPrenom').value.trim();
    const password = document.getElementById('newAgentPassword').value.trim();

    // Récupérer les qualifications sélectionnées pour le nouvel agent
    const selectedQualifications = Array.from(newAgentQualificationsCheckboxes.querySelectorAll('input[type="checkbox"]:checked'))
                                       .map(checkbox => checkbox.value);
    // Récupérer les grades sélectionnés (Nouveau)
    const selectedGrades = Array.from(newAgentGradesCheckboxes.querySelectorAll('input[type="checkbox"]:checked'))
                                       .map(checkbox => checkbox.value);
    // Récupérer les fonctions sélectionnées (Nouveau)
    const selectedFunctions = Array.from(newAgentFunctionsCheckboxes.querySelectorAll('input[type="checkbox"]:checked'))
                                       .map(checkbox => checkbox.value);

    addAgentMessage.textContent = 'Ajout en cours...';
    addAgentMessage.style.color = 'blue';

    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/agents`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-Role': 'admin'
            },
            body: JSON.stringify({ id, nom, prenom, password, qualifications: selectedQualifications, grades: selectedGrades, functions: selectedFunctions })
        });
        const data = await response.json();

        if (response.ok) {
            addAgentMessage.textContent = data.message;
            addAgentMessage.style.color = 'green';
            addAgentForm.reset();
            // Réinitialiser les checkboxes après l'ajout
            newAgentQualificationsCheckboxes.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
            newAgentGradesCheckboxes.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false); // Nouveau
            newAgentFunctionsCheckboxes.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false); // Nouveau
            loadAgents(); // Recharger la liste
        } else {
            addAgentMessage.textContent = `Erreur : ${data.message}`;
            addAgentMessage.style.color = 'red';
        }
    } catch (error) {
        console.error('Erreur lors de l\'ajout de l\'agent:', error);
        addAgentMessage.textContent = 'Erreur réseau lors de l\'ajout de l\'agent.';
        addAgentMessage.style.color = 'red';
    }
}

async function handleAgentActions(event) {
    const target = event.target;
    // MISE À JOUR 4 dans admin.js : Récupérer l'ID de l'agent depuis 'data-id'
    // Le data-id est maintenant 'agent._id' grâce à la MISE À JOUR 3
    const agentId = target.dataset.id;

    if (!agentId) {
        console.error("Agent ID non trouvé pour l'action.");
        return;
    }

    if (target.classList.contains('edit-btn')) {
        editAgentId.value = agentId; // Ceci devrait maintenant être l'ID correct de l'agent (ex: "bruneaum")
        editAgentNom.value = target.dataset.nom;
        editAgentPrenom.value = target.dataset.prenom;
        editAgentNewPassword.value = '';
        editAgentMessage.textContent = '';

        // Récupérer les qualifications, grades et fonctions de l'agent depuis le dataset
        const agentQualifications = JSON.parse(target.dataset.qualifications || '[]');
        const agentGrades = JSON.parse(target.dataset.grades || '[]'); // Nouveau
        const agentFunctions = JSON.parse(target.dataset.functions || '[]'); // Nouveau

        renderQualificationsCheckboxes(agentQualifications); // Remplir les checkboxes
        renderGradesCheckboxes(agentGrades); // Nouveau: Remplir les checkboxes de grades
        renderFunctionsCheckboxes(agentFunctions); // Nouveau: Remplir les checkboxes de fonctions

        editAgentModal.style.display = 'block';
    } else if (target.classList.contains('delete-btn')) {
        // Confirmation avec l'utilisateur
        if (confirm(`Êtes-vous sûr de vouloir supprimer l'agent ${agentId} ?`)) {
            try {
                const response = await fetch(`${API_BASE_URL}/api/admin/agents/${agentId}`, {
                    method: 'DELETE',
                    headers: {
                        'X-User-Role': 'admin'
                    }
                });
                const data = await response.json();

                if (response.ok) {
                    console.log(data.message);
                    loadAgents(); // Recharger la liste
                } else {
                    console.error(`Erreur lors de la suppression : ${data.message}`);
                }
            } catch (error) {
                console.error('Erreur lors de la suppression de l\'agent:', error);
                console.error('Erreur réseau lors de la suppression de l\'agent.');
            }
        }
    }
}

async function handleEditAgent(event) {
    event.preventDefault();
    const id = editAgentId.value.trim(); // L'ID ici est correct car il vient du data-id de la ligne.
    const nom = editAgentNom.value.trim();
    const prenom = editAgentPrenom.value.trim();
    const newPassword = editAgentNewPassword.value.trim();

    // Récupérer les qualifications sélectionnées
    const selectedQualifications = Array.from(qualificationsCheckboxesDiv.querySelectorAll('input[type="checkbox"]:checked'))
                                       .map(checkbox => checkbox.value);
    // Récupérer les grades sélectionnés (Nouveau)
    const selectedGrades = Array.from(gradesCheckboxesDiv.querySelectorAll('input[type="checkbox"]:checked'))
                                       .map(checkbox => checkbox.value);
    // Récupérer les fonctions sélectionnées (Nouveau)
    const selectedFunctions = Array.from(functionsCheckboxesDiv.querySelectorAll('input[type="checkbox"]:checked'))
                                       .map(checkbox => checkbox.value);


    editAgentMessage.textContent = 'Mise à jour en cours...';
    editAgentMessage.style.color = 'blue';

    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/agents/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-User-Role': 'admin'
            },
            body: JSON.stringify({ nom, prenom, newPassword, qualifications: selectedQualifications, grades: selectedGrades, functions: selectedFunctions })
        });
        const data = await response.json();

        if (response.ok) {
            editAgentMessage.textContent = data.message;
            editAgentMessage.style.color = 'green';
            loadAgents(); // Recharger la liste des agents
            // editAgentModal.style.display = 'none'; // Optionnel: fermer la modale après succès
        } else {
            editAgentMessage.textContent = `Erreur : ${data.message}`;
            editAgentMessage.style.color = 'red';
        }
    } catch (error) {
        console.error('Erreur lors de la mise à jour de l\'agent:', error);
        editAgentMessage.textContent = 'Erreur réseau lors de la mise à jour de l\'agent.';
        editAgentMessage.style.color = 'red';
    }
}

// --- Fonctions CRUD pour la gestion des qualifications (Nouveau) ---

async function loadQualificationsList() {
    listQualificationsMessage.textContent = 'Chargement des qualifications...';
    listQualificationsMessage.style.color = 'blue';
    try {
        const response = await fetch(`${API_BASE_URL}/api/qualifications`, {
            headers: { 'X-User-Role': 'admin' }
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Erreur lors du chargement des qualifications.');
        }

        qualificationsTableBody.innerHTML = '';
        if (data.length === 0) {
            qualificationsTableBody.innerHTML = '<tr><td colspan="3">Aucune qualification enregistrée pour le moment.</td></tr>';
        } else {
            data.forEach(qual => {
                const row = qualificationsTableBody.insertRow();
                row.innerHTML = `
                    <td>${qual.id}</td>
                    <td>${qual.name}</td>
                    <td>
                        <button class="edit-btn btn-secondary" data-id="${qual.id}" data-name="${qual.name}">Modifier</button>
                        <button class="delete-btn btn-danger" data-id="${qual.id}">Supprimer</button>
                    </td>
                `;
            });
        }
        listQualificationsMessage.textContent = '';
    } catch (error) {
        console.error('Erreur de chargement des qualifications:', error);
        listQualificationsMessage.textContent = `Erreur : ${error.message}`;
        listQualificationsMessage.style.color = 'red';
        qualificationsTableBody.innerHTML = '<tr><td colspan="3">Impossible de charger la liste des qualifications.</td></tr>';
    }
}

async function handleAddQualification(event) {
    event.preventDefault();
    const id = document.getElementById('newQualId').value.trim();
    const name = document.getElementById('newQualName').value.trim();

    addQualificationMessage.textContent = 'Ajout en cours...';
    addQualificationMessage.style.color = 'blue';

    try {
        const response = await fetch(`${API_BASE_URL}/api/qualifications`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-Role': 'admin'
            },
            body: JSON.stringify({ id, name })
        });
        const data = await response.json();

        if (response.ok) {
            addQualificationMessage.textContent = data.message;
            addQualificationMessage.style.color = 'green';
            addQualificationForm.reset();
            await loadAvailableQualifications(); // Recharger la liste des qualifications disponibles
            await loadQualificationsList(); // Recharger la liste affichée dans la table
            renderNewAgentQualificationsCheckboxes(); // Mettre à jour les checkboxes d'agent
        } else {
            addQualificationMessage.textContent = `Erreur : ${data.message}`;
            addQualificationMessage.style.color = 'red';
        }
    } catch (error) {
        console.error('Erreur lors de l\'ajout de la qualification:', error);
        addQualificationMessage.textContent = 'Erreur réseau lors de l\'ajout de la qualification.';
        addQualificationMessage.style.color = 'red';
    }
}

async function handleQualificationActions(event) {
    const target = event.target;
    const qualId = target.dataset.id;

    if (!qualId) return;

    if (target.classList.contains('edit-btn')) {
        editQualId.value = qualId;
        editQualName.value = target.dataset.name;
        editQualMessage.textContent = '';
        editQualificationModal.style.display = 'block';
    } else if (target.classList.contains('delete-btn')) {
        if (confirm(`Êtes-vous sûr de vouloir supprimer la qualification "${qualId}" ? Cela la retirera aussi des agents qui la possèdent.`)) {
            try {
                const response = await fetch(`${API_BASE_URL}/api/qualifications/${qualId}`, {
                    method: 'DELETE',
                    headers: { 'X-User-Role': 'admin' }
                });
                const data = await response.json();

                if (response.ok) {
                    console.log(data.message);
                    await loadAvailableQualifications(); // Recharger la liste des qualifications disponibles
                    await loadQualificationsList(); // Recharger la liste affichée dans la table
                    renderNewAgentQualificationsCheckboxes(); // Mettre à jour les checkboxes d'agent
                    loadAgents(); // Recharger la liste des agents pour refléter les suppressions
                } else {
                    console.error(`Erreur lors de la suppression : ${data.message}`);
                }
            } catch (error) {
                console.error('Erreur lors de la suppression de la qualification:', error);
                console.error('Erreur réseau lors de la suppression de la qualification.');
            }
        }
    }
}

async function handleEditQualification(event) {
    event.preventDefault();
    const id = editQualId.value.trim();
    const name = editQualName.value.trim();

    editQualMessage.textContent = 'Mise à jour en cours...';
    editQualMessage.style.color = 'blue';

    try {
        const response = await fetch(`${API_BASE_URL}/api/qualifications/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-User-Role': 'admin'
            },
            body: JSON.stringify({ name })
        });
        const data = await response.json();

        if (response.ok) {
            editQualMessage.textContent = data.message;
            editQualMessage.style.color = 'green';
            await loadAvailableQualifications();
            await loadQualificationsList();
            renderNewAgentQualificationsCheckboxes();
            loadAgents(); // Refresh agents list to update displayed qualification names
            // editQualificationModal.style.display = 'none';
        } else {
            editQualMessage.textContent = `Erreur : ${data.message}`;
            editQualMessage.style.color = 'red';
        }
    } catch (error) {
        console.error('Erreur lors de la mise à jour de la qualification:', error);
        editQualMessage.textContent = 'Erreur réseau lors de la mise à jour de la qualification.';
        editQualMessage.style.color = 'red';
    }
}

// --- Fonctions CRUD pour la gestion des grades (Nouveau) ---

async function loadGradesList() {
    listGradesMessage.textContent = 'Chargement des grades...';
    listGradesMessage.style.color = 'blue';
    try {
        const response = await fetch(`${API_BASE_URL}/api/grades`, {
            headers: { 'X-User-Role': 'admin' }
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
        listGradesMessage.textContent = '';
    } catch (error) {
        console.error('Erreur de chargement des grades:', error);
        listGradesMessage.textContent = `Erreur : ${error.message}`;
        listGradesMessage.style.color = 'red';
        gradesTableBody.innerHTML = '<tr><td colspan="3">Impossible de charger la liste des grades.</td></tr>';
    }
}

async function handleAddGrade(event) {
    event.preventDefault();
    const id = document.getElementById('newGradeId').value.trim();
    const name = document.getElementById('newGradeName').value.trim();

    addGradeMessage.textContent = 'Ajout en cours...';
    addGradeMessage.style.color = 'blue';

    try {
        const response = await fetch(`${API_BASE_URL}/api/grades`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-Role': 'admin'
            },
            body: JSON.stringify({ id, name })
        });
        const data = await response.json();

        if (response.ok) {
            addGradeMessage.textContent = data.message;
            addGradeMessage.style.color = 'green';
            addGradeForm.reset();
            await loadAvailableGrades();
            await loadGradesList();
            renderNewAgentGradesCheckboxes(); // Mettre à jour les checkboxes d'agent
        } else {
            addGradeMessage.textContent = `Erreur : ${data.message}`;
            addGradeMessage.style.color = 'red';
        }
    } catch (error) {
        console.error('Erreur lors de l\'ajout du grade:', error);
        addGradeMessage.textContent = 'Erreur réseau lors de l\'ajout du grade.';
        addGradeMessage.style.color = 'red';
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
                    headers: { 'X-User-Role': 'admin' }
                });
                const data = await response.json();

                if (response.ok) {
                    console.log(data.message);
                    await loadAvailableGrades();
                    await loadGradesList();
                    renderNewAgentGradesCheckboxes();
                    loadAgents(); // Recharger la liste des agents pour refléter les suppressions
                } else {
                    console.error(`Erreur lors de la suppression : ${data.message}`);
                }
            } catch (error) {
                console.error('Erreur lors de la suppression du grade:', error);
                console.error('Erreur réseau lors de la suppression du grade.');
            }
        }
    }
}

async function handleEditGrade(event) {
    event.preventDefault();
    const id = editGradeId.value.trim();
    const name = editGradeName.value.trim();

    editGradeMessage.textContent = 'Mise à jour en cours...';
    editGradeMessage.style.color = 'blue';

    try {
        const response = await fetch(`${API_BASE_URL}/api/grades/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-User-Role': 'admin'
            },
            body: JSON.stringify({ name })
        });
        const data = await response.json();

        if (response.ok) {
            editGradeMessage.textContent = data.message;
            editGradeMessage.style.color = 'green';
            await loadAvailableGrades();
            await loadGradesList();
            renderNewAgentGradesCheckboxes();
            loadAgents(); // Refresh agents list to update displayed grade names
            // editGradeModal.style.display = 'none';
        } else {
            editGradeMessage.textContent = `Erreur : ${data.message}`;
            editGradeMessage.style.color = 'red';
        }
    } catch (error) {
        console.error('Erreur lors de la mise à jour du grade:', error);
        editGradeMessage.textContent = 'Erreur réseau lors de la mise à jour du grade.';
        editGradeMessage.style.color = 'red';
    }
}


// --- Fonctions CRUD pour la gestion des fonctions (Nouveau) ---

async function loadFunctionsList() {
    listFunctionsMessage.textContent = 'Chargement des fonctions...';
    listFunctionsMessage.style.color = 'blue';
    try {
        const response = await fetch(`${API_BASE_URL}/api/functions`, {
            headers: { 'X-User-Role': 'admin' }
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Erreur lors du chargement des fonctions.');
        }

        functionsTableBody.innerHTML = '';
        if (data.length === 0) {
            functionsTableBody.innerHTML = '<tr><td colspan="3">Aucune fonction enregistrée pour le moment.</td></tr>';
        } else {
            data.forEach(func => {
                const row = functionsTableBody.insertRow();
                row.innerHTML = `
                    <td>${func.id}</td>
                    <td>${func.name}</td>
                    <td>
                        <button class="edit-btn btn-secondary" data-id="${func.id}" data-name="${func.name}">Modifier</button>
                        <button class="delete-btn btn-danger" data-id="${func.id}">Supprimer</button>
                    </td>
                `;
            });
        }
        listFunctionsMessage.textContent = '';
    } catch (error) {
        console.error('Erreur de chargement des fonctions:', error);
        listFunctionsMessage.textContent = `Erreur : ${error.message}`;
        listFunctionsMessage.style.color = 'red';
        functionsTableBody.innerHTML = '<tr><td colspan="3">Impossible de charger la liste des fonctions.</td></tr>';
    }
}

async function handleAddFunction(event) {
    event.preventDefault();
    const id = document.getElementById('newFunctionId').value.trim();
    const name = document.getElementById('newFunctionName').value.trim();

    addFunctionMessage.textContent = 'Ajout en cours...';
    addFunctionMessage.style.color = 'blue';

    try {
        const response = await fetch(`${API_BASE_URL}/api/functions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-Role': 'admin'
            },
            body: JSON.stringify({ id, name })
        });
        const data = await response.json();

        if (response.ok) {
            addFunctionMessage.textContent = data.message;
            addFunctionMessage.style.color = 'green';
            addFunctionForm.reset();
            await loadAvailableFunctions();
            await loadFunctionsList();
            renderNewAgentFunctionsCheckboxes(); // Mettre à jour les checkboxes d'agent
        } else {
            addFunctionMessage.textContent = `Erreur : ${data.message}`;
            addFunctionMessage.style.color = 'red';
        }
    } catch (error) {
        console.error('Erreur lors de l\'ajout de la fonction:', error);
        addFunctionMessage.textContent = 'Erreur réseau lors de l\'ajout de la fonction.';
        addFunctionMessage.style.color = 'red';
    }
}

async function handleFunctionActions(event) {
    const target = event.target;
    const functionId = target.dataset.id;

    if (!functionId) return;

    if (target.classList.contains('edit-btn')) {
        editFunctionId.value = functionId;
        editFunctionName.value = target.dataset.name;
        editFunctionMessage.textContent = '';
        editFunctionModal.style.display = 'block';
    } else if (target.classList.contains('delete-btn')) {
        if (confirm(`Êtes-vous sûr de vouloir supprimer la fonction "${functionId}" ? Cela la retirera aussi des agents qui la possèdent.`)) {
            try {
                const response = await fetch(`${API_BASE_URL}/api/functions/${functionId}`, {
                    method: 'DELETE',
                    headers: { 'X-User-Role': 'admin' }
                });
                const data = await response.json();

                if (response.ok) {
                    console.log(data.message);
                    await loadAvailableFunctions();
                    await loadFunctionsList();
                    renderNewAgentFunctionsCheckboxes();
                    loadAgents(); // Recharger la liste des agents pour refléter les suppressions
                } else {
                    console.error(`Erreur lors de la suppression : ${data.message}`);
                }
            } catch (error) {
                console.error('Erreur lors de la suppression de la fonction:', error);
                console.error('Erreur réseau lors de la suppression de la fonction.');
            }
        }
    }
}

async function handleEditFunction(event) {
    event.preventDefault();
    const id = editFunctionId.value.trim();
    const name = editFunctionName.value.trim();

    editFunctionMessage.textContent = 'Mise à jour en cours...';
    editFunctionMessage.style.color = 'blue';

    try {
        const response = await fetch(`${API_BASE_URL}/api/functions/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-User-Role': 'admin'
            },
            body: JSON.stringify({ name })
        });
        const data = await response.json();

        if (response.ok) {
            editFunctionMessage.textContent = data.message;
            editFunctionMessage.style.color = 'green';
            await loadAvailableFunctions();
            await loadFunctionsList();
            renderNewAgentFunctionsCheckboxes();
            loadAgents(); // Refresh agents list to update displayed function names
            // editFunctionModal.style.display = 'none';
        } else {
            editFunctionMessage.textContent = `Erreur : ${data.message}`;
            editFunctionMessage.style.color = 'red';
        }
    } catch (error) {
        console.error('Erreur lors de la mise à jour de la fonction:', error);
        editFunctionMessage.textContent = 'Erreur réseau lors de la mise à jour de la fonction.';
        editFunctionMessage.style.color = 'red';
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