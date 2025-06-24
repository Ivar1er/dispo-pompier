// synthese.js

// Jours de la semaine
const days = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
// Récupère l'ID de l'agent depuis le sessionStorage (doit être défini lors de la connexion)
const agentId = sessionStorage.getItem("agentId");
// URL de base de votre API
const API_BASE_URL = "https://dispo-pompier.onrender.com";

// Références aux éléments DOM de la page synthese.html
const weekSelect = document.getElementById("week-select");
const planningContainer = document.getElementById("planning-container");
const headerHours = document.getElementById("header-hours");
const noPlanningMessage = document.getElementById("no-planning-message");
const loadingSpinner = document.getElementById("loading-spinner");

// --- Fonctions de modales (copiées de agent.js pour une cohérence des messages utilisateur) ---

/**
 * Affiche une modale de message personnalisée.
 * @param {string} title - Titre de la modale.
 * @param {string} message - Message à afficher.
 * @param {'info'|'success'|'error'|'warning'|'question'} type - Type de message pour le style.
 * @param {function(boolean)} [callback] - Fonction de rappel pour les confirmations (true si OK, false si Annuler/clic extérieur).
 */
function displayMessageModal(title, message, type = "info", callback = null) {
    let modal = document.getElementById('message-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'message-modal';
        modal.classList.add('custom-modal', 'message-modal');
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="modal-content ${type}">
            <h2 class="modal-title">${title}</h2>
            <p class="modal-message">${message}</p>
            <div class="modal-actions">
                ${callback ? '<button id="modal-cancel-btn" class="btn btn-secondary">Annuler</button>' : ''}
                <button id="modal-ok-btn" class="btn btn-primary">OK</button>
            </div>
        </div>
    `;

    modal.style.display = 'flex'; // Affiche la modale

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

    // Gère le clic en dehors de la modale pour la fermer
    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
            if (callback) callback(false); // Si c'était une confirmation, considérer comme annulation
        }
    };
}

/**
 * Fonction asynchrone pour simuler confirm() avec la modale personnalisée.
 * @param {string} message - Message de confirmation.
 * @returns {Promise<boolean>} Une promesse qui se résout avec true si l'utilisateur confirme, false sinon.
 */
async function confirmModal(message) {
    return new Promise((resolve) => {
        displayMessageModal("Confirmation", message, "question", (result) => {
            resolve(result);
        });
    });
}
// Remplace les fonctions globales alert et confirm par nos modales personnalisées
window.alert = displayMessageModal.bind(null, "Information");
window.confirm = confirmModal;


// --- Fonctions utilitaires pour les semaines et les heures ---

/**
 * Calcule le numéro de semaine ISO 8601 pour une date donnée.
 * @param {Date} date - La date à utiliser.
 * @returns {number} Le numéro de la semaine ISO.
 */
function getWeekNumber(date = new Date()) {
  const _date = new Date(date.getTime());
  _date.setHours(0, 0, 0, 0);
  _date.setDate(_date.getDate() + 3 - ((_date.getDay() + 6) % 7)); // Ajuste au jeudi de la semaine
  const week1 = new Date(_date.getFullYear(), 0, 4); // Le 4 janvier est toujours dans la première semaine ISO de l'année
  return (
    1 +
    Math.round(
      ((_date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7
    )
  );
}

/**
 * Obtient la plage de dates (début et fin) pour un numéro de semaine donné dans l'année courante.
 * Cette fonction a été revue pour s'assurer qu'elle génère des dates valides.
 * @param {number} weekNumber - Le numéro de la semaine.
 * @param {number} [year=new Date().getFullYear()] - L'année.
 * @returns {string} La plage de dates formatée (ex: "du 01/01 au 07/01").
 */
function getWeekDateRange(weekNumber, year = new Date().getFullYear()) {
    // Crée une date pour le 4 janvier de l'année, qui est toujours dans la première semaine ISO
    const jan4 = new Date(year, 0, 4);
    // Trouve le jour de la semaine du 4 janvier (0=Dimanche, 1=Lundi...)
    // Et ajuste pour trouver le lundi de la première semaine ISO
    const firstMonday = new Date(jan4.setDate(jan4.getDate() - (jan4.getDay() === 0 ? 6 : jan4.getDay() - 1)));

    // Calcule le début de la semaine spécifiée
    const startOfWeek = new Date(firstMonday);
    startOfWeek.setDate(firstMonday.getDate() + (weekNumber - 1) * 7);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // La fin de la semaine est 6 jours après le début

    const format = date => date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
    return `du ${format(startOfWeek)} au ${format(endOfWeek)}`;
}


/**
 * Convertit une chaîne de temps "HH:MM" en nombre de minutes depuis minuit.
 * @param {string} timeStr - La chaîne de temps (ex: "08:30").
 * @returns {number} Le nombre total de minutes.
 */
function timeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}

/**
 * Convertit un nombre de minutes depuis minuit en chaîne de temps "HH:MM".
 * @param {number} totalMinutes - Le nombre total de minutes.
 * @returns {string} La chaîne de temps formatée (ex: "08:30").
 */
function minutesToTime(totalMinutes) {
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

// --- Logique principale au chargement du DOM ---
document.addEventListener("DOMContentLoaded", async () => {
  // Vérifie si un agent est connecté, sinon redirige vers la page de connexion
  // Si 'agentId' est 'admin', l'accès est aussi refusé car cette page est pour les agents.
  if (!agentId || sessionStorage.getItem('userRole') === "admin") {
    displayMessageModal("Accès non autorisé", "Vous devez être connecté en tant qu’agent.", "error", () => {
        window.location.href = "index.html"; // Assurez-vous que c'est la bonne page de connexion
    });
    return;
  }

  showLoading(true); // Affiche le spinner de chargement

  try {
    // Récupère le token JWT du sessionStorage
    const token = sessionStorage.getItem('token');
    if (!token) {
      throw new Error('Aucun token d\'authentification trouvé.');
    }

    // Récupère le planning complet de l'agent depuis l'API
    const response = await fetch(`${API_BASE_URL}/api/planning/${agentId}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` // Utiliser le token JWT pour l'authentification
        }
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Erreur HTTP: ${response.status} ${response.statusText}`);
    }

    const planningDataAgent = await response.json();

    // Si aucun planning n'est disponible pour l'agent, affiche un message
    if (!Object.keys(planningDataAgent).length) {
      noPlanningMessage.classList.remove("hidden");
      planningContainer.innerHTML = ""; // Vide le tableau de planning
      headerHours.innerHTML = ""; // Vide l'en-tête des heures
      weekSelect.innerHTML = "<option value=''>Aucune semaine disponible</option>";
      weekSelect.disabled = true; // Désactive le sélecteur
      return;
    } else {
      noPlanningMessage.classList.add("hidden"); // Cache le message si des données existent
      weekSelect.disabled = false; // Active le sélecteur
    }

    // Extrait toutes les clés de semaine ("S X") des données de planning
    const weekKeys = Object.keys(planningDataAgent).filter(key => key.startsWith("S "));
    // Convertit les clés en numéros de semaine
    const weekNums = weekKeys.map(key => Number(key.split(" ")[1])).filter(num => !isNaN(num));

    // Remplit le sélecteur de semaine
    weekSelect.innerHTML = ""; // Vide les options existantes
    // Trie les semaines numériquement et crée une option pour chacune
    weekNums.sort((a, b) => a - b).forEach(week => {
      const option = document.createElement("option");
      option.value = `S ${week}`; // La valeur doit correspondre à la clé du planning
      option.textContent = `Semaine ${week} ${getWeekDateRange(week)}`;
      weekSelect.appendChild(option);
    });

    // Détermine la semaine à afficher au démarrage
    let selectedWeekKey = sessionStorage.getItem("selectedWeek");
    // Vérifie si la clé stockée est valide ou si la semaine actuelle est dans les données
    const currentISOWeekKey = `S ${getWeekNumber(new Date())}`;

    if (!selectedWeekKey || !weekKeys.includes(selectedWeekKey)) {
        if (weekKeys.includes(currentISOWeekKey)) {
            selectedWeekKey = currentISOWeekKey;
        } else if (weekKeys.length > 0) {
            selectedWeekKey = weekKeys[0]; // Prend la première semaine disponible si la semaine actuelle n'a pas de données
        } else {
            // Aucun planning disponible, devrait être géré par la condition initiale
            return;
        }
    }
    weekSelect.value = selectedWeekKey; // Sélectionne l'option dans le sélecteur

    // Affiche le planning pour la semaine sélectionnée
    updateDisplay(selectedWeekKey, planningDataAgent);

    // Ajoute un écouteur d'événements pour le changement de semaine dans le sélecteur
    weekSelect.addEventListener("change", () => {
      sessionStorage.setItem("selectedWeek", weekSelect.value); // Met à jour la semaine en session
      updateDisplay(weekSelect.value, planningDataAgent); // Met à jour l'affichage
    });

  } catch (err) {
    console.error("Erreur lors du chargement :", err);
    displayMessageModal("Erreur de Chargement", `Erreur lors du chargement du planning : ${err.message}. Veuillez réessayer ou vérifier vos accès.`, "error");
    noPlanningMessage.classList.remove("hidden");
  } finally {
    showLoading(false); // Cache le spinner de chargement
  }
});

