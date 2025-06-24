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
    let activeQualificationFilter = null; // Nouvelle variable pour le filtre de qualification

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

    // --- Définition des engins du centre avec leurs rôles et qualifications associées ---
    const centerEngines = [
        { 
            id: 'fpt', name: 'FPT', roles: [
                { id: 'ch_agr_fpt', name: 'Chef d\'agrès', qualificationId: 'ca_fpt' },
                { id: 'cond_fpt', name: 'Conducteur', qualificationId: 'cod_1' },
                { id: 'eq1_fpt', name: 'Équipier 1', qualificationId: 'eq1_fpt' },
                { id: 'eq2_fpt', name: 'Équipier 2', qualificationId: 'eq2_fpt' },
            ]
        },
        { 
            id: 'ccf', name: 'CCF', roles: [
                { id: 'ch_agr_ccf', name: 'Chef d\'agrès', qualificationId: 'ca_ccf' },
                { id: 'cond_ccf', name: 'Conducteur', qualificationId: 'cod_2' },
                { id: 'eq1_ccf', name: 'Équipier 1', qualificationId: 'eq1_ccf' },
                { id: 'eq2_ccf', name: 'Équipier 2', qualificationId: 'eq2_ccf' },
            ]
        },
        { 
            id: 'vsav', name: 'VSAV', roles: [
                { id: 'ch_agr_vsav', name: 'Chef d\'agrès', qualificationId: 'ca_vsav' },
                { id: 'cond_vsav', name: 'Conducteur', qualificationId: 'cod_0' },
                { id: 'eq_vsav', name: 'Équipier', qualificationId: 'eq_vsav' }, // Rôle unique pour Equipier
            ]
        },
        { 
            id: 'vtu', name: 'VTU', roles: [
                { id: 'ch_agr_vtu', name: 'Chef d\'agrès', qualificationId: 'ca_vtu' },
                { id: 'cond_vtu', name: 'Conducteur', qualificationId: 'cod_0' },
                { id: 'eq_vtu', name: 'Équipier', qualificationId: 'eq_vtu' }, // Rôle unique pour Equipier
            ]
        },
        { 
            id: 'vpma', name: 'VPMA', roles: [
                { id: 'ch_agr_vpma', name: 'Chef d\'agrès', qualificationId: 'ca_vpma' },
                { id: 'cond_vpma', name: 'Conducteur', qualificationId: 'cod_0' },
                { id: 'eq_vpma', name: 'Équipier', qualificationId: 'eq_vpma' }, // Rôle unique pour Equipier
            ]
        }
    ];

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
            const idsToSave = onDutyAgentIdsToSave || onCallAgents.map(agent => agent.id);

            const response = await fetch(`${API_BASE_URL}/api/daily-roster/${dateKey}`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ onDutyAgents: idsToSave })
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
            
            onCallAgents = data.onCall || [];
            availablePersonnel = data.available || []; // availablePersonnel contient maintenant les qualifications

            await loadDailyRosterSlots(dateKey); // Charge les créneaux journaliers spécifiques
            
        } catch (error) {
            console.error('Erreur lors du chargement des données de la feuille de garde :', error);
            await showModal('Erreur de chargement', `Impossible de charger les données : ${error.message}`);
            availablePersonnel = [];
            onCallAgents = [];
            dailyRosterSlots = [];
        } finally {
            renderAvailablePersonnel(); // Va filtrer selon activeQualificationFilter
            renderOnCallAgents();
            renderDailyRosterSlots();
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
            
            // Assurez-vous que dailyRosterSlots est un tableau d'objets, et que chaque objet a assignedEngines
            // Initialise assignedEngines avec une structure vide pour chaque rôle si non présente
            dailyRosterSlots = (data.timeSlots || []).map(slot => {
                const newSlot = { ...slot };
                newSlot.assignedEngines = newSlot.assignedEngines || {};
                
                // Assurer que chaque engin a une structure de rôle vide si elle n'existe pas
                centerEngines.forEach(engine => {
                    newSlot.assignedEngines[engine.id] = newSlot.assignedEngines[engine.id] || {}; // Objet pour les rôles de cet engin
                    engine.roles.forEach(role => {
                        // S'assurer que le rôle est initialisé à null s'il n'y a pas d'agent assigné
                        // Ou conserver l'agent assigné s'il existe déjà dans les données chargées
                        newSlot.assignedEngines[engine.id][role.id] = newSlot.assignedEngines[engine.id][role.id] || null;
                    });
                });
                return newSlot;
            });
            console.log("Créneaux journaliers chargés:", dailyRosterSlots);

        } catch (error) {
            console.error('Erreur de chargement des créneaux journaliers :', error);
            dailyRosterSlots = []; 
        }
    };


    // Rend les agents dans la section "Personnel Disponible" (sources de drag)
    const renderAvailablePersonnel = () => {
        availablePersonnelList.innerHTML = '';
        noAvailablePersonnelMessage.style.display = 'none'; // Cacher par défaut

        let personnelToRender = availablePersonnel;

        // Appliquer le filtre si actif
        if (activeQualificationFilter) {
            personnelToRender = availablePersonnel.filter(agent => 
                agent.qualifications && agent.qualifications.includes(activeQualificationFilter)
            );
        }

        if (personnelToRender.length === 0) {
            noAvailablePersonnelMessage.style.display = 'block';
            if (activeQualificationFilter) {
                 noAvailablePersonnelMessage.textContent = `Aucun personnel disponible avec la qualification : "${activeQualificationFilter}"`;
            } else {
                 noAvailablePersonnelMessage.textContent = 'Aucun personnel disponible pour la date sélectionnée.';
            }
        } else {
            personnelToRender.forEach(agent => {
                const agentCard = document.createElement('div');
                agentCard.className = 'agent-card';
                // Ajouter la classe 'filtered' si l'agent est affiché en raison du filtre actif
                if (activeQualificationFilter) {
                    agentCard.classList.add('filtered');
                }
                agentCard.textContent = agent.username;
                agentCard.draggable = true;
                agentCard.dataset.agentId = agent.id;
                agentCard.dataset.agentName = agent.username;

                agentCard.addEventListener('dragstart', (e) => {
                    e.dataTransfer.setData('text/plain', JSON.stringify({ id: agent.id, username: agent.username }));
                    e.dataTransfer.effectAllowed = 'move'; // Peut être déplacé vers un rôle
                });

                // --- Affichage des créneaux de disponibilité (maintenant via CSS hover) ---
                if (agent.availabilities && agent.availabilities.length > 0) {
                    const tooltip = document.createElement('div');
                    tooltip.className = 'availability-tooltip';
                    const slotsText = agent.availabilities.map(slotRange => {
                        const startH = horaires[slotRange.start] ? horaires[slotRange.start].split(' - ')[0] : 'Inconnu';
                        const endH = horaires[slotRange.end] ? horaires[slotRange.end].split(' - ')[1] : 'Inconnu';
                        return `${startH} - ${endH}`;
                    }).join('<br>');

                    tooltip.innerHTML = `
                        <strong>Disponibilité:</strong><br>
                        ${slotsText}
                        <br><strong>Qualifications:</strong><br>
                        ${(agent.qualifications || []).join(', ') || 'Aucune'}
                    `;
                    agentCard.appendChild(tooltip);
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
                // ATTENTION: suppression de agentCard.textContent pour éviter l'écrasement de innerHTML
                // agentCard.textContent = agent.username || agent.name; 
                agentCard.draggable = true;
                agentCard.dataset.agentId = agent.id;
                agentCard.dataset.agentName = agent.username || agent.name; // Fallback

                // Le nom de l'agent est maintenant inclus directement dans innerHTML
                agentCard.innerHTML = `
                    <span>${agent.username || agent.name}</span>
                    <button class="remove-on-call-agent-tag" data-agent-id="${agent.id}" aria-label="Supprimer cet agent de la liste d'astreinte">x</button>
                `;

                // Configure le dragstart pour les agents d'astreinte (vers les créneaux journaliers)
                agentCard.addEventListener('dragstart', (e) => {
                    e.dataTransfer.setData('text/plain', JSON.stringify({ id: agent.id, username: agent.username || agent.name })); // Assurez-vous de passer 'username'
                    e.dataTransfer.effectAllowed = 'move'; // Peut être déplacé vers un créneau/engin
                });

                // Écouteur pour le bouton de suppression de l'agent d'astreinte
                // Le querySelector trouvera maintenant le bouton car il est bien dans le innerHTML
                const removeButton = agentCard.querySelector('.remove-on-call-agent-tag');
                if (removeButton) { // Vérification de sécurité, bien que non strictement nécessaire après la correction
                    removeButton.addEventListener('click', (e) => {
                        const agentIdToRemove = e.target.dataset.agentId;
                        removeAgentFromOnCallList(agentIdToRemove);
                    });
                }


                onCallAgentsGrid.appendChild(agentCard);
            });
        }
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

        // Assurez-vous que assignedEngines est initialisé pour ce slot
        slot.assignedEngines = slot.assignedEngines || {};
        centerEngines.forEach(engine => {
            slot.assignedEngines[engine.id] = slot.assignedEngines[engine.id] || {};
            engine.roles.forEach(role => {
                slot.assignedEngines[engine.id][role.id] = slot.assignedEngines[engine.id][role.id] || null; // Peut contenir un agent ou être null
            });
        });

        // Construction du HTML pour les engins et leurs rôles dans le créneau
        const enginsHtml = centerEngines.map(engine => {
            const rolesHtml = engine.roles.map(role => {
                const assignedAgent = slot.assignedEngines[engine.id][role.id];
                const agentName = assignedAgent ? (assignedAgent.username || assignedAgent.name) : 'Libre';
                const assignedClass = assignedAgent ? 'assigned' : 'unassigned';
                
                return `
                    <div class="role-slot ${assignedClass}" 
                         data-engine-id="${engine.id}" 
                         data-role-id="${role.id}" 
                         data-slot-id="${slot.id}"
                         data-qualification-id="${role.qualificationId}">
                        <div class="role-name">${role.name}</div>
                        <div class="agent-assignment">
                            ${assignedAgent ? `
                                <span class="assigned-agent-tag" data-agent-id="${assignedAgent.id}">
                                    ${agentName}
                                    <button class="remove-assigned-agent-from-role" 
                                            data-agent-id="${assignedAgent.id}" 
                                            data-engine-id="${engine.id}" 
                                            data-role-id="${role.id}" 
                                            data-slot-id="${slot.id}" 
                                            aria-label="Retirer l'agent de ce rôle">x</button>
                                </span>
                            ` : `<span class="placeholder-text">Glisser agent ici</span>`}
                        </div>
                    </div>
                `;
            }).join('');

            return `
                <div class="engine-block">
                    <h3>${engine.name}</h3>
                    <div class="roles-container">
                        ${rolesHtml}
                    </div>
                </div>
            `;
        }).join('');

        div.innerHTML = `
            <div class="time-slot-header">
                <input type="time" class="time-input start-time" value="${slot.startTime}">
                <span>-</span>
                <input type="time" class="time-input end-time" value="${slot.endTime}">
                <button class="remove-slot-button" aria-label="Supprimer ce créneau">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trash"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                </button>
            </div>
            <div class="time-slot-content">
                <div class="engines-container">
                    ${enginsHtml}
                </div>
            </div>
        `;

        // Add event listeners for time inputs
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

        // Add event listener for removing the entire slot
        div.querySelector('.remove-slot-button').addEventListener('click', async () => {
            await removeDailyRosterSlot(slot.id);
            await saveDailyRosterSlotsToBackend(); // Save after removal
        });

        // Setup drop zones and click listeners for each role slot
        div.querySelectorAll('.role-slot').forEach(roleDropZone => {
            setupRoleDropZone(roleDropZone, slot.id);
            roleDropZone.addEventListener('click', (e) => {
                // Si l'agent est cliqué à l'intérieur du rôle (cible de suppression), ne pas filtrer
                if (e.target.classList.contains('remove-assigned-agent-from-role')) {
                    return;
                }
                const qualificationId = roleDropZone.dataset.qualificationId;
                if (activeQualificationFilter === qualificationId) {
                    activeQualificationFilter = null; // Désactiver le filtre si on clique deux fois
                } else {
                    activeQualificationFilter = qualificationId; // Activer le filtre
                }
                renderAvailablePersonnel(); // Re-rendre la liste avec le filtre
            });
        });

        // Add event listeners for removing agents from role slots
        div.querySelectorAll('.remove-assigned-agent-from-role').forEach(button => {
            button.addEventListener('click', async (e) => {
                e.stopPropagation(); // Empêche le clic de se propager au role-slot parent
                const agentIdToRemove = e.target.dataset.agentId;
                const engineId = e.target.dataset.engineId;
                const roleId = e.target.dataset.roleId;
                const slotId = e.target.dataset.slotId;
                await removeAgentFromSlotRole(slotId, engineId, roleId, agentIdToRemove);
                await saveDailyRosterSlotsToBackend(); // Save after de-assignment
            });
        });

        return div;
    };

    // Met à jour la synthèse des engins
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

            let hasAssignmentsInSlot = false;
            centerEngines.forEach(engine => {
                let agentsAssignedToEngineRoles = []; // Pour stocker les agents par rôle dans cet engin
                engine.roles.forEach(role => {
                    const assignedAgent = slot.assignedEngines[engine.id][role.id];
                    if (assignedAgent) {
                        agentsAssignedToEngineRoles.push(`${role.name}: ${assignedAgent.username || assignedAgent.name}`);
                        hasAssignmentsInSlot = true;
                    }
                });

                if (agentsAssignedToEngineRoles.length > 0) {
                    synthesisSlotDiv.innerHTML += `
                        <div class="synthesis-engine-item">
                            <strong>${engine.name}:</strong>
                            <span class="assigned">${agentsAssignedToEngineRoles.join('; ')}</span>
                        </div>
                    `;
                }
            });

            if (!hasAssignmentsInSlot) {
                synthesisSlotDiv.innerHTML += `
                    <div class="synthesis-engine-item">
                        <strong>Aucun agent affecté aux engins pour ce créneau.</strong>
                    </div>
                `;
            }
            enginsSynthesisContent.appendChild(synthesisSlotDiv);
        });
    };


    // --- Logique des événements ---

    prevDayButton.addEventListener('click', () => {
        currentDate.setDate(currentDate.getDate() - 1);
        activeQualificationFilter = null; // Réinitialiser le filtre en changeant de jour
        updateDateAndLoadData();
    });

    nextDayButton.addEventListener('click', () => {
        currentDate.setDate(currentDate.getDate() + 1);
        activeQualificationFilter = null; // Réinitialiser le filtre en changeant de jour
        updateDateAndLoadData();
    });

    rosterDateInput.addEventListener('change', (e) => {
        currentDate = new Date(e.target.value);
        activeQualificationFilter = null; // Réinitialiser le filtre en changeant de jour
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
            assignedAgents: [], // Gardé pour compatibilité mais non utilisé directement ici
            assignedEngines: {} // Initialisé avec des objets vides pour chaque engin/rôle
        };
        centerEngines.forEach(engine => {
            newSlot.assignedEngines[engine.id] = {};
            engine.roles.forEach(role => {
                newSlot.assignedEngines[engine.id][role.id] = null;
            });
        });

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
            assignedAgents: [],
            assignedEngines: {}
        };
        centerEngines.forEach(engine => {
            newSlot.assignedEngines[engine.id] = {};
            engine.roles.forEach(role => {
                newSlot.assignedEngines[engine.id][role.id] = null;
            });
        });
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
            const agentToAdd = { id: agentData.id, username: agentData.username }; 

            const currentOnCallAgentIds = onCallAgents.map(a => a.id);
            let newOnDutyAgentIds = [...currentOnCallAgentIds];

            if (!currentOnCallAgentIds.includes(agentToAdd.id)) {
                newOnDutyAgentIds.push(agentToAdd.id);
            } else {
                await showModal('Agent déjà d\'astreinte', `L'agent ${agentToAdd.username} est déjà dans la liste des agents d'astreinte selon le serveur. L'interface va se rafraîchir pour assurer la cohérence.`, false);
                await updateDateAndLoadData(); 
                return; 
            }
            
            toggleLoader(true); 
            const success = await saveOnCallAgentsToBackend(newOnDutyAgentIds); 

            if (!success) {
                await showModal('Erreur de sauvegarde', 'La sélection de l\'agent d\'astreinte n\'a pas pu être sauvegardée par le serveur. L\'interface va se resynchroniser pour refléter l\'état actuel du serveur. Veuillez réessayer.', false);
            } else {
                console.log(`Agent ${agentToAdd.username} ajouté aux agents d'astreinte et sauvegardé.`);
            }
            
            await updateDateAndLoadData(); 
            toggleLoader(false); 
        });
    };

    const removeAgentFromOnCallList = async (agentId) => {
        const confirm = await showModal(
            'Confirmer la suppression',
            'Êtes-vous sûr de vouloir retirer cet agent de la liste des agents d\'astreinte ?',
            true
        );
        if (confirm) {
            const newOnDutyAgentIds = onCallAgents.filter(agent => agent.id !== agentId).map(a => a.id);
            
            // Retirer l'agent de tous les créneaux et engins où il est affecté localement
            dailyRosterSlots.forEach(slot => {
                // Suppression de l'affectation de tout rôle dans tout engin dans ce créneau
                for (const engineId in slot.assignedEngines) {
                    for (const roleId in slot.assignedEngines[engineId]) {
                        if (slot.assignedEngines[engineId][roleId] && slot.assignedEngines[engineId][roleId].id === agentId) {
                            slot.assignedEngines[engineId][roleId] = null;
                        }
                    }
                }
            });

            toggleLoader(true); 
            const saveOnCallSuccess = await saveOnCallAgentsToBackend(newOnDutyAgentIds); 
            const saveRosterSuccess = await saveDailyRosterSlotsToBackend(); 

            if (!saveOnCallSuccess || !saveRosterSuccess) {
                 await showModal('Erreur de sauvegarde', 'La suppression de l\'agent d\'astreinte n\'a pas pu être sauvegardée par le serveur. L\'interface va se resynchroniser.');
            } else {
                console.log(`Agent ${agentId} retiré de la liste d'astreinte localement. Synchronisation avec le backend effectuée.`);
            }
            await updateDateAndLoadData(); 
            toggleLoader(false); 
        }
    };

    // --- Setup pour les zones de drop des RÔLES spécifiques aux engins ---
    const setupRoleDropZone = (roleDropZoneElement, slotId) => {
        roleDropZoneElement.addEventListener('dragover', (e) => {
            e.preventDefault();
            // Optional: check qualification here for visual feedback
            const agentData = JSON.parse(e.dataTransfer.getData('text/plain'));
            const requiredQualificationId = roleDropZoneElement.dataset.qualificationId;
            const agentInOnCall = onCallAgents.find(a => a.id === agentData.id);

            // Vérifier si l'agent existe et s'il a la qualification requise
            if (agentInOnCall && (!requiredQualificationId || (agentInOnCall.qualifications && agentInOnCall.qualifications.includes(requiredQualificationId)))) {
                 roleDropZoneElement.classList.add('drag-over'); // Style pour drop valide
            } else {
                 roleDropZoneElement.classList.add('drag-over-invalid'); // Style pour drop invalide
                 e.dataTransfer.dropEffect = 'none'; // Empêche le drop
            }
        });

        roleDropZoneElement.addEventListener('dragleave', () => {
            roleDropZoneElement.classList.remove('drag-over');
            roleDropZoneElement.classList.remove('drag-over-invalid');
        });

        roleDropZoneElement.addEventListener('drop', async (e) => {
            e.preventDefault();
            roleDropZoneElement.classList.remove('drag-over');
            roleDropZoneElement.classList.remove('drag-over-invalid');

            const agentData = JSON.parse(e.dataTransfer.getData('text/plain'));
            const agentToAssign = { id: agentData.id, username: agentData.username };
            const engineId = roleDropZoneElement.dataset.engineId;
            const roleId = roleDropZoneElement.dataset.roleId;
            const requiredQualificationId = roleDropZoneElement.dataset.qualificationId;
            
            const fullAgent = onCallAgents.find(a => a.id === agentToAssign.id);

            // 1. Vérifier si l'agent est bien dans la liste des agents d'astreinte
            if (!fullAgent) {
                await showModal('Agent non éligible', 'Seuls les agents de la section "Agents d\'astreinte" peuvent être assignés aux rôles des engins.', false);
                return;
            }

            // 2. Vérifier la qualification
            if (requiredQualificationId && (!fullAgent.qualifications || !fullAgent.qualifications.includes(requiredQualificationId))) {
                const roleName = roleDropZoneElement.querySelector('.role-name').textContent;
                const engineName = centerEngines.find(e => e.id === engineId)?.name || engineId.toUpperCase();
                await showModal('Qualification requise', `L'agent "${fullAgent.username}" ne possède pas la qualification requise ("${requiredQualificationId}") pour le rôle "${roleName}" de l'engin "${engineName}".`, false);
                return; // Empêche le drop
            }


            const slot = dailyRosterSlots.find(s => s.id === slotId);
            if (slot) {
                // Si le rôle est déjà assigné à un agent, demander confirmation pour remplacer
                if (slot.assignedEngines[engineId][roleId]) {
                    const replaceConfirm = await showModal(
                        'Remplacer l\'agent ?',
                        `Le rôle "${roleDropZoneElement.querySelector('.role-name').textContent}" est déjà assigné à "${slot.assignedEngines[engineId][roleId].username}". Voulez-vous le remplacer par "${agentToAssign.username}" ?`,
                        true
                    );
                    if (!replaceConfirm) {
                        return; // Annuler le drop
                    }
                }

                // Retirer l'agent de TOUS les autres rôles de ce MÊME créneau s'il y était
                centerEngines.forEach(eng => {
                    eng.roles.forEach(rol => {
                        if (slot.assignedEngines[eng.id] && slot.assignedEngines[eng.id][rol.id] && 
                            slot.assignedEngines[eng.id][rol.id].id === agentToAssign.id &&
                            !(eng.id === engineId && rol.id === roleId)) { // Ne pas retirer du rôle actuel si c'est le même
                            slot.assignedEngines[eng.id][rol.id] = null;
                        }
                    });
                });
                
                // Assigner l'agent au rôle actuel
                slot.assignedEngines[engineId][roleId] = agentToAssign;
                renderDailyRosterSlots(); // Re-render le créneau pour voir le changement
                updateEnginsSynthesis(); // Mettre à jour la synthèse
                console.log(`Agent ${agentToAssign.username} assigné au rôle ${roleId} de l'engin ${engineId} du créneau ${slotId}.`);

                toggleLoader(true);
                const saveSuccess = await saveDailyRosterSlotsToBackend();
                if (!saveSuccess) {
                    await showModal('Erreur d\'affectation', 'L\'affectation de l\'agent à ce rôle n\'a pas pu être sauvegardée. Veuillez réessayer.');
                }
                await updateDateAndLoadData(); // Toujours resynchroniser
                toggleLoader(false);
            }
        });
    };

    // Fonction pour retirer un agent d'un rôle spécifique dans un créneau
    const removeAgentFromSlotRole = async (slotId, engineId, roleId, agentId) => {
        const confirm = await showModal(
            'Confirmer la suppression',
            'Êtes-vous sûr de vouloir retirer cet agent de ce rôle ?',
            true
        );
        if (confirm) {
            const slot = dailyRosterSlots.find(s => s.id === slotId);
            if (slot && slot.assignedEngines[engineId] && slot.assignedEngines[engineId][roleId]) {
                slot.assignedEngines[engineId][roleId] = null; // Dé-assigner l'agent
                renderDailyRosterSlots(); // Re-render pour voir le changement
                updateEnginsSynthesis(); // Mettre à jour la synthèse
                console.log(`Agent ${agentId} retiré du rôle ${roleId} de l'engin ${engineId} du créneau ${slotId}.`);

                toggleLoader(true);
                const saveSuccess = await saveDailyRosterSlotsToBackend();
                if (!saveSuccess) {
                    await showModal('Erreur de suppression', 'La suppression de l\'affectation de l\'agent n\'a pas pu être sauvegardée. Veuillez réessayer.');
                }
                await updateDateAndLoadData(); // Toujours resynchroniser
                toggleLoader(false);
                return saveSuccess;
            }
            return false;
        }
        return false;
    };


    const removeDailyRosterSlot = async (slotId) => {
        const confirm = await showModal(
            'Confirmer la suppression',
            'Êtes-vous sûr de vouloir supprimer ce créneau horaire ?',
            true
        );
        if (confirm) {
            dailyRosterSlots = dailyRosterSlots.filter(s => s.id !== slotId);
            renderDailyRosterSlots();
            updateEnginsSynthesis();
            console.log(`Créneau ${slotId} supprimé.`);
            toggleLoader(true); 
            const saveSuccess = await saveDailyRosterSlotsToBackend(); 
            if (!saveSuccess) {
                await showModal('Erreur de suppression', 'La suppression du créneau n\'a pas pu être sauvegardée. Veuillez réessayer.');
            }
            await updateDateAndLoadData(); 
            toggleLoader(false); 
            return saveSuccess; 
        }
        return false;
    };

    generateAutoButton.addEventListener('click', async () => {
        toggleLoader(true);
        await showModal('Génération automatique', 'Lancement de la génération automatique de la feuille de garde. Cela peut prendre quelques instants...', false);
        console.log('Déclenchement de la génération automatique...');

        dailyRosterSlots = []; // Réinitialise les créneaux pour la génération

        // Crée des créneaux par défaut
        const defaultSlots = [
            { id: `slot-${Date.now()}-1`, startTime: '07:00', endTime: '15:00' },
            { id: `slot-${Date.now()}-2`, startTime: '15:00', endTime: '23:00' },
            { id: `slot-${Date.now()}-3`, startTime: '23:00', endTime: '07:00' } // Jour suivant
        ];

        defaultSlots.forEach(s => {
            const newSlot = { ...s, assignedAgents: [], assignedEngines: {} };
            centerEngines.forEach(engine => {
                newSlot.assignedEngines[engine.id] = {};
                engine.roles.forEach(role => {
                    newSlot.assignedEngines[engine.id][role.id] = null; // Initialise null
                });
            });
            dailyRosterSlots.push(newSlot);
        });

        // Tente d'assigner les agents aux rôles en respectant les qualifications
        dailyRosterSlots.forEach(slot => {
            centerEngines.forEach(engine => {
                engine.roles.forEach(role => {
                    // Trouver un agent d'astreinte disponible (non assigné dans ce slot) qui a la qualification requise
                    const foundAgent = onCallAgents.find(agent => 
                        !Object.values(slot.assignedEngines).some(engineRoles => 
                            Object.values(engineRoles).some(assigned => assigned && assigned.id === agent.id)
                        ) && // S'assurer que l'agent n'est pas déjà assigné à un autre rôle dans ce même créneau
                        (agent.qualifications && agent.qualifications.includes(role.qualificationId)) // Vérifier la qualification
                    );

                    if (foundAgent) {
                        slot.assignedEngines[engine.id][role.id] = { id: foundAgent.id, username: foundAgent.username };
                    } else {
                        console.warn(`Aucun agent d'astreinte qualifié ("${role.qualificationId}") et disponible trouvé pour le rôle "${role.name}" de l'engin "${engine.name}" dans le créneau "${slot.startTime}-${slot.endTime}".`);
                    }
                });
            });
        });

        const success = await saveDailyRosterSlotsToBackend();

        setTimeout(async () => {
            if (success) {
                await updateDateAndLoadData();
                toggleLoader(false);
                showModal('Génération terminée', 'La feuille de garde a été générée automatiquement avec succès avec affectation aux engins.');
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
