// agent.js

// const API_BASE_URL = "https://dispo-pompier.onrender.com"; // Assurez-vous que cette URL est correcte
// L'API_BASE_URL n'est plus nécessaire si les appels fetch utilisent des chemins relatifs comme /api/...
// Le navigateur résoudra cela par rapport à l'origine de la page.

// Variables globales pour le suivi de l'état de l'application
let currentWeek = ''; // Pour stocker la semaine sélectionnée
let currentSchedule = []; // Pour stocker les données du planning
let hasUnsavedChanges = false; // Indique si des changements non sauvegardés existent
let isDragging = false; // Pour la sélection multiple par glisser-déposer
let dragStartSlot = null; // Le créneau où le glisser-déposer a commencé

// Map pour les noms des jours (peut être utile pour l'affichage)
const dayNames = {
    'monday': 'Lundi',
    'tuesday': 'Mardi',
    'wednesday': 'Mercredi',
    'thursday': 'Jeudi',
    'friday': 'Vendredi'
};

// --- Début du code qui s'exécute une fois le DOM chargé ---
document.addEventListener('DOMContentLoaded', function() {
    // Références DOM pour les éléments de la page agent.html
    const agentNameDisplay = document.getElementById('agent-name-display'); // Vérifier si cet ID existe dans HTML si utilisé
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
    const currentWeekSpan = document.getElementById('current-week');

    // --- Fonctions utilitaires pour l'interface utilisateur ---

    /**
     * Affiche l'indicateur de chargement et efface les messages d'erreur.
     */
    function showLoading() {
        if (loadingSpinner) loadingSpinner.style.display = 'block';
        if (errorMessage) errorMessage.textContent = '';
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

    // --- Fonctions d'interaction avec l'API ---

    /**
     * Récupère la liste des semaines disponibles depuis l'API.
     */
    async function fetchWeeks() {
        showLoading();
        try {
            const options = getRequestOptions();
            if (!options) return;

            const response = await fetch('/api/weeks', options);
            const weeks = await handleApiResponse(response);

            if (weekSelect) {
                weekSelect.innerHTML = weeks.map(week => `<option value="${week}">${week}</option>`).join('');
                if (weeks.length > 0) {
                    currentWeek = weekSelect.value; // Définir la semaine actuelle sur la première de la liste
                    await fetchSchedule(currentWeek);
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
     * Récupère le planning d'un agent pour une semaine donnée.
     * @param {string} week - La semaine pour laquelle récupérer le planning (ex: "2025-W25").
     */
    async function fetchSchedule(week) {
        showLoading();
        try {
            const options = getRequestOptions();
            if (!options) return;

            const response = await fetch(`/api/schedule?week=${week}`, options);
            const schedule = await handleApiResponse(response);

            currentSchedule = schedule; // Stocke le planning actuel
            renderSchedule(schedule); // Affiche le planning
            if (currentWeekSpan) {
                currentWeekSpan.textContent = `Semaine du ${week}`;
            }
            hideError(); // Effacer toute erreur précédente
        } catch (error) {
            console.error('Erreur lors de la récupération du planning:', error);
            showError(`Erreur lors du chargement du planning: ${error.message}`);
            renderEmptySchedule();
        } finally {
            hideLoading();
        }
    }

    /**
     * Enregistre les créneaux sélectionnés de l'agent.
     */
    async function saveSchedule() {
        showLoading();
        try {
            const options = getRequestOptions('POST');
            if (!options) return;

            const selectedSlots = [];
            currentSchedule.forEach(day => {
                day.slots.forEach(slot => {
                    if (slot.selected) { // Uniquement les créneaux marqués comme sélectionnés dans l'état
                        selectedSlots.push({ day: day.day, time: slot.time });
                    }
                });
            });

            const response = await fetch('/api/schedule', {
                ...options, // Copie les headers et la méthode
                body: JSON.stringify({ week: currentWeek, selectedSlots })
            });

            const result = await handleApiResponse(response);
            alert(result.message); // Utiliser une modale plus tard si possible
            hasUnsavedChanges = false; // Réinitialiser le flag
            await fetchSchedule(currentWeek); // Recharger le planning pour voir les mises à jour
            updateSaveClearButtonsVisibility(); // Mettre à jour la visibilité des boutons
        } catch (error) {
            console.error('Erreur lors de l\'enregistrement du planning:', error);
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
            // Options pour la requête de déconnexion. Note: Certains serveurs peuvent ne pas nécessiter un token pour /logout.
            const options = getRequestOptions('POST'); // Si le logout nécessite un token

            // Envoyez une requête de déconnexion au serveur si nécessaire (pour invalider le token côté serveur)
            // Sinon, la suppression locale du token est suffisante.
            if (options) { // Si le token existe, envoyons la requête de logout
                 await fetch('/logout', options); // Assurez-vous que votre serveur gère cette route
            }

            localStorage.removeItem('token'); // Supprime le token du stockage local
            window.location.href = '/'; // Redirige vers la page de connexion
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
            const synthesisData = await handleApiResponse(response);

            // Afficher la synthèse des données (peut être dans une modale dédiée ou une nouvelle vue)
            let synthesisMessage = "Synthèse des réservations :\n";
            for (const day in synthesisData) {
                synthesisMessage += `\n${dayNames[day] || day}:`;
                if (synthesisData[day].length > 0) {
                    synthesisData[day].forEach(slot => {
                        synthesisMessage += `\n  - ${slot.time}`;
                    });
                } else {
                    synthesisMessage += `\n  - Aucun créneau réservé.`;
                }
            }
            alert(synthesisMessage); // Utiliser une modale pour un meilleur UX
        } catch (error) {
            console.error('Erreur lors de la récupération de la synthèse:', error);
            showError(`Erreur lors de la synthèse: ${error.message}`);
        } finally {
            hideLoading();
        }
    }

    // --- Fonctions de rendu et de logique de l'interface utilisateur ---

    /**
     * Rend le planning dans l'interface utilisateur.
     * @param {Array<Object>} schedule - Le tableau de l'objet planning.
     */
    function renderSchedule(schedule) {
        if (!scheduleContainer) {
            console.error("Conteneur de planning non trouvé.");
            return;
        }

        // Les onglets des jours sont déjà définis dans HTML.
        // Nous allons maintenant remplir le contenu de chaque onglet.
        const daysOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

        daysOrder.forEach(day => {
            const daySchedule = schedule.find(s => s.day === day);
            const dayTabPane = document.getElementById(day); // Le div 'tab-pane' pour ce jour

            if (dayTabPane) {
                dayTabPane.innerHTML = ''; // Effacer le contenu précédent

                const ul = document.createElement('ul');
                ul.className = 'list-group list-group-flush';

                if (daySchedule && daySchedule.slots.length > 0) {
                    daySchedule.slots.sort((a, b) => {
                        const timeA = parseInt(a.time.split(':')[0]);
                        const timeB = parseInt(b.time.split(':')[0]);
                        // Gérer les créneaux comme "08:00" vs "08:30" correctement
                        const [hA, mA] = a.time.split(':').map(Number);
                        const [hB, mB] = b.time.split(':').map(Number);
                        return (hA * 60 + mA) - (hB * 60 + mB);
                    }).forEach(slot => {
                        const li = document.createElement('li');
                        li.className = `list-group-item d-flex justify-content-between align-items-center time-slot ${slot.available ? 'available' : 'booked'} ${slot.selected ? 'selected' : ''}`;
                        li.dataset.day = day;
                        li.dataset.time = slot.time;
                        li.dataset.available = slot.available; // Stocke la disponibilité
                        li.dataset.index = `${day}-${slot.time}`; // Index unique pour la sélection multiple

                        const timeSpan = document.createElement('span');
                        timeSpan.textContent = slot.time;
                        li.appendChild(timeSpan);

                        const statusSpan = document.createElement('span');
                        statusSpan.className = `badge ${slot.available ? 'bg-success' : 'bg-danger'} rounded-pill`;
                        statusSpan.textContent = slot.available ? 'Disponible' : 'Réservé';
                        li.appendChild(statusSpan);

                        if (slot.available) {
                            // Ajouter les écouteurs pour la sélection
                            li.addEventListener('click', (e) => handleSlotClick(li, day, slot.time, e));
                            li.addEventListener('mousedown', (e) => handleSlotMouseDown(li, day, slot.time, e));
                            li.addEventListener('mouseenter', () => handleSlotMouseEnter(li, day, slot.time));
                        }

                        ul.appendChild(li);
                    });
                } else {
                    const li = document.createElement('li');
                    li.className = 'list-group-item text-muted';
                    li.textContent = `Aucun créneau pour ${dayNames[day]}.`;
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
            // Efface le contenu de tous les onglets
            const daysOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
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
     * Gère le clic simple sur un créneau pour la sélection.
     * @param {HTMLElement} slotElement - L'élément DOM du créneau.
     * @param {string} day - Le jour du créneau.
     * @param {string} time - L'heure du créneau.
     * @param {MouseEvent} event - L'événement de la souris.
     */
    function handleSlotClick(slotElement, day, time, event) {
        if (!isDragging) { // Seulement si pas en mode glisser-déposer
            toggleSlotSelection(slotElement, day, time);
            hasUnsavedChanges = true;
        }
    }

    /**
     * Bascule l'état de sélection d'un créneau dans l'interface et dans l'état interne.
     * @param {HTMLElement} slotElement - L'élément DOM du créneau.
     * @param {string} day - Le jour du créneau.
     * @param {string} time - L'heure du créneau.
     * @param {boolean} [forceState] - Force l'état de sélection (true pour sélectionner, false pour désélectionner).
     */
    function toggleSlotSelection(slotElement, day, time, forceState = undefined) {
        const isSelected = slotElement.classList.contains('selected');
        const newState = forceState !== undefined ? forceState : !isSelected;

        if (newState) {
            slotElement.classList.add('selected');
        } else {
            slotElement.classList.remove('selected');
        }

        // Met à jour l'état interne de `currentSchedule`
        const dayObj = currentSchedule.find(s => s.day === day);
        if (dayObj) {
            const slot = dayObj.slots.find(s => s.time === time);
            if (slot) {
                slot.selected = newState;
            }
        }
        updateSaveClearButtonsVisibility();
        hasUnsavedChanges = true; // Un changement de sélection marque les changements non sauvegardés
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
        if (isDragging && dragStartSlot && slotElement.dataset.available === 'true') {
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
     * en fonction des créneaux sélectionnés.
     */
    function updateSaveClearButtonsVisibility() {
        const hasSelected = currentSchedule.some(day =>
            day.slots.some(slot => slot.selected)
        );

        if (saveSlotsBtn) {
            saveSlotsBtn.style.display = hasSelected ? 'inline-block' : 'none'; // Utilisez inline-block pour les boutons côte à côte
        }
        if (clearSelectionBtn) {
            clearSelectionBtn.style.display = hasSelected ? 'inline-block' : 'none';
        }
    }

    /**
     * Efface toutes les sélections de créneaux dans l'interface et l'état interne.
     */
    function clearSelection() {
        currentSchedule.forEach(day => {
            day.slots.forEach(slot => {
                slot.selected = false;
            });
        });
        const selectedElements = document.querySelectorAll('.time-slot.selected');
        selectedElements.forEach(el => el.classList.remove('selected'));
        hasUnsavedChanges = true; // Marque les changements non sauvegardés
        updateSaveClearButtonsVisibility();
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
        // C'est utile si vous voulez charger le planning jour par jour à l'ouverture de l'onglet.
    }

    // --- Initialisation de l'application ---
    /**
     * Fonction d'initialisation principale, appelée une fois le DOM chargé.
     */
    function init() {
        // Ajout des écouteurs d'événements pour les contrôles de semaine et les boutons d'action
        if (weekSelect) {
            weekSelect.addEventListener('change', (e) => {
                currentWeek = e.target.value;
                fetchSchedule(currentWeek);
            });
        }
        if (prevWeekBtn) {
            prevWeekBtn.addEventListener('click', () => {
                const options = Array.from(weekSelect.options).map(opt => opt.value);
                const currentIndex = options.indexOf(currentWeek);
                if (currentIndex > 0) {
                    currentWeek = options[currentIndex - 1];
                    weekSelect.value = currentWeek; // Mettre à jour la sélection visuelle
                    fetchSchedule(currentWeek);
                }
            });
        }
        if (nextWeekBtn) {
            nextWeekBtn.addEventListener('click', () => {
                const options = Array.from(weekSelect.options).map(opt => opt.value);
                const currentIndex = options.indexOf(currentWeek);
                if (currentIndex < options.length - 1) {
                    currentWeek = options[currentIndex + 1];
                    weekSelect.value = currentWeek; // Mettre à jour la sélection visuelle
                    fetchSchedule(currentWeek);
                }
            });
        }
        if (saveSlotsBtn) {
            saveSlotsBtn.addEventListener('click', saveSchedule);
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
        fetchWeeks(); // Charge les semaines et le planning de la semaine par défaut
        setupDayTabs(); // Initialise les onglets Bootstrap
        setupMouseListenersForSelection(); // Configure les écouteurs de souris pour le glisser-déposer
    }

    // Appel de la fonction d'initialisation principale une fois le DOM entièrement chargé
    init();

}); // Fin de DOMContentLoaded
