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
            availablePersonnel = data.available || [];
            onCallAgents = data.onCall || [];

            // Charger aussi les créneaux journaliers depuis le backend si applicable
            await loadDailyRosterSlots(dateKey); // Nouvelle fonction pour charger les créneaux quotidiens
            
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

    // Nouvelle fonction pour charger les créneaux journaliers spécifiques
    const loadDailyRosterSlots = async (dateKey) => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/roster-config/${dateKey}`, { // Ou daily-roster si c'est là que sont les créneaux
                headers: getAuthHeaders()
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Erreur lors de la récupération des créneaux journaliers.');
            }
            const data = await response.json();
            dailyRosterSlots = data.timeSlots || []; // Assurez-vous que la structure correspond
            console.log("Créneaux journaliers chargés:", dailyRosterSlots);

        } catch (error) {
            console.error('Erreur de chargement des créneaux journaliers :', error);
            // Si c'est un ENOENT (pas de fichier), c'est normal, on initialise à vide
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

                // --- Affichage des créneaux de disponibilité au survol ---
                agentCard.addEventListener('mouseenter', (e) => {
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
                        // Positionnement simple à côté de la carte de l'agent
                        tooltip.style.position = 'absolute';
                        tooltip.style.left = `${e.clientX + 15}px`; // Ajuste la position
                        tooltip.style.top = `${e.clientY + 15}px`;
                        tooltip.style.backgroundColor = '#333';
                        tooltip.style.color = 'white';
                        tooltip.style.padding = '8px';
                        tooltip.style.borderRadius = '5px';
                        tooltip.style.zIndex = '100';
                        document.body.appendChild(tooltip);
                        agentCard.dataset.tooltipId = 'tooltip-' + agent.id; // Stocke l'ID du tooltip
                    }
                });

                agentCard.addEventListener('mouseleave', () => {
                    const tooltipId = agentCard.dataset.tooltipId;
                    const existingTooltip = document.querySelector(`[data-tooltip-id="${tooltipId}"]`);
                    if (existingTooltip) {
                        existingTooltip.remove();
                    }
                });
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

        // Capture la valeur initiale de l'heure de fin pour la logique de création de nouveau créneau
        let initialEndTime = slot.endTime;

        startTimeInput.addEventListener('change', (e) => updateSlotTime(slot.id, 'startTime', e.target.value));
        endTimeInput.addEventListener('change', (e) => {
            const newEndTime = e.target.value;
            updateSlotTime(slot.id, 'endTime', newEndTime);
            // Logique pour créer un nouveau créneau automatiquement si 07:00 -> 15:00
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
            sessionStorage.clear(); // Supprime le token
            window.location.href = '/index.html'; // Redirection vers la page de connexion
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
        // Par exemple: saveDailyRosterSlots(dailyRosterSlots);
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
        // Ici, tu enverrais cette action à ton backend
        // Par exemple: saveDailyRosterSlots(dailyRosterSlots);
    };

    // Mise à jour de l'heure d'un créneau dans le roster journalier
    const updateSlotTime = (slotId, timeType, value) => {
        const slotIndex = dailyRosterSlots.findIndex(s => s.id === slotId);
        if (slotIndex > -1) {
            dailyRosterSlots[slotIndex][timeType] = value;
            updateEnginsSynthesis();
            console.log(`Créneau ${slotId} - ${timeType} mis à jour à ${value}`);
            // Ici, tu enverrais cette mise à jour à ton backend
            // Par exemple: saveDailyRosterSlots(dailyRosterSlots);
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
            // Par exemple: saveDailyRosterSlots(dailyRosterSlots);
        }
    };

    // --- Logique Drag & Drop ---

    // Configuration de la zone de dépôt pour les agents d'astreinte
    const setupOnCallDropZone = (dropZoneElement) => {
        dropZoneElement.addEventListener('dragover', (e) => {
            e.preventDefault(); // Permet le dépôt
            dropZoneElement.style.backgroundColor = '#dff0d8'; // Feedback visuel
        });

        dropZoneElement.addEventListener('dragleave', () => {
            dropZoneElement.style.backgroundColor = ''; // Réinitialise le feedback visuel
        });

        dropZoneElement.addEventListener('drop', async (e) => { // Rendre asynchrone pour la mise à jour des données
            e.preventDefault();
            dropZoneElement.style.backgroundColor = '';

            const agentData = JSON.parse(e.dataTransfer.getData('text/plain'));

            // Ajoute l'agent à la liste des agents d'astreinte s'il n'y est pas déjà
            if (!onCallAgents.some(a => a.id === agentData.id)) {
                // Simule la mise à jour côté serveur pour onCallAgents
                // Dans une vraie application, tu ferais un appel POST/PUT à ton backend
                // Exemple: await fetch(`${API_BASE_URL}/api/daily-roster/${formatDate(currentDate)}`, { method: 'POST', body: JSON.stringify({ onDutyAgents: [...onCallAgents.map(a => a.id), agentData.id] }) });
                onCallAgents.push(agentData); // Mettre à jour l'état local immédiatement pour une meilleure UX

                // Après la modification, recharger toutes les données pour assurer la cohérence
                await updateDateAndLoadData();
                console.log(`Agent ${agentData.name} ajouté aux agents d'astreinte.`);
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
            // Simule la mise à jour côté serveur pour onCallAgents
            // Dans une vraie application, tu ferais un appel POST/PUT à ton backend
            // Exemple: await fetch(`${API_BASE_URL}/api/daily-roster/${formatDate(currentDate)}`, { method: 'POST', body: JSON.stringify({ onDutyAgents: onCallAgents.filter(a => a.id !== agentId).map(a => a.id) }) });

            // Retire l'agent de la liste d'astreinte localement
            onCallAgents = onCallAgents.filter(agent => agent.id !== agentId);

            // Supprime l'agent de tous les créneaux où il est affecté dans le roster journalier localement
            dailyRosterSlots.forEach(slot => {
                slot.assignedAgents = slot.assignedAgents.filter(agent => agent.id !== agentId);
            });

            // Après la modification, recharger toutes les données pour assurer la cohérence
            await updateDateAndLoadData();
            console.log(`Agent ${agentId} retiré de la liste d'astreinte et de ses affectations, et remis dans le personnel disponible.`);
        }
    };

    // Configuration de la zone de dépôt pour les créneaux horaires journaliers
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
            // Exemple: saveDailyRosterSlots(dailyRosterSlots);
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
            // Exemple: saveDailyRosterSlots(dailyRosterSlots);
        }
    };

    // --- Logique "Générer Auto" ---

    generateAutoButton.addEventListener('click', async () => {
        toggleLoader(true);
        await showModal('Génération automatique', 'Lancement de la génération automatique de la feuille de garde. Cela peut prendre quelques instants...', false);
        console.log('Déclenchement de la génération automatique...');

        // Vider les créneaux existants et les agents assignés pour une nouvelle génération
        dailyRosterSlots = [];

        // Crée quelques créneaux par défaut
        dailyRosterSlots.push(
            { id: `slot-${Date.now()}-1`, startTime: '07:00', endTime: '07:00', assignedAgents: [] },
        );

        // Assigne des agents d'astreinte aux créneaux de manière simple
        dailyRosterSlots.forEach((slot, index) => {
            if (onCallAgents.length > 0 && index < onCallAgents.length) {
                slot.assignedAgents.push(onCallAgents[index]);
            } else if (onCallAgents.length === 0) {
                 console.warn("Aucun agent d'astreinte disponible pour l'affectation automatique.");
            }
        });

        // Simule l'appel au backend pour la génération automatique et la sauvegarde
        // Dans une vraie application, cette logique serait probablement côté serveur
        setTimeout(async () => { // Simule le temps de traitement
            renderDailyRosterSlots();
            updateEnginsSynthesis();
            // Simule la sauvegarde après la génération
            // await saveDailyRosterSlots(dailyRosterSlots); // Tu devrais implémenter cette fonction de sauvegarde
            toggleLoader(false);
            showModal('Génération terminée', 'La feuille de garde a été générée automatiquement avec succès (simulation).');
            console.log('Génération automatique terminée.');
        }, 1500);
    });


    // --- Initialisation au chargement de la page ---
    updateDateAndLoadData(); // Charge les données pour la date actuelle au démarrage
});
