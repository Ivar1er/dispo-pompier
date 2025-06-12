const API_BASE_URL = "https://dispo-pompier.onrender.com";

// Créneaux horaires de 07:00 à 07:00 le lendemain
const horaires = [];
const startHourDisplay = 7; // Heure de début des créneaux

for (let i = 0; i < 48; i++) { // 48 créneaux de 30 minutes = 24 heures
    const currentSlotHour = (startHourDisplay + Math.floor(i / 2)) % 24;
    const currentSlotMinute = (i % 2) * 30;

    const endSlotHour = (startHourDisplay + Math.floor((i + 1) / 2)) % 24;
    const endSlotMinute = ((i + 1) % 2) * 30;

    const start = `${String(currentSlotHour).padStart(2, '0')}:${String(currentSlotMinute).padStart(2, '0')}`;
    const end = `${String(endSlotHour).padStart(2, '0')}:${String(endSlotMinute).padStart(2, '0')}`;

    horaires.push(`${start} - ${end}`);
}

// DOM Elements
const rosterDateInput = document.getElementById('roster-date');
const prevDayButton = document.getElementById('prev-day-button');
const nextDayButton = document.getElementById('next-day-button');
const refreshButton = document.getElementById('refresh-button');
const availablePersonnelList = document.getElementById('available-personnel-list');
const onDutyAgentsGrid = document.getElementById('on-duty-agents-grid');
const rosterGridContainer = document.getElementById('roster-grid');
const engineDetailsPage = document.getElementById('engine-details-page');
const backToRosterBtn = document.getElementById('back-to-roster-btn');
const loadingSpinner = document.getElementById('loading-spinner'); // Assurez-vous d'avoir un spinner dans votre HTML si vous l'utilisez
const addTimeSlotBtn = document.getElementById('add-time-slot-btn'); // Bouton '+' pour ajouter des créneaux, si nécessaire. Initialement, non utilisé pour la génération auto.

let currentRosterDate = new Date(); // Date actuelle
let allAgents = []; // Tous les agents (y compris leurs qualifications)
// onDutyAgents n'est plus global mais stocké dans appData[dateKey].onDutyAgents
let currentRosterData = {}; // La feuille de garde générée/manuelle pour la date


document.addEventListener('DOMContentLoaded', async () => {
    // Vérification du rôle administrateur
    const userRole = sessionStorage.getItem("userRole");
    if (!userRole || userRole !== "admin") {
        showAlertModal("Accès non autorisé. Vous devez être administrateur.");
        sessionStorage.clear();
        window.location.href = "index.html";
        return;
    }

    // Initialisation de la date du sélecteur
    rosterDateInput.valueAsDate = currentRosterDate;

    // Écouteurs d'événements pour la navigation de date
    rosterDateInput.addEventListener('change', (e) => {
        currentRosterDate = new Date(e.target.value);
        console.log('Date changed to:', currentRosterDate, 'Formatted as:', formatDateToYYYYMMDD(currentRosterDate)); // Ajouté pour le débogage
        updateDateDisplay(); // Appelle updateDateDisplay qui gérera le chargement et le rendu
    });
    prevDayButton.addEventListener('click', () => {
        currentRosterDate.setDate(currentRosterDate.getDate() - 1);
        rosterDateInput.valueAsDate = currentRosterDate;
        console.log('Previous day selected:', currentRosterDate, 'Formatted as:', formatDateToYYYYMMDD(currentRosterDate)); // Ajouté pour le débogage
        updateDateDisplay();
    });
    nextDayButton.addEventListener('click', () => {
        currentRosterDate.setDate(currentRosterDate.getDate() + 1);
        rosterDateInput.valueAsDate = currentRosterDate;
        console.log('Next day selected:', currentRosterDate, 'Formatted as:', formatDateToYYYYMMDD(currentRosterDate)); // Ajouté pour le débogage
        updateDateDisplay();
    });

    // Écouteur pour le bouton "Généré auto"
    refreshButton.addEventListener('click', () => {
        showConfirmationModal("Voulez-vous générer automatiquement la feuille de garde pour la journée ? Les postes vides seront remplis.", (confirmed) => {
            if (confirmed) {
                generateAutomaticRoster(formatDateToYYYYMMDD(currentRosterDate));
            }
        });
    });

    // Écouteurs pour le bouton de retour de la page "Engin"
    backToRosterBtn.addEventListener('click', () => {
        showMainRosterGrid();
    });

    // Initialisation des cases d'astreinte (structure HTML fixe, le contenu est dynamique)
    createOnDutySlots();
    // Charger les données initiales
    await loadInitialData();
});

// Définition des priorités de grade pour l'affectation automatique
const gradePriority = {
    'CATE': 1, // Chef d'Agrès Tout Engin (Adjudant, Adjudant-Chef) - priorité la plus élevée
    'CAUE': 2,  // Chef d'Agrès Un Engin (Sergent, Sergent-Chef)
    'CAP': 3, // Caporal
    'SAP': 4, // Sapeur (SAP 1 & 2) - priorité la plus basse
    'none': 99 // Pour l'option 'Non assigné'
};

// Définition des préférences de grade pour chaque rôle
const roleGradePreferences = {
    'EQ': ['SAP', 'CAP', 'CAUE', 'CATE'],
    'COD0': ['CAP', 'SAP', 'CAUE', 'CATE'], // Conducteur VSAV
    'EQ1_FPT': ['CAP', 'SAP', 'CAUE', 'CATE'],
    'EQ2_FPT': ['SAP', 'CAP', 'CAUE', 'CATE'],
    'EQ1_FDF1': ['CAP', 'SAP', 'CAUE', 'CATE'],
    'EQ2_FDF1': ['SAP', 'CAP', 'CAUE', 'CATE'],
    'CA_VSAV': ['CAUE', 'CATE', 'CAP', 'SAP'],
    'CA_FPT': ['CATE', 'CAUE', 'CAP', 'SAP'],
    'COD1': ['SAP', 'CAP', 'CAUE', 'CATE'], // Conducteur FPT
    'COD2': ['SAP', 'CAP', 'CAUE', 'CATE'], // Conducteur CCF
    'CA_FDF2': ['CATE', 'CAUE', 'CAP', 'SAP'],
    'CA_VTU': ['CAUE', 'CATE', 'CAP', 'SAP'],
    'CA_VPMA': ['CAUE', 'CATE', 'CAP', 'SAP']
};

// Définition de la priorité des types de rôles pour le tri (plus petit = plus prioritaire)
const roleTypePriority = {
    'CA': 1, // Chef d'Agrès
    'COD': 2, // Conducteur
    'EQ': 3  // Équipier
};

// Helper pour obtenir le type de rôle à partir de la clé de rôle (ex: 'CA_FPT' -> 'CA')
function getRoleType(roleKey) {
    if (roleKey.startsWith('CA_')) return 'CA';
    if (roleKey.startsWith('COD')) return 'COD';
    if (roleKey.startsWith('EQ')) return 'EQ';
    return 'unknown';
}

// Liste du personnel disponible avec leurs qualifications et leur grade (cette liste est fixe côté client)
const availablePersonnel = [
    // CATE (Chef d'Agrès Tout Engin)
    { id: 'bruneau', prenom: 'Mathieu', nom: 'BRUNEAU', qualifications: ['CA_FPT', 'CA_VSAV', 'CA_VTU', 'CA_VPMA', 'COD0', 'EQ1_FPT', 'EQ2_FPT', 'EQ1_FDF1', 'EQ2_FDF1', 'EQ'], grade: 'CATE' },
    { id: 'vatinel', prenom: 'Sébastien', nom: 'VATINEL', qualifications: ['CA_FDF2', 'CA_FPT', 'CA_VSAV', 'CA_VTU', 'CA_VPMA', 'COD2', 'COD1', 'COD0', 'EQ1_FPT', 'EQ2_FPT', 'EQ1_FDF1', 'EQ2_FDF1', 'EQ'], grade: 'CATE' },
    { id: 'lelann', prenom: 'Philippe', nom: 'LE LANN', qualifications: ['CA_FPT', 'CA_VSAV', 'CA_VTU', 'CA_VPMA', 'COD1', 'COD0', 'EQ1_FPT', 'EQ2_FPT', 'EQ1_FDF1', 'EQ2_FDF1', 'EQ'], grade: 'CATE' },
    { id: 'tuleu', prenom: 'Kévin', nom: 'TULEU', qualifications: ['CA_FPT', 'CA_VSAV', 'CA_VTU', 'CA_VPMA', 'COD0', 'EQ1_FPT', 'EQ2_FPT', 'EQ'], grade: 'CATE' },
    { id: 'gesbert', prenom: 'Jonathan', nom: 'GESBERT', qualifications: ['CA_FDF2', 'CA_FPT', 'CA_VSAV', 'CA_VTU', 'CA_VPMA', 'COD2', 'COD1', 'COD0', 'EQ1_FPT', 'EQ2_FPT', 'EQ1_FDF1', 'EQ2_FDF1', 'EQ'], grade: 'CATE' },

    // CAUE (Chef d'Agrès Un Engin)
    { id: 'cordel', prenom: 'Camilla', nom: 'CORDEL', qualifications: ['CA_VSAV', 'CA_VTU', 'CA_VPMA', 'COD1', 'COD0', 'EQ1_FPT', 'EQ2_FPT', 'EQ1_FDF1', 'EQ2_FDF1', 'EQ'], grade: 'CAUE' },
    { id: 'boudet', prenom: 'Sébastien', nom: 'BOUDET', qualifications: ['CA_VSAV', 'CA_VTU', 'CA_VPMA', 'COD2', 'COD1', 'COD0', 'EQ1_FPT', 'EQ2_FPT', 'EQ1_FDF1', 'EQ2_FDF1', 'EQ'], grade: 'CAUE' },
    { id: 'boulmé', prenom: 'Grégoire', nom: 'BOULME', qualifications: ['CA_VSAV', 'CA_VTU', 'CA_VPMA', 'COD0', 'EQ1_FPT', 'EQ2_FPT', 'EQ1_FDF1', 'EQ2_FDF1', 'EQ'], grade: 'CAUE' },

    // CAP (Caporal)
    { id: 'marechal', prenom: 'Nicolas', nom: 'MARECHAL', qualifications: ['COD1', 'COD0', 'EQ1_FPT', 'EQ2_FPT', 'EQ1_FDF1', 'EQ2_FDF1', 'EQ'], grade: 'CAP' },
    { id: 'normand', prenom: 'Stéphane', nom: 'NORMAND', qualifications: ['COD2', 'COD1', 'COD0', 'EQ1_FPT', 'EQ2_FPT', 'EQ1_FDF1', 'EQ2_FDF1', 'EQ'], grade: 'CAP' },
    { id: 'justice', prenom: 'Quentin', nom: 'JUSTICE', qualifications: ['COD0', 'EQ1_FPT', 'EQ2_FPT', 'EQ1_FDF1', 'EQ2_FDF1', 'EQ'], grade: 'CAP' },
    { id: 'schaeffer', prenom: 'Caroline', nom: 'SCHAEFFER', qualifications: ['COD0', 'EQ1_FPT', 'EQ2_FPT', 'EQ1_FDF1', 'EQ2_FDF1', 'EQ'], grade: 'CAP' },
    { id: 'veniant', prenom: 'Mathis', nom: 'VENIANT', qualifications: ['COD0', 'EQ1_FPT', 'EQ2_FPT', 'EQ1_FDF1', 'EQ2_FDF1', 'EQ'], grade: 'CAP' },

    // SAP (Sapeur 1 & 2)
    { id: 'loisel', prenom: 'Charlotte', nom: 'LOISEL', qualifications: ['COD0', 'EQ1_FPT', 'EQ2_FPT', 'EQ'], grade: 'SAP' },
    { id: 'mailly', prenom: 'Lucile', nom: 'MAILLY', qualifications: ['EQ1_FPT', 'EQ2_FPT', 'EQ'], grade: 'SAP' },
    { id: 'savigny', prenom: 'Victoria', nom: 'SAVIGNY', qualifications: ['EQ1_FPT', 'EQ2_FPT', 'EQ1_FDF1', 'EQ2_FDF1', 'EQ'], grade: 'SAP' },
    { id: 'tinseau', prenom: 'Clément', nom: 'TINSEAU', qualifications: ['EQ1_FPT', 'EQ2_FPT', 'EQ1_FDF1', 'EQ2_FDF1', 'EQ'], grade: 'SAP' },
    { id: 'boulet', prenom: 'Aurélie', nom: 'BOULET', qualifications: ['COD0', 'EQ1_FPT', 'EQ2_FPT', 'EQ'], grade: 'SAP' },
    { id: 'marlin', prenom: 'Lilian', nom: 'MARLIN', qualifications: ['EQ1_FPT', 'EQ2_FPT', 'EQ'], grade: 'SAP' },
    { id: 'charenton', prenom: 'Marilou', nom: 'CHARENTON', qualifications: ['COD0', 'EQ1_FPT', 'EQ2_FPT', 'EQ'], grade: 'SAP' },
    { id: 'hérédia', prenom: 'Jules', nom: 'HEREDIA', qualifications: ['EQ'], grade: 'SAP' },
    { id: 'none', prenom: 'Non', nom: 'assigné', qualifications: [], grade: 'none' } // Option pour un emplacement vide
];

