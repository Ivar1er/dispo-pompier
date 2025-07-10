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
            return { 'Content-Type': 'application/json' };
        }
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    }


    // --- Fonctions de chargement des données (Appels API) ---

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
                    return;
                }
                throw new Error(data.message || 'Erreur lors du chargement du planning global.');
            }

            GLOBAL_PLANNING_DATA = data;
            console.log("DEBUG Admin: Planning Global Chargé (Admin):", GLOBAL_PLANNING_DATA);

        } catch (error) {
            console.error('Erreur lors du chargement du planning global:', error);
            GLOBAL_PLANNING_DATA = {};
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
            th.colSpan = 2;
            headerRow.appendChild(th);
        }
        for (let h = 0; h < 7; h++) {
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

        // Préparer la liste des agents avec leur statut de disponibilité
        const agentsWithAvailabilityStatus = Object.keys(USERS_DATA)
            .map(id => {
                const agent = USERS_DATA[id];
                if (!agent || (agent.role !== 'agent' && agent.role !== 'admin')) {
                    return null; // Ignorer les utilisateurs non-agents ou sans rôle défini
                }
                // --- DÉBUT MODIFICATION: Masquer l'agent "Admin Admin" ---
                if (agent.prenom === 'Admin' && agent.nom === 'Admin') {
                    return null; // Ignore l'agent 'Admin Admin'
                }
                // --- FIN MODIFICATION ---

                // Vérifier si l'agent a au moins un créneau disponible pour le jour et la semaine actuels
                const agentSpecificDayPlanning = GLOBAL_PLANNING_DATA[agent.id]?.[weekKey]?.[day] || [];
                const hasAvailability = agentSpecificDayPlanning.length > 0;

                return { ...agent, hasAvailability };
            })
            .filter(agent => agent !== null); // Supprimer les nulls

        // Trier les agents : ceux avec disponibilité en premier, puis ceux sans, puis par nom
        agentsWithAvailabilityStatus.sort((a, b) => {
            // Tri principal : disponibilité (true > false)
            if (a.hasAvailability !== b.hasAvailability) {
                return b.hasAvailability - a.hasAvailability; // true (1) vient avant false (0)
            }
            // Tri secondaire : par nom de famille
            return a.nom.localeCompare(b.nom);
        });


        if (agentsWithAvailabilityStatus.length === 0) {
            const noAgentsRow = document.createElement('tr');
            noAgentsRow.innerHTML = `<td colspan="49">Aucun agent à afficher ou données d'agents manquantes.</td>`;
            tbody.appendChild(noAgentsRow);
        } else {
            agentsWithAvailabilityStatus.forEach(agent => {
                const agentRow = document.createElement('tr');
                // Ajoute la classe 'unavailable-agent-row' si l'agent n'a pas de disponibilité
                if (!agent.hasAvailability) {
                    agentRow.classList.add('unavailable-agent-row');
                }

                const agentNameCell = document.createElement('td');
                agentNameCell.classList.add('agent-name-cell');
                agentNameCell.textContent = `${agent.prenom} ${agent.nom}`; // Nom complet de l'agent
                agentRow.appendChild(agentNameCell);

                const agentSpecificDayPlanning = GLOBAL_PLANNING_DATA[agent.id]?.[weekKey]?.[day] || [];

                horaires.forEach((_, index) => {
                    const slotCell = document.createElement('td');
                    slotCell.classList.add('slot-cell');

                    let timeRangeForTooltip = 'Indisponible'; // Valeur par défaut

                    // Trouver le bloc de disponibilité spécifique qui couvre ce créneau de 30 min
                    const coveringAvailability = agentSpecificDayPlanning.find(slot => {
                        return index >= slot.start && index <= slot.end;
                    });

                    if (coveringAvailability) {
                        slotCell.classList.add('available-slot-cell');
                        // Construire la plage horaire complète pour le tooltip à partir du bloc trouvé
                        const startTime = horaires[coveringAvailability.start].split(' - ')[0];
                        const endTime = horaires[coveringAvailability.end].split(' - ')[1];
                        timeRangeForTooltip = `${startTime} - ${endTime}`;
                    } else {
                        slotCell.classList.add('unavailable-slot-cell');
                    }
                    slotCell.setAttribute('data-time-range', timeRangeForTooltip); // Ajoute l'attribut data-time-range

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
                if (el.id !== 'logout-btn' && el.id !== 'export-pdf') {
                    el.disabled = true;
                    if (el.tagName === 'A') el.classList.add('disabled-link');
                }
            });
            mainTabButtons.forEach(btn => btn.disabled = true);
            tabButtons.forEach(btn => btn.disabled = true);
            if (headerPlanningControls) headerPlanningControls.style.display = 'none';

            if (adminInfo && forPdf) {
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
            mainTabButtons.forEach(btn => btn.disabled = false);
            tabButtons.forEach(btn => btn.disabled = false);

            const globalPlanningView = document.getElementById('global-planning-view');
            if (globalPlanningView && globalPlanningView.classList.contains('active') && headerPlanningControls) {
                headerPlanningControls.style.display = 'flex';
            } else if (headerPlanningControls) {
                headerPlanningControls.style.display = 'none';
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
                if (callback) callback(false);
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

        const originalContainerOverflowX = container ? container.style.overflowX : '';
        const originalTableWhiteSpace = table.style.whiteSpace;
        const originalTableLayout = table.style.tableLayout;
        const originalHeaderCellWidths = {};
        const headerCells = table.querySelectorAll('.time-header-cell');
        headerCells.forEach((cell, index) => {
            originalHeaderCellWidths[index] = cell.style.width;
            cell.style.width = '60px';
        });

        showLoading(true, true);

        try {
            if (container) container.style.overflowX = "visible";
            table.style.whiteSpace = "nowrap";
            table.style.tableLayout = "auto";

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
            if (container) container.style.overflowX = originalContainerOverflowX;
            table.style.whiteSpace = originalTableWhiteSpace;
            table.style.tableLayout = originalTableLayout;
            headerCells.forEach((cell, index) => {
                cell.style.width = originalHeaderCellWidths[index];
            });

            showLoading(false, true);
            if (wasLoading && loadingSpinner) {
                loadingSpinner.classList.remove("hidden");
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
            QUALIFICATIONS_DATA = data;
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
            GRADES_DATA = data;
            console.log('Grades disponibles chargées:', GRADES_DATA);
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


    async function loadUsers() {
        showLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/users`, { headers: getAuthHeaders() });
            const data = await response.json();
            if (!response.ok) {
                if (response.status === 403 || response.status === 401) {
                    displayMessageModal("Accès Refusé", "Vous n'avez pas l'autorisation de gérer les agents ou votre session a expiré. Veuillez vous reconnecter.", "error", () => {
                        sessionStorage.clear();
                        window.location.href = "/index.html";
                    });
                    return;
                }
                throw new Error(data.message || 'Erreur lors du chargement des agents.');
            }
            // Transformez le tableau en objet pour un accès facile par ID
            USERS_DATA = data.reduce((acc, user) => {
                acc[user.id] = user;
                return acc;
            }, {});
            renderAgentsTable();
            if (listAgentsMessage) listAgentsMessage.textContent = '';
            console.log('Utilisateurs chargés:', USERS_DATA);
        } catch (error) {
            console.error('Erreur lors du chargement des agents:', error);
            if (listAgentsMessage) {
                listAgentsMessage.textContent = `Erreur de chargement des agents: ${error.message}`;
                listAgentsMessage.style.color = 'red';
            }
        } finally {
            showLoading(false);
        }
    }

    async function handleAddAgent(event) {
        event.preventDefault();
        if (!addAgentForm) return;

        const nom = addAgentForm.newAgentNom.value;
        const prenom = addAgentForm.newAgentPrenom.value;
        const email = addAgentForm.newAgentEmail.value;
        const password = addAgentForm.newAgentPassword.value;
        const role = addAgentForm.newAgentRole.value;

        const selectedQualifications = Array.from(newAgentQualificationsCheckboxes.querySelectorAll('input[type="checkbox"]:checked'))
            .map(cb => cb.value);
        const selectedGrades = Array.from(newAgentGradesCheckboxes.querySelectorAll('input[type="checkbox"]:checked'))
            .map(cb => cb.value);


        try {
            const response = await fetch(`${API_BASE_URL}/api/users/register`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ nom, prenom, email, password, role, qualifications: selectedQualifications, grades: selectedGrades })
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || 'Erreur lors de l\'ajout de l\'agent.');
            }
            if (addAgentMessage) {
                addAgentMessage.textContent = 'Agent ajouté avec succès!';
                addAgentMessage.style.color = 'green';
            }
            addAgentForm.reset();
            renderNewAgentQualificationsCheckboxes(); // Réinitialiser les checkboxes après l'ajout
            renderNewAgentGradesCheckboxes(); // Réinitialiser les grades après l'ajout
            await loadUsers(); // Recharger la liste des agents
        } catch (error) {
            console.error('Erreur lors de l\'ajout de l\'agent:', error);
            if (addAgentMessage) {
                addAgentMessage.textContent = `Erreur: ${error.message}`;
                addAgentMessage.style.color = 'red';
            }
        }
    }

    function renderAgentsTable() {
        if (!agentsTableBody) {
            console.error("L'élément 'agentsTableBody' est introuvable.");
            return;
        }
        agentsTableBody.innerHTML = '';
        const usersArray = Object.values(USERS_DATA);
        if (usersArray.length === 0) {
            if (listAgentsMessage) {
                listAgentsMessage.textContent = "Aucun agent enregistré.";
                listAgentsMessage.style.color = 'orange';
            }
            return;
        }

        // Trier les utilisateurs par rôle (admin en premier), puis par nom et prénom
        const sortedUsers = usersArray.sort((a, b) => {
            if (a.role === 'admin' && b.role !== 'admin') return -1;
            if (a.role !== 'admin' && b.role === 'admin') return 1;
            const nameComparison = a.nom.localeCompare(b.nom);
            if (nameComparison !== 0) return nameComparison;
            return a.prenom.localeCompare(b.prenom);
        });

        sortedUsers.forEach(user => {
            // Ne pas afficher l'agent "Admin Admin" dans la table de gestion des agents non plus
            if (user.prenom === 'Admin' && user.nom === 'Admin') {
                return;
            }

            const row = agentsTableBody.insertRow();
            row.dataset.userId = user.id;

            const fullNameCell = row.insertCell();
            fullNameCell.textContent = `${user.prenom} ${user.nom}`;

            const emailCell = row.insertCell();
            emailCell.textContent = user.email;

            const roleCell = row.insertCell();
            roleCell.textContent = user.role;

            const qualificationsCell = row.insertCell();
            const userQualificationNames = (user.qualifications || [])
                .map(qId => {
                    const qual = QUALIFICATIONS_DATA.find(q => q.id === qId);
                    return qual ? qual.name : 'Inconnue';
                })
                .join(', ');
            qualificationsCell.textContent = userQualificationNames;
            qualificationsCell.classList.add('qualifications-cell');

            const gradesCell = row.insertCell();
            const userGradeNames = (user.grades || [])
                .map(gId => {
                    const grade = GRADES_DATA.find(g => g.id === gId);
                    return grade ? grade.name : 'Inconnu';
                })
                .join(', ');
            gradesCell.textContent = userGradeNames;
            gradesCell.classList.add('grades-cell');

            const actionsCell = row.insertCell();
            actionsCell.classList.add('actions-cell');

            const editButton = document.createElement('button');
            editButton.textContent = 'Modifier';
            editButton.classList.add('btn', 'btn-secondary', 'btn-edit-agent');
            editButton.dataset.id = user.id;
            actionsCell.appendChild(editButton);

            const deleteButton = document.createElement('button');
            deleteButton.textContent = 'Supprimer';
            deleteButton.classList.add('btn', 'btn-danger', 'btn-delete-agent');
            deleteButton.dataset.id = user.id;
            actionsCell.appendChild(deleteButton);
        });
        if (listAgentsMessage) listAgentsMessage.textContent = '';
    }

    async function handleAgentActions(event) {
        if (event.target.classList.contains('btn-edit-agent')) {
            const userId = event.target.dataset.id;
            await openEditAgentModal(userId);
        } else if (event.target.classList.contains('btn-delete-agent')) {
            const userId = event.target.dataset.id;
            const user = USERS_DATA[userId];

            if (!user) {
                displayMessageModal("Erreur", "Agent introuvable.", "error");
                return;
            }
            if (user.role === 'admin') {
                displayMessageModal("Interdit", "Vous ne pouvez pas supprimer un administrateur via cette interface.", "warning");
                return;
            }

            const confirmDelete = await confirmModal(`Êtes-vous sûr de vouloir supprimer l'agent ${user.prenom} ${user.nom} ? Cette action est irréversible.`);
            if (confirmDelete) {
                await deleteAgent(userId);
            }
        }
    }

    async function openEditAgentModal(userId) {
        const user = USERS_DATA[userId];
        if (!user) {
            displayMessageModal("Erreur", "Agent introuvable pour modification.", "error");
            return;
        }

        if (!editAgentModalElement || !editAgentFormElement || !editAgentId || !editAgentNom || !editAgentPrenom || !editAgentNewPassword) {
            console.error("Un ou plusieurs éléments DOM de la modale d'édition d'agent sont manquants.");
            displayMessageModal("Erreur", "Impossible d'ouvrir la modale de modification. Des éléments sont manquants.", "error");
            return;
        }

        editAgentId.value = user.id;
        editAgentNom.value = user.nom;
        editAgentPrenom.value = user.prenom;
        editAgentNewPassword.value = ''; // Toujours vider le mot de passe pour la sécurité

        const currentAgentQualifications = user.qualifications || [];
        await loadAvailableQualifications(); // S'assurer que les qualifications sont chargées
        renderQualificationsCheckboxes(currentAgentQualifications);

        const currentAgentGrades = user.grades || [];
        await loadAvailableGrades(); // S'assurer que les grades sont chargés
        renderGradesCheckboxes(currentAgentGrades);

        editAgentModalElement.style.display = 'flex';
        if (editAgentMessage) {
            editAgentMessage.textContent = ''; // Clear previous messages
        }
    }

    async function handleEditAgent(event) {
        event.preventDefault();
        if (!editAgentFormElement || !editAgentId) return;

        const userId = editAgentId.value;
        const nom = editAgentNom.value;
        const prenom = editAgentPrenom.value;
        const password = editAgentNewPassword.value; // Peut être vide si pas de changement
        const role = document.getElementById('editAgentRole').value; // Récupère le rôle de la modale

        const selectedQualifications = Array.from(qualificationsCheckboxesDiv.querySelectorAll('input[type="checkbox"]:checked'))
            .map(cb => cb.value);

        const selectedGrades = Array.from(gradesCheckboxesDiv.querySelectorAll('input[type="checkbox"]:checked'))
            .map(cb => cb.value);

        try {
            const body = { nom, prenom, role, qualifications: selectedQualifications, grades: selectedGrades };
            if (password) { // Seulement si le mot de passe a été modifié
                body.password = password;
            }

            const response = await fetch(`${API_BASE_URL}/api/users/${userId}`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify(body)
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || 'Erreur lors de la modification de l\'agent.');
            }
            if (editAgentMessage) {
                editAgentMessage.textContent = 'Agent modifié avec succès!';
                editAgentMessage.style.color = 'green';
            }
            editAgentModalElement.style.display = 'none';
            await loadUsers(); // Recharger la liste des agents
        } catch (error) {
            console.error('Erreur lors de la modification de l\'agent:', error);
            if (editAgentMessage) {
                editAgentMessage.textContent = `Erreur: ${error.message}`;
                editAgentMessage.style.color = 'red';
            }
        }
    }

    async function deleteAgent(userId) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/users/${userId}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || 'Erreur lors de la suppression de l\'agent.');
            }
            displayMessageModal("Succès", "Agent supprimé avec succès!", "success");
            await loadUsers(); // Recharger la liste des agents
        } catch (error) {
            console.error('Erreur lors de la suppression de l\'agent:', error);
            displayMessageModal("Erreur", `Impossible de supprimer l'agent: ${error.message}`, "error");
        }
    }


    // --- Fonctions de gestion des Qualifications API ---

    async function handleAddQualification(event) {
        event.preventDefault();
        if (!addQualificationFormElement) return;

        const name = addQualificationFormElement.newQualificationName.value;

        try {
            const response = await fetch(`${API_BASE_URL}/api/qualifications`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ name })
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || 'Erreur lors de l\'ajout de la qualification.');
            }
            if (addQualificationMessage) {
                addQualificationMessage.textContent = 'Qualification ajoutée avec succès!';
                addQualificationMessage.style.color = 'green';
            }
            addQualificationFormElement.reset();
            await loadAvailableQualifications(); // Recharger les qualifications
            renderQualificationsTable(); // Mettre à jour le tableau
        } catch (error) {
            console.error('Erreur lors de l\'ajout de la qualification:', error);
            if (addQualificationMessage) {
                addQualificationMessage.textContent = `Erreur: ${error.message}`;
                addQualificationMessage.style.color = 'red';
            }
        }
    }

    function renderQualificationsTable() {
        if (!qualificationsTableBody) {
            console.error("L'élément 'qualificationsTableBody' est introuvable.");
            return;
        }
        qualificationsTableBody.innerHTML = '';
        if (QUALIFICATIONS_DATA.length === 0) {
            if (listQualificationsMessage) {
                listQualificationsMessage.textContent = "Aucune qualification enregistrée.";
                listQualificationsMessage.style.color = 'orange';
            }
            return;
        }
        QUALIFICATIONS_DATA.forEach(qual => {
            const row = qualificationsTableBody.insertRow();
            row.dataset.qualId = qual.id;

            const nameCell = row.insertCell();
            nameCell.textContent = qual.name;

            const actionsCell = row.insertCell();
            actionsCell.classList.add('actions-cell');

            const editButton = document.createElement('button');
            editButton.textContent = 'Modifier';
            editButton.classList.add('btn', 'btn-secondary', 'btn-edit-qual');
            editButton.dataset.id = qual.id;
            actionsCell.appendChild(editButton);

            const deleteButton = document.createElement('button');
            deleteButton.textContent = 'Supprimer';
            deleteButton.classList.add('btn', 'btn-danger', 'btn-delete-qual');
            deleteButton.dataset.id = qual.id;
            actionsCell.appendChild(deleteButton);
        });
        if (listQualificationsMessage) listQualificationsMessage.textContent = '';
    }

    async function handleQualificationActions(event) {
        if (event.target.classList.contains('btn-edit-qual')) {
            const qualId = event.target.dataset.id;
            await openEditQualificationModal(qualId);
        } else if (event.target.classList.contains('btn-delete-qual')) {
            const qualId = event.target.dataset.id;
            const qual = QUALIFICATIONS_DATA.find(q => q.id === qualId);

            if (!qual) {
                displayMessageModal("Erreur", "Qualification introuvable.", "error");
                return;
            }

            const confirmDelete = await confirmModal(`Êtes-vous sûr de vouloir supprimer la qualification "${qual.name}" ? Cela la retirera de tous les agents qui la possèdent.`);
            if (confirmDelete) {
                await deleteQualification(qualId);
            }
        }
    }

    async function openEditQualificationModal(qualId) {
        const qual = QUALIFICATIONS_DATA.find(q => q.id === qualId);
        if (!qual) {
            displayMessageModal("Erreur", "Qualification introuvable pour modification.", "error");
            return;
        }

        if (!editQualificationModalElement || !editQualificationFormElement || !editQualId || !editQualName) {
            console.error("Un ou plusieurs éléments DOM de la modale d'édition de qualification sont manquants.");
            displayMessageModal("Erreur", "Impossible d'ouvrir la modale de modification. Des éléments sont manquants.", "error");
            return;
        }

        editQualId.value = qual.id;
        editQualName.value = qual.name;
        editQualificationModalElement.style.display = 'flex';
        if (editQualMessage) {
            editQualMessage.textContent = '';
        }
    }

    async function handleEditQualification(event) {
        event.preventDefault();
        if (!editQualificationFormElement || !editQualId) return;

        const qualId = editQualId.value;
        const name = editQualName.value;

        try {
            const response = await fetch(`${API_BASE_URL}/api/qualifications/${qualId}`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify({ name })
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || 'Erreur lors de la modification de la qualification.');
            }
            if (editQualMessage) {
                editQualMessage.textContent = 'Qualification modifiée avec succès!';
                editQualMessage.style.color = 'green';
            }
            editQualificationModalElement.style.display = 'none';
            await loadAvailableQualifications(); // Recharger les qualifications
            renderQualificationsTable(); // Mettre à jour le tableau
            await loadUsers(); // Recharger les utilisateurs pour refléter les changements de qualifs
        } catch (error) {
            console.error('Erreur lors de la modification de la qualification:', error);
            if (editQualMessage) {
                editQualMessage.textContent = `Erreur: ${error.message}`;
                editQualMessage.style.color = 'red';
            }
        }
    }

    async function deleteQualification(qualId) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/qualifications/${qualId}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || 'Erreur lors de la suppression de la qualification.');
            }
            displayMessageModal("Succès", "Qualification supprimée avec succès!", "success");
            await loadAvailableQualifications(); // Recharger les qualifications
            renderQualificationsTable(); // Mettre à jour le tableau
            await loadUsers(); // Recharger les utilisateurs pour refléter les changements de qualifs
        } catch (error) {
            console.error('Erreur lors de la suppression de la qualification:', error);
            displayMessageModal("Erreur", `Impossible de supprimer la qualification: ${error.message}`, "error");
        }
    }


    // --- Fonctions de gestion des Grades API ---

    async function handleAddGrade(event) {
        event.preventDefault();
        if (!addGradeFormElement) return;

        const name = addGradeFormElement.newGradeName.value;

        try {
            const response = await fetch(`${API_BASE_URL}/api/grades`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ name })
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || 'Erreur lors de l\'ajout du grade.');
            }
            if (addGradeMessage) {
                addGradeMessage.textContent = 'Grade ajouté avec succès!';
                addGradeMessage.style.color = 'green';
            }
            addGradeFormElement.reset();
            await loadAvailableGrades(); // Recharger les grades
            renderGradesTable(); // Mettre à jour le tableau
        } catch (error) {
            console.error('Erreur lors de l\'ajout du grade:', error);
            if (addGradeMessage) {
                addGradeMessage.textContent = `Erreur: ${error.message}`;
                addGradeMessage.style.color = 'red';
            }
        }
    }

    function renderGradesTable() {
        if (!gradesTableBody) {
            console.error("L'élément 'gradesTableBody' est introuvable.");
            return;
        }
        gradesTableBody.innerHTML = '';
        if (GRADES_DATA.length === 0) {
            if (listGradesMessage) {
                listGradesMessage.textContent = "Aucun grade enregistré.";
                listGradesMessage.style.color = 'orange';
            }
            return;
        }
        GRADES_DATA.forEach(grade => {
            const row = gradesTableBody.insertRow();
            row.dataset.gradeId = grade.id;

            const nameCell = row.insertCell();
            nameCell.textContent = grade.name;

            const actionsCell = row.insertCell();
            actionsCell.classList.add('actions-cell');

            const editButton = document.createElement('button');
            editButton.textContent = 'Modifier';
            editButton.classList.add('btn', 'btn-secondary', 'btn-edit-grade');
            editButton.dataset.id = grade.id;
            actionsCell.appendChild(editButton);

            const deleteButton = document.createElement('button');
            deleteButton.textContent = 'Supprimer';
            deleteButton.classList.add('btn', 'btn-danger', 'btn-delete-grade');
            deleteButton.dataset.id = grade.id;
            actionsCell.appendChild(deleteButton);
        });
        if (listGradesMessage) listGradesMessage.textContent = '';
    }

    async function handleGradeActions(event) {
        if (event.target.classList.contains('btn-edit-grade')) {
            const gradeId = event.target.dataset.id;
            await openEditGradeModal(gradeId);
        } else if (event.target.classList.contains('btn-delete-grade')) {
            const gradeId = event.target.dataset.id;
            const grade = GRADES_DATA.find(g => g.id === gradeId);

            if (!grade) {
                displayMessageModal("Erreur", "Grade introuvable.", "error");
                return;
            }

            const confirmDelete = await confirmModal(`Êtes-vous sûr de vouloir supprimer le grade "${grade.name}" ? Cela le retirera de tous les agents qui le possèdent.`);
            if (confirmDelete) {
                await deleteGrade(gradeId);
            }
        }
    }

    async function openEditGradeModal(gradeId) {
        const grade = GRADES_DATA.find(g => g.id === gradeId);
        if (!grade) {
            displayMessageModal("Erreur", "Grade introuvable pour modification.", "error");
            return;
        }

        if (!editGradeModalElement || !editGradeFormElement || !editGradeId || !editGradeName) {
            console.error("Un ou plusieurs éléments DOM de la modale d'édition de grade sont manquants.");
            displayMessageModal("Erreur", "Impossible d'ouvrir la modale de modification. Des éléments sont manquants.", "error");
            return;
        }

        editGradeId.value = grade.id;
        editGradeName.value = grade.name;
        editGradeModalElement.style.display = 'flex';
        if (editGradeMessage) {
            editGradeMessage.textContent = '';
        }
    }

    async function handleEditGrade(event) {
        event.preventDefault();
        if (!editGradeFormElement || !editGradeId) return;

        const gradeId = editGradeId.value;
        const name = editGradeName.value;

        try {
            const response = await fetch(`${API_BASE_URL}/api/grades/${gradeId}`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify({ name })
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || 'Erreur lors de la modification du grade.');
            }
            if (editGradeMessage) {
                editGradeMessage.textContent = 'Grade modifié avec succès!';
                editGradeMessage.style.color = 'green';
            }
            editGradeModalElement.style.display = 'none';
            await loadAvailableGrades(); // Recharger les grades
            renderGradesTable(); // Mettre à jour le tableau
            await loadUsers(); // Recharger les utilisateurs pour refléter les changements de grades
        } catch (error) {
            console.error('Erreur lors de la modification du grade:', error);
            if (editGradeMessage) {
                editGradeMessage.textContent = `Erreur: ${error.message}`;
                editGradeMessage.style.color = 'red';
            }
        }
    }

    async function deleteGrade(gradeId) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/grades/${gradeId}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || 'Erreur lors de la suppression du grade.');
            }
            displayMessageModal("Succès", "Grade supprimé avec succès!", "success");
            await loadAvailableGrades(); // Recharger les grades
            renderGradesTable(); // Mettre à jour le tableau
            await loadUsers(); // Recharger les utilisateurs pour refléter les changements de grades
        } catch (error) {
            console.error('Erreur lors de la suppression du grade:', error);
            displayMessageModal("Erreur", `Impossible de supprimer le grade: ${error.message}`, "error");
        }
    }


    // --- Initialisation de la page ---
    async function initializeAdminPage() {
        const token = getToken();
        if (!token) {
            console.warn("Pas de token JWT trouvé, redirection vers la page de connexion.");
            window.location.href = "index.html";
            return;
        }

        // Récupérer le nom de l'utilisateur connecté pour l'afficher
        const adminNameDisplay = document.getElementById('admin-name-display');
        const loggedInUser = JSON.parse(sessionStorage.getItem('loggedInUser'));
        if (loggedInUser && adminNameDisplay) {
            adminNameDisplay.textContent = `Bienvenue, ${loggedInUser.prenom} ${loggedInUser.nom} !`;
        } else if (adminNameDisplay) {
            adminNameDisplay.textContent = "Bienvenue, Administrateur !";
        }


        // Tabs navigation setup
        mainTabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetTabId = button.dataset.tab;

                mainTabContents.forEach(content => {
                    if (content.id === targetTabId) {
                        content.classList.add('active');
                    } else {
                        content.classList.remove('active');
                    }
                });

                mainTabButtons.forEach(btn => {
                    if (btn === button) {
                        btn.classList.add('active');
                    } else {
                        btn.classList.remove('active');
                    }
                });

                // Gérer la visibilité des contrôles de planning en fonction de l'onglet actif
                if (headerPlanningControls) {
                    if (targetTabId === 'global-planning-view') {
                        headerPlanningControls.style.display = 'flex';
                    } else {
                        headerPlanningControls.style.display = 'none';
                    }
                }

                // Charger les données spécifiques à l'onglet
                if (targetTabId === 'global-planning-view') {
                    // S'assure que currentWeek est défini pour le planning global
                    if (!currentWeek) {
                        currentWeek = getCurrentISOWeek(); // Définit la semaine actuelle si non définie
                        generateWeekOptions(); // Génère les options pour le sélecteur de semaine
                        updateDateRangeDisplay(); // Met à jour la plage de dates
                    }
                    loadPlanningData().then(() => renderPlanningGrid(currentDay)); // Charger et rendre le planning pour le jour actuel
                } else if (targetTabId === 'manage-agents-view') {
                    loadUsers();
                    loadAvailableQualifications(); // Charger les qualifications pour le formulaire d'ajout/édition
                    loadAvailableGrades(); // Charger les grades pour le formulaire d'ajout/édition
                    renderNewAgentQualificationsCheckboxes(); // Rendre les checkboxes pour le nouvel agent
                    renderNewAgentGradesCheckboxes(); // Rendre les checkboxes pour le nouvel agent
                } else if (targetTabId === 'manage-qualifications-view') {
                    loadAvailableQualifications().then(renderQualificationsTable);
                } else if (targetTabId === 'manage-grades-view') {
                    loadAvailableGrades().then(renderGradesTable);
                }
            });
        });

        // Initialisation de la vue par défaut (Planning Global)
        const defaultTab = document.querySelector('.main-tab[data-tab="global-planning-view"]');
        if (defaultTab) {
            defaultTab.click(); // Simule un clic pour charger la vue par défaut
        }

        // Écouteurs d'événements spécifiques à l'onglet "Planning Global"
        if (weekSelect) {
            weekSelect.addEventListener('change', (event) => {
                currentWeek = parseInt(event.target.value);
                updateDateRangeDisplay();
                loadPlanningData().then(() => renderPlanningGrid(currentDay));
            });
        } else {
            console.warn("L'élément 'week-select' est introuvable dans admin.html.");
        }

        // Écouteurs pour les boutons de jour
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                tabButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                currentDay = button.dataset.day; // Assurez-vous que data-day est défini dans admin.html
                renderPlanningGrid(currentDay);
            });
        });
        // Active le bouton du lundi par défaut
        const defaultDayTab = document.querySelector('.tab[data-day="lundi"]');
        if (defaultDayTab) {
            defaultDayTab.classList.add('active');
        }

        // Écouteur pour le bouton d'export PDF
        if (exportPdfButton) {
            exportPdfButton.addEventListener('click', exportPdf);
        } else {
            console.warn("Le bouton d'export PDF est introuvable dans admin.html.");
        }


        // --- Écouteurs d'événements pour la vue "Gestion des Agents" ---
        if (addAgentForm) {
            addAgentForm.addEventListener('submit', handleAddAgent);
        } else {
            console.warn("Le formulaire d'ajout d'agent est introuvable dans admin.html.");
        }

        if (agentsTableBody) {
            agentsTableBody.addEventListener('click', handleAgentActions);
        } else {
            console.warn("Le corps de la table des agents est introuvable dans admin.html.");
        }

        if (editAgentModalElement && closeEditAgentModalButton) {
            closeEditAgentModalButton.addEventListener('click', () => {
                editAgentModalElement.style.display = 'none';
            });
        } else {
            console.warn("La modale d'édition d'agent ou son bouton de fermeture est introuvable dans admin.html.");
        }

        if (editAgentFormElement) {
            editAgentFormElement.addEventListener('submit', handleEditAgent);
        } else {
            console.warn("Le formulaire d'édition d'agent est introuvable dans admin.html.");
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