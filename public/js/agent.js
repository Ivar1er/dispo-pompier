// agent.js

// URL de base de l'API. Assurez-vous que cette URL est correcte pour votre environnement.
const API_BASE_URL = "https://dispo-pompier.onrender.com";

// Références DOM pour les éléments de la page agent.html
// Utilisation de constantes pour les éléments DOM principaux pour éviter les modifications accidentelles
const agentNameDisplay = document.getElementById('agent-name-display');
const agentQualificationsDisplay = document.getElementById('agentQualificationsDisplay');
const currentWeekDisplay = document.getElementById('current-week-display');
const prevWeekBtn = document.getElementById('prev-week-btn');
const nextWeekBtn = document.getElementById('next-week-btn');
const weekSelect = document.getElementById('week-select'); // Référence au sélecteur de semaine
const planningContainer = document.getElementById('planning-container'); // Le nouveau conteneur des colonnes de jours
const saveSlotsBtn = document.getElementById('save-slots-btn');
const clearSelectionBtn = document.getElementById('clear-selection-btn');
const logoutBtn = document.getElementById('logout-btn');
const loadingSpinner = document.getElementById('loading-spinner');

// Variables d'état de l'application
let currentAgentId;
let currentAgentName;
let currentAgentRole;
let currentAgentQualifications = [];
let currentWeekNumber;
let currentYear;
let planningData = {}; // Stocke le planning complet de l'agent: { week-X: { day: [slots] } }

// Jours de la semaine en français pour l'affichage et la logique
const DAYS_OF_WEEK_FR = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

// --- Fonctions utilitaires ---

/**
 * Affiche ou masque le spinner de chargement.
 * @param {boolean} show - True pour afficher, False pour masquer.
 */
function toggleLoadingSpinner(show) {
    if (loadingSpinner) {
        if (show) {
            loadingSpinner.classList.remove('hidden');
        } else {
            loadingSpinner.classList.add('hidden');
        }
    }
}

/**
 * Calcule le numéro de semaine ISO pour une date donnée.
 * @param {Date} d - La date à analyser.
 * @returns {number} Le numéro de semaine ISO.
 */
function getISOWeekNumber(d) {
    const date = new Date(d.getTime());
    date.setHours(0, 0, 0, 0);
    // Jeudi en semaine 4
    date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
    // Début de l'année
    const week1 = new Date(date.getFullYear(), 0, 4);
    // Retourne le numéro de semaine
    return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}

/**
 * Obtient la date du lundi d'une semaine et année données.
 * @param {number} w - Le numéro de semaine ISO.
 * @param {number} y - L'année.
 * @returns {Date} La date du lundi de la semaine spécifiée.
 */
function getDateOfWeek(w, y) {
    const date = new Date(y, 0, 1 + (w - 1) * 7);
    if (date.getDay() <= 4) {
        date.setDate(date.getDate() - date.getDay() + 1);
    } else {
        date.setDate(date.getDate() + 8 - date.getDay());
    }
    return date;
}

/**
 * Formate une date en chaîne 'YYYY-MM-DD'.
 * @param {Date} d - La date à formater.
 * @returns {string} La date formatée.
 */