// Définition des rôles possibles pour chaque type d'engin
const engineRoles = {
    'FPT': ['CA_FPT', 'COD1', 'EQ1_FPT', 'EQ2_FPT'],
    'CCF': ['CA_FDF2', 'COD2', 'EQ1_FDF1', 'EQ2_FDF1'],
    'VSAV': ['CA_VSAV', 'COD0', 'EQ'],
    'VTU': ['CA_VTU', 'COD0', 'EQ'],
    'VPMA': ['CA_VPMA', 'COD0', 'EQ'],
};

// Construit une structure d'affectation d'engin vide basée sur ses rôles définis
function createEmptyEngineAssignment(engineType) {
    const personnel = {};
    const roles = engineRoles[engineType] || [];
    roles.forEach(role => {
        personnel[role] = 'none'; // 'none' représente non assigné
    });
    return { personnel: personnel };
}

// --- Éléments de la modale ---
let personnelAssignmentModal;
let currentEditingEngineContext = null; // Stocke { dateKey, slotId, engineType } pour l'engin en cours d'édition

// Crée et initialise la modale d'affectation du personnel
function createPersonnelAssignmentModal() {
    personnelAssignmentModal = document.createElement('div');
    personnelAssignmentModal.classList.add('personnel-assignment-modal', 'fixed', 'inset-0', 'bg-gray-600', 'bg-opacity-50', 'flex', 'items-center', 'justify-center', 'z-50', 'hidden');
    personnelAssignmentModal.innerHTML = `
        <div class="modal-content bg-white p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
            <span class="close-button absolute top-2 right-3 text-gray-500 hover:text-gray-800 text-2xl cursor-pointer">&times;</span>
            <div class="personnel-modal-header border-b pb-3 mb-4">
                <h3 id="modal-engine-name" class="text-xl font-semibold text-gray-800">Assigner le personnel à l'engin</h3>
            </div>
            <div class="personnel-modal-body grid grid-cols-1 gap-4 mb-4">
                </div>
            <div class="modal-actions flex justify-end space-x-3 pt-4 border-t">
                <button class="save-personnel-btn bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition duration-200 ease-in-out shadow-md">Enregistrer</button>
                <button class="cancel-personnel-btn bg-gray-300 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-400 transition duration-200 ease-in-out shadow-md">Annuler</button>
            </div>
        </div>
    `;
    document.body.appendChild(personnelAssignmentModal);

    // Gestionnaire de clic pour le bouton de fermeture de la modale
    personnelAssignmentModal.querySelector('.close-button').addEventListener('click', () => {
        personnelAssignmentModal.style.display = 'none';
    });

    // Gestionnaire de clic pour le bouton Annuler de la modale
    personnelAssignmentModal.querySelector('.cancel-personnel-btn').addEventListener('click', () => {
        personnelAssignmentModal.style.display = 'none';
    });

    // Gestionnaire de clic pour le bouton Enregistrer de la modale
    personnelAssignmentModal.querySelector('.save-personnel-btn').addEventListener('click', savePersonnelAssignments);

    // Ferme la modale si l'utilisateur clique en dehors de son contenu
    personnelAssignmentModal.addEventListener('click', (e) => {
        if (e.target === personnelAssignmentModal) {
            personnelAssignmentModal.style.display = 'none';
        }
    });
}

// --- Fonctions de persistance des données (vers l'API et non localStorage direct) ---
// Ces fonctions interagissent avec le backend pour charger/sauvegarder les données.

// appData contiendra toutes nos données de feuille de garde, indexées par date (AAAA-MM-JJ).
// Chaque date aura ses propres créneaux horaires, les agents d'astreinte, et les affectations aux engins.
// personnelAvailabilities contiendra les disponibilités réelles chargées depuis l'API.
let appData = {
    personnelAvailabilities: {} // Cette partie sera remplie par l'API
};


// Charge les données de l'application depuis l'API (feuille de garde, agents d'astreinte, disponibilités)
async function loadInitialData() {
    showLoading(true);
    console.log("Starting loadInitialData...");
    const dateKey = formatDateToYYYYMMDD(currentRosterDate);
    try {
        console.log("1. Fetching all agents...");
        await fetchAllAgents(); // Charge tous les agents

        console.log("2. Loading roster config for date:", dateKey);
        // Tente de charger la config, si 404, ça ne lève pas d'erreur, ça initialise appData[dateKey] vide
        await loadRosterConfig(dateKey); 

        // Si la config n'a pas été trouvée (404), elle est initialisée vide dans loadRosterConfig
        // On initialise les créneaux par défaut ici SI appData[dateKey] n'a pas de créneaux
        if (!appData[dateKey] || Object.keys(appData[dateKey].timeSlots || {}).length === 0) {
            console.log("No existing time slots found for", dateKey, ". Initializing default slots.");
            initializeDefaultTimeSlotsForDate(dateKey);
        } else {
             console.log("Existing time slots found for", dateKey, ":", appData[dateKey].timeSlots);
        }

        console.log("3. Loading daily roster for date:", dateKey);
        await loadDailyRoster(dateKey); // Charge les affectations aux engins pour la date

        console.log("4. Loading all personnel availabilities...");
        await loadAllPersonnelAvailabilities(); // Charge les plannings de tous les agents pour le filtrage
        
        console.log("5. Rendering UI elements...");
        renderTimeSlotButtons(dateKey); // Rend les boutons de créneaux
        renderOnDutyAgentsGrid(); // Affiche les agents d'astreinte
        renderAvailablePersonnel(); // Affiche le personnel disponible (filtré)
        renderRosterGrid(); // Affiche la grille principale
        
        console.log("loadInitialData finished successfully.");

    } catch (error) {
        console.error("Erreur lors du chargement initial des données :", error);
        showAlertModal("Erreur lors du chargement initial des données. Veuillez recharger la page et vérifier les logs du serveur.");
    } finally {
        showLoading(false);
    }
}

async function fetchAllAgents() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/agents`, {
            headers: { 'X-User-Role': 'admin' } // Accès admin nécessaire pour la liste complète
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || "Erreur lors du chargement des agents.");
        }
        allAgents = data;
        console.log("Tous les agents chargés :", allAgents);
    } catch (error) {
        console.error("Erreur fetchAllAgents :", error);
        allAgents = []; // Assurez-vous que allAgents est vide en cas d'erreur
        // Pas d'alerte ici car l'erreur est gérée globalement par loadInitialData
        throw error; // Propager l'erreur pour que loadInitialData puisse la capturer
    }
}

// Charger la configuration de la feuille (créneaux et agents d'astreinte)
async function loadRosterConfig(dateKey) {
    // Validation ajoutée pour la robustesse
    if (!dateKey || typeof dateKey !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
        console.error(`Invalid dateKey provided to loadRosterConfig: ${dateKey}`);
        showAlertModal("Erreur: Date invalide pour le chargement de la configuration.");
        throw new Error("Invalid DateKey"); // Propager l'erreur
    }

    try {
        const url = `${API_BASE_URL}/api/roster-config/${dateKey}`;
        console.log(`Fetching roster config from: ${url}`); // Journalise l'URL pour le débogage
        const response = await fetch(url);
        const data = await response.json();
        if (!response.ok) {
            if (response.status === 404) {
                console.warn(`Aucune configuration de feuille de garde trouvée pour le ${dateKey}.`);
                appData[dateKey] = { timeSlots: {}, onDutyAgents: Array(10).fill('none') };
            } else {
                throw new Error(data.message || `Erreur lors du chargement de la configuration pour ${dateKey}.`);
            }
        } else {
            appData[dateKey] = {
                timeSlots: data.timeSlots || {},
                onDutyAgents: data.onDutyAgents || Array(10).fill('none')
            };
        }
        console.log(`Configuration de la feuille de garde chargée pour ${dateKey} :`, appData[dateKey]);
    } catch (error) {
        console.error("Erreur loadRosterConfig :", error);
        // Ne pas alerter ici, car c'est une erreur de "pas trouvé", ce qui est géré.
        // Propager l'erreur pour que loadInitialData puisse la capturer
        throw error;
    }
}

// Sauvegarder la configuration de la feuille (créneaux et agents d'astreinte)
async function saveRosterConfig(dateKey) {
    if (!dateKey || typeof dateKey !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
        console.error(`Invalid dateKey provided to saveRosterConfig: ${dateKey}`);
        showAlertModal("Erreur: Date invalide pour la sauvegarde de la configuration.");
        return;
    }
    // Assurez-vous que les données pour la dateKey existent avant de sauvegarder
    if (!appData[dateKey]) {
        console.warn(`No appData[${dateKey}] to save. Skipping saveRosterConfig.`);
        return;
    }

    try {
        const configToSave = {
            timeSlots: appData[dateKey].timeSlots,
            onDutyAgents: appData[dateKey].onDutyAgents
        };
        console.log(`Saving roster config for ${dateKey}:`, configToSave);
        const response = await fetch(`${API_BASE_URL}/api/roster-config/${dateKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-Role': 'admin'
            },
            body: JSON.stringify(configToSave)
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || "Erreur lors de la sauvegarde de la configuration de la feuille de garde.");
        }
        console.log("Configuration de la feuille de garde sauvegardée :", data.message);
    } catch (error) {
        console.error("Erreur saveRosterConfig :", error);
        showAlertModal(`Erreur lors de la sauvegarde de la configuration : ${error.message}`);
    }
}

