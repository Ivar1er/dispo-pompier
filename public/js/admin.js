// admin.js

document.addEventListener('DOMContentLoaded', async () => {
    const API_BASE_URL = "https://dispo-pompier.onrender.com";

    // --- Variables globales pour le stockage des données (localement) ---
    let USERS_DATA = {}; // Contient les données complètes des agents
    let QUALIFICATIONS_DATA = [];
    let GRADES_DATA = [];
    // let FUNCTIONS_DATA = []; // Commenté car non présent dans admin.html
    let GLOBAL_PLANNING_DATA = {};

    // --- Éléments du DOM pour la navigation principale (onglets) ---
    const mainTabButtons = document.querySelectorAll('.main-tab');
    const mainTabContents = document.querySelectorAll('.main-tab-content');

    // --- DOM Elements pour la vue "Planning Global" ---
    const headerPlanningControls = document.querySelector('.header-planning-controls');
    const weekSelect = document.getElementById("week-select");
    const dateRangeDisplay = document.getElementById("date-range");
    const planningContainer = document.getElementById("global-planning"); // Conteneur du tableau de planning
    const tabButtons = document.querySelectorAll(".tab"); // Boutons de jour (Lundi, Mardi...)
    const adminInfo = document.getElementById("admin-info");
    const exportPdfButton = document.getElementById("export-pdf"); // Assurez-vous que cet ID est correct

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
    const qualificationsMessage = document.getElementById('qualificationsMessage'); // Message pour la modale qualifs
    const gradesMessage = document.getElementById('gradesMessage'); // Message pour la modale grades

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

    // Variables pour le planning
    let currentWeek; // Ex: 25 (number)
    let currentDay = 'lundi'; // Jour actuel par défaut pour le planning (nom du jour en minuscules)
    const days = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
    const horaires = []; // Créneaux 30 min sur 24h, de 07h00 à 06h30
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


    // --- Helpers de date (utilisés pour la structuration des plannings) ---
    /**
     * Calcule le numéro de semaine ISO 8601 pour une date donnée.
     * La semaine 1 est celle qui contient le premier jeudi de l'année.
     * @param {Date} date - La date pour laquelle calculer le numéro de semaine.
     * @returns {number} Le numéro de semaine ISO 8601.
     */
    function getCurrentISOWeek(date = new Date()) {
        const _date = new Date(date.getTime());
        _date.setHours(0, 0, 0, 0);
        // Thursday in current week decides the year.
        _date.setDate(_date.getDate() + 3 - (_date.getDay() + 6) % 7);
        // January 4 is always in week 1.
        const week1 = new Date(_date.getFullYear(), 0, 4);
        // Adjust to Sunday in week 1 and count number of weeks from date to week1.
        return 1 + Math.round(((_date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
    }

    /**
     * Récupère la plage de dates (début-fin) pour un numéro de semaine ISO donné.
     * @param {number} weekNumber - Le numéro de semaine ISO.
     * @param {number} year - L'année.
     * @returns {string} La plage de dates formatée (ex: "du 16/06 au 22/06").
     */
    function getWeekDateRange(weekNumber, year = new Date().getFullYear()) {
        const simple = new Date(year, 0, 1 + (weekNumber - 1) * 7);
        const dow = simple.getDay() || 7; // Lundi = 1, Dimanche = 0 => Dimanche = 7
        const ISOweekStart = new Date(simple);
        if (dow <= 4) { // Si jeudi ou avant
            ISOweekStart.setDate(simple.getDate() - dow + 1); // Retour au lundi
        } else { // Si vendredi, samedi, dimanche
            ISOweekStart.setDate(simple.getDate() + 8 - dow); // Avance au lundi suivant
        }
        const start = new Date(ISOweekStart);
        const end = new Date(ISOweekStart);
        end.setDate(start.getDate() + 6); // Dimanche de la semaine

        const format = date => date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
        return `du ${format(start)} au ${format(end)}`;
    }

    /**
     * Retourne le lundi de la semaine ISO spécifiée.
     * @param {number} weekNum - Le numéro de semaine ISO.
     * @param {number} year - L'année.
     * @returns {Date} L'objet Date représentant le lundi de la semaine.
     */
    function getMondayOfWeek(weekNum, year) {
        const jan1 = new Date(year, 0, 1);
        const days = (weekNum - 1) * 7;
        let date = new Date(jan1.getTime() + days * 24 * 60 * 60 * 1000);

        // Trouver le lundi de cette semaine
        const dayOfWeek = date.getDay(); // 0 for Sunday, 1 for Monday, ..., 6 for Saturday
        const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Adjust to get to Monday (if Sun, go back 6; else go back diff to get to Mon)
        date.setDate(date.getDate() + diff);
        date.setHours(0, 0, 0, 0); // Reset time to start of day
        return date;
    }


    // Fonction pour récupérer le token JWT
    function getToken() {
        return sessionStorage.getItem('token');
    }

    // Fonction pour obtenir les en-têtes d'autorisation
    function getAuthHeaders() {
        const token = getToken();
        if (!token) {
            console.error("Token non trouvé. Redirection ou gestion de l'erreur.");
            // displayMessageModal("Session expirée", "Veuillez vous reconnecter.", "error", () => {
            //     window.location.href = "/index.html";
            // });
            return { 'Content-Type': 'application/json' }; // Retourne sans auth pour que le fetch échoue avec 401/403
        }
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    }


    // --- Fonctions de chargement des données (Appels API) ---

    // FetchAgentNames n'est pas utilisé pour peupler USERS_DATA, c'est loadAgents qui le fait.
    // Cette fonction pourrait être supprimée si elle n'est pas appelée ailleurs.
    // async function fetchAgentNames() {
    //     try {
    //         const response = await fetch(`${API_BASE_URL}/api/agents/names`);
    //         const data = await response.json();
    //         if (response.ok) {
    //             // Mettre à jour agentDisplayInfos ici si nécessaire
    //         } else {
    //             console.error('Erreur lors du chargement des noms d\'agents:', data.message);
    //         }
    //     } catch (error) {
    //         console.error('Erreur réseau lors du chargement des noms d\'agents:', error);
    //     }
    // }


    async function loadPlanningData() {
        showLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/planning`, {
                headers: getAuthHeaders()
            });
            const data = await response.json();
            if (!response.ok) {
                if (response.status === 403 || response.status === 401) {
                    displayMessageModal("Accès Refusé", "Vous n'avez pas l'autorisation de consulter le planning global ou votre session a expiré. Veuillez vous reconnecter.", "error", () => {
                        sessionStorage.clear();
                        window.location.href = "/index.html";
                    });
                    return; // Important pour arrêter l'exécution
                }
                throw new Error(data.message || 'Erreur lors du chargement du planning global.');
            }

            GLOBAL_PLANNING_DATA = data;
            console.log("DEBUG Admin: Planning Global Chargé (Admin):", GLOBAL_PLANNING_DATA);

        } catch (error) {
            console.error('Erreur lors du chargement du planning global:', error);
            GLOBAL_PLANNING_DATA = {}; // Assure que les données sont vides en cas d'erreur
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
        planningContainer.innerHTML = '';

        const table = document.createElement('table');
        table.classList.add('global-planning-table');

        // En-tête (Créneaux Horaires)
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        headerRow.innerHTML = '<th class="agent-header-cell">Agent</th>';

        for (let h = 7; h < 24; h++) {
            const th = document.createElement('th');
            th.textContent = `${String(h).padStart(2, '0')}h`;
            th.classList.add('time-header-cell');
            th.colSpan = 2; // Pour les créneaux de 30 min (ex: 7h00-7h30, 7h30-8h00)
            headerRow.appendChild(th);
        }
        for (let h = 0; h < 7; h++) { // Suite des heures pour couvrir 24h (00h à 06h)
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

        const weekKey = `S ${currentWeek}`; // Format 'S X' comme dans serveur.js

        // Filtrer et trier les agents qui ont des données dans USERS_DATA
        const allAgentIds = Object.keys(USERS_DATA);
        const agentsToDisplay = allAgentIds
            .map(id => USERS_DATA[id])
            .filter(agent => agent && (agent.role === 'agent' || agent.role === 'admin')) // Inclure admins si souhaité
            .sort((a, b) => a.nom.localeCompare(b.nom)); // Tri par nom

        if (agentsToDisplay.length === 0) {
            const noAgentsRow = document.createElement('tr');
            noAgentsRow.innerHTML = `<td colspan="49">Aucun agent à afficher ou données d'agents manquantes.</td>`;
            tbody.appendChild(noAgentsRow);
        } else {
            agentsToDisplay.forEach(agent => {
                const agentRow = document.createElement('tr');
                const agentNameCell = document.createElement('td');
                agentNameCell.classList.add('agent-name-cell');
                agentNameCell.textContent = `${agent.prenom} ${agent.nom}`; // Nom complet de l'agent
                agentRow.appendChild(agentNameCell);

                // Récupérer le planning de l'agent pour la semaine et le jour actuels
                // S'assurer que le chemin d'accès est correct et qu'il retourne un tableau vide par défaut
                const agentSpecificDayPlanning = GLOBAL_PLANNING_DATA[agent._id]?.[weekKey]?.[day] || [];

                horaires.forEach((_, index) => { // Parcourt les 48 créneaux de 30 minutes
                    const slotCell = document.createElement('td');
                    slotCell.classList.add('slot-cell');

                    // Vérifier si un créneau de disponibilité couvre cet index de créneau horaire
                    const isAvailable = agentSpecificDayPlanning.some(slot => {
                        return index >= slot.start && index <= slot.end;
                    });

                    if (isAvailable) {
                        slotCell.classList.add('available-slot-cell');
                    } else {
                        slotCell.classList.add('unavailable-slot-cell');
                    }
                    agentRow.appendChild(slotCell);
                });
                tbody.appendChild(agentRow);
            });
        }
        table.appendChild(tbody);
        planningContainer.appendChild(table);

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
        if (!weekSelect) {
            console.error("Erreur DOM: L'élément 'week-select' est introuvable. Assurez-vous que l'ID est correct dans admin.html.");
            return;
        }
        weekSelect.innerHTML = "";
        const today = new Date();
        const currentWeekNumber = getCurrentISOWeek(today);
        const currentYear = today.getFullYear();

        // Génère quelques semaines passées et futures (ex: 2 semaines avant, 10 semaines après)
        for (let i = -2; i < 10; i++) {
            const weekNum = currentWeekNumber + i;
            // Pour s'assurer que la date est dans la bonne année ISO
            const monday = getMondayOfWeek(weekNum, currentYear);

            const option = document.createElement("option");
            option.value = weekNum; // La valeur est le numéro de semaine
            option.textContent = `Semaine ${weekNum} (${getWeekDateRange(weekNum, currentYear)})`;
            if (weekNum === currentWeek) {
                option.selected = true;
            }
            weekSelect.appendChild(option);
        }
    }

    function showLoading(isLoading, forPdf = false) {
        if (!loadingSpinner) {
            console.warn("L'élément 'loading-spinner' est introuvable dans admin.html.");
            return;
        }

        if (isLoading) {
            loadingSpinner.classList.remove("hidden");
            document.querySelectorAll('button, select, input, a').forEach(el => {
                if (el.id !== 'logout-btn' && el.id !== 'export-pdf') { // Garder export-pdf actif pendant le chargement du planning
                    el.disabled = true;
                    if (el.tagName === 'A') el.classList.add('disabled-link');
                }
            });
            mainTabButtons.forEach(btn => btn.disabled = true); // Désactiver les boutons d'onglets
            tabButtons.forEach(btn => btn.disabled = true); // Désactiver les boutons de jour
            if (headerPlanningControls) headerPlanningControls.style.display = 'none';

            if (adminInfo && forPdf) { // Message spécifique si c'est pour un export PDF
                adminInfo.textContent = "Génération du PDF en cours, veuillez patienter...";
                adminInfo.style.backgroundColor = "#fff3cd";
                adminInfo.style.borderColor = "#ffeeba";
                adminInfo.style.color = "#856404";
            }
        } else {
            loadingSpinner.classList.add("hidden");
            document.querySelectorAll('button, select, input, a').forEach(el => {
                if (el.id !== 'logout-btn' && el.id !== 'export-pdf') {
                    el.disabled = false;
                    if (el.tagName === 'A') el.classList.remove('disabled-link');
                }
            });
            mainTabButtons.forEach(btn => btn.disabled = false); // Réactiver les boutons d'onglets
            tabButtons.forEach(btn => btn.disabled = false); // Réactiver les boutons de jour

            const globalPlanningView = document.getElementById('global-planning-view');
            // Afficher les contrôles de planning seulement si l'onglet planning est actif
            if (globalPlanningView && globalPlanningView.classList.contains('active') && headerPlanningControls) {
                headerPlanningControls.style.display = 'flex';
            } else if (headerPlanningControls) {
                headerPlanningControls.style.display = 'none';
            }

            if (adminInfo && forPdf) { // Réinitialiser le message après l'export PDF
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
        const table = container ? container.querySelector('.global-planning-table') : null;

        if (!table) {
            console.warn("La table de planning est introuvable. Impossible d'exporter.");
            displayMessageModal("Erreur d'Export", "La table de planning est introuvable. Assurez-vous que l'onglet 'Planning Global' est actif.", "error");
            return;
        }

        const wasLoading = loadingSpinner && !loadingSpinner.classList.contains("hidden");
        // if (loadingSpinner) loadingSpinner.classList.add("hidden"); // Ne cache pas le spinner principal

        const originalContainerOverflowX = container ? container.style.overflowX : '';
        const originalTableWhiteSpace = table.style.whiteSpace;
        const originalTableLayout = table.style.tableLayout;
        const originalHeaderCellWidths = {};
        const headerCells = table.querySelectorAll('.time-header-cell');
        headerCells.forEach((cell, index) => {
            originalHeaderCellWidths[index] = cell.style.width;
            cell.style.width = '60px'; // Ajuster la largeur pour le PDF si nécessaire
        });

        showLoading(true, true); // Active le spinner avec option pour PDF

        try {
            if (container) container.style.overflowX = "visible";
            table.style.whiteSpace = "nowrap";
            table.style.tableLayout = "auto";

            await new Promise(r => setTimeout(r, 200)); // Laisse le temps au navigateur de recalculer le layout

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
                scale: 3,
                scrollY: -window.scrollY,
                useCORS: true,
                allowTaint: true,
                ignoreElements: (element) => {
                    return element.classList.contains('loading-spinner') || element.closest('.no-print');
                }
            });

            const imgData = canvas.toDataURL("image/png");

            const pdf = new jsPDF({
                orientation: "landscape",
                unit: "mm",
                format: "a3" // Format plus grand pour le planning
            });

            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const margin = 10;

            const imgProps = pdf.getImageProperties(imgData);
            let pdfWidth = pageWidth - 2 * margin;
            let pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

            // Si la hauteur de l'image est trop grande pour une seule page, ajuster la largeur pour que ça rentre
            if (pdfHeight > pageHeight - (2 * margin + 30)) { // 30mm pour le titre et les infos
                pdfHeight = pageHeight - (2 * margin + 30);
                pdfWidth = (imgProps.width * pdfHeight) / imgProps.height;
            }

            const x = (pageWidth - pdfWidth) / 2; // Centrer l'image horizontalement
            const y = margin + 25; // Descendre un peu pour laisser de la place au titre

            pdf.setFontSize(18);
            pdf.text(title, margin, margin + 5);
            pdf.setFontSize(14);
            pdf.text(`Jour : ${currentDay.charAt(0).toUpperCase() + currentDay.slice(1)}`, margin, margin + 12);

            if (canvas.width > pageWidth * 2) { // Si le contenu est très large, on peut avertir
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
            // Rétablit les styles originaux
            if (container) container.style.overflowX = originalContainerOverflowX;
            table.style.whiteSpace = originalTableWhiteSpace;
            table.style.tableLayout = originalTableLayout;
            headerCells.forEach((cell, index) => {
                cell.style.width = originalHeaderCellWidths[index];
            });

            showLoading(false, true); // Désactive le spinner (en supposant qu'il était activé pour PDF)
            if (wasLoading && loadingSpinner) {
                loadingSpinner.classList.remove("hidden"); // Si le spinner était actif avant, le réafficher
            }
        }
    }


    // --- Fonctions de gestion des qualifications (Frontend) ---

    async function loadAvailableQualifications() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/qualifications`, {
                headers: getAuthHeaders()
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || 'Erreur lors du chargement des qualifications disponibles.');
            }
            QUALIFICATIONS_DATA = data; // Mise à jour de la variable globale
            console.log('Qualifications disponibles chargées:', QUALIFICATIONS_DATA);
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
        if (QUALIFICATIONS_DATA.length === 0) {
            newAgentQualificationsCheckboxes.textContent = 'Aucune qualification disponible. Ajoutez-en d\'abord via la gestion des qualifications.';
            return;
        }

        QUALIFICATIONS_DATA.forEach(qualification => {
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
        if (QUALIFICATIONS_DATA.length === 0) {
            qualificationsCheckboxesDiv.textContent = 'Aucune qualification disponible.';
            if (qualificationsMessage) {
                qualificationsMessage.textContent = 'Veuillez ajouter des qualifications via l\'administration.';
                qualificationsMessage.style.color = 'orange';
            }
            return;
        }

        QUALIFICATIONS_DATA.forEach(qualification => {
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
                headers: getAuthHeaders()
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || 'Erreur lors du chargement des grades disponibles.');
            }
            GRADES_DATA = data; // Mise à jour de la variable globale
            console.log('Grades disponibles chargés:', GRADES_DATA);
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
        if (GRADES_DATA.length === 0) {
            newAgentGradesCheckboxes.textContent = 'Aucun grade disponible. Ajoutez-en d\'abord via la gestion des grades.';
            return;
        }

        GRADES_DATA.forEach(grade => {
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
        if (GRADES_DATA.length === 0) {
            gradesCheckboxesDiv.textContent = 'Aucun grade disponible.';
            if (gradesMessage) {
                gradesMessage.textContent = 'Veuillez ajouter des grades via l\'administration.';
                gradesMessage.style.color = 'orange';
            }
            return;
        }

        GRADES_DATA.forEach(grade => {
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
                headers: getAuthHeaders()
            });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Erreur lors du chargement des agents.');
            }

            // Peupler USERS_DATA avec les détails complets des agents
            USERS_DATA = {};
            data.forEach(agent => {
                USERS_DATA[agent._id] = {
                    id: agent._id,
                    nom: agent.nom,
                    prenom: agent.prenom,
                    qualifications: agent.qualifications || [],
                    grades: agent.grades || [],
                    functions: agent.functions || [], // Inclure les fonctions si vous les utilisez
                    role: agent.role || 'agent' // Assurez-vous que le rôle est défini
                };
            });
            console.log("DEBUG Admin: USERS_DATA après loadAgents:", USERS_DATA);


            if (!agentsTableBody) {
                console.error("Erreur DOM: L'élément 'agentsTableBody' est introuvable. Impossible de rendre la table des agents.");
                displayMessageModal("Erreur d'affichage", "Impossible d'afficher les agents. L'élément de table est manquant.", "error");
                return;
            }

            agentsTableBody.innerHTML = '';
            if (data.length === 0) {
                agentsTableBody.innerHTML = '<tr><td colspan="6">Aucun agent enregistré pour le moment.</td></tr>';
            } else {
                data.forEach(agent => {
                    const row = agentsTableBody.insertRow();
                    const qualNames = (agent.qualifications || [])
                        .map(id => {
                            const qual = QUALIFICATIONS_DATA.find(q => q.id === id); // Utilise QUALIFICATIONS_DATA
                            return qual ? qual.name : id;
                        })
                        .join(', ');

                    const gradeNames = (agent.grades || [])
                        .map(id => {
                            const grade = GRADES_DATA.find(g => g.id === id); // Utilise GRADES_DATA
                            return grade ? grade.name : id;
                        })
                        .join(', ');

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
            if (agentsTableBody) agentsTableBody.innerHTML = '<tr><td colspan="6">Impossible de charger la liste des agents.</td></tr>';
        }
    }

    async function handleAddAgent(event) {
        event.preventDefault();
        const newAgentIdInput = document.getElementById('newAgentId');
        const newAgentNomInput = document.getElementById('newAgentNom');
        const newAgentPrenomInput = document.getElementById('newAgentPrenom');
        const newAgentPasswordInput = document.getElementById('newAgentPassword');

        if (!newAgentIdInput || !newAgentNomInput || !newAgentPrenomInput || !newAgentPasswordInput) {
            console.error("Erreur DOM: Un ou plusieurs champs du formulaire d'ajout d'agent sont introuvables.");
            displayMessageModal("Erreur de formulaire", "Impossible d'ajouter un agent. Des éléments du formulaire sont manquants.", "error");
            return;
        }
        const id = newAgentIdInput.value.trim();
        const nom = newAgentNomInput.value.trim();
        const prenom = newAgentPrenomInput.value.trim();
        const password = newAgentPasswordInput.value.trim();

        const selectedQualifications = newAgentQualificationsCheckboxes ? Array.from(newAgentQualificationsCheckboxes.querySelectorAll('input[type="checkbox"]:checked'))
            .map(checkbox => checkbox.value) : [];
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
                headers: getAuthHeaders(),
                body: JSON.stringify({ id, nom, prenom, password, qualifications: selectedQualifications, grades: selectedGrades })
            });
            const data = await response.json();

            if (response.ok) {
                if (addAgentMessage) addAgentMessage.textContent = data.message;
                if (addAgentMessage) addAgentMessage.style.color = 'green';
                if (addAgentForm) addAgentForm.reset();
                if (newAgentQualificationsCheckboxes) newAgentQualificationsCheckboxes.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
                if (newAgentGradesCheckboxes) newAgentGradesCheckboxes.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
                loadAgents(); // Recharger les agents après l'ajout
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
            editAgentNewPassword.value = ''; // Toujours vider le champ du mot de passe
            editAgentMessage.textContent = '';

            const agentQualifications = JSON.parse(target.dataset.qualifications || '[]');
            const agentGrades = JSON.parse(target.dataset.grades || '[]');

            renderQualificationsCheckboxes(agentQualifications);
            renderGradesCheckboxes(agentGrades);

            editAgentModalElement.style.display = 'block';
        } else if (target.classList.contains('delete-btn')) {
            const confirmed = await confirmModal(`Êtes-vous sûr de vouloir supprimer l'agent ${agentId} ? Cette action est irréversible.`);
            if (confirmed) {
                try {
                    const response = await fetch(`${API_BASE_URL}/api/admin/agents/${agentId}`, {
                        method: 'DELETE',
                        headers: getAuthHeaders()
                    });
                    const data = await response.json();

                    if (response.ok) {
                        displayMessageModal("Succès", data.message, "success");
                        loadAgents(); // Recharger les agents après la suppression
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

        const selectedQualifications = Array.from(qualificationsCheckboxesDiv.querySelectorAll('input[type="checkbox"]:checked'))
            .map(checkbox => checkbox.value);
        const selectedGrades = Array.from(gradesCheckboxesDiv.querySelectorAll('input[type="checkbox"]:checked'))
            .map(checkbox => checkbox.value);


        editAgentMessage.textContent = 'Mise à jour en cours...';
        editAgentMessage.style.color = 'blue';

        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/agents/${id}`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify({ nom, prenom, newPassword, qualifications: selectedQualifications, grades: selectedGrades })
            });
            const data = await response.json();

            if (response.ok) {
                editAgentMessage.textContent = data.message;
                editAgentMessage.style.color = 'green';
                loadAgents(); // Recharger les agents après la mise à jour
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
                headers: getAuthHeaders()
            });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Erreur lors du chargement des qualifications.');
            }

            QUALIFICATIONS_DATA = data; // Met à jour la variable globale avec les données complètes

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
        const newQualIdInput = document.getElementById('newQualId');
        const newQualNameInput = document.getElementById('newQualName');

        if (!newQualIdInput || !newQualNameInput) {
            console.error("Erreur DOM: Les champs d'ajout de qualification sont introuvables.");
            displayMessageModal("Erreur de formulaire", "Impossible d'ajouter une qualification. Des éléments du formulaire sont manquants.", "error");
            return;
        }
        const id = newQualIdInput.value.trim();
        const name = newQualNameInput.value.trim();

        if (!addQualificationMessage) {
            console.warn("L'élément 'addQualificationMessage' est introuvable. Impossible d'afficher le statut d'ajout de qualification.");
        } else {
            addQualificationMessage.textContent = 'Ajout en cours...';
            addQualificationMessage.style.color = 'blue';
        }


        try {
            const response = await fetch(`${API_BASE_URL}/api/qualifications`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ id, name })
            });
            const data = await response.json();

            if (response.ok) {
                if (addQualificationMessage) addQualificationMessage.textContent = data.message;
                if (addQualificationMessage) addQualificationMessage.style.color = 'green';
                if (addQualificationFormElement) addQualificationFormElement.reset();
                await loadAvailableQualifications(); // Met à jour la liste globale des qualifs
                await loadQualificationsList(); // Rafraîchit le tableau des qualifs
                renderNewAgentQualificationsCheckboxes(); // Met à jour les checkboxes d'ajout d'agent
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
                        headers: getAuthHeaders()
                    });
                    const data = await response.json();

                    if (response.ok) {
                        displayMessageModal("Succès", data.message, "success");
                        await loadAvailableQualifications();
                        await loadQualificationsList();
                        renderNewAgentQualificationsCheckboxes(); // Met à jour les checkboxes après suppression
                        loadAgents(); // Recharger les agents car leurs qualifs peuvent avoir changé
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
                headers: getAuthHeaders(),
                body: JSON.stringify({ name })
            });
            const data = await response.json();

            if (response.ok) {
                editQualMessage.textContent = data.message;
                editQualMessage.style.color = 'green';
                await loadAvailableQualifications(); // Met à jour la liste globale des qualifs
                await loadQualificationsList(); // Rafraîchit le tableau
                renderNewAgentQualificationsCheckboxes(); // Met à jour les checkboxes après modification
                loadAgents(); // Recharger les agents car leurs qualifs peuvent avoir changé
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
                headers: getAuthHeaders()
            });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Erreur lors du chargement des grades.');
            }

            GRADES_DATA = data; // Met à jour la variable globale avec les données complètes

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
        } catch (error) {
            console.error('Erreur de chargement des grades:', error);
            if (listGradesMessage) {
                listGradesMessage.textContent = `Erreur : ${error.message}`;
                listGradesMessage.style.color = 'red';
            }
            if (gradesTableBody) gradesTableBody.innerHTML = '<tr><td colspan="3">Impossible de charger la liste des grades.</td></tr>';
        }
    }

    async function handleAddGrade(event) {
        event.preventDefault();
        const newGradeIdInput = document.getElementById('newGradeId');
        const newGradeNameInput = document.getElementById('newGradeName');

        if (!newGradeIdInput || !newGradeNameInput) {
            console.error("Erreur DOM: Les champs d'ajout de grade sont introuvables.");
            displayMessageModal("Erreur de formulaire", "Impossible d'ajouter un grade. Des éléments du formulaire sont manquants.", "error");
            return;
        }
        const id = newGradeIdInput.value.trim();
        const name = newGradeNameInput.value.trim();

        if (!addGradeMessage) {
            console.warn("L'élément 'addGradeMessage' est introuvable. Impossible d'afficher le statut d'ajout de grade.");
        } else {
            addGradeMessage.textContent = 'Ajout en cours...';
            addGradeMessage.style.color = 'blue';
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/grades`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ id, name })
            });
            const data = await response.json();

            if (response.ok) {
                if (addGradeMessage) addGradeMessage.textContent = data.message;
                if (addGradeMessage) addGradeMessage.style.color = 'green';
                if (addGradeFormElement) addGradeFormElement.reset();
                await loadAvailableGrades(); // Met à jour la liste globale des grades
                await loadGradesList(); // Rafraîchit le tableau des grades
                renderNewAgentGradesCheckboxes(); // Met à jour les checkboxes d'ajout d'agent
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
                        headers: getAuthHeaders()
                    });
                    const data = await response.json();

                    if (response.ok) {
                        displayMessageModal("Succès", data.message, "success");
                        await loadAvailableGrades();
                        await loadGradesList();
                        renderNewAgentGradesCheckboxes(); // Met à jour les checkboxes après suppression
                        loadAgents(); // Recharger les agents car leurs grades peuvent avoir changé
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
                headers: getAuthHeaders(),
                body: JSON.stringify({ name })
            });
            const data = await response.json();

            if (response.ok) {
                editGradeMessage.textContent = data.message;
                editGradeMessage.style.color = 'green';
                await loadAvailableGrades(); // Met à jour la liste globale des grades
                await loadGradesList(); // Rafraîchit le tableau
                renderNewAgentGradesCheckboxes(); // Met à jour les checkboxes après modification
                loadAgents(); // Recharger les agents car leurs grades peuvent avoir changé
            } else {
                editGradeMessage.textContent = `Erreur : ${data.message}`;
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

    // --- Fonctions CRUD pour la gestion des fonctions (Frontend) ---
    // Ces fonctions sont commentées car la section "Gestion des Fonctions" n'est pas présente dans admin.html.
    // Décommentez et assurez-vous d'avoir les éléments DOM correspondants si vous l'ajoutez.

    /*
    async function loadFunctionsList() {
        if (!listFunctionsMessage) {
            console.warn("L'élément 'listFunctionsMessage' est introuvable.");
        } else {
            listFunctionsMessage.textContent = 'Chargement des fonctions...';
            listFunctionsMessage.style.color = 'blue';
        }
        try {
            const response = await fetch(`${API_BASE_URL}/api/functions`, {
                headers: getAuthHeaders()
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || 'Erreur lors du chargement des fonctions.');
            }
            FUNCTIONS_DATA = data;
            renderFunctionsTable(); // Appelez la fonction pour rendre la table des fonctions
            if (listFunctionsMessage) listFunctionsMessage.textContent = '';
        } catch (error) {
            console.error('Erreur de chargement des fonctions:', error);
            if (listFunctionsMessage) {
                listFunctionsMessage.textContent = `Erreur : ${error.message}`;
                listFunctionsMessage.style.color = 'red';
            }
            if (functionsTableBody) functionsTableBody.innerHTML = '<tr><td colspan="3">Impossible de charger la liste des fonctions.</td></tr>';
        }
    }

    async function handleAddFunction(event) {
        event.preventDefault();
        const newFunctionIdInput = document.getElementById('newFunctionId');
        const newFunctionNameInput = document.getElementById('newFunctionName');
        if (!newFunctionIdInput || !newFunctionNameInput) {
            console.error("Erreur DOM: Les champs d'ajout de fonction sont introuvables.");
            displayMessageModal("Erreur de formulaire", "Impossible d'ajouter une fonction. Des éléments du formulaire sont manquants.", "error");
            return;
        }
        const id = newFunctionIdInput.value.trim();
        const name = newFunctionNameInput.value.trim();

        if (!addFunctionMessage) {
            console.warn("L'élément 'addFunctionMessage' est introuvable.");
        } else {
            addFunctionMessage.textContent = 'Ajout en cours...';
            addFunctionMessage.style.color = 'blue';
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/functions`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ id, name })
            });
            const data = await response.json();

            if (response.ok) {
                if (addFunctionMessage) addFunctionMessage.textContent = data.message;
                if (addFunctionMessage) addFunctionMessage.style.color = 'green';
                if (addFunctionFormElement) addFunctionFormElement.reset();
                await loadFunctionsList();
            } else {
                if (addFunctionMessage) addFunctionMessage.textContent = `Erreur : ${data.message}`;
                if (addFunctionMessage) addFunctionMessage.style.color = 'red';
            }
        } catch (error) {
            console.error('Erreur lors de l\'ajout de la fonction:', error);
            if (addFunctionMessage) {
                addFunctionMessage.textContent = 'Erreur réseau lors de l\'ajout de la fonction.';
                addFunctionMessage.style.color = 'red';
            }
        }
    }

    async function handleFunctionActions(event) {
        const target = event.target;
        const funcId = target.dataset.id;
        if (!funcId) return;

        if (target.classList.contains('edit-btn')) {
            const editFunctionId = document.getElementById('editFunctionId');
            const editFunctionName = document.getElementById('editFunctionName');
            const editFunctionMessage = document.getElementById('editFunctionMessage');
            const editFunctionModalElement = document.getElementById('editFunctionModal');
            if (!editFunctionId || !editFunctionName || !editFunctionMessage || !editFunctionModalElement) {
                console.error("Erreur DOM: Un ou plusieurs éléments de la modale d'édition de fonction sont introuvables.");
                displayMessageModal("Erreur d'affichage", "Impossible d'ouvrir la modale d'édition. Des éléments sont manquants.", "error");
                return;
            }
            editFunctionId.value = funcId;
            editFunctionName.value = target.dataset.name;
            editFunctionMessage.textContent = '';
            editFunctionModalElement.style.display = 'block';

        } else if (target.classList.contains('delete-btn')) {
            const confirmed = await confirmModal(`Êtes-vous sûr de vouloir supprimer la fonction "${funcId}" ?`);
            if (confirmed) {
                try {
                    const response = await fetch(`${API_BASE_URL}/api/functions/${funcId}`, {
                        method: 'DELETE',
                        headers: getAuthHeaders()
                    });
                    const data = await response.json();
                    if (response.ok) {
                        displayMessageModal("Succès", data.message, "success");
                        await loadFunctionsList();
                        await loadAgents();
                    } else {
                        displayMessageModal("Erreur", `Erreur lors de la suppression : ${data.message}`, "error");
                    }
                } catch (error) {
                    console.error('Erreur lors de la suppression de la fonction:', error);
                    displayMessageModal("Erreur", 'Erreur réseau lors de la suppression de la fonction.', "error");
                }
            }
        }
    }

    async function handleEditFunction(event) {
        event.preventDefault();
        const editFunctionId = document.getElementById('editFunctionId');
        const editFunctionName = document.getElementById('editFunctionName');
        const editFunctionMessage = document.getElementById('editFunctionMessage');
        if (!editFunctionId || !editFunctionName || !editFunctionMessage) {
            console.error("Erreur DOM: Un ou plusieurs éléments du formulaire d'édition de fonction sont introuvables.");
            displayMessageModal("Erreur de modification", "Impossible de modifier la fonction. Des éléments du formulaire sont manquants.", "error");
            return;
        }
        const id = editFunctionId.value.trim();
        const name = editFunctionName.value.trim();

        editFunctionMessage.textContent = 'Mise à jour en cours...';
        editFunctionMessage.style.color = 'blue';

        try {
            const response = await fetch(`${API_BASE_URL}/api/functions/${id}`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify({ name })
            });
            const data = await response.json();

            if (response.ok) {
                editFunctionMessage.textContent = data.message;
                editFunctionMessage.style.color = 'green';
                await loadFunctionsList();
                await loadAgents();
            } else {
                editFunctionMessage.textContent = `Erreur : ${data.message}`;
                if (editFunctionMessage) editFunctionMessage.style.color = 'red';
            }
        } catch (error) {
            console.error('Erreur lors de la mise à jour de la fonction:', error);
            if (editFunctionMessage) {
                editFunctionMessage.textContent = 'Erreur réseau lors de la mise à jour de la fonction.';
                editFunctionMessage.style.color = 'red';
            }
        }
    }
    */

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
            currentWeek = getCurrentISOWeek(new Date()); // Définit la semaine actuelle lors de l'ouverture
            generateWeekOptions(); // Génère les options pour le sélecteur de semaine
            updateDateRangeDisplay(); // Met à jour la plage de dates
            await loadPlanningData(); // Recharge le planning global
            showDay(currentDay); // Affiche le planning du jour actuel (initialise si besoin)

            const activeDayButton = document.querySelector(`.tab[data-day="${currentDay}"]`);
            if (activeDayButton) {
                tabButtons.forEach(btn => btn.classList.remove('active'));
                activeDayButton.classList.add('active');
            }
            if (headerPlanningControls) headerPlanningControls.style.display = 'flex';

        } else {
            if (headerPlanningControls) headerPlanningControls.style.display = 'none';
        }

        if (targetTabId === 'agent-management-view') {
            await loadAvailableQualifications();
            await loadAvailableGrades();
            // await loadFunctionsList(); // Décommenter si fonctions ajoutées
            renderNewAgentQualificationsCheckboxes();
            renderNewAgentGradesCheckboxes();
            // renderNewAgentFunctionsCheckboxes(); // Décommenter si fonctions ajoutées
            await loadAgents(); // S'assure que les agents sont chargés pour le tableau
        }

        if (targetTabId === 'qualification-management-view') {
            await loadQualificationsList(); // Charge et rend la liste des qualifications
        }

        if (targetTabId === 'grade-management-view') {
            await loadGradesList(); // Charge et rend la liste des grades
        }

        // if (targetTabId === 'function-management-view') { // Décommenter si fonctions ajoutées
        //     await loadFunctionsList();
        // }
    }


    /**
     * Gère l'affichage du planning pour un jour spécifique dans l'onglet "Planning Global".
     * @param {string} day Le jour à afficher (ex: 'lundi').
     */
    function showDay(day) {
        currentDay = day;
        tabButtons.forEach(tab => {
            if (tab.dataset.day === day) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });
        renderPlanningGrid(day);
    }


    // --- Initialisation au chargement du DOM ---
    async function initializeAdminPage() {
        const currentUserId = sessionStorage.getItem('agentId');
        const currentUserName = sessionStorage.getItem('agentPrenom') + ' ' + sessionStorage.getItem('agentNom');
        const currentUserRole = sessionStorage.getItem('userRole');
        const token = sessionStorage.getItem('token');

        console.log("DEBUG Admin: currentUserId:", currentUserId);
        console.log("DEBUG Admin: currentUserName:", currentUserName);
        console.log("DEBUG Admin: currentUserRole:", currentUserRole);
        console.log("DEBUG Admin: Token:", token ? "Présent" : "Absent");

        if (!currentUserId || !token) {
            console.error("Initialisation Admin: ID utilisateur ou Token manquant. Redirection vers login.");
            displayMessageModal("Session expirée", "Votre session a expiré ou n'est pas valide. Veuillez vous reconnecter.", "error", () => {
                window.location.href = "index.html";
            });
            return;
        }

        if (currentUserRole !== 'admin') {
            console.error("Initialisation Admin: Rôle incorrect pour cette page. Rôle actuel:", currentUserRole);
            displayMessageModal("Accès non autorisé", "Vous devez être connecté en tant qu'administrateur pour accéder à cette page.", "error", () => {
                if (currentUserRole === 'agent') {
                    window.location.href = "agent.html"; // Rediriger vers la page agent si c'est un agent
                } else {
                    window.location.href = "index.html";
                }
            });
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

        // Définir la semaine actuelle par défaut
        currentWeek = getCurrentISOWeek(new Date());

        // Important: Charger les données nécessaires AVANT d'ouvrir l'onglet par défaut
        await loadAvailableQualifications(); // Chargement des qualifications
        await loadAvailableGrades(); // Chargement des grades
        // await loadFunctionsList(); // Décommenter si vous avez une section Fonctions
        await loadAgents(); // Charger les détails des agents pour USERS_DATA

        // Ouvrir l'onglet "Planning Global" par défaut au chargement
        // Ceci appellera loadPlanningData et showDay
        await openMainTab('global-planning-view');


        // --- Écouteurs d'événements pour les contrôles du planning global ---
        if (weekSelect) {
            weekSelect.addEventListener("change", async () => {
                currentWeek = parseInt(weekSelect.value); // Utilisez directement le numéro de semaine
                updateDateRangeDisplay();
                await loadPlanningData(); // Recharge les données du planning pour la nouvelle semaine
                showDay(currentDay); // Réaffiche le planning pour le jour actif
            });
        }
        if (exportPdfButton) {
            exportPdfButton.addEventListener("click", exportPdf);
        } else {
            console.warn("L'élément 'export-pdf' est introuvable dans admin.html. Le bouton d'exportation PDF ne sera pas fonctionnel.");
        }

        // --- Écouteurs d'événements pour les boutons de navigation semaine (précédent/suivant) ---
        const prevWeekBtn = document.getElementById('prev-week-btn');
        const nextWeekBtn = document.getElementById('next-week-btn');

        if (prevWeekBtn) {
            prevWeekBtn.addEventListener('click', async () => {
                currentWeek--;
                generateWeekOptions(); // Mettre à jour les options du sélecteur
                weekSelect.value = currentWeek; // Sélectionner la nouvelle semaine
                updateDateRangeDisplay();
                await loadPlanningData();
                showDay(currentDay);
            });
        } else {
            console.warn("Le bouton 'prev-week-btn' est introuvable dans admin.html.");
        }

        if (nextWeekBtn) {
            nextWeekBtn.addEventListener('click', async () => {
                currentWeek++;
                generateWeekOptions(); // Mettre à jour les options du sélecteur
                weekSelect.value = currentWeek; // Sélectionner la nouvelle semaine
                updateDateRangeDisplay();
                await loadPlanningData();
                showDay(currentDay);
            });
        } else {
            console.warn("Le bouton 'next-week-btn' est introuvable dans admin.html.");
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
            if (event.target === editAgentModalElement) {
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
    }

    // Appeler la fonction d'initialisation au chargement complet du DOM
    await initializeAdminPage();
});

