// synthese.js

const days = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const agent = JSON.parse(sessionStorage.getItem("agent"));
const API_BASE_URL = "https://dispo-pompier.onrender.com";

const weekSelect = document.getElementById("week-select");
const planningContainer = document.getElementById("planning-container");
const headerHours = document.getElementById("header-hours");
const noPlanningMessage = document.getElementById("no-planning-message");
const loadingSpinner = document.getElementById("loading-spinner");

// Créneaux 30 min sur 24h, affichage de 7h à 7h le lendemain
const GRID_START_HOUR = 7; // Heure de début de la grille d'affichage
const GRID_END_HOUR = 7;   // Heure de fin (le lendemain)
const TOTAL_HOURS_DISPLAY = 24;
const SLOTS_PER_HOUR = 2;
const TOTAL_GRID_SLOTS = TOTAL_HOURS_DISPLAY * SLOTS_PER_HOUR; // 48 créneaux de 30 min

// --- Fonctions de modales (copiées de agent.js pour une cohérence des messages utilisateur) ---
function displayMessageModal(title, message, type = "info", callback = null) {
    let modal = document.getElementById('message-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'message-modal';
        modal.classList.add('modal');
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="modal-content ${type}">
        <span class="close-button">&times;</span>
        <h3 class="modal-title">${title}</h3>
        <p class="modal-message">${message}</p>
        ${type === 'question' ? '<div class="modal-actions"><button class="btn btn-primary" id="modal-confirm-btn">Oui</button><button class="btn btn-secondary" id="modal-cancel-btn">Annuler</button></div>' : ''}
      </div>
    `;
    modal.style.display = 'block';

    const closeButton = modal.querySelector('.close-button');
    if (closeButton) {
      closeButton.onclick = () => {
        modal.style.display = 'none';
        if (callback && type === 'question') callback(false);
      };
    }

    const confirmBtn = modal.querySelector('#modal-confirm-btn');
    if (confirmBtn) {
      confirmBtn.onclick = () => {
        modal.style.display = 'none';
        if (callback) callback(true);
      };
    }

    const cancelBtn = modal.querySelector('#modal-cancel-btn');
    if (cancelBtn) {
      cancelBtn.onclick = () => {
        modal.style.display = 'none';
        if (callback) callback(false);
      };
    }

    window.onclick = (event) => {
      if (event.target == modal && type !== 'question') {
        modal.style.display = 'none';
        if (callback && type === 'question') callback(false);
      }
    };
}


// --- Fonctions utilitaires de date (synchronisées avec serveur.js et agent.js) ---
function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1)/7);
    return weekNo;
}

function getDateForDayInWeek(weekNum, dayIndex, year = new Date().getFullYear()) {
    const simple = new Date(year, 0, 1 + (weekNum - 1) * 7);
    const dow = simple.getDay() || 7;
    const mondayOfISOWeek = new Date(simple);
    mondayOfISOWeek.setDate(simple.getDate() - (dow === 0 ? 6 : dow - 1));
    mondayOfISOWeek.setHours(0, 0, 0, 0);

    const targetDate = new Date(mondayOfISOWeek);
    targetDate.setDate(mondayOfISOWeek.getDate() + dayIndex);
    return targetDate;
}

function formatDate(d) {
    return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2, '0')}`;
}

// Fonction pour obtenir la date au format YYYY-MM-DD
function formatDateToYYYYMMDD(date) {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}


// --- Initialisation et chargement ---
document.addEventListener('DOMContentLoaded', async () => {
  // Vérifier si l'agent est connecté
  if (!agent || !agent.id) {
    window.location.href = 'login.html'; // Rediriger vers la page de connexion
    return;
  }

  populateWeekSelect();
  await loadAndRenderPlanning(); // Charger et afficher le planning pour la semaine par défaut

  weekSelect.addEventListener('change', loadAndRenderPlanning);
});

// Peuple le sélecteur de semaine
function populateWeekSelect() {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentWeekNumber = getWeekNumber(today);

    weekSelect.innerHTML = ''; // Vide les options existantes

    // Générer des options pour l'année précédente, actuelle et les 2 prochaines années
    const startYear = currentYear - 1;
    const endYear = currentYear + 2;

    for (let year = startYear; year <= endYear; year++) {
        // Une année peut avoir 52 ou 53 semaines ISO
        const lastDayOfYear = new Date(year, 11, 31);
        const maxWeekNumber = getWeekNumber(lastDayOfYear);

        for (let week = 1; week <= maxWeekNumber; week++) {
            const option = document.createElement('option');
            const mondayOfCurrentWeek = getDateForDayInWeek(week, 0, year); // 0 pour Lundi
            const sundayOfCurrentWeek = new Date(mondayOfCurrentWeek);
            sundayOfCurrentWeek.setDate(mondayOfCurrentWeek.getDate() + 6);

            // Vérifier si la semaine appartient bien à l'année ISO pour éviter les doublons/erreurs
            // C'est un point délicat avec les semaines ISO, mais cette vérification aide.
            // On s'assure que le lundi de la semaine est bien dans l'année courante ou que c'est la semaine 53/1 de transition
            if (mondayOfCurrentWeek.getFullYear() > year + 1 || mondayOfCurrentWeek.getFullYear() < year -1) {
                continue;
            }

            option.value = `${year}-W${week}`; // Format: "YYYY-WNN"
            option.textContent = `Semaine ${week} (${formatDate(mondayOfCurrentWeek)} - ${formatDate(sundayOfCurrentWeek)})`;
            weekSelect.appendChild(option);
        }
    }

    // Sélectionne la semaine actuelle par défaut
    weekSelect.value = `${currentYear}-W${currentWeekNumber}`;
}

/**
 * Charge le planning de l'agent depuis l'API et le rend.
 */
async function loadAndRenderPlanning() {
  showLoading(true);
  noPlanningMessage.classList.add("hidden"); // Cache le message "aucun planning"

  const selectedWeekValue = weekSelect.value;
  const [yearStr, weekStr] = selectedWeekValue.split('-W');
  const selectedWeekNumber = parseInt(weekStr, 10);

  try {
    const response = await fetch(`${API_BASE_URL}/api/planning/${agent.id}`, {
      headers: {
        'Authorization': `Bearer ${sessionStorage.getItem('jwtToken')}`
      }
    });

    if (!response.ok) {
      if (response.status === 403) {
          displayMessageModal('Accès refusé', 'Vous n\'avez pas l\'autorisation de voir ce planning.', 'error');
      } else {
          throw new Error(`Erreur HTTP: ${response.status}`);
      }
      planningContainer.innerHTML = '';
      noPlanningMessage.classList.remove("hidden");
      showLoading(false);
      return;
    }

    const allPlanningData = await response.json();
    const planningForSelectedWeek = allPlanningData[`week-${selectedWeekNumber}`];

    if (!planningForSelectedWeek || Object.values(planningForSelectedWeek).every(arr => arr.length === 0)) {
      planningContainer.innerHTML = '';
      noPlanningMessage.classList.remove("hidden");
      showLoading(false);
      return;
    }

    renderPlanningGrid(planningForSelectedWeek);

  } catch (error) {
    console.error('Erreur lors du chargement du planning :', error);
    displayMessageModal('Erreur de chargement', 'Impossible de charger votre planning. Veuillez réessayer.', 'error');
    planningContainer.innerHTML = '';
    noPlanningMessage.classList.remove("hidden");
  } finally {
    showLoading(false);
  }
}

/**
 * Rend la grille du planning hebdomadaire.
 * @param {object} planningData - Les données de planning pour la semaine sélectionnée.
 */
function renderPlanningGrid(planningData) {
  planningContainer.innerHTML = ''; // Vide le conteneur pour le nouveau rendu
  headerHours.innerHTML = ''; // Vide les heures d'en-tête

  // Crée l'en-tête des heures (de 7h à 7h le lendemain)
  headerHours.style.gridTemplateColumns = `minmax(80px, 0.5fr) repeat(${TOTAL_GRID_SLOTS}, minmax(30px, 1fr))`;
  const emptyCorner = document.createElement('div');
  emptyCorner.classList.add('header-cell', 'corner-cell');
  headerHours.appendChild(emptyCorner);

  for (let h = 0; h < TOTAL_HOURS_DISPLAY; h++) {
    const hour = (GRID_START_HOUR + h) % 24;
    const hourCell = document.createElement('div');
    hourCell.classList.add('header-cell', 'hour-label');
    hourCell.textContent = `${String(hour).padStart(2, '0')}h`;
    hourCell.style.gridColumn = `span ${SLOTS_PER_HOUR}`; // Span 2 demi-heures
    headerHours.appendChild(hourCell);
  }

  // Configure la grille principale du planning
  planningContainer.style.gridTemplateColumns = `minmax(80px, 0.5fr) repeat(${TOTAL_GRID_SLOTS}, minmax(30px, 1fr))`; // Identique à l'en-tête pour l'alignement

  // Rend chaque jour de la semaine
  days.forEach((dayName, index) => {
    const dayAvailability = planningData[dayName] || []; // Récupère les créneaux pour ce jour
    const row = document.createElement('div');
    row.classList.add('planning-grid-row');
    row.dataset.day = dayName;

    // Cellule du nom du jour
    const dayLabel = document.createElement('div');
    dayLabel.classList.add('day-label');
    dayLabel.textContent = dayName.charAt(0).toUpperCase() + dayName.slice(1);
    row.appendChild(dayLabel);

    // Initialise les créneaux par défaut comme non disponibles
    const slots = Array(TOTAL_GRID_SLOTS).fill(false); // false = non disponible

    // Marque les créneaux disponibles
    dayAvailability.forEach(rangeStr => {
      // Ex: "07:00 - 07:30"
      const [startStr, endStr] = rangeStr.split(' - ');
      const [startHour, startMinute] = startStr.split(':').map(Number);
      const [endHour, endMinute] = endStr.split(':').map(Number);

      let startMinutes = (startHour * 60 + startMinute);
      let endMinutes = (endHour * 60 + endMinute);

      // Gère les créneaux de nuit (ex: 19:00 - 07:00)
      if (endMinutes <= startMinutes) {
        endMinutes += 24 * 60; // Ajoute 24h si le créneau passe minuit
      }

      // Ajuste au début de la grille d'affichage (7h)
      const gridStartHourInMinutes = GRID_START_HOUR * 60;

      // Convertit en index de créneaux de 30 minutes par rapport au début de la grille
      let startIndex = Math.floor((startMinutes - gridStartHourInMinutes) / 30);
      let endIndex = Math.floor((endMinutes - gridStartHourInMinutes) / 30) - 1; // -1 car endIndex est inclusif

      // S'assurer que les indices sont dans les limites de la grille (0-47)
      startIndex = Math.max(0, startIndex);
      endIndex = Math.min(TOTAL_GRID_SLOTS - 1, endIndex);

      for (let i = startIndex; i <= endIndex; i++) {
        if (i >= 0 && i < TOTAL_GRID_SLOTS) {
          slots[i] = true; // Marque le créneau comme disponible
        }
      }
    });

    // Rend les cellules de créneaux (visuellement)
    slots.forEach((isAvailable, slotIndex) => {
      const slotCell = document.createElement('div');
      slotCell.classList.add('slot-cell');
      if (isAvailable) {
        slotCell.classList.add('available');
      } else {
        slotCell.classList.add('unavailable');
      }
      row.appendChild(slotCell);
    });

    planningContainer.appendChild(row);
  });
}


/**
 * Affiche ou masque le spinner de chargement.
 * @param {boolean} isLoading - True pour afficher, false pour masquer.
 */
function showLoading(isLoading) {
  if (isLoading) {
    loadingSpinner.classList.remove("hidden");
    if (weekSelect) weekSelect.disabled = true; // Désactive le sélecteur pendant le chargement
  } else {
    loadingSpinner.classList.add("hidden");
    if (weekSelect) weekSelect.disabled = false; // Réactive le sélecteur
  }
}