// Charger la feuille de garde complète (agents affectés aux postes) pour une date donnée
async function loadDailyRoster(dateKey) {
    // Validation ajoutée pour la robustesse
    if (!dateKey || typeof dateKey !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
        console.error(`Invalid dateKey provided to loadDailyRoster: ${dateKey}`);
        showAlertModal("Erreur: Date invalide pour le chargement de la feuille de garde d'affectation.");
        throw new Error("Invalid DateKey"); // Propager l'erreur
    }

    try {
        const url = `${API_BASE_URL}/api/daily-roster/${dateKey}`;
        console.log(`Fetching daily roster from: ${url}`); // Journalise l'URL pour le débogage
        const response = await fetch(url);
        const data = await response.json();
        if (!response.ok) {
            if (response.status === 404) {
                console.warn(`Aucune feuille de garde d'affectation trouvée pour le ${dateKey}.`);
                // Initialise les affectations si non trouvées
                if (appData[dateKey] && appData[dateKey].timeSlots) {
                     for (const slotId in appData[dateKey].timeSlots) {
                        for (const engineType in appData[dateKey].timeSlots[slotId].engines) {
                            appData[dateKey].timeSlots[slotId].engines[engineType] = createEmptyEngineAssignment(engineType);
                        }
                    }
                }
            } else {
                throw new Error(data.message || `Erreur lors du chargement de la feuille de garde pour ${dateKey}.`);
            }
        } else {
            // Assurez-vous d'intégrer les affectations chargées dans appData[dateKey].timeSlots[slotId].engines
            if (appData[dateKey] && appData[dateKey].timeSlots) {
                for (const slotId in data.roster) {
                    if (appData[dateKey].timeSlots[slotId]) {
                        // S'assurer que la structure engines existe avant d'assigner
                        appData[dateKey].timeSlots[slotId].engines = data.roster[slotId].engines || {};
                    } else {
                        // Si un créneau existe dans les données du serveur mais pas dans la config locale,
                        // il doit être ajouté pour éviter la perte de données lors de la sauvegarde.
                        // Cependant, cela peut indiquer une désynchronisation des données, il faudrait un mécanisme de fusion plus robuste.
                        // Pour l'instant, on se contente de l'ajouter si la config n'existe pas.
                        appData[dateKey].timeSlots[slotId] = {
                            range: data.roster[slotId].range || '00:00 - 00:00', // Tenter de récupérer la plage si disponible
                            engines: data.roster[slotId].engines || {}
                        };
                        console.warn(`Roster data for slot ${slotId} found on server but not in local config. Adding to local config.`);
                    }
                }
            } else if (appData[dateKey]) { // Si appData[dateKey] existe mais pas timeSlots (cela ne devrait pas arriver après loadRosterConfig)
                 appData[dateKey].timeSlots = {};
                 for (const slotId in data.roster) {
                     appData[dateKey].timeSlots[slotId] = {
                         range: data.roster[slotId].range || '00:00 - 00:00',
                         engines: data.roster[slotId].engines || {}
                     };
                 }
                 console.warn("appData[dateKey].timeSlots was not initialized before loading daily roster.");
            }
        }
        console.log(`Feuille de garde d'affectation chargée pour ${dateKey} :`, appData[dateKey]);
    } catch (error) {
        console.error("Erreur loadDailyRoster :", error);
        showAlertModal(`Erreur lors du chargement de la feuille de garde d'affectation : ${error.message || error}`);
        // En cas d'erreur, assurez-vous que les engins sont initialisés vides
        if (appData[dateKey] && appData[dateKey].timeSlots) {
            for (const slotId in appData[dateKey].timeSlots) {
                for (const engineType in appData[dateKey].timeSlots[slotId].engines) {
                    appData[dateKey].timeSlots[slotId].engines[engineType] = createEmptyEngineAssignment(engineType);
                }
            }
        }
        throw error; // Propager l'erreur
    }
}

// Sauvegarder la feuille de garde complète
async function saveDailyRoster(dateKey) {
    if (!dateKey || typeof dateKey !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
        console.error(`Invalid dateKey provided to saveDailyRoster: ${dateKey}`);
        showAlertModal("Erreur: Date invalide pour la sauvegarde de la feuille de garde.");
        return;
    }
    // Assurez-vous que les données pour la dateKey existent avant de sauvegarder
    if (!appData[dateKey]) {
        console.warn(`No appData[${dateKey}] to save. Skipping saveDailyRoster.`);
        return;
    }

    try {
        // Préparer les données d'affectation des engins à sauvegarder
        const rosterToSave = {};
        if (appData[dateKey] && appData[dateKey].timeSlots) {
            for (const slotId in appData[dateKey].timeSlots) {
                rosterToSave[slotId] = { engines: appData[dateKey].timeSlots[slotId].engines };
            }
        }
        console.log(`Saving daily roster for ${dateKey}:`, rosterToSave);
        const response = await fetch(`${API_BASE_URL}/api/daily-roster/${dateKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-Role': 'admin'
            },
            body: JSON.stringify({ roster: rosterToSave })
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || "Erreur lors de la sauvegarde de la feuille de garde.");
        }
        console.log("Feuille de garde sauvegardée :", data.message);
        showAlertModal("Feuille de garde enregistrée avec succès !");
    } catch (error) {
        console.error("Erreur saveDailyRoster :", error);
        showAlertModal(`Erreur lors de la sauvegarde de la feuille de garde : ${error.message}`);
    }
}


// Fonction pour récupérer les disponibilités de tous les agents depuis l'API
async function loadAllPersonnelAvailabilities() {
    console.log("Tentative de chargement des disponibilités de tous les agents depuis l'API...");
    try {
        const agentsResponse = await fetch(`${API_BASE_URL}/api/admin/agents`, { headers: { 'X-User-Role': 'admin' } });
        if (!agentsResponse.ok) {
            throw new Error(data.message || `Impossible de récupérer la liste des agents (${agentsResponse.status}).`);
        }
        const fetchedAgents = await agentsResponse.json();
        const agentsToFetchPlanning = fetchedAgents.map(agent => agent.id);

        const allAvailabilities = {};

        for (const agentId of agentsToFetchPlanning) {
            try {
                const response = await fetch(`${API_BASE_URL}/api/planning/${agentId}`);
                if (!response.ok) {
                    if (response.status === 404) {
                        console.log(`Planning non trouvé pour l'agent ${agentId}.`);
                        continue;
                    }
                    throw new Error(`Erreur HTTP ${response.status} pour l'agent ${agentId}`);
                }
                const agentPlanning = await response.json();

                for (const weekKey in agentPlanning) {
                    const weekNumber = parseInt(weekKey.replace('week-', ''));
                    // Utilise l'année de la date actuelle pour la cohérence
                    const year = currentRosterDate.getFullYear();

                    for (const dayOfWeek in agentPlanning[weekKey]) {
                        const date = getDateFromWeekAndDay(year, weekNumber, dayOfWeek);
                        if (!date) continue;

                        const dateKey = formatDateToYYYYMMDD(date);
                        const rawSlots = agentPlanning[weekKey][dayOfWeek];

                        if (!allAvailabilities[agentId]) {
                            allAvailabilities[agentId] = {};
                        }
                        if (!allAvailabilities[agentId][dateKey]) {
                            allAvailabilities[agentId][dateKey] = [];
                        }

                        rawSlots.forEach(slotRange => {
                            const [start, end] = slotRange.split(' - ').map(s => s.trim());
                            allAvailabilities[agentId][dateKey].push({ start, end });
                        });
                    }
                }
            } catch (err) {
                console.error(`Erreur lors du chargement du planning de l'agent ${agentId} :`, err);
            }
        }
        appData.personnelAvailabilities = allAvailabilities;
        console.log("Toutes les disponibilités du personnel chargées et transformées :", appData.personnelAvailabilities);
        // Une fois toutes les disponibilités chargées, rafraîchir le personnel disponible
        renderAvailablePersonnel();

    } catch (err) {
        console.error("Erreur générale lors du chargement des disponibilités de tous les agents :", err);
        throw err; // Propager l'erreur pour que loadInitialData puisse la capturer
    }
}


// --- Fonctions utilitaires ---

// Formate une date au format AAAA-MM-JJ
function formatDateToYYYYMMDD(date) {
    if (!(date instanceof Date) || isNaN(date)) {
        console.error("Invalid Date object passed to formatDateToYYYYMMDD:", date);
        return "InvalidDate"; // Retourne une chaîne invalide pour faciliter le débogage
    }
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0'); // Les mois sont indexés de 0
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Parser une chaîne de temps "HH:MM" en minutes depuis minuit
function parseTimeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}

