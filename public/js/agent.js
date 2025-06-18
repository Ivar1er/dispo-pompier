// agent.js

// Variables globales pour le suivi de l'état de l'application
let currentWeekIdentifier = ''; // Pour stocker l'identifiant de la semaine (ex: "2025-W25")
let currentWeekDates = {}; // { startDate: "JJ/MM", endDate: "JJ/MM" }
let currentDailyAvailabilities = {}; // Stocke les disponibilités de l'agent pour chaque jour de la semaine courante
let hasUnsavedChanges = false; // Indique si des changements non sauvegardés existent
let isDragging = false; // Pour la sélection multiple par glisser-déposer
let dragStartSlot = null; // Le créneau où le glisser-déposer a commencé
let currentAgentId = ''; // L'ID de l'agent connecté
let currentAgentName = ''; // Le nom complet de l'agent connecté

// Map pour les noms des jours (peut être utile pour l'affichage)
const dayNames = {
    'lundi': 'Lundi',
    'mardi': 'Mardi',
    'mercredi': 'Mercredi',
    'jeudi': 'Jeudi',
    'vendredi': 'Vendredi',
    'samedi': 'Samedi',
    'dimanche': 'Dimanche'
};
const dayNamesInverse = {
    'Lundi': 'lundi',
    'Mardi': 'mardi',
    'Mercredi': 'mercredi',
    'Jeudi': 'jeudi',
    'Vendredi': 'vendredi',
    'Samedi': 'samedi',
    'Dimanche': 'dimanche'
};
const daysOrder = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi']; // Jours ouvrables pour l'affichage


