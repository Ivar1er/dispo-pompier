// admin.js

const days = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const API_BASE_URL = "https://dispo-pompier.onrender.com";

let currentWeek; // Ex: 25 (number)
let currentDay = 'lundi'; // Jour actuel par default pour le planning
let planningData = {}; // Contiendra le planning global chargé de l'API { agentId: { week-X: { day: [slots] } } }
let agentDisplayInfos = {}; // Mapping dynamique agentId => {nom, prenom}
let availableQualifications = []; // Liste des qualifications disponibles chargée depuis l'API
let availableGrades = []; // Nouvelle: Liste des grades disponibles chargée depuis l'API

// --- DOM Elements pour la navigation principale (onglets) ---
const mainTabButtons = document.querySelectorAll('.main-tab');
const mainTabContents = document.querySelectorAll('.main-tab-content');

// --- DOM Elements pour la vue "Planning Global" ---
// ATTENTION: planningControls n'est plus dans le header, mais nous le gardons pour la logique
// de masquage/affichage dans openMainTab.
const headerPlanningControls = document.querySelector('.header-planning-controls'); // NOUVEAU CONTENEUR DANS LE HEADER
const weekSelect = document.getElementById("week-select");
const dateRangeDisplay = document.getElementById("date-range"); // Élément pour afficher la plage de dates
const planningContainer = document.getElementById("global-planning"); // Conteneur du tableau de planning
const tabButtons = document.querySelectorAll(".tab"); // Boutons de jour (Lundi, Mardi...)
const adminInfo = document.getElementById("admin-info");
// adminNameDisplay est maintenant masqué et n'est plus utilisé ici.


// --- DOM Elements pour la vue "Gestion des Agents" ---
const addAgentForm = document.getElementById('addAgentForm');
const newAgentQualificationsCheckboxes = document.getElementById('newAgentQualificationsCheckboxes');
const newAgentGradesCheckboxes = document.getElementById('newAgentGradesCheckboxes');
const addAgentMessage = document.getElementById('addAgentMessage');
const agentsTableBody = document.getElementById('agentsTableBody');
const listAgentsMessage = document.getElementById('listAgentsMessage');

// --- DOM Elements pour la Modale de modification d'agent et de qualifications ---
const editAgentModalElement = document.getElementById('editAgentModal');
const closeEditAgentModalButton = editAgentModalElement ? editAgentModalElement.querySelector('.close-button') : null;
const editAgentFormElement = document.getElementById('editAgentForm');
const editAgentId = document.getElementById('editAgentId');
const editAgentNom = document.getElementById('editAgentNom');
const editAgentPrenom = document.getElementById('editAgentPrenom');
const editAgentNewPassword = document.getElementById('editAgentNewPassword');
const editAgentMessage = document.getElementById('editAgentMessage');
const qualificationsCheckboxesDiv = document.getElementById('qualificationsCheckboxes'); // Pour la modale de modification
const gradesCheckboxesDiv = document.getElementById('gradesCheckboxes'); // Pour la modale de modification
const qualificationsMessage = document.getElementById('qualificationsMessage');
const gradesMessage = document.getElementById('gradesMessage');

// --- DOM Elements pour la vue "Gestion des Qualifications" ---
const addQualificationFormElement = document.getElementById('addQualificationForm');
const addQualificationMessage = document.getElementById('addQualificationMessage');
const qualificationsTableBody = document.getElementById('qualificationsTableBody');
const listQualificationsMessage = document.getElementById('listQualificationsMessage');
const editQualificationModalElement = document.getElementById('editQualificationModal');
const closeQualButton = editQualificationModalElement ? editQualificationModalElement.querySelector('.close-button') : null;
const editQualificationFormElement = document.getElementById('editQualificationForm');
const editQualId = document.getElementById('editQualId');
const editQualName = document.getElementById('editQualName');
const editQualMessage = document.getElementById('editQualMessage');

// --- DOM Elements pour la vue "Gestion des Grades" ---
const addGradeFormElement = document.getElementById('addGradeForm');
const addGradeMessage = document.getElementById('addGradeMessage');
const gradesTableBody = document.getElementById('gradesTableBody');
const listGradesMessage = document.getElementById('listGradesMessage');
const editGradeModalElement = document.getElementById('editGradeModal');
const closeGradeButton = editGradeModalElement ? editGradeModalElement.querySelector('.close-button') : null;
const editGradeFormElement = document.getElementById('editGradeForm');
const editGradeId = document.getElementById('editGradeId');
const editGradeName = document.getElementById('editGradeName');
const editGradeMessage = document.getElementById('editGradeMessage');

// --- Global DOM Elements ---
const loadingSpinner = document.getElementById("loading-spinner");
const logoutButton = document.getElementById("logout-btn");


// Créneaux 30 min sur 24h
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

// --- Helpers de date ---

/**
 * Calcule le numéro de semaine ISO 8601 pour une date donnée.
 * La semaine 1 est celle qui contient le premier jeudi de l'année.
 * @param {Date} date - La date pour laquelle calculer le numéro de semaine.
 * @returns {number} Le numéro de semaine ISO 8601.
 */
