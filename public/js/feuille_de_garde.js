// Styles injectés dynamiquement pour la mise à jour visuelle
const inlineCss = `
.engine-indispo-overlay, .engine-indispo-overlay-mini {
    background-color: rgba(0, 0, 0, 0.5); /* Adoucir le voile noir pour voir le fond (de 0.6 à 0.5) */
    display: flex; /* Centrer le texte INDISPO */
    align-items: center;
    justify-content: center;
    font-size: 1.2em; /* Taille du texte INDISPO */
    color: white; /* Couleur du texte INDISPO */
    text-shadow: 1px 1px 2px rgba(0,0,0,0.8); /* Ombre pour la lisibilité */
    font-weight: bold;
}

.availability-highlight-segment {
    position: absolute;
    display: flex; /* Utiliser flexbox pour centrer le texte */
    align-items: center;
    justify-content: center;
    overflow: hidden; /* Cacher le texte qui dépasse */
    pointer-events: none; /* Empêcher le segment de bloquer les événements du slot parent */
}

.availability-segment-text {
    color: white; /* Couleur du texte sur les segments de disponibilité */
    font-size: 0.7em; /* Taille de la police adaptée (de 0.6em à 0.7em) */
    white-space: nowrap; /* Empêcher le retour à la ligne du texte */
    text-overflow: ellipsis; /* Ajouter des points de suspension si le texte est trop long */
    padding: 0 4px; /* Plus de padding horizontal */
    line-height: 1; /* Resserrement de l'interligne */
}

/* Modales personnalisées */
.custom-modal {
    display: none; /* Hidden by default */
    position: fixed; /* Stay in place */
    z-index: 1000; /* Sit on top */
    left: 0;
    top: 0;
    width: 100%; /* Full width */
    height: 100%; /* Full height */
    overflow: auto; /* Enable scroll if needed */
    background-color: rgba(0,0,0,0.7); /* Black w/ opacity */
    justify-content: center; /* Center horizontally */
    align-items: center; /* Center vertically */
}

.custom-modal .modal-content {
    background-color: #fefefe;
    margin: auto;
    padding: 20px;
    border-radius: 10px;
    box-shadow: 0 4px 8px rgba(0,0,0,0.2);
    width: 90%; /* Responsive width */
    max-width: 500px; /* Max width */
    text-align: center;
    color: #333;
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 15px;
}

.custom-modal .modal-content h2 {
    color: #0056b3;
    margin-top: 0;
    font-size: 1.8em;
}

.custom-modal .modal-content p {
    font-size: 1.1em;
    line-height: 1.5;
}

.custom-modal .modal-actions {
    display: flex;
    justify-content: center;
    gap: 15px;
    margin-top: 20px;
}

.custom-modal .btn {
    padding: 10px 20px;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    font-size: 1em;
    transition: background-color 0.3s ease, transform 0.2s ease;
}

.custom-modal .btn-primary {
    background-color: #007bff;
    color: white;
}

.custom-modal .btn-primary:hover {
    background-color: #0056b3;
    transform: translateY(-2px);
}

.custom-modal .btn-secondary {
    background-color: #6c757d;
    color: white;
}

.custom-modal .btn-secondary:hover {
    background-color: #5a6268;
    transform: translateY(-2px);
}

/* Styles spécifiques aux types de messages */
.custom-modal .modal-content.info { border: 2px solid #007bff; }
.custom-modal .modal-content.success { border: 2px solid #28a745; }
.custom-modal .modal-content.error { border: 2px solid #dc3545; }
.custom-modal .modal-content.warning { border: 2px solid #ffc107; }
.custom-modal .modal-content.question { border: 2px solid #17a2b8; }

.custom-modal .modal-content.success h2 { color: #28a745; }
.custom-modal .modal-content.error h2 { color: #dc3545; }
.custom-modal .modal-content.warning h2 { color: #ffc107; }
.custom-modal .modal-content.question h2 { color: #17a2b8; }

.custom-modal .close-button {
    position: absolute;
    top: 10px;
    right: 20px;
    font-size: 28px;
    font-weight: bold;
    color: #aaa;
    cursor: pointer;
    background: none;
    border: none;
    padding: 0;
}

.custom-modal .close-button:hover,
.custom-modal .close-button:focus {
    color: #333;
    text-decoration: none;
    cursor: pointer;
}

/* Styles pour les modales d'affectation de personnel */
#personnel-assignment-modal .modal-content {
    max-width: 900px;
}

.modal-body-assignment {
    display: flex;
    flex-wrap: wrap; /* Permet aux sections de s'enrouler sur les petits écrans */
    gap: 20px;
    margin-top: 15px;
}

.modal-section {
    flex: 1; /* Chaque section prend une part égale */
    min-width: 280px; /* Largeur minimale pour éviter un trop petit affichage */
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 15px;
    background-color: #f9f9f9;
    display: flex;
    flex-direction: column;
}

.modal-section h3 {
    margin-top: 0;
    color: #0056b3;
    border-bottom: 1px solid #eee;
    padding-bottom: 10px;
    margin-bottom: 15px;
}

.agent-list-drag-area, .roles-drop-area {
    min-height: 150px;
    max-height: 400px; /* Hauteur maximale pour le défilement */
    overflow-y: auto; /* Ajoute une barre de défilement si nécessaire */
    padding: 10px;
    border: 1px dashed #ccc;
    border-radius: 5px;
    background-color: #fff;
    flex-grow: 1; /* Permet de prendre l'espace disponible */
}

.agent-card, .role-slot {
    background-color: #e9f5ff;
    border: 1px solid #cce5ff;
    padding: 10px 15px;
    margin-bottom: 8px;
    border-radius: 5px;
    cursor: grab;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-weight: 500;
}

.agent-card:hover {
    background-color: #dbeeff;
}

.agent-card.dragging {
    opacity: 0.6;
    border-style: solid;
}

.role-slot {
    background-color: #f0f0f0;
    border: 1px solid #ddd;
    cursor: default;
    display: flex;
    flex-direction: column;
    align-items: flex-start; /* Alignement du texte à gauche */
    gap: 5px;
}

.role-slot.drag-over {
    border: 2px dashed #007bff;
    background-color: #eaf6ff;
}

.role-slot .role-title {
    font-weight: bold;
    color: #333;
    font-size: 1.1em;
}

.role-slot .assigned-agent {
    display: flex;
    align-items: center;
    background-color: #d4edda;
    border: 1px solid #28a745;
    padding: 5px 10px;
    border-radius: 4px;
    font-size: 0.9em;
    color: #155724;
    width: 100%;
    justify-content: space-between;
}

.role-slot .remove-agent-btn {
    background: none;
    border: none;
    color: #dc3545;
    font-size: 1.2em;
    cursor: pointer;
    margin-left: 10px;
    padding: 0;
    line-height: 1;
}

.role-slot .remove-agent-btn:hover {
    color: #c82333;
}

.role-slot .placeholder-text {
    color: #888;
    font-style: italic;
    font-size: 0.9em;
}

.agent-qualifications, .agent-grades {
    font-size: 0.8em;
    color: #666;
    margin-top: 5px;
}

/* Spinner de chargement */
.loading-spinner {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.6);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 2000;
    transition: opacity 0.3s ease;
}

.loading-spinner.hidden {
    opacity: 0;
    pointer-events: none;
}

.spinner {
    border: 8px solid #f3f3f3;
    border-top: 8px solid #3498db;
    border-radius: 50%;
    width: 60px;
    height: 60px;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}

/* Désactiver les éléments interactifs lorsque le spinner est actif */
button:disabled, select:disabled, input:disabled {
    cursor: not-allowed;
}

a.disabled-link {
    pointer-events: none;
    color: #aaa;
    text-decoration: none;
}

/* Styles pour le planning */
.roster-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding: 10px 0;
    border-bottom: 1px solid #eee;
}

.roster-header .header-left {
    display: flex;
    align-items: center;
    gap: 15px;
}

.roster-header .date-selector input[type="date"] {
    padding: 8px;
    border: 1px solid #ccc;
    border-radius: 5px;
    font-size: 1em;
}

.roster-header .refresh-button, .back-button {
    padding: 8px 15px;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 0.9em;
    transition: background-color 0.3s ease;
}

.roster-header .refresh-button {
    background-color: #28a745;
    color: white;
}

.roster-header .refresh-button:hover {
    background-color: #218838;
}

.roster-header .back-button {
    background-color: #6c757d;
    color: white;
    text-decoration: none;
}

.roster-header .back-button:hover {
    background-color: #5a6268;
}

.roster-controls {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 10px;
    margin-bottom: 20px;
}

.roster-controls button {
    padding: 8px 15px;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    font-size: 0.9em;
    transition: background-color 0.3s ease;
}

.roster-controls .btn-primary {
    background-color: #007bff;
    color: white;
}

.roster-controls .btn-primary:hover {
    background-color: #0056b3;
}

.roster-controls .btn-danger {
    background-color: #dc3545;
    color: white;
}

.roster-controls .btn-danger:hover {
    background-color: #c82333;
}

.engine-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 20px;
}

.engine-card {
    background-color: #f8f9fa;
    border: 1px solid #e9ecef;
    border-radius: 10px;
    overflow: hidden;
    box-shadow: 0 2px 5px rgba(0,0,0,0.1);
    display: flex;
    flex-direction: column;
    min-height: 200px; /* Hauteur minimale pour la carte */
}

.engine-header {
    background-color: #007bff;
    color: white;
    padding: 10px 15px;
    font-size: 1.2em;
    font-weight: bold;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.engine-availability {
    padding: 15px;
    flex-grow: 1; /* Permet à cette section de prendre l'espace restant */
    display: flex;
    flex-direction: column;
    gap: 10px;
    position: relative; /* Pour positionner l'overlay */
}

.engine-availability.indisponible {
    background-color: #ffcccc; /* Fond rouge clair si indisponible */
}

.availability-line {
    display: flex;
    height: 25px; /* Hauteur de chaque ligne de disponibilité */
    background-color: #e2e6ea;
    border-radius: 5px;
    position: relative;
    overflow: hidden; /* Important pour que les segments restent dans la ligne */
}

.availability-label {
    width: 60px; /* Largeur fixe pour le label d'heure */
    font-size: 0.8em;
    color: #555;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding-right: 5px;
    white-space: nowrap;
}

.availability-bar-container {
    flex-grow: 1;
    position: relative;
    display: flex; /* Permet aux segments de s'aligner */
    height: 100%;
}

.availability-segment {
    background-color: #28a745;
    border-radius: 3px;
    margin: 0 1px; /* Petit espacement entre les segments */
    height: 100%;
    position: absolute;
}

.engine-actions {
    padding: 15px;
    border-top: 1px solid #e9ecef;
    background-color: #f1f3f5;
    display: flex;
    justify-content: flex-end;
}

.engine-actions .btn {
    padding: 8px 15px;
    background-color: #007bff;
    color: white;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    transition: background-color 0.3s ease;
}

.engine-actions .btn:hover {
    background-color: #0056b3;
}

/* Responsive adjustments */
@media (max-width: 768px) {
    .roster-header {
        flex-direction: column;
        align-items: flex-start;
    }
    .roster-header .header-left {
        width: 100%;
        justify-content: space-between;
        margin-bottom: 10px;
    }
    .roster-controls {
        justify-content: center;
        width: 100%;
    }
    .engine-grid {
        grid-template-columns: 1fr; /* Une seule colonne sur mobile */
    }

    .modal-body-assignment {
        flex-direction: column; /* Sections s'empilent sur mobile */
    }
    .modal-section {
        min-width: unset; /* Supprime la largeur minimale */
        width: 100%;
    }
}
`;