// --- Début du code qui s'exécute une fois le DOM chargé ---
document.addEventListener('DOMContentLoaded', function() {
    // Références DOM pour les éléments de la page agent.html
    const agentDisplayName = document.getElementById('agent-display-name');
    const prevWeekBtn = document.getElementById('prev-week-btn');
    const nextWeekBtn = document.getElementById('next-week-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const weekSelect = document.getElementById('week-select');
    const scheduleContainer = document.getElementById('schedule-container'); // Conteneur pour les onglets des jours
    const saveSlotsBtn = document.getElementById('save-slots-btn');
    const clearSelectionBtn = document.getElementById('clear-selection-btn');
    const synthesisBtn = document.getElementById('synthesis-btn');
    const loadingSpinner = document.getElementById('loading-spinner');
    const errorMessage = document.getElementById('error-message');
    const currentWeekSpan = document.getElementById('current-week'); // Affiche "Semaine du JJ/MM au JJ/MM"

    // --- Fonctions utilitaires pour l'interface utilisateur ---

    /**
     * Affiche l'indicateur de chargement et efface les messages d'erreur.
     */
    function showLoading() {
        if (loadingSpinner) loadingSpinner.style.display = 'block';
        if (errorMessage) errorMessage.textContent = '';
        hideError();
    }

    /**
     * Masque l'indicateur de chargement.
     */
    function hideLoading() {
        if (loadingSpinner) loadingSpinner.style.display = 'none';
    }

    /**
     * Affiche un message d'erreur.
     * @param {string} message - Le message d'erreur à afficher.
     */
    function showError(message) {
        if (errorMessage) {
            errorMessage.textContent = message;
            errorMessage.style.display = 'block'; // S'assurer qu'il est visible
        }
        hideLoading(); // Masquer le spinner en cas d'erreur
    }

    /**
     * Masque le message d'erreur.
     */
    function hideError() {
        if (errorMessage) {
            errorMessage.textContent = '';
            errorMessage.style.display = 'none';
        }
    }

    /**
     * Construit l'objet d'options pour les requêtes fetch, incluant le token d'authentification.
     * Redirige vers la page de connexion si aucun token n'est trouvé.
     * @returns {object|null} Options de requête ou null si pas de token.
     */
    function getRequestOptions(method = 'GET') {
        const token = localStorage.getItem('token');
        if (!token) {
            console.error("Aucun token trouvé, redirection vers la page de connexion.");
            showError("Session expirée. Veuillez vous reconnecter.");
            setTimeout(() => window.location.href = '/', 1500); // Redirection après un court délai
            return null;
        }
        return {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        };
    }

    /**
     * Gère les réponses HTTP non OK (erreurs 401, 403, etc.).
     * @param {Response} response - La réponse de l'API.
     * @returns {Promise<Error>} Une promesse rejetée avec un objet Error.
     */
    async function handleApiResponse(response) {
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                showError("Session expirée ou non autorisée. Veuillez vous reconnecter.");
                localStorage.removeItem('token');
                setTimeout(() => window.location.href = '/', 1500);
            }
            const errorText = await response.text();
            throw new Error(`Erreur HTTP: ${response.status} - ${errorText || response.statusText}`);
        }
        return response.json();
    }

    // --- Fonctions de gestion de la logique de temps ---

    /**
     * Génère une date YYYY-MM-DD pour un jour donné de la semaine actuelle.
     * @param {string} dayName - Nom du jour (ex: 'lundi').
     * @returns {string|null} La date formatée ou null si jour non trouvé.
     */
    function getDateForDayNameInCurrentWeek(dayName) {
        // Supposons que currentWeekIdentifier est au format "YYYY-Wnn"
        if (!currentWeekIdentifier) return null;

        const [yearStr, weekStr] = currentWeekIdentifier.split('-W');
        const year = parseInt(yearStr);
        const weekNum = parseInt(weekStr);

        const daysOfWeekArray = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
        const dayIndex = daysOfWeekArray.indexOf(dayName.toLowerCase()); // 0 pour Lundi, etc.

        if (dayIndex === -1) return null;

        // Code pour calculer la date exacte du jour de la semaine dans la semaine ISO
        const jan4 = new Date(year, 0, 4);
        const jan4DayOfWeek = (jan4.getDay() + 6) % 7; // Lundi = 0, Dim = 6
        const firstMonday = new Date(jan4);
        firstMonday.setDate(jan4.getDate() - jan4DayOfWeek);

        const targetMonday = new Date(firstMonday);
        targetMonday.setDate(firstMonday.getDate() + (weekNum - 1) * 7);

        const targetDate = new Date(targetMonday);
        targetDate.setDate(targetMonday.getDate() + dayIndex);

        return `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;
    }


    // --- Fonctions d'interaction avec l'API ---

    /**
     * Récupère les informations de l'agent connecté et les affiche.
     */
    async function fetchAgentInfo() {
        try {
            const options = getRequestOptions();
            if (!options) return;

            const response = await fetch('/api/agent-info', options);
            const agentInfo = await handleApiResponse(response);

            currentAgentId = agentInfo.id;
            currentAgentName = `${agentInfo.firstName} ${agentInfo.lastName}`;

            if (agentDisplayName) {
                agentDisplayName.textContent = currentAgentName;
            }
        } catch (error) {
            console.error('Erreur lors de la récupération des infos agent:', error);
            if (agentDisplayName) {
                agentDisplayName.textContent = "Agent"; // Revenir à un texte par défaut
            }
            showError(`Impossible de charger les informations de l'agent: ${error.message}`);
        }
    }


    /**
     * Récupère la liste des semaines disponibles depuis l'API.
     * Met à jour le sélecteur de semaine avec le format "SXX (JJ/MM au JJ/MM)".
     */
    async function fetchWeeks() {
        showLoading();
        try {
            const options = getRequestOptions();
            if (!options) return;

            const response = await fetch('/api/weeks', options);
            // weeksData est un tableau d'objets { weekIdentifier, startDate, endDate }
            const weeksData = await handleApiResponse(response);

            if (weekSelect) {
                // Créer les options au format "SXX (JJ/MM au JJ/MM)"
                weekSelect.innerHTML = weeksData.map(week => {
                    const weekNum = week.weekIdentifier.split('-W')[1]; // Ex: "25" de "2025-W25"
                    return `<option value="${week.weekIdentifier}" data-start-date="${week.startDate}" data-end-date="${week.endDate}">S${weekNum} (${week.startDate} au ${week.endDate})</option>`;
                }).join('');

                if (weeksData.length > 0) {
                    currentWeekIdentifier = weekSelect.value;
                    // Stocke les dates pour la semaine courante
                    const selectedOption = weekSelect.options[weekSelect.selectedIndex];
                    currentWeekDates = {
                        startDate: selectedOption.dataset.startDate,
                        endDate: selectedOption.dataset.endDate
                    };
                    updateCurrentWeekDisplay();
                    await fetchAgentPlanningForWeek(currentWeekIdentifier, currentAgentId);
                } else {
                    showError("Aucune semaine disponible.");
                    renderEmptySchedule();
                }
            }
        } catch (error) {
            console.error('Erreur lors de la récupération des semaines:', error);
            showError(`Erreur: ${error.message}`);
        } finally {
            hideLoading();
        }
    }

    /**
     * Récupère le planning complet d'un agent pour une semaine donnée.
     * Le planning est structuré par jour et contient des plages "HH:MM - HH:MM".
     * @param {string} weekIdentifier - L'identifiant de la semaine (ex: "week-25").
     * @param {string} agentId - L'ID de l'agent.
     */
    async function fetchAgentPlanningForWeek(weekIdentifier, agentId) {
        showLoading();
        try {
            const options = getRequestOptions();
            if (!options) return;

            // La route du serveur est /api/planning/:agentId qui renvoie tout le planning de l'agent
            // Nous filtrons côté client pour la semaine concernée.
            const response = await fetch(`/api/planning/${agentId}`, options);
            const fullPlanning = await handleApiResponse(response); // { "week-X": { "lundi": ["08:00 - 12:00"] } }

            // Récupère les disponibilités pour la semaine actuelle
            currentDailyAvailabilities = fullPlanning[weekIdentifier] || {
                'lundi': [], 'mardi': [], 'mercredi': [],
                'jeudi': [], 'vendredi': [], 'samedi': [], 'dimanche': []
            };

            renderSchedule(); // Rend le planning basé sur currentDailyAvailabilities
            hideError();
        } catch (error) {
            console.error('Erreur lors de la récupération du planning de l\'agent:', error);
            showError(`Erreur lors du chargement du planning: ${error.message}`);
            renderEmptySchedule();
        } finally {
            hideLoading();
        }
    }

    /**
     * Sauvegarde les modifications du planning pour le jour actif.
     * Note: La logique de sauvegarde est par jour, pas par semaine entière.
     */
    async function saveAvailabilitiesForDay(dayName) {
        showLoading();
        try {
            const options = getRequestOptions('POST');
            if (!options) return;

            const dateKey = getDateForDayNameInCurrentWeek(dayName);
            if (!dateKey) {
                showError(`Impossible de déterminer la date pour le jour ${dayName}.`);
                return;
            }

            // Les slots sont maintenant des objets { start: "HH:MM", end: "HH:MM" }
            // Basé sur les créneaux 'selected' de l'interface
            const availabilitiesToSend = [];
            const dayTabPane = document.getElementById(dayName); // Obtenez le conteneur de l'onglet du jour

            if (dayTabPane) {
                const selectedElements = dayTabPane.querySelectorAll('.time-slot.selected');
                selectedElements.forEach(el => {
                    const time = el.dataset.time; // Ex: "08:00"
                    // Pour simplifier, on considère un créneau de 30min comme une plage
                    // Dans un système réel, il faudrait regrouper les créneaux contigus.
                    // Pour l'instant, chaque sélection est une plage de 30min.
                    // TODO: Implémenter le regroupement de plages si l'API l'attend.
                    // Pour l'API actuelle, elle attend {start, end}.
                    // Supposons que nous sauvegardons des plages de 30 minutes sélectionnées comme {start: time, end: time + 30min}
                    // Ou simplement envoyer les créneaux de 30 min et laisser le backend gérer l'agrégation
                    // Si le backend attend juste {start, end}, et que nos créneaux sont fixes (08:00, 08:30 etc.),
                    // nous pouvons les envoyer tels quels et le backend les interprétera comme des plages.
                    // Pour l'API /api/agent-availability/:dateKey/:agentId, elle attend un tableau d'objets {start, end}.
                    // Simplifions en envoyant chaque créneau de 30min sélectionné comme une plage unique.
                    const [hour, minute] = time.split(':').map(Number);
                    const endDate = new Date(1970, 0, 1, hour, minute + 30); // Ajouter 30 minutes
                    const endHour = String(endDate.getHours()).padStart(2, '0');
                    const endMinute = String(endDate.getMinutes()).padStart(2, '0');

                    availabilitiesToSend.push({
                        start: time,
                        end: `${endHour}:${endMinute}`
                    });
                });
            }

            const response = await fetch(`/api/agent-availability/${dateKey}/${currentAgentId}`, {
                method: 'POST',
                headers: options.headers,
                body: JSON.stringify(availabilitiesToSend) // Envoyer les plages horaires
            });

            const result = await handleApiResponse(response);
            alert(result.message);
            hasUnsavedChanges = false;
            // Recharger le planning pour la semaine entière après sauvegarde d'un jour
            await fetchAgentPlanningForWeek(currentWeekIdentifier, currentAgentId);
            updateSaveClearButtonsVisibility();
        } catch (error) {
            console.error(`Erreur lors de l'enregistrement des disponibilités pour ${dayName}:`, error);
            showError(`Erreur lors de l'enregistrement: ${error.message}`);
        } finally {
            hideLoading();
        }
    }

    /**
     * Effectue la déconnexion de l'agent.
     */
    async function logout() {
        showLoading();
        try {
            const options = getRequestOptions('POST');
            if (options) {
                 await fetch('/logout', options);
            }
            localStorage.removeItem('token');
            window.location.href = '/';
        } catch (error) {
            console.error('Erreur lors de la déconnexion:', error);
            showError('Échec de la déconnexion. Veuillez réessayer.');
        } finally {
            hideLoading();
        }
    }

    /**
     * Récupère et affiche la synthèse des réservations de l'agent.
     */
    async function showSynthesis() {
        showLoading();
        try {
            const options = getRequestOptions();
            if (!options) return;

            const response = await fetch('/api/synthesis', options);
            const synthesisData = await handleApiResponse(response); // { "lundi": [{ time: "HH:MM", week: "YYYY-Wnn" }] }

            let synthesisMessage = "Synthèse des réservations :\n";
            let hasReservations = false;

            daysOrder.forEach(day => { // Parcourir les jours dans l'ordre
                if (synthesisData[day] && synthesisData[day].length > 0) {
                    hasReservations = true;
                    synthesisMessage += `\n${dayNames[day]}:`;
                    synthesisData[day].sort((a, b) => { // Trier les créneaux
                        const [hA, mA] = a.time.split(':').map(Number);
                        const [hB, mB] = b.time.split(':').map(Number);
                        return (hA * 60 + mA) - (hB * 60 + mB);
                    }).forEach(slot => {
                        const weekNum = slot.week.split('-W')[1];
                        synthesisMessage += `\n  - ${slot.time} (S${weekNum})`;
                    });
                }
            });

            if (!hasReservations) {
                synthesisMessage += "\nAucun créneau réservé actuellement.";
            }

            alert(synthesisMessage); // Remplacer par une modale
        } catch (error) {
            console.error('Erreur lors de la récupération de la synthèse:', error);
            showError(`Erreur lors de la synthèse: ${error.message}`);
        } finally {
            hideLoading();
        }
    }

    // --- Fonctions de rendu et de logique de l'interface utilisateur ---

    /**
     * Met à jour l'affichage de la semaine courante (ex: "Semaine du JJ/MM au JJ/MM").
     */
    function updateCurrentWeekDisplay() {
        if (currentWeekSpan && currentWeekDates.startDate && currentWeekDates.endDate) {
            currentWeekSpan.textContent = `Semaine du ${currentWeekDates.startDate} au ${currentWeekDates.endDate}`;
        } else if (currentWeekSpan) {
            currentWeekSpan.textContent = ''; // Ou un message par défaut
        }
    }

    /**
     * Rend le planning dans l'interface utilisateur basé sur `currentDailyAvailabilities`.
     */
    function renderSchedule() {
        if (!scheduleContainer) {
            console.error("Conteneur de planning non trouvé.");
            return;
        }

        // Parcourir les jours ouvrables (lundi à vendredi)
        daysOrder.forEach(day => {
            const dayTabPane = document.getElementById(day); // Le div 'tab-pane' pour ce jour

            if (dayTabPane) {
                dayTabPane.innerHTML = ''; // Effacer le contenu précédent

                const ul = document.createElement('ul');
                ul.className = 'list-group list-group-flush';

                // Générer les créneaux de 08h00 à 17h30 par tranches de 30 minutes
                const slotsForDay = [];
                for (let h = 8; h < 18; h++) {
                    slotsForDay.push(`${String(h).padStart(2, '0')}:00`);
                    slotsForDay.push(`${String(h).padStart(2, '0')}:30`);
                }

                // Récupérer les plages de disponibilité enregistrées pour ce jour
                // Les availabilities sont au format { start: "HH:MM", end: "HH:MM" }
                const recordedAvailabilities = currentDailyAvailabilities[day] || [];
                // Convertir les plages en un Set de créneaux de 30min disponibles pour un lookup rapide
                const availableTimeSlotsSet = new Set();
                recordedAvailabilities.forEach(range => {
                    const [startH, startM] = range.start.split(':').map(Number);
                    const [endH, endM] = range.end.split(':').map(Number);

                    let currentTime = new Date(1970, 0, 1, startH, startM);
                    const endTime = new Date(1970, 0, 1, endH, endM);

                    while (currentTime.getTime() < endTime.getTime()) {
                        const slotString = `${String(currentTime.getHours()).padStart(2, '0')}:${String(currentTime.getMinutes()).padStart(2, '0')}`;
                        availableTimeSlotsSet.add(slotString);
                        currentTime.setMinutes(currentTime.getMinutes() + 30);
                    }
                });

                if (slotsForDay.length > 0) {
                    slotsForDay.forEach(timeSlot => {
                        const li = document.createElement('li');
                        const isAvailable = availableTimeSlotsSet.has(timeSlot);
                        
                        // Initialiser 'selected' à false par défaut lors du rendu initial
                        // La sélection par glisser-déposer mettra à jour cela
                        li.className = `list-group-item d-flex justify-content-between align-items-center time-slot ${isAvailable ? 'available' : 'booked'}`;
                        li.dataset.day = day;
                        li.dataset.time = timeSlot;
                        li.dataset.available = isAvailable; // Stocke la disponibilité initiale

                        const timeSpan = document.createElement('span');
                        timeSpan.textContent = timeSlot;
                        li.appendChild(timeSpan);

                        const statusSpan = document.createElement('span');
                        statusSpan.className = `badge ${isAvailable ? 'bg-success' : 'bg-danger'} rounded-pill`;
                        statusSpan.textContent = isAvailable ? 'Disponible' : 'Réservé';
                        li.appendChild(statusSpan);

                        if (isAvailable) { // Seuls les créneaux "initialement disponibles" peuvent être manipulés
                            li.addEventListener('click', (e) => handleSlotClick(li, day, timeSlot, e));
                            li.addEventListener('mousedown', (e) => handleSlotMouseDown(li, day, timeSlot, e));
                            li.addEventListener('mouseenter', () => handleSlotMouseEnter(li, day, timeSlot));
                        } else {
                            // Pour les créneaux réservés, on peut potentiellement ajouter une interaction si l'on souhaite
                            // permettre de les rendre disponibles (libérer une réservation)
                            li.addEventListener('click', (e) => handleSlotClick(li, day, timeSlot, e)); // Permet de désélectionner un créneau réservé
                            li.addEventListener('mousedown', (e) => handleSlotMouseDown(li, day, timeSlot, e));
                            li.addEventListener('mouseenter', () => handleSlotMouseEnter(li, day, timeSlot));
                        }

                        ul.appendChild(li);
                    });
                } else {
                    const li = document.createElement('li');
                    li.className = 'list-group-item text-muted';
                    li.textContent = `Aucun créneau configurable pour ${dayNames[day]}.`;
                    ul.appendChild(li);
                }
                dayTabPane.appendChild(ul);
            }
        });
        updateSaveClearButtonsVisibility(); // Mettre à jour l'état des boutons après le rendu
        setupMouseListenersForSelection(); // Réinitialise les écouteurs de la souris
    }


    /**
     * Rend un message d'absence de planning.
     */
    function renderEmptySchedule() {
        if (scheduleContainer) {
            daysOrder.forEach(day => {
                const dayTabPane = document.getElementById(day);
                if (dayTabPane) {
                    dayTabPane.innerHTML = `<ul class="list-group list-group-flush"><li class="list-group-item text-muted">Aucun planning disponible pour cette semaine.</li></ul>`;
                }
            });
        }
        if (currentWeekSpan) {
            currentWeekSpan.textContent = "Aucune semaine sélectionnée";
        }
        updateSaveClearButtonsVisibility();
    }


    /**
     * Gère le clic simple sur un créneau pour la sélection/désélection.
     * @param {HTMLElement} slotElement - L'élément DOM du créneau.
     * @param {string} day - Le jour du créneau.
     * @param {string} time - L'heure du créneau.
     * @param {MouseEvent} event - L'événement de la souris.
     */
    function handleSlotClick(slotElement, day, time, event) {
        if (!isDragging) { // Seulement si pas en mode glisser-déposer
            toggleSlotSelection(slotElement, day, time);
            // hasUnsavedChanges est mis à jour dans toggleSlotSelection
        }
    }

    /**
     * Bascule l'état de sélection d'un créneau dans l'interface.
     * Note: L'état interne `currentDailyAvailabilities` n'est pas mis à jour ici directement,
     * il le sera lors de l'appel à `saveAvailabilitiesForDay`.
     * @param {HTMLElement} slotElement - L'élément DOM du créneau.
     * @param {string} day - Le jour du créneau.
     * @param {string} time - L'heure du créneau.
     * @param {boolean} [forceState] - Force l'état de sélection (true pour sélectionner, false pour désélectionner).
     */
    function toggleSlotSelection(slotElement, day, time, forceState = undefined) {
        const isCurrentlySelected = slotElement.classList.contains('selected');
        const newState = forceState !== undefined ? forceState : !isCurrentlySelected;

        if (newState) {
            slotElement.classList.add('selected');
        } else {
            slotElement.classList.remove('selected');
        }

        updateSaveClearButtonsVisibility();
        hasUnsavedChanges = true; // Marque les changements non sauvegardés
    }

    /**
     * Initialise le processus de sélection par glisser-déposer.
     * @param {HTMLElement} slotElement - L'élément DOM du créneau de départ.
     * @param {string} day - Le jour du créneau de départ.
     * @param {string} time - L'heure du créneau de départ.
     * @param {MouseEvent} event - L'événement de la souris.
     */
    function handleSlotMouseDown(slotElement, day, time, event) {
        if (event.button === 0) { // Clic gauche de la souris
            isDragging = true;
            dragStartSlot = { element: slotElement, day: day, time: time };
            // Commence la sélection/désélection en fonction de l'état initial du slot de départ
            const initialSelectionState = !slotElement.classList.contains('selected');
            toggleSlotSelection(slotElement, day, time, initialSelectionState);
            // Empêche la sélection de texte
            event.preventDefault();
        }
    }

    /**
     * Gère le survol de la souris lors du glisser-déposer pour la sélection multiple.
     * @param {HTMLElement} slotElement - L'élément DOM du créneau survolé.
     * @param {string} day - Le jour du créneau survolé.
     * @param {string} time - L'heure du créneau survolé.
     */
    function handleSlotMouseEnter(slotElement, day, time) {
        if (isDragging && dragStartSlot) { // Pas besoin de vérifier 'available', car on peut (dé)sélectionner des créneaux réservés aussi
            // Sélectionne le créneau survolé avec le même état que le créneau de départ
            const initialSelectionState = !dragStartSlot.element.classList.contains('selected'); // État appliqué au premier clic
            toggleSlotSelection(slotElement, day, time, initialSelectionState);
        }
    }

    /**
     * Configure les écouteurs d'événements globaux pour la sélection par glisser-déposer.
     */
    function setupMouseListenersForSelection() {
        document.removeEventListener('mouseup', handleMouseUp); // Supprimer avant d'ajouter pour éviter les doublons
        document.addEventListener('mouseup', handleMouseUp);
        document.removeEventListener('mouseleave', handleMouseUp); // Pour gérer la fin du drag si la souris quitte la fenêtre
        document.addEventListener('mouseleave', handleMouseUp);
    }

    /**
     * Termine le processus de sélection par glisser-déposer.
     */
    function handleMouseUp() {
        isDragging = false;
        dragStartSlot = null;
    }


    /**
     * Affiche ou masque les boutons "Enregistrer" et "Effacer la sélection"
     * en fonction des créneaux sélectionnés dans TOUS les onglets.
     */
    function updateSaveClearButtonsVisibility() {
        const anySlotSelected = document.querySelector('.time-slot.selected') !== null;

        if (saveSlotsBtn) {
            saveSlotsBtn.style.display = anySlotSelected ? 'inline-block' : 'none';
        }
        if (clearSelectionBtn) {
            clearSelectionBtn.style.display = anySlotSelected ? 'inline-block' : 'none';
        }
    }

    /**
     * Efface toutes les sélections de créneaux dans l'interface.
     */
    function clearSelection() {
        const selectedElements = document.querySelectorAll('.time-slot.selected');
        selectedElements.forEach(el => el.classList.remove('selected'));
        hasUnsavedChanges = true;
        updateSaveClearButtonsVisibility();
    }

    /**
     * Gère l'enregistrement de tous les créneaux sélectionnés pour tous les jours visibles.
     * Groupe les sélections par jour et les envoie à l'API.
     */
    async function saveAllSelectedSlots() {
        showLoading();
        try {
            const daysToSave = daysOrder; // Lundi à Vendredi

            for (const day of daysToSave) {
                const dateKey = getDateForDayNameInCurrentWeek(day);
                if (!dateKey) {
                    showError(`Impossible de déterminer la date pour le jour ${day}.`);
                    hideLoading();
                    return;
                }

                const availabilitiesToSend = [];
                const dayTabPane = document.getElementById(day);
                if (dayTabPane) {
                    const selectedElements = dayTabPane.querySelectorAll('.time-slot.selected');
                    // Regrouper les créneaux contigus en plages horaires
                    const selectedTimes = Array.from(selectedElements).map(el => el.dataset.time).sort(); // Trier
                    
                    if (selectedTimes.length > 0) {
                        let currentRangeStart = selectedTimes[0];
                        let currentRangeEnd = selectedTimes[0]; // Point de fin du créneau actuel
                        let prevHour, prevMinute;

                        selectedTimes.forEach((time, index) => {
                            const [hour, minute] = time.split(':').map(Number);
                            
                            if (index > 0) {
                                // Calculer l'heure de fin du créneau précédent pour vérifier la contiguïté
                                const prevTime = selectedTimes[index - 1];
                                const [ph, pm] = prevTime.split(':').map(Number);
                                const prevSlotEndTime = new Date(1970, 0, 1, ph, pm + 30);
                                
                                if (hour === prevSlotEndTime.getHours() && minute === prevSlotEndTime.getMinutes()) {
                                    // Le créneau actuel est contigu, étendre la plage de fin
                                    currentRangeEnd = time;
                                } else {
                                    // Non contigu, la plage précédente est terminée
                                    // Ajouter la plage précédente
                                    const endRangeTime = new Date(1970, 0, 1, ...currentRangeEnd.split(':').map(Number));
                                    endRangeTime.setMinutes(endRangeTime.getMinutes() + 30); // Ajouter 30min pour la fin de la plage
                                    availabilitiesToSend.push({
                                        start: currentRangeStart,
                                        end: `${String(endRangeTime.getHours()).padStart(2, '0')}:${String(endRangeTime.getMinutes()).padStart(2, '0')}`
                                    });
                                    // Commencer une nouvelle plage
                                    currentRangeStart = time;
                                    currentRangeEnd = time;
                                }
                            }
                            if (index === selectedTimes.length - 1) {
                                // Dernier créneau, ajouter la plage finale
                                const endRangeTime = new Date(1970, 0, 1, ...currentRangeEnd.split(':').map(Number));
                                endRangeTime.setMinutes(endRangeTime.getMinutes() + 30);
                                availabilitiesToSend.push({
                                    start: currentRangeStart,
                                    end: `${String(endRangeTime.getHours()).padStart(2, '0')}:${String(endRangeTime.getMinutes()).padStart(2, '0')}`
                                });
                            }
                        });
                    }
                }
                // Envoyer la requête de sauvegarde pour ce jour
                await sendDailyAvailabilities(dateKey, availabilitiesToSend);
            }
            alert("Toutes les modifications ont été enregistrées !");
            hasUnsavedChanges = false;
            await fetchAgentPlanningForWeek(currentWeekIdentifier, currentAgentId); // Recharger tout le planning
            updateSaveClearButtonsVisibility();
        } catch (error) {
            console.error('Erreur lors de l\'enregistrement des modifications:', error);
            showError(`Erreur lors de l'enregistrement: ${error.message}`);
        } finally {
            hideLoading();
        }
    }

    /**
     * Envoie les disponibilités d'un jour spécifique à l'API.
     * @param {string} dateKey - La date au format YYYY-MM-DD.
     * @param {Array<Object>} availabilities - Tableau des objets {start, end}.
     */
    async function sendDailyAvailabilities(dateKey, availabilities) {
        const options = getRequestOptions('POST');
        if (!options) throw new Error("Options de requête non disponibles.");

        const response = await fetch(`/api/agent-availability/${dateKey}/${currentAgentId}`, {
            method: 'POST',
            headers: options.headers,
            body: JSON.stringify(availabilities)
        });
        await handleApiResponse(response); // Gère les erreurs ou renvoie la réponse parsée
    }


    /**
     * Configure les écouteurs d'événements pour les onglets des jours (Bootstrap).
     */
    function setupDayTabs() {
        const dayTabButtons = document.querySelectorAll('.nav-link[data-bs-toggle="tab"]');
        if (!dayTabButtons.length) {
            console.warn("Aucun bouton d'onglet de jour trouvé. Assurez-vous que les éléments avec la classe 'nav-link' et 'data-bs-toggle=\"tab\"' sont présents dans le HTML.");
            return;
        }
        // Pas besoin de listeners 'shown.bs.tab' pour l'instant car renderSchedule gère tous les onglets.
    }

    // --- Initialisation de l'application ---
    /**
     * Fonction d'initialisation principale, appelée une fois le DOM chargé.
     */
    function init() {
        // Ajout des écouteurs d'événements pour les contrôles de semaine et les boutons d'action
        if (weekSelect) {
            weekSelect.addEventListener('change', (e) => {
                currentWeekIdentifier = e.target.value;
                const selectedOption = e.target.options[e.target.selectedIndex];
                currentWeekDates = {
                    startDate: selectedOption.dataset.startDate,
                    endDate: selectedOption.dataset.endDate
                };
                updateCurrentWeekDisplay();
                fetchAgentPlanningForWeek(currentWeekIdentifier, currentAgentId);
            });
        }
        if (prevWeekBtn) {
            prevWeekBtn.addEventListener('click', () => {
                const options = Array.from(weekSelect.options);
                const currentOptionIndex = options.findIndex(opt => opt.value === currentWeekIdentifier);
                if (currentOptionIndex > 0) {
                    currentWeekIdentifier = options[currentOptionIndex - 1].value;
                    weekSelect.value = currentWeekIdentifier; // Mettre à jour la sélection visuelle
                    const selectedOption = options[currentOptionIndex - 1];
                    currentWeekDates = {
                        startDate: selectedOption.dataset.startDate,
                        endDate: selectedOption.dataset.endDate
                    };
                    updateCurrentWeekDisplay();
                    fetchAgentPlanningForWeek(currentWeekIdentifier, currentAgentId);
                }
            });
        }
        if (nextWeekBtn) {
            nextWeekBtn.addEventListener('click', () => {
                const options = Array.from(weekSelect.options);
                const currentOptionIndex = options.findIndex(opt => opt.value === currentWeekIdentifier);
                if (currentOptionIndex < options.length - 1) {
                    currentWeekIdentifier = options[currentOptionIndex + 1].value;
                    weekSelect.value = currentWeekIdentifier; // Mettre à jour la sélection visuelle
                    const selectedOption = options[currentOptionIndex + 1];
                    currentWeekDates = {
                        startDate: selectedOption.dataset.startDate,
                        endDate: selectedOption.dataset.endDate
                    };
                    updateCurrentWeekDisplay();
                    fetchAgentPlanningForWeek(currentWeekIdentifier, currentAgentId);
                }
            });
        }
        // Le bouton "Enregistrer les modifications" va maintenant sauvegarder toutes les sélections visibles
        if (saveSlotsBtn) {
            saveSlotsBtn.addEventListener('click', saveAllSelectedSlots);
        }
        if (clearSelectionBtn) {
            clearSelectionBtn.addEventListener('click', clearSelection);
        }
        if (logoutBtn) {
            logoutBtn.addEventListener('click', logout);
        }
        if (synthesisBtn) {
            synthesisBtn.addEventListener('click', showSynthesis);
        }

        // Gérer l'avertissement de fermeture de page avec des changements non sauvegardés
        window.addEventListener('beforeunload', function(event) {
            if (hasUnsavedChanges) {
                const confirmationMessage = 'Vous avez des modifications non sauvegardées. Êtes-vous sûr de vouloir quitter ?';
                event.returnValue = confirmationMessage; // Standard pour les anciens navigateurs
                return confirmationMessage; // Pour les navigateurs modernes
            }
        });

        // Chargement initial des données
        fetchAgentInfo(); // Charge les infos de l'agent au démarrage et set currentAgentId
        fetchWeeks(); // Charge les semaines et le planning de la semaine par défaut
        setupDayTabs(); // Initialise les onglets Bootstrap
        setupMouseListenersForSelection(); // Configure les écouteurs de souris pour le glisser-déposer
    }

    // Appel de la fonction d'initialisation principale une fois le DOM entièrement chargé
    init();

}); // Fin de DOMContentLoaded