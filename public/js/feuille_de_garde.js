document.addEventListener('DOMContentLoaded', () => {
    // --- Éléments du DOM ---
    const loadingSpinner = document.getElementById('loading-spinner');
    const rosterDateInput = document.getElementById('roster-date');
    const prevDayButton = document.getElementById('prev-day-button');
    const nextDayButton = document.getElementById('next-day-button');
    const generateAutoButton = document.getElementById('generate-auto-button');
    const logoutButton = document.getElementById('logout-button'); // Pour l'exemple
    const addSlotButton = document.getElementById('add-slot-button');
    const timeSlotsContainer = document.getElementById('time-slots-container');
    const noTimeslotMessage = document.getElementById('no-timeslot-message');
    const agentsGridContainer = document.getElementById('agents-grid-container');
    const enginsSynthesisContent = document.getElementById('engins-synthesis-content');
    const customMessageModal = document.getElementById('custom-message-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalMessage = document.getElementById('modal-message');
    const modalOkBtn = document.getElementById('modal-ok-btn');
    const modalCancelBtn = document.getElementById('modal-cancel-btn');

    // --- Variables d'état ---
    let currentDate = new Date(); // Date de la feuille de garde affichée
    let availableAgents = [ // Agents d'astreinte (simulés)
        { id: 'agent-1', name: 'Dupont Jean' },
        { id: 'agent-2', name: 'Martin Sophie' },
        { id: 'agent-3', name: 'Bernard Marc' },
        { id: 'agent-4', name: 'Petit Amélie' },
        { id: 'agent-5', name: 'Durand Paul' },
        { id: 'agent-6', name: 'Moreau Claire' },
    ];
    let rosterData = []; // Structure pour stocker les créneaux et agents affectés pour la journée active

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

    // Met à jour l'input de date et charge la feuille de garde
    const updateDateAndLoadRoster = async () => {
        rosterDateInput.value = formatDate(currentDate);
        toggleLoader(true);
        await simulateDataFetch(); // Simule un appel API
        renderTimeSlots();
        renderAgentsGrid();
        updateEnginsSynthesis();
        toggleLoader(false);
    };

    // Simule la récupération de données (remplacer par de vrais appels API)
    const simulateDataFetch = () => {
        return new Promise(resolve => {
            setTimeout(() => {
                // Ici, tu chargerais rosterData pour la currentDate depuis ta base de données
                // Pour l'exemple, nous allons réinitialiser ou charger des données factices
                rosterData = []; // Réinitialiser pour chaque jour pour cet exemple
                resolve();
            }, 500); // Délai de 0.5 seconde pour simuler le chargement
        });
    };

    // Rend les créneaux horaires
    const renderTimeSlots = () => {
        timeSlotsContainer.innerHTML = ''; // Vide le conteneur existant
        if (rosterData.length === 0) {
            noTimeslotMessage.style.display = 'block';
        } else {
            noTimeslotMessage.style.display = 'none';
            rosterData.sort((a, b) => a.startTime.localeCompare(b.startTime)); // Trie par heure
            rosterData.forEach(slot => {
                const slotElement = createTimeSlotElement(slot);
                timeSlotsContainer.appendChild(slotElement);
            });
        }
    };

    // Crée un élément HTML pour un créneau horaire
    const createTimeSlotElement = (slot) => {
        const div = document.createElement('div');
        div.className = 'time-slot';
        div.dataset.slotId = slot.id; // Stocke l'ID du créneau

        div.innerHTML = `
            <input type="time" class="time-input start-time" value="${slot.startTime}">
            <span>-</span>
            <input type="time" class="time-input end-time" value="${slot.endTime}">
            <div class="assigned-agents-for-slot" data-slot-id="${slot.id}">
                ${slot.assignedAgents.map(agent => `
                    <span class="assigned-agent-tag" data-agent-id="${agent.id}">
                        ${agent.name}
                        <button class="remove-assigned-agent-tag" data-agent-id="${agent.id}">x</button>
                    </span>
                `).join('')}
            </div>
            <button class="remove-slot-button">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trash"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
            </button>
        `;

        // Ajoute les écouteurs d'événements pour les inputs de temps (mise à jour du rosterData)
        const startTimeInput = div.querySelector('.start-time');
        const endTimeInput = div.querySelector('.end-time');

        startTimeInput.addEventListener('change', (e) => updateSlotTime(slot.id, 'startTime', e.target.value));
        endTimeInput.addEventListener('change', (e) => updateSlotTime(slot.id, 'endTime', e.target.value));


        // Ajoute l'écouteur d'événements pour la suppression du créneau
        div.querySelector('.remove-slot-button').addEventListener('click', () => removeTimeSlot(slot.id));

        // Ajoute les écouteurs pour la suppression des agents assignés
        div.querySelectorAll('.remove-assigned-agent-tag').forEach(button => {
            button.addEventListener('click', (e) => {
                const agentIdToRemove = e.target.dataset.agentId;
                removeAgentFromSlot(slot.id, agentIdToRemove);
            });
        });

        // Configure les zones de dépôt pour le drag & drop
        const dropZone = div.querySelector('.assigned-agents-for-slot');
        setupDropZone(dropZone);

        return div;
    };

    // Rend la grille des agents disponibles
    const renderAgentsGrid = () => {
        agentsGridContainer.innerHTML = '';
        availableAgents.forEach(agent => {
            const agentCard = document.createElement('div');
            agentCard.className = 'agent-card';
            agentCard.textContent = agent.name;
            agentCard.draggable = true;
            agentCard.dataset.agentId = agent.id;
            agentCard.dataset.agentName = agent.name; // Pour récupérer facilement le nom

            agentCard.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', JSON.stringify({ id: agent.id, name: agent.name }));
                e.dataTransfer.effectAllowed = 'copy';
            });
            agentsGridContainer.appendChild(agentCard);
        });
    };

    // Met à jour la synthèse des engins (simplifiée)
    const updateEnginsSynthesis = () => {
        enginsSynthesisContent.innerHTML = '';
        if (rosterData.length === 0) {
            enginsSynthesisContent.innerHTML = '<p class="no-data-message">Aucune synthèse disponible pour le moment. Ajoutez des créneaux et des engins.</p>';
            return;
        }

        rosterData.forEach(slot => {
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
            // Par exemple :
            // if (slot.assignedEngines && slot.assignedEngines.length > 0) {
            //     slot.assignedEngines.forEach(engine => {
            //         synthesisSlotDiv.innerHTML += `<p>${engine.name} : ${engine.status}</p>`;
            //     });
            // }

            enginsSynthesisContent.appendChild(synthesisSlotDiv);
        });
    };


    // --- Logique des événements ---

    // Navigation de date
    prevDayButton.addEventListener('click', () => {
        currentDate.setDate(currentDate.getDate() - 1);
        updateDateAndLoadRoster();
    });

    nextDayButton.addEventListener('click', () => {
        currentDate.setDate(currentDate.getDate() + 1);
        updateDateAndLoadRoster();
    });

    rosterDateInput.addEventListener('change', (e) => {
        currentDate = new Date(e.target.value);
        updateDateAndLoadRoster();
    });

    // Bouton Déconnexion (simulé)
    logoutButton.addEventListener('click', () => {
        showModal('Déconnexion', 'Vous avez été déconnecté avec succès.', false).then(() => {
            console.log('Déconnexion simulée.');
            // window.location.href = 'login.html'; // Redirection vers une page de connexion
        });
    });

    // Ajout d'un nouveau créneau horaire
    addSlotButton.addEventListener('click', () => {
        const newSlotId = `slot-${Date.now()}`; // ID unique basé sur le timestamp
        const newSlot = {
            id: newSlotId,
            startTime: '08:00', // Valeur par défaut
            endTime: '12:00',   // Valeur par défaut
            assignedAgents: []
        };
        rosterData.push(newSlot);
        renderTimeSlots(); // Re-rend toute la liste
        updateEnginsSynthesis();
        // Optionnel: Faire défiler vers le nouveau créneau
        timeSlotsContainer.scrollTop = timeSlotsContainer.scrollHeight;
    });

    // Mise à jour de l'heure d'un créneau
    const updateSlotTime = (slotId, timeType, value) => {
        const slotIndex = rosterData.findIndex(s => s.id === slotId);
        if (slotIndex > -1) {
            rosterData[slotIndex][timeType] = value;
            // Pas besoin de re-rendre tout, juste mettre à jour la synthèse
            updateEnginsSynthesis();
            console.log(`Créneau ${slotId} - ${timeType} mis à jour à ${value}`);
            // Ici, tu enverrais cette mise à jour à ton backend
        }
    };

    // Suppression d'un créneau horaire
    const removeTimeSlot = async (slotId) => {
        const confirm = await showModal(
            'Confirmer la suppression',
            'Êtes-vous sûr de vouloir supprimer ce créneau horaire ?',
            true
        );
        if (confirm) {
            rosterData = rosterData.filter(slot => slot.id !== slotId);
            renderTimeSlots();
            updateEnginsSynthesis();
            console.log(`Créneau ${slotId} supprimé.`);
            // Ici, tu enverrais cette suppression à ton backend
        }
    };

    // --- Logique Drag & Drop ---

    const setupDropZone = (dropZoneElement) => {
        dropZoneElement.addEventListener('dragover', (e) => {
            e.preventDefault(); // Permet le dépôt
            dropZoneElement.style.backgroundColor = '#dff0d8'; // Feedback visuel
        });

        dropZoneElement.addEventListener('dragleave', () => {
            dropZoneElement.style.backgroundColor = ''; // Réinitialise le feedback visuel
        });

        dropZoneElement.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZoneElement.style.backgroundColor = ''; // Réinitialise le feedback visuel

            const agentData = JSON.parse(e.dataTransfer.getData('text/plain'));
            const slotId = dropZoneElement.dataset.slotId;

            assignAgentToSlot(slotId, agentData);
        });
    };

    // Assigner un agent à un créneau
    const assignAgentToSlot = (slotId, agent) => {
        const slot = rosterData.find(s => s.id === slotId);
        if (slot && !slot.assignedAgents.some(a => a.id === agent.id)) { // Empêche les doublons
            slot.assignedAgents.push(agent);
            renderTimeSlots(); // Re-render pour mettre à jour l'affichage
            updateEnginsSynthesis();
            console.log(`Agent ${agent.name} assigné au créneau ${slotId}`);
            // Ici, tu enverrais cette affectation à ton backend
        } else if (slot && slot.assignedAgents.some(a => a.id === agent.id)) {
            showModal('Agent déjà assigné', `L'agent ${agent.name} est déjà assigné à ce créneau.`, false);
        }
    };

    // Retirer un agent d'un créneau
    const removeAgentFromSlot = (slotId, agentId) => {
        const slot = rosterData.find(s => s.id === slotId);
        if (slot) {
            slot.assignedAgents = slot.assignedAgents.filter(agent => agent.id !== agentId);
            renderTimeSlots();
            updateEnginsSynthesis();
            console.log(`Agent ${agentId} retiré du créneau ${slotId}`);
            // Ici, tu enverrais cette suppression à ton backend
        }
    };

    // --- Logique "Générer Auto" ---

    generateAutoButton.addEventListener('click', async () => {
        toggleLoader(true);
        await showModal('Génération automatique', 'Lancement de la génération automatique de la feuille de garde. Cela peut prendre quelques instants...', false);
        console.log('Déclenchement de la génération automatique...');

        // Simulation de la logique d'affectation automatique
        // Pour l'exemple, nous allons simplement assigner le premier agent disponible à chaque créneau vide
        rosterData.forEach(slot => {
            if (slot.assignedAgents.length === 0 && availableAgents.length > 0) {
                const agentToAssign = availableAgents[0]; // Prend le premier agent
                slot.assignedAgents.push(agentToAssign);
                // Dans une vraie application, tu aurais une logique plus complexe ici:
                // - Vérifier la disponibilité de l'agent sur plusieurs créneaux
                // - Respecter des règles (compétences, heures max, etc.)
                // - Marquer l'agent comme "occupé" pour ce créneau
            }
        });

        setTimeout(() => { // Simule le temps de traitement
            renderTimeSlots();
            updateEnginsSynthesis();
            toggleLoader(false);
            showModal('Génération terminée', 'La feuille de garde a été générée automatiquement avec succès (simulation).');
            console.log('Génération automatique terminée.');
            // Ici, tu enverrais le rosterData mis à jour à ton backend
        }, 1500);
    });


    // --- Initialisation au chargement de la page ---
    updateDateAndLoadRoster(); // Charge la feuille de garde pour la date actuelle au démarrage
});