// agent.js

const API_BASE_URL = "https://dispo-pompier.onrender.com"; // Assurez-vous que cette URL est correcte

// Références DOM pour les éléments de la page agent.html
// Ajout de vérifications pour s'assurer que les éléments existent
const agentNameDisplay = document.getElementById('agent-name-display');
const currentWeekDisplay = document.getElementById('current-week-display');
const prevWeekBtn = document.getElementById('prev-week-btn');
const nextWeekBtn = document.getElementById('next-week-btn');
// CORRECTION ICI : Utilisez 'planning-container' pour l'ID
const planningGrid = document.getElementById('planning-container'); // La grille d'affichage du planning
// CORRECTION ICI : Utilisez 'save-slots-btn' pour l'ID
const saveSlotsBtn = document.getElementById('save-slots-btn');
const clearSelectionBtn = document.getElementById('clear-selection-btn');
// CORRECTION ICI : Utilisez 'logout-btn' pour l'ID
const logoutBtn = document.getElementById('logout-btn');


// Pour le système de modales personnalisées (s'assure qu'elles sont disponibles)
function displayMessageModal(title, message, type = "info", callback = null) {
    let modal = document.getElementById('custom-message-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'custom-message-modal';
        modal.className = 'modal-overlay';
        document.body.appendChild(modal);

        const modalCss = `
            .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.6); display: flex; justify-content: center; align-items: center; z-index: 1000; font-family: 'Inter', sans-serif; }
            .modal-content { background-color: #fff; padding: 25px 35px; border-radius: 12px; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2); width: 90%; max-width: 450px; animation: fadeIn 0.3s ease-out; display: flex; flex-direction: column; gap: 20px; }
            .modal-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eee; padding-bottom: 15px; margin-bottom: 15px; }
            .modal-header h2 { margin: 0; color: #333; font-size: 1.5em; }
            .modal-body { color: #555; font-size: 1em; line-height: 1.6; }
            .modal-footer { display: flex; justify-content: flex-end; gap: 10px; padding-top: 15px; border-top: 1px solid #eee; margin-top: 15px; }
            .btn { padding: 10px 20px; border: none; border-radius: 8px; cursor: pointer; font-size: 0.95em; font-weight: 500; transition: background-color 0.2s ease, transform 0.1s ease; }
            .btn-primary { background-color: #007bff; color: white; }
            .btn-primary:hover { background-color: #0056b3; transform: translateY(-1px); }
            .btn-secondary { background-color: #6c757d; color: white; }
            .btn-secondary:hover { background-color: #5a6268; transform: translateY(-1px); }
            .modal-icon { font-size: 2em; margin-right: 15px; align-self: flex-start; }
            .modal-icon.info { color: #007bff; }
            .modal-icon.success { color: #28a745; }
            .modal-icon.warning { color: #ffc107; }
            .modal-icon.error { color: #dc3545; }
            .modal-icon.question { color: #6c757d; }
            @keyframes fadeIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
        `;
        const styleSheet = document.createElement("style");
        styleSheet.type = "text/css";
        styleSheet.innerText = modalCss;
        document.head.appendChild(styleSheet);
    }

    let iconHtml = '';
    switch (type) {
        case 'info': iconHtml = '💡'; break;
        case 'success': iconHtml = '✅'; break;
        case 'warning': iconHtml = '⚠️'; break;
        case 'error': iconHtml = '❌'; break;
        case 'question': iconHtml = '❓'; break;
    }

    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <span class="modal-icon ${type}">${iconHtml}</span>
                <h2>${title}</h2>
            </div>
            <div class="modal-body">
                <p>${message}</p>
            </div>
            <div class="modal-footer">
                ${callback ? '<button id="modal-cancel-btn" class="btn btn-secondary">Annuler</button>' : ''}
                <button id="modal-ok-btn" class="btn btn-primary">OK</button>
            </div>
        </div>
    `;

    modal.style.display = 'flex';

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

    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
            if (callback) callback(false);
        }
    };
}
// Redéfinition globale de window.confirm et window.alert
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


// Données de l'application
let currentAgentId;
let currentAgentName;
let currentAgentRole;
let currentWeekNumber;
let currentYear;
let planningData = {}; // Stocke le planning complet de l'agent: { week-X: { day: [slots] } }

const DAYS_OF_WEEK_FR = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

// --- Helpers ---
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

function getDateOfWeek(w, y) {
    const date = new Date(y, 0, 1 + (w - 1) * 7);
    if (date.getDay() <= 4) {
        date.setDate(date.getDate() - date.getDay() + 1);
    } else {
        date.setDate(date.getDate() + 8 - date.getDay());
    }
    return date;
}

function formatDateToYYYYMMDD(d) {
    const dt = new Date(d);
    return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}` +
           `-${String(dt.getDate()).padStart(2,'0')}`;
}

