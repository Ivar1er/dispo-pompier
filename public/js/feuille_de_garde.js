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
    const refreshButton = document.getElementById('refresh-button');

    let currentDisplayedDate = new Date(); // Représente la date actuellement affichée
    let timeSlotCounter = 0; // Pour assurer des IDs uniques pour les nouveaux créneaux

    // Clé pour le stockage local (localStorage)
    const LOCAL_STORAGE_KEY = 'feuilleDeGardeData';

    // --- Stockage des données ---
    // Cet objet contiendra toutes nos données de feuille de garde, indexées par date (AAAA-MM-JJ).
    // Chaque date aura ses propres créneaux horaires et les engins/personnel qui leur sont associés.
    let appData = {};

    // Liste du personnel disponible avec leurs qualifications détaillées
    const availablePersonnel = [
        { id: '1', name: 'BRUNEAU Mathieu', qualifications: ['CA_FPT','CA_VSAV', 'COD0','EQ1_FPT', 'EQ2_FPT','EQ1_FDF1', 'EQ2_FDF1','EQ'] },
        { id: '2', name: 'VATINEL Sébastien', qualifications: ['CA_FDF2','CA_FPT','CA_VSAV','COD2','COD1', 'COD0','EQ1_FPT', 'EQ2_FPT','EQ1_FDF1', 'EQ2_FDF1','EQ'] },
        { id: '3', name: 'LE LANN Philippe', qualifications: ['CA_FPT','CA_VSAV','COD1', 'COD0','EQ1_FPT', 'EQ2_FPT','EQ1_FDF1', 'EQ2_FDF1','EQ'] },
        { id: '4', name: 'TULEU Kévin', qualifications: ['CA_FPT','CA_VSAV', 'COD0','EQ1_FPT', 'EQ2_FPT','EQ'] },
        { id: '5', name: 'GESBERT Jonathan', qualifications: ['CA_FDF2','CA_FPT','CA_VSAV','COD2','COD1', 'COD0','EQ1_FPT', 'EQ2_FPT','EQ1_FDF1', 'EQ2_FDF1','EQ'] },
        { id: '6', name: 'CORDEL Camilla', qualifications: ['CA_VSAV','COD1', 'COD0','EQ1_FPT', 'EQ2_FPT','EQ1_FDF1', 'EQ2_FDF1','EQ'] },
        { id: '7', name: 'BOUDET Sébastien', qualifications: ['CA_VSAV','COD2','COD1', 'COD0','EQ1_FPT', 'EQ2_FPT','EQ1_FDF1', 'EQ2_FDF1','EQ'] },
        { id: '8', name: 'BOULME Grégoire', qualifications: ['CA_VSAV', 'COD0','EQ1_FPT', 'EQ2_FPT','EQ1_FDF1', 'EQ2_FDF1','EQ'] },
        { id: '9', name: 'JUSTICE Quentin', qualifications: [ 'COD0','EQ1_FPT', 'EQ2_FPT','EQ1_FDF1', 'EQ2_FDF1','EQ'] },
        { id: '10', name: 'SCHAEFFER Caroline', qualifications: ['COD0','EQ1_FPT', 'EQ2_FPT','EQ1_FDF1', 'EQ2_FDF1','EQ'] },
        { id: '11', name: 'MARECHAL Nicolas', qualifications: ['COD1', 'COD0','EQ1_FPT', 'EQ2_FPT','EQ1_FDF1', 'EQ2_FDF1','EQ'] },
        { id: '12', name: 'NORMAND Stéphane', qualifications: ['COD2','COD1', 'COD0','EQ1_FPT', 'EQ2_FPT','EQ1_FDF1', 'EQ2_FDF1','EQ'] },
        { id: '13', name: 'VENIANT Mathis', qualifications: ['COD0','EQ1_FPT', 'EQ2_FPT','EQ1_FDF1', 'EQ2_FDF1','EQ'] },
        { id: '14', name: 'LOISEL Charlotte', qualifications: ['COD0','EQ1_FPT', 'EQ2_FPT','EQ'] },
        { id: '15', name: 'MAILLY Lucile', qualifications: ['EQ1_FPT', 'EQ2_FPT','EQ'] },
        { id: '16', name: 'SAVIGNY Victoria', qualifications: ['EQ1_FPT', 'EQ2_FPT','EQ1_FDF1', 'EQ2_FDF1','EQ'] },
        { id: '17', name: 'TINSEAU Clément', qualifications: ['EQ1_FPT', 'EQ2_FPT','EQ1_FDF1', 'EQ2_FDF1','EQ'] },
        { id: '18', name: 'BOULET Aurélie', qualifications: ['COD0','EQ1_FPT', 'EQ2_FPT','EQ'] },
        { id: '19', name: 'MARLIN Lilian', qualifications: ['EQ1_FPT', 'EQ2_FPT','EQ'] },
        { id: '20', name: 'CHARENTON Marilou', qualifications: ['COD0','EQ1_FPT', 'EQ2_FPT','EQ'] },
        { id: '21', name: 'HEREDIA Jules', qualifications: ['EQ'] },
        { id: 'none', name: 'Non assigné', qualifications: [] } // Option pour un emplacement vide
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
        personnelAssignmentModal.classList.add('personnel-assignment-modal');
        personnelAssignmentModal.innerHTML = `
            <div class="modal-content">
                <span class="close-button">&times;</span>
                <div class="personnel-modal-header">
                    <h3 id="modal-engine-name">Assigner le personnel à l'engin</h3>
                </div>
                <div class="personnel-modal-body">
                    </div>
                <div class="modal-actions">
                    <button class="save-personnel-btn">Enregistrer</button>
                    <button class="cancel-personnel-btn">Annuler</button>
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
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0'); // Les mois sont indexés de 0
        const dd = String(date.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }

    // Met à jour l'affichage de la date et re-rend les éléments associés
    function updateDateDisplay() {
        const dateKey = formatDate(currentDisplayedDate);
        rosterDateInput.value = dateKey;
        // S'assure que les données pour cette date existent, initialise si non
        if (!appData[dateKey]) {
            appData[dateKey] = {
                timeSlots: {} // Chaque date a son propre ensemble de créneaux horaires
            };
            initializeDefaultTimeSlotsForDate(dateKey);
        }
        // Toujours charger/rafraîchir les boutons de créneau horaire pour la date actuelle
        renderTimeSlotButtons(dateKey);
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
                    <h2>Feuille de garde du centre BEAUNE pour le ${formatDate(date)}</h2>
                    <p>Sélectionnez un créneau horaire ci-dessus pour voir les engins détaillés et assigner le personnel.</p>
                    
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
        const sortedSlotIds = Object.keys(currentSlots).sort((a, b) => {
            const rangeA = currentSlots[a].range.split(' - ')[0];
            const rangeB = currentSlots[b].range.split(' - ')[0];
            return rangeA.localeCompare(rangeB);
        });

        sortedSlotIds.forEach(slotId => {
            const slot = currentSlots[slotId];
            createTimeSlotButton(slotId, slot.range, false); // Aucun créneau n'est actif initialement
        });
    }

    // Crée un bouton de créneau horaire avec la capacité de suppression
    function createTimeSlotButton(slotId, initialTimeRange = '00:00 - 00:00', isActive = false) {
        const button = document.createElement('button');
        button.classList.add('time-slot-button');
        if (isActive) {
            button.classList.add('active');
        }
        button.dataset.slotId = slotId;
        button.textContent = initialTimeRange;

        // Bouton de suppression
        const deleteBtn = document.createElement('span');
        deleteBtn.classList.add('delete-time-slot-btn');
        deleteBtn.innerHTML = '&times;'; // Caractère 'x'
        deleteBtn.title = 'Supprimer le créneau';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Empêche le clic du bouton de créneau horaire lors de la suppression
            if (confirm(`Êtes-vous sûr de vouloir supprimer le créneau "${button.textContent.replace('×', '').trim()}" ?`)) {
                deleteTimeSlot(slotId, button);
            }
        });
        button.appendChild(deleteBtn);

        // Gestionnaire de clic pour afficher la page des engins
        button.addEventListener('click', () => {
            // Supprime la classe active de tous les boutons
            document.querySelectorAll('.time-slot-button').forEach(btn => btn.classList.remove('active'));
            // Ajoute la classe active au bouton cliqué
            button.classList.add('active');

            displayEnginesForSlot(formatDate(currentDisplayedDate), slotId);
        });

        // Double-clic pour modifier la plage horaire
        button.addEventListener('dblclick', () => {
            const currentText = button.textContent.replace('×', '').trim(); // Supprime 'x' pour le prompt
            const newTime = prompt('Modifier la plage horaire (ex: 08:00 - 12:00) :', currentText);
            if (newTime && newTime.trim() !== '') {
                button.textContent = newTime.trim();
                button.appendChild(deleteBtn); // Ré-ajoute le bouton de suppression après la mise à jour du texte
                // Met à jour les données dans appData
                const dateKey = formatDate(currentDisplayedDate);
                if (appData[dateKey] && appData[dateKey].timeSlots[slotId]) {
                    appData[dateKey].timeSlots[slotId].range = newTime.trim();
                    saveAppData(); // Sauvegarde les modifications
                }
            }
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
            // Initialise la structure des engins par défaut pour ce nouveau créneau
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
        engineDetailsPage.style.display = 'block'; // Affiche la page des détails de l'engin
        engineGrid.innerHTML = ''; // Efface les engins précédents

        const slotData = appData[dateKey]?.timeSlots[slotId];

        if (!slotData) {
            engineGrid.innerHTML = '<p>Aucune donnée pour ce créneau horaire. Veuillez l\'ajouter ou changer de date.</p>';
            return;
        }

        // Affiche les 5 types d'engins prédéfinis.
        // Pour chacun, vérifie s'il existe dans slotData.engines, sinon, crée un engin par défaut.
        ['FPT', 'CCF', 'VSAV', 'VTU', 'VPMA'].forEach(engineType => {
            const engineName = engineType; // Utilise le type comme nom générique pour l'instant
            let engineDetails = slotData.engines[engineName];

            // Si ce type d'engin n'est pas encore explicitement défini pour ce créneau, l'initialise
            if (!engineDetails) {
                engineDetails = createEmptyEngineAssignment(engineType);
                // Stocke ces données initialisées
                slotData.engines[engineName] = engineDetails;
            }

            const engineCase = document.createElement('div');
            engineCase.classList.add('engine-case');
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
                personnelListHTML += `<li>${role}: ${personnelName}</li>`;
            });

            engineCase.innerHTML = `
                <h3>${engineName} <span class="places-count">${roles.length} places</span></h3>
                <ul class="personnel-list">${personnelListHTML}</ul>
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

        roles.forEach(role => {
            const assignmentDiv = document.createElement('div');
            assignmentDiv.classList.add('post-assignment');
            assignmentDiv.innerHTML = `<label for="${role}-${engineType}-select">${role}:</label>`;

            const selectElement = document.createElement('select');
            selectElement.id = `${role}-${engineType}-select`;
            selectElement.dataset.role = role;

            // Ajoute l'option 'Non assigné' en premier
            const defaultOption = document.createElement('option');
            defaultOption.value = 'none';
            defaultOption.textContent = 'Non assigné';
            selectElement.appendChild(defaultOption);

            // Remplit le sélecteur avec le personnel disponible, filtré par qualification
            // Une personne est éligible si elle possède la qualification EXACTE du rôle, OU si c'est l'option 'Non assigné'.
            availablePersonnel.filter(p => p.qualifications.includes(role) || p.id === 'none').forEach(person => {
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

        // --- Vérification des doublons DANS L'ENGIN ACTUEL ---
        // On itère sur les NOUVELLES affectations que l'utilisateur propose pour CET ENGIN.
        for (const roleBeingAssigned in newAssignments) {
            const personnelId = newAssignments[roleBeingAssigned];
            
            // Si l'agent n'est pas "Non assigné", on vérifie s'il est déjà ailleurs DANS CET ENGIN
            if (personnelId !== 'none') {
                const conflict = isPersonnelAlreadyAssignedInEngine(
                    personnelId, 
                    newAssignments, // On passe l'objet des nouvelles affectations de l'engin
                    roleBeingAssigned // Le rôle actuel en cours d'affectation
                );

                if (conflict) {
                    hasConflict = true;
                    conflictDetails = {
                        personName: conflict.personnelName,
                        conflictingRole: conflict.role // Le rôle où le conflit existe dans le même engin
                    };
                    break; // Un seul conflit suffit pour annuler la sauvegarde
                }
            }
        }

        if (hasConflict) {
            const conflictPersonName = conflictDetails.personName;
            const conflictingRole = conflictDetails.conflictingRole;

            alert(`Conflit d'affectation pour l'engin ${editingEngineType} : ${conflictPersonName} est déjà assigné à la position "${conflictingRole}" dans cet engin. Veuillez le désassigner de cette position avant de le placer ailleurs dans le même engin.`);
            return; // Annule la sauvegarde
        }

        // Si aucune conflit, on applique les nouvelles affectations
        for (const role in newAssignments) {
            engineData.personnel[role] = newAssignments[role];
        }

        saveAppData(); // Sauvegarde toutes les données de l'application après les modifications
        console.log(`Personnel sauvegardé pour ${editingEngineType} dans le créneau ${slotId} le ${dateKey} :`, engineData.personnel);

        personnelAssignmentModal.style.display = 'none';
        // Réaffiche la page des engins pour refléter les modifications pour le créneau actuel
        displayEnginesForSlot(dateKey, slotId);
    }

    // --- Gestion de la vue ---

    // Affiche la grille principale de la feuille de garde
    function showMainRosterGrid() {
        engineDetailsPage.style.display = 'none';
        rosterGrid.style.display = 'grid'; // Ou 'block' selon son affichage par défaut
        // Supprime la classe active de tous les boutons de créneau horaire
        document.querySelectorAll('.time-slot-button').forEach(btn => btn.classList.remove('active'));
        loadRosterData(currentDisplayedDate); // Recharge/rafraîchit le contenu du placeholder de la grille principale
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

    // Bouton Actualiser
    refreshButton.addEventListener('click', () => {
        // Si la page des détails de l'engin est ouverte, la rafraîchit, sinon rafraîchit la grille principale
        if (engineDetailsPage.style.display === 'block') {
            const activeSlotButton = document.querySelector('.time-slot-button.active');
            if (activeSlotButton && currentEditingEngineContext) {
                // Rafraîchit la vue de l'engin actuel à partir des dernières données
                displayEnginesForSlot(currentEditingEngineContext.dateKey, currentEditingEngineContext.slotId);
            } else {
                showMainRosterGrid(); // Repli si aucun contexte de créneau actif
            }
        } else {
            showMainRosterGrid(); // Rafraîchit la grille principale
        }
    });

    // Bouton Ajouter un nouveau créneau horaire
    addTimeSlotBtn.addEventListener('click', () => {
        timeSlotCounter++;
        const newSlotId = `slot_${Date.now()}`; // ID unique utilisant le timestamp
        createTimeSlotButton(newSlotId, 'Nouveau créneau (Double-clic pour modifier)');
        // Pas d'activation automatique pour le nouveau créneau, l'utilisateur doit cliquer dessus.
        saveAppData(); // Sauvegarde la création du nouveau créneau
    });

    // --- Fonctions d'initialisation au chargement de la page ---

    // Fonction pour initialiser les créneaux horaires par défaut pour une date spécifique si elle est nouvelle
    function initializeDefaultTimeSlotsForDate(dateKey) {
        if (!appData[dateKey]) {
            appData[dateKey] = {
                timeSlots: {}
            };
        }

        // Ajoute les 6 créneaux initiaux si cette date n'a pas encore de créneaux
        if (Object.keys(appData[dateKey].timeSlots).length === 0) {
            const initialSlots = [
                { id: 'slot_0700_0700', range: '07:00 - 07:00' },
            ];

            initialSlots.forEach(slot => {
                appData[dateKey].timeSlots[slot.id] = {
                    range: slot.range,
                    engines: {}
                };
                // Initialise la structure des engins par défaut pour ces créneaux initiaux
                ['FPT', 'CCF', 'VSAV', 'VTU', 'VPMA'].forEach(engineType => {
                    appData[dateKey].timeSlots[slot.id].engines[engineType] = createEmptyEngineAssignment(engineType);
                });
            });
            saveAppData(); // Sauvegarde ces créneaux par défaut initiaux
        }
    }

    // --- Initialisation au chargement de la page ---

    loadAppData(); // Charge les données depuis localStorage en premier
    createPersonnelAssignmentModal(); // Crée la modale une seule fois

    // Définit la date initiale et affiche ses créneaux horaires et sa grille correspondante
    updateDateDisplay(); // Cela appellera loadRosterData et renderTimeSlotButtons
});