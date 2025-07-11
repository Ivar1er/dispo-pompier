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

    // Variable globale pour stocker l'ID de l'agent en cours de glissement
    let draggingAgentId = null; 

    // --- Constantes et Helpers (copiés de admin.js pour la cohérence des créneaux horaires) ---
    const API_BASE_URL = "https://dispo-pompier.onrender.com"; // Assurez-vous que c'est la bonne URL
    
    // Génère des points de temps par intervalles de 30 minutes sur 24h, de 00:00 à 23:30.
    // Cela sera utilisé pour les sélecteurs d'heure.
    const timePoints = [];
    for (let h = 0; h < 24; h++) {
        for (let m = 0; m < 60; m += 30) {
            timePoints.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
        }
    }

    // Définition des horaires complets (pour affichage dans tooltips par exemple)
    // Cette constante "horaires" sert à mapper les index de disponibilité aux heures lisibles.
    // Elle ne sert pas pour les dropdowns d'heures directement.
    const horaires = [];
    const startHourDisplay = 7; // L'affichage démarre à 07h00
    for (let i = 0; i < 48; i++) { // 48 créneaux de 30 min sur 24h
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
                { id: 'ch_agr_fpt', name: 'Chef d\'agrès', qualificationId: 'ca_fpt', type: 'CA' },
                { id: 'cond_fpt', name: 'Conducteur', qualificationId: 'cod_1', type: 'CD' },
                { id: 'eq1_fpt', name: 'Équipier 1', qualificationId: 'eq1_fpt', type: 'EQ' },
                { id: 'eq2_fpt', name: 'Équipier 2', qualificationId: 'eq2_fpt', type: 'EQ' },
            ]
        },
        { 
            id: 'ccf', name: 'CCF', roles: [
                { id: 'ch_agr_ccf', name: 'Chef d\'agrès', qualificationId: 'ca_ccf', type: 'CA' },
                { id: 'cond_ccf', name: 'Conducteur', qualificationId: 'cod_2', type: 'CD' },
                { id: 'eq1_ccf', name: 'Équipier 1', qualificationId: 'eq1_ccf', type: 'EQ' },
                { id: 'eq2_ccf', name: 'Équipier 2', qualificationId: 'eq2_ccf', type: 'EQ' },
            ]
        },
        { 
            id: 'vsav', name: 'VSAV', roles: [
                { id: 'ch_agr_vsav', name: 'Chef d\'agrès', qualificationId: 'ca_vsav', type: 'CA' },
                { id: 'cond_vsav', name: 'Conducteur', qualificationId: 'cod_0', type: 'CD' },
                { id: 'eq_vsav', name: 'Équipier', qualificationId: 'eq_vsav', type: 'EQ' }, 
            ]
        },
        { 
            id: 'vtu', name: 'VTU', roles: [
                { id: 'ch_agr_vtu', name: 'Chef d\'agrès', qualificationId: 'ca_vtu', type: 'CA' },
                { id: 'cond_vtu', name: 'Conducteur', qualificationId: 'cod_0', type: 'CD' },
                { id: 'eq_vtu', name: 'Équipier', qualificationId: 'eq_vtu', type: 'EQ' }, 
            ]
        },
        { 
            id: 'vpma', name: 'VPMA', roles: [
                { id: 'ch_agr_vpma', name: 'Chef d\'agrès', qualificationId: 'ca_vpma', type: 'CA' },
                { id: 'cond_vpma', name: 'Conducteur', qualificationId: 'cod_0', type: 'CD' },
                { id: 'eq_vpma', name: 'Équipier', qualificationId: 'eq_vpma', type: 'EQ' }, 
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
            availablePersonnel = []; // Réinitialise les données si erreur
            onCallAgents = [];
            dailyRosterSlots = [];
        } finally {
            renderAvailablePersonnel(); // Va filtrer selon activeQualificationFilter
            renderOnCallAgents();
            renderDailyRosterSlots();
            // Appel initial de la fonction de mise à jour visuelle des engins pour tous les slots
            dailyRosterSlots.forEach(slot => updateEngineAvailabilityVisuals(slot.id));
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
                    const agentDataString = JSON.stringify({ id: agent.id, username: agent.username });
                    e.dataTransfer.setData('text/plain', agentDataString);
                    e.dataTransfer.effectAllowed = 'move'; // Peut être déplacé vers un rôle
                    draggingAgentId = agent.id; // Stocke l'ID globalement
                    console.log('Dragstart (Personnel Disponible): Setting data for agent', agent.id, ':', agentDataString);
                });
                // Nouvelle écouteur pour dragend pour nettoyer draggingAgentId
                agentCard.addEventListener('dragend', () => {
                    draggingAgentId = null; 
                    console.log('Dragend: draggingAgentId reset.');
                });

                // --- Affichage des créneaux de disponibilité (maintenant via CSS hover) ---
                if (agent.availabilities && agent.availabilities.length > 0) {
                    const tooltip = document.createElement('div');
                    tooltip.className = 'availability-tooltip';
                    const slotsText = agent.availabilities.map(slotRange => {
                        // Utiliser les index pour mapper aux horaires complets si nécessaire pour l'affichage de la tooltip
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
                agentCard.draggable = true;
                agentCard.dataset.agentId = agent.id;
                agentCard.dataset.agentName = agent.username || agent.name; // Fallback

                // Le nom de l'agent est inclus directement dans innerHTML
                agentCard.innerHTML = `
                    <span>${agent.username || agent.name}</span>
                    <button class="remove-on-call-agent-tag" data-agent-id="${agent.id}" aria-label="Supprimer cet agent de la liste d'astreinte">x</button>
                `;

                // Configure le dragstart pour les agents d'astreinte (vers les créneaux journaliers)
                agentCard.addEventListener('dragstart', (e) => {
                    const agentDataString = JSON.stringify({ id: agent.id, username: agent.username || agent.name });
                    e.dataTransfer.setData('text/plain', agentDataString);
                    e.dataTransfer.effectAllowed = 'move'; // Peut être déplacé vers un créneau/engin
                    draggingAgentId = agent.id; // Stocke l'ID globalement
                    console.log('Dragstart (Agents d\'astreinte): Setting data for agent', agent.id, ':', agentDataString);
                });
                // Nouvelle écouteur pour dragend pour nettoyer draggingAgentId
                agentCard.addEventListener('dragend', () => {
                    draggingAgentId = null; 
                    console.log('Dragend: draggingAgentId reset.');
                });

                // Écouteur pour le bouton de suppression de l'agent d'astreinte
                const removeButton = agentCard.querySelector('.remove-on-call-agent-tag');
                if (removeButton) {
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
            // Important: trier les créneaux pour garantir l'ordre chronologique
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

        // Génère les options pour les sélecteurs d'heure
        const generateTimeOptions = (selectedTime) => {
            return timePoints.map(time => `<option value="${time}" ${time === selectedTime ? 'selected' : ''}>${time}</option>`).join('');
        };

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
                <div class="engine-block" data-engine-id="${engine.id}">
                    <h3>${engine.name}</h3>
                    <div class="roles-container">
                        ${rolesHtml}
                    </div>
                    <div class="indispo-overlay">INDISPO</div>
                </div>
            `;
        }).join('');

        div.innerHTML = `
            <div class="time-slot-header">
                <select class="time-input start-time">${generateTimeOptions(slot.startTime)}</select>
                <span>-</span>
                <select class="time-input end-time">${generateTimeOptions(slot.endTime)}</select>
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

        // Add event listeners for time inputs (now select elements)
        const startTimeSelect = div.querySelector('.start-time');
        const endTimeSelect = div.querySelector('.end-time');

        startTimeSelect.addEventListener('change', async (e) => {
            slot.startTime = e.target.value; // Update local state
            await saveDailyRosterSlotsToBackend(); // Save after local update
            updateEngineAvailabilityVisuals(slot.id); // Update visuals after change
        });
        
        endTimeSelect.addEventListener('change', async (e) => {
            const newEndTime = e.target.value;
            const oldEndTime = slot.endTime; // Garder l'ancienne valeur pour la comparaison
            slot.endTime = newEndTime; // Update local state

            // Trouver l'index du créneau actuel
            const currentSlotIndex = dailyRosterSlots.findIndex(s => s.id === slot.id);

            // Si le créneau suivant existe et qu'il démarrait à l'ancienne heure de fin, mettez à jour son heure de début
            if (currentSlotIndex !== -1 && currentSlotIndex + 1 < dailyRosterSlots.length) {
                const nextSlot = dailyRosterSlots[currentSlotIndex + 1];
                // Vérifier si le créneau suivant démarre exactement là où ce créneau finissait avant la modification
                if (nextSlot.startTime === oldEndTime) {
                    nextSlot.startTime = newEndTime; // Mettre à jour l'heure de début du créneau suivant
                    console.log(`Mise à jour du créneau suivant : ${nextSlot.id} démarre maintenant à ${newEndTime}`);
                }
            }
            
            // Logique pour ajouter un nouveau créneau si c'est le dernier ou si les créneaux ne sont pas consécutifs
            // Vérifier s'il y a un créneau suivant, et si son début n'est PAS égal à la nouvelle fin du créneau actuel
            if (currentSlotIndex === dailyRosterSlots.length - 1 || // Si c'est le dernier créneau
                (currentSlotIndex !== -1 && dailyRosterSlots[currentSlotIndex + 1]?.startTime !== newEndTime)) 
            {
                // Vérifier si le nouveau créneau irait au-delà de 23:30 ou si la fin est la même que le début (éviter boucle)
                // ou si l'heure de fin est 07:00 (heure de fin de cycle journalier)
                if (newEndTime !== '07:00' && newEndTime !== '00:00') { // Éviter de créer un créneau si on finit le cycle
                    await createConsecutiveSlot(newEndTime);
                } else {
                     console.log("Fin de cycle ou heure non propice pour un créneau consécutif automatique.");
                }
            }

            await saveDailyRosterSlotsToBackend(); // Save after local update and potential new slot creation
            renderDailyRosterSlots(); // Re-render pour refléter les changements (heures, nouveaux slots)
            dailyRosterSlots.forEach(s => updateEngineAvailabilityVisuals(s.id)); // Mettre à jour tous les visuels
        });


        // Add event listener for removing the entire slot
        div.querySelector('.remove-slot-button').addEventListener('click', async () => {
            await removeDailyRosterSlot(slot.id);
            // La sauvegarde est déjà faite dans removeDailyRosterSlot
            // Pas besoin d'appeler updateEngineAvailabilityVisuals ici car le slot est supprimé
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
                // La sauvegarde est déjà faite dans removeAgentFromSlotRole
                // updateEngineAvailabilityVisuals(slotId) sera appelée par le re-render ou la synchronisation
            });
        });

        return div;
    };


    /**
     * Met à jour l'affichage de la disponibilité des engins pour un créneau donné,
     * en appliquant un overlay "INDISPO" si les conditions de personnel ne sont pas remplies.
     * @param {string} slotId L'ID du créneau horaire à évaluer.
     */
    const updateEngineAvailabilityVisuals = (slotId) => {
        const slot = dailyRosterSlots.find(s => s.id === slotId);
        if (!slot) return;

        // Récupère l'élément DOM du créneau horaire
        const slotElement = document.querySelector(`.time-slot[data-slot-id="${slotId}"]`);
        if (!slotElement) return;

        centerEngines.forEach(engineDef => {
            const engineBlockElement = slotElement.querySelector(`.engine-block[data-engine-id="${engineDef.id}"]`);
            if (!engineBlockElement) return;

            const assignedAgentsInEngine = {};
            let totalAssigned = 0;

            // Collecte les agents assignés par type de rôle pour cet engin et compte le total
            engineDef.roles.forEach(roleDef => {
                const assignedAgent = slot.assignedEngines[engineDef.id][roleDef.id];
                if (assignedAgent) {
                    assignedAgentsInEngine[roleDef.type] = assignedAgentsInEngine[roleDef.type] || [];
                    assignedAgentsInEngine[roleDef.type].push(assignedAgent);
                    totalAssigned++;
                }
            });

            let isDispo = true;

            if (engineDef.id === 'fpt' || engineDef.id === 'ccf') {
                // Conditions pour FPT et CCF: 3 personnel minimum (CA, CD, EQ)
                const hasCA = (assignedAgentsInEngine['CA'] && assignedAgentsInEngine['CA'].length > 0);
                const hasCD = (assignedAgentsInEngine['CD'] && assignedAgentsInEngine['CD'].length > 0);
                const hasEQ = (assignedAgentsInEngine['EQ'] && assignedAgentsInEngine['EQ'].length > 0);
                
                if (!(hasCA && hasCD && hasEQ && totalAssigned >= 3)) {
                    isDispo = false;
                }
            } else if (['vsav', 'vtu', 'vpma'].includes(engineDef.id)) {
                // Conditions pour VSAV, VTU, VPMA: 2 personnel minimum (CD et (CA ou EQ))
                const hasCD = (assignedAgentsInEngine['CD'] && assignedAgentsInEngine['CD'].length > 0);
                const hasCAOrEQ = ( (assignedAgentsInEngine['CA'] && assignedAgentsInEngine['CA'].length > 0) || 
                                    (assignedAgentsInEngine['EQ'] && assignedAgentsInEngine['EQ'].length > 0) );

                if (!(hasCD && hasCAOrEQ && totalAssigned >= 2)) {
                    isDispo = false;
                }
            }
            
            // Applique ou retire la classe 'is-indispo'
            if (isDispo) {
                engineBlockElement.classList.remove('is-indispo');
            } else {
                engineBlockElement.classList.add('is-indispo');
            }
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
            startTime: '07:00', // Valeur par défaut
            endTime: '07:00',   // Valeur par défaut
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
        timeSlotsContainer.scrollTop = timeSlotsContainer.scrollHeight;
        console.log(`Créneau ${newSlot.id} ajouté au roster.`);
        await saveDailyRosterSlotsToBackend();
        updateEngineAvailabilityVisuals(newSlot.id); // Update visuals for the new slot
    });

    // Fonction améliorée pour créer un créneau consécutif
    const createConsecutiveSlot = async (previousEndTime) => {
        // Vérifier si un créneau existe déjà avec cette heure de début
        if (dailyRosterSlots.some(slot => slot.startTime === previousEndTime)) {
            console.log(`Un créneau démarrant à ${previousEndTime} existe déjà. Pas de création de créneau consécutif.`);
            return; // Ne rien faire si un créneau existe déjà avec cette heure de début
        }

        const newSlotId = `slot-${Date.now()}-auto`;
        const newSlot = {
            id: newSlotId,
            startTime: previousEndTime,
            endTime: '07:00', // Par défaut à 07:00 pour compléter le cycle de 24h
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
        console.log(`Nouveau créneau consécutif (${newSlot.startTime}-${newSlot.endTime}) créé automatiquement.`);
        // Note: Le re-render et la sauvegarde sont appelés par le gestionnaire d'événement de endTimeSelect.
        // updateEngineAvailabilityVisuals sera appelée par le renderDailyRosterSlots ou updateDateAndLoadData.
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

            let agentData;
            try {
                const rawData = e.dataTransfer.getData('text/plain');
                console.log('Drop (OnCall DropZone): Raw data received:', rawData); // Log raw data
                if (!rawData) { // Vérification explicite de la chaîne vide
                    await showModal('Erreur de données', 'Les données de l\'agent glissé sont manquantes. Veuillez réessayer.', false);
                    return;
                }
                agentData = JSON.parse(rawData);
            } catch (error) {
                console.error('Erreur lors du parsing des données de glisser-déposer de l\'agent d\'astreinte :', error);
                await showModal('Erreur de données', 'Les données de l\'agent glissé sont invalides. Veuillez réessayer.', false);
                return; 
            }

            // Vérifier si agentData est valide
            if (!agentData || !agentData.id) {
                await showModal('Erreur de données', 'Les informations de l\'agent sont incomplètes. Veuillez réessayer.', false);
                return;
            }

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
            // Supprimer les classes précédentes pour un feedback propre
            roleDropZoneElement.classList.remove('drag-valid-role');
            roleDropZoneElement.classList.remove('drag-invalid-role');

            // Utiliser draggingAgentId au lieu de e.dataTransfer.getData()
            const agentId = draggingAgentId; 
            console.log('Dragover (Role DropZone): Checking agent with ID from global variable:', agentId);
            
            if (!agentId) { 
                console.error('Dragover (Role DropZone): No draggingAgentId set. This means dragstart did not properly initiate.');
                roleDropZoneElement.classList.add('drag-invalid-role');
                e.dataTransfer.dropEffect = 'none'; // Empêche le drop
                return;
            }

            const requiredQualificationId = roleDropZoneElement.dataset.qualificationId;
            const fullAgent = onCallAgents.find(a => a.id === agentId);

            // Vérifier si l'agent est d'astreinte ET s'il a la qualification requise
            if (fullAgent && (!requiredQualificationId || (fullAgent.qualifications && fullAgent.qualifications.includes(requiredQualificationId)))) {
                 roleDropZoneElement.classList.add('drag-valid-role'); // Style pour drop valide (vert)
                 e.dataTransfer.dropEffect = 'move'; // Permet le drop
            } else {
                 roleDropZoneElement.classList.add('drag-invalid-role'); // Style pour drop invalide (rouge)
                 e.dataTransfer.dropEffect = 'none'; // Empêche le drop
            }
        });

        roleDropZoneElement.addEventListener('dragleave', () => {
            roleDropZoneElement.classList.remove('drag-valid-role');
            roleDropZoneElement.classList.remove('drag-invalid-role');
        });

        roleDropZoneElement.addEventListener('drop', async (e) => {
            e.preventDefault();
            roleDropZoneElement.classList.remove('drag-valid-role');
            roleDropZoneElement.classList.remove('drag-invalid-role');

            // Utiliser draggingAgentId au lieu de e.dataTransfer.getData()
            const agentId = draggingAgentId;
            console.log('Drop (Role DropZone): Using agent ID from global variable:', agentId);

            if (!agentId) {
                await showModal('Erreur de données', 'Aucun agent n\'est en cours de glissement. Veuillez réessayer.', false);
                return;
            }
            
            const agentToAssign = { id: agentId, username: (onCallAgents.find(a => a.id === agentId)?.username || 'Agent inconnu') };
            const engineId = roleDropZoneElement.dataset.engineId;
            const roleId = roleDropZoneElement.dataset.roleId;
            const requiredQualificationId = roleDropZoneElement.dataset.qualificationId;
            
            const fullAgent = onCallAgents.find(a => a.id === agentToAssign.id);

            // 1. Vérifier si l'agent est bien dans la liste des agents d'astreinte
            if (!fullAgent) {
                await showModal('Agent non éligible', 'Seuls les agents de la section "Agents d\'astreinte" peuvent être assignés aux rôles des engins.', false);
                return;
            }

            // 2. Vérifier la qualification (double-check au drop pour éviter les contournements visuels)
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

                // Retirer l'agent de TOUS les autres rôles de CE MÊME ENGIN s'il y était
                // Un agent peut occuper un seul poste au sein du même engin.
                const targetEngineDefinition = centerEngines.find(e => e.id === engineId);
                if (targetEngineDefinition) {
                    targetEngineDefinition.roles.forEach(rol => {
                        if (slot.assignedEngines[engineId] && slot.assignedEngines[engineId][rol.id] &&
                            slot.assignedEngines[engineId][rol.id].id === agentToAssign.id &&
                            rol.id !== roleId) { // Si l'agent est dans un autre rôle au sein du *même* engin, le retirer.
                            slot.assignedEngines[engineId][rol.id] = null;
                        }
                    });
                }
                
                // Assigner l'agent au rôle actuel
                slot.assignedEngines[engineId][roleId] = agentToAssign;
                renderDailyRosterSlots(); // Re-render le créneau pour voir le changement
                console.log(`Agent ${agentToAssign.username} assigné au rôle ${roleId} de l'engin ${engineId} du créneau ${slotId}.`);

                toggleLoader(true);
                const saveSuccess = await saveDailyRosterSlotsToBackend();
                if (!saveSuccess) {
                    await showModal('Erreur d\'affectation', 'L\'affectation de l\'agent à ce rôle n\'a pas pu être sauvegardée. Veuillez réessayer.');
                }
                await updateDateAndLoadData(); // Toujours resynchroniser pour mettre à jour les visuels INDISPO partout
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
                console.log(`Agent ${agentId} retiré du rôle ${roleId} de l'engin ${engineId} du créneau ${slotId}.`);

                toggleLoader(true);
                const saveSuccess = await saveDailyRosterSlotsToBackend();
                if (!saveSuccess) {
                    await showModal('Erreur de suppression', 'La suppression de l\'affectation de l\'agent n\'a pas pu être sauvegardée. Veuillez réessayer.');
                }
                await updateDateAndLoadData(); // Toujours resynchroniser pour mettre à jour les visuels INDISPO partout
                toggleLoader(false);
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
            console.log(`Créneau ${slotId} supprimé.`);
            toggleLoader(true); 
            const saveSuccess = await saveDailyRosterSlotsToBackend(); 
            if (!saveSuccess) {
                await showModal('Erreur de suppression', 'La suppression du créneau n\'a pas pu être sauvegardée. Veuillez réessayer.');
            }
            await updateDateAndLoadData(); // Ré-initialiser et recharger pour assurer la cohérence et la mise à jour des visuels
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

        // Tente d'assigner les agents aux rôles en respectant les qualifications et la règle "un poste par engin"
        dailyRosterSlots.forEach(slot => {
            // Créer une liste des agents déjà assignés dans ce slot pour éviter les doublons au sein d'un même créneau global
            const assignedAgentIdsInSlot = new Set(); 

            centerEngines.forEach(engine => {
                engine.roles.forEach(role => {
                    // Si un rôle est déjà occupé (par exemple, par une affectation manuelle ou précédente)
                    if (slot.assignedEngines[engine.id][role.id]) {
                        assignedAgentIdsInSlot.add(slot.assignedEngines[engine.id][role.id].id);
                        return; // Passer à la prochaine itération si déjà assigné
                    }

                    // Trouver un agent d'astreinte disponible et qualifié qui n'est pas déjà assigné dans ce même slot
                    const foundAgent = onCallAgents.find(agent => 
                        !assignedAgentIdsInSlot.has(agent.id) && 
                        (agent.qualifications && agent.qualifications.includes(role.qualificationId))
                    );

                    if (foundAgent) {
                        slot.assignedEngines[engine.id][role.id] = { id: foundAgent.id, username: foundAgent.username };
                        assignedAgentIdsInSlot.add(foundAgent.id); // Ajouter l'agent à la liste des assignés pour ce slot
                    } else {
                        console.warn(`Aucun agent d'astreinte qualifié ("${role.qualificationId}") et disponible trouvé pour le rôle "${role.name}" de l'engin "${engine.name}" dans le créneau "${slot.startTime}-${slot.endTime}".`);
                    }
                });
            });
        });

        const success = await saveDailyRosterSlotsToBackend();

        setTimeout(async () => {
            if (success) {
                await updateDateAndLoadData(); // Cette fonction appellera updateEngineAvailabilityVisuals
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