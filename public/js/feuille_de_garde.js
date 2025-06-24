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

    // Sauvegarde la liste des agents d'astreinte sur le backend
    // Accepte un paramètre explicite pour la liste des IDs à sauvegarder
    const saveOnCallAgentsToBackend = async (onDutyAgentIdsToSave) => {
        try {
            const dateKey = formatDate(currentDate);
            // Utilise la liste fournie, ou la liste globale si non fournie (pour compatibilité)
            const idsToSave = onDutyAgentIdsToSave || onCallAgents.map(agent => agent.id);

            const response = await fetch(`${API_BASE_URL}/api/daily-roster/${dateKey}`, {
                method: 'POST', // Assurez-vous que le backend gère bien le POST pour la mise à jour
                headers: getAuthHeaders(),
                body: JSON.stringify({ onDutyAgents: idsToSave }) // Utilise l'argument passé
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
            return false;
        }
    };


    // --- Initialisation et rendu ---

    // Met à jour l'input de date et charge les données depuis l'API
    const updateDateAndLoadData = async () => {
        rosterDateInput.value = formatDate(currentDate);
        toggleLoader(true); // Affiche le loader au début du chargement

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
            toggleLoader(false); // Cache le loader à la fin du chargement
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
                    // Important : passer username ici pour la cohérence
                    e.dataTransfer.setData('text/plain', JSON.stringify({ id: agent.id, username: agent.username }));
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
                // Assurez-vous que l'agent a une propriété 'username'
                agentCard.textContent = agent.username || agent.name; // Fallback au cas où
                agentCard.draggable = true;
                agentCard.dataset.agentId = agent.id;
                agentCard.dataset.agentName = agent.username || agent.name; // Fallback

                agentCard.innerHTML = `
                    <span>${agent.username || agent.name}</span>
                    <button class="remove-on-call-agent-tag" data-agent-id="${agent.id}" aria-label="Supprimer cet agent de la liste d'astreinte">x</button>
                `;

                // Configure le dragstart pour les agents d'astreinte (vers les créneaux journaliers)
                agentCard.addEventListener('dragstart', (e) => {
                    e.dataTransfer.setData('text/plain', JSON.stringify({ id: agent.id, username: agent.username || agent.name })); // Assurez-vous de passer 'username'
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
                        ${agent.name || agent.username}
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
                            <span class="assigned">${agent.name || agent.username}</span>
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
            // Crée l'objet agent avec la propriété 'username' pour la cohérence
            const agentToAdd = { id: agentData.id, username: agentData.username }; 

            // Construire la liste des IDs à envoyer au backend si cet agent est ajouté
            // Cela inclut tous les agents d'astreinte actuels plus le nouvel agent
            const currentOnCallAgentIds = onCallAgents.map(a => a.id);
            let newOnDutyAgentIds = [...currentOnCallAgentIds];

            if (!currentOnCallAgentIds.includes(agentToAdd.id)) {
                newOnDutyAgentIds.push(agentToAdd.id);
            } else {
                // Si l'agent est déjà dans la liste (selon l'état du backend, car onCallAgents est rechargé)
                // alors on affiche un message et on resynchronise au cas où l'UI serait en décalage.
                await showModal('Agent déjà d\'astreinte', `L'agent ${agentToAdd.username} est déjà dans la liste des agents d'astreinte selon le serveur. L'interface va se rafraîchir pour assurer la cohérence.`, false);
                await updateDateAndLoadData(); // Force un re-sync pour s'assurer de la cohérence visuelle
                return; // Arrête le traitement car l'agent est déjà là
            }
            
            // Tenter de sauvegarder la nouvelle liste sur le backend
            toggleLoader(true); // Afficher le loader pendant la sauvegarde
            const success = await saveOnCallAgentsToBackend(newOnDutyAgentIds); // Passer la nouvelle liste explicite

            if (!success) {
                // Si la sauvegarde échoue, informer l'utilisateur. updateDateAndLoadData sera appelé ensuite.
                await showModal('Erreur de sauvegarde', 'La sélection de l\'agent d\'astreinte n\'a pas pu être sauvegardée par le serveur. L\'interface va se resynchroniser pour refléter l\'état actuel du serveur. Veuillez réessayer.', false);
            } else {
                console.log(`Agent ${agentToAdd.username} ajouté aux agents d'astreinte et sauvegardé.`);
            }
            
            // Toujours recharger depuis le backend après une tentative de modification/ajout
            // Cela garantit que l'UI est synchronisée avec la source de vérité (le backend).
            await updateDateAndLoadData(); 
            toggleLoader(false); // Cacher le loader
        });
    };

    const removeAgentFromOnCallList = async (agentId) => {
        const confirm = await showModal(
            'Confirmer la suppression',
            'Êtes-vous sûr de vouloir retirer cet agent de la liste des agents d\'astreinte ?',
            true
        );
        if (confirm) {
            // Construire la nouvelle liste d'IDs à envoyer au backend
            const newOnDutyAgentIds = onCallAgents.filter(agent => agent.id !== agentId).map(a => a.id);
            
            // Retirer l'agent de tous les créneaux où il est affecté dans le roster journalier localement
            // (Ces changements seront sauvegardés par saveDailyRosterSlotsToBackend)
            dailyRosterSlots.forEach(slot => {
                slot.assignedAgents = slot.assignedAgents.filter(agent => agent.id !== agentId);
            });

            // Tenter de sauvegarder les nouvelles listes sur le backend
            toggleLoader(true); // Afficher le loader pendant la sauvegarde
            const saveOnCallSuccess = await saveOnCallAgentsToBackend(newOnDutyAgentIds); // Passer la nouvelle liste explicite
            const saveRosterSuccess = await saveDailyRosterSlotsToBackend(); // Sauvegarde aussi les créneaux mis à jour

            if (!saveOnCallSuccess || !saveRosterSuccess) {
                 await showModal('Erreur de sauvegarde', 'La suppression de l\'agent d\'astreinte n\'a pas pu être sauvegardée par le serveur. L\'interface va se resynchroniser.');
            } else {
                console.log(`Agent ${agentId} retiré de la liste d'astreinte localement. Synchronisation avec le backend effectuée.`);
            }
            // Toujours recharger depuis le backend après une tentative de modification/suppression
            // Cela garantit que l'UI est synchronisée avec la source de vérité (le backend).
            await updateDateAndLoadData(); 
            toggleLoader(false); // Cacher le loader
        }
    };

    const setupDailyRosterSlotDropZone = (dropZoneElement) => {
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
            const slotId = dropZoneElement.dataset.slotId;

            // Assurez-vous que l'agent est bien d'astreinte avant de l'assigner
            if (onCallAgents.some(a => a.id === agentData.id)) {
                // Affectation locale
                const agentToAssign = { id: agentData.id, name: agentData.username }; // Utilise username pour le nom de l'agent affecté
                const success = assignAgentToDailyRosterSlot(slotId, agentToAssign); 
                
                if (success) {
                    toggleLoader(true); // Afficher le loader
                    const saveSuccess = await saveDailyRosterSlotsToBackend(); // Sauvegarde après affectation
                    if (!saveSuccess) {
                        await showModal('Erreur d\'affectation', 'L\'affectation de l\'agent au créneau n\'a pas pu être sauvegardée. L\'affectation a été annulée. Veuillez réessayer.');
                    } else {
                        console.log(`Agent ${agentData.username} assigné au créneau ${slotId} et sauvegardé.`);
                    }
                    await updateDateAndLoadData(); // Toujours resynchroniser
                    toggleLoader(false); // Cacher le loader
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
            console.log(`Agent ${agent.name || agent.username} assigné au créneau ${slotId} du roster journalier.`);
            return true;
        } else if (slot && slot.assignedAgents.some(a => a.id === agent.id)) {
            showModal('Agent déjà assigné', `L'agent ${agent.name || agent.username} est déjà assigné à ce créneau.`, false);
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
                slot.assignedAgents = slot.assignedAgents.filter(agent => agent.id !== agentId);
                renderDailyRosterSlots();
                updateEnginsSynthesis();
                console.log(`Agent ${agentId} retiré du créneau ${slotId} du roster journalier.`);
                toggleLoader(true); // Afficher le loader
                const saveSuccess = await saveDailyRosterSlotsToBackend(); // Sauvegarde après la suppression
                if (!saveSuccess) {
                    await showModal('Erreur de suppression', 'La suppression de l\'affectation n\'a pas pu être sauvegardée. L\'affectation a été restaurée. Veuillez réessayer.');
                }
                await updateDateAndLoadData(); // Toujours resynchroniser
                toggleLoader(false); // Cacher le loader
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

        // Réinitialise les créneaux pour la génération
        dailyRosterSlots = [];

        // Crée des créneaux par défaut
        dailyRosterSlots.push(
            { id: `slot-${Date.now()}-1`, startTime: '07:00', endTime: '07:00', assignedAgents: [] },
        );

        // Assigne des agents d'astreinte aux créneaux de manière simple
        dailyRosterSlots.forEach((slot, index) => {
            if (onCallAgents.length > 0 && index < onCallAgents.length) {
                // Assurez-vous d'utiliser 'username' ou 'name' de l'agent d'astreinte
                slot.assignedAgents.push({ id: onCallAgents[index].id, name: onCallAgents[index].username || onCallAgents[index].name });
            } else if (onCallAgents.length === 0) {
                 console.warn("Aucun agent d'astreinte disponible pour l'affectation automatique.");
            }
        });

        // Tenter de sauvegarder les nouvelles listes sur le backend
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
