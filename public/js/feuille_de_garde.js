document.addEventListener('DOMContentLoaded', () => {
    // Récupération des éléments du DOM
    const timeSlotButtonsContainer = document.getElementById('time-slot-buttons-container');
    const addTimeSlotBtn = document.getElementById('add-time-slot-btn');
    const engineDetailsPage = document.getElementById('engine-details-page');
    const engineGrid = engineDetailsPage.querySelector('.engine-grid');
    const rosterGrid = document.getElementById('roster-grid');

    const rosterDateInput = document.getElementById('roster-date');
    const prevDayButton = document.getElementById('prev-day-button');
    const nextDayButton = document.getElementById('next-day-button');
    const refreshButton = document.getElementById('refresh-button'); // Le bouton "Actualiser" qui deviendra "Générer auto"
    const backToRosterBtn = document.getElementById('back-to-roster-btn'); // Nouveau bouton de retour

    // Nouveaux éléments DOM pour la gestion du personnel
    const availablePersonnelList = document.getElementById('available-personnel-list');
    const onDutyAgentsGrid = document.getElementById('on-duty-agents-grid');

    // Date affichée : par défaut la date actuelle
    let currentDisplayedDate = new Date();
    // Pour tester sur une date spécifique (ex: 6 juin 2025), décommentez la ligne ci-dessous et commentez celle au-dessus :
    // let currentDisplayedDate = new Date('2025-06-06T00:00:00');

    let timeSlotCounter = 0; // Pour assurer des IDs uniques pour les nouveaux créneaux

    // Clé pour le stockage local (localStorage)
    const LOCAL_STORAGE_KEY = 'feuilleDeGardeData';

    // URL de base de votre API (à remplacer par l'URL réelle de votre backend)
    const API_BASE_URL = "https://dispo-pompier.onrender.com"; 

    // --- Stockage des données ---
    // appData contiendra toutes nos données de feuille de garde, indexées par date (AAAA-MM-JJ).
    // Chaque date aura ses propres créneaux horaires et les engins/personnel qui leur sont associés.
    // personnelAvailabilities contiendra les disponibilités réelles chargées depuis l'API.
    let appData = {
        personnelAvailabilities: {} // Cette partie sera remplie par l'API
    };

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
        { id: 'bruneau', name: 'BRUNEAU Mathieu', qualifications: ['CA_FPT', 'CA_VSAV', 'CA_VTU', 'CA_VPMA', 'COD0', 'EQ1_FPT', 'EQ2_FPT', 'EQ1_FDF1', 'EQ2_FDF1', 'EQ'], grade: 'CATE' },
        { id: 'vatinel', name: 'VATINEL Sébastien', qualifications: ['CA_FDF2', 'CA_FPT', 'CA_VSAV', 'CA_VTU', 'CA_VPMA', 'COD2', 'COD1', 'COD0', 'EQ1_FPT', 'EQ2_FPT', 'EQ1_FDF1', 'EQ2_FDF1', 'EQ'], grade: 'CATE' },
        { id: 'lelann', name: 'LE LANN Philippe', qualifications: ['CA_FPT', 'CA_VSAV', 'CA_VTU', 'CA_VPMA', 'COD1', 'COD0', 'EQ1_FPT', 'EQ2_FPT', 'EQ1_FDF1', 'EQ2_FDF1', 'EQ'], grade: 'CATE' },
        { id: 'tuleu', name: 'TULEU Kévin', qualifications: ['CA_FPT', 'CA_VSAV', 'CA_VTU', 'CA_VPMA', 'COD0', 'EQ1_FPT', 'EQ2_FPT', 'EQ'], grade: 'CATE' },
        { id: 'gesbert', name: 'GESBERT Jonathan', qualifications: ['CA_FDF2', 'CA_FPT', 'CA_VSAV', 'CA_VTU', 'CA_VPMA', 'COD2', 'COD1', 'COD0', 'EQ1_FPT', 'EQ2_FPT', 'EQ1_FDF1', 'EQ2_FDF1', 'EQ'], grade: 'CATE' },

        // CAUE (Chef d'Agrès Un Engin)
        { id: 'cordel', name: 'CORDEL Camilla', qualifications: ['CA_VSAV', 'CA_VTU', 'CA_VPMA', 'COD1', 'COD0', 'EQ1_FPT', 'EQ2_FPT', 'EQ1_FDF1', 'EQ2_FDF1', 'EQ'], grade: 'CAUE' },
        { id: 'boudet', name: 'BOUDET Sébastien', qualifications: ['CA_VSAV', 'CA_VTU', 'CA_VPMA', 'COD2', 'COD1', 'COD0', 'EQ1_FPT', 'EQ2_FPT', 'EQ1_FDF1', 'EQ2_FDF1', 'EQ'], grade: 'CAUE' },
        { id: 'boulmé', name: 'BOULME Grégoire', qualifications: ['CA_VSAV', 'CA_VTU', 'CA_VPMA', 'COD0', 'EQ1_FPT', 'EQ2_FPT', 'EQ1_FDF1', 'EQ2_FDF1', 'EQ'], grade: 'CAUE' },

        // CAP (Caporal)
        { id: 'marechal', name: 'MARECHAL Nicolas', qualifications: ['COD1', 'COD0', 'EQ1_FPT', 'EQ2_FPT', 'EQ1_FDF1', 'EQ2_FDF1', 'EQ'], grade: 'CAP' },
        { id: 'normand', name: 'NORMAND Stéphane', qualifications: ['COD2', 'COD1', 'COD0', 'EQ1_FPT', 'EQ2_FPT', 'EQ1_FDF1', 'EQ2_FDF1', 'EQ'], grade: 'CAP' },
        { id: 'justice', name: 'JUSTICE Quentin', qualifications: ['COD0', 'EQ1_FPT', 'EQ2_FPT', 'EQ1_FDF1', 'EQ2_FDF1', 'EQ'], grade: 'CAP' },
        { id: 'schaeffer', name: 'SCHAEFFER Caroline', qualifications: ['COD0', 'EQ1_FPT', 'EQ2_FPT', 'EQ1_FDF1', 'EQ2_FDF1', 'EQ'], grade: 'CAP' },
        { id: 'veniant', name: 'VENIANT Mathis', qualifications: ['COD0', 'EQ1_FPT', 'EQ2_FPT', 'EQ1_FDF1', 'EQ2_FDF1', 'EQ'], grade: 'CAP' },

        // SAP (Sapeur 1 & 2)
        { id: 'loisel', name: 'LOISEL Charlotte', qualifications: ['COD0', 'EQ1_FPT', 'EQ2_FPT', 'EQ'], grade: 'SAP' },
        { id: 'mailly', name: 'MAILLY Lucile', qualifications: ['EQ1_FPT', 'EQ2_FPT', 'EQ'], grade: 'SAP' },
        { id: 'savigny', name: 'SAVIGNY Victoria', qualifications: ['EQ1_FPT', 'EQ2_FPT', 'EQ1_FDF1', 'EQ2_FDF1', 'EQ'], grade: 'SAP' },
        { id: 'tinseau', name: 'TINSEAU Clément', qualifications: ['EQ1_FPT', 'EQ2_FPT', 'EQ1_FDF1', 'EQ2_FDF1', 'EQ'], grade: 'SAP' },
        { id: 'boulet', name: 'BOULET Aurélie', qualifications: ['COD0', 'EQ1_FPT', 'EQ2_FPT', 'EQ'], grade: 'SAP' },
        { id: 'marlin', name: 'MARLIN Lilian', qualifications: ['EQ1_FPT', 'EQ2_FPT', 'EQ'], grade: 'SAP' },
        { id: 'charenton', name: 'CHARENTON Marilou', qualifications: ['COD0', 'EQ1_FPT', 'EQ2_FPT', 'EQ'], grade: 'SAP' },
        { id: 'hérédia', name: 'HEREDIA Jules', qualifications: ['EQ'], grade: 'SAP' },
        { id: 'none', name: 'Non assigné', qualifications: [], grade: 'none' } // Option pour un emplacement vide
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

    // --- Fonctions de persistance des données ---

    // Sauvegarde les données de l'application dans le localStorage
    function saveAppData() {
        try {
            // Ne pas sauvegarder personnelAvailabilities dans le localStorage, car cela vient de l'API
            const appDataToSave = { ...appData };
            delete appDataToSave.personnelAvailabilities;
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(appDataToSave));
            console.log('Données de la feuille de garde sauvegardées dans localStorage.');
        } catch (e) {
            console.error('Erreur lors de la sauvegarde des données dans localStorage :', e);
        }
    }

    // Charge les données de l'application depuis le localStorage et l'API
    async function loadAppData() {
        try {
            const storedData = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (storedData) {
                appData = JSON.parse(storedData);
                console.log('Données de la feuille de garde chargées depuis localStorage.');
            } else {
                appData = {}; // Initialise vide si aucune donnée trouvée
            }

            // Assure l'initialisation de personnelAvailabilities (sera rempli par l'API)
            appData.personnelAvailabilities = {};

            // Initialise les créneaux par défaut pour la date actuelle si c'est la première exécution pour cette date
            if (!appData[formatDate(currentDisplayedDate)] || Object.keys(appData[formatDate(currentDisplayedDate)].timeSlots).length === 0) {
                initializeDefaultTimeSlotsForDate(formatDate(currentDisplayedDate));
            }

            // Charge les disponibilités des agents depuis l'API
            await loadAllPersonnelAvailabilities();

        } catch (e) {
            console.error('Erreur lors du chargement des données depuis localStorage ou API :', e);
            appData = {}; // Revient à vide si l'analyse ou le chargement API échoue
            appData.personnelAvailabilities = {}; // Assure l'initialisation
            initializeDefaultTimeSlotsForDate(formatDate(currentDisplayedDate));
        }
    }

    // Fonction pour récupérer les disponibilités de tous les agents depuis l'API
    async function loadAllPersonnelAvailabilities() {
        console.log("Tentative de chargement des disponibilités de tous les agents depuis l'API...");
        try {
            // Premièrement, essayer de récupérer la liste de tous les agents.
            // Adaptez cette URL si votre API a une route différente pour lister les agents.
            const agentsResponse = await fetch(`${API_BASE_URL}/api/agents`);
            if (!agentsResponse.ok) {
                console.warn(`Impossible de récupérer la liste des agents (${agentsResponse.status}). Fallback sur la liste locale.`);
                // Si la route /api/agents n'existe pas, ou renvoie une erreur, nous pourrions
                // potentiellement ignorer cette étape et ne compter que sur les IDs fixes de `availablePersonnel`
                // pour ensuite faire des appels individuels si une route globale n'existe pas.
                // Pour l'instant, on se base sur availablePersonnel si la liste des agents échoue.
            }

            let agentsToFetch = [];
            if (agentsResponse.ok) {
                const fetchedAgents = await agentsResponse.json();
                agentsToFetch = fetchedAgents.map(agent => agent.id); // Supposons que l'API renvoie des objets avec un `id`
            } else {
                // Fallback: Si la récupération de la liste des agents échoue, utilisez la liste `availablePersonnel` locale.
                agentsToFetch = availablePersonnel.filter(p => p.id !== 'none').map(p => p.id);
            }

            const allAvailabilities = {};

            // Deuxièmement, récupérer le planning de chaque agent
            for (const agentId of agentsToFetch) {
                try {
                    const response = await fetch(`${API_BASE_URL}/api/planning/${agentId}`);
                    if (!response.ok) {
                        if (response.status === 404) {
                            console.log(`Planning non trouvé pour l'agent ${agentId}.`);
                            continue; // Agent sans planning, passer au suivant
                        }
                        throw new Error(`Erreur HTTP ${response.status} pour l'agent ${agentId}`);
                    }
                    const agentPlanning = await response.json();
                    // console.log(`Planning reçu pour l'agent ${agentId}:`, agentPlanning);

                    // Transformer les données du format agent.js au format feuille_de_garde.js
                    // Format agent.js: planningDataAgent = { "week-XX": { "jour": ["07:00 - 14:00", ...] } }
                    // Format cible: appData.personnelAvailabilities = { "personId": {"YYYY-MM-DD": [{"start": "HH:MM", "end": "HH:MM"}, ...] } }

                    for (const weekKey in agentPlanning) {
                        const weekNumber = parseInt(weekKey.replace('week-', ''));
                        // **** MODIFICATION ICI ****
                        // Utilise l'année de la date actuellement affichée pour la cohérence
                        const year = currentDisplayedDate.getFullYear();

                        for (const dayOfWeek in agentPlanning[weekKey]) {
                            const date = getDateFromWeekAndDay(year, weekNumber, dayOfWeek);
                            if (!date) continue; // Si la date ne peut pas être calculée

                            const dateKey = formatDate(date);
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
        }
    }

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


    // --- Fonctions utilitaires ---

    // Formate une date au format AAAA-MM-JJ
    function formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0'); // Les mois sont indexés de 0
        const day = String(date.getDate()).padStart(2, '0');
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
    function updateDateDisplay() {
        const dateKey = formatDate(currentDisplayedDate);
        rosterDateInput.value = dateKey;
        // S'assure que les données pour cette date existent, initialise si non
        if (!appData[dateKey]) {
            appData[dateKey] = {
                timeSlots: {}, // Chaque date a son propre ensemble de créneaux horaires
                onDutyAgents: Array(10).fill('none') // Initialise les 10 slots pour les agents d'astreinte
            };
            initializeDefaultTimeSlotsForDate(dateKey);
        }
        // Toujours charger/rafraîchir les boutons de créneau horaire pour la date actuelle
        renderTimeSlotButtons(dateKey);
        renderAvailablePersonnel(); // Met à jour la liste du personnel disponible
        renderOnDutyAgentsGrid(); // Met à jour la grille des agents d'astreinte
        showMainRosterGrid(); // Toujours revenir à la grille principale lors du changement de date
        console.log('Date actuelle affichée:', dateKey);
    }

    // Fonction pour simuler le chargement des données de la feuille de garde
    // (à remplacer par un véritable appel API si vous avez un backend)
    function loadRosterData(date) {
        rosterGrid.innerHTML = '<p class="loading-message">Chargement de la feuille de garde...</p>';
        // Simule un délai d'appel API
        setTimeout(() => {
            if (rosterGrid.style.display !== 'none') { // Met à jour uniquement si la grille principale est visible
                rosterGrid.innerHTML = `
                    <h2 class="text-2xl font-bold text-gray-800 mb-4">Feuille de garde du centre BEAUNE pour le ${formatDate(date)}</h2>
                    <p class="text-gray-600">Sélectionnez un créneau horaire ci-dessus pour voir les engins détaillés et assigner le personnel.</p>
                `;
            }
        }, 300); // Simule un chargement de 0.3 seconde
    }

    // Rend les boutons de créneaux horaires pour la date actuelle
    function renderTimeSlotButtons(dateKey) {
        // Supprime les boutons existants (sauf le bouton d'ajout)
        document.querySelectorAll('.time-slot-button').forEach(btn => btn.remove());

        const currentSlots = appData[dateKey].timeSlots;
        // Correction : Pour un tri fiable, il faut parser les heures de début.
        const sortedSlotIds = Object.keys(currentSlots).sort((a, b) => {
            const timeA = parseTimeToMinutes(currentSlots[a].range.split(' - ')[0]);
            const timeB = parseTimeToMinutes(currentSlots[b].range.split(' - ')[0]);
            return timeA - timeB;
        });

        sortedSlotIds.forEach(slotId => {
            const slot = currentSlots[slotId];
            createTimeSlotButton(slotId, slot.range, false); // Aucun créneau n'est actif initialement
        });
    }

    // Crée un bouton de créneau horaire avec la capacité de suppression
    function createTimeSlotButton(slotId, initialTimeRange = '00:00 - 00:00', isActive = false) {
        const dateKey = formatDate(currentDisplayedDate); // Récupère la dateKey ici pour la création initiale ou l'update

        // Si le créneau existe déjà, ne le crée pas de nouveau dans le DOM, juste le mettre à jour si c'est 'active'
        const existingButton = document.querySelector(`[data-slot-id="${slotId}"]`);
        if (existingButton) {
            existingButton.textContent = initialTimeRange;
            // Ré-ajouter le bouton de suppression si nécessaire
            if (!existingButton.querySelector('.delete-time-slot-btn')) {
                const deleteBtn = document.createElement('span');
                deleteBtn.classList.add('delete-time-slot-btn', 'ml-2', 'text-red-500', 'hover:text-red-700', 'font-bold', 'cursor-pointer', 'text-lg');
                deleteBtn.innerHTML = '&times;';
                deleteBtn.title = 'Supprimer le créneau';
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    showConfirmationModal(`Êtes-vous sûr de vouloir supprimer le créneau "${button.textContent.replace('×', '').trim()}" ?`, () => {
                        deleteTimeSlot(slotId, button);
                    });
                });
                existingButton.appendChild(deleteBtn);
            }
            if (isActive) {
                document.querySelectorAll('.time-slot-button').forEach(btn => btn.classList.remove('active', 'bg-blue-500', 'text-white', 'border-blue-500'));
                existingButton.classList.add('active', 'bg-blue-500', 'text-white', 'border-blue-500');
            }
            // Met à jour la structure de données si ce n'est pas un nouveau créneau
            if (appData[dateKey] && appData[dateKey].timeSlots[slotId]) {
                appData[dateKey].timeSlots[slotId].range = initialTimeRange;
                saveAppData();
            }
            return; // Sortir, car le bouton a été mis à jour
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
            // Utilisation d'une modale personnalisée au lieu de confirm()
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

            displayEnginesForSlot(formatDate(currentDisplayedDate), slotId);
        });

        // Double-clic pour modifier la plage horaire (utilise la nouvelle modale)
        button.addEventListener('dblclick', () => {
            const currentRange = button.textContent.replace('×', '').trim();
            const [currentStart, currentEnd] = currentRange.split(' - ');

            showTimeRangePromptModal(currentStart, currentEnd, (newStart, newEnd) => {
                if (newStart && newEnd) { // Si l'utilisateur n'a pas annulé
                    const dateKey = formatDate(currentDisplayedDate);
                    const newTimeRange = `${newStart} - ${newEnd}`;

                    // Logique pour la création automatique du créneau suivant
                    const oldEndMinutes = parseTimeToMinutes(currentEnd); // L'heure de fin du créneau AVANT modification
                    let newEndMinutes = parseTimeToMinutes(newEnd);   // La nouvelle heure de fin du créneau
                    let newStartMinutes = parseTimeToMinutes(newStart);

                    // Ajuster pour les créneaux qui traversent minuit
                    if (newEndMinutes <= newStartMinutes) {
                        newEndMinutes += 24 * 60; // Ajouter 24 heures pour le calcul
                    }
                    if (oldEndMinutes <= parseTimeToMinutes(currentStart)) { // Si l'ancienne fin traversait minuit
                        // On doit la "normaliser" pour la comparaison
                        // On va juste considérer qu'une fin à 07:00 représente 07:00 du lendemain
                        // donc 07:00 (420) + 24*60 (1440) = 1860 minutes.
                        // On utilise cette valeur comme point de référence pour "la fin de la journée"
                    }

                    // Mettre à jour le créneau actuel
                    if (appData[dateKey] && appData[dateKey].timeSlots[slotId]) {
                        appData[dateKey].timeSlots[slotId].range = newTimeRange;
                    }

                    // Calcul de l'heure de fin théorique de la journée (07:00 le lendemain)
                    // Cette valeur est constante pour la "fin de journée" sur votre feuille de garde.
                    const endOfDayRefMinutes = parseTimeToMinutes('07:00') + (24 * 60);

                    // Calcul de la nouvelle heure de fin effective pour le créneau modifié
                    // Si newEnd est 07:00 et newStart est 17:00, newEnd effective est 07:00 le lendemain
                    let actualNewEndMinutes = parseTimeToMinutes(newEnd);
                    if (actualNewEndMinutes <= parseTimeToMinutes(newStart)) {
                         actualNewEndMinutes += 24 * 60;
                    }

                    // Condition pour créer le créneau suivant :
                    // Si la nouvelle heure de fin du créneau actuel n'atteint pas l'heure de fin de la journée (07:00 le lendemain)
                    // ET si la nouvelle heure de fin est après l'heure de début du créneau actuel.
                    if (actualNewEndMinutes < endOfDayRefMinutes && newEndMinutes > newStartMinutes) {
                        const nextSlotStartMinutes = parseTimeToMinutes(newEnd);
                        const nextSlotEndMinutes = parseTimeToMinutes('07:00'); // La fin est toujours 07:00 le lendemain

                        const nextSlotStartTime = formatMinutesToTime(nextSlotStartMinutes);
                        const nextSlotEndTime = formatMinutesToTime(nextSlotEndMinutes);

                        const nextSlotRange = `${nextSlotStartTime} - ${nextSlotEndTime}`;
                        // Générer un ID unique, s'assurant qu'il n'entre pas en collision avec les IDs existants
                        // En ajoutant Date.now() à la fin, on s'assure d'une unicité très forte.
                        const nextSlotId = `slot_${nextSlotStartTime.replace(':', '')}_${nextSlotEndTime.replace(':', '')}_${Date.now()}`;

                        // Vérifier si un créneau avec cette nouvelle plage existe déjà, pour éviter les doublons
                        let existingNextSlotFound = false;
                        for (const existingId in appData[dateKey].timeSlots) {
                            if (appData[dateKey].timeSlots[existingId].range === nextSlotRange) {
                                existingNextSlotFound = true;
                                break;
                            }
                        }

                        if (!existingNextSlotFound) {
                             // Trouver un créneau existant qui commencerait EXACTEMENT à la nouvelle heure de fin.
                            const existingSlotStartingAtNewEnd = Object.keys(appData[dateKey].timeSlots).find(id =>
                                appData[dateKey].timeSlots[id].range.split(' - ')[0] === nextSlotStartTime
                            );

                            if (existingSlotStartingAtNewEnd) {
                                // Mettre à jour la plage horaire du créneau existant
                                appData[dateKey].timeSlots[existingSlotStartingAtNewEnd].range = nextSlotRange;
                            } else {
                                // Créer un tout nouveau créneau
                                appData[dateKey].timeSlots[nextSlotId] = {
                                    range: nextSlotRange,
                                    engines: {} // Initialise vide
                                };
                                ['FPT', 'CCF', 'VSAV', 'VTU', 'VPMA'].forEach(engineType => {
                                    appData[dateKey].timeSlots[nextSlotId].engines[engineType] = createEmptyEngineAssignment(engineType);
                                });
                            }
                        }
                    }

                    saveAppData();
                    renderTimeSlotButtons(dateKey); // Rafraîchit tous les boutons pour inclure le nouveau/modifié et trier
                    renderAvailablePersonnel(); // Importanrt : les créneaux affectent les disponibilités
                }
            });
        });

        // Insère le nouveau bouton avant le bouton '+'
        timeSlotButtonsContainer.insertBefore(button, addTimeSlotBtn);

        // Ajoute à notre structure de données interne pour la date actuelle si c'est un nouveau créneau
        const dateKeyForSave = formatDate(currentDisplayedDate);
        if (!appData[dateKeyForSave].timeSlots[slotId]) {
            appData[dateKeyForSave].timeSlots[slotId] = {
                range: initialTimeRange,
                engines: {} // Commence sans aucun engin assigné
            };
            // Initialise la structure des engins par default pour ce nouveau créneau
            ['FPT', 'CCF', 'VSAV', 'VTU', 'VPMA'].forEach(engineType => {
                appData[dateKeyForSave].timeSlots[slotId].engines[engineType] = createEmptyEngineAssignment(engineType);
            });
            saveAppData(); // Sauvegarde la création initiale
        }
    }

    // Fonction pour supprimer un créneau horaire
    function deleteTimeSlot(slotId, buttonElement) {
        const dateKey = formatDate(currentDisplayedDate);
        if (appData[dateKey] && appData[dateKey].timeSlots[slotId]) {
            // Supprime du DOM
            buttonElement.remove();
            // Supprime de notre structure de données
            delete appData[dateKey].timeSlots[slotId];
            saveAppData(); // Sauvegarde les modifications
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
            saveAppData(); // Sauvegarde les créneaux par défaut
        }
    }

    // Fonction pour afficher les engins spécifiques et leur personnel affecté pour un créneau horaire sélectionné
    function displayEnginesForSlot(dateKey, slotId) {
        rosterGrid.style.display = 'none'; // Cache la grille principale
        // Garde la section de gestion du personnel et des agents d'astreinte visible
        document.querySelector('.personnel-management-section').style.display = 'flex';
        engineDetailsPage.style.display = 'block'; // Affiche la page des détails de l'engin
        engineGrid.innerHTML = ''; // Efface les engins précédents

        const slotData = appData[dateKey]?.timeSlots[slotId];

        if (!slotData) {
            engineGrid.innerHTML = '<p class="text-gray-600">Aucune donnée pour ce créneau horaire. Veuillez l\'ajouter ou changer de date.</p>';
            return;
        }

        // Affiche les 5 types d'engins prédéfinis.
        // Pour chacun, vérifie s'il existe dans slotData.engines, sinon, crée un engin par default.
        ['FPT', 'CCF', 'VSAV', 'VTU', 'VPMA'].forEach(engineType => {
            const engineName = engineType; // Utilise le type comme nom générique pour l'instant
            let engineDetails = slotData.engines[engineType]; // Utilise engineType directement

            // Si ce type d'engin n'est pas explicitement défini pour ce créneau, l'initialise
            if (!engineDetails) {
                engineDetails = createEmptyEngineAssignment(engineType);
                // Stocke ces données initialisées
                slotData.engines[engineType] = engineDetails;
            }

            const engineCase = document.createElement('div');
            engineCase.classList.add('engine-case', 'bg-white', 'p-4', 'rounded-lg', 'shadow-md', 'border', 'border-gray-200', 'hover:shadow-lg', 'transition-shadow', 'duration-200', 'ease-in-out', 'cursor-pointer');
            engineCase.dataset.engineType = engineType; // Stocke le type pour une recherche facile
            engineCase.dataset.slotId = slotId;
            engineCase.dataset.dateKey = dateKey;

            // Construit dynamiquement la liste du personnel à partir de l'objet engineDetails.personnel
            let personnelListHTML = '';
            const roles = engineRoles[engineType] || []; // Récupère les rôles définis pour ce type d'engin
            roles.forEach(role => {
                const personnelId = engineDetails.personnel[role];
                const personnel = availablePersonnel.find(p => p.id === personnelId);
                const personnelName = personnel ? personnel.name : 'Non assigné';
                personnelListHTML += `<li class="text-gray-700 text-sm">${role}: <span class="font-medium">${personnelName}</span></li>`;
            });

            engineCase.innerHTML = `
                <h3 class="text-lg font-semibold text-gray-800 mb-2">${engineName} <span class="places-count bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded-full ml-2">${roles.length} places</span></h3>
                <ul class="personnel-list space-y-1">${personnelListHTML}</ul>
            `;

            // Ajoute un écouteur de clic pour ouvrir la modale d'affectation du personnel
            engineCase.addEventListener('click', () => {
                openPersonnelAssignmentModal(dateKey, slotId, engineType);
            });
            engineGrid.appendChild(engineCase);
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
        // C'est la source du personnel pour les sélecteurs de la modale.
        const onDutyPersonnel = appData[dateKey].onDutyAgents
            .map(id => availablePersonnel.find(p => p.id === id))
            .filter(p => p !== undefined && p.id !== 'none'); // Filtre les IDs 'none' ou non trouvés

        // Ajout de l'option 'Non assigné' pour la sélection de personnel
        const personnelForModalSelect = [{ id: 'none', name: 'Non assigné', qualifications: [], grade: 'none' }].concat(onDutyPersonnel);

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
                option.textContent = person.name;
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
                const person = availablePersonnel.find(p => p.id === personnelId);
                return { role: role, personnelName: person ? person.name : 'Personnel inconnu' };
            }
        }
        return null;
    }

    // Sauvegarde les affectations de personnel depuis la modale
    function savePersonnelAssignments() {
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
                        personName: conflict.personnelName,
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

        saveAppData();
        console.log(`Personnel sauvegardé pour ${editingEngineType} dans le créneau ${slotId} le ${dateKey} :`, engineData.personnel);

        personnelAssignmentModal.style.display = 'none';
        displayEnginesForSlot(dateKey, slotId);
    }

    // --- Gestion de la vue ---

    // Affiche la grille principale de la feuille de garde
    function showMainRosterGrid() {
        engineDetailsPage.style.display = 'none';
        // Affiche la section de gestion du personnel et des agents d'astreinte
        document.querySelector('.personnel-management-section').style.display = 'flex';
        rosterGrid.style.display = 'grid'; // Ou 'block' selon son affichage par default
        // Supprime la classe active de tous les boutons de créneau horaire
        document.querySelectorAll('.time-slot-button').forEach(btn => btn.classList.remove('active'));
        loadRosterData(currentDisplayedDate); // Recharge/rafraîchit le contenu du placeholder de la grille principale
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

        // Ajuster les heures de fin si elles sont "le lendemain" (inférieures à l'heure de début)
        // La logique est que si end <= start, cela signifie que le créneau traverse minuit.
        if (end1 <= start1) {
            end1 += 24 * 60; // Ajouter 24 heures en minutes
        }
        if (end2 <= start2) {
            end2 += 24 * 60;
        }

        // Les plages se chevauchent si (Début1 < Fin2) ET (Fin1 > Début2)
        const overlaps = start1 < end2 && end1 > start2;
        // console.log(`Overlap check: R1(${range1.start}-${range1.end} normalized to ${start1}-${end1}) vs R2(${range2.start}-${range2.end} normalized to ${start2}-${end2}) -> Result: ${overlaps}`);
        return overlaps;
    }

    // Rend la liste du personnel disponible
    function renderAvailablePersonnel() {
        availablePersonnelList.innerHTML = ''; // Vide la liste existante
        const dateKey = formatDate(currentDisplayedDate);
        const onDutyAgents = appData[dateKey]?.onDutyAgents || []; // Assure que c'est un tableau

        // Récupérer les créneaux horaires de la feuille de garde pour le jour actuel
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
        // console.log(`Créneaux de la feuille de garde pour ${dateKey}:`, rosterTimeSlots);

        // Récupérer les disponibilités détaillées pour la date actuelle
        const personnelAvailabilitiesForDate = appData.personnelAvailabilities || {};
        // console.log(`Toutes les disponibilités du personnel (appData.personnelAvailabilities):`, personnelAvailabilitiesForDate);


        const personnelToShow = availablePersonnel.filter(person => {
            // Exclure l'option 'Non assigné'
            if (person.id === 'none') return false;

            // Exclure le personnel déjà d'astreinte
            if (onDutyAgents.includes(person.id)) {
                console.log(`Agent ${person.name} (${person.id}) : Déjà d'astreinte, exclu.`);
                return false;
            }

            // Vérifier les disponibilités de l'agent pour cette date
            const agentDailyAvailabilities = personnelAvailabilitiesForDate[person.id]?.[dateKey];
            
            // Nouveaux logs pour le débogage
            console.log(`--- Débogage de la disponibilité pour ${person.name} (${person.id}) ---`);
            console.log(`Clé de la date de la feuille de garde: ${dateKey}`);
            console.log(`Disponibilités brutes de l'agent pour ${dateKey}:`, agentDailyAvailabilities);
            console.log(`Créneaux horaires de la feuille de garde:`, rosterTimeSlots);
            console.log(`Est-il déjà d'astreinte?: ${onDutyAgents.includes(person.id)}`);
            console.log(`Est-ce un tableau de dispo et a-t-il une longueur?: ${Array.isArray(agentDailyAvailabilities) && agentDailyAvailabilities.length > 0}`);

            if (!Array.isArray(agentDailyAvailabilities) || agentDailyAvailabilities.length === 0) {
                console.log(`Agent ${person.name} (${person.id}) n'est pas disponible: Pas de disponibilités quotidiennes ou tableau vide.`);
                return false;
            }

            let isAvailableForRoster = false;
            for (const rosterSlot of rosterTimeSlots) {
                for (const agentAvailability of agentDailyAvailabilities) {
                    const overlaps = doTimeRangesOverlap(rosterSlot, agentAvailability);
                    console.log(`  Comparaison du créneau de la feuille de garde (${rosterSlot.start}-${rosterSlot.end}) avec la disponibilité de l'agent (${agentAvailability.start}-${agentAvailability.end}) -> Chevauchement: ${overlaps}`);
                    if (overlaps) {
                        isAvailableForRoster = true;
                        break; // Un seul chevauchement suffit pour marquer l'agent comme disponible
                    }
                }
                if (isAvailableForRoster) {
                    console.log(`Agent ${person.name} (${person.id}) EST disponible pour au moins un créneau de la feuille de garde.`);
                    break;
                }
            }
            console.log(`Disponibilité finale pour ${person.name} (${person.id}) pour la date de la feuille de garde ${dateKey}: ${isAvailableForRoster}`);
            return isAvailableForRoster;
        });

        const sortedPersonnel = sortPersonnelByGrade(personnelToShow);

        sortedPersonnel.forEach(person => {
            const personDiv = document.createElement('div');
            personDiv.classList.add('available-personnel-item', 'bg-white', 'p-2', 'rounded-md', 'shadow-sm', 'border', 'border-gray-200', 'hover:bg-gray-50', 'cursor-grab', 'text-gray-800', 'font-medium');
            personDiv.textContent = person.name;
            personDiv.dataset.personnelId = person.id;
            personDiv.draggable = true; // Rend l'élément draggable

            // Gestionnaire de début de glisser-déposer
            personDiv.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', person.id);
                e.target.classList.add('dragging', 'opacity-75', 'border-blue-500');
            });

            // Gestionnaire de fin de glisser-déposer (pour nettoyer la classe)
            personDiv.addEventListener('dragend', (e) => {
                e.target.classList.remove('dragging', 'opacity-75', 'border-blue-500');
            });

            availablePersonnelList.appendChild(personDiv);
        });

        if (sortedPersonnel.length === 0 && rosterTimeSlots.length > 0) {
            const noPersonnelMessage = document.createElement('p');
            noPersonnelMessage.classList.add('text-gray-500', 'text-center', 'py-4', 'px-2', 'text-sm');
            noPersonnelMessage.textContent = "Aucun agent disponible pendant les créneaux horaires de ce jour ou déjà d'astreinte.";
            availablePersonnelList.appendChild(noPersonnelMessage);
        }
    }

    // Rend la grille des agents d'astreinte
    function renderOnDutyAgentsGrid() {
        onDutyAgentsGrid.innerHTML = ''; // Vide la grille existante
        const dateKey = formatDate(currentDisplayedDate);
        // Assure que onDutyAgents est un tableau de 10 éléments, initialisé avec 'none' si nécessaire
        if (!appData[dateKey].onDutyAgents || appData[dateKey].onDutyAgents.length !== 10) {
            appData[dateKey].onDutyAgents = Array(10).fill('none');
            saveAppData(); // Sauvegarde l'initialisation si elle a eu lieu
        }
        const onDutyAgents = appData[dateKey].onDutyAgents;

        for (let i = 0; i < 10; i++) {
            const slotDiv = document.createElement('div');
            slotDiv.classList.add('on-duty-slot', 'bg-gray-100', 'p-3', 'rounded-md', 'border', 'border-dashed', 'border-gray-300', 'flex', 'items-center', 'justify-center', 'text-gray-500', 'relative', 'overflow-hidden');
            slotDiv.dataset.slotIndex = i;

            const assignedPersonId = onDutyAgents[i];
            const assignedPerson = availablePersonnel.find(p => p.id === assignedPersonId);

            if (assignedPerson && assignedPerson.id !== 'none') {
                slotDiv.classList.remove('bg-gray-100', 'border-dashed', 'text-gray-500');
                slotDiv.classList.add('filled', 'bg-blue-50', 'border-blue-300', 'text-blue-800', 'font-semibold', 'shadow-sm');
                slotDiv.textContent = assignedPerson.name;

                // Bouton de suppression pour les agents assignés
                const removeBtn = document.createElement('span');
                removeBtn.classList.add('remove-agent-btn', 'absolute', 'top-1', 'right-1', 'text-red-500', 'hover:text-red-700', 'font-bold', 'cursor-pointer', 'text-lg');
                removeBtn.innerHTML = '&times;';
                removeBtn.title = 'Retirer l\'agent';
                removeBtn.addEventListener('click', (e) => {
                    e.stopPropagation(); // Empêche le déclenchement du drop si le clic est sur le X
                    removeAgentFromOnDuty(i);
                });
                slotDiv.appendChild(removeBtn);

            } else {
                slotDiv.textContent = `Case ${i + 1}`; // Texte par default pour les cases vides
            }

            // Gestionnaires de glisser-déposer pour les cases
            slotDiv.addEventListener('dragover', (e) => {
                e.preventDefault(); // Permet le drop
                e.target.classList.add('drag-over', 'border-blue-500', 'bg-blue-100');
            });

            slotDiv.addEventListener('dragleave', (e) => {
                e.target.classList.remove('drag-over', 'border-blue-500', 'bg-blue-100');
            });

            slotDiv.addEventListener('drop', (e) => {
                e.preventDefault();
                e.target.classList.remove('drag-over', 'border-blue-500', 'bg-blue-100');

                const personnelId = e.dataTransfer.getData('text/plain');
                const targetSlotIndex = parseInt(e.target.dataset.slotIndex);

                // Vérifie si la case est déjà occupée
                if (onDutyAgents[targetSlotIndex] !== 'none') {
                    showAlertModal('Cette case est déjà occupée. Veuillez d\'abord retirer l\'agent existant.');
                    return;
                }

                // Vérifie si l'agent est déjà dans une autre case d'astreinte
                if (onDutyAgents.includes(personnelId)) {
                    showAlertModal('Cet agent est déjà dans le tableau des agents d\'astreinte.');
                    return;
                }

                assignAgentToOnDuty(personnelId, targetSlotIndex);
            });

            onDutyAgentsGrid.appendChild(slotDiv);
        }
    }

    // Assigne un agent à une case d'astreinte
    function assignAgentToOnDuty(personnelId, slotIndex) {
        const dateKey = formatDate(currentDisplayedDate);
        appData[dateKey].onDutyAgents[slotIndex] = personnelId;
        saveAppData();
        renderOnDutyAgentsGrid(); // Met à jour l'affichage de la grille
        renderAvailablePersonnel(); // Met à jour la liste du personnel disponible
        console.log(`Agent ${personnelId} assigné à la case ${slotIndex} pour le ${dateKey}.`);
    }

    // Retire un agent d'une case d'astreinte
    function removeAgentFromOnDuty(slotIndex) {
        const dateKey = formatDate(currentDisplayedDate);
        const agentIdToRemove = appData[dateKey].onDutyAgents[slotIndex];
        const agentName = availablePersonnel.find(p => p.id === agentIdToRemove)?.name || 'cet agent';

        showConfirmationModal(`Êtes-vous sûr de vouloir retirer ${agentName} de la case ${slotIndex + 1} ?`, (confirmed) => {
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
                saveAppData(); // Sauvegarde les modifications
                renderOnDutyAgentsGrid(); // Met à jour l'affichage de la grille
                renderAvailablePersonnel(); // Met à jour la liste du personnel disponible
                console.log(`Agent retiré de la case ${slotIndex} pour le ${dateKey}.`);

                // Rafraîchit l'affichage des engins si la page de détails est ouverte
                if (engineDetailsPage.style.display === 'block' && currentEditingEngineContext) {
                    displayEnginesForSlot(currentEditingEngineContext.dateKey, currentEditingEngineContext.slotId);
                } else {
                    showMainRosterGrid(); // Sinon, revient à la grille principale
                }
            }
        });
    }

    // --- Logique de génération automatique de la feuille de garde ---

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
                const finalGradeB = gradeBIndex === -1 ? Infinity : gradeBIndex; // Correction: 'BBindex' -> 'Bindex'

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
            .map(id => availablePersonnel.find(p => p.id === id))
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
                const availableCandidatesForThisRole = currentOnDutyPersonnel.filter(p =>
                    !personnelAssignedInThisEngine.has(p.id)
                );

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
    function generateAutomaticRoster(dateKey) {
        // S'assurer que la structure de données existe pour la date
        if (!appData[dateKey]) {
            appData[dateKey] = { timeSlots: {}, onDutyAgents: Array(10).fill('none') };
            initializeDefaultTimeSlotsForDate(dateKey); // S'assurer que les créneaux sont là
        }

        const currentDayTimeSlots = appData[dateKey].timeSlots;

        // Parcourir tous les créneaux horaires de la journée et assigner le personnel pour chacun
        for (const slotId in currentDayTimeSlots) {
            assignPersonnelToSlot(dateKey, slotId);
        }

        saveAppData(); // Sauvegarde toutes les modifications après la génération automatique
        // Rafraîchit l'affichage de la feuille de garde
        if (engineDetailsPage.style.display === 'block' && currentEditingEngineContext) {
            displayEnginesForSlot(currentEditingEngineContext.dateKey, currentEditingEngineContext.slotId);
        } else {
            showMainRosterGrid();
        }
        showAlertModal("La feuille de garde a été générée automatiquement !");
    }


    // --- Événements et initialisation globale ---

    // Bouton "Ajouter un créneau"
    addTimeSlotBtn.addEventListener('click', () => {
        showTimeRangePromptModal('07:00', '07:00', (newStart, newEnd) => {
            if (newStart && newEnd) {
                const dateKey = formatDate(currentDisplayedDate);
                const newSlotId = `slot_${newStart.replace(':', '')}_${newEnd.replace(':', '')}_${Date.now()}`;
                const newTimeRange = `${newStart} - ${newEnd}`;
                createTimeSlotButton(newSlotId, newTimeRange, true);
                displayEnginesForSlot(dateKey, newSlotId); // Affiche directement la page des engins pour ce nouveau créneau
                renderAvailablePersonnel(); // Importanrt : les créneaux affectent les disponibilités
            }
        });
    });

    // Bouton "Retour à la feuille de garde"
    backToRosterBtn.addEventListener('click', () => {
        showMainRosterGrid();
    });

    // Navigation par date
    rosterDateInput.addEventListener('change', (e) => {
        currentDisplayedDate = new Date(e.target.value);
        updateDateDisplay();
    });

    prevDayButton.addEventListener('click', () => {
        currentDisplayedDate.setDate(currentDisplayedDate.getDate() - 1);
        updateDateDisplay();
    });

    nextDayButton.addEventListener('click', () => {
        currentDisplayedDate.setDate(currentDisplayedDate.getDate() + 1);
        updateDateDisplay();
    });

    // Bouton "Générer automatiquement"
    refreshButton.addEventListener('click', () => {
        showConfirmationModal("Voulez-vous générer automatiquement la feuille de garde pour la journée ? Les postes vides seront remplis.", (confirmed) => {
            if (confirmed) {
                generateAutomaticRoster(formatDate(currentDisplayedDate));
            }
        });
    });

    // --- Initialisation au chargement de la page ---
    // Les disponibilités sont chargées via loadAllPersonnelAvailabilities() dans loadAppData()
    loadAppData(); // Charge les données existantes ou initialise appData
    createPersonnelAssignmentModal(); // Crée la modale une fois au chargement
    updateDateDisplay(); // Affiche la date et rend les éléments initiaux (créneaux, personnel, astreinte)
});