function getCurrentISOWeek(date = new Date()) {
    const _date = new Date(date.getTime());
    _date.setHours(0, 0, 0, 0);
    _date.setDate(_date.getDate() + 3 - ((_date.getDay() + 6) % 7));
    const week1 = new Date(_date.getFullYear(), 0, 4);
    return (
        1 +
        Math.round(
            ((_date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7
        )
    );
}

/**
 * Récupère la plage de dates (début-fin) pour un numéro de semaine ISO donné.
 * @param {number} weekNumber - Le numéro de semaine ISO.
 * @param {number} year - L'année.
 * @returns {string} La plage de dates formatée (ex: "du 16/06 au 22/06").
 */
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
  const format = date => date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
  return `du ${format(start)} au ${format(end)}`;
}


function getMondayOfWeek(weekNum, year) {
    const simple = new Date(year, 0, 1 + (weekNum - 1) * 7);
    const dow = simple.getDay();
    if (dow <= 4) simple.setDate(simple.getDate() - dow + 1);
    else simple.setDate(simple.getDate() + 8 - dow);
    return simple;
}

// Fonction pour récupérer le token JWT
function getToken() {
    return sessionStorage.getItem('token');
}

// Fonction pour obtenir les en-têtes d'autorisation
function getAuthHeaders() {
    const token = getToken();
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}


// --- Fonctions de chargement des données ---

async function fetchAgentNames() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/agents/names`);
        const data = await response.json();
        if (response.ok) {
            agentDisplayInfos = data.reduce((acc, agent) => {
                acc[agent.id] = { prenom: agent.prenom, nom: agent.nom };
                return acc;
            }, {});
        } else {
            console.error('Erreur lors du chargement des noms d\'agents:', data.message);
        }
    } catch (error) {
        console.error('Erreur réseau lors du chargement des noms d\'agents:', error);
    }
}

async function loadPlanningData() {
    showLoading(true);
    try {
        // Cette route /api/planning est maintenant modifiée côté serveur pour agréger les données
        // par semaine et par jour à partir de AGENT_AVAILABILITY_DIR
        const response = await fetch(`${API_BASE_URL}/api/planning`, {
            headers: getAuthHeaders() // Ajout des headers d'autorisation
        });
        const data = await response.json();
        if (!response.ok) {
            // Gérer spécifiquement l'erreur 403 pour donner un message plus clair à l'utilisateur
            if (response.status === 403) {
                displayMessageModal("Accès Refusé", "Vous n'avez pas l'autorisation de consulter le planning global.", "error");
            }
            throw new Error(data.message || 'Erreur lors du chargement du planning global.');
        }

        planningData = data;
        console.log("DEBUG Admin: Planning Global Chargé (Admin):", planningData); // Log pour débogage

        await fetchAgentNames();
    } catch (error) {
        console.error('Erreur lors du chargement du planning global:', error);
        planningData = {}; // S'assure que c'est un objet vide en cas d'échec
        displayMessageModal("Erreur de Chargement", `Impossible de charger le planning global : ${error.message}`, "error");
    } finally {
        showLoading(false);
    }
}

// --- Fonctions de rendu ---

function renderPlanningGrid(day) {
    if (!planningContainer) {
        console.error("Erreur DOM: L'élément 'global-planning' (planningContainer) est introuvable. Assurez-vous que l'ID est correct dans admin.html.");
        displayMessageModal("Erreur d'affichage", "Impossible d'afficher le planning. L'élément de conteneur est manquant.", "error");
        return;
    }
    planningContainer.innerHTML = ''; // Efface le contenu précédent

    const table = document.createElement('table');
    table.classList.add('global-planning-table');

    // En-tête (Créneaux Horaires)
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headerRow.innerHTML = '<th class="agent-header-cell">Agent</th>'; // Première colonne pour le Nom de l'Agent

    // Génération des en-têtes d'heure (07h, 08h, etc.) qui s'étendent sur 2x30min
    for (let h = 7; h < 24; h++) { // De 7h à 23h
        const th = document.createElement('th');
        th.textContent = `${String(h).padStart(2, '0')}h`;
        th.classList.add('time-header-cell');
        th.colSpan = 2; // Un en-tête d'heure couvre deux créneaux de 30min
        headerRow.appendChild(th);
    }
    // Ajouter les heures de 00h à 06h (pour boucler la journée)
    for (let h = 0; h < 7; h++) { // De 00h à 06h
        const th = document.createElement('th');
        th.textContent = `${String(h).padStart(2, '0')}h`;
        th.classList.add('time-header-cell');
        th.colSpan = 2;
        headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Corps (Lignes d'agents)
    const tbody = document.createElement('tbody');

    const weekKey = `week-${currentWeek}`;

    // Filtrer les agents pour n'afficher que ceux ayant au moins un créneau renseigné pour le jour et la semaine actuels
    const filteredAgentIds = Object.keys(agentDisplayInfos).filter(agentId => {
        const agentPlanningForDay = planningData[agentId]?.[weekKey]?.[day];
        // L'agent est affiché si :
        // 1. Il a une entrée de planning pour la semaine et le jour, ET
        // 2. Cette entrée est un tableau, ET
        // 3. Ce tableau n'est pas vide (il contient au moins un créneau)
        return Array.isArray(agentPlanningForDay) && agentPlanningForDay.length > 0;
    }).sort((a, b) => {
        // Trie les agents par nom/prénom pour un affichage cohérent
        const nameA = agentDisplayInfos[a]?.nom || '';
        const nameB = agentDisplayInfos[b]?.nom || '';
        return nameA.localeCompare(nameB);
    });

    if (filteredAgentIds.length === 0) {
        const noAgentsRow = document.createElement('tr');
        // Colspan ajusté: 1 (Agent) + (24 heures * 2 créneaux/heure) = 49
        noAgentsRow.innerHTML = `<td colspan="49">Aucun agent avec des disponibilités renseignées pour ce jour de la semaine.</td>`;
        tbody.appendChild(noAgentsRow);
    } else {
        filteredAgentIds.forEach(agentId => {
            const agentRow = document.createElement('tr');
            const agentNameCell = document.createElement('td');
            agentNameCell.classList.add('agent-name-cell');

            const agentInfo = agentDisplayInfos[agentId];
            agentNameCell.textContent = `${agentInfo.prenom} ${agentInfo.nom}`;
            agentRow.appendChild(agentNameCell);

            const agentSpecificDayPlanning = planningData[agentId]?.[weekKey]?.[day];

            horaires.forEach(timeSlot => {
                const slotCell = document.createElement('td');
                slotCell.classList.add('slot-cell');
                slotCell.setAttribute("data-time-range", timeSlot); // AJOUT: Attribut pour le tooltip

                if (agentSpecificDayPlanning && agentSpecificDayPlanning.includes(timeSlot)) {
                    slotCell.classList.add('available-slot-cell'); // Classe pour disponible (vert)
                } else {
                    slotCell.classList.add('unavailable-slot-cell'); // Classe pour indisponible (gris/rouge pâle)
                }
                // Ne pas ajouter de texte 'D' ou 'I' - la couleur suffit
                // slotCell.textContent = '';
                agentRow.appendChild(slotCell);
            });
            tbody.appendChild(agentRow);
        });
    }
    table.appendChild(tbody);
    planningContainer.appendChild(table);

    // Réinitialise le message d'info si tout va bien
    if (adminInfo) {
        adminInfo.textContent = "Vue du planning global des agents.";
        adminInfo.style.backgroundColor = "";
        adminInfo.style.borderColor = "";
        adminInfo.style.color = "";
    } else {
        console.warn("L'élément 'admin-info' est introuvable dans admin.html.");
    }
}

// Fonction pour mettre à jour l'affichage de la plage de dates
function updateDateRangeDisplay() {
    const weekNum = currentWeek;
    const currentYear = new Date().getFullYear();
    if (dateRangeDisplay) {
        dateRangeDisplay.textContent = getWeekDateRange(weekNum, currentYear);
    } else {
        console.warn("L'élément 'date-range' (dateRangeDisplay) est introuvable dans admin.html.");
    }
}

// --- Fonctions de contrôle et d'initialisation ---

function generateWeekOptions() {
    const select = document.getElementById("week-select");
    if (!select) {
        console.error("Erreur DOM: L'élément 'week-select' est introuvable. Assurez-vous que l'ID est correct dans admin.html.");
        return;
    }
    select.innerHTML = "";
    const today = new Date();
    const currentWeekNumber = getCurrentISOWeek(today);
    const currentYear = today.getFullYear();
    for (let i = -2; i < 10; i++) { // Génère quelques semaines passées et futures
        const weekNum = currentWeekNumber + i;
        const option = document.createElement("option");
        option.value = `week-${weekNum}`;
        option.textContent = `Semaine ${weekNum} (${getWeekDateRange(weekNum, currentYear)})`;
        select.appendChild(option);
    }
}

function showLoading(isLoading, forPdf = false) {
    if (!loadingSpinner) {
        console.warn("L'élément 'loading-spinner' est introuvable dans admin.html.");
        return;
    }

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
        // Cacher les contrôles de planning du header pendant le chargement
        if (headerPlanningControls) headerPlanningControls.style.display = 'none';


        if (adminInfo && forPdf) {
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

        // Afficher les contrôles de planning du header si l'onglet global est actif
        const globalPlanningView = document.getElementById('global-planning-view');
        if (globalPlanningView && globalPlanningView.classList.contains('active') && headerPlanningControls) {
            headerPlanningControls.style.display = 'flex';
        } else if (headerPlanningControls) {
            headerPlanningControls.style.display = 'none'; // S'assurer qu'il est bien caché pour les autres onglets
        }


        if (adminInfo && forPdf) {
            adminInfo.textContent = "Vue du planning global des agents.";
            adminInfo.style.backgroundColor = "";
            adminInfo.style.borderColor = "";
            adminInfo.style.color = "";
        }
    }
}

// --- Fonctions d'authentification et de déconnexion ---
function logout() {
    sessionStorage.clear();
    window.location.href = "index.html";
}

// --- Modales (remplace alert() et confirm()) ---
/**
 * Affiche une modale de message personnalisée.
 * @param {string} title - Titre de la modale.
 * @param {string} message - Message à afficher.
 * @param {'info'|'success'|'error'|'warning'|'question'} type - Type de message pour le style.
 * @param {function(boolean)} [callback] - Fonction de rappel pour les confirmations.
 */
function displayMessageModal(title, message, type = "info", callback = null) {
    let modal = document.getElementById('message-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'message-modal';
        modal.classList.add('custom-modal', 'message-modal');
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="modal-content ${type}">
            <h2 class="modal-title">${title}</h2>
            <p class="modal-message">${message}</p>
            <div class="modal-actions">
                ${callback ? '<button id="modal-cancel-btn" class="btn btn-secondary">Annuler</button>' : ''}
                <button id="modal-ok-btn" class="btn btn-primary">OK</button>
            </div>
        </div>
    `;

    modal.style.display = 'flex';

    const okBtn = modal.querySelector('#modal-ok-btn');
    okBtn.onclick = () => {
        modal.style.display = 'none';
        if (callback) callback(true);
    };

    if (callback) {
        const cancelBtn = modal.querySelector('#modal-cancel-btn');
        cancelBtn.onclick = () => {
            modal.style.display = 'none';
            callback(false);
        };
    }

    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
            if (callback) callback(false); // Cliquer en dehors annule pour les confirmations
        }
    };
}

