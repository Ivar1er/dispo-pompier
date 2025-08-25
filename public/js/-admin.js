// admin.js

document.addEventListener('DOMContentLoaded', async () => {
    const API_BASE_URL = "https://dispo-pompier.onrender.com";

    // --- Variables globales pour le stockage des donnÃ©es (localement) ---
    let USERS_DATA = {}; // Contient les donnÃ©es complÃ¨tes des agents
    let QUALIFICATIONS_DATA = [];
    let GRADES_DATA = [];
    // let FUNCTIONS_DATA = []; // CommentÃ© car non prÃ©sent dans admin.html
    let GLOBAL_PLANNING_DATA = {};

    // --- Ã‰lÃ©ments du DOM pour la navigation principale (onglets) ---
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
    let currentDay = 'lundi'; // Jour actuel par dÃ©faut pour le planning (nom du jour en minuscules)
    const days = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
    const horaires = []; // CrÃ©neaux 30 min sur 24h, de 07h00 Ã  06h30
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


    // --- Helpers de date (utilisÃ©s pour la structuration des plannings) ---
    /**
     * Calcule le numÃ©ro de semaine ISO 8601 pour une date donnÃ©e.
     * La semaine 1 est celle qui contient le premier jeudi de l'annÃ©e.
     * @param {Date} date - La date pour laquelle calculer le numÃ©ro de semaine.
     * @returns {number} Le numÃ©ro de semaine ISO 8601.
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
     * RÃ©cupÃ¨re la plage de dates (dÃ©but-fin) pour un numÃ©ro de semaine ISO donnÃ©.
     * @param {number} weekNumber - Le numÃ©ro de semaine ISO.
     * @param {number} year - L'annÃ©e.
     * @returns {string} La plage de dates formatÃ©e (ex: "du 16/06 au 22/06").
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
     * Retourne le lundi de la semaine ISO spÃ©cifiÃ©e.
     * @param {number} weekNum - Le numÃ©ro de semaine ISO.
     * @param {number} year - L'annÃ©e.
     * @returns {Date} L'objet Date reprÃ©sentant le lundi de la semaine.
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


    // Fonction pour rÃ©cupÃ©rer le token JWT
    function getToken() {
        return sessionStorage.getItem('token');
    }

    // Fonction pour obtenir les en-tÃªtes d'autorisation
    function getAuthHeaders() {
        const token = getToken();
        if (!token) {
            console.error("Token non trouvÃ©. Redirection ou gestion de l'erreur.");
            return { 'Content-Type': 'application/json' };
        }
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    }


    // --- Fonctions de chargement des donnÃ©es (Appels API) ---

    async function loadPlanningData() {
        showLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/planning`, {
                headers: getAuthHeaders()
            });
            const data = await response.json();
            if (!response.ok) {
                if (response.status === 403 || response.status === 401) {
                    displayMessageModal("AccÃ¨s RefusÃ©", "Vous n'avez pas l'autorisation de consulter le planning global ou votre session a expirÃ©. Veuillez vous reconnecter.", "error", () => {
                        sessionStorage.clear();
                        window.location.href = "/index.html";
                    });
                    return;
                }
                throw new Error(data.message || 'Erreur lors du chargement du planning global.');
            }

            GLOBAL_PLANNING_DATA = data;
            console.log("DEBUG Admin: Planning Global ChargÃ© (Admin):", GLOBAL_PLANNING_DATA);

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
            console.error("Erreur DOM: L'Ã©lÃ©ment 'global-planning' (planningContainer) est introuvable. Assurez-vous que l'ID est correct dans admin.html.");
            displayMessageModal("Erreur d'affichage", "Impossible d'afficher le planning. L'Ã©lÃ©ment de conteneur est manquant.", "error");
            return;
        }
        planningContainer.innerHTML = '';

        const table = document.createElement('table');
        table.classList.add('global-planning-table');

        // En-tÃªte (CrÃ©neaux Horaires)
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

        // PrÃ©parer la liste des agents avec leur statut de disponibilitÃ©
        const agentsWithAvailabilityStatus = Object.keys(USERS_DATA)
            .map(id => {
                const agent = USERS_DATA[id];
                if (!agent || (agent.role !== 'agent' && agent.role !== 'admin')) {
                    return null; // Ignorer les utilisateurs non-agents ou sans rÃ´le dÃ©fini
                }

                // VÃ©rifier si l'agent a au moins un crÃ©neau disponible pour le jour et la semaine actuels
                const agentSpecificDayPlanning = GLOBAL_PLANNING_DATA[agent.id]?.[weekKey]?.[day] || [];
                const hasAvailability = agentSpecificDayPlanning.length > 0;

                return { ...agent, hasAvailability };
            })
            .filter(agent => agent !== null); // Supprimer les nulls

        // Trier les agents : ceux avec disponibilitÃ© en premier, puis ceux sans, puis par nom
        agentsWithAvailabilityStatus.sort((a, b) => {
            // Tri principal : disponibilitÃ© (true > false)
            if (a.hasAvailability !== b.hasAvailability) {
                return b.hasAvailability - a.hasAvailability; // true (1) vient avant false (0)
            }
            // Tri secondaire : par nom de famille
            return a.nom.localeCompare(b.nom);
        });


        if (agentsWithAvailabilityStatus.length === 0) {
            const noAgentsRow = document.createElement('tr');
            noAgentsRow.innerHTML = `<td colspan="49">Aucun agent Ã  afficher ou donnÃ©es d'agents manquantes.</td>`;
            tbody.appendChild(noAgentsRow);
        } else {
            agentsWithAvailabilityStatus.forEach(agent => {
                const agentRow = document.createElement('tr');
                // Ajoute la classe 'unavailable-agent-row' si l'agent n'a pas de disponibilitÃ©
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

                    let timeRangeForTooltip = 'Indisponible'; // Valeur par dÃ©faut

                    // Trouver le bloc de disponibilitÃ© spÃ©cifique qui couvre ce crÃ©neau de 30 min
                    const coveringAvailability = agentSpecificDayPlanning.find(slot => {
                        return index >= slot.start && index <= slot.end;
                    });

                    if (coveringAvailability) {
                        slotCell.classList.add('available-slot-cell');
                        // Construire la plage horaire complÃ¨te pour le tooltip Ã  partir du bloc trouvÃ©
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
            console.warn("L'Ã©lÃ©ment 'admin-info' est introuvable dans admin.html.");
        }
    }


    // Fonction pour mettre Ã  jour l'affichage de la plage de dates
    function updateDateRangeDisplay() {
        const weekNum = currentWeek;
        const currentYear = new Date().getFullYear();
        if (dateRangeDisplay) {
            dateRangeDisplay.textContent = getWeekDateRange(weekNum, currentYear);
        } else {
            console.warn("L'Ã©lÃ©ment 'date-range' (dateRangeDisplay) est introuvable dans admin.html.");
        }
    }

    // --- Fonctions de contrÃ´le et d'initialisation ---

    function generateWeekOptions() {
        if (!weekSelect) {
            console.error("Erreur DOM: L'Ã©lÃ©ment 'week-select' est introuvable. Assurez-vous que l'ID est correct dans admin.html.");
            return;
        }
        weekSelect.innerHTML = "";
        const today = new Date();
        const currentWeekNumber = getCurrentISOWeek(today);
        const currentYear = today.getFullYear();

        // GÃ©nÃ¨re quelques semaines passÃ©es et futures (ex: 2 semaines avant, 10 semaines aprÃ¨s)
        for (let i = -2; i < 10; i++) {
            const weekNum = currentWeekNumber + i;
            const option = document.createElement("option");
            option.value = weekNum; // La valeur est le numÃ©ro de semaine
            option.textContent = `Semaine ${weekNum} (${getWeekDateRange(weekNum, currentYear)})`;
            if (weekNum === currentWeek) {
                option.selected = true;
            }
            weekSelect.appendChild(option);
        }
    }

    function showLoading(isLoading, forPdf = false) {
        if (!loadingSpinner) {
            console.warn("L'Ã©lÃ©ment 'loading-spinner' est introuvable dans admin.html.");
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
                adminInfo.textContent = "GÃ©nÃ©ration du PDF en cours, veuillez patienter...";
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

    // --- Fonctions d'authentification et de dÃ©connexion ---
    function logout() {
        sessionStorage.clear();
        window.location.href = "index.html";
    }

    // --- Modales (remplace alert() et confirm()) ---
    /**
     * Affiche une modale de message personnalisÃ©e.
     * @param {string} title - Titre de la modale.
     * @param {string} message - Message Ã  afficher.
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
     * Fonction asynchrone pour simuler confirm() avec la modale personnalisÃ©e.
     * @param {string} message - Message de confirmation.
     * @returns {Promise<boolean>} Une promesse qui rÃ©sout avec true si l'utilisateur confirme, false sinon.
     */
    async function confirmModal(message) {
        return new Promise((resolve) => {
            displayMessageModal("Confirmation", message, "question", (result) => {
                resolve(result);
            });
        });
    }

    // Remplacement des fonctions natives alert et confirm pour utiliser les modales personnalisÃ©es
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
                pdf.text("Note: Le planning a Ã©tÃ© ajustÃ© pour tenir sur la page. Certains dÃ©tails peuvent apparaÃ®tre plus petits.", margin, margin + 18);
                pdf.setTextColor(0);
            }

            pdf.addImage(imgData, "PNG", x, y, pdfWidth, pdfHeight);
            pdf.save(`planning_${currentDay}_semaine${currentWeek}.pdf`);
            displayMessageModal("GÃ©nÃ©ration PDF", "Le PDF a Ã©tÃ© gÃ©nÃ©rÃ© avec succÃ¨s !", "success");
            console.log("Le PDF a Ã©tÃ© gÃ©nÃ©rÃ© avec succÃ¨s !");

        } catch (error) {
            console.error("Erreur lors de l'export PDF:", error);
            displayMessageModal("Erreur d'Export", "Une erreur est survenue lors de la gÃ©nÃ©ration du PDF. Veuillez rÃ©essayer ou contacter l'administrateur. DÃ©tails: " + error.message, "error");
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
            console.log('Qualifications disponibles chargÃ©es:', QUALIFICATIONS_DATA);
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
            console.warn("L'Ã©lÃ©ment 'newAgentQualificationsCheckboxes' est introuvable. Impossible de rendre les checkboxes de qualifications.");
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
            console.warn("L'Ã©lÃ©ment 'qualificationsCheckboxesDiv' est introuvable. Impossible de rendre les checkboxes de qualifications.");
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
            console.log('Grades disponibles chargÃ©s:', GRADES_DATA);
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
            console.warn("L'Ã©lÃ©ment 'newAgentGradesCheckboxes' est introuvable. Impossible de rendre les checkboxes de grades.");
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
            console.warn("L'Ã©lÃ©ment 'gradesCheckboxesDiv' est introuvable. Impossible de rendre les checkboxes de grades.");
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
            console.warn("L'Ã©lÃ©ment 'listAgentsMessage' est introuvable. Impossible d'afficher le statut de chargement des agents.");
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

            // Peupler USERS_DATA avec les dÃ©tails complets des agents
            USERS_DATA = {};
            data.forEach(agent => {
                USERS_DATA[agent._id] = {
                    id: agent._id,
                    nom: agent.nom,
                    prenom: agent.prenom,
                    qualifications: agent.qualifications || [],
                    grades: agent.grades || [],
                    functions: agent.functions || [], // Inclure les fonctions si vous les utilisez
                    role: agent.role || 'agent' // Assurez-vous que le rÃ´le est dÃ©fini
                };
            });
            console.log("DEBUG Admin: USERS_DATA aprÃ¨s loadAgents:", USERS_DATA);


            if (!agentsTableBody) {
                console.error("Erreur DOM: L'Ã©lÃ©ment 'agentsTableBody' est introuvable. Impossible de rendre la table des agents.");
                displayMessageModal("Erreur d'affichage", "Impossible d'afficher les agents. L'Ã©lÃ©ment de table est manquant.", "error");
                return;
            }

            agentsTableBody.innerHTML = '';
            if (data.length === 0) {
                agentsTableBody.innerHTML = '<tr><td colspan="6">Aucun agent enregistrÃ© pour le moment.</td></tr>';
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
            displayMessageModal("Erreur de formulaire", "Impossible d'ajouter un agent. Des Ã©lÃ©ments du formulaire sont manquants.", "error");
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
            console.warn("L'Ã©lÃ©ment 'addAgentMessage' est introuvable. Impossible d'afficher le statut d'ajout de l'agent.");
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
                loadAgents();
            } else {
                if (addAgentMessage) addAgentMessage.textContent = `Erreur : ${data.message}`;
                if (addAgentMessage) addAgentMessage.style.color = 'red';
            }
        } catch (error) {
            console.error('Erreur lors de l\'ajout de l\'agent:', error);
            if (addAgentMessage) {
                addAgentMessage.textContent = 'Erreur rÃ©seau lors de l\'ajout de l\'agent.';
                addAgentMessage.style.color = 'red';
            }
        }
    }

    async function handleAgentActions(event) {
        const target = event.target;
        const agentId = target.dataset.id;

        if (!agentId) {
            console.error("Agent ID non trouvÃ© pour l'action.");
            return;
        }

        if (target.classList.contains('edit-btn')) {
            if (!editAgentId || !editAgentNom || !editAgentPrenom || !editAgentNewPassword || !editAgentMessage || !editAgentModalElement) {
                console.error("Erreur DOM: Un ou plusieurs Ã©lÃ©ments de la modale d'Ã©dition de l'agent sont introuvables.");
                displayMessageModal("Erreur d'affichage", "Impossible d'ouvrir la modale d'Ã©dition. Des Ã©lÃ©ments sont manquants.", "error");
                return;
            }
            editAgentId.value = agentId;
            editAgentNom.value = target.dataset.nom;
            editAgentPrenom.value = target.dataset.prenom;
            editAgentNewPassword.value = '';
            editAgentMessage.textContent = '';

            const agentQualifications = JSON.parse(target.dataset.qualifications || '[]');
            const agentGrades = JSON.parse(target.dataset.grades || '[]');

            renderQualificationsCheckboxes(agentQualifications);
            renderGradesCheckboxes(agentGrades);

            editAgentModalElement.style.display = 'block';
        } else if (target.classList.contains('delete-btn')) {
            const confirmed = await confirmModal(`ÃŠtes-vous sÃ»r de vouloir supprimer l'agent ${agentId} ? Cette action est irrÃ©versible.`);
            if (confirmed) {
                try {
                    const response = await fetch(`${API_BASE_URL}/api/admin/agents/${agentId}`, {
                        method: 'DELETE',
                        headers: getAuthHeaders()
                    });
                    const data = await response.json();

                    if (response.ok) {
                        displayMessageModal("SuccÃ¨s", data.message, "success");
                        loadAgents();
                    } else {
                        displayMessageModal("Erreur", `Erreur lors de la suppression : ${data.message}`, "error");
                    }
                } catch (error) {
                    console.error('Erreur lors de la suppression de l\'agent:', error);
                    displayMessageModal("Erreur", 'Erreur rÃ©seau lors de la suppression de l\'agent.', "error");
                }
            }
        }
    }

    async function handleEditAgent(event) {
        event.preventDefault();
        if (!editAgentId || !editAgentNom || !editAgentPrenom || !editAgentNewPassword || !editAgentMessage || !qualificationsCheckboxesDiv || !gradesCheckboxesDiv) {
            console.error("Erreur DOM: Un ou plusieurs Ã©lÃ©ments du formulaire d'Ã©dition de l'agent sont introuvables.");
            displayMessageModal("Erreur de modification", "Impossible de modifier l'agent. Des Ã©lÃ©ments du formulaire sont manquants.", "error");
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


        editAgentMessage.textContent = 'Mise Ã  jour en cours...';
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
                loadAgents();
            } else {
                editAgentMessage.textContent = `Erreur : ${data.message}`;
                editAgentMessage.style.color = 'red';
            }
        } catch (error) {
            console.error('Erreur lors de la mise Ã  jour de l\'agent:', error);
            editAgentMessage.textContent = 'Erreur rÃ©seau lors de la mise Ã  jour de l\'agent.';
            editAgentMessage.style.color = 'red';
        }
    }

    // --- Fonctions CRUD pour la gestion des qualifications (Frontend) ---

    async function loadQualificationsList() {
        if (!listQualificationsMessage) {
            console.warn("L'Ã©lÃ©ment 'listQualificationsMessage' est introuvable. Impossible d'afficher le statut de chargement des qualifications.");
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

            QUALIFICATIONS_DATA = data;

            if (!qualificationsTableBody) {
                console.error("Erreur DOM: L'Ã©lÃ©ment 'qualificationsTableBody' est introuvable. Impossible de rendre la table des qualifications.");
                displayMessageModal("Erreur d'affichage", "Impossible d'afficher les qualifications. L'Ã©lÃ©ment de table est manquant.", "error");
                return;
            }

            qualificationsTableBody.innerHTML = '';
            if (data.length === 0) {
                qualificationsTableBody.innerHTML = '<tr><td colspan="3">Aucune qualification enregistrÃ©e pour le moment.</td></tr>';
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
            displayMessageModal("Erreur de formulaire", "Impossible d'ajouter une qualification. Des Ã©lÃ©ments du formulaire sont manquants.", "error");
            return;
        }
        const id = newQualIdInput.value.trim();
        const name = newQualNameInput.value.trim();

        if (!addQualificationMessage) {
            console.warn("L'Ã©lÃ©ment 'addQualificationMessage' est introuvable. Impossible d'afficher le statut d'ajout de qualification.");
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
                await loadAvailableQualifications();
                await loadQualificationsList();
                renderNewAgentQualificationsCheckboxes();
            } else {
                if (addQualificationMessage) addQualificationMessage.textContent = `Erreur : ${data.message}`;
                if (addQualificationMessage) addQualificationMessage.style.color = 'red';
            }
        } catch (error) {
            console.error('Erreur lors de l\'ajout de la qualification:', error);
            if (addQualificationMessage) {
                addQualificationMessage.textContent = 'Erreur rÃ©seau lors de l\'ajout de la qualification.';
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
                console.error("Erreur DOM: Un ou plusieurs Ã©lÃ©ments de la modale d'Ã©dition de qualification sont introuvables.");
                displayMessageModal("Erreur d'affichage", "Impossible d'ouvrir la modale d'Ã©dition. Des Ã©lÃ©ments sont manquants.", "error");
                return;
            }
            editQualId.value = qualId;
            editQualName.value = target.dataset.name;
            editQualMessage.textContent = '';
            editQualificationModalElement.style.display = 'block';
        } else if (target.classList.contains('delete-btn')) {
            const confirmed = await confirmModal(`ÃŠtes-vous sÃ»r de vouloir supprimer la qualification "${qualId}" ? Cela la retirera aussi des agents qui la possÃ¨dent.`);
            if (confirmed) {
                try {
                    const response = await fetch(`${API_BASE_URL}/api/qualifications/${qualId}`, {
                        method: 'DELETE',
                        headers: getAuthHeaders()
                    });
                    const data = await response.json();

                    if (response.ok) {
                        displayMessageModal("SuccÃ¨s", data.message, "success");
                        await loadAvailableQualifications();
                        await loadQualificationsList();
                        renderNewAgentQualificationsCheckboxes();
                        loadAgents();
                    } else {
                        displayMessageModal("Erreur", `Erreur lors de la suppression : ${data.message}`, "error");
                    }
                } catch (error) {
                    console.error('Erreur lors de la suppression de la qualification:', error);
                    displayMessageModal("Erreur", 'Erreur rÃ©seau lors de la suppression de la qualification.', "error");
                }
            }
        }
    }

    async function handleEditQualification(event) {
        event.preventDefault();
        if (!editQualId || !editQualName || !editQualMessage) {
            console.error("Erreur DOM: Un ou plusieurs Ã©lÃ©ments du formulaire d'Ã©dition de qualification sont introuvables.");
            displayMessageModal("Erreur de modification", "Impossible de modifier la qualification. Des Ã©lÃ©ments du formulaire sont manquants.", "error");
            return;
        }
        const id = editQualId.value.trim();
        const name = editQualName.value.trim();

        editQualMessage.textContent = 'Mise Ã  jour en cours...';
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
                await loadAvailableQualifications();
                await loadQualificationsList();
                renderNewAgentQualificationsCheckboxes();
                loadAgents();
            } else {
                editQualMessage.textContent = `Erreur : ${data.message}`;
                if (editQualMessage) editQualMessage.style.color = 'red';
            }
        } catch (error) {
            console.error('Erreur lors de la mise Ã  jour de la qualification:', error);
            if (editQualMessage) {
                editQualMessage.textContent = 'Erreur rÃ©seau lors de la mise Ã  jour de la qualification.';
                editQualMessage.style.color = 'red';
            }
        }
    }

    // --- Fonctions CRUD pour la gestion des grades (Frontend) ---

    async function loadGradesList() {
        if (!listGradesMessage) {
            console.warn("L'Ã©lÃ©ment 'listGradesMessage' est introuvable. Impossible d'afficher le statut de chargement des grades.");
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

            GRADES_DATA = data;

            if (!gradesTableBody) {
                console.error("Erreur DOM: L'Ã©lÃ©ment 'gradesTableBody' est introuvable. Impossible de rendre la table des grades.");
                displayMessageModal("Erreur d'affichage", "Impossible d'afficher les grades. L'Ã©lÃ©ment de table est manquant.", "error");
                return;
            }

            gradesTableBody.innerHTML = '';
            if (data.length === 0) {
                gradesTableBody.innerHTML = '<tr><td colspan="3">Aucun grade enregistrÃ© pour le moment.</td></tr>';
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
            displayMessageModal("Erreur de formulaire", "Impossible d'ajouter un grade. Des Ã©lÃ©ments du formulaire sont manquants.", "error");
            return;
        }
        const id = newGradeIdInput.value.trim();
        const name = newGradeNameInput.value.trim();

        if (!addGradeMessage) {
            console.warn("L'Ã©lÃ©ment 'addGradeMessage' est introuvable. Impossible d'afficher le statut d'ajout de grade.");
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
                addGradeMessage.textContent = 'Erreur rÃ©seau lors de l\'ajout du grade.';
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
                console.error("Erreur DOM: Un ou plusieurs Ã©lÃ©ments de la modale d'Ã©dition de grade sont introuvables.");
                displayMessageModal("Erreur d'affichage", "Impossible d'ouvrir la modale d'Ã©dition. Des Ã©lÃ©ments sont manquants.", "error");
                return;
            }
            editGradeId.value = gradeId;
            editGradeName.value = target.dataset.name;
            editGradeMessage.textContent = '';
            editGradeModalElement.style.display = 'block';
        } else if (target.classList.contains('delete-btn')) {
            const confirmed = await confirmModal(`ÃŠtes-vous sÃ»r de vouloir supprimer le grade "${gradeId}" ? Cela le retirera aussi des agents qui le possÃ¨dent.`);
            if (confirmed) {
                try {
                    const response = await fetch(`${API_BASE_URL}/api/grades/${gradeId}`, {
                        method: 'DELETE',
                        headers: getAuthHeaders()
                    });
                    const data = await response.json();

                    if (response.ok) {
                        displayMessageModal("SuccÃ¨s", data.message, "success");
                        await loadAvailableGrades();
                        await loadGradesList();
                        renderNewAgentGradesCheckboxes();
                        loadAgents();
                    } else {
                        displayMessageModal("Erreur", `Erreur lors de la suppression : ${data.message}`, "error");
                    }
                } catch (error) {
                    console.error('Erreur lors de la suppression du grade:', error);
                    displayMessageModal("Erreur", 'Erreur rÃ©seau lors de la suppression du grade.', "error");
                }
            }
        }
    }

    async function handleEditGrade(event) {
        event.preventDefault();
        if (!editGradeId || !editGradeName || !editGradeMessage) {
            console.error("Erreur DOM: Un ou plusieurs Ã©lÃ©ments du formulaire d'Ã©dition de grade sont introuvables.");
            displayMessageModal("Erreur de modification", "Impossible de modifier le grade. Des Ã©lÃ©ments du formulaire sont manquants.", "error");
            return;
        }
        const id = editGradeId.value.trim();
        const name = editGradeName.value.trim();

        editGradeMessage.textContent = 'Mise Ã  jour en cours...';
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
                await loadAvailableGrades();
                await loadGradesList();
                renderNewAgentGradesCheckboxes();
                loadAgents();
            } else {
                editGradeMessage.textContent = `Erreur : ${data.message}`;
                if (editGradeMessage) editGradeMessage.style.color = 'red';
            }
        } catch (error) {
            console.error('Erreur lors de la mise Ã  jour du grade:', error);
            if (editGradeMessage) {
                editGradeMessage.textContent = 'Erreur rÃ©seau lors de la mise Ã  jour du grade.';
                editGradeMessage.style.color = 'red';
            }
        }
    }

    // --- Fonctions CRUD pour la gestion des fonctions (Frontend) ---
    // Ces fonctions sont commentÃ©es car la section "Gestion des Fonctions" n'est pas prÃ©sente dans admin.html.
    // DÃ©commentez et assurez-vous d'avoir les Ã©lÃ©ments DOM correspondants si vous l'ajoutez.

    /*
    async function loadFunctionsList() {
        if (!listFunctionsMessage) {
            console.warn("L'Ã©lÃ©ment 'listFunctionsMessage' est introuvable.");
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
            displayMessageModal("Erreur de formulaire", "Impossible d'ajouter une fonction. Des Ã©lÃ©ments du formulaire sont manquants.", "error");
            return;
        }
        const id = newFunctionIdInput.value.trim();
        const name = newFunctionNameInput.value.trim();

        if (!addFunctionMessage) {
            console.warn("L'Ã©lÃ©ment 'addFunctionMessage' est introuvable.");
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
                addFunctionMessage.textContent = 'Erreur rÃ©seau lors de l\'ajout de la fonction.';
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
                console.error("Erreur DOM: Un ou plusieurs Ã©lÃ©ments de la modale d'Ã©dition de fonction sont introuvables.");
                displayMessageModal("Erreur d'affichage", "Impossible d'ouvrir la modale d'Ã©dition. Des Ã©lÃ©ments sont manquants.", "error");
                return;
            }
            editFunctionId.value = funcId;
            editFunctionName.value = target.dataset.name;
            editFunctionMessage.textContent = '';
            editFunctionModalElement.style.display = 'block';

        } else if (target.classList.contains('delete-btn')) {
            const confirmed = await confirmModal(`ÃŠtes-vous sÃ»r de vouloir supprimer la fonction "${funcId}" ?`);
            if (confirmed) {
                try {
                    const response = await fetch(`${API_BASE_URL}/api/functions/${funcId}`, {
                        method: 'DELETE',
                        headers: getAuthHeaders()
                    });
                    const data = await response.json();
                    if (response.ok) {
                        displayMessageModal("SuccÃ¨s", data.message, "success");
                        await loadFunctionsList();
                        await loadAgents();
                    } else {
                        displayMessageModal("Erreur", `Erreur lors de la suppression : ${data.message}`, "error");
                    }
                } catch (error) {
                    console.error('Erreur lors de la suppression de la fonction:', error);
                    displayMessageModal("Erreur", 'Erreur rÃ©seau lors de la suppression de la fonction.', "error");
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
            console.error("Erreur DOM: Un ou plusieurs Ã©lÃ©ments du formulaire d'Ã©dition de fonction sont introuvables.");
            displayMessageModal("Erreur de modification", "Impossible de modifier la fonction. Des Ã©lÃ©ments du formulaire sont manquants.", "error");
            return;
        }
        const id = editFunctionId.value.trim();
        const name = editFunctionName.value.trim();

        editFunctionMessage.textContent = 'Mise Ã  jour en cours...';
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
            console.error('Erreur lors de la mise Ã  jour de la fonction:', error);
            if (editFunctionMessage) {
                editFunctionMessage.textContent = 'Erreur rÃ©seau lors de la mise Ã  jour de la fonction.';
                editFunctionMessage.style.color = 'red';
            }
        }
    }
    */

    /**
     * GÃ¨re l'affichage des onglets principaux de la page d'administration.
     * Cache tous les contenus d'onglets et n'affiche que celui correspondant au `targetTabId`.
     * Met Ã  jour la classe 'active' des boutons d'onglet.
     * @param {string} targetTabId L'ID de l'onglet Ã  afficher (ex: 'global-planning-view').
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

        // Actions spÃ©cifiques Ã  chaque onglet lors de son ouverture
        if (targetTabId === 'global-planning-view') {
            currentWeek = getCurrentISOWeek(new Date());
            generateWeekOptions();
            updateDateRangeDisplay();
            await loadPlanningData();
            showDay(currentDay);

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
            renderNewAgentQualificationsCheckboxes();
            renderNewAgentGradesCheckboxes();
            await loadAgents();
        }

        if (targetTabId === 'qualification-management-view') {
            await loadQualificationsList();
        }

        if (targetTabId === 'grade-management-view') {
            await loadGradesList();
        }
    }


    /**
     * GÃ¨re l'affichage du planning pour un jour spÃ©cifique dans l'onglet "Planning Global".
     * @param {string} day Le jour Ã  afficher (ex: 'lundi').
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
        console.log("DEBUG Admin: Token:", token ? "PrÃ©sent" : "Absent");

        if (!currentUserId || !token) {
            console.error("Initialisation Admin: ID utilisateur ou Token manquant. Redirection vers login.");
            displayMessageModal("Session expirÃ©e", "Votre session a expirÃ© ou n'est pas valide. Veuillez vous reconnecter.", "error", () => {
                window.location.href = "index.html";
            });
            return;
        }

        if (currentUserRole !== 'admin') {
            console.error("Initialisation Admin: RÃ´le incorrect pour cette page. RÃ´le actuel:", currentUserRole);
            displayMessageModal("AccÃ¨s non autorisÃ©", "Vous devez Ãªtre connectÃ© en tant qu'administrateur pour accÃ©der Ã  cette page.", "error", () => {
                if (currentUserRole === 'agent') {
                    window.location.href = "agent.html";
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

        // DÃ©finir la semaine actuelle par dÃ©faut
        currentWeek = getCurrentISOWeek(new Date());

        // Important: Charger les donnÃ©es nÃ©cessaires AVANT d'ouvrir l'onglet par dÃ©faut
        await loadAvailableQualifications();
        await loadAvailableGrades();
        await loadAgents(); // Charger les dÃ©tails des agents pour USERS_DATA

        // Ouvrir l'onglet "Planning Global" par dÃ©faut au chargement
        // Ceci appellera loadPlanningData et showDay
        await openMainTab('global-planning-view');


        // --- Ã‰couteurs d'Ã©vÃ©nements pour les contrÃ´les du planning global ---
        if (weekSelect) {
            weekSelect.addEventListener("change", async () => {
                currentWeek = parseInt(weekSelect.value);
                updateDateRangeDisplay();
                await loadPlanningData();
                showDay(currentDay);
            });
        }
        if (exportPdfButton) {
            exportPdfButton.addEventListener("click", exportPdf);
        } else {
            console.warn("L'Ã©lÃ©ment 'export-pdf' est introuvable dans admin.html. Le bouton d'exportation PDF ne sera pas fonctionnel.");
        }

        // --- Ã‰couteurs d'Ã©vÃ©nements pour les boutons de navigation semaine (prÃ©cÃ©dent/suivant) ---
        const prevWeekBtn = document.getElementById('prev-week-btn');
        const nextWeekBtn = document.getElementById('next-week-btn');

        if (prevWeekBtn) {
            prevWeekBtn.addEventListener('click', async () => {
                currentWeek--;
                generateWeekOptions();
                weekSelect.value = currentWeek;
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
                generateWeekOptions();
                weekSelect.value = currentWeek;
                updateDateRangeDisplay();
                await loadPlanningData();
                showDay(currentDay);
            });
        } else {
            console.warn("Le bouton 'next-week-btn' est introuvable dans admin.html.");
        }


        // --- Ã‰couteurs d'Ã©vÃ©nements pour la vue "Gestion des Agents" ---
        if (addAgentForm) {
            addAgentForm.addEventListener('submit', handleAddAgent);
        } else {
            console.warn("L'Ã©lÃ©ment 'addAgentForm' est introuvable dans admin.html. Le formulaire d'ajout d'agent ne sera pas fonctionnel.");
        }

        if (agentsTableBody) {
            agentsTableBody.addEventListener('click', handleAgentActions);
        } else {
            console.warn("L'Ã©lÃ©ment 'agentsTableBody' est introuvable dans admin.html. Les actions d'agent ne seront pas fonctionnelles.");
        }

        // --- Ã‰couteurs d'Ã©vÃ©nements pour la Modale de modification d'agent ---
        if (editAgentModalElement && closeEditAgentModalButton) {
            closeEditAgentModalButton.addEventListener('click', () => {
                editAgentModalElement.style.display = 'none';
            });
        } else {
            console.warn("La modale d'Ã©dition de l'agent ou son bouton de fermeture est introuvable dans admin.html.");
        }

        window.addEventListener('click', (event) => {
            if (event.target === editAgentModalElement) {
                editAgentModalElement.style.display = 'none';
            }
        });
        if (editAgentFormElement) {
            editAgentFormElement.addEventListener('submit', handleEditAgent);
        } else {
            console.warn("Le formulaire d'Ã©dition de l'agent est introuvable dans admin.html.");
        }

        // --- Ã‰couteurs d'Ã©vÃ©nements pour la vue "Gestion des Qualifications" ---
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
            console.warn("La modale d'Ã©dition de qualification ou son bouton de fermeture est introuvable dans admin.html.");
        }

        if (editQualificationFormElement) {
            editQualificationFormElement.addEventListener('submit', handleEditQualification);
        } else {
            console.warn("Le formulaire d'Ã©dition de qualification est introuvable dans admin.html.");
        }

        // --- Ã‰couteurs d'Ã©vÃ©nements pour la vue "Gestion des Grades" ---
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
            console.warn("La modale d'Ã©dition de grade ou son bouton de fermeture est introuvable dans admin.html.");
        }

        if (editGradeFormElement) {
            editGradeFormElement.addEventListener('submit', handleEditGrade);
        } else {
            console.warn("Le formulaire d'Ã©dition de grade est introuvable dans admin.html.");
        }

        // --- Ã‰couteur pour la dÃ©connexion ---
        if (logoutButton) {
            logoutButton.addEventListener("click", logout);
        } else {
            console.warn("Le bouton de dÃ©connexion est introuvable dans admin.html.");
        }
    }

    // Appeler la fonction d'initialisation au chargement complet du DOM
    await initializeAdminPage();
});