// Formate les minutes depuis minuit en chaîne "HH:MM"
function formatMinutesToTime(minutes) {
    const hours = Math.floor(minutes / 60) % 24; // % 24 pour gérer les heures > 24 (ex: 25h -> 1h)
    const mins = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

// Met à jour l'affichage de la date et re-rend les éléments associés
async function updateDateDisplay() {
    showLoading(true);
    const dateKey = formatDateToYYYYMMDD(currentRosterDate);
    rosterDateInput.value = dateKey; // Met à jour l'input date

    console.log("Updating display for date:", dateKey);
    // Recharger la configuration et la feuille de garde pour la nouvelle date
    try {
        await loadRosterConfig(dateKey);
        // Assurez-vous que les créneaux par défaut sont là si la config était vide
        if (!appData[dateKey] || Object.keys(appData[dateKey].timeSlots || {}).length === 0) {
            console.log("No slots after loading config for", dateKey, ". Initializing default.");
            initializeDefaultTimeSlotsForDate(dateKey);
        }
        await loadDailyRoster(dateKey);
        await loadAllPersonnelAvailabilities(); // Recharger les dispo car la date a changé

        renderTimeSlotButtons(dateKey);
        renderOnDutyAgentsGrid();
        renderAvailablePersonnel(); // Le filtrage sera fait ici
        showMainRosterGrid(); // Toujours revenir à la grille principale lors du changement de date
        console.log('Date display updated successfully for:', dateKey);
    } catch (error) {
        console.error("Error in updateDateDisplay:", error);
        showAlertModal(`Erreur lors de la mise à jour de l'affichage de la date : ${error.message || error}. Vérifiez les logs.`);
    } finally {
        showLoading(false);
    }
}

// Rend les boutons de créneaux horaires pour la date actuelle
function renderTimeSlotButtons(dateKey) {
    const timeSlotButtonsContainer = document.getElementById('time-slot-buttons-container');
    timeSlotButtonsContainer.innerHTML = ''; // Vide le conteneur existant (sauf le bouton d'ajout qui est réinséré)

    const addTimeSlotBtn = document.createElement('button'); // Recrée le bouton '+'
    addTimeSlotBtn.id = 'add-time-slot-btn';
    addTimeSlotBtn.classList.add('px-4', 'py-2', 'rounded-full', 'bg-green-500', 'text-white', 'hover:bg-green-600', 'transition-colors', 'duration-200', 'ease-in-out', 'text-2xl', 'font-bold', 'shadow-md');
    addTimeSlotBtn.textContent = '+';
    addTimeSlotBtn.title = 'Ajouter un nouveau créneau horaire';
    addTimeSlotBtn.addEventListener('click', () => {
        showTimeRangePromptModal('07:00', '07:00', (newStart, newEnd) => {
            if (newStart && newEnd) {
                const newSlotId = `slot_${newStart.replace(':', '')}_${newEnd.replace(':', '')}_${Date.now()}`;
                const newTimeRange = `${newStart} - ${newEnd}`;
                createTimeSlotButton(newSlotId, newTimeRange, true);
                displayEnginesForSlot(dateKey, newSlotId); // Affiche directement la page des engins pour ce nouveau créneau
                renderAvailablePersonnel(); // Important : les créneaux affectent les disponibilités
            }
        });
    });
    timeSlotButtonsContainer.appendChild(addTimeSlotBtn);


    const currentSlots = appData[dateKey]?.timeSlots || {};
    const sortedSlotIds = Object.keys(currentSlots).sort((a, b) => {
        const timeA = parseTimeToMinutes(currentSlots[a].range.split(' - ')[0]);
        const timeB = parseTimeToMinutes(currentSlots[b].range.split(' - ')[0]);
        return timeA - timeB;
    });

    sortedSlotIds.forEach(slotId => {
        const slot = currentSlots[slotId];
        // Insère le nouveau bouton avant le bouton '+'
        createTimeSlotButton(slotId, slot.range, false, true); // Le 4ème paramètre indique qu'on l'insère, pas qu'on le crée
    });
}

// Crée un bouton de créneau horaire avec la capacité de suppression
function createTimeSlotButton(slotId, initialTimeRange = '00:00 - 00:00', isActive = false, prepend = false) {
    const dateKey = formatDateToYYYYMMDD(currentRosterDate);
    const timeSlotButtonsContainer = document.getElementById('time-slot-buttons-container');


    // Si le créneau existe déjà, ne le crée pas de nouveau dans le DOM, juste le mettre à jour si c'est 'active'
    const existingButton = timeSlotButtonsContainer.querySelector(`[data-slot-id="${slotId}"]`);
    if (existingButton) {
        existingButton.textContent = initialTimeRange; // Met à jour le texte
        // Conserver ou recréer le bouton de suppression si nécessaire
        let deleteBtn = existingButton.querySelector('.delete-time-slot-btn');
        if (!deleteBtn) {
            deleteBtn = document.createElement('span');
            deleteBtn.classList.add('delete-time-slot-btn', 'ml-2', 'text-red-500', 'hover:text-red-700', 'font-bold', 'cursor-pointer', 'text-lg');
            deleteBtn.innerHTML = '&times;';
            deleteBtn.title = 'Supprimer le créneau';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                showConfirmationModal(`Êtes-vous sûr de vouloir supprimer le créneau "${existingButton.textContent.replace('×', '').trim()}" ?`, () => {
                    deleteTimeSlot(slotId, existingButton);
                });
            });
            existingButton.appendChild(deleteBtn);
        }
        // Gérer la classe active
        document.querySelectorAll('.time-slot-button').forEach(btn => btn.classList.remove('active', 'bg-blue-500', 'text-white', 'border-blue-500'));
        if (isActive) {
            existingButton.classList.add('active', 'bg-blue-500', 'text-white', 'border-blue-500');
        } else {
            existingButton.classList.remove('active', 'bg-blue-500', 'text-white', 'border-blue-500');
            existingButton.classList.add('text-gray-700', 'bg-white', 'hover:bg-gray-100', 'border-gray-300');
        }
        // Met à jour la structure de données
        if (appData[dateKey] && appData[dateKey].timeSlots[slotId]) {
            appData[dateKey].timeSlots[slotId].range = initialTimeRange;
        }
        // Pas besoin de sauvegarder ici si c'est juste un rafraîchissement DOM.
        // La sauvegarde est faite après la modification réelle de la plage (double-clic)
        return;
    }

    const button = document.createElement('button');
    button.classList.add('time-slot-button', 'px-4', 'py-2', 'rounded-md', 'border', 'border-gray-300', 'bg-white', 'hover:bg-gray-100', 'flex', 'items-center', 'justify-between', 'space-x-2', 'shadow-sm', 'transition-all', 'duration-200', 'ease-in-out');
    if (isActive) {
        button.classList.add('active', 'bg-blue-500', 'text-white', 'border-blue-500', 'hover:bg-blue-600');
    } else {
        button.classList.add('text-gray-700');
    }
    button.dataset.slotId = slotId;
    button.textContent = initialTimeRange;

    // Bouton de suppression
    const deleteBtn = document.createElement('span');
    deleteBtn.classList.add('delete-time-slot-btn', 'ml-2', 'text-red-500', 'hover:text-red-700', 'font-bold', 'cursor-pointer', 'text-lg');
    deleteBtn.innerHTML = '&times;'; // Caractère 'x'
    deleteBtn.title = 'Supprimer le créneau';
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Empêche le clic du bouton de créneau horaire lors de la suppression
        showConfirmationModal(`Êtes-vous sûr de vouloir supprimer le créneau "${button.textContent.replace('×', '').trim()}" ?`, () => {
            deleteTimeSlot(slotId, button);
        });
    });
    button.appendChild(deleteBtn);

    // Gestionnaire de clic pour afficher la page des engins
    button.addEventListener('click', () => {
        // Supprime la classe active de tous les boutons
        document.querySelectorAll('.time-slot-button').forEach(btn => btn.classList.remove('active', 'bg-blue-500', 'text-white', 'border-blue-500'));
        // Ajoute la classe active au bouton cliqué
        button.classList.add('active', 'bg-blue-500', 'text-white', 'border-blue-500');

        displayEnginesForSlot(dateKey, slotId);
    });

    // Double-clic pour modifier la plage horaire (utilise la nouvelle modale)
    button.addEventListener('dblclick', () => {
        const currentRange = button.textContent.replace('×', '').trim();
        const [currentStart, currentEnd] = currentRange.split(' - ');

        showTimeRangePromptModal(currentStart, currentEnd, (newStart, newEnd) => {
            if (newStart && newEnd) { // Si l'utilisateur n'a pas annulé
                const newTimeRange = `${newStart} - ${newEnd}`;

                let newStartMinutes = parseTimeToMinutes(newStart);
                let actualNewEndMinutes = parseTimeToMinutes(newEnd);

                // Ajuster pour les créneaux qui traversent minuit
                if (actualNewEndMinutes <= newStartMinutes) {
                     actualNewEndMinutes += 24 * 60;
                }

                // Mettre à jour le créneau actuel
                if (appData[dateKey] && appData[dateKey].timeSlots[slotId]) {
                    appData[dateKey].timeSlots[slotId].range = newTimeRange;
                }

                // Calcul de l'heure de fin théorique de la journée (07:00 le lendemain)
                const endOfDayRefMinutes = parseTimeToMinutes('07:00') + (24 * 60);

                // Condition pour créer le créneau suivant :
                // Si la nouvelle heure de fin du créneau actuel n'atteint pas l'heure de fin de la journée (07:00 le lendemain)
                // ET si la nouvelle heure de fin est après l'heure de début du créneau actuel.
                if (actualNewEndMinutes < endOfDayRefMinutes && actualNewEndMinutes > newStartMinutes) {
                    const nextSlotStartMinutes = parseTimeToMinutes(newEnd);
                    const rawNextSlotEndTimeMinutes = parseTimeToMinutes('07:00'); 

                    const nextSlotStartTime = formatMinutesToTime(nextSlotStartMinutes);
                    const formattedNextSlotEndTime = formatMinutesToTime(rawNextSlotEndTimeMinutes);

                    const nextSlotRange = `${nextSlotStartTime} - ${formattedNextSlotEndTime}`; 
                    const nextSlotId = `slot_${nextSlotStartTime.replace(':', '')}_${formattedNextSlotEndTime.replace(':', '')}_${Date.now()}`;

                    let existingNextSlotFound = false;
                    for (const existingId in appData[dateKey].timeSlots) {
                        if (appData[dateKey].timeSlots[existingId].range === nextSlotRange) {
                            existingNextSlotFound = true;
                            break;
                        }
                    }

                    if (!existingNextSlotFound) {
                        const existingSlotStartingAtNewEnd = Object.keys(appData[dateKey].timeSlots).find(id =>
                            appData[dateKey].timeSlots[id].range.split(' - ')[0] === nextSlotStartTime
                        );

                        if (existingSlotStartingAtNewEnd) {
                            appData[dateKey].timeSlots[existingSlotStartingAtNewEnd].range = nextSlotRange;
                        } else {
                            appData[dateKey].timeSlots[nextSlotId] = {
                                range: nextSlotRange,
                                engines: {}
                            };
                            ['FPT', 'CCF', 'VSAV', 'VTU', 'VPMA'].forEach(engineType => {
                                appData[dateKey].timeSlots[nextSlotId].engines[engineType] = createEmptyEngineAssignment(engineType);
                            });
                        }
                    }
                }
                saveRosterConfig(dateKey); // Sauvegarde les créneaux mis à jour
                renderTimeSlotButtons(dateKey); // Rafraîchit tous les boutons pour inclure le nouveau/modifié et trier
                renderAvailablePersonnel(); // Important : les créneaux affectent les disponibilités
            }
        });
    });

    if (prepend) { // Si on veut l'ajouter avant le bouton '+'
         const addBtn = timeSlotButtonsContainer.querySelector('#add-time-slot-btn');
         if (addBtn) {
             timeSlotButtonsContainer.insertBefore(button, addBtn);
         } else {
             timeSlotButtonsContainer.appendChild(button); // Fallback si le bouton '+' n'est pas trouvé
         }
    } else {
        timeSlotButtonsContainer.appendChild(button);
    }


    // Ajoute à notre structure de données interne pour la date actuelle si c'est un nouveau créneau
    const dateKeyForSave = formatDateToYYYYMMDD(currentRosterDate);
    if (!appData[dateKeyForSave] || !appData[dateKeyForSave].timeSlots) {
        appData[dateKeyForSave] = { timeSlots: {}, onDutyAgents: Array(10).fill('none') };
    }
    if (!appData[dateKeyForSave].timeSlots[slotId]) {
        appData[dateKeyForSave].timeSlots[slotId] = {
            range: initialTimeRange,
            engines: {} // Commence sans aucun engin assigné
        };
        // Initialise la structure des engins par default pour ce nouveau créneau
        ['FPT', 'CCF', 'VSAV', 'VTU', 'VPMA'].forEach(engineType => {
            appData[dateKeyForSave].timeSlots[slotId].engines[engineType] = createEmptyEngineAssignment(engineType);
        });
        saveRosterConfig(dateKeyForSave); // Sauvegarde la création initiale
    }
}

// Fonction pour supprimer un créneau horaire
function deleteTimeSlot(slotId, buttonElement) {
    const dateKey = formatDateToYYYYMMDD(currentRosterDate);
    if (appData[dateKey] && appData[dateKey].timeSlots[slotId]) {
        // Supprime du DOM
        buttonElement.remove();
        // Supprime de notre structure de données
        delete appData[dateKey].timeSlots[slotId];
        saveRosterConfig(dateKey); // Sauvegarde les modifications
        // Si le créneau supprimé était celui actif, revient à la vue de la grille principale
        if (engineDetailsPage.style.display === 'block' && currentEditingEngineContext && currentEditingEngineContext.slotId === slotId) {
            showMainRosterGrid();
        }
        // Après suppression, il faut rafraîchir la liste du personnel disponible
        // car les créneaux affichés ont changé, ce qui peut affecter les disponibilités.
        renderAvailablePersonnel();
        console.log(`Le créneau horaire ${slotId} a été supprimé pour la date ${dateKey}.`);
    }
}

