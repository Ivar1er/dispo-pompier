// agent.js

// URL de base de l'API. Assurez-vous que cette URL est correcte pour votre environnement.
const API_BASE_URL = "https://dispo-pompier.onrender.com";

// Références DOM pour les éléments de la page agent.html
// Utilisation de constantes pour les éléments DOM principaux pour éviter les modifications accidentelles
const agentNameDisplay = document.getElementById('agent-name-display');
const agentQualificationsDisplay = document.getElementById('agentQualificationsDisplay'); // NOUVEAU
const currentWeekDisplay = document.getElementById('current-week-display');
const prevWeekBtn = document.getElementById('prev-week-btn');
const nextWeekBtn = document.getElementById('next-week-btn');
const planningGrid = document.getElementById('planning-container'); // La grille d'affichage du planning
const saveSlotsBtn = document.getElementById('save-slots-btn');
const clearSelectionBtn = document.getElementById('clear-selection-btn');
const logoutBtn = document.getElementById('logout-btn');
const loadingSpinner = document.getElementById('loading-spinner'); // Référence au spinner de chargement

// Variables d'état de l'application
let currentAgentId;
let currentAgentName;
let currentAgentRole;
let currentAgentQualifications = []; // NOUVEAU : pour stocker les qualifications de l'agent
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
 * Formate une date en chaîne YYYY-MM-DD.
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
        renderPlanningGrid();

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
            // Si 404 (non trouvé) ou autre erreur, gérer. Peut-être qu'un agent n'a pas de qualifications.
            if (response.status === 404) {
                 console.info(`Aucune qualification trouvée pour l'agent ${currentAgentId}.`);
                 currentAgentQualifications = []; // Réinitialiser si non trouvé
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
        // Afficher un message d'erreur si le chargement des qualifications échoue.
        // displayMessageModal("Erreur", "Impossible de charger vos qualifications.", "error");
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


// --- Rendu du planning ---
function renderPlanningGrid() {
    if (!planningGrid) {
        console.error("Erreur DOM: L'élément 'planning-container' est introuvable. Assurez-vous que l'ID est correct dans agent.html.");
        displayMessageModal("Erreur d'affichage", "Impossible d'afficher le planning. L'élément de grille est manquant.", "error");
        return;
    }
    planningGrid.innerHTML = ''; // Vide la grille actuelle

    const mondayOfCurrentWeek = getDateOfWeek(currentWeekNumber, currentYear);
    const sundayOfCurrentWeek = new Date(mondayOfCurrentWeek.getTime() + 6 * 24 * 60 * 60 * 1000);

    if (currentWeekDisplay) {
        currentWeekDisplay.textContent = `Semaine ${currentWeekNumber} (${mondayOfCurrentWeek.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} - ${sundayOfCurrentWeek.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })})`;
    } else {
        console.warn("L'élément 'current-week-display' est introuvable dans agent.html.");
    }

    const weeklyPlanning = planningData[`week-${currentWeekNumber}`] || {};

    // Création des en-têtes de jour
    const headerRow = document.createElement('div');
    headerRow.classList.add('planning-row', 'header');
    headerRow.innerHTML = `<div class="time-slot-header">Heure</div>`;
    DAYS_OF_WEEK_FR.forEach(day => {
        headerRow.innerHTML += `<div class="day-header">${day.charAt(0).toUpperCase() + day.slice(1)}</div>`;
    });
    planningGrid.appendChild(headerRow);

    // Création des lignes de temps (créneaux de 30 min)
    for (let i = 0; i < 48; i++) { // 48 créneaux de 30 minutes dans une journée
        const h = Math.floor(i / 2);
        const m = (i % 2) * 30;
        const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

        // Pas de div 'row' physique car 'display: contents' est utilisé sur .planning-row
        // Chaque time-slot-label et planning-cell se positionne dans la grille directement.

        const timeLabelDiv = document.createElement('div');
        timeLabelDiv.classList.add('time-slot-label');
        timeLabelDiv.textContent = timeStr;
        planningGrid.appendChild(timeLabelDiv); // Ajoute le label d'heure à la grille

        DAYS_OF_WEEK_FR.forEach((dayName, dayIndex) => {
            const cell = document.createElement('div');
            cell.classList.add('planning-cell');
            cell.dataset.time = timeStr; // Heure de début du créneau (HH:MM)
            cell.dataset.day = dayName; // Nom du jour (lundi, mardi, etc.)
            cell.dataset.slotIndex = i; // Index du créneau pour un tri facile

            // Vérifier si ce créneau est "disponible" dans les données de planning
            const dayAvailabilities = weeklyPlanning[dayName] || [];
            let isAvailable = false;

            // Parcours les plages de disponibilité pour voir si le créneau actuel chevauche
            for (const rangeStr of dayAvailabilities) {
                const [start, end] = rangeStr.split(' - ');
                const cellStartMinutes = parseTimeToMinutes(timeStr);
                const cellEndMinutes = cellStartMinutes + 30;
                
                const rangeStartMinutes = parseTimeToMinutes(start);
                const rangeEndMinutes = parseTimeToMinutes(end);

                // Logique de chevauchement : un créneau est disponible s'il chevauche une plage.
                // Le créneau (cellStartMinutes, cellEndMinutes) chevauche (rangeStartMinutes, rangeEndMinutes)
                // si (cellStart < rangeEnd AND cellEnd > rangeStart)
                if (cellStartMinutes < rangeEndMinutes && cellEndMinutes > rangeStartMinutes) {
                    isAvailable = true;
                    break; // Pas besoin de vérifier d'autres plages si un chevauchement est trouvé
                }
            }

            if (isAvailable) {
                cell.classList.add('available');
            } else {
                cell.classList.add('unavailable');
                // Désactive les créneaux non disponibles pour empêcher la sélection
                cell.style.pointerEvents = 'none'; // Empêche les événements de souris
                cell.tabIndex = -1; // Retire de l'ordre de tabulation
            }

            // Seulement les créneaux 'available' sont interactifs
            if (isAvailable) {
                cell.addEventListener('mousedown', handleMouseDown);
                cell.addEventListener('mouseover', handleMouseOver);
                cell.addEventListener('mouseup', handleMouseUp);
            }
            
            planningGrid.appendChild(cell); // Ajoute la cellule du créneau à la grille
        });
    }
}


// --- Logique de sélection par glisser-déposer ---
let isSelecting = false;
let startCell = null;
let selectedCells = [];

function handleMouseDown(e) {
    // S'assure que seul le clic gauche est pris en compte et que la cellule n'est pas "unavailable"
    if (e.button !== 0 || e.target.classList.contains('unavailable')) return;
    
    isSelecting = true;
    startCell = e.target;
    selectedCells = [];
    
    // Nettoie toutes les sélections précédentes
    if (planningGrid) {
        planningGrid.querySelectorAll('.selecting').forEach(cell => cell.classList.remove('selecting'));
        planningGrid.querySelectorAll('.selected').forEach(cell => cell.classList.remove('selected'));
    }
    
    startCell.classList.add('selecting');
    selectedCells.push(startCell);
}

function handleMouseOver(e) {
    if (!isSelecting || !startCell) return;

    const currentCell = e.target.closest('.planning-cell');
    // Ne pas sélectionner les cellules non disponibles ou si ce n'est pas une cellule valide
    if (!currentCell || currentCell.classList.contains('unavailable')) return;

    // Vérifie que la sélection se fait dans la même colonne (même jour)
    if (currentCell.dataset.day !== startCell.dataset.day) return;

    // Réinitialise les classes 'selecting' pour une mise à jour visuelle fluide
    if (planningGrid) planningGrid.querySelectorAll('.selecting').forEach(cell => cell.classList.remove('selecting'));
    selectedCells = [];

    const startSlotIndex = parseInt(startCell.dataset.slotIndex);
    const currentSlotIndex = parseInt(currentCell.dataset.slotIndex);
    const selectedDay = startCell.dataset.day;

    const minSlot = Math.min(startSlotIndex, currentSlotIndex);
    const maxSlot = Math.max(startSlotIndex, currentSlotIndex);

    // Parcourt tous les créneaux de la journée sélectionnée
    planningGrid.querySelectorAll(`.planning-cell[data-day="${selectedDay}"]`).forEach(cell => {
        const slotIndex = parseInt(cell.dataset.slotIndex);
        if (slotIndex >= minSlot && slotIndex <= maxSlot) {
            // N'ajoute pas et ne marque pas comme 'selecting' les cellules 'unavailable'
            if (!cell.classList.contains('unavailable')) {
                cell.classList.add('selecting');
                selectedCells.push(cell);
            } else {
                // Si une cellule non disponible est rencontrée dans la plage, arrête la sélection
                // Cela empêche la sélection à travers des créneaux non disponibles.
                if ( (startSlotIndex < currentSlotIndex && slotIndex > startSlotIndex && slotIndex < currentSlotIndex) ||
                     (startSlotIndex > currentSlotIndex && slotIndex < startSlotIndex && slotIndex > currentSlotIndex) ) {
                    // Si une cellule "unavailable" est entre le début et la fin, reset la sélection.
                    // Ou simplement ne pas la considérer. Ici, nous laissons la sélection s'arrêter à la cellule précédente.
                    // Pour simplifier, nous permettons juste de ne pas la sélectionner.
                }
            }
        }
    });
}

async function handleMouseUp() {
    if (!isSelecting) return;
    isSelecting = false;

    if (selectedCells.length > 0) {
        // Appliquer la classe 'selected' et supprimer 'selecting'
        selectedCells.forEach(cell => {
            cell.classList.remove('selecting');
            cell.classList.add('selected');
        });
    }
    startCell = null; // Réinitialise la cellule de départ après la sélection
}


// --- Fonctions de gestion des boutons ---

/**
 * Sauvegarde les créneaux sélectionnés.
 */
async function saveSelectedSlots() {
    // Filtrer les créneaux sélectionnés qui ne sont pas "unavailable" (bien que le mouseover devrait déjà l'éviter)
    const trulySelectedCells = selectedCells.filter(cell => !cell.classList.contains('unavailable'));

    if (trulySelectedCells.length === 0) {
        displayMessageModal("Aucune sélection", "Veuillez sélectionner des créneaux avant d'enregistrer.", "warning");
        return;
    }

    const selectedDay = trulySelectedCells[0].dataset.day;
    const availabilitiesForDay = [];

    // Trier les cellules sélectionnées par index de créneau pour garantir l'ordre chronologique
    trulySelectedCells.sort((a, b) => parseInt(a.dataset.slotIndex) - parseInt(b.dataset.slotIndex));

    // Fusionner les créneaux contigus en plages
    if (trulySelectedCells.length > 0) {
        let currentStartMinutes = parseTimeToMinutes(trulySelectedCells[0].dataset.time);
        let currentEndMinutes = currentStartMinutes + 30; // Chaque créneau dure 30 minutes

        for (let i = 1; i < trulySelectedCells.length; i++) {
            const nextCellTimeMinutes = parseTimeToMinutes(trulySelectedCells[i].dataset.time);
            // Si le créneau suivant est le créneau immédiatement consécutif
            if (nextCellTimeMinutes === currentEndMinutes) {
                currentEndMinutes += 30;
            } else {
                // Sinon, la plage actuelle est terminée, l'ajouter et commencer une nouvelle
                availabilitiesForDay.push({
                    start: minutesToTime(currentStartMinutes),
                    end: minutesToTime(currentEndMinutes)
                });
                currentStartMinutes = nextCellTimeMinutes;
                currentEndMinutes = currentStartMinutes + 30;
            }
        }
        // Ajouter la dernière plage
        availabilitiesForDay.push({
            start: minutesToTime(currentStartMinutes),
            end: minutesToTime(currentEndMinutes)
        });
    }

    // Récupérer la date complète pour le jour sélectionné dans la semaine actuelle
    const weekStartDate = getDateOfWeek(currentWeekNumber, currentYear);
    const dayIndex = DAYS_OF_WEEK_FR.indexOf(selectedDay.toLowerCase());
    const targetDate = new Date(weekStartDate);
    targetDate.setDate(weekStartDate.getDate() + dayIndex);

    const dateKey = formatDateToYYYYMMDD(targetDate);

    // Sauvegarder les disponibilités pour cette date et cet agent
    await saveAvailabilitiesForDate(dateKey, availabilitiesForDay);

    // Après sauvegarde, recharger pour s'assurer que la grille est à jour
    clearSelectedSlots(); // Nettoyer la sélection après sauvegarde
}

/**
 * Efface la sélection courante de créneaux.
 */
function clearSelectedSlots() {
    if (!planningGrid) {
        console.error("Erreur DOM: L'élément 'planning-container' est introuvable pour effacer la sélection.");
        return;
    }
    planningGrid.querySelectorAll('.selected').forEach(cell => cell.classList.remove('selected'));
    planningGrid.querySelectorAll('.selecting').forEach(cell => cell.classList.remove('selecting')); // S'assurer que les 'selecting' sont aussi nettoyés
    selectedCells = [];
    startCell = null;
}

/**
 * Déconnecte l'agent et redirige vers la page de connexion.
 */
function logout() {
    sessionStorage.clear(); // Supprime toutes les données de session
    window.location.href = "index.html"; // Redirige vers la page de connexion
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
            window.location.href = "index.html"; // Redirige vers la page de connexion
        });
        return; // Arrête l'exécution si non authentifié
    }

    // Vérification du rôle pour cette page spécifique
    if (currentAgentRole !== 'agent') {
        console.error("Initialisation Agent: Rôle incorrect pour cette page. Rôle actuel:", currentAgentRole);
        displayMessageModal("Accès non autorisé", "Vous devez être connecté en tant qu'agent pour accéder à cette page.", "error", () => {
            if (currentAgentRole === 'admin') {
                window.location.href = "admin.html"; // Si c'est un admin, rediriger vers sa page
            } else {
                window.location.href = "index.html"; // Autres rôles non autorisés ou incohérents
            }
        });
        return; // Arrête l'exécution si le rôle n'est pas 'agent'
    }

    // Si tout est bon (authentifié et rôle 'agent')
    if (agentNameDisplay) {
        agentNameDisplay.textContent = `${currentAgentName} (ID: ${currentAgentId})`; // Ajoute l'ID pour clarification
    } else {
        console.warn("L'élément 'agent-name-display' est introuvable dans agent.html. Le nom de l'agent ne sera pas affiché.");
    }

    // Charge et affiche les qualifications de l'agent
    await loadAgentQualifications();

    // Initialiser la semaine actuelle
    const today = new Date();
    currentYear = today.getFullYear();
    currentWeekNumber = getISOWeekNumber(today);

    // Chargement initial du planning
    await loadAgentPlanning();

    // Configuration des événements pour la navigation entre les semaines
    if (prevWeekBtn) {
        prevWeekBtn.addEventListener('click', async () => {
            currentWeekNumber--;
            if (currentWeekNumber < 1) { // Gérer le passage à l'année précédente
                currentYear--;
                currentWeekNumber = getISOWeekNumber(new Date(currentYear, 11, 31)); // Dernière semaine de l'année précédente
            }
            await loadAgentPlanning(); // Recharge le planning pour la nouvelle semaine
        });
    } else {
        console.warn("L'élément 'prev-week-btn' est introuvable dans agent.html. Le bouton précédent ne sera pas fonctionnel.");
    }

    if (nextWeekBtn) {
        nextWeekBtn.addEventListener('click', async () => {
            currentWeekNumber++;
            const lastDayOfCurrentYear = new Date(currentYear, 11, 31);
            const lastWeekOfCurrentYear = getISOWeekNumber(lastDayOfCurrentYear);
            if (currentWeekNumber > lastWeekOfCurrentYear) { // Gérer le passage à l'année suivante
                currentYear++;
                currentWeekNumber = 1;
            }
            await loadAgentPlanning(); // Recharge le planning pour la nouvelle semaine
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
    
    // Gestion des onglets de jour (si implémenté, actuellement le planning est global)
    // S'il y a une future intention de charger le planning par jour via onglets, la logique doit être ajoutée ici.
    document.querySelectorAll('.tabs-navigation .tab').forEach(tab => {
        tab.addEventListener('click', function() {
            // Logique pour changer l'onglet actif et potentiellement filtrer l'affichage du planning
            // Pour l'instant, le planning est affiché pour toute la semaine, donc ce n'est que visuel
            document.querySelectorAll('.tabs-navigation .tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            // Si la grille devait filtrer par jour, la logique irait ici:
            // filterPlanningByDay(this.dataset.day);
        });
    });
});