// Fonction pour récupérer le token JWT
function getToken() {
    return sessionStorage.getItem('token');
}

// Fonction pour obtenir les en-têtes d'autorisation
function getAuthHeaders() {
    const token = getToken();
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

// --- Chargement des données de planning de l'agent ---
async function loadAgentPlanning() {
    const token = getToken();
    if (!token) {
        console.error("loadAgentPlanning: Token manquant. Redirection vers la page de connexion.");
        displayMessageModal("Session expirée", "Votre session a expiré. Veuillez vous reconnecter.", "error", () => {
            window.location.href = "index.html"; // Redirige vers la page de login
        });
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
            return;
        }
        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status} - ${response.statusText}`);
        }

        planningData = await response.json(); // Charge le planning complet de l'agent
        renderPlanningGrid();

    } catch (error) {
        console.error("Erreur lors du chargement du planning de l'agent:", error);
        displayMessageModal("Erreur de chargement", "Impossible de charger votre planning. Veuillez réessayer.", "error");
    }
}

// --- Sauvegarde des créneaux de disponibilité pour une date spécifique ---
async function saveAvailabilitiesForDate(dateKey, availabilities) {
    const token = getToken();
    if (!token) {
        console.error("saveAvailabilitiesForDate: Token manquant. Redirection vers la page de connexion.");
        displayMessageModal("Session expirée", "Votre session a expiré. Veuillez vous reconnecter.", "error", () => {
            window.location.href = "index.html";
        });
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
        // Recharger le planning après sauvegarde pour mise à jour de l'affichage
        await loadAgentPlanning();

    } catch (error) {
        console.error("Erreur lors de la sauvegarde des disponibilités:", error);
        displayMessageModal("Erreur de sauvegarde", error.message || "Impossible d'enregistrer vos disponibilités.", "error");
    }
}


// --- Rendu du planning ---
function renderPlanningGrid() {
    // Vérification de l'existence de planningGrid avant d'y accéder
    if (!planningGrid) {
        console.error("Erreur DOM: L'élément 'planning-container' est introuvable. Assurez-vous que l'ID est correct dans agent.html.");
        displayMessageModal("Erreur d'affichage", "Impossible d'afficher le planning. L'élément de grille est manquant.", "error");
        return;
    }
    planningGrid.innerHTML = ''; // Vide la grille actuelle

    const mondayOfCurrentWeek = getDateOfWeek(currentWeekNumber, currentYear);

    // Vérification de l'existence de currentWeekDisplay avant d'y accéder
    if (currentWeekDisplay) {
        currentWeekDisplay.textContent = `Semaine ${currentWeekNumber} (${mondayOfCurrentWeek.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} - ${new Date(mondayOfCurrentWeek.getTime() + 6 * 24 * 60 * 60 * 1000).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })})`;
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
    for (let i = 0; i < 48; i++) { // 48 créneaux de 30 minutes
        const h = Math.floor(i / 2);
        const m = (i % 2) * 30;
        const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

        const row = document.createElement('div');
        row.classList.add('planning-row');
        row.innerHTML = `<div class="time-slot-label">${timeStr}</div>`;

        DAYS_OF_WEEK_FR.forEach((dayName, dayIndex) => {
            const cell = document.createElement('div');
            cell.classList.add('planning-cell');
            cell.dataset.time = timeStr; // Heure de début du créneau (HH:MM)
            cell.dataset.day = dayName; // Nom du jour (lundi, mardi, etc.)

            // Vérifier si ce créneau est "disponible" dans les données de planning
            const dayAvailabilities = weeklyPlanning[dayName] || [];
            let isAvailable = false;
            // Parcourir les plages de disponibilité pour voir si le créneau actuel chevauche
            dayAvailabilities.forEach(rangeStr => {
                const [start, end] = rangeStr.split(' - ');
                // Simple vérification de chevauchement pour le rendu, peut être améliorée
                const cellStartMinutes = h * 60 + m;
                const cellEndMinutes = cellStartMinutes + 30;
                
                const rangeStartMinutes = parseInt(start.split(':')[0]) * 60 + parseInt(start.split(':')[1]);
                const rangeEndMinutes = parseInt(end.split(':')[0]) * 60 + parseInt(end.split(':')[1]);

                // Gérer le cas où la plage traverse minuit pour la comparaison
                let effectiveRangeEndMinutes = rangeEndMinutes;
                if (rangeEndMinutes <= rangeStartMinutes) { // Ex: 22:00 - 04:00
                    effectiveRangeEndMinutes += 24 * 60;
                }
                let effectiveCellEndMinutes = cellEndMinutes;
                if (cellEndMinutes <= cellStartMinutes && cellEndMinutes < rangeStartMinutes) { // Si le créneau cell traverse minuit (rare pour 30min)
                    effectiveCellEndMinutes += 24 * 60;
                }


                if (!(effectiveCellEndMinutes <= rangeStartMinutes || cellStartMinutes >= effectiveRangeEndMinutes)) {
                    isAvailable = true;
                }
            });

            if (isAvailable) {
                cell.classList.add('available');
            } else {
                cell.classList.add('unavailable');
            }

            cell.addEventListener('mousedown', handleMouseDown);
            cell.addEventListener('mouseover', handleMouseOver);
            cell.addEventListener('mouseup', handleMouseUp);

            row.appendChild(cell);
        });
        planningGrid.appendChild(row);
    }
}


// --- Logique de sélection par glisser-déposer ---
let isSelecting = false;
let startCell = null;
let selectedCells = [];

function handleMouseDown(e) {
    if (e.button !== 0) return; // Seulement le clic gauche
    isSelecting = true;
    startCell = e.target;
    selectedCells = [];
    if (planningGrid) planningGrid.querySelectorAll('.selecting').forEach(cell => cell.classList.remove('selecting'));
    if (planningGrid) planningGrid.querySelectorAll('.selected').forEach(cell => cell.classList.remove('selected'));
    startCell.classList.add('selecting');
    selectedCells.push(startCell);
}

function handleMouseOver(e) {
    if (!isSelecting || !startCell) return;

    const currentCell = e.target.closest('.planning-cell');
    if (!currentCell || currentCell === startCell) return;

    if (planningGrid) planningGrid.querySelectorAll('.selecting').forEach(cell => cell.classList.remove('selecting'));
    selectedCells = [];

    // Vérifier si parentNode existe avant d'accéder à children
    const startRowParent = startCell.parentNode;
    const currentCellParent = currentCell.parentNode;

    if (!startRowParent || !currentCellParent) {
        console.error("Erreur DOM: Parent des cellules non trouvé lors de la sélection.");
        return;
    }

    const startRowIndex = Array.from(startRowParent.parentNode.children).indexOf(startRowParent);
    const startColIndex = Array.from(startRowParent.children).indexOf(startCell);
    const currentRowIndex = Array.from(currentCellParent.parentNode.children).indexOf(currentCellParent);
    const currentColIndex = Array.from(currentCellParent.children).indexOf(currentCell);

    const minRow = Math.min(startRowIndex, currentRowIndex);
    const maxRow = Math.max(startRowIndex, currentRowIndex);
    // const minCol = Math.min(startColIndex, currentColIndex); // Non utilisé car on sélectionne sur une seule colonne
    // const maxCol = Math.max(startColIndex, currentColIndex); // Non utilisé

    // Assurez-vous de sélectionner uniquement dans la même colonne (même jour)
    if (startColIndex !== currentColIndex) return;

    for (let r = minRow; r <= maxRow; r++) {
        const row = planningGrid.children[r];
        if (row) { // Vérifier si la ligne existe (en-tête est children[0])
            const cell = row.children[startColIndex]; // Toujours la même colonne
            if (cell && cell.classList.contains('planning-cell')) {
                cell.classList.add('selecting');
                selectedCells.push(cell);
            }
        }
    }
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
}

// --- Fonctions de gestion des boutons ---
async function saveSelectedSlots() {
    if (selectedCells.length === 0) {
        displayMessageModal("Aucune sélection", "Veuillez sélectionner des créneaux avant d'enregistrer.", "warning");
        return;
    }

    // Récupérer le jour à partir de la première cellule sélectionnée
    const selectedDay = selectedCells[0].dataset.day;
    const availabilitiesForDay = [];

    // Trier les cellules sélectionnées par heure
    selectedCells.sort((a, b) => {
        const timeA = a.dataset.time;
        const timeB = b.dataset.time;
        return parseTimeToMinutes(timeA) - parseTimeToMinutes(timeB);
    });

    // Fusionner les créneaux contigus
    if (selectedCells.length > 0) {
        let currentStart = parseTimeToMinutes(selectedCells[0].dataset.time);
        let currentEnd = currentStart + 30; // Chaque créneau dure 30 minutes

        for (let i = 1; i < selectedCells.length; i++) {
            const nextCellTime = parseTimeToMinutes(selectedCells[i].dataset.time);
            // Si le créneau suivant est contigu au créneau actuel
            if (nextCellTime === currentEnd) {
                currentEnd += 30;
            } else {
                // Sinon, la plage actuelle est terminée, l'ajouter et commencer une nouvelle
                availabilitiesForDay.push({
                    start: minutesToTime(currentStart),
                    end: minutesToTime(currentEnd)
                });
                currentStart = nextCellTime;
                currentEnd = currentStart + 30;
            }
        }
        // Ajouter la dernière plage
        availabilitiesForDay.push({
            start: minutesToTime(currentStart),
            end: minutesToTime(currentEnd)
        });
    }

    // Récupérer la date complète pour le jour sélectionné dans la semaine actuelle
    const weekStartDate = getDateOfWeek(currentWeekNumber, currentYear);
    // Trouver le jour de la semaine correspondant à `selectedDay`
    const dayIndex = DAYS_OF_WEEK_FR.indexOf(selectedDay.toLowerCase());
    const targetDate = new Date(weekStartDate);
    targetDate.setDate(weekStartDate.getDate() + dayIndex);

    const dateKey = formatDateToYYYYMMDD(targetDate);

    // Sauvegarder les disponibilités pour cette date et cet agent
    await saveAvailabilitiesForDate(dateKey, availabilitiesForDay);

    // Après sauvegarde, recharger pour s'assurer que la grille est à jour
    await loadAgentPlanning();
    clearSelectedSlots(); // Nettoyer la sélection après sauvegarde
}

function clearSelectedSlots() {
    if (!planningGrid) {
        console.error("Erreur DOM: L'élément 'planning-container' est introuvable pour effacer la sélection.");
        return;
    }
    planningGrid.querySelectorAll('.selected').forEach(cell => cell.classList.remove('selected'));
    selectedCells = [];
    startCell = null;
}

function logout() {
    sessionStorage.clear(); // Supprime toutes les données de session
    window.location.href = "index.html"; // Redirige vers la page de connexion
}

// Convertit un nombre de minutes depuis minuit en format "HH:MM"
function minutesToTime(totalMinutes) {
    let hours = Math.floor(totalMinutes / 60);
    let minutes = totalMinutes % 60;
    // Gérer 24:00 comme 00:00 du lendemain pour les fins de plage visuelles
    if (hours === 24 && minutes === 0) {
        hours = 0; // Ou gérer comme "00:00 (end)" si nécessaire pour la logique du backend
    }
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}
function parseTimeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}


// --- Initialisation ---
document.addEventListener("DOMContentLoaded", async () => {
    // Récupérer les informations de session
    currentAgentId = sessionStorage.getItem('agent');
    currentAgentName = sessionStorage.getItem('agentPrenom') + ' ' + sessionStorage.getItem('agentNom');
    currentAgentRole = sessionStorage.getItem('userRole');

    // --- DEBOGAGE : Affiche les valeurs récupérées de sessionStorage ---
    console.log("DEBUG Agent: currentAgentId:", currentAgentId);
    console.log("DEBUG Agent: currentAgentName:", currentAgentName);
    console.log("DEBUG Agent: currentAgentRole:", currentAgentRole);
    console.log("DEBUG Agent: Token:", getToken() ? "Présent" : "Absent");

    // Vérification initiale de l'authentification et du rôle
    const token = getToken();
    if (!currentAgentId || !token) {
        console.error("Initialisation Agent: ID agent ou Token manquant. Redirection vers login.");
        displayMessageModal("Session expirée", "Votre session a expiré ou n'est pas valide. Veuillez vous reconnecter.", "error", () => {
            window.location.href = "index.html"; // Redirige vers la page de connexion
        });
        return; // Arrête l'exécution si non authentifié
    }

    // Si on arrive ici, l'agent est authentifié (token et ID sont là)
    // Maintenant, vérifions si le rôle est 'agent' pour cette page
    if (currentAgentRole !== 'agent') {
        console.error("Initialisation Agent: Rôle incorrect pour cette page. Rôle actuel:", currentAgentRole);
        displayMessageModal("Accès non autorisé", "Vous devez être connecté en tant qu'agent pour accéder à cette page.", "error", () => {
            // Si c'est un admin qui arrive ici par erreur, il devrait aller à admin.html
            if (currentAgentRole === 'admin') {
                window.location.href = "admin.html";
            } else {
                window.location.href = "index.html"; // Autres rôles non autorisés ou incohérents
            }
        });
        return; // Arrête l'exécution si le rôle n'est pas 'agent'
    }

    // Si tout est bon (authentifié et rôle 'agent')
    if (agentNameDisplay) {
        agentNameDisplay.textContent = `${currentAgentName} (${currentAgentId})`;
    } else {
        console.warn("L'élément 'agent-name-display' est introuvable dans agent.html. Le nom de l'agent ne sera pas affiché.");
    }

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
            const lastWeekOfCurrentYear = getISOWeekNumber(new Date(currentYear, 11, 31));
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
});
