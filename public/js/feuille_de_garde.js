document.addEventListener('DOMContentLoaded', () => {
    // --- Éléments du DOM ---
    const loadingSpinner = document.getElementById('loading-spinner');
    const rosterDateInput = document.getElementById('roster-date');
    const prevDayButton = document.getElementById('prev-day-button');
    const nextDayButton = document.getElementById('next-day-button');
    const generateAutoButton = document.getElementById('generate-auto-button');
    const logoutButton = document.getElementById('logout-button');
    const addSlotButton = document.getElementById('add-slot-button'); // Bouton pour ajouter un créneau au roster journalier

    // Section "Personnel Disponible"
    const availablePersonnelList = document.getElementById('available-personnel-list');
    const noAvailablePersonnelMessage = document.getElementById('no-available-personnel-message');

    // Section "Agents d'astreinte"
    const onCallAgentsGrid = document.getElementById('on-call-agents-grid');
    const noOnCallAgentsMessage = document.getElementById('no-on-call-agents-message');

    // Section "Planification des Créneaux Journaliers"
    const timeSlotsContainer = document.getElementById('time-slots-container');
    const noDailyTimeslotMessage = document.getElementById('no-daily-timeslot-message');

    // Section "Synthèse des engins"
    const enginsSynthesisContent = document.getElementById('engins-synthesis-content');

    // Modale
    const customMessageModal = document.getElementById('custom-message-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalMessage = document.getElementById('modal-message');
    const modalOkBtn = document.getElementById('modal-ok-btn');
    const modalCancelBtn = document.getElementById('modal-cancel-btn');

    // --- Variables d'état ---
    let currentDate = new Date(); // Date de la feuille de garde affichée

    // Données simulées pour tous les agents du centre avec leur disponibilité
    // Dans une application réelle, ceci viendrait d'une base de données
    let allCenterPersonnel = [
        { id: 'agent-A', name: 'Alain Dubois', availability: [{ day: 24, month: 6, year: 2025, slots: ['08:00-12:00', '14:00-18:00'] }, { day: 25, month: 6, year: 2025, slots: ['09:00-13:00'] }] },
        { id: 'agent-B', name: 'Béatrice Roy', availability: [{ day: 24, month: 6, year: 2025, slots: ['10:00-16:00'] }] },
        { id: 'agent-C', name: 'Charles Blanc', availability: [{ day: 24, month: 6, year: 2025, slots: ['08:00-12:00'] }] },
        { id: 'agent-D', name: 'Delphine Fort', availability: [] }, // Non disponible ce jour
        { id: 'agent-E', name: 'Émile Leroux', availability: [{ day: 24, month: 6, year: 2025, slots: ['13:00-17:00'] }] },
        { id: 'agent-F', name: 'Fanny Vidal', availability: [{ day: 25, month: 6, year: 2025, slots: ['08:00-12:00'] }] },
    ];

    // Agents disponibles pour la date actuelle (filtré de allCenterPersonnel)
    let availablePersonnel = [];

    // Agents sélectionnés pour l'astreinte pour la journée (via glisser-déposer)
    let onCallAgents = [];

    // Créneaux horaires et agents assignés pour le roster journalier
    let dailyRosterSlots = [];

    // --- Fonctions utilitaires ---

    // Affiche ou masque le loader
    const toggleLoader = (show) => {
        if (show) {
            loadingSpinner.classList.remove('hidden');
        } else {
            loadingSpinner.classList.add('hidden');
        }
    };

    // Formate une date en YYYY-MM-DD
    const formatDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // Affiche la modale de message
    const showModal = (title, message, isConfirm = false) => {
        modalTitle.textContent = title;
        modalMessage.textContent = message;
        if (isConfirm) {
            modalCancelBtn.style.display = 'inline-block';
        } else {
            modalCancelBtn.style.display = 'none';
        }
        customMessageModal.style.display = 'flex';
        return new Promise((resolve) => {
            modalOkBtn.onclick = () => {
                customMessageModal.style.display = 'none';
                resolve(true);
            };
            modalCancelBtn.onclick = () => {
                customMessageModal.style.display = 'none';
                resolve(false);
            };
        });
    };

    // --- Initialisation et rendu ---

    // Met à jour l'input de date et charge les données
    const updateDateAndLoadData = async () => {
        rosterDateInput.value = formatDate(currentDate);
        toggleLoader(true);
        await simulateDataFetch(); // Simule un appel API pour récupérer les données de la journée
        filterAvailablePersonnel(); // Filtre les agents disponibles pour le jour
        renderAvailablePersonnel();
        renderOnCallAgents(); // Assure que les agents d'astreinte sont affichés
        renderDailyRosterSlots(); // Affiche les créneaux journaliers
        updateEnginsSynthesis();
        toggleLoader(false);
    };

    // Simule la récupération de données (remplacer par de vrais appels API)
    const simulateDataFetch = () => {
        return new Promise(resolve => {
            setTimeout(() => {
                // Dans une vraie application, tu chargerais onCallAgents et dailyRosterSlots
                // pour la currentDate depuis ta base de données.
                // Pour l'exemple, nous allons les réinitialiser ou charger des données factices.
                // onCallAgents = []; // Réinitialiser pour chaque jour pour cet exemple
                // dailyRosterSlots = []; // Réinitialiser pour chaque jour pour cet exemple
                // Ou charger des données de test
                if (formatDate(currentDate) === '2025-06-24') {
                     onCallAgents = [{ id: 'agent-A', name: 'Alain Dubois' }, { id: 'agent-C', name: 'Charles Blanc' }];
                     dailyRosterSlots = [
                         { id: 'slot-1', startTime: '08:00', endTime: '12:00', assignedAgents: [{ id: 'agent-A', name: 'Alain Dubois' }] },
                         { id: 'slot-2', startTime: '12:00', endTime: '16:00', assignedAgents: [] }
                     ];
                } else {
                     onCallAgents = [];
                     dailyRosterSlots = [];
                }
                resolve();
            }, 500); // Délai de 0.5 seconde pour simuler le chargement
        });
    };

    // Filtre le personnel disponible pour la journée sélectionnée
    const filterAvailablePersonnel = () => {
        const currentDay = currentDate.getDate();
        const currentMonth = currentDate.getMonth() + 1;
        const currentYear = currentDate.getFullYear();

        availablePersonnel = allCenterPersonnel.filter(agent =>
            agent.availability.some(avail =>
                avail.day === currentDay &&
                avail.month === currentMonth &&
                avail.year === currentYear
            )
        );
    };

    // Rend les agents dans la section "Personnel Disponible" (sources de drag)
    const renderAvailablePersonnel = () => {
        availablePersonnelList.innerHTML = '';
        if (availablePersonnel.length === 0) {
            noAvailablePersonnelMessage.style.display = 'block';
        } else {
            noAvailablePersonnelMessage.style.display = 'none';
            availablePersonnel.forEach(agent => {
                const agentCard = document.createElement('div');
                agentCard.className = 'agent-card';
                agentCard.textContent = agent.name;
                agentCard.draggable = true;
                agentCard.dataset.agentId = agent.id;
                agentCard.dataset.agentName = agent.name;

                // Configure le dragstart pour les agents disponibles
                agentCard.addEventListener('dragstart', (e) => {
                    e.dataTransfer.setData('text/plain', JSON.stringify({ id: agent.id, name: agent.name }));
                    e.dataTransfer.effectAllowed = 'copy'; // Peut être copié vers la zone d'astreinte
                });
                availablePersonnelList.appendChild(agentCard);
            });
        }
    };

    // Rend les agents dans la section "Agents d'astreinte" (cible de drop et draggable)
    const renderOnCallAgents = () => {
        onCallAgentsGrid.innerHTML = '';
        if (onCallAgents.length === 0) {
            noOnCallAgentsMessage.style.display = 'block';
        } else {
            noOnCallAgentsMessage.style.display = 'none';
            onCallAgents.forEach(agent => {
                const agentCard = document.createElement('div');
                agentCard.className = 'agent-card';
                agentCard.dataset.agentId = agent.id;
                agentCard.dataset.agentName = agent.name;
                agentCard.draggable = true; // Ces agents peuvent être glissés vers les créneaux journaliers

                agentCard.innerHTML = `
                    <span>${agent.name}</span>
                    <button class="remove-on-call-agent-tag" data-agent-id="${agent.id}" aria-label="Supprimer cet agent de la liste d'astreinte">x</button>
                `;

                // Configure le dragstart pour les agents d'astreinte (vers les créneaux journaliers)
                agentCard.addEventListener('dragstart', (e) => {
                    e.dataTransfer.setData('text/plain', JSON.stringify({ id: agent.id, name: agent.name }));
                    e.dataTransfer.effectAllowed = 'move'; // Peut être déplacé vers un créneau
                });

                // Écouteur pour le bouton de suppression de l'agent d'astreinte
                agentCard.querySelector('.remove-on-call-agent-tag').addEventListener('click', (e) => {
                    const agentIdToRemove = e.target.dataset.agentId;
                    removeAgentFromOnCallList(agentIdToRemove);
                });

                onCallAgentsGrid.appendChild(agentCard);
            });
        }
        // Configure la zone de dépôt pour les agents d'astreinte
        setupOnCallDropZone(onCallAgentsGrid);
    };

    // Rend les créneaux horaires journaliers
    const renderDailyRosterSlots = () => {
        timeSlotsContainer.innerHTML = '';
        if (dailyRosterSlots.length === 0) {
            noDailyTimeslotMessage.style.display = 'block';
        } else {
            noDailyTimeslotMessage.style.display = 'none';
            dailyRosterSlots.sort((a, b) => a.startTime.localeCompare(b.startTime));
            dailyRosterSlots.forEach(slot => {
                const slotElement = createTimeSlotElement(slot);
                timeSlotsContainer.appendChild(slotElement);
            });
        }
    };

    // Crée un élément HTML pour un créneau horaire journalier
    const createTimeSlotElement = (slot) => {
        const div = document.createElement('div');
        div.className = 'time-slot';
        div.dataset.slotId = slot.id;

        div.innerHTML = `
            <input type="time" class="time-input start-time" value="${slot.startTime}">
            <span>-</span>
            <input type="time" class="time-input end-time" value="${slot.endTime}">
            <div class="assigned-agents-for-slot" data-slot-id="${slot.id}">
                ${slot.assignedAgents.map(agent => `
                    <span class="assigned-agent-tag" data-agent-id="${agent.id}">
                        ${agent.name}
                        <button class="remove-assigned-agent-tag" data-agent-id="${agent.id}" aria-label="Retirer l'agent du créneau">x</button>
                    </span>
                `).join('')}
            </div>
            <button class="remove-slot-button" aria-label="Supprimer ce créneau">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trash"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
            </button>
        `;

        const startTimeInput = div.querySelector('.start-time');
        const endTimeInput = div.querySelector('.end-time');

        // Capture la valeur initiale de l'heure de fin pour la logique de création de nouveau créneau
        let initialEndTime = slot.endTime;

        startTimeInput.addEventListener('change', (e) => updateSlotTime(slot.id, 'startTime', e.target.value));
        endTimeInput.addEventListener('change', (e) => {
            const newEndTime = e.target.value;
            updateSlotTime(slot.id, 'endTime', newEndTime);
            // Logique pour créer un nouveau créneau automatiquement
            if (initialEndTime === '07:00' && newEndTime === '15:00') {
                createConsecutiveSlot(newEndTime);
            }
            initialEndTime = newEndTime; // Mettre à jour pour la prochaine modification
        });

        div.querySelector('.remove-slot-button').addEventListener('click', () => removeDailyRosterSlot(slot.id));

        div.querySelectorAll('.remove-assigned-agent-tag').forEach(button => {
            button.addEventListener('click', (e) => {
                const agentIdToRemove = e.target.dataset.agentId;
                removeAgentFromDailyRosterSlot(slot.id, agentIdToRemove);
            });
        });

        // Configure la zone de dépôt pour les agents dans ce créneau
        const dropZone = div.querySelector('.assigned-agents-for-slot');
        setupDailyRosterSlotDropZone(dropZone);

        return div;
    };

    // Met à jour la synthèse des engins (simplifiée)
    const updateEnginsSynthesis = () => {
        enginsSynthesisContent.innerHTML = '';
        if (dailyRosterSlots.length === 0) {
            enginsSynthesisContent.innerHTML = '<p class="no-data-message">Aucune synthèse disponible pour le moment. Ajoutez des créneaux et des engins.</p>';
            return;
        }

        dailyRosterSlots.forEach(slot => {
            const synthesisSlotDiv = document.createElement('div');
            synthesisSlotDiv.className = 'synthesis-time-slot';
            synthesisSlotDiv.innerHTML = `<h3>${slot.startTime} - ${slot.endTime}</h3>`;

            if (slot.assignedAgents.length === 0) {
                synthesisSlotDiv.innerHTML += `
                    <div class="synthesis-engine-item">
                        <strong>Personnel requis (ex: 1 Agent)</strong>
                        <span class="unassigned">Non affecté</span>
                    </div>
                `;
            } else {
                slot.assignedAgents.forEach(agent => {
                    synthesisSlotDiv.innerHTML += `
                        <div class="synthesis-engine-item">
                            <strong>Agent assigné</strong>
                            <span class="assigned">${agent.name}</span>
                        </div>
                    `;
                });
            }
            // Ajoutez ici la logique pour afficher les engins réels si tu en as
            enginsSynthesisContent.appendChild(synthesisSlotDiv);
        });
    };


    // --- Logique des événements ---

    // Navigation de date
    prevDayButton.addEventListener('click', () => {
        currentDate.setDate(currentDate.getDate() - 1);
        updateDateAndLoadData();
    });

    nextDayButton.addEventListener('click', () => {
        currentDate.setDate(currentDate.getDate() + 1);
        updateDateAndLoadData();
    });

    rosterDateInput.addEventListener('change', (e) => {
        currentDate = new Date(e.target.value);
        updateDateAndLoadData();
    });

    // Bouton Déconnexion (simulé)
    logoutButton.addEventListener('click', () => {
        showModal('Déconnexion', 'Vous avez été déconnecté avec succès.', false).then(() => {
            console.log('Déconnexion simulée.');
            // window.location.href = 'login.html'; // Redirection vers une page de connexion
        });
    });

    // Ajout d'un nouveau créneau horaire au roster journalier (par défaut 07:00-07:00)
    addSlotButton.addEventListener('click', () => {
        const newSlotId = `slot-${Date.now()}`;
        const newSlot = {
            id: newSlotId,
            startTime: '07:00', // Heure de début par défaut
            endTime: '07:00',   // Heure de fin par défaut
            assignedAgents: []
        };
        dailyRosterSlots.push(newSlot);
        renderDailyRosterSlots();
        updateEnginsSynthesis();
        timeSlotsContainer.scrollTop = timeSlotsContainer.scrollHeight;
        console.log(`Créneau ${newSlot.id} ajouté au roster.`);
        // Ici, tu enverrais cette action à ton backend
    });

    // Fonction pour créer un créneau consécutif (15:00 - 07:00)
    const createConsecutiveSlot = (previousEndTime) => {
        const newSlotId = `slot-${Date.now()}-auto`;
        const newSlot = {
            id: newSlotId,
            startTime: previousEndTime, // Commence à l'heure de fin du précédent
            endTime: '07:00', // Fin à 07:00
            assignedAgents: []
        };
        dailyRosterSlots.push(newSlot);
        renderDailyRosterSlots();
        updateEnginsSynthesis();
        timeSlotsContainer.scrollTop = timeSlotsContainer.scrollHeight;
        console.log(`Nouveau créneau consécutif (${newSlot.startTime}-${newSlot.endTime}) créé automatiquement.`);
    };

    // Mise à jour de l'heure d'un créneau dans le roster journalier
    const updateSlotTime = (slotId, timeType, value) => {
        const slotIndex = dailyRosterSlots.findIndex(s => s.id === slotId);
        if (slotIndex > -1) {
            dailyRosterSlots[slotIndex][timeType] = value;
            updateEnginsSynthesis();
            console.log(`Créneau ${slotId} - ${timeType} mis à jour à ${value}`);
            // Ici, tu enverrais cette mise à jour à ton backend
        }
    };

    // Suppression d'un créneau horaire du roster journalier
    const removeDailyRosterSlot = async (slotId) => {
        const confirm = await showModal(
            'Confirmer la suppression',
            'Êtes-vous sûr de vouloir supprimer ce créneau horaire du roster ?',
            true
        );
        if (confirm) {
            dailyRosterSlots = dailyRosterSlots.filter(slot => slot.id !== slotId);
            renderDailyRosterSlots();
            updateEnginsSynthesis();
            console.log(`Créneau ${slotId} supprimé du roster.`);
            // Ici, tu enverrais cette suppression à ton backend
        }
    };

    // --- Logique Drag & Drop ---

    // Configuration de la zone de dépôt pour les agents d'astreinte
    const setupOnCallDropZone = (dropZoneElement) => {
        dropZoneElement.addEventListener('dragover', (e) => {
            e.preventDefault(); // Permet le dépôt
            // e.dataTransfer.effectAllowed peut être "copy" (si vient de Personnel Disponible) ou "move" (si vient de Agents d'astreinte pour réordonner)
            dropZoneElement.style.backgroundColor = '#dff0d8'; // Feedback visuel
        });

        dropZoneElement.addEventListener('dragleave', () => {
            dropZoneElement.style.backgroundColor = ''; // Réinitialise le feedback visuel
        });

        dropZoneElement.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZoneElement.style.backgroundColor = '';

            const agentData = JSON.parse(e.dataTransfer.getData('text/plain'));

            // Ajoute l'agent à la liste des agents d'astreinte s'il n'y est pas déjà
            if (!onCallAgents.some(a => a.id === agentData.id)) {
                onCallAgents.push(agentData);
                renderOnCallAgents();
                console.log(`Agent ${agentData.name} ajouté aux agents d'astreinte.`);
                // Ici, tu enverrais cette affectation à ton backend
            } else {
                showModal('Agent déjà sélectionné', `L'agent ${agentData.name} est déjà dans la liste des agents d'astreinte.`, false);
            }
        });
    };

    // Supprimer un agent de la liste "Agents d'astreinte"
    const removeAgentFromOnCallList = async (agentId) => {
        const confirm = await showModal(
            'Confirmer la suppression',
            'Êtes-vous sûr de vouloir retirer cet agent de la liste des agents d\'astreinte ?',
            true
        );
        if (confirm) {
            onCallAgents = onCallAgents.filter(agent => agent.id !== agentId);
            renderOnCallAgents();
            console.log(`Agent ${agentId} retiré de la liste d'astreinte.`);
            // Ici, tu enverrais cette suppression à ton backend
        }
    };

    // Configuration de la zone de dépôt pour les créneaux horaires journaliers
    const setupDailyRosterSlotDropZone = (dropZoneElement) => {
        dropZoneElement.addEventListener('dragover', (e) => {
            e.preventDefault();
            // Autorise le dépôt uniquement si l'agent vient de la liste des agents d'astreinte
            const agentData = JSON.parse(e.dataTransfer.getData('text/plain'));
            if (onCallAgents.some(a => a.id === agentData.id)) { // Vérifie que l'agent est bien d'astreinte
                 dropZoneElement.style.backgroundColor = '#dff0d8';
            }
        });

        dropZoneElement.addEventListener('dragleave', () => {
            dropZoneElement.style.backgroundColor = '';
        });

        dropZoneElement.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZoneElement.style.backgroundColor = '';

            const agentData = JSON.parse(e.dataTransfer.getData('text/plain'));
            const slotId = dropZoneElement.dataset.slotId;

            // Assigne l'agent au créneau journalier s'il est un agent d'astreinte et pas déjà assigné
            if (onCallAgents.some(a => a.id === agentData.id)) {
                assignAgentToDailyRosterSlot(slotId, agentData);
            } else {
                showModal('Agent non éligible', 'Seuls les agents de la section "Agents d\'astreinte" peuvent être assignés aux créneaux journaliers.', false);
            }
        });
    };

    // Assigner un agent à un créneau journalier
    const assignAgentToDailyRosterSlot = (slotId, agent) => {
        const slot = dailyRosterSlots.find(s => s.id === slotId);
        if (slot && !slot.assignedAgents.some(a => a.id === agent.id)) {
            slot.assignedAgents.push(agent);
            renderDailyRosterSlots(); // Re-render pour mettre à jour l'affichage
            updateEnginsSynthesis();
            console.log(`Agent ${agent.name} assigné au créneau ${slotId} du roster journalier.`);
            // Ici, tu enverrais cette affectation à ton backend
        } else if (slot && slot.assignedAgents.some(a => a.id === agent.id)) {
            showModal('Agent déjà assigné', `L'agent ${agent.name} est déjà assigné à ce créneau.`, false);
        }
    };

    // Retirer un agent d'un créneau journalier
    const removeAgentFromDailyRosterSlot = (slotId, agentId) => {
        const slot = dailyRosterSlots.find(s => s.id === slotId);
        if (slot) {
            slot.assignedAgents = slot.assignedAgents.filter(agent => agent.id !== agentId);
            renderDailyRosterSlots();
            updateEnginsSynthesis();
            console.log(`Agent ${agentId} retiré du créneau ${slotId} du roster journalier.`);
            // Ici, tu enverrais cette suppression à ton backend
        }
    };

    // --- Logique "Générer Auto" ---

    generateAutoButton.addEventListener('click', async () => {
        toggleLoader(true);
        await showModal('Génération automatique', 'Lancement de la génération automatique de la feuille de garde. Cela peut prendre quelques instants...', false);
        console.log('Déclenchement de la génération automatique...');

        // Vider les créneaux existants et les agents assignés pour une nouvelle génération
        dailyRosterSlots = [];

        // Simulation de la logique d'affectation automatique
        // Crée quelques créneaux par défaut
        dailyRosterSlots.push(
            { id: `slot-${Date.now()}-1`, startTime: '08:00', endTime: '12:00', assignedAgents: [] },
            { id: `slot-${Date.now()}-2`, startTime: '12:00', endTime: '16:00', assignedAgents: [] },
            { id: `slot-${Date.now()}-3`, startTime: '16:00', endTime: '20:00', assignedAgents: [] }
        );

        // Assigne des agents d'astreinte aux créneaux de manière simple
        // Si tu as 3 créneaux et 2 agents d'astreinte, les 2 premiers créneaux auront un agent.
        dailyRosterSlots.forEach((slot, index) => {
            if (onCallAgents.length > 0 && index < onCallAgents.length) {
                slot.assignedAgents.push(onCallAgents[index]);
            } else if (onCallAgents.length === 0) {
                 // Gérer le cas où il n'y a pas d'agents d'astreinte
                 console.warn("Aucun agent d'astreinte disponible pour l'affectation automatique.");
            }
        });


        setTimeout(() => { // Simule le temps de traitement
            renderDailyRosterSlots();
            updateEnginsSynthesis();
            toggleLoader(false);
            showModal('Génération terminée', 'La feuille de garde a été générée automatiquement avec succès (simulation).');
            console.log('Génération automatique terminée.');
            // Ici, tu enverrais le dailyRosterSlots mis à jour à ton backend
        }, 1500);
    });


    // --- Initialisation au chargement de la page ---
    updateDateAndLoadData(); // Charge les données pour la date actuelle au démarrage
});