/**
 * Fonction de mise à jour de l'affichage du planning.
 * @param {string} weekKey - La clé de la semaine à afficher (ex: "S 25").
 * @param {object} planningData - L'objet complet des données de planning de l'agent.
 */
function updateDisplay(weekKey, planningData) {
  showWeek(weekKey, planningData);
}

/**
 * Rend la grille du planning hebdomadaire avec des barres de disponibilité continues.
 * Met le label du jour et la barre de disponibilité sur la même ligne.
 * @param {string} weekKey - La clé de la semaine à afficher (ex: "S 25").
 * @param {object} planningData - L'objet complet des données de planning de l'agent.
 */
function showWeek(weekKey, planningData) {
  const container = planningContainer; // This is #planning-container (class: planning-grid-content)
  const header = headerHours; // This is #header-hours

  // Clear previous content
  container.innerHTML = "";
  header.innerHTML = ""; // Clear header too

  const SLOT_COUNT = 48; // Total 30-min slots over 24h
  const START_HOUR_GRID = 7; // Visual grid starts at 7 AM
  const MINUTES_PER_SLOT = 30; // Each slot is 30 minutes

  // 1. Render Header Hours
  const headerDayLabelPlaceholder = document.createElement("div");
  headerDayLabelPlaceholder.className = "day-label-header-placeholder"; // New class for placeholder
  header.appendChild(headerDayLabelPlaceholder);

  for (let i = START_HOUR_GRID; i < START_HOUR_GRID + 24; i += 2) { // Display hours every 2 hours
      const hour = i % 24;
      const div = document.createElement("div");
      div.className = "hour-cell";
      div.textContent = `${String(hour).padStart(2, '0')}:00`;
      header.appendChild(div);
  }

  // 2. Render Daily Rows
  days.forEach(day => {
      const rowContainer = document.createElement("div");
      rowContainer.className = "day-row-container"; // Each day gets its own flex container

      // Day Label
      const dayLabel = document.createElement("div");
      dayLabel.className = "day-label"; // Style defined in CSS
      dayLabel.textContent = day.charAt(0).toUpperCase() + day.slice(1);
      rowContainer.appendChild(dayLabel);

      // Availability Slots Wrapper (this will be a grid itself)
      const availabilityWrapper = document.createElement("div");
      availabilityWrapper.className = "availability-slots-wrapper"; // New class
      rowContainer.appendChild(availabilityWrapper);

      // Add 48 background slots to the wrapper
      for (let i = 0; i < SLOT_COUNT; i++) {
          const slotDiv = document.createElement("div");
          slotDiv.className = "slot-background";
          availabilityWrapper.appendChild(slotDiv);
      }

      // Get availability ranges for the current day
      const dayRanges = planningData[weekKey]?.[day] || [];

      // Add availability bars to the wrapper
      dayRanges.forEach(range => {
          // Calculate actual start/end minutes for tooltip
          let startMinutesActual = (range.start * MINUTES_PER_SLOT) + (START_HOUR_GRID * 60);
          let endMinutesActual = ((range.end + 1) * MINUTES_PER_SLOT) + (START_HOUR_GRID * 60);

          // Handle overnight ranges
          if (endMinutesActual <= startMinutesActual) {
              endMinutesActual += 24 * 60;
          }

          // Calculate effective start/end minutes within the 24-hour display grid (from 7 AM)
          const gridStartMinutes = START_HOUR_GRID * 60;
          let effectiveStartMinutes = Math.max(startMinutesActual, gridStartMinutes);
          let effectiveEndMinutes = Math.min(endMinutesActual, gridStartMinutes + (24 * 60));

          // Calculate position and span in the `availability-slots-wrapper`'s grid
          // Columns are 1-indexed in CSS grid, and we have 48 slots.
          const startColumnInWrapper = ((effectiveStartMinutes - gridStartMinutes) / MINUTES_PER_SLOT) + 1;
          const spanColumns = (effectiveEndMinutes - effectiveStartMinutes) / MINUTES_PER_SLOT;

          if (spanColumns > 0) {
              const bar = document.createElement("div");
              bar.className = "availability-bar";
              bar.style.gridColumn = `${startColumnInWrapper} / span ${spanColumns}`;
              bar.title = `Disponible: ${minutesToTime(startMinutesActual)} - ${minutesToTime(endMinutesActual)}`;
              availabilityWrapper.appendChild(bar); // Append bar to the new wrapper
          }
      });
      container.appendChild(rowContainer); // Append the whole day row to the main planning container
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
    if (weekSelect) weekSelect.disabled = false; // Active le sélecteur après le chargement
  }
}