/**
 * Fonction asynchrone pour simuler confirm() avec la modale personnalisée.
 * @param {string} message - Message de confirmation.
 * @returns {Promise<boolean>} Une promesse qui résout avec true si l'utilisateur confirme, false sinon.
 */
async function confirmModal(message) {
    return new Promise((resolve) => {
        displayMessageModal("Confirmation", message, "question", (result) => {
            resolve(result);
        });
    });
}

// Remplacement des fonctions natives alert et confirm pour utiliser les modales personnalisées
window.alert = displayMessageModal.bind(null, "Information");
window.confirm = confirmModal;


// --- Fonctions d'Export PDF ---
async function exportPdf() {
    const container = document.getElementById("global-planning");
    const table = container ? container.querySelector('.global-planning-table') : null; // Cible la nouvelle classe

    if (!table) {
        console.warn("La table de planning est introuvable. Impossible d'exporter.");
        displayMessageModal("Erreur d'Export", "La table de planning est introuvable. Assurez-vous que l'onglet 'Planning Global' est actif.", "error");
        return;
    }

    // Cache le spinner avant la capture HTML2Canvas
    const wasLoading = loadingSpinner && !loadingSpinner.classList.contains("hidden");
    if (loadingSpinner) loadingSpinner.classList.add("hidden");


    const originalContainerOverflowX = container ? container.style.overflowX : '';
    const originalTableWhiteSpace = table.style.whiteSpace;
    const originalTableLayout = table.style.tableLayout; // Sauvegarder le table-layout
    const originalHeaderCellWidths = {}; // Pour stocker les largeurs d'origine
    const headerCells = table.querySelectorAll('.time-header-cell');
    headerCells.forEach((cell, index) => {
        originalHeaderCellWidths[index] = cell.style.width;
        // Définir des largeurs absolues pour HTML2Canvas
        cell.style.width = '60px'; // 2 * 30px, ou une taille adaptée à l'impression
    });

    showLoading(true, true); // Active le spinner avec le message PDF

    try {
        if (container) container.style.overflowX = "visible";
        table.style.whiteSpace = "nowrap";
        table.style.tableLayout = "auto"; // Permettre aux colonnes de s'ajuster pour l'export

        // Attendre que le DOM se rende après les changements de style
        await new Promise(r => setTimeout(r, 200));

        const { jsPDF } = window.jspdf;

        const year = new Date().getFullYear();
        const mondayDate = getMondayOfWeek(currentWeek, year);
        const sundayDate = new Date(mondayDate);
        sundayDate.setDate(mondayDate.getDate() + 6);

        function formatDate(d) {
            return d.getDate().toString().padStart(2, '0') + '/' + (d.getMonth() + 1).toString().padStart(2, '0');
        }
        const title = `Planning Semaine ${currentWeek} du ${formatDate(mondayDate)} au ${formatDate(sundayDate)}`;

        // Utiliser une échelle plus élevée pour une meilleure qualité d'image
        const canvas = await html2canvas(table, {
            scale: 3, // Augmenter l'échelle pour une meilleure résolution PDF
            scrollY: -window.scrollY,
            useCORS: true,
            allowTaint: true,
            ignoreElements: (element) => {
                // Ignore les éléments qui ne doivent pas être capturés dans le PDF
                return element.classList.contains('loading-spinner');
            }
        });

        const imgData = canvas.toDataURL("image/png");

        const pdf = new jsPDF({
            orientation: "landscape",
            unit: "mm",
            format: "a3" // Utiliser un format plus grand pour plus de détails
        });

        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 10;

        const imgProps = pdf.getImageProperties(imgData);
        let pdfWidth = pageWidth - 2 * margin;
        let pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

        // Ajuster la hauteur si l'image est trop grande pour la page A3
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

        // Message si l'image a été réduite
        if (canvas.width > pageWidth * 2) {
            pdf.setFontSize(8);
            pdf.setTextColor(100);
            pdf.text("Note: Le planning a été ajusté pour tenir sur la page. Certains détails peuvent apparaître plus petits.", margin, margin + 18);
            pdf.setTextColor(0);
        }

        pdf.addImage(imgData, "PNG", x, y, pdfWidth, pdfHeight);
        pdf.save(`planning_${currentDay}_semaine${currentWeek}.pdf`);
        displayMessageModal("Génération PDF", "Le PDF a été généré avec succès !", "success");
        console.log("Le PDF a été généré avec succès !");

    } catch (error) {
        console.error("Erreur lors de l'export PDF:", error);
        displayMessageModal("Erreur d'Export", "Une erreur est survenue lors de la génération du PDF. Veuillez réessayer ou contacter l'administrateur. Détails: " + error.message, "error");
    } finally {
        // Restaurer les styles originaux
        if (container) container.style.overflowX = originalContainerOverflowX;
        table.style.whiteSpace = originalTableWhiteSpace;
        table.style.tableLayout = originalTableLayout; // Restaurer le table-layout
        headerCells.forEach((cell, index) => { // Restaurer les largeurs des en-têtes
            cell.style.width = originalHeaderCellWidths[index];
        });

        showLoading(false, true); // Désactive le spinner
        // Restaurer le spinner si c'était le cas avant l'export
        if (wasLoading && loadingSpinner) { // Vérifier loadingSpinner avant d'y accéder
            loadingSpinner.classList.remove("hidden");
        }
    }
}