// Initialise les créneaux horaires par défaut pour une date donnée
function initializeDefaultTimeSlotsForDate(dateKey) {
    if (!appData[dateKey]) {
        appData[dateKey] = { timeSlots: {}, onDutyAgents: Array(10).fill('none') };
    }
    // Initialise avec les créneaux de base 07:00 - 14:00, 14:00 - 17:00, 17:00 - 07:00
    if (Object.keys(appData[dateKey].timeSlots).length === 0) {
        console.log(`Initialisation des créneaux par défaut pour la date ${dateKey}.`);
        const defaultSlots = [
            { id: `slot_0700_1400_${Date.now()}`, range: '07:00 - 14:00' },
            { id: `slot_1400_1700_${Date.now()+1}`, range: '14:00 - 17:00' },
            { id: `slot_1700_0700_${Date.now()+2}`, range: '17:00 - 07:00' } // Créneau qui traverse minuit
        ];

        defaultSlots.forEach(slot => {
            appData[dateKey].timeSlots[slot.id] = {
                range: slot.range,
                engines: {}
            };
            ['FPT', 'CCF', 'VSAV', 'VTU', 'VPMA'].forEach(engineType => {
                appData[dateKey].timeSlots[slot.id].engines[engineType] = createEmptyEngineAssignment(engineType);
            });
        });
        saveRosterConfig(dateKey); // Sauvegarde les créneaux par défaut
    }
}

// Fonction pour afficher les engins spécifiques et leur personnel affecté pour un créneau horaire sélectionné
function displayEnginesForSlot(dateKey, slotId) {
    rosterGridContainer.style.display = 'none'; // Cache la grille principale
    // Garde la section de gestion du personnel et des agents d'astreinte visible
    document.querySelector('.personnel-management-section').style.display = 'grid'; // Utilisez grid pour son affichage par défaut
    engineDetailsPage.style.display = 'block'; // Affiche la page des détails de l'engin
    engineDetailsPage.querySelector('.engine-grid').innerHTML = ''; // Efface les engins précédents

    const slotData = appData[dateKey]?.timeSlots[slotId];

    if (!slotData) {
        engineDetailsPage.querySelector('.engine-grid').innerHTML = '<p class="text-gray-600">Aucune donnée pour ce créneau horaire. Veuillez l\'ajouter ou changer de date.</p>';
        return;
    }

    // Affiche les 5 types d'engins prédéfinis.
    ['FPT', 'CCF', 'VSAV', 'VTU', 'VPMA'].forEach(engineType => {
        const engineName = engineType;
        let engineDetails = slotData.engines[engineType];

        if (!engineDetails) {
            engineDetails = createEmptyEngineAssignment(engineType);
            slotData.engines[engineType] = engineDetails;
        }

        const engineCase = document.createElement('div');
        engineCase.classList.add('engine-case', 'bg-white', 'p-4', 'rounded-lg', 'shadow-md', 'border', 'border-gray-200', 'hover:shadow-lg', 'transition-shadow', 'duration-200', 'ease-in-out', 'cursor-pointer');
        engineCase.dataset.engineType = engineType;
        engineCase.dataset.slotId = slotId;
        engineCase.dataset.dateKey = dateKey;

        let personnelListHTML = '';
        const roles = engineRoles[engineType] || [];
        roles.forEach(role => {
            const personnelId = engineDetails.personnel[role];
            const personnel = allAgents.find(p => p.id === personnelId); // Utilise allAgents
            const personnelName = personnel ? `${personnel.prenom} ${personnel.nom}` : 'Non assigné'; // Utilisez prénom nom
            personnelListHTML += `<li class="text-gray-700 text-sm">${role}: <span class="font-medium">${personnelName}</span></li>`;
        });

        engineCase.innerHTML = `
            <h3 class="text-lg font-semibold text-gray-800 mb-2">${engineName} <span class="places-count bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded-full ml-2">${roles.length} places</span></h3>
            <ul class="personnel-list space-y-1">${personnelListHTML}</ul>
        `;

        engineCase.addEventListener('click', () => {
            openPersonnelAssignmentModal(dateKey, slotId, engineType);
        });
        engineDetailsPage.querySelector('.engine-grid').appendChild(engineCase);
    });
}

// --- Fonctions de la modale d'affectation du personnel ---

// Ouvre la modale d'affectation du personnel
function openPersonnelAssignmentModal(dateKey, slotId, engineType) {
    personnelAssignmentModal.style.display = 'flex'; // Utilise flexbox pour centrer
    currentEditingEngineContext = { dateKey, slotId, engineType }; // Stocke le contexte

    const modalEngineName = document.getElementById('modal-engine-name');
    const personnelModalBody = personnelAssignmentModal.querySelector('.personnel-modal-body');

    modalEngineName.textContent = `Assigner le personnel à ${engineType}`;
    personnelModalBody.innerHTML = ''; // Efface les sélections précédentes

    const slotData = appData[dateKey].timeSlots[slotId];
    const engineCurrentPersonnel = slotData.engines[engineType]?.personnel || {};

    const roles = engineRoles[engineType] || [];

    // Récupère uniquement le personnel qui est dans le tableau "Agents d'astreinte" pour la date actuelle
    const onDutyPersonnel = appData[dateKey].onDutyAgents
        .map(id => allAgents.find(p => p.id === id)) // Utilise allAgents pour les infos complètes
        .filter(p => p !== undefined && p.id !== 'none'); // Filtre les IDs 'none' ou non trouvés

    // Ajout de l'option 'Non assigné' pour la sélection de personnel
    const personnelForModalSelect = [{ id: 'none', prenom: 'Non', nom: 'assigné', qualifications: [], grade: 'none' }].concat(onDutyPersonnel);

    roles.forEach(role => {
        const assignmentDiv = document.createElement('div');
        assignmentDiv.classList.add('post-assignment', 'flex', 'flex-col', 'space-y-1');
        assignmentDiv.innerHTML = `<label for="${role}-${engineType}-select" class="text-sm font-medium text-gray-700">${role}:</label>`;

        const selectElement = document.createElement('select');
        selectElement.id = `${role}-${engineType}-select`;
        selectElement.dataset.role = role;
        selectElement.classList.add('mt-1', 'block', 'w-full', 'pl-3', 'pr-10', 'py-2', 'text-base', 'border-gray-300', 'focus:outline-none', 'focus:ring-blue-500', 'focus:border-blue-500', 'sm:text-sm', 'rounded-md', 'shadow-sm');

        // Remplit le sélecteur avec le personnel d'astreinte éligible pour ce rôle
        personnelForModalSelect.filter(p => p.qualifications.includes(role) || p.id === 'none').forEach(person => {
            const option = document.createElement('option');
            option.value = person.id;
            option.textContent = `${person.prenom} ${person.nom}`; // Utilise prenom et nom
            selectElement.appendChild(option);
        });

        // Définit la sélection actuelle
        const currentAssignedPersonId = engineCurrentPersonnel[role] || 'none';
        selectElement.value = currentAssignedPersonId;

        assignmentDiv.appendChild(selectElement);
        personnelModalBody.appendChild(assignmentDiv);
    });
}

/**
 * Vérifie si un personnel donné est déjà affecté à une autre position DANS LE MÊME ENGIN.
 * @param {string} personnelId - L'ID du personnel à vérifier.
 * @param {Object} currentEngineAssignments - L'objet des affectations actuelles pour l'engin (clé: rôle, valeur: ID du personnel).
 * @param {string} roleBeingAssigned - Le rôle actuellement en cours d'affectation (pour l'exclure de la vérification).
 * @returns {Object|null} Un objet { role, personnelName } si un conflit est trouvé, sinon null.
 */
function isPersonnelAlreadyAssignedInEngine(personnelId, currentEngineAssignments, roleBeingAssigned) {
    if (personnelId === 'none') {
        return null; // 'none' (Non assigné) ne cause jamais de conflit.
    }

    for (const role in currentEngineAssignments) {
        if (role !== roleBeingAssigned && currentEngineAssignments[role] === personnelId) {
            const person = allAgents.find(p => p.id === personnelId); // Utilise allAgents
            return { role: role, personnelName: person ? `${person.prenom} ${person.nom}` : 'Personnel inconnu' };
        }
    }
    return null;
}

// Sauvegarde les affectations de personnel depuis la modale
async function savePersonnelAssignments() {
    if (!currentEditingEngineContext) return;

    const { dateKey, slotId, engineType: editingEngineType } = currentEditingEngineContext;
    const slotData = appData[dateKey].timeSlots[slotId];
    const engineData = slotData.engines[editingEngineType]; // L'engin actuellement en cours d'édition

    // Crée un objet temporaire pour les nouvelles affectations,
    // pour pouvoir vérifier les doublons avant de modifier les données réelles
    const newAssignments = {};
    const selects = personnelAssignmentModal.querySelectorAll('.personnel-modal-body select');
    selects.forEach(select => {
        const role = select.dataset.role;
        const selectedPersonId = select.value;
        newAssignments[role] = selectedPersonId;
    });

    let hasConflict = false;
    let conflictDetails = null;

    // --- Vérification des doublons DANS L'ENGIN ACTUEL (uniquement) ---
    // Cette vérification empêche une personne d'être affectée à deux postes *sur le même engin*.
    for (const roleBeingAssigned in newAssignments) {
        const personnelId = newAssignments[roleBeingAssigned];

        if (personnelId !== 'none') {
            const conflict = isPersonnelAlreadyAssignedInEngine(
                personnelId,
                newAssignments,
                roleBeingAssigned
            );

            if (conflict) {
                hasConflict = true;
                conflictDetails = {
                    personName: conflict.personName,
                    conflictingRole: conflict.conflictingRole
                };
                break;
            }
        }
    }

    if (hasConflict) {
        const conflictPersonName = conflictDetails.personName;
        const conflictingRole = conflictDetails.conflictingRole;

        showAlertModal(`Conflit d'affectation pour l'engin ${editingEngineType} : ${conflictPersonName} est déjà assigné à la position "${conflictingRole}" dans cet engin. Veuillez le désassigner de cette position avant de le placer ailleurs dans le même engin.`);
        return;
    }

    // Si aucune conflit, on applique les nouvelles affectations
    for (const role in newAssignments) {
        engineData.personnel[role] = newAssignments[role];
    }

    // Sauvegarde la feuille de garde journalière
    await saveDailyRoster(dateKey);

    console.log(`Personnel sauvegardé pour ${editingEngineType} dans le créneau ${slotId} le ${dateKey} :`, engineData.personnel);

    personnelAssignmentModal.style.display = 'none';
    displayEnginesForSlot(dateKey, slotId); // Re-render les engins pour le slot
}

// --- Gestion de la vue ---

// Affiche la grille principale de la feuille de garde
function showMainRosterGrid() {
    engineDetailsPage.style.display = 'none';
    // Affiche la section de gestion du personnel et des agents d'astreinte
    document.querySelector('.personnel-management-section').style.display = 'grid'; // Utilisez grid pour son affichage par défaut
    rosterGridContainer.style.display = 'block';
    // Supprime la classe active de tous les boutons de créneau horaire
    document.querySelectorAll('.time-slot-button').forEach(btn => btn.classList.remove('active'));
    renderRosterGrid(); // Affiche la grille principale mise à jour
}

