const days = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const agent = sessionStorage.getItem("agent");
const API_BASE_URL = "https://dispo-pompier.onrender.com";

const weekSelect = document.getElementById("week-select");
const planningContainer = document.getElementById("planning-container");
const headerHours = document.getElementById("header-hours");
const noPlanningMessage = document.getElementById("no-planning-message");
const loadingSpinner = document.getElementById("loading-spinner");

// --- Modales (copié de agent.js pour cohérence) ---
/**
 * Affiche une modale de message personnalisée.
 * @param {string} title - Titre de la modale.
 * @param {string} message - Message à afficher.
 * @param {'info'|'success'|'error'|'warning'|'question'} type - Type de message pour le style.
 * @param {function(boolean)} [callback] - Fonction de rappel pour les confirmations.
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
            if (callback) callback(false); // Cliquer en dehors annule pour les confirmations
        }
    };
}

/**
 * Fonction asynchrone pour simuler confirm() avec la modale personnalisée.
 * @param {string} message - Message de confirmation.
 * @returns {Promise<boolean>} Une promesse qui résout avec true si l'utilisateur confirme, false sinon.\
 */
async function confirmModal(message) {
    return new Promise((resolve) => {
        displayMessageModal("Confirmation", message, "question", (result) => {
            resolve(result);
        });
    });
}
window.alert = displayMessageModal.bind(null, "Information");
window.confirm = confirmModal;


// Reliable ISO function
function getCurrentISOWeek(date = new Date()) {
  const _date = new Date(date.getTime());
  _date.setHours(0, 0, 0, 0);
  _date.setDate(_date.getDate() + 3 - ((_date.getDay() + 6) % 7));
  const week1 = new Date(_date.getFullYear(), 0, 4);
  return (
    1 +
    Math.round(
      ((_date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7
    )
  );
}

function getWeekDateRange(weekNumber, year = new Date().getFullYear()) {
  const simple = new Date(year, 0, 1 + (weekNumber - 1) * 7);
  const dow = simple.getDay() || 7;
  const ISOweekStart = new Date(simple);
  if (dow <= 4) ISOweekStart.setDate(simple.getDate() - dow + 1);
  else ISOweekStart.setDate(simple.getDate() + 8 - dow);

  const start = new Date(ISOweekStart);
  const end = new Date(ISOweekStart);
  end.setDate(start.getDate() + 6);

  const format = date => date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
  return `du ${format(start)} au ${format(end)}`;
}

document.addEventListener("DOMContentLoaded", async () => {
  if (!agent || agent === "admin") {
    displayMessageModal("Accès non autorisé", "Vous devez être connecté en tant qu’agent.", "error", () => {
        window.location.href = "index.html";
    });
    return;
  }

  showLoading(true);
  try {
    // This endpoint now returns the agent's full planning structured by week and day
    const response = await fetch(`${API_BASE_URL}/api/planning/${agent}`);
    const planningDataAgent = await response.json(); // Expected: { week-X: { day: [slots] } }

    if (!Object.keys(planningDataAgent).length) {
      noPlanningMessage.classList.remove("hidden");
      planningContainer.innerHTML = "";
      headerHours.innerHTML = "";
      weekSelect.innerHTML = "<option value=''>Aucune semaine</option>";
      weekSelect.disabled = true;
      return;
    } else {
      noPlanningMessage.classList.add("hidden");
      weekSelect.disabled = false;
    }

    // Get all week keys from the loaded planning data
    const weekKeys = Object.keys(planningDataAgent).filter(key => key.startsWith("week-"));
    const weekNums = weekKeys.map(key => Number(key.split("-")[1])).filter(num => !isNaN(num));

    // Generate week selector options
    weekSelect.innerHTML = "";
    weekNums.sort((a, b) => a - b).forEach(week => { // Sort weeks numerically
      const option = document.createElement("option");
      option.value = `week-${week}`;
      option.textContent = `Semaine ${week} (${getWeekDateRange(week)})`;
      weekSelect.appendChild(option);
    });

    // Synchronize with agent.js (get selected week from sessionStorage)
    let selectedWeekKey = sessionStorage.getItem("selectedWeek");
    if (!selectedWeekKey || !weekKeys.includes(selectedWeekKey)) { // Check if stored week is valid
      selectedWeekKey = weekKeys.length > 0 ? weekKeys[0] : `week-${getCurrentISOWeek()}`; // Fallback to first available or current week
    }
    weekSelect.value = selectedWeekKey;
    updateDisplay(selectedWeekKey, planningDataAgent);

    weekSelect.addEventListener("change", () => {
      sessionStorage.setItem("selectedWeek", weekSelect.value); // Update session for the other page
      updateDisplay(weekSelect.value, planningDataAgent);
    });

  } catch (err) {
    console.error("Erreur lors du chargement :", err);
    displayMessageModal("Erreur de Chargement", "Erreur lors du chargement du planning. Veuillez réessayer.", "error");
    noPlanningMessage.classList.remove("hidden");
  } finally {
    showLoading(false);
  }
});

function updateDisplay(weekKey, planningData) {
  showWeek(weekKey, planningData);
}

function showWeek(weekKey, planningData) {
  const container = planningContainer;
  const header = headerHours;

  // 30min slots from 7 AM to 6:30 AM the next day (48 slots)
  const allSlots = [];
  const startHourDisplay = 7;
  for (let i = 0; i < 48; i++) {
    const h = (startHourDisplay + Math.floor(i / 2)) % 24;
    const m = i % 2 === 0 ? "00" : "30";
    const nextH = (startHourDisplay + Math.floor((i + 1) / 2)) % 24;
    const nextM = ((i + 1) % 2) * 30 === 0 ? "00" : "30"; // Correctly format next minute
    allSlots.push(`${String(h).padStart(2, '0')}:${m} - ${String(nextH).padStart(2, '0')}:${nextM}`);
  }

  // Header hours
  header.innerHTML = `<div class="day-label sticky-day-col"></div>`;
  for (let i = 0; i < 24; i++) {
    const hour = (7 + i) % 24;
    const div = document.createElement("div");
    div.className = "hour-cell";
    div.textContent = `${String(hour).padStart(2, '0')}:00`;
    div.style.gridColumn = `span 2`; // Span 2 columns for 30-min slots
    header.appendChild(div);
  }

  container.innerHTML = "";
  days.forEach(day => {
    const row = document.createElement("div");
    row.className = "day-row";
    const dayLabel = document.createElement("div");
    dayLabel.className = "day-label sticky-day-col";
    dayLabel.textContent = day.charAt(0).toUpperCase() + day.slice(1);
    row.appendChild(dayLabel);

    // Get selected slots for the current week and day
    const selectedSlots = planningData[weekKey]?.[day] || []; // This should now work with the new server structure
    allSlots.forEach(slot => {
      const div = document.createElement("div");
      div.className = "slot";
      div.setAttribute("data-time", slot);
      if (selectedSlots.includes(slot)) {
        div.classList.add("occupied");
      }
      row.appendChild(div);
    });
    container.appendChild(row);
  });
}

function showLoading(isLoading) {
  if (isLoading) {
    loadingSpinner.classList.remove("hidden");
    if (weekSelect) weekSelect.disabled = true;
  } else {
    loadingSpinner.classList.add("hidden");
    if (weekSelect) weekSelect.disabled = false;
  }
}