// --- Fonctions de gestion des qualifications (Frontend) ---

async function loadAvailableQualifications() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/qualifications`, {
            headers: getAuthHeaders() // Ajout des headers d'autorisation
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

function renderNewAgentQualificationsCheckboxes() {
    if (!newAgentQualificationsCheckboxes) {
        console.warn("L'élément 'newAgentQualificationsCheckboxes' est introuvable. Impossible de rendre les checkboxes de qualifications.");
        return;
    }

    newAgentQualificationsCheckboxes.innerHTML = '';
    if (availableQualifications.length === 0) {
        newAgentQualificationsCheckboxes.textContent = 'Aucune qualification disponible. Ajoutez-en d\'abord via la gestion des qualifications.';
        return;
    }

    availableQualifications.forEach(qualification => {
        const checkboxContainer = document.createElement('div');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `new-qual-${qualification.id}`;
        checkbox.value = qualification.id;

        const label = document.createElement('label');
        label.htmlFor = `new-qual-${qualification.id}`;
        label.textContent = qualification.name;

        checkboxContainer.appendChild(checkbox);
        checkboxContainer.appendChild(label);
        newAgentQualificationsCheckboxes.appendChild(checkboxContainer);
    });
}

function renderQualificationsCheckboxes(agentQualifications = []) {
    if (!qualificationsCheckboxesDiv) {
        console.warn("L'élément 'qualificationsCheckboxesDiv' est introuvable. Impossible de rendre les checkboxes de qualifications.");
        return;
    }

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
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `edit-qual-${qualification.id}`;
        checkbox.value = qualification.id;
        checkbox.checked = agentQualifications.includes(qualification.id);

        const label = document.createElement('label');
        label.htmlFor = `edit-qual-${qualification.id}`;
        label.textContent = qualification.name;

        checkboxContainer.appendChild(checkbox);
        checkboxContainer.appendChild(label);
        qualificationsCheckboxesDiv.appendChild(checkboxContainer);
    });
    if (qualificationsMessage) {
        qualificationsMessage.textContent = '';
    }
}

// --- Fonctions de gestion des grades (Frontend) ---

async function loadAvailableGrades() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/grades`, {
            headers: getAuthHeaders() // Ajout des headers d'autorisation
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
    if (!newAgentGradesCheckboxes) {
        console.warn("L'élément 'newAgentGradesCheckboxes' est introuvable. Impossible de rendre les checkboxes de grades.");
        return;
    }

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
    if (!gradesCheckboxesDiv) {
        console.warn("L'élément 'gradesCheckboxesDiv' est introuvable. Impossible de rendre les checkboxes de grades.");
        return;
    }

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


// --- Fonctions CRUD pour les agents (Backend) ---

async function loadAgents() {
    if (!listAgentsMessage) {
        console.warn("L'élément 'listAgentsMessage' est introuvable. Impossible d'afficher le statut de chargement des agents.");
    } else {
        listAgentsMessage.textContent = 'Chargement des agents...';
        listAgentsMessage.style.color = 'blue';
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/agents`, {
            headers: getAuthHeaders() // Ajout des headers d'autorisation
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Erreur lors du chargement des agents.');
        }

        if (!agentsTableBody) {
             console.error("Erreur DOM: L'élément 'agentsTableBody' est introuvable. Impossible de rendre la table des agents.");
             displayMessageModal("Erreur d'affichage", "Impossible d'afficher les agents. L'élément de table est manquant.", "error");
             return;
        }

        agentsTableBody.innerHTML = '';
        if (data.length === 0) {
            // Colspan ajusté pour 5 colonnes (ID, Nom, Prénom, Qualifs, Grades, Actions)
            agentsTableBody.innerHTML = '<tr><td colspan="5">Aucun agent enregistré pour le moment.</td></tr>';
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

                // Afficher les grades dans la table
                const gradeNames = (agent.grades || [])
                                    .map(id => {
                                        const grade = availableGrades.find(g => g.id === id);
                                        return grade ? grade.name : id;
                                    })
                                    .join(', ');

                // Suppression de la colonne fonctions, donc le HTML ici est ajusté
                row.innerHTML = `
                    <td>${agent._id}</td>
                    <td>${agent.nom}</td>
                    <td>${agent.prenom}</td>
                    <td>${qualNames}</td>
                    <td>${gradeNames}</td>
                    <td>
                        <button class="edit-btn btn-secondary"
                            data-id="${agent._id}"
                            data-nom="${agent.nom}"
                            data-prenom="${agent.prenom}"
                            data-qualifications='${JSON.stringify(agent.qualifications || [])}'
                            data-grades='${JSON.stringify(agent.grades || [])}'>Modifier</button>
                        <button class="delete-btn btn-danger" data-id="${agent._id}">Supprimer</button>
                    </td>
                `;
            });
        }
        if (listAgentsMessage) listAgentsMessage.textContent = '';
    } catch (error) {
        console.error('Erreur de chargement des agents:', error);
        if (listAgentsMessage) {
            listAgentsMessage.textContent = `Erreur : ${error.message}`;
            listAgentsMessage.style.color = 'red';
        }
        if (agentsTableBody) agentsTableBody.innerHTML = '<tr><td colspan="5">Impossible de charger la liste des agents.</td></tr>'; // Colspan ajusté
    }
}

async function handleAddAgent(event) {
    event.preventDefault();
    if (!document.getElementById('newAgentId') || !document.getElementById('newAgentNom') || !document.getElementById('newAgentPrenom') || !document.getElementById('newAgentPassword')) {
        console.error("Erreur DOM: Un ou plusieurs champs du formulaire d'ajout d'agent sont introuvables.");
        displayMessageModal("Erreur de formulaire", "Impossible d'ajouter un agent. Des éléments du formulaire sont manquants.", "error");
        return;
    }
    const id = document.getElementById('newAgentId').value.trim();
    const nom = document.getElementById('newAgentNom').value.trim();
    const prenom = document.getElementById('newAgentPrenom').value.trim();
    const password = document.getElementById('newAgentPassword').value.trim();

    // Récupérer les qualifications sélectionnées pour le nouvel agent
    const selectedQualifications = newAgentQualificationsCheckboxes ? Array.from(newAgentQualificationsCheckboxes.querySelectorAll('input[type="checkbox"]:checked'))
                                       .map(checkbox => checkbox.value) : [];
    // Récupérer les grades sélectionnés
    const selectedGrades = newAgentGradesCheckboxes ? Array.from(newAgentGradesCheckboxes.querySelectorAll('input[type="checkbox"]:checked'))
                                       .map(checkbox => checkbox.value) : [];

    if (!addAgentMessage) {
        console.warn("L'élément 'addAgentMessage' est introuvable. Impossible d'afficher le statut d'ajout de l'agent.");
    } else {
        addAgentMessage.textContent = 'Ajout en cours...';
        addAgentMessage.style.color = 'blue';
    }


    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/agents`, {
            method: 'POST',
            headers: getAuthHeaders(), // Utilisation de getAuthHeaders()
            body: JSON.stringify({ id, nom, prenom, password, qualifications: selectedQualifications, grades: selectedGrades })
        });
        const data = await response.json();

        if (response.ok) {
            if (addAgentMessage) addAgentMessage.textContent = data.message;
            if (addAgentMessage) addAgentMessage.style.color = 'green';
            if (addAgentForm) addAgentForm.reset();
            // Réinitialiser les checkboxes après l'ajout
            if (newAgentQualificationsCheckboxes) newAgentQualificationsCheckboxes.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
            if (newAgentGradesCheckboxes) newAgentGradesCheckboxes.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
            loadAgents(); // Recharger la liste
        } else {
            if (addAgentMessage) addAgentMessage.textContent = `Erreur : ${data.message}`;
            if (addAgentMessage) addAgentMessage.style.color = 'red';
        }
    } catch (error) {
        console.error('Erreur lors de l\'ajout de l\'agent:', error);
        if (addAgentMessage) {
            addAgentMessage.textContent = 'Erreur réseau lors de l\'ajout de l\'agent.';
            addAgentMessage.style.color = 'red';
        }
    }
}