// --- Fonctions des modales personnalisées (remplacement de alert/confirm/prompt) ---
function createModal(id, title, message, type, callback, defaultValue = null) {
    let modal = document.getElementById(id);
    if (!modal) {
        modal = document.createElement('div');
        modal.id = id;
        modal.classList.add('custom-modal', 'fixed', 'inset-0', 'bg-gray-600', 'bg-opacity-50', 'flex', 'items-center', 'justify-center', 'z-50', 'hidden');
        document.body.appendChild(modal);
    }

    let inputHtml = '';
    if (type === 'prompt') {
        inputHtml = `<input type="text" id="prompt-input" class="modal-input mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm">`;
    } else if (type === 'timeRangePrompt') {
        inputHtml = `
            <div class="flex space-x-2 mb-4">
                <div class="flex-1">
                    <label for="start-time-input" class="block text-sm font-medium text-gray-700">Heure de début:</label>
                    <input type="time" id="start-time-input" class="modal-input mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm">
                </div>
                <div class="flex-1">
                    <label for="end-time-input" class="block text-sm font-medium text-gray-700">Heure de fin:</label>
                    <input type="time" id="end-time-input" class="modal-input mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm">
                </div>
            </div>
        `;
    }

    modal.innerHTML = `
        <div class="modal-content bg-white p-6 rounded-lg shadow-xl max-w-sm w-full mx-4 text-center">
            <h3 class="text-xl font-semibold text-gray-800 mb-3">${title}</h3>
            <p class="text-gray-700 mb-4">${message}</p>
            ${inputHtml}
            <div class="modal-actions flex justify-center space-x-3 pt-4">
                ${type === 'confirm' || type === 'prompt' || type === 'timeRangePrompt' ? '<button class="modal-cancel-btn bg-gray-300 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-400 transition duration-200 ease-in-out shadow-md">Annuler</button>' : ''}
                <button class="modal-ok-btn bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition duration-200 ease-in-out shadow-md">OK</button>
            </div>
        </div>
    `;
    modal.style.display = 'flex';

    const okBtn = modal.querySelector('.modal-ok-btn');
    const cancelBtn = modal.querySelector('.modal-cancel-btn');
    const promptInput = modal.querySelector('#prompt-input');
    const startTimeInput = modal.querySelector('#start-time-input');
    const endTimeInput = modal.querySelector('#end-time-input');

    if (promptInput && defaultValue) {
        promptInput.value = defaultValue;
        promptInput.focus();
    } else if (startTimeInput && endTimeInput && defaultValue) { // defaultValue est un array [start, end]
        startTimeInput.value = defaultValue[0];
        endTimeInput.value = defaultValue[1];
        startTimeInput.focus();
    }

    okBtn.onclick = () => {
        modal.style.display = 'none';
        if (callback) {
            if (type === 'prompt') {
                callback(promptInput.value);
            } else if (type === 'timeRangePrompt') {
                // Validation simple pour s'assurer que les champs ne sont pas vides
                if (startTimeInput.value && endTimeInput.value) {
                    callback(startTimeInput.value, endTimeInput.value);
                } else {
                    showAlertModal("Veuillez saisir une heure de début et une heure de fin valides.");
                    // Réafficher la modale pour corriger
                    modal.style.display = 'flex';
                }
            } else {
                callback(true);
            }
        }
    };

    if (cancelBtn) {
        cancelBtn.onclick = () => {
            modal.style.display = 'none';
            if (callback && type === 'confirm') {
                callback(false);
            } else if (callback && (type === 'prompt' || type === 'timeRangePrompt')) {
                callback(null, null); // Return null for both start and end if cancelled
            }
        };
    }
}

function showAlertModal(message) {
    createModal('alert-modal', 'Information', message, 'alert');
}

function showConfirmationModal(message, callback) {
    createModal('confirm-modal', 'Confirmation', message, 'confirm', callback);
}

function showPromptModal(message, defaultValue, callback) {
    createModal('prompt-modal', 'Saisie requise', message, 'prompt', callback, defaultValue);
}

// Nouvelle fonction pour la modale de plage horaire
function showTimeRangePromptModal(currentStart, currentEnd, callback) {
    createModal('time-range-prompt-modal', 'Modifier la plage horaire', 'Saisissez les nouvelles heures de début et de fin:', 'timeRangePrompt', callback, [currentStart, currentEnd]);
}

// --- Fonctions de rendu et de gestion du personnel disponible / agents d'astreinte ---

// Trie le personnel par grade (priorité la plus basse d'abord)
function sortPersonnelByGrade(personnelArray) {
    return [...personnelArray].sort((a, b) => {
        const gradeA = gradePriority[a.grade] || Infinity;
        const gradeB = gradePriority[b.grade] || Infinity;
        return gradeA - gradeB;
    });
}

// Fonction utilitaire pour vérifier si deux plages horaires se chevauchent
// Les plages sont au format { start: "HH:MM", end: "HH:MM" }
function doTimeRangesOverlap(range1, range2) {
    const start1 = parseTimeToMinutes(range1.start);
    let end1 = parseTimeToMinutes(range1.end);
    const start2 = parseTimeToMinutes(range2.start);
    let end2 = parseTimeToMinutes(range2.end);

    // Ajuster les heures de fin si elles sont "le lendemain" (inférieures ou égales à l'heure de début)
    // Par exemple, 18:00 - 07:00 => 07:00 du lendemain
    // Une plage 07:00 - 07:00 signifie 24h, donc la fin est aussi le lendemain
    if (end1 <= start1) {
        end1 += 24 * 60; // Ajouter 24 heures en minutes
    }
    if (end2 <= start2) {
        end2 += 24 * 60;
    }

    // Les plages se chevauchent si (Début1 < Fin2) ET (Fin1 > Début2)
    // Ex: (7h-12h) vs (10h-15h) -> 7 < 15 && 12 > 10 (TRUE)
    // Ex: (7h-12h) vs (12h-18h) -> 7 < 18 && 12 > 12 (FALSE - pas de chevauchement strict, juste un point de contact)
    const overlaps = start1 < end2 && end1 > start2;
    // console.log(`Overlap check: R1(${range1.start}-${range1.end} normalized to ${start1}-${end1}) vs R2(${range2.start}-${range2.end} normalized to ${start2}-${end2}) -> Result: ${overlaps}`);
    return overlaps;
}

// Rend la liste du personnel disponible
function renderAvailablePersonnel() {
    availablePersonnelList.innerHTML = ''; // Vide la liste existante
    const dateKey = formatDateToYYYYMMDD(currentRosterDate);
    const onDutyAgents = appData[dateKey]?.onDutyAgents || []; // Assure que c'est un tableau

    // Récupérer les créneaux horaires définis par l'administrateur pour le jour actuel de la feuille de garde
    const rosterTimeSlots = Object.values(appData[dateKey]?.timeSlots || {}).map(slot => {
        const [start, end] = slot.range.split(' - ');
        return { start, end };
    });

    // Si aucun créneau horaire n'est défini pour le jour, aucun agent n'est "disponible" selon cette logique
    if (rosterTimeSlots.length === 0) {
        const noPersonnelMessage = document.createElement('p');
        noPersonnelMessage.classList.add('text-gray-500', 'text-center', 'py-4', 'px-2', 'text-sm');
        noPersonnelMessage.textContent = "Aucun créneau horaire défini pour ce jour. Aucun agent disponible à afficher.";
        availablePersonnelList.appendChild(noPersonnelMessage);
        console.log(`Aucun créneau horaire pour ${dateKey}, aucun personnel disponible.`);
        return;
    }
    
    // Récupérer les disponibilités détaillées de TOUS les agents pour la date actuelle
    const personnelAvailabilitiesForDate = appData.personnelAvailabilities || {};

    const personnelToShow = availablePersonnel.filter(person => {
        // Exclure l'option 'Non assigné'
        if (person.id === 'none') return false;

        // Exclure le personnel déjà d'astreinte sur la feuille de garde actuelle
        if (onDutyAgents.includes(person.id)) {
            // console.log(`Agent ${person.name} (${person.id}) : Déjà d'astreinte, exclu.`);
            return false;
        }

        // Vérifier les disponibilités de l'agent pour cette date
        const agentDailyAvailabilities = personnelAvailabilitiesForDate[person.id]?.[dateKey];
        
        if (!Array.isArray(agentDailyAvailabilities) || agentDailyAvailabilities.length === 0) {
            // console.log(`Agent ${person.name} (${person.id}) n'est pas disponible: Pas de disponibilités quotidiennes ou tableau vide.`);
            return false;
        }

        // Vérifier si l'agent est disponible pour AU MOINS UN créneau de la feuille de garde
        let isAvailableForRoster = false;
        for (const rosterSlot of rosterTimeSlots) {
            for (const agentAvailability of agentDailyAvailabilities) {
                const overlaps = doTimeRangesOverlap(rosterSlot, agentAvailability);
                if (overlaps) {
                    isAvailableForRoster = true;
                    break; // Un seul chevauchement suffit pour marquer l'agent comme disponible
                }
            }
            if (isAvailableForRoster) {
                break;
            }
        }
        // console.log(`Disponibilité finale pour ${person.name} (${person.id}) pour la date de la feuille de garde ${dateKey}: ${isAvailableForRoster}`);
        return isAvailableForRoster;
    });

    const sortedPersonnel = sortPersonnelByGrade(personnelToShow);

    sortedPersonnel.forEach(person => {
        const personDiv = document.createElement('div');
        personDiv.classList.add('agent-item'); // Utilisez la classe du CSS
        personDiv.textContent = `${person.prenom} ${person.nom}`; // Utilise prenom et nom
        personDiv.dataset.agentId = person.id;
        personDiv.setAttribute('draggable', true);

        if (person.qualifications && person.qualifications.length > 0) {
            const qualSpan = document.createElement('span');
            qualSpan.classList.add('qualifications-tag');
            qualSpan.textContent = ` (${person.qualifications.join(', ')})`;
            personDiv.appendChild(qualSpan);
        }

        personDiv.addEventListener('dragstart', handleDragStart);
        availablePersonnelList.appendChild(personDiv);
    });

    if (sortedPersonnel.length === 0 && rosterTimeSlots.length > 0) {
        const noPersonnelMessage = document.createElement('p');
        noPersonnelMessage.classList.add('text-gray-500', 'text-center', 'py-4', 'px-2', 'text-sm');
        noPersonnelMessage.textContent = "Aucun agent disponible pendant les créneaux horaires de ce jour ou déjà d'astreinte.";
        availablePersonnelList.appendChild(noPersonnelMessage);
    }
}

// Crée les 10 cases pour les agents d'astreinte
function createOnDutySlots() {
    onDutyAgentsGrid.innerHTML = '';
    for (let i = 0; i < 10; i++) {
        const slotDiv = document.createElement('div');
        slotDiv.classList.add('on-duty-slot');
        slotDiv.dataset.slotIndex = i; // Pour identifier la case
        slotDiv.textContent = `Astreinte ${i + 1}`; // Placeholder
        slotDiv.addEventListener('dragover', handleDragOver);
        slotDiv.addEventListener('dragleave', handleDragLeave);
        slotDiv.addEventListener('drop', handleDropOnDuty);
        onDutyAgentsGrid.appendChild(slotDiv);
    }
}

