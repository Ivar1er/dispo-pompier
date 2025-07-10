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
    // const dateRangeDisplay = document.getElementById("date-range"); // Supprimé car l'élément HTML est supprimé
    const planningContainer = document.getElementById("global-planning-tbody"); // Conteneur du tableau de planning
    const tabButtons = document.querySelectorAll(".tab"); // Boutons de jour (Lundi, Mardi...)
    const adminInfo = document.getElementById("admin-info");
    const exportPdfButton = document.getElementById("export-pdf"); // Assurez-vous que cet ID est correct

    // --- DOM Elements pour la vue "Gestion des Agents" ---
    const addAgentForm = document.getElementById('addAgentForm');
    const newAgentQualificationsCheckboxes = document.getElementById('newAgentQualificationsCheckboxes');
    const newAgentGradeSelect = document.getElementById('newAgentGrade');
    const agentsTableBody = document.getElementById('agentsTableBody');
    const addAgentMessage = document.getElementById('addAgentMessage');
    const agentSearchInput = document.getElementById('agentSearch'); // Pour la barre de recherche
    const editAgentForm = document.getElementById('editAgentForm');
    const editAgentModal = document.getElementById('editAgentModal');
    const editAgentIdInput = document.getElementById('editAgentId');
    const editAgentFirstNameInput = document.getElementById('editAgentFirstName');
    const editAgentLastNameInput = document.getElementById('editAgentLastName');
    const editAgentGradeSelect = document.getElementById('editAgentGrade');
    const editAgentRoleSelect = document.getElementById('editAgentRole');
    const editAgentQualificationsCheckboxes = document.getElementById('editAgentQualificationsCheckboxes');
    const editAgentMessage = document.getElementById('editAgentMessage');
    const closeAgentButton = editAgentModal ? editAgentModal.querySelector('.close-button') : null;


    // --- DOM Elements pour la vue "Gestion des Qualifications" ---
    const addQualificationForm = document.getElementById('addQualificationForm');
    const addQualificationMessage = document.getElementById('addQualificationMessage');
    const qualificationsTableBody = document.getElementById('qualificationsTableBody');
    const editQualificationModalElement = document.getElementById('editQualificationModal');
    const editQualificationFormElement = document.getElementById('editQualificationForm');
    const editQualNameInput = document.getElementById('editQualName');
    const editQualIdInput = document.getElementById('editQualId');
    const editQualMessage = document.getElementById('editQualMessage');
    const closeQualButton = editQualificationModalElement ? editQualificationModalElement.querySelector('.close-button') : null;


    // --- DOM Elements pour la vue "Gestion des Grades" ---
    const addGradeFormElement = document.getElementById('addGradeForm');
    const addGradeMessageElement = document.getElementById('addGradeMessage');
    const gradesTableBody = document.getElementById('gradesTableBody');
    const editGradeModalElement = document.getElementById('editGradeModal');
    const editGradeFormElement = document.getElementById('editGradeForm');
    const editGradeNameInput = document.getElementById('editGradeName');
    const editGradeIdInput = document.getElementById('editGradeId');
    const editGradeMessage = document.getElementById('editGradeMessage');
    const closeGradeButton = editGradeModalElement ? editGradeModalElement.querySelector('.close-button') : null;


    // --- Bouton de déconnexion ---
    const logoutButton = document.getElementById('logout-button');


    // --- Fonctions de modales (copiées de agent.js et synthese.js pour une cohérence) ---
    /**
     * Affiche une modale de message personnalisée.
     * @param {string} title - Titre de la modale.
     * @param {string} message - Message à afficher.
     * @param {'info'|'success'|'error'|'warning'|'question'} type - Type de message pour le style.
     * @param {function(boolean)} [callback] - Fonction de rappel pour les confirmations (true si OK, false si Annuler/clic extérieur).
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

        modal.style.display = 'flex'; // Affiche la modale

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

        // Gère le clic en dehors de la modale pour la fermer
        modal.onclick = (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
                if (callback) callback(false); // Si c'était une confirmation, considérer comme annulation
            }
        };
    }

    /**
     * Fonction asynchrone pour simuler confirm() avec la modale personnalisée.
     * @param {string} message - Message de confirmation.
     * @returns {Promise<boolean>} Une promesse qui se résout avec true si l'utilisateur confirme, false sinon.
     */
    async function confirmModal(message) {
        return new Promise((resolve) => {
            displayMessageModal("Confirmation", message, "question", (result) => {
                resolve(result);
            });
        });
    }
    // Remplace les fonctions globales alert et confirm par nos modales personnalisées
    window.alert = displayMessageModal.bind(null, "Information");
    window.confirm = confirmModal;


    // --- Fonctions d'authentification et de redirection ---
    async function checkAuthAndRedirect() {
        const token = sessionStorage.getItem('token');
        const userRole = sessionStorage.getItem('userRole');

        if (!token || userRole !== 'admin') {
            await displayMessageModal("Accès non autorisé", "Vous devez être connecté en tant qu'administrateur pour accéder à cette page.", "error");
            window.location.href = 'index.html'; // Redirige vers la page de connexion
        }
    }

    function logout() {
        sessionStorage.clear();
        window.location.href = 'index.html';
    }


    // --- Fonctions utilitaires pour les semaines et les heures (copiées de synthese.js) ---
    const days = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
    const START_HOUR_GRID = 7; // L'affichage de la grille commence à 7h
    const SLOT_COUNT = 48; // Total de 48 créneaux de 30 minutes sur 24h
    const MINUTES_PER_SLOT = 30; // Chaque créneau représente 30 minutes

    /**
     * Calcule le numéro de semaine ISO 8601 pour une date donnée.
     * @param {Date} date - La date à utiliser.
     * @returns {number} Le numéro de la semaine ISO.
     */
    function getWeekNumber(date = new Date()) {
        const _date = new Date(date.getTime());
        _date.setHours(0, 0, 0, 0);
        _date.setDate(_date.getDate() + 3 - ((_date.getDay() + 6) % 7)); // Ajuste au jeudi de la semaine
        const week1 = new Date(_date.getFullYear(), 0, 4); // Le 4 janvier est toujours dans la première semaine ISO de l'année
        return (
            1 +
            Math.round(
                ((_date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7
            )
        );
    }

    /**
     * Obtient la plage de dates (début et fin) pour un numéro de semaine donné dans l'année courante.
     * @param {number} weekNumber - Le numéro de la semaine.
     * @param {number} [year=new Date().getFullYear()] - L'année.
     * @returns {string} La plage de dates formatée (ex: "du 01/01 au 07/01").
     */
    function getWeekDateRange(weekNumber, year = new Date().getFullYear()) {
        const jan4 = new Date(year, 0, 4);
        const firstMonday = new Date(jan4.setDate(jan4.getDate() - (jan4.getDay() === 0 ? 6 : jan4.getDay() - 1)));
        const startOfWeek = new Date(firstMonday);
        startOfWeek.setDate(firstMonday.getDate() + (weekNumber - 1) * 7);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        const format = date => date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
        return `du ${format(startOfWeek)} au ${format(endOfWeek)}`;
    }

    /**
     * Convertit une chaîne de temps "HH:MM" en nombre de minutes depuis minuit.
     * @param {string} timeStr - La chaîne de temps (ex: "08:30").
     * @returns {number} Le nombre total de minutes.
     */
    function timeToMinutes(timeStr) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
    }

    /**
     * Convertit un nombre de minutes depuis minuit en chaîne de temps "HH:MM".
     * @param {number} totalMinutes - Le nombre total de minutes.
     * @returns {string} La chaîne de temps formatée (ex: "08:30").
     */
    function minutesToTime(totalMinutes) {
        const hours = Math.floor(totalMinutes / 60) % 24;
        const minutes = totalMinutes % 60;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }

    // --- Fonctions d'affichage de chargement ---
    function showLoading(sectionId, isLoading) {
        const spinner = document.getElementById(`loading-spinner-${sectionId}`);
        if (spinner) {
            spinner.classList.toggle("hidden", !isLoading);
        }
    }


    // --- Fonctions de récupération de données de l'API ---
    async function fetchData(endpoint) {
        const token = sessionStorage.getItem('token');
        if (!token) {
            console.error("Aucun token d'authentification trouvé.");
            throw new Error("Authentification requise.");
        }
        const response = await fetch(`${API_BASE_URL}/api/${endpoint}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `Erreur HTTP: ${response.status} ${response.statusText}`);
        }
        return response.json();
    }

    async function fetchAllUsers() {
        try {
            const users = await fetchData('users');
            USERS_DATA = {};
            users.forEach(user => {
                USERS_DATA[user.id] = user;
            });
            console.log("Utilisateurs chargés:", USERS_DATA);
        } catch (error) {
            console.error("Erreur lors du chargement des utilisateurs:", error);
            displayMessageModal("Erreur", "Impossible de charger les utilisateurs.", "error");
        }
    }

    async function fetchQualifications() {
        try {
            QUALIFICATIONS_DATA = await fetchData('qualifications');
            console.log("Qualifications chargées:", QUALIFICATIONS_DATA);
        } catch (error) {
            console.error("Erreur lors du chargement des qualifications:", error);
            displayMessageModal("Erreur", "Impossible de charger les qualifications.", "error");
        }
    }

    async function fetchGrades() {
        try {
            GRADES_DATA = await fetchData('grades');
            console.log("Grades chargés:", GRADES_DATA);
        } catch (error) {
            console.error("Erreur lors du chargement des grades:", error);
            displayMessageModal("Erreur", "Impossible de charger les grades.", "error");
        }
    }

    async function fetchGlobalPlanning() {
        try {
            GLOBAL_PLANNING_DATA = await fetchData('planning/global');
            console.log("Planning global chargé:", GLOBAL_PLANNING_DATA);
        } catch (error) {
            console.error("Erreur lors du chargement du planning global:", error);
            displayMessageModal("Erreur", "Impossible de charger le planning global.", "error");
            GLOBAL_PLANNING_DATA = {}; // Assurez-vous que c'est un objet vide en cas d'erreur
        }
    }


    // --- Fonctions de rendu de l'interface utilisateur ---
    function setupWeekSelector() {
        weekSelect.innerHTML = ''; // Clear existing options
        const currentYear = new Date().getFullYear();
        const numWeeks = getWeekNumber(new Date(currentYear, 11, 31)); // Get total weeks in current year

        for (let i = 1; i <= numWeeks; i++) {
            const option = document.createElement("option");
            option.value = `S ${i}`;
            option.textContent = `Semaine ${i} ${getWeekDateRange(i, currentYear)}`;
            weekSelect.appendChild(option);
        }

        // Try to set selected week to current week or first available
        const currentWeekNum = getWeekNumber();
        const currentWeekKey = `S ${currentWeekNum}`;
        if (weekSelect.querySelector(`option[value="${currentWeekKey}"]`)) {
            weekSelect.value = currentWeekKey;
        } else if (weekSelect.options.length > 0) {
            weekSelect.value = weekSelect.options[0].value;
        }

        weekSelect.addEventListener("change", () => {
            renderGlobalPlanning(weekSelect.value, USERS_DATA, GLOBAL_PLANNING_DATA);
        });
    }


    function generateTimeHeader() {
        const timeHeaderRow = document.querySelector('.global-planning-table thead tr');
        if (!timeHeaderRow) return;

        // Clear existing time headers but keep the first 'Agent' column
        Array.from(timeHeaderRow.children).slice(1).forEach(child => child.remove());

        // Generate time slots from 07h to 07h (24 hours)
        for (let i = 0; i < SLOT_COUNT; i++) { // 48 slots for 24 hours
            const hour = (START_HOUR_GRID * 60 + (i * MINUTES_PER_SLOT)) / 60;
            const hourCell = document.createElement('th');
            hourCell.classList.add('time-header-cell');

            if (i % 2 === 0) { // Display hour for every 60 minutes (every 2 slots)
                const displayHour = Math.floor(hour) % 24;
                hourCell.textContent = `${String(displayHour).padStart(2, '0')}h`;
                hourCell.colSpan = 2; // Make it span two 30-min columns
            } else {
                hourCell.style.display = 'none'; // Hide the second 30-min slot of each hour
            }
            timeHeaderRow.appendChild(hourCell);
        }
    }


    function renderGlobalPlanning(weekKey, usersData, planningData) {
        planningContainer.innerHTML = ''; // Clear previous planning rows
        const currentDayFilter = document.querySelector('.tabs-navigation .tab.active').dataset.day;
        const noPlanningMessage = document.getElementById('no-planning-message');
        let hasPlanningData = false;

        Object.values(usersData).forEach(user => {
            // IGNORE ADMIN USER
            if (user.firstName === 'Admin' && user.lastName === 'Admin') {
                return; // Skip this user
            }

            const agentRow = document.createElement('tr');
            agentRow.classList.add('planning-row');

            const agentNameCell = document.createElement('td');
            agentNameCell.classList.add('agent-name-cell');
            agentNameCell.textContent = `${user.firstName} ${user.lastName}`;
            agentRow.appendChild(agentNameCell);

            const userPlanning = planningData[user.id] ? planningData[user.id][weekKey] : {};

            for (let i = 0; i < SLOT_COUNT; i++) {
                const slotCell = document.createElement('td');
                slotCell.classList.add('slot-cell');
                slotCell.dataset.slotIndex = i;

                const slotTime = (START_HOUR_GRID * 60) + (i * MINUTES_PER_SLOT);
                const dayIndex = Math.floor(i / (SLOT_COUNT / days.length)); // Assuming 48 slots / 7 days for now

                const dayName = days[Math.floor(i / (SLOT_COUNT / days.length)) % 7]; // Calculate day name correctly

                // Get the actual hour and minute for this slot, handling overflow past midnight
                const currentSlotHour = Math.floor(slotTime / 60) % 24;
                const currentSlotMinute = slotTime % 60;
                const nextSlotTime = slotTime + MINUTES_PER_SLOT;
                const nextSlotHour = Math.floor(nextSlotTime / 60) % 24;
                const nextSlotMinute = nextSlotTime % 60;

                slotCell.title = `Créneau: ${String(currentSlotHour).padStart(2, '0')}:${String(currentSlotMinute).padStart(2, '0')} - ${String(nextSlotHour).padStart(2, '0')}:${String(nextSlotMinute).padStart(2, '0')}`;


                let isAvailable = false;
                if (userPlanning && userPlanning[dayName]) {
                    isAvailable = userPlanning[dayName].some(range => {
                        const rangeStartMinutes = (range.start * MINUTES_PER_SLOT) + (START_HOUR_GRID * 60);
                        const rangeEndMinutes = (range.end * MINUTES_PER_SLOT) + (START_HOUR_GRID * 60) + MINUTES_PER_SLOT; // End is inclusive of the last slot

                        // Adjust for overnight ranges for comparison
                        let adjustedRangeEndMinutes = rangeEndMinutes;
                        if (rangeStartMinutes >= rangeEndMinutes) { // If it's an overnight range (e.g., 23:00-01:00)
                            adjustedRangeEndMinutes += (24 * 60); // Add 24 hours in minutes
                        }

                        let adjustedSlotTime = slotTime;
                        if (adjustedSlotTime < rangeStartMinutes && adjustedSlotTime < (START_HOUR_GRID * 60)) {
                             // If the slot is on the next "day" of the grid (e.g., 00:00-06:00) but the range started yesterday
                            adjustedSlotTime += (24 * 60);
                        }


                        // Check if the slot falls within the adjusted range
                        return adjustedSlotTime >= rangeStartMinutes && adjustedSlotTime < adjustedRangeEndMinutes;
                    });
                }

                slotCell.classList.add(isAvailable ? 'available-slot' : 'unavailable-slot');

                if (currentDayFilter === 'all' || currentDayFilter === dayName) {
                    agentRow.appendChild(slotCell);
                    if (isAvailable) {
                        hasPlanningData = true; // Mark that at least one available slot is found
                    }
                } else {
                    slotCell.style.display = 'none'; // Hide if not matching filter
                }
            }
            planningContainer.appendChild(agentRow);
        });

        // Show/hide no planning message based on filtered results
        if (!hasPlanningData && currentDayFilter === 'all') { // Only show message if no planning at all
            noPlanningMessage.classList.remove('hidden');
        } else if (hasPlanningData || currentDayFilter !== 'all') {
            // If there's data, or if a specific day is filtered (even if that day has no data,
            // we assume the user is looking at a specific day, not general availability)
            noPlanningMessage.classList.add('hidden');
        }
    }


    function displayAgents(filterText = '') {
        agentsTableBody.innerHTML = ''; // Clear previous entries
        const filterLower = filterText.toLowerCase();

        Object.values(USERS_DATA).forEach(user => {
            // IGNORE ADMIN USER
            if (user.firstName === 'Admin' && user.lastName === 'Admin') {
                return; // Skip this user
            }

            const gradeName = GRADES_DATA.find(g => g.id === user.gradeId)?.name || 'N/A';
            const qualificationNames = user.qualificationIds
                .map(qId => QUALIFICATIONS_DATA.find(q => q.id === qId)?.name)
                .filter(Boolean)
                .join(', ') || 'Aucune';

            const userFullName = `${user.firstName} ${user.lastName}`.toLowerCase();

            if (filterText && !userFullName.includes(filterLower)) {
                return; // Skip if filter text is provided and doesn't match
            }

            const row = agentsTableBody.insertRow();
            row.dataset.agentId = user.id;

            row.insertCell().textContent = user.firstName;
            row.insertCell().textContent = user.lastName;
            row.insertCell().textContent = gradeName;
            row.insertCell().textContent = user.role;
            row.insertCell().textContent = qualificationNames;

            const actionsCell = row.insertCell();
            const editButton = document.createElement('button');
            editButton.textContent = 'Modifier';
            editButton.classList.add('btn', 'btn-secondary', 'btn-edit');
            editButton.dataset.id = user.id;
            actionsCell.appendChild(editButton);

            const deleteButton = document.createElement('button');
            deleteButton.textContent = 'Supprimer';
            deleteButton.classList.add('btn', 'btn-danger', 'btn-delete');
            deleteButton.dataset.id = user.id;
            actionsCell.appendChild(deleteButton);
        });
    }

    function displayQualifications() {
        qualificationsTableBody.innerHTML = '';
        QUALIFICATIONS_DATA.forEach(qual => {
            const row = qualificationsTableBody.insertRow();
            row.dataset.qualId = qual.id;
            row.insertCell().textContent = qual.id;
            row.insertCell().textContent = qual.name;

            const actionsCell = row.insertCell();
            const editButton = document.createElement('button');
            editButton.textContent = 'Modifier';
            editButton.classList.add('btn', 'btn-secondary', 'btn-edit');
            editButton.dataset.id = qual.id;
            actionsCell.appendChild(editButton);

            const deleteButton = document.createElement('button');
            deleteButton.textContent = 'Supprimer';
            deleteButton.classList.add('btn', 'btn-danger', 'btn-delete');
            deleteButton.dataset.id = qual.id;
            actionsCell.appendChild(deleteButton);
        });
    }

    function displayGrades() {
        gradesTableBody.innerHTML = '';
        GRADES_DATA.forEach(grade => {
            const row = gradesTableBody.insertRow();
            row.dataset.gradeId = grade.id;
            row.insertCell().textContent = grade.id;
            row.insertCell().textContent = grade.name;

            const actionsCell = row.insertCell();
            const editButton = document.createElement('button');
            editButton.textContent = 'Modifier';
            editButton.classList.add('btn', 'btn-secondary', 'btn-edit');
            editButton.dataset.id = grade.id;
            actionsCell.appendChild(editButton);

            const deleteButton = document.createElement('button');
            deleteButton.textContent = 'Supprimer';
            deleteButton.classList.add('btn', 'btn-danger', 'btn-delete');
            deleteButton.dataset.id = grade.id;
            actionsCell.appendChild(deleteButton);
        });
    }

    // --- Fonctions de gestion d'événements (ajout, modification, suppression) ---
    async function handleAddAgent(event) {
        event.preventDefault();
        showLoading('agents', true);
        const newAgent = {
            firstName: newAgentFirstName.value,
            lastName: newAgentLastName.value,
            gradeId: newAgentGradeSelect.value,
            role: newAgentRole.value,
            password: newAgentPassword.value,
            qualificationIds: Array.from(newAgentQualificationsCheckboxes.querySelectorAll('input:checked')).map(cb => cb.value)
        };

        try {
            const token = sessionStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/users`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(newAgent)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Erreur: ${response.statusText}`);
            }

            const addedAgent = await response.json();
            displayMessageModal("Succès", `Agent ${addedAgent.firstName} ${addedAgent.lastName} ajouté avec succès!`, "success");
            addAgentForm.reset();
            await fetchAllUsers(); // Refresh data
            displayAgents(); // Re-render agents table
        } catch (error) {
            console.error("Erreur lors de l'ajout de l'agent:", error);
            displayMessageModal("Erreur", `Échec de l'ajout de l'agent: ${error.message}`, "error");
        } finally {
            showLoading('agents', false);
        }
    }

    async function handleEditAgent(event) {
        event.preventDefault();
        showLoading('agents', true);
        const agentId = editAgentIdInput.value;
        const updatedAgent = {
            firstName: editAgentFirstNameInput.value,
            lastName: editAgentLastNameInput.value,
            gradeId: editAgentGradeSelect.value,
            role: editAgentRoleSelect.value,
            qualificationIds: Array.from(editAgentQualificationsCheckboxes.querySelectorAll('input:checked')).map(cb => cb.value)
        };

        try {
            const token = sessionStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/users/${agentId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(updatedAgent)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Erreur: ${response.statusText}`);
            }

            displayMessageModal("Succès", "Agent mis à jour avec succès!", "success");
            editAgentModal.style.display = 'none';
            await fetchAllUsers();
            displayAgents();
        } catch (error) {
            console.error("Erreur lors de la mise à jour de l'agent:", error);
            displayMessageModal("Erreur", `Échec de la mise à jour de l'agent: ${error.message}`, "error");
        } finally {
            showLoading('agents', false);
        }
    }

    async function handleDeleteAgent(agentId) {
        if (await confirmModal("Êtes-vous sûr de vouloir supprimer cet agent ?")) {
            showLoading('agents', true);
            try {
                const token = sessionStorage.getItem('token');
                const response = await fetch(`${API_BASE_URL}/api/users/${agentId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || `Erreur: ${response.statusText}`);
                }

                displayMessageModal("Succès", "Agent supprimé avec succès!", "success");
                await fetchAllUsers();
                displayAgents();
            } catch (error) {
                console.error("Erreur lors de la suppression de l'agent:", error);
                displayMessageModal("Erreur", `Échec de la suppression de l'agent: ${error.message}`, "error");
            } finally {
                showLoading('agents', false);
            }
        }
    }

    // Agent Actions (Edit/Delete)
    function handleAgentActions(event) {
        if (event.target.classList.contains('btn-edit')) {
            const agentId = event.target.dataset.id;
            const agent = USERS_DATA[agentId];
            if (agent) {
                editAgentIdInput.value = agent.id;
                editAgentFirstNameInput.value = agent.firstName;
                editAgentLastNameInput.value = agent.lastName;
                editAgentGradeSelect.value = agent.gradeId;
                editAgentRoleSelect.value = agent.role;

                // Populate qualifications checkboxes for editing
                editAgentQualificationsCheckboxes.innerHTML = '';
                QUALIFICATIONS_DATA.forEach(q => {
                    const checkboxDiv = document.createElement('div');
                    checkboxDiv.classList.add('checkbox-item');
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.id = `edit-qual-${q.id}`;
                    checkbox.value = q.id;
                    if (agent.qualificationIds && agent.qualificationIds.includes(q.id)) {
                        checkbox.checked = true;
                    }
                    const label = document.createElement('label');
                    label.htmlFor = `edit-qual-${q.id}`;
                    label.textContent = q.name;
                    checkboxDiv.appendChild(checkbox);
                    checkboxDiv.appendChild(label);
                    editAgentQualificationsCheckboxes.appendChild(checkboxDiv);
                });

                editAgentModal.style.display = 'flex';
                editAgentMessage.textContent = '';
            }
        } else if (event.target.classList.contains('btn-delete')) {
            handleDeleteAgent(event.target.dataset.id);
        }
    }

    async function handleAddQualification(event) {
        event.preventDefault();
        showLoading('qualifications', true);
        const newQualName = document.getElementById('newQualificationName').value;
        try {
            const token = sessionStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/qualifications`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ name: newQualName })
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Erreur: ${response.statusText}`);
            }
            displayMessageModal("Succès", "Qualification ajoutée avec succès!", "success");
            document.getElementById('addQualificationForm').reset();
            await fetchQualifications();
            displayQualifications();
            await fetchAllUsers(); // Refetch users to update their qualification names if needed
            displayAgents(); // Re-render agents to show updated qualification names
            populateQualificationCheckboxes(newAgentQualificationsCheckboxes); // Update add agent form
            populateQualificationCheckboxes(editAgentQualificationsCheckboxes); // Update edit agent form
        } catch (error) {
            console.error("Erreur lors de l'ajout de la qualification:", error);
            displayMessageModal("Erreur", `Échec de l'ajout de la qualification: ${error.message}`, "error");
        } finally {
            showLoading('qualifications', false);
        }
    }

    async function handleEditQualification(event) {
        event.preventDefault();
        showLoading('qualifications', true);
        const qualId = editQualIdInput.value;
        const updatedQualName = editQualNameInput.value;
        try {
            const token = sessionStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/qualifications/${qualId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ name: updatedQualName })
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Erreur: ${response.statusText}`);
            }
            displayMessageModal("Succès", "Qualification mise à jour avec succès!", "success");
            editQualificationModalElement.style.display = 'none';
            await fetchQualifications();
            displayQualifications();
            await fetchAllUsers(); // Refetch users to update their qualification names
            displayAgents(); // Re-render agents to show updated qualification names
            populateQualificationCheckboxes(newAgentQualificationsCheckboxes); // Update add agent form
            populateQualificationCheckboxes(editAgentQualificationsCheckboxes); // Update edit agent form
        } catch (error) {
            console.error("Erreur lors de la mise à jour de la qualification:", error);
            displayMessageModal("Erreur", `Échec de la mise à jour de la qualification: ${error.message}`, "error");
        } finally {
            showLoading('qualifications', false);
        }
    }

    async function handleDeleteQualification(qualId) {
        if (await confirmModal("Êtes-vous sûr de vouloir supprimer cette qualification ? Tous les agents ayant cette qualification en seront dissociés.")) {
            showLoading('qualifications', true);
            try {
                const token = sessionStorage.getItem('token');
                const response = await fetch(`${API_BASE_URL}/api/qualifications/${qualId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || `Erreur: ${response.statusText}`);
                }
                displayMessageModal("Succès", "Qualification supprimée avec succès!", "success");
                await fetchQualifications();
                displayQualifications();
                await fetchAllUsers(); // Refetch users as their qualificationIds might change
                displayAgents(); // Re-render agents to show updated qualification names
                populateQualificationCheckboxes(newAgentQualificationsCheckboxes); // Update add agent form
                populateQualificationCheckboxes(editAgentQualificationsCheckboxes); // Update edit agent form
            } catch (error) {
                console.error("Erreur lors de la suppression de la qualification:", error);
                displayMessageModal("Erreur", `Échec de la suppression de la qualification: ${error.message}`, "error");
            } finally {
                showLoading('qualifications', false);
            }
        }
    }

    function handleQualificationActions(event) {
        if (event.target.classList.contains('btn-edit')) {
            const qualId = event.target.dataset.id;
            const qualification = QUALIFICATIONS_DATA.find(q => q.id === qualId);
            if (qualification) {
                editQualIdInput.value = qualification.id;
                editQualNameInput.value = qualification.name;
                editQualificationModalElement.style.display = 'flex';
                editQualMessage.textContent = '';
            }
        } else if (event.target.classList.contains('btn-delete')) {
            handleDeleteQualification(event.target.dataset.id);
        }
    }

    async function handleAddGrade(event) {
        event.preventDefault();
        showLoading('grades', true);
        const newGradeName = document.getElementById('newGradeName').value;
        try {
            const token = sessionStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/grades`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ name: newGradeName })
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Erreur: ${response.statusText}`);
            }
            displayMessageModal("Succès", "Grade ajouté avec succès!", "success");
            document.getElementById('addGradeForm').reset();
            await fetchGrades();
            displayGrades();
            await fetchAllUsers(); // Refetch users as their grade names might change
            displayAgents(); // Re-render agents to show updated grade names
            populateGradeSelects(); // Update grade dropdowns
        } catch (error) {
            console.error("Erreur lors de l'ajout du grade:", error);
            displayMessageModal("Erreur", `Échec de l'ajout du grade: ${error.message}`, "error");
        } finally {
            showLoading('grades', false);
        }
    }

    async function handleEditGrade(event) {
        event.preventDefault();
        showLoading('grades', true);
        const gradeId = editGradeIdInput.value;
        const updatedGradeName = editGradeNameInput.value;
        try {
            const token = sessionStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/grades/${gradeId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ name: updatedGradeName })
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Erreur: ${response.statusText}`);
            }
            displayMessageModal("Succès", "Grade mis à jour avec succès!", "success");
            editGradeModalElement.style.display = 'none';
            await fetchGrades();
            displayGrades();
            await fetchAllUsers(); // Refetch users to update their grade names
            displayAgents(); // Re-render agents to show updated grade names
            populateGradeSelects(); // Update grade dropdowns
        } catch (error) {
            console.error("Erreur lors de la mise à jour du grade:", error);
            displayMessageModal("Erreur", `Échec de la mise à jour du grade: ${error.message}`, "error");
        } finally {
            showLoading('grades', false);
        }
    }

    async function handleDeleteGrade(gradeId) {
        if (await confirmModal("Êtes-vous sûr de vouloir supprimer ce grade ? Tous les agents ayant ce grade devront être mis à jour manuellement.")) {
            showLoading('grades', true);
            try {
                const token = sessionStorage.getItem('token');
                const response = await fetch(`${API_BASE_URL}/api/grades/${gradeId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || `Erreur: ${response.statusText}`);
                }
                displayMessageModal("Succès", "Grade supprimé avec succès!", "success");
                await fetchGrades();
                displayGrades();
                await fetchAllUsers(); // Refetch users as their grade IDs might be invalid now
                displayAgents(); // Re-render agents to show updated grade names
                populateGradeSelects(); // Update grade dropdowns
            } catch (error) {
                console.error("Erreur lors de la suppression du grade:", error);
                displayMessageModal("Erreur", `Échec de la suppression du grade: ${error.message}`, "error");
            } finally {
                showLoading('grades', false);
            }
        }
    }

    function handleGradeActions(event) {
        if (event.target.classList.contains('btn-edit')) {
            const gradeId = event.target.dataset.id;
            const grade = GRADES_DATA.find(g => g.id === gradeId);
            if (grade) {
                editGradeIdInput.value = grade.id;
                editGradeNameInput.value = grade.name;
                editGradeModalElement.style.display = 'flex';
                editGradeMessage.textContent = '';
            }
        } else if (event.target.classList.contains('btn-delete')) {
            handleDeleteGrade(event.target.dataset.id);
        }
    }


    // --- Fonctions de remplissage des sélecteurs (dropdowns) ---
    function populateGradeSelects() {
        const gradeSelects = [newAgentGradeSelect, editAgentGradeSelect];
        gradeSelects.forEach(selectElement => {
            if (selectElement) {
                selectElement.innerHTML = '';
                GRADES_DATA.forEach(grade => {
                    const option = document.createElement('option');
                    option.value = grade.id;
                    option.textContent = grade.name;
                    selectElement.appendChild(option);
                });
            }
        });
    }

    function populateQualificationCheckboxes(containerElement) {
        if (!containerElement) return;
        containerElement.innerHTML = '';
        QUALIFICATIONS_DATA.forEach(q => {
            const checkboxDiv = document.createElement('div');
            checkboxDiv.classList.add('checkbox-item');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `${containerElement.id}-qual-${q.id}`;
            checkbox.value = q.id;
            const label = document.createElement('label');
            label.htmlFor = `${containerElement.id}-qual-${q.id}`;
            label.textContent = q.name;
            checkboxDiv.appendChild(checkbox);
            checkboxDiv.appendChild(label);
            containerElement.appendChild(checkboxDiv);
        });
    }

    // --- Fonctions de gestion des onglets ---
    function setActiveMainTab(activeTabId) {
        mainTabContents.forEach(content => {
            content.classList.toggle('active', content.id === activeTabId);
            content.classList.toggle('hidden', content.id !== activeTabId);
        });
        mainTabButtons.forEach(button => {
            button.classList.toggle('active', button.dataset.tab === activeTabId);
        });

        // Charger les données spécifiques à l'onglet si nécessaire
        switch (activeTabId) {
            case 'planning-global':
                // Les données du planning sont chargées au démarrage et mises à jour via le sélecteur de semaine
                // Assurez-vous que le planning est rendu avec les données actuelles
                renderGlobalPlanning(weekSelect.value, USERS_DATA, GLOBAL_PLANNING_DATA);
                break;
            case 'gestion-agents':
                displayAgents(); // Re-display agents with current data
                break;
            case 'gestion-qualifications':
                displayQualifications();
                break;
            case 'gestion-grades':
                displayGrades();
                break;
        }
    }

    function setActiveDayTab(activeDay) {
        tabButtons.forEach(button => {
            button.classList.toggle('active', button.dataset.day === activeDay);
        });
        renderGlobalPlanning(weekSelect.value, USERS_DATA, GLOBAL_PLANNING_DATA);
    }

    // --- Initialisation de la page admin ---
    async function initializeAdminPage() {
        showLoading('planning', true);
        showLoading('agents', true);
        showLoading('qualifications', true);
        showLoading('grades', true);

        await checkAuthAndRedirect();

        // Fetch all necessary data in parallel
        await Promise.all([
            fetchAllUsers(),
            fetchQualifications(),
            fetchGrades(),
            fetchGlobalPlanning()
        ]);

        // Populate selects and checkboxes once data is fetched
        populateGradeSelects();
        populateQualificationCheckboxes(newAgentQualificationsCheckboxes);
        // Note: editAgentQualificationsCheckboxes is populated when editing an agent

        // Setup week selector and initial planning display
        setupWeekSelector();
        generateTimeHeader(); // Generate time header once
        renderGlobalPlanning(weekSelect.value, USERS_DATA, GLOBAL_PLANNING_DATA);

        // Initial display for other sections
        displayAgents();
        displayQualifications();
        displayGrades();

        showLoading('planning', false);
        showLoading('agents', false);
        showLoading('qualifications', false);
        showLoading('grades', false);

        // --- Configuration des écouteurs d'événements ---
        mainTabButtons.forEach(button => {
            button.addEventListener('click', () => {
                setActiveMainTab(button.dataset.tab);
            });
        });

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                setActiveDayTab(button.dataset.day);
            });
        });

        // Écouteurs pour la vue "Gestion des Agents"
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

        if (agentSearchInput) {
            agentSearchInput.addEventListener('input', (event) => {
                displayAgents(event.target.value);
            });
        } else {
            console.warn("Le champ de recherche d'agent est introuvable dans admin.html.");
        }

        if (editAgentModal && closeAgentButton) {
            closeAgentButton.addEventListener('click', () => {
                editAgentModal.style.display = 'none';
            });
            editAgentModal.addEventListener('click', (e) => {
                if (e.target === editAgentModal) {
                    editAgentModal.style.display = 'none';
                }
            });
        } else {
            console.warn("La modale d'édition d'agent ou son bouton de fermeture est introuvable dans admin.html.");
        }

        if (editAgentForm) {
            editAgentForm.addEventListener('submit', handleEditAgent);
        } else {
            console.warn("Le formulaire d'édition d'agent est introuvable dans admin.html.");
        }

        // --- Écouteurs d'événements pour la vue "Gestion des Qualifications" ---
        if (addQualificationForm) {
            addQualificationForm.addEventListener('submit', handleAddQualification);
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

        // Écouteur pour le bouton d'export PDF
        if (exportPdfButton) {
            exportPdfButton.addEventListener("click", exportPlanningToPdf);
        }
    }


    // --- Fonction d'export PDF (à compléter ou à affiner) ---
    async function exportPlanningToPdf() {
        displayMessageModal("Export PDF", "Préparation de l'export PDF...", "info");
        const planningTable = document.querySelector('.global-planning-table');
        if (!planningTable) {
            displayMessageModal("Erreur Export", "Tableau de planning introuvable.", "error");
            return;
        }

        // Clone the table to manipulate without affecting original display
        const clonedTable = planningTable.cloneNode(true);
        clonedTable.style.width = 'fit-content'; // Allow content to determine width
        clonedTable.style.whiteSpace = 'nowrap'; // Prevent wrapping of text

        // Ensure all cells are visible for screenshot
        clonedTable.querySelectorAll('.slot-cell').forEach(cell => {
            cell.style.display = ''; // Remove 'none' display from filtered cells
        });

        // Temporarily append to body to ensure it's rendered for html2canvas
        document.body.appendChild(clonedTable);

        try {
            const canvas = await html2canvas(clonedTable, {
                scale: 2, // Increase scale for better resolution
                useCORS: true, // If images/assets are from different origins
                logging: true,
                removeContainer: true // Clean up cloned element after capture
            });

            const imgData = canvas.toDataURL('image/png');
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF('l', 'mm', 'a4'); // 'l' for landscape, 'mm' for units, 'a4' for size

            const imgWidth = 297; // A4 landscape width in mm
            const pageHeight = 210; // A4 landscape height in mm
            const imgHeight = canvas.height * imgWidth / canvas.width;
            let heightLeft = imgHeight;
            let position = 0;

            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;

            while (heightLeft >= 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
            }

            const weekNumber = weekSelect.value.replace('S ', 'Semaine_');
            const fileName = `Planning_Global_${weekNumber}.pdf`;
            pdf.save(fileName);
            displayMessageModal("Succès", `Le planning a été exporté sous le nom "${fileName}".`, "success");

        } catch (error) {
            console.error("Erreur lors de l'exportation du PDF:", error);
            displayMessageModal("Erreur Export", `Échec de l'exportation du PDF: ${error.message}`, "error");
        } finally {
            // Remove the cloned table if it wasn't removed by html2canvas (e.g. on error)
            if (document.body.contains(clonedTable)) {
                document.body.removeChild(clonedTable);
            }
        }
    }


    // Appeler la fonction d'initialisation au chargement complet du DOM
    await initializeAdminPage();
});