async function handleAgentActions(event) {
    const target = event.target;
    const agentId = target.dataset.id;

    if (!agentId) {
        console.error("Agent ID non trouvé pour l'action.");
        return;
    }

    if (target.classList.contains('edit-btn')) {
        if (!editAgentId || !editAgentNom || !editAgentPrenom || !editAgentNewPassword || !editAgentMessage || !editAgentModalElement) {
            console.error("Erreur DOM: Un ou plusieurs éléments de la modale d'édition de l'agent sont introuvables.");
            displayMessageModal("Erreur d'affichage", "Impossible d'ouvrir la modale d'édition. Des éléments sont manquants.", "error");
            return;
        }
        editAgentId.value = agentId;
        editAgentNom.value = target.dataset.nom;
        editAgentPrenom.value = target.dataset.prenom;
        editAgentNewPassword.value = '';
        editAgentMessage.textContent = '';

        // Récupérer les qualifications et grades de l'agent depuis le dataset
        const agentQualifications = JSON.parse(target.dataset.qualifications || '[]');
        const agentGrades = JSON.parse(target.dataset.grades || '[]');

        renderQualificationsCheckboxes(agentQualifications); // Remplir les checkboxes
        renderGradesCheckboxes(agentGrades); // Remplir les checkboxes de grades

        editAgentModalElement.style.display = 'block';
    } else if (target.classList.contains('delete-btn')) {
        const confirmed = await confirmModal(`Êtes-vous sûr de vouloir supprimer l'agent ${agentId} ?`);
        if (confirmed) {
            try {
                const response = await fetch(`${API_BASE_URL}/api/admin/agents/${agentId}`, {
                    method: 'DELETE',
                    headers: getAuthHeaders() // Utilisation de getAuthHeaders()
                });
                const data = await response.json();

                if (response.ok) {
                    displayMessageModal("Succès", data.message, "success");
                    loadAgents(); // Recharger la liste
                } else {
                    displayMessageModal("Erreur", `Erreur lors de la suppression : ${data.message}`, "error");
                }
            } catch (error) {
                console.error('Erreur lors de la suppression de l\'agent:', error);
                displayMessageModal("Erreur", 'Erreur réseau lors de la suppression de l\'agent.', "error");
            }
        }
    }
}

async function handleEditAgent(event) {
    event.preventDefault();
    if (!editAgentId || !editAgentNom || !editAgentPrenom || !editAgentNewPassword || !editAgentMessage || !qualificationsCheckboxesDiv || !gradesCheckboxesDiv) {
        console.error("Erreur DOM: Un ou plusieurs éléments du formulaire d'édition de l'agent sont introuvables.");
        displayMessageModal("Erreur de modification", "Impossible de modifier l'agent. Des éléments du formulaire sont manquants.", "error");
        return;
    }
    const id = editAgentId.value.trim();
    const nom = editAgentNom.value.trim();
    const prenom = editAgentPrenom.value.trim();
    const newPassword = editAgentNewPassword.value.trim();

    // Récupérer les qualifications sélectionnées
    const selectedQualifications = Array.from(qualificationsCheckboxesDiv.querySelectorAll('input[type="checkbox"]:checked'))
                                       .map(checkbox => checkbox.value);
    // Récupérer les grades sélectionnés
    const selectedGrades = Array.from(gradesCheckboxesDiv.querySelectorAll('input[type="checkbox"]:checked'))
                                       .map(checkbox => checkbox.value);


    editAgentMessage.textContent = 'Mise à jour en cours...';
    editAgentMessage.style.color = 'blue';

    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/agents/${id}`, {
            method: 'PUT',
            headers: getAuthHeaders(), // Utilisation de getAuthHeaders()
            body: JSON.stringify({ nom, prenom, newPassword, qualifications: selectedQualifications, grades: selectedGrades })
        });
        const data = await response.json();

        if (response.ok) {
            editAgentMessage.textContent = data.message;
            editAgentMessage.style.color = 'green';
            loadAgents(); // Recharger la liste des agents
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

// --- Fonctions CRUD pour la gestion des qualifications (Frontend) ---

async function loadQualificationsList() {
    if (!listQualificationsMessage) {
        console.warn("L'élément 'listQualificationsMessage' est introuvable. Impossible d'afficher le statut de chargement des qualifications.");
    } else {
        listQualificationsMessage.textContent = 'Chargement des qualifications...';
        listQualificationsMessage.style.color = 'blue';
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/qualifications`, {
            headers: getAuthHeaders() // Ajout des headers d'autorisation
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Erreur lors du chargement des qualifications.');
        }

        if (!qualificationsTableBody) {
             console.error("Erreur DOM: L'élément 'qualificationsTableBody' est introuvable. Impossible de rendre la table des qualifications.");
             displayMessageModal("Erreur d'affichage", "Impossible d'afficher les qualifications. L'élément de table est manquant.", "error");
             return;
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
        if (listQualificationsMessage) listQualificationsMessage.textContent = '';
    } catch (error) {
        console.error('Erreur de chargement des qualifications:', error);
        if (listQualificationsMessage) {
            listQualificationsMessage.textContent = `Erreur : ${error.message}`;
            listQualificationsMessage.style.color = 'red';
        }
        if (qualificationsTableBody) qualificationsTableBody.innerHTML = '<tr><td colspan="3">Impossible de charger la liste des qualifications.</td></tr>';
    }
}