// Rend les agents d'astreinte dans leurs cases
function renderOnDutyAgentsGrid() {
    onDutyAgentsGrid.querySelectorAll('.on-duty-slot').forEach(slotDiv => {
        const index = parseInt(slotDiv.dataset.slotIndex);
        const dateKey = formatDateToYYYYMMDD(currentRosterDate);
        // Assure que onDutyAgents est un tableau de 10 éléments, initialisé avec 'none' si nécessaire
        if (!appData[dateKey].onDutyAgents || appData[dateKey].onDutyAgents.length !== 10) {
            appData[dateKey].onDutyAgents = Array(10).fill('none');
        }
        const onDutyAgents = appData[dateKey].onDutyAgents;

        const assignedPersonId = onDutyAgents[index];
        const assignedPerson = availablePersonnel.find(p => p.id === assignedPersonId);

        // Nettoyer la case avant de la remplir
        slotDiv.classList.remove('filled', 'bg-blue-50', 'border-blue-300', 'text-blue-800', 'font-semibold', 'shadow-sm');
        slotDiv.classList.add('bg-gray-100', 'border-dashed', 'text-gray-500');
        slotDiv.textContent = `Astreinte ${index + 1}`;
        slotDiv.dataset.agentId = '';
        slotDiv.removeAttribute('draggable');
        const existingRemoveBtn = slotDiv.querySelector('.remove-agent-btn');
        if (existingRemoveBtn) {
            existingRemoveBtn.remove();
        }


        if (assignedPerson && assignedPerson.id !== 'none') {
            slotDiv.classList.remove('bg-gray-100', 'border-dashed', 'text-gray-500');
            slotDiv.classList.add('filled', 'bg-blue-50', 'border-blue-300', 'text-blue-800', 'font-semibold', 'shadow-sm');
            slotDiv.textContent = `${assignedPerson.prenom} ${assignedPerson.nom}`;

            slotDiv.dataset.agentId = assignedPerson.id; // L'ID de l'agent dans la case
            slotDiv.setAttribute('draggable', true); // Rendre draggable pour le retirer
            slotDiv.addEventListener('dragstart', handleDragStart); // Attacher le dragstart ici aussi

            // Ajouter un bouton de suppression pour les agents déjà affectés manuellement
            let removeBtn = slotDiv.querySelector('.remove-agent-btn');
            if (!removeBtn) {
                removeBtn = document.createElement('span');
                removeBtn.classList.add('remove-agent-btn');
                removeBtn.innerHTML = '&times;';
                removeBtn.title = 'Retirer l\'agent';
                removeBtn.addEventListener('click', (e) => {
                    e.stopPropagation(); // Empêche le drop d'être déclenché
                    removeAgentFromOnDuty(index); // Supprime par index de slot
                });
                slotDiv.appendChild(removeBtn);
            }
        }
    });
    renderAvailablePersonnel(); // Met à jour la liste des agents disponibles
}

