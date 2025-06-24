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

    // --- Variables d'état globales (maintenant remplies par l'API) ---
    let currentDate = new Date(); // Date de la feuille de garde affichée
    let availablePersonnel = []; // Agents disponibles pour la date actuelle
    let onCallAgents = []; // Agents sélectionnés pour l'astreinte pour la journée
    let dailyRosterSlots = []; // Créneaux horaires et agents assignés pour le roster journalier

    // --- Constantes et Helpers (copiés de admin.js pour la cohérence des créneaux horaires) ---
    const API_BASE_URL = "https://dispo-pompier.onrender.com"; // Assurez-vous que c'est la bonne URL
    const horaires = []; // Créneaux 30 min sur 24h, de 07h00 à 06h30 du lendemain
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

    // Fonction pour récupérer le token JWT
    function getToken() {
        return sessionStorage.getItem('token');
    }

    // Fonction pour obtenir les en-têtes d'autorisation
    function getAuthHeaders() {
        const token = getToken();
        if (!token) {
            console.error("Token non trouvé. Redirection ou gestion de l'erreur.");
            // Rediriger vers la page de connexion si aucun token n'est trouvé
            window.location.href = '/index.html';
            return { 'Content-Type': 'application/json' }; // Retourne pour éviter des erreurs
        }
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    }

    // --- Fonctions utilitaires ---

    // Affiche ou masque le loader
    const toggleLoader = (show) => {
        if (show) {
            loadingSpinner.classList.remove('hidden');
        } else {
            loadingSpinner.classList.add('hidden');
        }
    };

    // Formate une date engetFullYear-MM-DD
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

    // Sauvegarde la liste des agents d'astreinte sur le backend
    const saveOnCallAgentsToBackend = async () => {
        try {
            const dateKey = formatDate(currentDate);
            // Nous envoyons seulement les IDs des agents à la liste d'astreinte
            const onDutyAgentIds = onCallAgents.map(agent => agent.id);

            const response = await fetch(`${API_BASE_URL}/api/daily-roster/${dateKey}`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ onDutyAgents: onDutyAgentIds })
            });

            if (response.status === 403 || response.status === 401) {
                await showModal("Session expirée", "Votre session a expiré ou n'est pas valide. Veuillez vous reconnecter.", false);
                sessionStorage.clear();
                window.location.href = "/index.html";
                return false;
            }

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Erreur lors de la sauvegarde des agents d\'astreinte.');
            }
            console.log("Agents d'astreinte sauvegardés avec succès sur le backend.");
            return true;
        } catch (error) {
            console.error('Erreur lors de la sauvegarde des agents d\'astreinte :', error);
            // Pas de modale ici, le rollback gérera l'affichage de l'erreur via updateDateAndLoadData() si nécessaire
            return false;
        }
    };

    // Sauvegarde les créneaux horaires journaliers sur le backend
    const saveDailyRosterSlotsToBackend = async () => {
        try {
            const dateKey = formatDate(currentDate);
            const response = await fetch(`${API_BASE_URL}/api/roster-config/${dateKey}`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ timeSlots: dailyRosterSlots })
            });

            if (response.status === 403 || response.status === 401) {
                await showModal("Session expirée", "Votre session a expiré ou n'est pas valide. Veuillez vous reconnecter.", false);
                sessionStorage.clear();
                window.location.href = "/index.html";
                return false;
            }

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Erreur lors de la sauvegarde des créneaux journaliers.');
            }
            console.log("Créneaux journaliers sauvegardés avec succès sur le backend.");
            return true;
        } catch (error) {
            console.error('Erreur lors de la sauvegarde des créneaux journaliers :', error);
            // Pas de modale ici, l'appelant gérera
            return false;
        }
    };


    // --- Initialisation et rendu ---

    // Met à jour l'input de date et charge les données depuis l'API
    const updateDateAndLoadData = async () => {
        rosterDateInput.value = formatDate(currentDate);
        toggleLoader(true);

        try {
            const dateKey = formatDate(currentDate);
            const response = await fetch(`${API_BASE_URL}/api/agent-availability/${dateKey}`, {
                headers: getAuthHeaders()
            });

            if (response.status === 403 || response.status === 401) {
                await showModal("Session expirée", "Votre session a expiré ou n'est pas valide. Veuillez vous reconnecter.", false);
                sessionStorage.clear();
                window.location.href = "/index.html";
                return;
            }

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Erreur lors de la récupération des données de disponibilité.');
            }

            const data = await response.json();
            
            // Les données sont chargées depuis le backend, elles représentent l'état réel.
            onCallAgents = data.onCall || [];
            availablePersonnel = data.available || [];

            await loadDailyRosterSlots(dateKey); // Charge les créneaux journaliers spécifiques
            
        } catch (error) {
            console.error('Erreur lors du chargement des données de la feuille de garde :', error);
            await showModal('Erreur de chargement', `Impossible de charger les données : ${error.message}`);
            availablePersonnel = [];
            onCallAgents = [];
            dailyRosterSlots = [];
        } finally {
            renderAvailablePersonnel();
            renderOnCallAgents();
            renderDailyRosterSlots(); // Assurez-vous que cette fonction est appelée
            updateEnginsSynthesis();
            toggleLoader(false);
        }
    };

    // Fonction pour charger les créneaux journaliers spécifiques
    const loadDailyRosterSlots = async (dateKey) => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/roster-config/${dateKey}`, {
                headers: getAuthHeaders()
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Erreur lors de la récupération des créneaux journaliers.');
            }
            const data = await response.json();
            dailyRosterSlots = data.timeSlots || []; // Assurez-vous que la structure correspond {id, startTime, endTime, assignedAgents}
            console.log("Créneaux journaliers chargés:", dailyRosterSlots);

        } catch (error) {
            console.error('Erreur de chargement des créneaux journaliers :', error);
            dailyRosterSlots = []; 
        }
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
                agentCard.textContent = agent.username; // Utilise le nom complet
                agentCard.draggable = true;
                agentCard.dataset.agentId = agent.id;
                agentCard.dataset.agentName = agent.username; // Pour récupérer facilement le nom

                // Configure le dragstart pour les agents disponibles
                agentCard.addEventListener('dragstart', (e) => {
                    e.dataTransfer.setData('text/plain', JSON.stringify({ id: agent.id, name: agent.username }));
                    e.dataTransfer.effectAllowed = 'copy'; // Peut être copié vers la zone d'astreinte
                });

                // --- Affichage des créneaux de disponibilité (maintenant via CSS hover) ---
                if (agent.availabilities && agent.availabilities.length > 0) {
                    const tooltip = document.createElement('div');
                    tooltip.className = 'availability-tooltip';
                    // Convertit les index de créneaux en plages horaires lisibles
                    const slotsText = agent.availabilities.map(slotRange => {
                        const startH = horaires[slotRange.start] ? horaires[slotRange.start].split(' - ')[0] : 'Inconnu';
                        const endH = horaires[slotRange.end] ? horaires[slotRange.end].split(' - ')[1] : 'Inconnu';
                        return `${startH} - ${endH}`;
                    }).join('<br>');

                    tooltip.innerHTML = `
                        <strong>Disponibilité:</strong><br>
                        ${slotsText}
                    `;
                    agentCard.appendChild(tooltip); // Ajoute la tooltip comme enfant de la carte d'agent
                }
                // --- Fin affichage survol ---

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
                agentCard.dataset.agentName = agent.username; // Utilise le nom complet
                agentCard.draggable = true; // Ces agents peuvent être glissés vers les créneaux journaliers

                agentCard.innerHTML = `
                    <span>${agent.username}</span>
                    <button class="remove-on-call-agent-tag" data-agent-id="${agent.id}" aria-label="Supprimer cet agent de la liste d'astreinte">x</button>
                `;

                // Configure le dragstart pour les agents d'astreinte (vers les créneaux journaliers)
                agentCard.addEventListener('dragstart', (e) => {
                    e.dataTransfer.setData('text/plain', JSON.stringify({ id: agent.id, name: agent.username }));
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

        let initialEndTime = slot.endTime;

        startTimeInput.addEventListener('change', async (e) => {
            slot.startTime = e.target.value; // Update local state
            updateEnginsSynthesis();
            await saveDailyRosterSlotsToBackend(); // Save after local update
        });
        endTimeInput.addEventListener('change', async (e) => {
            const newEndTime = e.target.value;
            slot.endTime = newEndTime; // Update local state
            updateEnginsSynthesis();
            if (initialEndTime === '07:00' && newEndTime === '15:00') {
                createConsecutiveSlot(newEndTime);
            }
            await saveDailyRosterSlotsToBackend(); // Save after local update
            initialEndTime = newEndTime;
        });

        div.querySelector('.remove-slot-button').addEventListener('click', async () => {
            await removeDailyRosterSlot(slot.id);
            await saveDailyRosterSlotsToBackend(); // Save after removal
        });

        div.querySelectorAll('.remove-assigned-agent-tag').forEach(button => {
            button.addEventListener('click', async (e) => {
                const agentIdToRemove = e.target.dataset.agentId;
                await removeAgentFromDailyRosterSlot(slot.id, agentIdToRemove);
                await saveDailyRosterSlotsToBackend(); // Save after de-assignment
            });
        });

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
            enginsSynthesisContent.appendChild(synthesisSlotDiv);
        });
    };


    // --- Logique des événements ---

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

    logoutButton.addEventListener('click', () => {
        showModal('Déconnexion', 'Vous avez été déconnecté avec succès.', false).then(() => {
            console.log('Déconnexion simulée.');
            sessionStorage.clear();
            window.location.href = '/index.html';
        });
    });

    addSlotButton.addEventListener('click', async () => {
        const newSlotId = `slot-${Date.now()}`;
        const newSlot = {
            id: newSlotId,
            startTime: '07:00',
            endTime: '07:00',
            assignedAgents: []
        };
        dailyRosterSlots.push(newSlot);
        renderDailyRosterSlots();
        updateEnginsSynthesis();
        timeSlotsContainer.scrollTop = timeSlotsContainer.scrollHeight;
        console.log(`Créneau ${newSlot.id} ajouté au roster.`);
        await saveDailyRosterSlotsToBackend();
    });

    const createConsecutiveSlot = async (previousEndTime) => {
        const newSlotId = `slot-${Date.now()}-auto`;
        const newSlot = {
            id: newSlotId,
            startTime: previousEndTime,
            endTime: '07:00',
            assignedAgents: []
        };
        dailyRosterSlots.push(newSlot);
        renderDailyRosterSlots();
        updateEnginsSynthesis();
        timeSlotsContainer.scrollTop = timeSlotsContainer.scrollHeight;
        console.log(`Nouveau créneau consécutif (${newSlot.startTime}-${newSlot.endTime}) créé automatiquement.`);
        await saveDailyRosterSlotsToBackend();
    };

    // --- Logique Drag & Drop ---

    const setupOnCallDropZone = (dropZoneElement) => {
        dropZoneElement.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZoneElement.style.backgroundColor = '#dff0d8';
        });

        dropZoneElement.addEventListener('dragleave', () => {
            dropZoneElement.style.backgroundColor = '';
        });

        dropZoneElement.addEventListener('drop', async (e) => {
            e.preventDefault();
            dropZoneElement.style.backgroundColor = '';

            const agentData = JSON.parse(e.dataTransfer.getData('text/plain'));

            // Vérifie si l'agent n'est PAS déjà dans la liste onCallAgents LOCALE
            if (!onCallAgents.some(a => a.id === agentData.id)) {
                // Étape 1: Mettre à jour l'état local immédiatement
                onCallAgents.push(agentData);
                // Retirer l'agent de la liste des disponibles LOCALE
                availablePersonnel = availablePersonnel.filter(agent => agent.id !== agentData.id);

                // Étape 2: Rafraîchir l'UI immédiatement
                renderOnCallAgents(); 
                renderAvailablePersonnel();

                // Étape 3: Tenter de sauvegarder la nouvelle liste sur le backend
                const success = await saveOnCallAgentsToBackend(); 

                if (!success) {
                    // Étape 4: Si la sauvegarde échoue, annuler les changements locaux
                    await showModal('Erreur de sauvegarde', 'La sélection de l\'agent d\'astreinte n\'a pas pu être sauvegardée. L\'agent a été replacé. Veuillez réessayer.');
                    // Revert des changements locaux
                    onCallAgents = onCallAgents.filter(a => a.id !== agentData.id);
                    // Trouver l'agent original avec ses disponibilités pour le remettre correctement
                    // Pour cet exemple, nous allons recharger toutes les données pour resynchroniser propre.
                    await updateDateAndLoadData(); // Force un re-sync complet depuis le serveur
                    console.error(`Échec de l'ajout de l'agent ${agentData.name} aux agents d'astreinte.`);
                } else {
                    console.log(`Agent ${agentData.name} ajouté aux agents d'astreinte et sauvegardé.`);
                }
            } else {
                // Si l'agent est déjà dans la liste locale (peut-être à cause d'un échec de save précédent non corrigé)
                // On affiche un message et on force un rechargement pour resynchroniser l'UI avec le backend.
                showModal('Agent déjà sélectionné', `L'agent ${agentData.name} est déjà dans la liste des agents d'astreinte (synchronisation en cours).`, false);
                await updateDateAndLoadData(); 
            }
        });
    };

    const removeAgentFromOnCallList = async (agentId) => {
        const confirm = await showModal(
            'Confirmer la suppression',
            'Êtes-vous sûr de vouloir retirer cet agent de la liste des agents d\'astreinte ?',
            true
        );
        if (confirm) {
            // Étape 1: Identifier l'agent à retirer
            const agentToRemove = onCallAgents.find(agent => agent.id === agentId);
            if (!agentToRemove) return; // Agent non trouvé, rien à faire

            // Étape 2: Mettre à jour l'état local immédiatement
            onCallAgents = onCallAgents.filter(agent => agent.id !== agentId);
            // Si l'agent retiré était disponible pour le jour actuel, l'ajouter à availablePersonnel localement
            const originalAvailability = availablePersonnel.find(a => a.id === agentId) || availablePersonnel.find(a => a.id === agentId); // Check initialement disponible
            if (originalAvailability) { // Si l'agent est potentiellement disponible
                // On pourrait chercher l'agent dans les données brutes disponibles pour le jour
                // Pour simplifier et garantir la cohérence, on va le rajouter et laisser updateDateAndLoadData() le filtrer proprement ensuite
                // Mais pour une réactivité immédiate, on l'ajoute directement si absent.
                if (!availablePersonnel.some(a => a.id === agentToRemove.id)) {
                    availablePersonnel.push(agentToRemove); // Ajout local temporaire
                }
            }
            
            // Retirer l'agent de tous les créneaux où il est affecté dans le roster journalier localement
            dailyRosterSlots.forEach(slot => {
                slot.assignedAgents = slot.assignedAgents.filter(agent => agent.id !== agentId);
            });

            // Étape 3: Rafraîchir l'UI immédiatement
            renderOnCallAgents(); 
            renderAvailablePersonnel();
            renderDailyRosterSlots(); 
            updateEnginsSynthesis();

            // Étape 4: Tenter de sauvegarder la nouvelle liste sur le backend
            const success = await saveOnCallAgentsToBackend();

            if (!success) {
                // Étape 5: Si la sauvegarde échoue, annuler les changements locaux
                await showModal('Erreur de sauvegarde', 'La suppression de l\'agent d\'astreinte n\'a pas pu être sauvegardée. L\'agent a été replacé. Veuillez réessayer.');
                await updateDateAndLoadData(); // Force un re-sync complet depuis le serveur
                console.error(`Échec de la suppression pour l'agent ${agentId}.`);
            } else {
                console.log(`Agent ${agentId} retiré de la liste d'astreinte et de ses affectations, et remis dans le personnel disponible (si éligible) et sauvegardé.`);
            }
        }
    };

    const setupDailyRosterSlotDropZone = (dropZoneElement) => {
        dropZoneElement.addEventListener('dragover', (e) => {
            e.preventDefault();
            const agentData = JSON.parse(e.dataTransfer.getData('text/plain'));
            if (onCallAgents.some(a => a.id === agentData.id)) {
                 dropZoneElement.style.backgroundColor = '#dff0d8';
            }
        });

        dropZoneElement.addEventListener('dragleave', () => {
            dropZoneElement.style.backgroundColor = '';
        });

        dropZoneElement.addEventListener('drop', async (e) => {
            e.preventDefault();
            dropZoneElement.style.backgroundColor = '';

            const agentData = JSON.parse(e.dataTransfer.getData('text/plain'));
            const slotId = dropZoneElement.dataset.slotId;

            if (onCallAgents.some(a => a.id === agentData.id)) {
                // Capture l'état actuel avant modification pour rollback
                const previousDailyRosterSlots = JSON.parse(JSON.stringify(dailyRosterSlots));

                const success = assignAgentToDailyRosterSlot(slotId, agentData); // Affectation locale
                if (success) {
                    const saveSuccess = await saveDailyRosterSlotsToBackend(); // Sauvegarde après affectation
                    if (!saveSuccess) {
                        await showModal('Erreur d\'affectation', 'L\'affectation de l\'agent au créneau n\'a pas pu être sauvegardée. L\'affectation a été annulée. Veuillez réessayer.');
                        dailyRosterSlots = previousDailyRosterSlots; // Revert
                        renderDailyRosterSlots();
                        updateEnginsSynthesis();
                    } else {
                        console.log(`Agent ${agentData.name} assigné au créneau ${slotId} et sauvegardé.`);
                    }
                } else {
                    // assignAgentToDailyRosterSlot a déjà affiché une modale si l'agent est déjà assigné
                    console.log("Agent non affecté au créneau (déjà assigné ou autre condition).");
                }
            } else {
                showModal('Agent non éligible', 'Seuls les agents de la section "Agents d\'astreinte" peuvent être assignés aux créneaux journaliers.', false);
            }
        });
    };

    const assignAgentToDailyRosterSlot = (slotId, agent) => {
        const slot = dailyRosterSlots.find(s => s.id === slotId);
        if (slot && !slot.assignedAgents.some(a => a.id === agent.id)) {
            slot.assignedAgents.push(agent);
            renderDailyRosterSlots();
            updateEnginsSynthesis();
            console.log(`Agent ${agent.name} assigné au créneau ${slotId} du roster journalier.`);
            return true;
        } else if (slot && slot.assignedAgents.some(a => a.id === agent.id)) {
            showModal('Agent déjà assigné', `L'agent ${agent.name} est déjà assigné à ce créneau.`, false);
            return false;
        }
        return false;
    };

    const removeAgentFromDailyRosterSlot = async (slotId, agentId) => {
        const confirm = await showModal(
            'Confirmer la suppression',
            'Êtes-vous sûr de vouloir retirer cet agent de ce créneau ?',
            true
        );
        if (confirm) {
            const slot = dailyRosterSlots.find(s => s.id === slotId);
            if (slot) {
                // Capture l'état avant modification pour rollback
                const previousDailyRosterSlots = JSON.parse(JSON.stringify(dailyRosterSlots));

                slot.assignedAgents = slot.assignedAgents.filter(agent => agent.id !== agentId);
                renderDailyRosterSlots();
                updateEnginsSynthesis();
                console.log(`Agent ${agentId} retiré du créneau ${slotId} du roster journalier.`);
                const saveSuccess = await saveDailyRosterSlotsToBackend(); // Sauvegarde après la suppression
                if (!saveSuccess) {
                    await showModal('Erreur de suppression', 'La suppression de l\'affectation n\'a pas pu être sauvegardée. L\'affectation a été restaurée. Veuillez réessayer.');
                    dailyRosterSlots = previousDailyRosterSlots; // Revert
                    renderDailyRosterSlots();
                    updateEnginsSynthesis();
                }
                return saveSuccess; // Indique le succès de la persistance
            }
            return false;
        }
        return false;
    };

    generateAutoButton.addEventListener('click', async () => {
        toggleLoader(true);
        await showModal('Génération automatique', 'Lancement de la génération automatique de la feuille de garde. Cela peut prendre quelques instants...', false);
        console.log('Déclenchement de la génération automatique...');

        dailyRosterSlots = [];

        dailyRosterSlots.push(
            { id: `slot-${Date.now()}-1`, startTime: '07:00', endTime: '07:00', assignedAgents: [] },
        );

        dailyRosterSlots.forEach((slot, index) => {
            if (onCallAgents.length > 0 && index < onCallAgents.length) {
                slot.assignedAgents.push(onCallAgents[index]);
            } else if (onCallAgents.length === 0) {
                 console.warn("Aucun agent d'astreinte disponible pour l'affectation automatique.");
            }
        });

        const success = await saveDailyRosterSlotsToBackend();

        setTimeout(async () => {
            if (success) {
                await updateDateAndLoadData();
                toggleLoader(false);
                showModal('Génération terminée', 'La feuille de garde a été générée automatiquement avec succès.');
                console.log('Génération automatique terminée.');
            } else {
                toggleLoader(false);
                showModal('Erreur de génération', 'La génération automatique a échoué. Veuillez vérifier les logs serveur.');
                console.error('Échec de la génération automatique et de la sauvegarde.');
            }
        }, 1500);
    });

    updateDateAndLoadData();
});