async function handleAddQualification(event) {
    event.preventDefault();
    if (!document.getElementById('newQualId') || !document.getElementById('newQualName')) {
        console.error("Erreur DOM: Les champs d'ajout de qualification sont introuvables.");
        displayMessageModal("Erreur de formulaire", "Impossible d'ajouter une qualification. Des éléments du formulaire sont manquants.", "error");
        return;
    }
    const id = document.getElementById('newQualId').value.trim();
    const name = document.getElementById('newQualName').value.trim();

    if (!addQualificationMessage) {
        console.warn("L'élément 'addQualificationMessage' est introuvable. Impossible d'afficher le statut d'ajout de qualification.");
    } else {
        addQualificationMessage.textContent = 'Ajout en cours...';
        addQualificationMessage.style.color = 'blue';
    }


    try {
        const response = await fetch(`${API_BASE_URL}/api/qualifications`, {
            method: 'POST',
            headers: getAuthHeaders(), // Utilisation de getAuthHeaders()
            body: JSON.stringify({ id, name })
        });
        const data = await response.json();

        if (response.ok) {
            if (addQualificationMessage) addQualificationMessage.textContent = data.message;
            if (addQualificationMessage) addQualificationMessage.style.color = 'green';
            if (addQualificationFormElement) addQualificationFormElement.reset();
            await loadAvailableQualifications(); // Recharger la liste des qualifications disponibles
            await loadQualificationsList(); // Recharger la liste affichée dans la table
            renderNewAgentQualificationsCheckboxes(); // Mettre à jour les checkboxes d'agent
        } else {
            if (addQualificationMessage) addQualificationMessage.textContent = `Erreur : ${data.message}`;
            if (addQualificationMessage) addQualificationMessage.style.color = 'red';
        }
    } catch (error) {
        console.error('Erreur lors de l\'ajout de la qualification:', error);
        if (addQualificationMessage) {
            addQualificationMessage.textContent = 'Erreur réseau lors de l\'ajout de la qualification.';
            addQualificationMessage.style.color = 'red';
        }
    }
}

async function handleQualificationActions(event) {
    const target = event.target;
    const qualId = target.dataset.id;

    if (!qualId) return;

    if (target.classList.contains('edit-btn')) {
        if (!editQualId || !editQualName || !editQualMessage || !editQualificationModalElement) {
            console.error("Erreur DOM: Un ou plusieurs éléments de la modale d'édition de qualification sont introuvables.");
            displayMessageModal("Erreur d'affichage", "Impossible d'ouvrir la modale d'édition. Des éléments sont manquants.", "error");
            return;
        }
        editQualId.value = qualId;
        editQualName.value = target.dataset.name;
        editQualMessage.textContent = '';
        editQualificationModalElement.style.display = 'block';
    } else if (target.classList.contains('delete-btn')) {
        const confirmed = await confirmModal(`Êtes-vous sûr de vouloir supprimer la qualification "${qualId}" ? Cela la retirera aussi des agents qui la possèdent.`);
        if (confirmed) {
            try {
                const response = await fetch(`${API_BASE_URL}/api/qualifications/${qualId}`, {
                    method: 'DELETE',
                    headers: getAuthHeaders() // Utilisation de getAuthHeaders()
                });
                const data = await response.json();

                if (response.ok) {
                    displayMessageModal("Succès", data.message, "success");
                    await loadAvailableQualifications();
                    await loadQualificationsList();
                    renderNewAgentQualificationsCheckboxes();
                    loadAgents();
                } else {
                    displayMessageModal("Erreur", `Erreur lors de la suppression : ${data.message}`, "error");
                }
            } catch (error) {
                console.error('Erreur lors de la suppression de la qualification:', error);
                displayMessageModal("Erreur", 'Erreur réseau lors de la suppression de la qualification.', "error");
            }
        }
    }
}

async function handleEditQualification(event) {
    event.preventDefault();
    if (!editQualId || !editQualName || !editQualMessage) {
        console.error("Erreur DOM: Un ou plusieurs éléments du formulaire d'édition de qualification sont introuvables.");
        displayMessageModal("Erreur de modification", "Impossible de modifier la qualification. Des éléments du formulaire sont manquants.", "error");
        return;
    }
    const id = editQualId.value.trim();
    const name = editQualName.value.trim();

    editQualMessage.textContent = 'Mise à jour en cours...';
    editQualMessage.style.color = 'blue';

    try {
        const response = await fetch(`${API_BASE_URL}/api/qualifications/${id}`, {
            method: 'PUT',
            headers: getAuthHeaders(), // Utilisation de getAuthHeaders()
            body: JSON.stringify({ name })
        });
        const data = await response.json();

        if (response.ok) {
            editQualMessage.textContent = data.message;
            editQualMessage.style.color = 'green';
            await loadAvailableQualifications();
            await loadQualificationsList();
            renderNewAgentQualificationsCheckboxes();
            loadAgents();
        } else {
            editQualMessage.textContent = `Erreur : ${data.message}`;
            if (editQualMessage) editQualMessage.style.color = 'red';
        }
    } catch (error) {
        console.error('Erreur lors de la mise à jour de la qualification:', error);
        if (editQualMessage) {
            editQualMessage.textContent = 'Erreur réseau lors de la mise à jour de la qualification.';
            editQualMessage.style.color = 'red';
        }
    }
}

// --- Fonctions CRUD pour la gestion des grades (Frontend) ---

async function loadGradesList() {
    if (!listGradesMessage) {
        console.warn("L'élément 'listGradesMessage' est introuvable. Impossible d'afficher le statut de chargement des grades.");
    } else {
        listGradesMessage.textContent = 'Chargement des grades...';
        listGradesMessage.style.color = 'blue';
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/grades`, {
            headers: getAuthHeaders() // Ajout des headers d'autorisation
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Erreur lors du chargement des grades.');
        }

        if (!gradesTableBody) {
            console.error("Erreur DOM: L'élément 'gradesTableBody' est introuvable. Impossible de rendre la table des grades.");
            displayMessageModal("Erreur d'affichage", "Impossible d'afficher les grades. L'élément de table est manquant.", "error");
            return;
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
        if (listGradesMessage) listGradesMessage.textContent = '';
    }
     catch (error) {
        console.error('Erreur de chargement des grades:', error);
        if (listGradesMessage) {
            listGradesMessage.textContent = `Erreur : ${error.message}`;
            listGradesMessage.style.color = 'red';
        }
        if (gradesTableBody) gradesTableBody.innerHTML = '<tr><td colspan="3">Impossible de charger la liste des grades.</td></td>';
    }
}

async function handleAddGrade(event) {
    event.preventDefault();
    if (!document.getElementById('newGradeId') || !document.getElementById('newGradeName')) {
        console.error("Erreur DOM: Les champs d'ajout de grade sont introuvables.");
        displayMessageModal("Erreur de formulaire", "Impossible d'ajouter un grade. Des éléments du formulaire sont manquants.", "error");
        return;
    }
    const id = document.getElementById('newGradeId').value.trim();
    const name = document.getElementById('newGradeName').value.trim();

    if (!addGradeMessage) {
        console.warn("L'élément 'addGradeMessage' est introuvable. Impossible d'afficher le statut d'ajout de grade.");
    } else {
        addGradeMessage.textContent = 'Ajout en cours...';
        addGradeMessage.style.color = 'blue';
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/grades`, {
            method: 'POST',
            headers: getAuthHeaders(), // Utilisation de getAuthHeaders()
            body: JSON.stringify({ id, name })
        });
        const data = await response.json();

        if (response.ok) {
            if (addGradeMessage) addGradeMessage.textContent = data.message;
            if (addGradeMessage) addGradeMessage.style.color = 'green';
            if (addGradeFormElement) addGradeFormElement.reset();
            await loadAvailableGrades();
            await loadGradesList();
            renderNewAgentGradesCheckboxes();
        } else {
            if (addGradeMessage) addGradeMessage.textContent = `Erreur : ${data.message}`;
            if (addGradeMessage) addGradeMessage.style.color = 'red';
        }
    } catch (error) {
        console.error('Erreur lors de l\'ajout du grade:', error);
        if (addGradeMessage) {
            addGradeMessage.textContent = 'Erreur réseau lors de l\'ajout du grade.';
            addGradeMessage.style.color = 'red';
        }
    }
}