// Rend la grille principale de la feuille de garde
function renderRosterGrid() {
    rosterGridContainer.innerHTML = ''; // Vide le conteneur

    const table = document.createElement('table');
    table.classList.add('roster-table');

    // En-tête du tableau (heures)
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headerRow.insertCell().textContent = "Poste / Agent"; // Coin supérieur gauche

    horaires.forEach(slot => {
        const th = document.createElement('th');
        th.classList.add('time-header');
        th.textContent = slot.split(' - ')[0]; // Afficher seulement l'heure de début
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Corps du tableau (Postes et Affectations)
    const tbody = document.createElement('tbody');
    // Pour l'instant, on aura juste une ligne "Équipe" pour les affectations auto/manuelles
    // Plus tard, on pourra avoir différents postes (Chef d'Agrès, Conducteur, etc.)
    const teamRow = tbody.insertRow();
    teamRow.insertCell().textContent = "Équipe"; // Nom du poste

    // Récupérer les créneaux horaires définis par l'administrateur
    const dateKey = formatDateToYYYYMMDD(currentRosterDate);
    const configuredTimeSlots = Object.values(appData[dateKey]?.timeSlots || {});
    // On veut afficher toutes les 48 colonnes horaires, pas seulement les créneaux configurés
    // La logique d'affectation se base sur les horaires générés au début du script
    horaires.forEach(fullTimeSlot => { // Parcourir tous les créneaux de 30min de la journée
        const cell = teamRow.insertCell();
        cell.classList.add('roster-cell');
        cell.dataset.timeSlot = fullTimeSlot; // Stocke le créneau horaire complet

        // Trouver le créneau configuré qui chevauche ce créneau de 30min
        const overlappingConfiguredSlot = configuredTimeSlots.find(configSlot => {
            return doTimeRangesOverlap(
                { start: fullTimeSlot.split(' - ')[0], end: fullTimeSlot.split(' - ')[1] }, // Le créneau de 30min
                { start: configSlot.range.split(' - ')[0], end: configSlot.range.split(' - ')[1] }  // Le créneau configuré par l'admin
            );
        });

        // Si ce créneau de 30min fait partie d'un créneau configuré par l'admin
        if (overlappingConfiguredSlot) {
            const assignedAgentId = overlappingConfiguredSlot.engines?.FPT?.personnel?.EQ || null; // Exemple pour 'Équipe' FPT
            const agentInfo = allAgents.find(a => a.id === assignedAgentId);

            if (agentInfo && assignedAgentId !== 'none') {
                cell.textContent = `${agentInfo.prenom} ${agentInfo.nom}`;
                cell.classList.add('assigned');
                cell.title = `Assigné à ${overlappingConfiguredSlot.range}`; // Tooltip
            } else {
                cell.textContent = ''; // Laisse vide si non assigné pour ce créneau
            }
            // Ajouter les écouteurs de drag & drop seulement si c'est une cellule "affectable"
            cell.addEventListener('dragover', handleDragOverRoster);
            cell.addEventListener('dragleave', handleDragLeaveRoster);
            cell.addEventListener('drop', handleDropRoster);
        } else {
            // Créneau non configuré par l'admin, désactivé
            cell.classList.add('disabled');
            cell.textContent = '';
            cell.title = "Non configuré";
        }
    });
    table.appendChild(tbody);
    rosterGridContainer.appendChild(table);
}


// --- Fonctions Drag & Drop ---
let draggedAgentId = null; // ID de l'agent en cours de glissement

function handleDragStart(e) {
    draggedAgentId = e.target.dataset.agentId;
    e.dataTransfer.setData('text/plain', draggedAgentId); // Important pour le drop
    e.target.classList.add('dragging'); // Ajoute une classe pour le style pendant le drag
}

function handleDragOver(e) {
    e.preventDefault(); // Permet le drop
    if (e.target.classList.contains('on-duty-slot')) {
        e.target.classList.add('drag-over'); // Style de survol
    }
}

function handleDragLeave(e) {
    if (e.target.classList.contains('on-duty-slot')) {
        e.target.classList.remove('drag-over');
    }
}

async function handleDropOnDuty(e) {
    e.preventDefault();
    e.target.classList.remove('drag-over');

    const droppedAgentId = e.dataTransfer.getData('text/plain');
    const targetSlotIndex = parseInt(e.target.dataset.slotIndex); // Index de la case d'astreinte

    const dateKey = formatDateToYYYYMMDD(currentRosterDate);
    let onDutyAgents = appData[dateKey].onDutyAgents || Array(10).fill('none');

    // Vérifier si l'agent est déjà dans une case d'astreinte
    const existingIndex = onDutyAgents.indexOf(droppedAgentId);

    if (existingIndex !== -1) {
        // L'agent est déjà en astreinte, on le déplace
        // Si c'est la même case, ne rien faire
        if (existingIndex === targetSlotIndex) return;

        // Si la case cible est déjà occupée, l'agent actuel prend la place de l'ancien
        if (onDutyAgents[targetSlotIndex] !== 'none') {
            // Échanger les positions si les deux sont occupées
            const agentInTargetSlot = onDutyAgents[targetSlotIndex];
            onDutyAgents[existingIndex] = agentInTargetSlot; // L'ancien slot de l'agent glissé reçoit l'agent qui était à la cible
            onDutyAgents[targetSlotIndex] = droppedAgentId; // La cible reçoit l'agent glissé
        } else {
            // La case cible est vide, simplement déplacer
            onDutyAgents[existingIndex] = 'none'; // Vider l'ancienne position
            onDutyAgents[targetSlotIndex] = droppedAgentId; // Placer à la nouvelle position
        }
    } else {
        // Ajouter le nouvel agent dans la case d'astreinte
        const agentInfo = allAgents.find(a => a.id === droppedAgentId);
        if (agentInfo && targetSlotIndex !== undefined) {
            if (onDutyAgents[targetSlotIndex] !== 'none') {
                showAlertModal('Cette case est déjà occupée. Veuillez d\'abord retirer l\'agent existant ou glisser sur une case vide.');
                return;
            }
            onDutyAgents[targetSlotIndex] = droppedAgentId;
        }
    }
    appData[dateKey].onDutyAgents = onDutyAgents; // Mettre à jour appData
    renderOnDutyAgentsGrid(); // Re-rendre la liste des agents d'astreinte
    await saveRosterConfig(dateKey); // Sauvegarder la nouvelle configuration
}

// Supprimer un agent des astreintes (depuis le bouton 'x')
async function removeAgentFromOnDuty(slotIndex) {
    const dateKey = formatDateToYYYYMMDD(currentRosterDate);
    const agentIdToRemove = appData[dateKey].onDutyAgents[slotIndex];
    const agentName = allAgents.find(p => p.id === agentIdToRemove)?.nom || 'cet agent'; // Correction : utiliser nom, pas name

    showConfirmationModal(`Êtes-vous sûr de vouloir retirer ${agentName} de la case ${slotIndex + 1} ? Cela désaffectera aussi l'agent des engins si assigné.`, async (confirmed) => {
        if (confirmed) {
            appData[dateKey].onDutyAgents[slotIndex] = 'none'; // Vide la case d'astreinte

            // Mettre à jour les affectations d'engin pour la date actuelle
            const currentDayTimeSlots = appData[dateKey].timeSlots;
            for (const slotId in currentDayTimeSlots) {
                const slot = currentDayTimeSlots[slotId];
                for (const engineType in slot.engines) {
                    const engine = slot.engines[engineType];
                    for (const role in engine.personnel) {
                        if (engine.personnel[role] === agentIdToRemove) {
                            engine.personnel[role] = 'none'; // Désaffecte l'agent de ce poste
                        }
                    }
                }
            }
            await saveRosterConfig(dateKey); // Sauvegarde les modifications de la config
            await saveDailyRoster(dateKey); // Sauvegarde les modifications de la feuille de garde
            
            renderOnDutyAgentsGrid(); // Met à jour l'affichage de la grille
            renderAvailablePersonnel(); // Met à jour la liste du personnel disponible

            // Rafraîchit l'affichage des engins si la page de détails est ouverte
            if (engineDetailsPage.style.display === 'block' && currentEditingEngineContext) {
                displayEnginesForSlot(currentEditingEngineContext.dateKey, currentEditingEngineContext.slotId);
            } else {
                renderRosterGrid(); // Sinon, rafraîchit la grille principale
            }
            console.log(`Agent retiré de la case ${slotIndex} pour le ${dateKey}.`);
        }
    });
}

// Drag/Drop pour la grille de la feuille de garde
function handleDragOverRoster(e) {
    e.preventDefault();
    if (e.target.classList.contains('roster-cell') && !e.target.classList.contains('disabled')) {
        e.target.classList.add('drag-over'); // Ajoute un style de survol à la cellule du tableau
    }
}

function handleDragLeaveRoster(e) {
    e.target.classList.remove('drag-over');
}

async function handleDropRoster(e) {
    e.preventDefault();
    e.target.classList.remove('drag-over');

    if (e.target.classList.contains('disabled')) {
        showAlertModal("Vous ne pouvez pas affecter un agent à un créneau non configuré.");
        return;
    }

    const droppedAgentId = e.dataTransfer.getData('text/plain');
    const targetTimeSlot = e.target.dataset.timeSlot; // Créneau horaire de la cellule (ex: "07:00 - 07:30")

    if (!droppedAgentId || !targetTimeSlot) return;

    const agentInfo = allAgents.find(a => a.id === droppedAgentId);
    if (!agentInfo) return;

    const dateKey = formatDateToYYYYMMDD(currentRosterDate);
    
    // Trouver le créneau configuré qui contient ce créneau de 30min
    const relevantConfiguredSlotId = Object.keys(appData[dateKey].timeSlots || {}).find(slotId => {
        const configSlotRange = appData[dateKey].timeSlots[slotId].range;
        return doTimeRangesOverlap(
            { start: targetTimeSlot.split(' - ')[0], end: targetTimeSlot.split(' - ')[1] },
            { start: configSlotRange.split(' - ')[0], end: configSlotRange.split(' - ')[1] }
        );
    });

    if (!relevantConfiguredSlotId) {
        showAlertModal("Impossible d'affecter un agent à ce créneau horaire : il ne correspond à aucune plage définie.");
        return;
    }

    const assignedAgentId = appData[dateKey].timeSlots[relevantConfiguredSlotId].engines?.FPT?.personnel?.EQ || null;
    if (assignedAgentId && assignedAgentId !== 'none') {
        showAlertModal(`Un agent est déjà assigné à ce créneau principal. Veuillez le désassigner d'abord.`);
        return;
    }

    // Mise à jour de currentRosterData
    // Pour l'instant, on affecte à 'Équipe' / 'FPT' / 'EQ'
    if (!appData[dateKey].timeSlots[relevantConfiguredSlotId].engines?.FPT?.personnel) {
        // Assurez-vous que la structure existe si elle n'a pas été initialisée correctement
        appData[dateKey].timeSlots[relevantConfiguredSlotId].engines.FPT = createEmptyEngineAssignment('FPT');
    }
    appData[dateKey].timeSlots[relevantConfiguredSlotId].engines.FPT.personnel.EQ = droppedAgentId;

    renderRosterGrid(); // Re-rendre la grille pour afficher la nouvelle affectation
    await saveDailyRoster(dateKey); // Sauvegarder la feuille de garde modifiée
    showAlertModal(`Agent ${agentInfo.prenom} ${agentInfo.nom} assigné à la plage ${appData[dateKey].timeSlots[relevantConfiguredSlotId].range}.`);
}


// --- Fonctions de génération automatique ---

/**
 * Filtre le personnel qualifié pour un rôle donné et le trie par préférence de grade.
 * @param {string} role - Le rôle à affecter (ex: 'CA_FPT', 'EQ').
 * @param {Array<Object>} personnelPool - Le tableau de personnel disponible pour ce créneau.
 * @returns {Array<Object>} Le personnel qualifié et trié par grade préféré.
 */
function getQualifiedPersonnelForRole(role, personnelPool) {
    const preferredGrades = roleGradePreferences[role] || [];

    // Filtrer le personnel qui a la qualification requise
    return personnelPool
        .filter(person => person.qualifications.includes(role))
        .sort((a, b) => {
            // Trier par préférence de grade
            const gradeAIndex = preferredGrades.indexOf(a.grade);
            const gradeBIndex = preferredGrades.indexOf(b.grade);

            // Gérer les grades non trouvés en les mettant à la fin
            const finalGradeA = gradeAIndex === -1 ? Infinity : gradeAIndex;
            const finalGradeB = gradeBIndex === -1 ? Infinity : gradeBIndex;

            return finalGradeA - finalGradeB;
        });
}

/**
 * Assigne automatiquement le personnel pour un créneau horaire donné.
 * Permet à un agent d'être affecté à plusieurs postes sur des engins différents s'il est qualifié,
 * mais un seul poste par engin.
 * @param {string} dateKey - La clé de la date (AAAA-MM-JJ).
 * @param {string} slotId - L'ID du créneau horaire.
 */
function assignPersonnelToSlot(dateKey, slotId) {
    const slotData = appData[dateKey].timeSlots[slotId];
    const onDutyAgentsIds = appData[dateKey].onDutyAgents.filter(id => id !== 'none');

    const currentOnDutyPersonnel = onDutyAgentsIds
        .map(id => allAgents.find(p => p.id === id)) // Utilise allAgents pour récupérer les infos complètes
        .filter(p => p !== undefined);

    // Maintenant, assigner le personnel en parcourant les engins et leurs rôles
    ['FPT', 'CCF', 'VSAV', 'VTU', 'VPMA'].forEach(engineType => {
        const engineAssignment = slotData.engines[engineType];
        const rolesForThisEngine = engineRoles[engineType] || [];

        // Set pour suivre les agents déjà affectés DANS CET ENGIN pour ce créneau
        const personnelAssignedInThisEngine = new Set();

        // Pré-remplir avec les affectations manuelles existantes pour cet engin
        rolesForThisEngine.forEach(role => {
            const assignedPersonId = engineAssignment.personnel[role];
            if (assignedPersonId !== 'none') {
                personnelAssignedInThisEngine.add(assignedPersonId);
            }
        });

        // Trier les rôles pour cet engin par priorité de rôle
        const sortedRolesForEngine = [...rolesForThisEngine].sort((a, b) => {
            const typeA = roleTypePriority[getRoleType(a)] || Infinity;
            const typeB = roleTypePriority[getRoleType(b)] || Infinity;
            return typeA - typeB;
        });

        sortedRolesForEngine.forEach(role => {
            // Si le poste est déjà rempli (manuellement ou auto précédemment), on passe
            if (engineAssignment.personnel[role] !== 'none') {
                return;
            }

            let assignedPersonId = 'none';

            // Filtrer le personnel qui est d'astreinte ET qui n'est PAS déjà affecté à un autre poste DANS CET ENGIN
            // ET dont le planning chevauche le créneau actuel de la feuille de garde
            const availableCandidatesForThisRole = currentOnDutyPersonnel.filter(person => {
                const agentDailyAvailabilities = appData.personnelAvailabilities[person.id]?.[dateKey];
                if (!Array.isArray(agentDailyAvailabilities) || agentDailyAvailabilities.length === 0) {
                    return false; // Pas de disponibilités pour ce jour
                }

                // Vérifier si l'agent est disponible pour le créneau courant de la feuille de garde
                const currentConfigSlotRange = slotData.range; // Plage du créneau configuré par l'admin
                const configSlotRangeObj = {
                    start: currentConfigSlotRange.split(' - ')[0],
                    end: currentConfigSlotRange.split(' - ')[1]
                };

                // Vérifier si une des disponibilités de l'agent chevauche le créneau configuré
                const isAgentAvailableForConfigSlot = agentDailyAvailabilities.some(agentAvailability =>
                    doTimeRangesOverlap(configSlotRangeObj, agentAvailability)
                );
                
                return isAgentAvailableForConfigSlot && !personnelAssignedInThisEngine.has(person.id);
            });

            // Obtenir les candidats qualifiés pour ce rôle, triés par préférence de grade
            const qualifiedAndAvailableCandidates = getQualifiedPersonnelForRole(role, availableCandidatesForThisRole);

            if (qualifiedAndAvailableCandidates.length > 0) {
                const bestGradePriorityValue = gradePriority[qualifiedAndAvailableCandidates[0].grade];

                // Filtrer les candidats pour ne garder que ceux qui ont ce meilleur grade
                const topCandidates = qualifiedAndAvailableCandidates.filter(c => gradePriority[c.grade] === bestGradePriorityValue);

                // Si plusieurs candidats ont le même meilleur grade, choisir aléatoirement
                const randomIndex = Math.floor(Math.random() * topCandidates.length);
                assignedPersonId = topCandidates[randomIndex].id;

                // Marquer cette personne comme affectée DANS CET ENGIN pour ce créneau
                personnelAssignedInThisEngine.add(assignedPersonId);
            }
            engineAssignment.personnel[role] = assignedPersonId;
        });
    });
}

/**
 * Génère automatiquement la feuille de garde pour la date spécifiée.
 * Conserve les créneaux et les affectations existantes, et remplit les postes vides
 * en priorisant le personnel par grade et qualification.
 * @param {string} dateKey - La clé de la date (AAAA-MM-JJ) pour laquelle générer la feuille de garde.
 */
async function generateAutomaticRoster(dateKey) {
    // S'assurer que la structure de données existe pour la date
    if (!appData[dateKey]) {
        appData[dateKey] = { timeSlots: {}, onDutyAgents: Array(10).fill('none') };
        initializeDefaultTimeSlotsForDate(dateKey); // S'assurer que les créneaux sont là
    }

    showLoading(true);
    rosterGridContainer.innerHTML = '<p class="loading-message">Génération automatique en cours...</p>';

    const currentDayTimeSlots = appData[dateKey].timeSlots;

    // Parcourir tous les créneaux horaires de la journée et assigner le personnel pour chacun
    for (const slotId in currentDayTimeSlots) {
        assignPersonnelToSlot(dateKey, slotId);
    }

    await saveDailyRoster(dateKey); // Sauvegarde toutes les modifications de la feuille de garde
    renderRosterGrid(); // Rafraîchit l'affichage de la feuille de garde
    
    showLoading(false);
    showAlertModal("La feuille de garde a été générée automatiquement !");
}


// --- Fonctions utilitaires diverses ---
// Fonction utilitaire pour obtenir une date à partir d'un numéro de semaine ISO et d'un jour de la semaine
// (Cette fonction est copiée de agent.js pour assurer la cohérence)
function getDateFromWeekAndDay(year, weekNumber, dayName) {
    const simple = new Date(year, 0, 1 + (weekNumber - 1) * 7);
    const dow = simple.getDay() || 7;
    const ISOweekStart = new Date(simple);
    if (dow <= 4) {
        ISOweekStart.setDate(simple.getDate() - dow + 1);
    } else {
        ISOweekStart.setDate(simple.getDate() + 8 - dow);
    }

    const daysMap = {
        'lundi': 0, 'mardi': 1, 'mercredi': 2, 'jeudi': 3, 'vendredi': 4, 'samedi': 5, 'dimanche': 6
    };
    const dayOffset = daysMap[dayName];
    if (dayOffset === undefined) return null;

    const targetDate = new Date(ISOweekStart);
    targetDate.setDate(ISOweekStart.getDate() + dayOffset);
    return targetDate;
}

function showLoading(isLoading) {
    if (isLoading) {
        if (loadingSpinner) loadingSpinner.classList.remove('hidden');
        document.body.classList.add('loading-active');
        // Désactiver tous les boutons et inputs pour éviter les clics pendant le chargement
        document.querySelectorAll('button, input, select, a').forEach(el => el.disabled = true);
    } else {
        if (loadingSpinner) loadingSpinner.classList.add('hidden');
        document.body.classList.remove('loading-active');
        // Réactiver tous les boutons et inputs
        document.querySelectorAll('button, input, select, a').forEach(el => el.disabled = false);
    }
}
// Ajout d'un style pour le body.loading-active dans le CSS (pas ici, mais à noter pour le CSS)
// Cela désactivera les événements de souris et changera le curseur sur tout le corps.

// --- Événements et initialisation globale ---

// Bouton "Ajouter un créneau" est maintenant géré dans renderTimeSlotButtons pour s'assurer qu'il est toujours présent
// après un re-rendu complet.