function formatDateToYYYYMMDD(d) {
    const dt = new Date(d);
    return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}` +
           `-${String(dt.getDate()).padStart(2,'0')}`;
}

/**
 * Récupère le token JWT de session.
 * @returns {string|null} Le token JWT ou null s'il n'est pas trouvé.
 */
function getToken() {
    return sessionStorage.getItem('token');
}

/**
 * Crée les en-têtes d'autorisation pour les requêtes API.
 * @returns {Object} Les en-têtes.
 */
function getAuthHeaders() {
    const token = getToken();
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

/**
 * Convertit une chaîne de temps "HH:MM" en nombre de minutes depuis minuit.
 * @param {string} timeStr - La chaîne de temps.
 * @returns {number} Le nombre total de minutes.
 */
function parseTimeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}

/**
 * Convertit un nombre de minutes depuis minuit en format "HH:MM".
 * Gère le cas de 24:00.
 * @param {number} totalMinutes - Le nombre total de minutes.
 * @returns {string} La chaîne de temps formatée.
 */
function minutesToTime(totalMinutes) {
    let hours = Math.floor(totalMinutes / 60);
    let minutes = totalMinutes % 60;
    // Si l'heure est 24:00, affiche 00:00 (pour la fin de journée)
    if (hours === 24 && minutes === 0) {
        hours = 0;
    }
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}


// --- Fonctions de gestion de l'interface utilisateur (modales) ---

/**
 * Affiche une modale de message personnalisée.
 * @param {string} title - Titre de la modale.
 * @param {string} message - Contenu du message.
 * @param {string} type - Type de message ('info', 'success', 'warning', 'error', 'question').
 * @param {Function} callback - Fonction de rappel pour les modales de question (accepte un booléen).
 */
function displayMessageModal(title, message, type = "info", callback = null) {
    let modal = document.getElementById('custom-message-modal');
    // Crée la modale et son style si elle n'existe pas
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'custom-message-modal';
        modal.className = 'modal-overlay';
        document.body.appendChild(modal);

        // Styles CSS pour la modale, injectés une seule fois
        const modalCss = `
            .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.6); display: flex; justify-content: center; align-items: center; z-index: 1000; font-family: 'Poppins', sans-serif; }
            .modal-content { background-color: #fff; padding: 25px 35px; border-radius: 12px; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2); width: 90%; max-width: 450px; animation: fadeIn 0.3s ease-out; display: flex; flex-direction: column; gap: 20px; }
            .modal-header { display: flex; justify-content: flex-start; align-items: center; border-bottom: 1px solid #eee; padding-bottom: 15px; margin-bottom: 15px; }
            .modal-header h2 { margin: 0; color: #333; font-size: 1.5em; }
            .modal-body { color: #555; font-size: 1em; line-height: 1.6; }
            .modal-footer { display: flex; justify-content: flex-end; gap: 10px; padding-top: 15px; border-top: 1px solid #eee; margin-top: 15px; }
            .btn { padding: 10px 20px; border: none; border-radius: 8px; cursor: pointer; font-size: 0.95em; font-weight: 500; transition: background-color 0.2s ease, transform 0.1s ease; }
            .btn-primary { background-color: var(--primary-color); color: white; }
            .btn-primary:hover { background-color: var(--primary-hover-color); transform: translateY(-1px); }
            .btn-secondary { background-color: var(--secondary-color); color: white; }
            .btn-secondary:hover { background-color: var(--secondary-hover-color); transform: translateY(-1px); }
            .modal-icon { font-size: 2em; margin-right: 15px; align-self: flex-start; }
            .modal-icon.info { color: #007bff; }
            .modal-icon.success { color: #28a745; }
            .modal-icon.warning { color: #ffc107; }
            .modal-icon.error { color: #dc3545; }
            .modal-icon.question { color: #6c757d; }
            @keyframes fadeIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
            @media (max-width: 480px) {
                .modal-content { padding: 20px; }
                .modal-header h2 { font-size: 1.3em; }
                .modal-icon { font-size: 1.8em; margin-right: 10px; }
                .btn { padding: 8px 15px; font-size: 0.9em; }
            }
        `;
        const styleSheet = document.createElement("style");
        styleSheet.type = "text/css";
        styleSheet.innerText = modalCss;
        document.head.appendChild(styleSheet);
    }

    let iconHtml = '';
    // Sélectionne l'icône appropriée selon le type de message
    switch (type) {
        case 'info': iconHtml = '💡'; break;
        case 'success': iconHtml = '✅'; break;
        case 'warning': iconHtml = '⚠️'; break;
        case 'error': iconHtml = '❌'; break;
        case 'question': iconHtml = '❓'; break;
        default: iconHtml = '💬'; break; // Icône par défaut
    }

    // Met à jour le contenu HTML de la modale
    modal.innerHTML = `
        <div class="modal-content" role="alertdialog" aria-labelledby="modal-title" aria-describedby="modal-message">
            <div class="modal-header">
                <span class="modal-icon ${type}" aria-hidden="true">${iconHtml}</span>
                <h2 id="modal-title">${title}</h2>
            </div>
            <div class="modal-body">
                <p id="modal-message">${message}</p>
            </div>
            <div class="modal-footer">
                ${callback ? '<button id="modal-cancel-btn" class="btn btn-secondary">Annuler</button>' : ''}
                <button id="modal-ok-btn" class="btn btn-primary">OK</button>
            </div>
        </div>
    `;

    modal.style.display = 'flex'; // Affiche la modale

    // Gestion des événements pour les boutons OK et Annuler
    const okBtn = modal.querySelector('#modal-ok-btn');
    okBtn.onclick = () => {
        modal.style.display = 'none';
        if (callback) callback(true);
    };

    if (callback) {
        const cancelBtn = modal.querySelector('#modal-cancel-btn');
        cancelBtn.onclick = () => {
            modal.style.display = 'none';
            callback(false);
        };
    }

    // Ferme la modale si l'utilisateur clique en dehors du contenu
    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
            if (callback) callback(false); // Annule l'action si on clique en dehors
        }
    };
}

// Redéfinition globale de window.confirm et window.alert pour utiliser la modale personnalisée
window.confirm = (message) => {
    return new Promise((resolve) => {
        displayMessageModal("Confirmation", message, "question", (result) => {
            resolve(result);
        });
    });
};
window.alert = (message) => {
    displayMessageModal("Information", message, "info");
};


// --- Chargement des données de planning de l'agent ---
async function loadAgentPlanning() {
    toggleLoadingSpinner(true); // Affiche le spinner
    const token = getToken();
    if (!token) {
        console.error("loadAgentPlanning: Token manquant. Redirection vers la page de connexion.");
        displayMessageModal("Session expirée", "Votre session a expiré. Veuillez vous reconnecter.", "error", () => {
            window.location.href = "index.html"; // Redirige vers la page de login
        });
        toggleLoadingSpinner(false);
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/planning/${currentAgentId}`, {
            headers: getAuthHeaders()
        });

        if (response.status === 403) {
             console.error("loadAgentPlanning: Accès 403 - Rôle non autorisé ou token invalide.");
             displayMessageModal("Accès non autorisé", "Vous n'avez pas l'autorisation de voir ce planning.", "error", () => {
                window.location.href = "index.html"; // Redirige si non autorisé
            });
            toggleLoadingSpinner(false);
            return;
        }
        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status} - ${response.statusText}`);
        }

        planningData = await response.json(); // Charge le planning complet de l'agent
        renderPlanningGrid(); // Rend la nouvelle grille de planning

    } catch (error) {
        console.error("Erreur lors du chargement du planning de l'agent:", error);
        displayMessageModal("Erreur de chargement", error.message || "Impossible de charger votre planning. Veuillez réessayer.", "error");
    } finally {
        toggleLoadingSpinner(false); // Masque le spinner quelle que soit l'issue
    }
}

// --- Sauvegarde des créneaux de disponibilité pour une date spécifique ---
async function saveAvailabilitiesForDate(dateKey, availabilities) {
    toggleLoadingSpinner(true); // Affiche le spinner
    const token = getToken();
    if (!token) {
        console.error("saveAvailabilitiesForDate: Token manquant. Redirection vers la page de connexion.");
        displayMessageModal("Session expirée", "Votre session a expiré. Veuillez vous reconnecter.", "error", () => {
            window.location.href = "index.html";
        });
        toggleLoadingSpinner(false);
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/agent-availability/${dateKey}/${currentAgentId}`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(availabilities)
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error("saveAvailabilitiesForDate: Erreur réponse API:", errorData.message || response.statusText);
            throw new Error(errorData.message || 'Erreur lors de la sauvegarde des disponibilités.');
        }

        displayMessageModal("Succès", "Vos disponibilités ont été enregistrées.", "success");
        await loadAgentPlanning(); // Recharger le planning après sauvegarde pour mise à jour de l'affichage

    } catch (error) {
        console.error("Erreur lors de la sauvegarde des disponibilités:", error);
        displayMessageModal("Erreur de sauvegarde", error.message || "Impossible d'enregistrer vos disponibilités.", "error");
    } finally {
        toggleLoadingSpinner(false); // Masque le spinner
    }
}

/**
 * Charge les qualifications de l'agent.
 */
async function loadAgentQualifications() {
    if (!currentAgentId) {
        console.warn("loadAgentQualifications: ID agent manquant.");
        return;
    }
    const token = getToken();
    if (!token) {
        console.error("loadAgentQualifications: Token manquant.");
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/agents/${currentAgentId}/qualifications`, {
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            if (response.status === 404) {
                 console.info(`Aucune qualification trouvée pour l'agent ${currentAgentId}.`);
                 currentAgentQualifications = [];
            } else {
                throw new Error(`Erreur HTTP: ${response.status} - ${response.statusText}`);
            }
        } else {
            const data = await response.json();
            currentAgentQualifications = data.qualifications || [];
        }
        renderAgentQualifications(); // Met à jour l'affichage des qualifications

    } catch (error) {
        console.error("Erreur lors du chargement des qualifications de l'agent:", error);
    }
}

/**
 * Affiche les qualifications de l'agent dans le DOM.
 */
function renderAgentQualifications() {
    if (agentQualificationsDisplay) {
        if (currentAgentQualifications.length > 0) {
            agentQualificationsDisplay.innerHTML = 'Vos qualifications : ' +
                currentAgentQualifications.map(q => `<span class="qualification-tag">${q}</span>`).join(' ');
        } else {
            agentQualificationsDisplay.innerHTML = 'Aucune qualification renseignée.';
        }
    }
}

/**
 * Remplit le sélecteur de semaine avec la semaine en cours, 1 semaine passée et 3 semaines futures.
 */
function populateWeekSelector() {
    if (!weekSelect) {
        console.warn("L'élément 'week-select' est introuvable.");
        return;
    }

    weekSelect.innerHTML = ''; // Vide les options existantes
    const today = new Date();
    const currentISOWeek = getISOWeekNumber(today);
    const currentYearFull = today.getFullYear();

    // Boucle pour 1 semaine passée, la semaine actuelle et 3 semaines futures
    for (let i = -1; i <= 3; i++) {
        let year = currentYearFull;
        let week = currentISOWeek + i;

        // Gérer le passage d'année pour les semaines
        if (week < 1) {
            year--;
            week = getISOWeekNumber(new Date(year, 11, 31)); // Dernière semaine de l'année précédente
        } else {
            const lastDayOfCurrentYear = new Date(year, 11, 31);
            const lastWeekOfCurrentYear = getISOWeekNumber(lastDayOfCurrentYear);
            if (week > lastWeekOfCurrentYear) {
                year++;
                week = 1;
            }
        }
        
        const monday = getDateOfWeek(week, year);
        const sunday = new Date(monday.getTime() + 6 * 24 * 60 * 60 * 1000);
        const optionText = `Semaine ${week} (${monday.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} - ${sunday.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })})`;
        const optionValue = `${year}-${week}`;

        const option = document.createElement('option');
        option.value = optionValue;
        option.textContent = optionText;
        if (week === currentWeekNumber && year === currentYear) {
            option.selected = true;
        }
        weekSelect.appendChild(option);
    }

    // Ajoute un écouteur d'événements pour le changement de sélection
    weekSelect.addEventListener('change', async (event) => {
        const [year, week] = event.target.value.split('-').map(Number);
        currentYear = year;
        currentWeekNumber = week;
        await loadAgentPlanning(); // Recharge le planning pour la nouvelle semaine sélectionnée
    });
}


// --- Rendu du planning ---
function renderPlanningGrid() {
    if (!planningContainer) {
        console.error("Erreur DOM: L'élément 'planning-container' est introuvable. Assurez-vous que l'ID est correct dans agent.html.");
        displayMessageModal("Erreur d'affichage", "Impossible d'afficher le planning. L'élément de grille est manquant.", "error");
        return;
    }
    planningContainer.innerHTML = ''; // Vide le conteneur actuel

    const mondayOfCurrentWeek = getDateOfWeek(currentWeekNumber, currentYear);
    const sundayOfCurrentWeek = new Date(mondayOfCurrentWeek.getTime() + 6 * 24 * 60 * 60 * 1000);

    if (currentWeekDisplay) {
        currentWeekDisplay.textContent = `Semaine ${currentWeekNumber} (${mondayOfCurrentWeek.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} - ${sundayOfCurrentWeek.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })})`;
    } else {
        console.warn("L'élément 'current-week-display' est introuvable dans agent.html.");
    }

    const weeklyPlanning = planningData[`week-${currentWeekNumber}`] || {};

    // Création des colonnes pour chaque jour
    DAYS_OF_WEEK_FR.forEach((dayName, dayIndex) => {
        const dayColumn = document.createElement('div');
        dayColumn.classList.add('day-column');
        dayColumn.dataset.day = dayName;

        const dayHeader = document.createElement('div');
        dayHeader.classList.add('day-header');
        dayHeader.textContent = dayName.charAt(0).toUpperCase() + dayName.slice(1);
        dayColumn.appendChild(dayHeader);

        const slotsWrapper = document.createElement('div');
        slotsWrapper.classList.add('slots-wrapper');

        // Création des créneaux de 30 min pour chaque jour (00:00 à 23:30)
        for (let i = 0; i < 48; i++) {
            const h = Math.floor(i / 2);
            const m = (i % 2) * 30;
            const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

            const timeLabelDiv = document.createElement('div');
            timeLabelDiv.classList.add('time-slot-label');
            timeLabelDiv.textContent = `${timeStr} - ${minutesToTime(h * 60 + m + 30)}`; // Ex: 07:00 - 07:30

            const cell = document.createElement('div');
            cell.classList.add('planning-cell');
            cell.dataset.time = timeStr;
            cell.dataset.day = dayName;
            cell.dataset.slotIndex = i;

            // Vérifier si ce créneau est "disponible" dans les données de planning
            const dayAvailabilities = weeklyPlanning[dayName] || [];
            let isAvailable = false;

            for (const rangeStr of dayAvailabilities) {
                const [start, end] = rangeStr.split(' - ');
                const cellStartMinutes = parseTimeToMinutes(timeStr);
                const cellEndMinutes = cellStartMinutes + 30;
                
                const rangeStartMinutes = parseTimeToMinutes(start);
                const rangeEndMinutes = parseTimeToMinutes(end);

                // Logique de chevauchement : un créneau est disponible s'il chevauche une plage.
                if (cellStartMinutes < rangeEndMinutes && cellEndMinutes > rangeStartMinutes) {
                    isAvailable = true;
                    break;
                }
            }

            if (isAvailable) {
                cell.classList.add('available');
            } else {
                cell.classList.add('unavailable');
                cell.style.pointerEvents = 'none';
                cell.tabIndex = -1;
            }

            // Seulement les créneaux 'available' sont interactifs
            if (isAvailable) {
                cell.addEventListener('mousedown', handleMouseDown);
                cell.addEventListener('mouseover', handleMouseOver);
                cell.addEventListener('mouseup', handleMouseUp);
            }
            
            slotsWrapper.appendChild(timeLabelDiv); // Ajoute le label d'heure
            slotsWrapper.appendChild(cell); // Ajoute la cellule du créneau
        }
        dayColumn.appendChild(slotsWrapper);
        planningContainer.appendChild(dayColumn);
    });

    // Sélectionne l'onglet du jour actuel ou du premier jour de la semaine si aucun onglet actif n'existe.
    const todayDay = DAYS_OF_WEEK_FR[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1]; // Ajuste Dimanche à la fin
    const currentDayTab = document.querySelector(`.tabs-navigation .tab[data-day-index="${DAYS_OF_WEEK_FR.indexOf(todayDay)}"]`);
    if (currentDayTab) {
        document.querySelectorAll('.tabs-navigation .tab').forEach(t => t.classList.remove('active'));
        currentDayTab.classList.add('active');
        // Défilement horizontal vers le jour actif si la colonne n'est pas visible
        const dayColumnElement = planningContainer.querySelector(`.day-column[data-day="${todayDay}"]`);
        if (dayColumnElement) {
            planningContainer.scroll({
                left: dayColumnElement.offsetLeft - planningContainer.offsetLeft,
                behavior: 'smooth' // Pour une animation de défilement fluide
            });
        }
    }
}


// --- Logique de sélection par glisser-déposer ---
let isSelecting = false;
let startCell = null;
let selectedCells = [];

function handleMouseDown(e) {
    if (e.button !== 0 || e.target.classList.contains('unavailable')) return;
    
    isSelecting = true;
    startCell = e.target;
    selectedCells = [];
    
    // Nettoie toutes les sélections précédentes
    if (planningContainer) {
        planningContainer.querySelectorAll('.selecting').forEach(cell => cell.classList.remove('selecting'));
        planningContainer.querySelectorAll('.selected').forEach(cell => cell.classList.remove('selected'));
    }
    
    startCell.classList.add('selecting');
    selectedCells.push(startCell);
}

function handleMouseOver(e) {
    if (!isSelecting || !startCell) return;

    const currentCell = e.target.closest('.planning-cell');
    if (!currentCell || currentCell.classList.contains('unavailable')) return;

    // Vérifie que la sélection se fait dans la même colonne (même jour)
    if (currentCell.dataset.day !== startCell.dataset.day) return;

    // Réinitialise les classes 'selecting' pour une mise à jour visuelle fluide
    if (planningContainer) planningContainer.querySelectorAll('.selecting').forEach(cell => cell.classList.remove('selecting'));
    selectedCells = [];

    const startSlotIndex = parseInt(startCell.dataset.slotIndex);
    const currentSlotIndex = parseInt(currentCell.dataset.slotIndex);
    const selectedDay = startCell.dataset.day;

    const minSlot = Math.min(startSlotIndex, currentSlotIndex);
    const maxSlot = Math.max(startSlotIndex, currentSlotIndex);

    // Parcourt tous les créneaux de la journée sélectionnée
    planningContainer.querySelectorAll(`.planning-cell[data-day="${selectedDay}"]`).forEach(cell => {
        const slotIndex = parseInt(cell.dataset.slotIndex);
        if (slotIndex >= minSlot && slotIndex <= maxSlot) {
            if (!cell.classList.contains('unavailable')) {
                cell.classList.add('selecting');
                selectedCells.push(cell);
            }
        }
    });
}

async function handleMouseUp() {
    if (!isSelecting) return;
    isSelecting = false;

    if (selectedCells.length > 0) {
        selectedCells.forEach(cell => {
            cell.classList.remove('selecting');
            cell.classList.add('selected');
        });
    }
    startCell = null;
}


// --- Fonctions de gestion des boutons ---

/**
 * Sauvegarde les créneaux sélectionnés.
 */
async function saveSelectedSlots() {
    const trulySelectedCells = selectedCells.filter(cell => !cell.classList.contains('unavailable'));

    if (trulySelectedCells.length === 0) {
        displayMessageModal("Aucune sélection", "Veuillez sélectionner des créneaux avant d'enregistrer.", "warning");
        return;
    }

    const selectedDay = trulySelectedCells[0].dataset.day;
    const availabilitiesForDay = [];

    trulySelectedCells.sort((a, b) => parseInt(a.dataset.slotIndex) - parseInt(b.dataset.slotIndex));

    if (trulySelectedCells.length > 0) {
        let currentStartMinutes = parseTimeToMinutes(trulySelectedCells[0].dataset.time);
        let currentEndMinutes = currentStartMinutes + 30;

        for (let i = 1; i < trulySelectedCells.length; i++) {
            const nextCellTimeMinutes = parseTimeToMinutes(trulySelectedCells[i].dataset.time);
            if (nextCellTimeMinutes === currentEndMinutes) {
                currentEndMinutes += 30;
            } else {
                availabilitiesForDay.push({
                    start: minutesToTime(currentStartMinutes),
                    end: minutesToTime(currentEndMinutes)
                });
                currentStartMinutes = nextCellTimeMinutes;
                currentEndMinutes = currentStartMinutes + 30;
            }
        }
        availabilitiesForDay.push({
            start: minutesToTime(currentStartMinutes),
            end: minutesToTime(currentEndMinutes)
        });
    }

    const weekStartDate = getDateOfWeek(currentWeekNumber, currentYear);
    const dayIndex = DAYS_OF_WEEK_FR.indexOf(selectedDay.toLowerCase());
    const targetDate = new Date(weekStartDate);
    targetDate.setDate(weekStartDate.getDate() + dayIndex);

    const dateKey = formatDateToYYYYMMDD(targetDate);

    await saveAvailabilitiesForDate(dateKey, availabilitiesForDay);
    clearSelectedSlots();
}

/**
 * Efface la sélection courante de créneaux.
 */
function clearSelectedSlots() {
    if (!planningContainer) {
        console.error("Erreur DOM: L'élément 'planning-container' est introuvable pour effacer la sélection.");
        return;
    }
    planningContainer.querySelectorAll('.selected').forEach(cell => cell.classList.remove('selected'));
    planningContainer.querySelectorAll('.selecting').forEach(cell => cell.classList.remove('selecting'));
    selectedCells = [];
    startCell = null;
}

/**
 * Déconnecte l'agent et redirige vers la page de connexion.
 */
function logout() {
    sessionStorage.clear();
    window.location.href = "index.html";
}


// --- Initialisation de l'application ---
document.addEventListener("DOMContentLoaded", async () => {
    // Récupérer les informations de session
    currentAgentId = sessionStorage.getItem('agent');
    currentAgentName = sessionStorage.getItem('agentPrenom') + ' ' + sessionStorage.getItem('agentNom');
    currentAgentRole = sessionStorage.getItem('userRole');

    // Vérification initiale de l'authentification et du rôle
    const token = getToken();
    if (!currentAgentId || !token) {
        console.error("Initialisation Agent: ID agent ou Token manquant. Redirection vers login.");
        displayMessageModal("Session expirée", "Votre session a expiré ou n'est pas valide. Veuillez vous reconnecter.", "error", () => {
            window.location.href = "index.html";
        });
        return;
    }

    // Vérification du rôle pour cette page spécifique
    if (currentAgentRole !== 'agent') {
        console.error("Initialisation Agent: Rôle incorrect pour cette page. Rôle actuel:", currentAgentRole);
        displayMessageModal("Accès non autorisé", "Vous devez être connecté en tant qu'agent pour accéder à cette page.", "error", () => {
            if (currentAgentRole === 'admin') {
                window.location.href = "admin.html";
            } else {
                window.location.href = "index.html";
            }
        });
        return;
    }

    // Si tout est bon (authentifié et rôle 'agent')
    if (agentNameDisplay) {
        agentNameDisplay.textContent = currentAgentName; // N'affiche plus l'ID
    } else {
        console.warn("L'élément 'agent-name-display' est introuvable dans agent.html. Le nom de l'agent ne sera pas affiché.");
    }

    // Charge et affiche les qualifications de l'agent
    await loadAgentQualifications();

    // Initialiser la semaine actuelle
    const today = new Date();
    currentYear = today.getFullYear();
    currentWeekNumber = getISOWeekNumber(today);

    // Remplir le sélecteur de semaine et configurer son écouteur
    populateWeekSelector();
    // Le changement de semaine via le sélecteur appellera déjà loadAgentPlanning,
    // donc pas besoin d'un appel initial ici.


    // Configuration des événements pour la navigation entre les semaines (boutons)
    if (prevWeekBtn) {
        prevWeekBtn.addEventListener('click', async () => {
            let newWeek = currentWeekNumber - 1;
            let newYear = currentYear;
            if (newWeek < 1) {
                newYear--;
                newWeek = getISOWeekNumber(new Date(newYear, 11, 31));
            }
            currentWeekNumber = newWeek;
            currentYear = newYear;
            populateWeekSelector(); // Met à jour les options et sélectionne la nouvelle semaine
            await loadAgentPlanning();
        });
    } else {
        console.warn("L'élément 'prev-week-btn' est introuvable dans agent.html. Le bouton précédent ne sera pas fonctionnel.");
    }

    if (nextWeekBtn) {
        nextWeekBtn.addEventListener('click', async () => {
            let newWeek = currentWeekNumber + 1;
            let newYear = currentYear;
            const lastDayOfCurrentYear = new Date(currentYear, 11, 31);
            const lastWeekOfCurrentYear = getISOWeekNumber(lastDayOfCurrentYear);
            if (newWeek > lastWeekOfCurrentYear) {
                newYear++;
                newWeek = 1;
            }
            currentWeekNumber = newWeek;
            currentYear = newYear;
            populateWeekSelector(); // Met à jour les options et sélectionne la nouvelle semaine
            await loadAgentPlanning();
        });
    } else {
        console.warn("L'élément 'next-week-btn' est introuvable dans agent.html. Le bouton suivant ne sera pas fonctionnel.");
    }
    
    // Événements pour les boutons d'action
    if (saveSlotsBtn) {
        saveSlotsBtn.addEventListener('click', saveSelectedSlots);
    } else {
        console.warn("L'élément 'save-slots-btn' est introuvable dans agent.html. Le bouton de sauvegarde ne sera pas fonctionnel.");
    }

    if (clearSelectionBtn) {
        clearSelectionBtn.addEventListener('click', clearSelectedSlots);
    } else {
        console.warn("L'élément 'clear-selection-btn' est introuvable dans agent.html. Le bouton d'effacement de sélection ne sera pas fonctionnel.");
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    } else {
        console.warn("L'élément 'logout-btn' est introuvable dans agent.html. Le bouton de déconnexion ne sera pas fonctionnel.");
    }
    
    // Gestion des onglets de jour (pour le défilement horizontal vers le jour cliqué)
    document.querySelectorAll('.tabs-navigation .tab').forEach(tab => {
        tab.addEventListener('click', function() {
            document.querySelectorAll('.tabs-navigation .tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            const targetDayName = DAYS_OF_WEEK_FR[parseInt(this.dataset.dayIndex)];
            const dayColumnElement = planningContainer.querySelector(`.day-column[data-day="${targetDayName}"]`);
            if (dayColumnElement) {
                // Défilement horizontal vers la colonne du jour sélectionné
                planningContainer.scroll({
                    left: dayColumnElement.offsetLeft - planningContainer.offsetLeft,
                    behavior: 'smooth' // Pour une animation de défilement fluide
                });
            }
        });
    });

    // Chargement initial du planning une fois toutes les initialisations faites
    // Note: populateWeekSelector déjà déclenche un loadAgentPlanning via son événement 'change' initial
    // lors de la sélection de la semaine par défaut.
    // Pour s'assurer que le planning est chargé même si le select ne se déclenche pas,
    // ou si on veut charger AVANT de peupler le select (ce qui est préférable),
    // on peut l'appeler ici et s'assurer que populateWeekSelector ne le déclenche pas deux fois.
    // Pour l'instant, la logique est que populateWeekSelector sélectionne l'option actuelle,
    // et si le navigateur déclenche un 'change' sur cette sélection, alors loadAgentPlanning est appelé.
    // Si ce n'est pas le cas, on l'appelle explicitement.
    await loadAgentPlanning(); // Appeler après populateWeekSelector pour s'assurer que la semaine est bien définie.
});