async function handleGradeActions(event) {
    const target = event.target;
    const gradeId = target.dataset.id;

    if (!gradeId) return;

    if (target.classList.contains('edit-btn')) {
        if (!editGradeId || !editGradeName || !editGradeMessage || !editGradeModalElement) {
            console.error("Erreur DOM: Un ou plusieurs éléments de la modale d'édition de grade sont introuvables.");
            displayMessageModal("Erreur d'affichage", "Impossible d'ouvrir la modale d'édition. Des éléments sont manquants.", "error");
            return;
        }
        editGradeId.value = gradeId;
        editGradeName.value = target.dataset.name;
        editGradeMessage.textContent = '';
        editGradeModalElement.style.display = 'block';
    } else if (target.classList.contains('delete-btn')) {
        const confirmed = await confirmModal(`Êtes-vous sûr de vouloir supprimer le grade "${gradeId}" ? Cela le retirera aussi des agents qui le possèdent.`);
        if (confirmed) {
            try {
                const response = await fetch(`${API_BASE_URL}/api/grades/${gradeId}`, {
                    method: 'DELETE',
                    headers: getAuthHeaders() // Utilisation de getAuthHeaders()
                });
                const data = await response.json();

                if (response.ok) {
                    displayMessageModal("Succès", data.message, "success");
                    await loadAvailableGrades();
                    await loadGradesList();
                    renderNewAgentGradesCheckboxes();
                    loadAgents();
                } else {
                    displayMessageModal("Erreur", `Erreur lors de la suppression : ${data.message}`, "error");
                }
            } catch (error) {
                console.error('Erreur lors de la suppression du grade:', error);
                displayMessageModal("Erreur", 'Erreur réseau lors de la suppression du grade.', "error");
            }
        }
    }
}

async function handleEditGrade(event) {
    event.preventDefault();
    if (!editGradeId || !editGradeName || !editGradeMessage) {
        console.error("Erreur DOM: Un ou plusieurs éléments du formulaire d'édition de grade sont introuvables.");
        displayMessageModal("Erreur de modification", "Impossible de modifier le grade. Des éléments du formulaire sont manquants.", "error");
        return;
    }
    const id = editGradeId.value.trim();
    const name = editGradeName.value.trim();

    editGradeMessage.textContent = 'Mise à jour en cours...';
    editGradeMessage.style.color = 'blue';

    try {
        const response = await fetch(`${API_BASE_URL}/api/grades/${id}`, {
            method: 'PUT',
            headers: getAuthHeaders(), // Utilisation de getAuthHeaders()
            body: JSON.stringify({ name })
        });
        const data = await response.json();

        if (response.ok) {
            editGradeMessage.textContent = data.message;
            editGradeMessage.style.color = 'green';
            await loadAvailableGrades();
            await loadGradesList();
            renderNewAgentGradesCheckboxes();
            loadAgents();
        } else {
            if (editGradeMessage) editGradeMessage.textContent = `Erreur : ${data.message}`;
            if (editGradeMessage) editGradeMessage.style.color = 'red';
        }
    } catch (error) {
        console.error('Erreur lors de la mise à jour du grade:', error);
        if (editGradeMessage) {
            editGradeMessage.textContent = 'Erreur réseau lors de la mise à jour du grade.';
            editGradeMessage.style.color = 'red';
        }
    }
}

/**
 * Gère l'affichage des onglets principaux de la page d'administration.
 * Cache tous les contenus d'onglets et n'affiche que celui correspondant au `targetTabId`.
 * Met à jour la classe 'active' des boutons d'onglet.
 * @param {string} targetTabId L'ID de l'onglet à afficher (ex: 'global-planning-view').
 */
async function openMainTab(targetTabId) {
    mainTabContents.forEach(content => {
        content.classList.remove('active');
        content.classList.add('hidden');
    });
    mainTabButtons.forEach(button => {
        button.classList.remove('active');
    });

    const activeTabContent = document.getElementById(targetTabId);
    if (activeTabContent) {
        activeTabContent.classList.add('active');
        activeTabContent.classList.remove('hidden');
    }

    const clickedButton = document.querySelector(`.main-tab[data-main-tab="${targetTabId}"]`);
    if (clickedButton) {
        clickedButton.classList.add('active');
    }

    // Actions spécifiques à chaque onglet lors de son ouverture
    if (targetTabId === 'global-planning-view') {
        updateDateRangeDisplay(); // S'assure que la plage de dates est correcte
        await loadPlanningData(); // Recharge le planning global
        showDay(currentDay); // Affiche le planning du jour actuel
        // Active le bouton du jour par défaut (Lundi) ou le jour actif précédent
        const activeDayButton = document.querySelector(`.tab[data-day="${currentDay}"]`);
        if (activeDayButton) {
            tabButtons.forEach(btn => btn.classList.remove('active'));
            activeDayButton.classList.add('active');
        }
        // Afficher les contrôles de planning dans le header (nouveau conteneur)
        if (headerPlanningControls) headerPlanningControls.style.display = 'flex';

    } else {
        // Cacher les contrôles de planning du header pour les autres onglets
        if (headerPlanningControls) headerPlanningControls.style.display = 'none';
    }

    if (targetTabId === 'agent-management-view') {
        await loadAvailableQualifications(); // S'assure que les qualifs sont à jour
        await loadAvailableGrades(); // S'assure que les grades sont à jour
        renderNewAgentQualificationsCheckboxes(); // Met à jour les checkboxes d'ajout d'agent
        renderNewAgentGradesCheckboxes(); // Met à jour les checkboxes de grades d'ajout d'agent
        await loadAgents(); // Recharge la liste des agents
    }

    if (targetTabId === 'qualification-management-view') {
        await loadQualificationsList(); // Recharge la liste des qualifications
    }

    if (targetTabId === 'grade-management-view') {
        await loadGradesList(); // Recharge la liste des grades
    }
}


/**
 * Gère l'affichage du planning pour un jour spécifique dans l'onglet "Planning Global".
 * @param {string} day Le jour à afficher (ex: 'lundi').
 */