document.addEventListener('DOMContentLoaded', async () => {
    // Injecter les styles CSS dynamiquement
    const styleSheet = document.createElement("style");
    styleSheet.type = "text/css";
    styleSheet.innerText = inlineCss;
    document.head.appendChild(styleSheet);

    const API_BASE_URL = "https://dispo-pompier.onrender.com"; // Assurez-vous que cette URL est correcte

    // --- Éléments du DOM ---
    const dateSelector = document.getElementById('roster-date');
    const generateAutoBtn = document.getElementById('generate-auto-btn');
    const returnToFeuilleDeGardeBtn = document.getElementById('return-to-feuille-de-garde'); // Nouveau bouton
    const engineGrid = document.querySelector('.engine-grid');
    const loadingSpinner = document.getElementById('loading-spinner');

    // Modale d'affectation de personnel
    const personnelAssignmentModal = document.getElementById('personnel-assignment-modal');
    const closePersonnelAssignmentModalBtn = document.getElementById('close-personnel-assignment-modal-btn');
    const availableAgentsList = document.getElementById('available-agents-in-modal-list');
    const engineRolesContainer = document.getElementById('engine-roles-container');
    const personnelAssignmentModalTitle = document.getElementById('personnel-assignment-modal-title');

    // --- Variables d'état de l'application ---
    const appData = {
        currentDate: new Date(),
        engines: [], // Stockera les engins avec leurs rôles
        agents: {},  // Stockera tous les agents chargés
        personnelAvailabilities: {}, // Structure: { agentId: { dateKey: [{start, end}, ...], ... } }
        qualifications: {}, // Stockera les qualifications par ID
        grades: {} // Stockera les grades par ID
    };

    // --- Helpers de date et temps ---

    /**
     * Calcule le numéro de semaine ISO 8601 pour une date donnée.
     * @param {Date} date - La date pour laquelle calculer le numéro de semaine.
     * @returns {number} Le numéro de semaine ISO 8601.
     */
    function getISOWeekNumber(date) {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
        return weekNo;
    }

    function formatDateToYYYYMMDD(date) {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function getDateFromYYYYMMDD(str) {
        const [year, month, day] = str.split('-').map(Number);
        return new Date(year, month - 1, day);
    }

    const generateTimeSlots = () => {
        const slots = [];
        const startHour = 7; // Début à 07h00
        for (let i = 0; i < 48; i++) { // 48 créneaux de 30 min pour 24h (07h00 à 06h30 le lendemain)
            const currentSlotHour = (startHour + Math.floor(i / 2)) % 24;
            const currentSlotMinute = (i % 2) * 30;
            slots.push({
                index: i,
                time: `${String(currentSlotHour).padStart(2, '0')}h${String(currentSlotMinute).padStart(2, '0')}`
            });
        }
        return slots;
    };
    const timeSlots = generateTimeSlots();

    // --- Fonctions d'authentification et de chargement initial ---

    function getToken() {
        return sessionStorage.getItem('token');
    }

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

    function showLoading(isLoading) {
        if (loadingSpinner) {
            if (isLoading) {
                loadingSpinner.classList.remove('hidden');
                document.body.style.overflow = 'hidden'; // Empêche le défilement
            } else {
                loadingSpinner.classList.add('hidden');
                document.body.style.overflow = ''; // Réactive le défilement
            }
        }
    }

    async function checkAuthAndRedirect() {
        const token = getToken();
        const userRole = sessionStorage.getItem('userRole');

        if (!token) {
            displayMessageModal("Session expirée", "Votre session a expiré. Veuillez vous reconnecter.", "error", () => {
                window.location.href = 'index.html';
            });
            return false;
        }

        if (userRole !== 'admin') {
            displayMessageModal("Accès non autorisé", "Vous n'avez pas les autorisations nécessaires pour accéder à cette page.", "error", () => {
                window.location.href = 'agent.html';
            });
            return false;
        }
        return true;
    }

    // --- Fonctions de chargement des données (Appels API) ---

    async function fetchEngines() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/engines`, { headers: getAuthHeaders() });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || "Erreur de chargement des engins.");
            appData.engines = data;
            console.log("Engins chargés:", appData.engines);
        } catch (error) {
            console.error("Erreur lors du chargement des engins:", error);
            displayMessageModal("Erreur de Chargement", `Impossible de charger les engins: ${error.message}`, "error");
        }
    }

    async function fetchAgents() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/agents`, { headers: getAuthHeaders() });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || "Erreur de chargement des agents.");
            appData.agents = {}; // Réinitialiser avant de peupler
            data.forEach(agent => {
                appData.agents[agent._id] = {
                    id: agent._id,
                    nom: agent.nom,
                    prenom: agent.prenom,
                    qualifications: agent.qualifications || [],
                    grades: agent.grades || []
                };
            });
            console.log("Agents chargés:", appData.agents);
        } catch (error) {
            console.error("Erreur lors du chargement des agents:", error);
            displayMessageModal("Erreur de Chargement", `Impossible de charger les agents: ${error.message}`, "error");
        }
    }

    async function fetchQualifications() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/qualifications`, { headers: getAuthHeaders() });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || "Erreur de chargement des qualifications.");
            appData.qualifications = {};
            data.forEach(q => appData.qualifications[q.id] = q.name);
            console.log("Qualifications chargées:", appData.qualifications);
        } catch (error) {
            console.error("Erreur lors du chargement des qualifications:", error);
            displayMessageModal("Erreur de Chargement", `Impossible de charger les qualifications: ${error.message}`, "error");
        }
    }

    async function fetchGrades() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/grades`, { headers: getAuthHeaders() });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || "Erreur de chargement des grades.");
            appData.grades = {};
            data.forEach(g => appData.grades[g.id] = g.name);
            console.log("Grades chargés:", appData.grades);
        } catch (error) {
            console.error("Erreur lors du chargement des grades:", error);
            displayMessageModal("Erreur de Chargement", `Impossible de charger les grades: ${error.message}`, "error");
        }
    }

    /**
     * Charge les disponibilités de tous les agents pour la semaine en cours.
     * Utilise le chemin /api/planning/:agentId pour récupérer le planning complet.
     * Stocke les disponibilités dans appData.personnelAvailabilities.
     */
    async function loadAllAgentsAvailabilities() {
        appData.personnelAvailabilities = {}; // Réinitialiser avant de charger

        const currentYear = appData.currentDate.getFullYear();
        const currentWeekNumber = getISOWeekNumber(appData.currentDate);
        const isoWeekString = `S ${currentWeekNumber}`;
        const daysOfWeekNames = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

        // Calculer le lundi de la semaine de la date sélectionnée
        const currentDayOfWeek = appData.currentDate.getDay(); // 0 = Dimanche, 1 = Lundi, ..., 6 = Samedi
        const diffToMonday = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek; // Jours à retrancher pour arriver au lundi
        const mondayOfCurrentWeek = new Date(appData.currentDate);
        mondayOfCurrentWeek.setDate(appData.currentDate.getDate() + diffToMonday);
        mondayOfCurrentWeek.setHours(0, 0, 0, 0); // Important: réinitialiser l'heure pour éviter des décalages de date

        for (const agentId in appData.agents) {
            try {
                const response = await fetch(`${API_BASE_URL}/api/planning/${agentId}`, { headers: getAuthHeaders() });
                const planning = await response.json();

                if (!response.ok) {
                    console.warn(`Impossible de charger le planning pour l'agent ${agentId}: ${planning.message || response.statusText}`);
                    continue; // Passer à l'agent suivant en cas d'erreur
                }

                if (planning && planning[isoWeekString]) {
                    appData.personnelAvailabilities[agentId] = {}; // Initialiser l'objet pour cet agent
                    for (let i = 0; i < 7; i++) { // Pour chaque jour de la semaine (Lundi à Dimanche)
                        const dateForDay = new Date(mondayOfCurrentWeek);
                        dateForDay.setDate(mondayOfCurrentWeek.getDate() + i); // Obtenir la date exacte pour chaque jour de la semaine
                        const dateKey = formatDateToYYYYMMDD(dateForDay);

                        const dayName = daysOfWeekNames[i]; // Nom du jour (ex: 'lundi')
                        const availabilitiesForAgent = planning[isoWeekString][dayName] || [];

                        // Assurez-vous que l'objet pour l'agent existe avant d'assigner
                        if (!appData.personnelAvailabilities[agentId]) {
                            appData.personnelAvailabilities[agentId] = {};
                        }
                        appData.personnelAvailabilities[agentId][dateKey] = availabilitiesForAgent;
                    }
                }
            } catch (error) {
                console.error(`Erreur réseau/parsing lors du chargement des disponibilités de l'agent ${agentId}:`, error);
                // Si l'agent n'a pas de disponibilités, son entrée reste vide ou inexistante dans appData.personnelAvailabilities
            }
        }
        console.log("Disponibilités du personnel chargées:", appData.personnelAvailabilities);
    }

    async function loadAllDataAndRender() {
        showLoading(true);
        try {
            const authOk = await checkAuthAndRedirect();
            if (!authOk) return;

            // Charger toutes les données de référence en parallèle
            await Promise.all([
                fetchEngines(),
                fetchAgents(),
                fetchQualifications(),
                fetchGrades()
            ]);

            // Ensuite, charger les disponibilités, car elles dépendent des agents
            await loadAllAgentsAvailabilities();

            renderEngines();
        } catch (error) {
            console.error("Erreur lors du chargement initial des données:", error);
            displayMessageModal("Erreur Critique", "Impossible de charger les données initiales de l'application. Veuillez vérifier la console pour plus de détails.", "error");
        } finally {
            showLoading(false);
        }
    }

    // --- Fonctions de rendu ---

    function renderEngines() {
        if (!engineGrid) {
            console.error("L'élément 'engine-grid' est introuvable.");
            return;
        }
        engineGrid.innerHTML = ''; // Nettoyer la grille avant de rendre

        appData.engines.forEach(engine => {
            const engineCard = document.createElement('div');
            engineCard.classList.add('engine-card');
            engineCard.dataset.engineId = engine.id; // Pour référence facile

            const engineHeader = document.createElement('div');
            engineHeader.classList.add('engine-header');
            engineHeader.textContent = engine.name;
            engineCard.appendChild(engineHeader);

            const engineAvailability = document.createElement('div');
            engineAvailability.classList.add('engine-availability');
            engineCard.appendChild(engineAvailability);

            // Vérifier si l'engin est disponible pour la date actuelle
            const isEngineAvailable = isEngineFullyAvailable(engine, appData.currentDate);
            if (!isEngineAvailable) {
                engineAvailability.classList.add('indisponible');
                const overlay = document.createElement('div');
                overlay.classList.add('engine-indispo-overlay');
                overlay.textContent = 'INDISPO';
                engineAvailability.appendChild(overlay);
            }

            // Création des lignes de disponibilité pour chaque heure (07h00 - 06h30)
            for (let i = 0; i < 24; i++) { // Afficher 24h, de 07h00 à 06h30
                const hourStart = (7 + i) % 24;
                // const hourEnd = (7 + i + 1) % 24; // Non utilisé directement ici pour le label de ligne

                const availabilityLine = document.createElement('div');
                availabilityLine.classList.add('availability-line');

                const label = document.createElement('div');
                label.classList.add('availability-label');
                label.textContent = `${String(hourStart).padStart(2, '0')}h`;
                availabilityLine.appendChild(label);

                const barContainer = document.createElement('div');
                barContainer.classList.add('availability-bar-container');
                availabilityLine.appendChild(barContainer);

                // Ajouter les segments de disponibilité ici
                // Chaque segment représente 30 minutes. Il y a 2 segments par heure.
                const startSlotIndex = i * 2; // Index du premier créneau de 30 min pour cette heure
                // const endSlotIndex = startSlotIndex + 1; // Index du deuxième créneau (non utilisé tel quel pour la boucle j)

                // Parcourir les créneaux de 30 minutes de l'heure en cours
                for (let j = 0; j < 2; j++) { // j=0 pour le premier 30min, j=1 pour le second 30min
                    const current30MinSlotIndex = startSlotIndex + j; // Index global du créneau 0-47

                    const relevantAgentsForRoles = getAgentsAvailableForEngineRoles(engine, current30MinSlotIndex);

                    if (relevantAgentsForRoles.length > 0) {
                        // Il y a des agents disponibles pour au moins un rôle de cet engin à ce créneau
                        const segment = document.createElement('div');
                        segment.classList.add('availability-segment');
                        segment.style.left = `${j * 50}%`; // 0% pour le premier créneau (j=0), 50% pour le second (j=1)
                        segment.style.width = '50%'; // Chaque segment fait 50% de la largeur de la barre d'heure
                        barContainer.appendChild(segment);

                        const segmentText = document.createElement('span');
                        segmentText.classList.add('availability-segment-text');
                        segmentText.textContent = `${relevantAgentsForRoles.length} agents`; // Ou une autre info pertinente
                        segment.appendChild(segmentText);

                    } else {
                        // Aucun agent disponible pour cet engin à ce créneau
                        const overlayMini = document.createElement('div');
                        overlayMini.classList.add('engine-indispo-overlay-mini');
                        overlayMini.style.left = `${j * 50}%`;
                        overlayMini.style.width = '50%';
                        overlayMini.textContent = 'X'; // Ou un indicateur visuel de non-disponibilité
                        barContainer.appendChild(overlayMini);
                    }
                }
                engineAvailability.appendChild(availabilityLine);
            }


            const engineActions = document.createElement('div');
            engineActions.classList.add('engine-actions');
            const assignBtn = document.createElement('button');
            assignBtn.classList.add('btn');
            assignBtn.textContent = 'Affecter le personnel';
            assignBtn.addEventListener('click', () => openPersonnelAssignmentModal(engine));
            engineActions.appendChild(assignBtn);
            engineCard.appendChild(engineActions);

            engineGrid.appendChild(engineCard);
        });
    }

    // Vérifie si un engin est entièrement indisponible pour la journée (si aucun agent ne peut remplir ses rôles)
    function isEngineFullyAvailable(engine, date) {
        const dateKey = formatDateToYYYYMMDD(date);

        // Si l'engin n'a pas de rôles, on le considère disponible par défaut (ou on peut changer cette logique)
        if (!engine.roles || engine.roles.length === 0) {
            return true;
        }

        // Pour chaque créneau de 30 minutes de 07h00 à 06h30 le lendemain (48 créneaux)
        for (let slotIndex = 0; slotIndex < 48; slotIndex++) {
            let isSlotCoveredByAtLeastOneAgent = false;

            // Vérifier si au moins un agent peut couvrir au moins un rôle de l'engin pour ce créneau
            // On considère que si un agent peut couvrir UN rôle, alors il y a une potentielle disponibilité.
            // La logique plus fine de l'affectation se fera dans la modale.
            for (const agentId in appData.agents) {
                const agentAvailabilities = appData.personnelAvailabilities[agentId]?.[dateKey] || [];

                // Vérifier si l'agent est disponible sur ce slot
                const isAgentAvailableInSlot = agentAvailabilities.some(range =>
                    slotIndex >= range.start && slotIndex <= range.end
                );

                if (isAgentAvailableInSlot) {
                    // Si l'agent est disponible, vérifier s'il a au moins une qualification/grade pour un rôle de l'engin
                    const agent = appData.agents[agentId];
                    const agentHasRequiredRole = engine.roles.some(role => {
                        const hasQualification = role.qualificationIds.some(qualId => agent.qualifications.includes(qualId));
                        const hasGrade = role.gradeIds.some(gradeId => agent.grades.includes(gradeId));
                        return hasQualification || hasGrade;
                    });

                    if (agentHasRequiredRole) {
                        isSlotCoveredByAtLeastOneAgent = true;
                        break; // Un agent peut couvrir un rôle pour ce créneau, passer au créneau suivant
                    }
                }
            }

            if (!isSlotCoveredByAtLeastOneAgent) {
                // Si AUCUN agent n'est disponible pour ce créneau ET ne peut couvrir un rôle,
                // alors l'engin est indisponible sur ce créneau, ce qui le rend indisponible globalement pour la journée.
                return false;
            }
        }
        return true; // Si tous les créneaux sont couverts par au moins un agent ayant une compétence requise
    }


    /**
     * Retourne la liste des agents disponibles et qualifiés/gradés pour les rôles d'un engin spécifique
     * à un créneau donné.
     * @param {Object} engine - L'objet de l'engin.
     * @param {number} slotIndex - L'index du créneau horaire (0-47).
     * @returns {Array} Liste des agents (prénom nom) disponibles et qualifiés/gradés pour ce créneau.
     */
    function getAgentsAvailableForEngineRoles(engine, slotIndex) {
        const dateKey = formatDateToYYYYMMDD(appData.currentDate);
        const availableAndQualifiedAgents = [];

        for (const agentId in appData.agents) {
            const agent = appData.agents[agentId];
            const agentAvailabilities = appData.personnelAvailabilities[agentId]?.[dateKey] || [];

            // Vérifier si l'agent est disponible sur ce slot
            const isAgentAvailableInSlot = agentAvailabilities.some(range =>
                slotIndex >= range.start && slotIndex <= range.end
            );

            if (isAgentAvailableInSlot) {
                // Vérifier si l'agent a au moins une des qualifications ou grades requis pour n'importe quel rôle de l'engin
                const hasRequiredCompetencyForEngine = engine.roles.some(role => {
                    const hasQualification = role.qualificationIds.some(qualId => agent.qualifications.includes(qualId));
                    const hasGrade = role.gradeIds.some(gradeId => agent.grades.includes(gradeId));
                    return hasQualification || hasGrade;
                });

                if (hasRequiredCompetencyForEngine) {
                    availableAndQualifiedAgents.push({
                        id: agent.id,
                        nom: agent.nom,
                        prenom: agent.prenom,
                        qualifications: agent.qualifications,
                        grades: agent.grades
                    });
                }
            }
        }
        return availableAndQualifiedAgents;
    }


    // --- Fonctions de la Modale d'affectation de personnel ---

    let currentEngineForAssignment = null; // Stocke l'engin en cours d'affectation

    function openPersonnelAssignmentModal(engine) {
        currentEngineForAssignment = engine;
        if (!personnelAssignmentModal || !personnelAssignmentModalTitle || !availableAgentsList || !engineRolesContainer) {
            console.error("Éléments de la modale d'affectation introuvables.");
            displayMessageModal("Erreur", "Impossible d'ouvrir la modale d'affectation (éléments manquants).", "error");
            return;
        }

        personnelAssignmentModalTitle.textContent = `Affecter le personnel à ${engine.name}`;
        renderAvailableAgentsInModal();
        renderEngineRolesInModal(engine);

        personnelAssignmentModal.style.display = 'flex';
    }

    closePersonnelAssignmentModalBtn.addEventListener('click', () => {
        personnelAssignmentModal.style.display = 'none';
        currentEngineForAssignment = null; // Réinitialiser l'engin
    });

    // Fermer la modale en cliquant en dehors
    personnelAssignmentModal.addEventListener('click', (e) => {
        if (e.target === personnelAssignmentModal) {
            personnelAssignmentModal.style.display = 'none';
            currentEngineForAssignment = null;
        }
    });


    // Rendu des agents disponibles pour le drag-and-drop
    function renderAvailableAgentsInModal() {
        availableAgentsList.innerHTML = '';
        const dateKey = formatDateToYYYYMMDD(appData.currentDate);
        const allAgents = Object.values(appData.agents); // Obtenez tous les agents comme un tableau

        if (allAgents.length === 0) {
            availableAgentsList.textContent = "Aucun agent chargé.";
            return;
        }

        allAgents.sort((a, b) => { // Trie les agents par nom pour un affichage cohérent
            const nameA = `${a.prenom} ${a.nom}`;
            const nameB = `${b.prenom} ${b.nom}`;
            return nameA.localeCompare(nameB);
        });


        allAgents.forEach(agent => {
            const agentAvailabilities = appData.personnelAvailabilities[agent.id]?.[dateKey] || [];
            const isAgentAvailableToday = agentAvailabilities.length > 0;

            const agentCard = document.createElement('div');
            agentCard.classList.add('agent-card');
            agentCard.dataset.agentId = agent.id;
            agentCard.draggable = true; // Rendre les cartes d'agent draggable par défaut

            let qualificationsText = agent.qualifications.map(id => appData.qualifications[id] || id).join(', ');
            let gradesText = agent.grades.map(id => appData.grades[id] || id).join(', ');

            agentCard.innerHTML = `
                <span>${agent.prenom} ${agent.nom}</span>
                <div class="agent-details">
                    ${qualificationsText ? `<div class="agent-qualifications">Qualif: ${qualificationsText}</div>` : ''}
                    ${gradesText ? `<div class="agent-grades">Grade: ${gradesText}</div>` : ''}
                    ${isAgentAvailableToday ? '' : '<div style="color: red; font-weight: bold;">(Indisponible aujourd\'hui)</div>'}
                </div>
            `;

            if (!isAgentAvailableToday) {
                 agentCard.style.opacity = '0.6';
                 agentCard.draggable = false; // Rendre non-draggable s'il est indisponible
                 agentCard.style.cursor = 'not-allowed'; // Changer le curseur
            }

            agentCard.addEventListener('dragstart', (e) => {
                if (agentCard.draggable === false) { // Ne pas démarrer le drag si non-draggable
                    e.preventDefault();
                    return;
                }
                e.dataTransfer.setData('text/plain', agent.id);
                agentCard.classList.add('dragging');
            });

            agentCard.addEventListener('dragend', () => {
                agentCard.classList.remove('dragging');
            });

            availableAgentsList.appendChild(agentCard);
        });

        // Gestion des événements de glisser-déposer sur la liste des agents disponibles
        availableAgentsList.addEventListener('dragover', (e) => {
            e.preventDefault(); // Nécessaire pour autoriser le drop
        });
        availableAgentsList.addEventListener('drop', (e) => {
            e.preventDefault();
            // L'idée est que si on lâche un agent ici, il est "non affecté"
            // Cela ne nécessite pas de logique complexe ici si l'agent est déjà dans la liste
            // C'est surtout utile si on veut "désaffecter" un agent d'un rôle.
            // Pour l'instant, on se contente de re-rendre pour s'assurer de la cohérence visuelle.
            renderAvailableAgentsInModal();
            renderEngineRolesInModal(currentEngineForAssignment); // Re-render les rôles aussi pour rafraîchir
        });
    }

    // Rendu des rôles de l'engin pour le drop
    function renderEngineRolesInModal(engine) {
        engineRolesContainer.innerHTML = '';
        if (!engine.roles || engine.roles.length === 0) {
            engineRolesContainer.textContent = "Cet engin n'a pas de rôles définis.";
            return;
        }

        engine.roles.forEach(role => {
            const roleSlot = document.createElement('div');
            roleSlot.classList.add('role-slot');
            roleSlot.dataset.roleId = role.id;

            const roleTitle = document.createElement('div');
            roleTitle.classList.add('role-title');
            roleTitle.textContent = role.name;
            roleSlot.appendChild(roleTitle);

            // Afficher les qualifications et grades requis
            let requiredText = [];
            if (role.qualificationIds && role.qualificationIds.length > 0) {
                requiredText.push('Qualif: ' + role.qualificationIds.map(id => appData.qualifications[id] || id).join(', '));
            }
            if (role.gradeIds && role.gradeIds.length > 0) {
                requiredText.push('Grade: ' + role.gradeIds.map(id => appData.grades[id] || id).join(', '));
            }
            if (requiredText.length > 0) {
                const requiredInfo = document.createElement('div');
                requiredInfo.classList.add('role-requirements');
                requiredInfo.textContent = `Requis: ${requiredText.join(' / ')}`;
                roleSlot.appendChild(requiredInfo);
            }

            // Placeholder pour l'agent affecté
            const assignedAgentDiv = document.createElement('div');
            assignedAgentDiv.classList.add('assigned-agent-container');
            // Initialisez avec un placeholder si aucun agent n'est affecté (logique à définir si on stocke les affectations)
            assignedAgentDiv.innerHTML = `<span class="placeholder-text">Glissez un agent ici</span>`;
            roleSlot.appendChild(assignedAgentDiv);


            roleSlot.addEventListener('dragover', (e) => {
                e.preventDefault(); // Nécessaire pour autoriser le drop
                roleSlot.classList.add('drag-over');
            });

            roleSlot.addEventListener('dragleave', () => {
                roleSlot.classList.remove('drag-over');
            });

            roleSlot.addEventListener('drop', (e) => {
                e.preventDefault();
                roleSlot.classList.remove('drag-over');
                const agentId = e.dataTransfer.getData('text/plain');
                const agent = appData.agents[agentId];

                if (agent) {
                    const dateKey = formatDateToYYYYMMDD(appData.currentDate);
                    const agentAvailabilities = appData.personnelAvailabilities[agent.id]?.[dateKey] || [];
                    const isAgentAvailableToday = agentAvailabilities.length > 0;

                    if (!isAgentAvailableToday) {
                        displayMessageModal("Affectation Impossible", `${agent.prenom} ${agent.nom} est indisponible pour la date sélectionnée.`, "warning");
                        return;
                    }

                    // Vérifier si l'agent a les qualifications/grades requis pour ce rôle
                    const hasAllQualifications = role.qualificationIds.every(qualId => agent.qualifications.includes(qualId));
                    const hasAllGrades = role.gradeIds.every(gradeId => agent.grades.includes(gradeId));

                    let missingRequirements = [];
                    if (role.qualificationIds.length > 0 && !hasAllQualifications) {
                         const missingQuals = role.qualificationIds.filter(qualId => !agent.qualifications.includes(qualId))
                                             .map(id => appData.qualifications[id] || id);
                         missingRequirements.push(`qualifications manquantes : ${missingQuals.join(', ')}`);
                    }
                    if (role.gradeIds.length > 0 && !hasAllGrades) {
                        const missingGrades = role.gradeIds.filter(gradeId => !agent.grades.includes(gradeId))
                                            .map(id => appData.grades[id] || id);
                        missingRequirements.push(`grades manquants : ${missingGrades.join(', ')}`);
                    }

                    if (missingRequirements.length > 0) {
                        displayMessageModal(
                            "Affectation Impossible",
                            `${agent.prenom} ${agent.nom} ne possède pas toutes les exigences requises pour le rôle de ${role.name}:<br>${missingRequirements.join('<br>')}`,
                            "warning"
                        );
                        return;
                    }


                    // Mettre à jour l'affichage pour montrer l'agent affecté
                    assignedAgentDiv.innerHTML = `
                        <span class="assigned-agent" data-assigned-agent-id="${agent.id}">
                            ${agent.prenom} ${agent.nom}
                            <button class="remove-agent-btn" data-agent-id="${agent.id}">&times;</button>
                        </span>
                    `;
                    // Gérer l'événement de suppression d'agent du rôle
                    assignedAgentDiv.querySelector('.remove-agent-btn').addEventListener('click', (removeEvent) => {
                        removeEvent.stopPropagation(); // Empêche le drop de se déclencher à nouveau
                        assignedAgentDiv.innerHTML = `<span class="placeholder-text">Glissez un agent ici</span>`;
                        // Optionnel: remettre l'agent dans la liste des disponibles si on le souhaite
                        renderAvailableAgentsInModal(); // Re-rendre la liste des agents disponibles
                    });

                    // Optionnel: Supprimer l'agent de la liste des disponibles si un seul rôle par agent
                    // renderAvailableAgentsInModal(); // Re-rendre pour refléter le changement
                }
            });
        });
    }

    // --- Modales (remplace alert() et confirm()) ---
    /**
     * Affiche une modale de message personnalisée.
     * @param {string} title - Titre de la modale.
     * @param {string} message - Message à afficher.
     * @param {'info'|'success'|'error'|'warning'|'question'} type - Type de message pour le style.
     * @param {function(boolean)} [callback] - Fonction de rappel pour les confirmations (true si OK/Oui, false si Annuler/Non).
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

    // Remplacement des fonctions natives alert et confirm pour utiliser les modales personnalisées
    window.confirm = (message) => {
        return new Promise((resolve) => {
            displayMessageModal("Confirmation", message, "question", (result) => {
                resolve(result);
            });
        });
    };
    window.alert = (message) => {
        displayMessageModal("Information", message, "info");
    };


    // --- Initialisation ---

    // Écouteur pour la sélection de date
    dateSelector.addEventListener('change', async (event) => {
        appData.currentDate = new Date(event.target.value);
        await loadAllAgentsAvailabilities(); // Recharger les disponibilités pour la nouvelle date
        renderEngines(); // Re-rendre les engins avec les nouvelles disponibilités
    });

    // Écouteur pour le bouton de génération automatique
    generateAutoBtn.addEventListener('click', () => {
        displayMessageModal("Fonctionnalité à implémenter", "La génération automatique n'est pas encore implémentée.", "info");
        // Logique de génération automatique à implémenter ici
    });

    // Écouteur pour le bouton de retour (si vous avez un lien vers une autre page, ex: admin.html)
    if (returnToFeuilleDeGardeBtn) {
        returnToFeuilleDeGardeBtn.addEventListener('click', () => {
            window.location.href = 'admin.html'; // Assurez-vous que c'est le bon chemin
        });
    }

    // Initialisation : charge les données et rend la vue
    dateSelector.value = formatDateToYYYYMMDD(appData.currentDate); // Définir la date par défaut dans le sélecteur
    await loadAllDataAndRender();
});
