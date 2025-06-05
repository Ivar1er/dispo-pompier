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

    let currentDisplayedDate = new Date(); // Représente la date actuellement affichée
    let timeSlotCounter = 0; // Pour assurer des IDs uniques pour les nouveaux créneaux

    // Clé pour le stockage local (localStorage)
    const LOCAL_STORAGE_KEY = 'feuilleDeGardeData';

    // --- Stockage des données ---
    // Cet objet contiendra toutes nos données de feuille de garde, indexées par date (AAAA-MM-JJ).
    // Chaque date aura ses propres créneaux horaires et les engins/personnel qui leur sont associés.
    let appData = {};

    // Définition des priorités de grade pour l'affectation automatique
    const gradePriority = {
        'CATE': 1, // Chef d'Agrès Tout Engin (Adjudant, Adjudant-Chef) - priorité la plus élevée
        'CAUE': 2,  // Chef d'Agrès Un Engin (Sergent, Sergent-Chef)
        'CAP': 3, // Caporal
        'SAP': 4, // Sapeur (SAP 1 & 2) - priorité la plus basse
        'none': 99 // Pour l'option 'Non assigné'
    };

    // Définition des préférences de grade pour chaque rôle
    // L'ordre des grades dans chaque tableau indique la préférence (le premier est le plus préféré)
    const roleGradePreferences = {
        // Postes d'équipier à conducteur (privilégier les Sapeurs et Caporaux)
        'EQ': ['SAP','CAP', 'CAUE', 'CATE'],
        'COD0': ['CAP','SAP', 'CAUE', 'CATE'], // Conducteur VSAV
        'EQ1_FPT': ['CAP','SAP', 'CAUE', 'CATE'],
        'EQ2_FPT': ['SAP','CAP','CAUE', 'CATE'],
        'EQ1_FDF1': ['CAP','SAP', 'CAUE', 'CATE'],
        'EQ2_FDF1': ['SAP','CAP', 'CAUE', 'CATE'],

        // CA VSAV (privilégier les CAUE et CATE)
        'CA_VSAV': ['CAUE', 'CATE', 'CAP', 'SAP'], // Ajout de CAP et SAP pour le cas où il n'y a pas de CAUE/CATE

        // CA FPT (privilégier les CATE)
        'CA_FPT': ['CATE', 'CAUE', 'CAP', 'SAP'], // Ajout de CAUE, CAP, SAP pour le cas où il n'y a pas de CATE

        // Autres conducteurs
        'COD1': ['SAP','CAP', 'CAUE', 'CATE'], // Conducteur FPT
        'COD2': ['SAP','CAP', 'CAUE', 'CATE'], // Conducteur CCF

        // Autres CA (privilégier les CATE et CAUE)
        'CA_FDF2': ['CATE', 'CAUE', 'CAP', 'SAP'],
        'CA_VTU': ['CAUE', 'CATE', 'CAP','SAP'],
        'CA_VPMA': ['CAUE', 'CATE', 'CAP','SAP']
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

    // Liste du personnel disponible avec leurs qualifications et leur grade
    const availablePersonnel = [
        // CATE (Chef d'Agrès Tout Engin)
        { id: '1', name: 'BRUNEAU Mathieu', qualifications: ['CA_FPT','CA_VSAV','CA_VTU','CA_VPMA', 'COD0','EQ1_FPT', 'EQ2_FPT','EQ1_FDF1', 'EQ2_FDF1','EQ'], grade: 'CATE' },
        { id: '2', name: 'VATINEL Sébastien', qualifications: ['CA_FDF2','CA_FPT','CA_VSAV','CA_VTU','CA_VPMA','COD2','COD1', 'COD0','EQ1_FPT', 'EQ2_FPT','EQ1_FDF1', 'EQ2_FDF1','EQ'], grade: 'CATE' },
        { id: '3', name: 'LE LANN Philippe', qualifications: ['CA_FPT','CA_VSAV','CA_VTU','CA_VPMA','COD1', 'COD0','EQ1_FPT', 'EQ2_FPT','EQ1_FDF1', 'EQ2_FDF1','EQ'], grade: 'CATE' },
        { id: '4', name: 'TULEU Kévin', qualifications: ['CA_FPT','CA_VSAV','CA_VTU','CA_VPMA', 'COD0','EQ1_FPT', 'EQ2_FPT','EQ'], grade: 'CATE' },
        { id: '5', name: 'GESBERT Jonathan', qualifications: ['CA_FDF2','CA_FPT','CA_VSAV','CA_VTU','CA_VPMA','COD2','COD1', 'COD0','EQ1_FPT', 'EQ2_FPT','EQ1_FDF1', 'EQ2_FDF1','EQ'], grade: 'CATE' },
        
        // CAUE (Chef d'Agrès Un Engin)
        { id: '6', name: 'CORDEL Camilla', qualifications: ['CA_VSAV','CA_VTU','CA_VPMA','COD1', 'COD0','EQ1_FPT', 'EQ2_FPT','EQ1_FDF1', 'EQ2_FDF1','EQ'], grade: 'CAUE' },
        { id: '7', name: 'BOUDET Sébastien', qualifications: ['CA_VSAV','CA_VTU','CA_VPMA','COD2','COD1', 'COD0','EQ1_FPT', 'EQ2_FPT','EQ1_FDF1', 'EQ2_FDF1','EQ'], grade: 'CAUE' },
        { id: '8', name: 'BOULME Grégoire', qualifications: ['CA_VSAV','CA_VTU','CA_VPMA', 'COD0','EQ1_FPT', 'EQ2_FPT','EQ1_FDF1', 'EQ2_FDF1','EQ'], grade: 'CAUE' },
        
        // CAP (Caporal)
        { id: '11', name: 'MARECHAL Nicolas', qualifications: ['COD1', 'COD0','EQ1_FPT', 'EQ2_FPT','EQ1_FDF1', 'EQ2_FDF1','EQ'], grade: 'CAP' },
        { id: '12', name: 'NORMAND Stéphane', qualifications: ['COD2','COD1', 'COD0','EQ1_FPT', 'EQ2_FPT','EQ1_FDF1', 'EQ2_FDF1','EQ'], grade: 'CAP' },
        { id: '9', name: 'JUSTICE Quentin', qualifications: [ 'COD0','EQ1_FPT', 'EQ2_FPT','EQ1_FDF1', 'EQ2_FDF1','EQ'], grade: 'CAP' },
        { id: '10', name: 'SCHAEFFER Caroline', qualifications: ['COD0','EQ1_FPT', 'EQ2_FPT','EQ1_FDF1', 'EQ2_FDF1','EQ'], grade: 'CAP' },
        { id: '13', name: 'VENIANT Mathis', qualifications: ['COD0','EQ1_FPT', 'EQ2_FPT','EQ1_FDF1', 'EQ2_FDF1','EQ'], grade: 'CAP' },

        // SAP (Sapeur 1 & 2)
        { id: '14', name: 'LOISEL Charlotte', qualifications: ['COD0','EQ1_FPT', 'EQ2_FPT','EQ'], grade: 'SAP' },
        { id: '15', name: 'MAILLY Lucile', qualifications: ['EQ1_FPT', 'EQ2_FPT','EQ'], grade: 'SAP' },
        { id: '16', name: 'SAVIGNY Victoria', qualifications: ['EQ1_FPT', 'EQ2_FPT','EQ1_FDF1', 'EQ2_FDF1','EQ'], grade: 'SAP' },
        { id: '17', name: 'TINSEAU Clément', qualifications: ['EQ1_FPT', 'EQ2_FPT','EQ1_FDF1', 'EQ2_FDF1','EQ'], grade: 'SAP' },
        { id: '18', name: 'BOULET Aurélie', qualifications: ['COD0','EQ1_FPT', 'EQ2_FPT','EQ'], grade: 'SAP' },
        { id: '19', name: 'MARLIN Lilian', qualifications: ['EQ1_FPT', 'EQ2_FPT','EQ'], grade: 'SAP' },
        { id: '20', name: 'CHARENTON Marilou', qualifications: ['COD0','EQ1_FPT', 'EQ2_FPT','EQ'], grade: 'SAP' },
        { id: '21', name: 'HEREDIA Jules', qualifications: ['EQ'], grade: 'SAP' },
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
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(appData));
            console.log('Données sauvegardées dans localStorage.');
        } catch (e) {
            console.error('Erreur lors de la sauvegarde des données dans localStorage :', e);
        }
    }

    // Charge les données de l'application depuis le localStorage
    function loadAppData() {
        try {
            const storedData = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (storedData) {
                appData = JSON.parse(storedData);
                console.log('Données chargées depuis localStorage.');
            } else {
                appData = {}; // Initialise vide si aucune donnée trouvée
                // Initialise les créneaux par défaut pour la date actuelle si c'est la première exécution
                initializeDefaultTimeSlotsForDate(formatDate(currentDisplayedDate));
            }
        } catch (e) {
            console.error('Erreur lors du chargement des données depuis localStorage :', e);
            appData = {}; // Revient à vide si l'analyse échoue
            initializeDefaultTimeSlotsForDate(formatDate(currentDisplayedDate));
        }
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

    // Formater des minutes en chaîne "HH:MM"
    function formatMinutesToTime(totalMinutes) {
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
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
        // Trie les créneaux par leur plage horaire (tri de chaînes simple pour les plages horaires)
        // Correction : Pour un tri fiable, il faut parser les heures de début.
        const sortedSlotIds = Object.keys(currentSlots).sort((a, b) => {
            const timeA = parseTimeToMinutes(currentSlots[a].range.split(' - ')[0]);
            const timeB = parseTimeToMinutes(currentSlots[b].range.split('(')[0]); // Correction pour le tri des plages horaires
            return timeA - timeB;
        });

        sortedSlotIds.forEach(slotId => {
            const slot = currentSlots[slotId];
            createTimeSlotButton(slotId, slot.range, false); // Aucun créneau n'est actif initialement
        });
    }

    // Crée un bouton de créneau horaire avec la capacité de suppression
    function createTimeSlotButton(slotId, initialTimeRange = '00:00 - 00:00', isActive = false) {
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

        // Double-clic pour modifier la plage horaire
        button.addEventListener('dblclick', () => {
            const currentText = button.textContent.replace('×', '').trim(); // Supprime 'x' pour le prompt
            // Utilisation d'une modale de prompt personnalisée au lieu de prompt()
            showPromptModal('Modifier la plage horaire (ex: 08:00 - 12:00) :', currentText, (newTime) => {
                if (newTime && newTime.trim() !== '') {
                    const newTimeTrimmed = newTime.trim();
                    const timeParts = newTimeTrimmed.split(' - ');
                    
                    if (timeParts.length === 2 && timeParts[0].match(/^\d{2}:\d{2}$/) && timeParts[1].match(/^\d{2}:\d{2}$/)) {
                        button.textContent = newTimeTrimmed;
                        button.appendChild(deleteBtn); // Ré-ajoute le bouton de suppression après la mise à jour du texte
                        
                        const dateKey = formatDate(currentDisplayedDate);
                        if (appData[dateKey] && appData[dateKey].timeSlots[slotId]) {
                            appData[dateKey].timeSlots[slotId].range = newTimeTrimmed;
                            saveAppData(); // Sauvegarde les modifications

                            // --- Nouvelle logique d'ajout de créneau automatique ---
                            // S'applique si c'est le créneau initial 'slot_0700_0700' qui est modifié
                            // OU si c'est le dernier créneau actuellement affiché, pour assurer la continuité
                            const sortedSlotIds = Object.keys(appData[dateKey].timeSlots).sort((a, b) => {
                                const rangeA = appData[dateKey].timeSlots[a].range.split(' - ')[0];
                                const rangeB = appData[dateKey].timeSlots[b].range.split(' - ')[0];
                                return parseTimeToMinutes(rangeA) - parseTimeToMinutes(rangeB);
                            });
                            
                            const isLastSlot = sortedSlotIds[sortedSlotIds.length - 1] === slotId;

                            // On vérifie aussi si le créneau "07:00 - 07:00" est présent, car c'est le point de départ
                            // de la journée "feuille de garde".
                            // Si l'heure de fin du créneau modifié est AVANT 07:00 (par exemple 00:00-06:00),
                            // alors le suivant est bien 06:00-07:00.
                            // Si l'heure de fin du créneau modifié est APRÈS 07:00 (par exemple 07:00-12:00),
                            // alors le suivant est 12:00-07:00.
                            const nextSlotEndTime = '07:00'; // Toujours 07:00 comme fin du cycle de 24h

                            // Vérifie si un créneau avec cette plage existe déjà pour éviter les doublons
                            const newSlotRange = `${timeParts[1]} - ${nextSlotEndTime}`; // Utilise l'heure de fin du créneau modifié comme début du suivant
                            let exists = false;
                            for (const existingSlotId in appData[dateKey].timeSlots) {
                                if (appData[dateKey].timeSlots[existingSlotId].range === newSlotRange) {
                                    exists = true;
                                    break;
                                }
                            }

                            if (!exists) {
                                const newSlotId = `slot_${Date.now()}_auto`; // ID unique pour le créneau auto-généré
                                createTimeSlotButton(newSlotId, newSlotRange);
                                // Le nouveau créneau est automatiquement sauvegardé dans createTimeSlotButton
                                console.log(`Nouveau créneau ajouté automatiquement : ${newSlotRange}`);
                            } else {
                                console.log(`Un créneau similaire (${newSlotRange}) existe déjà. Pas de nouvel ajout.`);
                                // Si un créneau similaire existe, on peut vouloir le rendre actif ou faire quelque chose
                                // Par exemple, on pourrait trouver le bouton correspondant et le rendre actif
                                const existingButton = document.querySelector(`[data-slot-id="${existingSlotId}"]`);
                                if (existingButton) {
                                    document.querySelectorAll('.time-slot-button').forEach(btn => btn.classList.remove('active'));
                                    existingButton.classList.add('active');
                                    displayEnginesForSlot(formatDate(currentDisplayedDate), existingSlotId);
                                }
                            }
                            // Après avoir potentiellement ajouté un créneau, rafraîchir l'affichage des boutons
                            renderTimeSlotButtons(dateKey);
                        }
                    } else {
                        // Utilisation d'une modale d'alerte personnalisée au lieu de alert()
                        showAlertModal('Format de plage horaire invalide. Utilisez "HH:MM - HH:MM".');
                    }
                }
            });
        });

        // Insère le nouveau bouton avant le bouton '+'
        timeSlotButtonsContainer.insertBefore(button, addTimeSlotBtn);

        // Ajoute à notre structure de données interne pour la date actuelle si c'est un nouveau créneau
        const dateKey = formatDate(currentDisplayedDate);
        if (!appData[dateKey].timeSlots[slotId]) {
            appData[dateKey].timeSlots[slotId] = {
                range: initialTimeRange,
                engines: {} // Commence sans aucun engin assigné
            };
            // Initialise la structure des engins par default pour ce nouveau créneau
            ['FPT', 'CCF', 'VSAV', 'VTU', 'VPMA'].forEach(engineType => {
                appData[dateKey].timeSlots[slotId].engines[engineType] = createEmptyEngineAssignment(engineType);
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
            console.log(`Le créneau horaire ${slotId} a été supprimé pour la date ${dateKey}.`);
        }
    }

    // Fonction pour afficher les engins spécifiques et leur personnel affecté pour un créneau horaire sélectionné
    function displayEnginesForSlot(dateKey, slotId) {
        rosterGrid.style.display = 'none'; // Cache la grille principale
        // Cache la section de gestion du personnel et des agents d'astreinte quand on est sur les détails d'engin
        document.querySelector('.personnel-management-section').style.display = 'none'; 
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

            // Si ce type d'engin n'est pas encore explicitement défini pour ce créneau, l'initialise
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
            .filter(p => p !== undefined); // Filtre les IDs 'none' ou non trouvés

        roles.forEach(role => {
            const assignmentDiv = document.createElement('div');
            assignmentDiv.classList.add('post-assignment', 'flex', 'flex-col', 'space-y-1');
            assignmentDiv.innerHTML = `<label for="${role}-${engineType}-select" class="text-sm font-medium text-gray-700">${role}:</label>`;

            const selectElement = document.createElement('select');
            selectElement.id = `${role}-${engineType}-select`;
            selectElement.dataset.role = role;
            selectElement.classList.add('mt-1', 'block', 'w-full', 'pl-3', 'pr-10', 'py-2', 'text-base', 'border-gray-300', 'focus:outline-none', 'focus:ring-blue-500', 'focus:border-blue-500', 'sm:text-sm', 'rounded-md', 'shadow-sm');


            // Ajoute l'option 'Non assigné' en premier
            const defaultOption = document.createElement('option');
            defaultOption.value = 'none';
            defaultOption.textContent = 'Non assigné';
            selectElement.appendChild(defaultOption);

            // Remplit le sélecteur avec le personnel d'astreinte éligible pour ce rôle
            onDutyPersonnel.filter(p => p.qualifications.includes(role) || p.id === 'none').forEach(person => {
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
     * @param {object} newAssignments - L'objet des nouvelles affectations proposées pour l'engin actuel.
     * @param {string} currentRole - Le rôle actuellement en cours d'affectation dans la modale.
     * @returns {object|null} Un objet { role, personnelName } si un doublon est trouvé dans l'engin, sinon null.
     */
    function isPersonnelAlreadyAssignedInEngine(personnelId, newAssignments, currentRole) {
        if (personnelId === 'none') {
            return null; // 'Non assigné' ne cause pas de doublon
        }

        // Cette fonction est maintenue pour la vérification des doublons *au sein du même engin*.
        // Elle empêche un utilisateur d'affecter la même personne à deux postes différents sur le même FPT, par exemple.
        for (const roleInEngine in newAssignments) {
            if (newAssignments.hasOwnProperty(roleInEngine)) {
                // Si le personnel est trouvé dans une AUTRE position de CET ENGIN
                if (newAssignments[roleInEngine] === personnelId && roleInEngine !== currentRole) {
                    const personName = availablePersonnel.find(p => p.id === personnelId)?.name || 'Inconnu';
                    return { role: roleInEngine, personnelName: personName };
                }
            }
        }
        return null; // Aucun doublon trouvé dans cet engin
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
                        conflictingRole: conflict.role 
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
    function createModal(id, title, message, type, callback) {
        let modal = document.getElementById(id);
        if (!modal) {
            modal = document.createElement('div');
            modal.id = id;
            modal.classList.add('custom-modal', 'fixed', 'inset-0', 'bg-gray-600', 'bg-opacity-50', 'flex', 'items-center', 'justify-center', 'z-50', 'hidden');
            document.body.appendChild(modal);
        }
        modal.innerHTML = `
            <div class="modal-content bg-white p-6 rounded-lg shadow-xl max-w-sm w-full mx-4 text-center">
                <h3 class="text-xl font-semibold text-gray-800 mb-3">${title}</h3>
                <p class="text-gray-700 mb-4">${message}</p>
                ${type === 'prompt' ? '<input type="text" id="prompt-input" class="modal-input mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm">' : ''}
                <div class="modal-actions flex justify-center space-x-3 pt-4">
                    ${type === 'confirm' || type === 'prompt' ? '<button class="modal-cancel-btn bg-gray-300 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-400 transition duration-200 ease-in-out shadow-md">Annuler</button>' : ''}
                    <button class="modal-ok-btn bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition duration-200 ease-in-out shadow-md">OK</button>
                </div>
            </div>
        `;
        modal.style.display = 'flex';

        const okBtn = modal.querySelector('.modal-ok-btn');
        const cancelBtn = modal.querySelector('.modal-cancel-btn');
        const promptInput = modal.querySelector('#prompt-input');

        okBtn.onclick = () => {
            modal.style.display = 'none';
            if (callback) {
                if (type === 'prompt') {
                    callback(promptInput.value);
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
                } else if (callback && type === 'prompt') {
                    callback(null); // Return null if prompt is cancelled
                }
            };
        }

        if (promptInput) {
            promptInput.value = message.split(':')[1]?.trim() || ''; // Pre-fill for prompt
            promptInput.focus();
        }
    }

    function showAlertModal(message) {
        createModal('alert-modal', 'Information', message, 'alert');
    }

    function showConfirmationModal(message, callback) {
        createModal('confirm-modal', 'Confirmation', message, 'confirm', callback);
    }

    function showPromptModal(message, defaultValue, callback) {
        createModal('prompt-modal', 'Saisie requise', message, 'prompt', callback);
        document.getElementById('prompt-input').value = defaultValue;
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

    // Rend la liste du personnel disponible
    function renderAvailablePersonnel() {
        availablePersonnelList.innerHTML = ''; // Vide la liste existante
        const dateKey = formatDate(currentDisplayedDate);
        const onDutyAgents = appData[dateKey].onDutyAgents || []; // Assure que c'est un tableau

        // Filtre le personnel disponible qui n'est PAS déjà dans le tableau des agents d'astreinte
        const personnelNotOnDuty = availablePersonnel.filter(p => 
            p.id !== 'none' && !onDutyAgents.includes(p.id)
        );
        
        const sortedPersonnel = sortPersonnelByGrade(personnelNotOnDuty);

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
            .map(id => availablePersonnel.find(p => p.id === id))
            .filter(p => p !== undefined);

        // Collecte tous les rôles vides pour tous les engins de ce créneau
        let emptyRolesToFillGlobally = [];
        ['FPT', 'CCF', 'VSAV', 'VTU', 'VPMA'].forEach(engineType => {
            const engineAssignment = slotData.engines[engineType];
            const roles = engineRoles[engineType] || [];

            roles.forEach(role => {
                if (engineAssignment.personnel[role] === 'none') {
                    emptyRolesToFillGlobally.push({
                        engineType: engineType,
                        role: role,
                        roleTypePriority: roleTypePriority[getRoleType(role)] || Infinity
                    });
                }
            });
        });

        // Trie les rôles vides globalement:
        // 1. Par le nombre de candidats qualifiés (moins de candidats = plus prioritaire) - calculé à chaque fois
        // 2. Puis par la priorité du type de rôle (CA > COD > EQ)
        emptyRolesToFillGlobally.sort((a, b) => {
            // Calculer le nombre de candidats qualifiés au moment du tri pour la pertinence
            const qualifiedCountA = getQualifiedPersonnelForRole(a.role, currentOnDutyPersonnel).length;
            const qualifiedCountB = getQualifiedPersonnelForRole(b.role, currentOnDutyPersonnel).length;

            if (qualifiedCountA !== qualifiedCountB) {
                return qualifiedCountA - qualifiedCountB;
            }
            return a.roleTypePriority - b.roleTypePriority;
        });

        // Maintenant, assigner le personnel en parcourant les rôles triés
        // et en s'assurant qu'un agent n'occupe qu'un poste par engin.
        // On va réitérer sur les engins pour s'assurer de la contrainte "un agent par engin".
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

            // Filtrer les rôles vides qui appartiennent à CET ENGIN et les trier par priorité de rôle
            let emptyRolesForCurrentEngine = emptyRolesToFillGlobally.filter(roleInfo => 
                roleInfo.engineType === engineType && engineAssignment.personnel[roleInfo.role] === 'none'
            ).sort((a, b) => a.roleTypePriority - b.roleTypePriority); // Tri par type de rôle pour les postes de cet engin

            emptyRolesForCurrentEngine.forEach(roleInfo => {
                const role = roleInfo.role;

                // Si le poste a été rempli manuellement ou par une affectation précédente, on passe
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
            initializeDefaultTimeSlotsForDate(dateKey); // Initialiser les créneaux par default si aucun n'existe
        }

        const currentSlots = appData[dateKey].timeSlots;

        // Trier les créneaux pour garantir un ordre de traitement cohérent (par heure de début)
        const sortedSlotIds = Object.keys(currentSlots).sort((a, b) => {
            const timeA = parseTimeToMinutes(currentSlots[a].range.split(' - ')[0]);
            const timeB = parseTimeToMinutes(currentSlots[b].range.split(' - ')[0]);
            return timeA - timeB;
        });

        // Pour chaque créneau horaire, assigner le personnel
        sortedSlotIds.forEach(slotId => {
            assignPersonnelToSlot(dateKey, slotId);
        });

        saveAppData(); // Sauvegarder toutes les modifications
        console.log('Feuille de garde générée automatiquement pour le', dateKey);

        // Après la génération, afficher le premier créneau horaire ou la grille principale
        if (sortedSlotIds.length > 0) {
            // Trouver le créneau actif, ou par default le premier
            const activeSlotButton = document.querySelector('.time-slot-button.active');
            let slotToDisplay = sortedSlotIds[0]; // Par default, le premier créneau

            if (activeSlotButton) {
                slotToDisplay = activeSlotButton.dataset.slotId;
            }

            displayEnginesForSlot(dateKey, slotToDisplay);
            // S'assurer que le bon bouton est actif après la régénération
            document.querySelectorAll('.time-slot-button').forEach(btn => btn.classList.remove('active'));
            const newActiveButton = document.querySelector(`[data-slot-id="${slotToDisplay}"]`);
            if (newActiveButton) {
                newActiveButton.classList.add('active');
            }

        } else {
            showMainRosterGrid();
        }
    }


    // --- Écouteurs d'événements ---

    // Sélecteur de date
    rosterDateInput.addEventListener('change', (event) => {
        currentDisplayedDate = new Date(event.target.value);
        updateDateDisplay(); // Cela re-rendra également les boutons et affichera la grille principale
    });

    // Boutons de navigation (jour précédent/suivant)
    prevDayButton.addEventListener('click', () => {
        currentDisplayedDate.setDate(currentDisplayedDate.getDate() - 1);
        updateDateDisplay();
    });

    nextDayButton.addEventListener('click', () => {
        currentDisplayedDate.setDate(currentDisplayedDate.getDate() + 1);
        updateDateDisplay();
    });

    // Bouton "Générer auto" (anciennement "Actualiser")
    // Renommer le bouton dans le DOM
    refreshButton.textContent = 'Générer auto';
    refreshButton.classList.add('px-4', 'py-2', 'bg-green-600', 'text-white', 'rounded-md', 'hover:bg-green-700', 'transition', 'duration-200', 'ease-in-out', 'shadow-md');
    refreshButton.addEventListener('click', () => {
        generateAutomaticRoster(formatDate(currentDisplayedDate));
    });

    // Bouton Ajouter un nouveau créneau horaire
    addTimeSlotBtn.classList.add('px-4', 'py-2', 'bg-gray-200', 'text-gray-800', 'rounded-md', 'hover:bg-gray-300', 'transition', 'duration-200', 'ease-in-out', 'shadow-sm');
    addTimeSlotBtn.addEventListener('click', () => {
        timeSlotCounter++;
        const newSlotId = `slot_${Date.now()}`; // ID unique basé sur le timestamp
        createTimeSlotButton(newSlotId, '00:00 - 00:00', true); // Créer un nouveau bouton actif
        displayEnginesForSlot(formatDate(currentDisplayedDate), newSlotId); // Afficher directement les engins pour ce nouveau créneau
    });

    // Nouveau bouton de retour à la feuille de garde principale
    backToRosterBtn.classList.add('px-4', 'py-2', 'bg-gray-500', 'text-white', 'rounded-md', 'hover:bg-gray-600', 'transition', 'duration-200', 'ease-in-out', 'shadow-md', 'inline-flex', 'items-center', 'space-x-2');
    backToRosterBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H16a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd" />
        </svg>
        <span>Retour à la feuille de garde</span>
    `;
    backToRosterBtn.addEventListener('click', () => {
        showMainRosterGrid();
    });

    // Fonction pour initialiser les créneaux horaires par default pour une nouvelle date
    function initializeDefaultTimeSlotsForDate(dateKey) {
        if (!appData[dateKey] || Object.keys(appData[dateKey].timeSlots).length === 0) {
            console.log(`Initialisation des créneaux par défaut pour la date ${dateKey}.`);
            appData[dateKey] = {
                timeSlots: {},
                onDutyAgents: Array(10).fill('none') // Assure l'initialisation des agents d'astreinte
            };
            // Créneaux horaires par default
            createTimeSlotButton('slot_0700_0700', '07:00 - 07:00'); // Créneau initial pour la journée
            saveAppData();
        }
    }

    // --- Initialisation de l'application ---
    createPersonnelAssignmentModal(); // Crée la modale une fois au chargement
    loadAppData(); // Charge les données au démarrage
    updateDateDisplay(); // Affiche la date actuelle et charge les créneaux
});