function showDay(day) {
    currentDay = day; // Met à jour le jour actuel
    tabButtons.forEach(tab => {
        if (tab.dataset.day === day) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
    renderPlanningGrid(day); // Rend la grille pour le jour sélectionné
}


// --- Initialisation au chargement du DOM ---
document.addEventListener("DOMContentLoaded", async () => {
    // Récupérer les informations de session
    const currentUserId = sessionStorage.getItem('agentId');
    const currentUserName = sessionStorage.getItem('agentPrenom') + ' ' + sessionStorage.getItem('agentNom');
    const currentUserRole = sessionStorage.getItem('userRole');
    const token = sessionStorage.getItem('token'); 

    // --- DEBOGAGE : Affiche les valeurs récupérées de sessionStorage ---
    console.log("DEBUG Admin: currentUserId:", currentUserId);
    console.log("DEBUG Admin: currentUserName:", currentUserName);
    console.log("DEBUG Admin: currentUserRole:", currentUserRole);
    console.log("DEBUG Admin: Token:", token ? "Présent" : "Absent");

    // Vérification initiale de l'authentification et du rôle
    if (!currentUserId || !token) {
        console.error("Initialisation Admin: ID utilisateur ou Token manquant. Redirection vers login.");
        displayMessageModal("Session expirée", "Votre session a expiré ou n'est pas valide. Veuillez vous reconnecter.", "error", () => {
            window.location.href = "index.html"; 
        });
        return; // Arrête l'exécution si non authentifié
    }

    // Vérifions si le rôle est 'admin' pour cette page
    if (currentUserRole !== 'admin') {
        console.error("Initialisation Admin: Rôle incorrect pour cette page. Rôle actuel:", currentUserRole);
        displayMessageModal("Accès non autorisé", "Vous devez être connecté en tant qu'administrateur pour accéder à cette page.", "error", () => {
            // Si c'est un agent qui arrive ici par erreur, il devrait aller à agent.html
            if (currentUserRole === 'agent') {
                window.location.href = "agent.html";
            } else {
                window.location.href = "index.html"; 
            }
        });
        return; // Arrête l'exécution si le rôle n'est pas 'admin'
    }

    // Le nom de l'admin n'est plus affiché dans le titre, donc plus besoin de cette ligne
    // if (adminNameDisplay) {
    //     adminNameDisplay.textContent = `${currentUserName} (${currentUserId})`;
    // } else {
    //     console.warn("L'élément 'admin-name-display' est introuvable dans admin.html. Le nom de l'admin ne sera pas affiché.");
    // }

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

    // --- Initialisation des fonctionnalités par default de la page ---
    await loadAvailableQualifications();
    await loadAvailableGrades();

    renderNewAgentQualificationsCheckboxes();
    renderNewAgentGradesCheckboxes();

    // Définir la semaine actuelle par default
    currentWeek = getCurrentISOWeek(new Date());
    generateWeekOptions(); // Générer les options du sélecteur de semaine

    // Ouvrir l'onglet "Planning Global" par default au chargement
    // Ceci appellera loadPlanningData et showDay
    await openMainTab('global-planning-view');


    // --- Écouteurs d'événements pour les contrôles du planning global ---
    if (weekSelect) {
        weekSelect.addEventListener("change", async () => {
            currentWeek = parseInt(weekSelect.value.split('-')[1]);
            updateDateRangeDisplay();
            await loadPlanningData(); // Recharge les données du planning pour la nouvelle semaine
            showDay(currentDay); // Réaffiche le planning pour le jour actif
        });
    }
    const exportPdfButton = document.getElementById("export-pdf");
    if (exportPdfButton) {
        exportPdfButton.addEventListener("click", exportPdf);
    } else {
        console.warn("L'élément 'export-pdf' est introuvable dans admin.html. Le bouton d'exportation PDF ne sera pas fonctionnel.");
    }

    // --- Écouteurs d'événements pour la vue "Gestion des Agents" ---
    if (addAgentForm) {
        addAgentForm.addEventListener('submit', handleAddAgent);
    } else {
        console.warn("L'élément 'addAgentForm' est introuvable dans admin.html. Le formulaire d'ajout d'agent ne sera pas fonctionnel.");
    }

    if (agentsTableBody) {
        agentsTableBody.addEventListener('click', handleAgentActions);
    } else {
        console.warn("L'élément 'agentsTableBody' est introuvable dans admin.html. Les actions d'agent ne seront pas fonctionnelles.");
    }

    // --- Écouteurs d'événements pour la Modale de modification d'agent ---
    if (editAgentModalElement && closeEditAgentModalButton) {
        closeEditAgentModalButton.addEventListener('click', () => {
            editAgentModalElement.style.display = 'none';
        });
    } else {
        console.warn("La modale d'édition de l'agent ou son bouton de fermeture est introuvable dans admin.html.");
    }

    window.addEventListener('click', (event) => {
        if (event.target == editAgentModalElement) {
            editAgentModalElement.style.display = 'none';
        }
    });
    if (editAgentFormElement) {
        editAgentFormElement.addEventListener('submit', handleEditAgent);
    } else {
        console.warn("Le formulaire d'édition de l'agent est introuvable dans admin.html.");
    }

    // --- Écouteurs d'événements pour la vue "Gestion des Qualifications" ---
    if (addQualificationFormElement) {
        addQualificationFormElement.addEventListener('submit', handleAddQualification);
    } else {
        console.warn("Le formulaire d'ajout de qualification est introuvable dans admin.html.");
    }

    if (qualificationsTableBody) {
        qualificationsTableBody.addEventListener('click', handleQualificationActions);
    } else {
        console.warn("Le corps de la table des qualifications est introuvable dans admin.html.");
    }

    if (editQualificationModalElement && closeQualButton) {
        closeQualButton.addEventListener('click', () => {
            editQualificationModalElement.style.display = 'none';
        });
    } else {
        console.warn("La modale d'édition de qualification ou son bouton de fermeture est introuvable dans admin.html.");
    }

    if (editQualificationFormElement) {
        editQualificationFormElement.addEventListener('submit', handleEditQualification);
    } else {
        console.warn("Le formulaire d'édition de qualification est introuvable dans admin.html.");
    }

    // --- Écouteurs d'événements pour la vue "Gestion des Grades" ---
    if (addGradeFormElement) {
        addGradeFormElement.addEventListener('submit', handleAddGrade);
    } else {
        console.warn("Le formulaire d'ajout de grade est introuvable dans admin.html.");
    }

    if (gradesTableBody) {
        gradesTableBody.addEventListener('click', handleGradeActions);
    } else {
        console.warn("Le corps de la table des grades est introuvable dans admin.html.");
    }

    if (editGradeModalElement && closeGradeButton) {
        closeGradeButton.addEventListener('click', () => {
            editGradeModalElement.style.display = 'none';
        });
    } else {
        console.warn("La modale d'édition de grade ou son bouton de fermeture est introuvable dans admin.html.");
    }

    if (editGradeFormElement) {
        editGradeFormElement.addEventListener('submit', handleEditGrade);
    } else {
        console.warn("Le formulaire d'édition de grade est introuvable dans admin.html.");
    }

    // --- Écouteur pour la déconnexion ---
    if (logoutButton) {
        logoutButton.addEventListener("click", logout);
    } else {
        console.warn("Le bouton de déconnexion est introuvable dans admin.html.");
    }
});
