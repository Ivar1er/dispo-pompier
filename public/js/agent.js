const days = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const API_BASE_URL = "https://dispo-pompier.onrender.com";

let currentWeekKey; // Format: "week-XX"
let currentAgentId = sessionStorage.getItem("agent");
// let agentQualifications = []; // Remplacé - suppression des qualifications
let currentDay = 'lundi'; // Default day for display
let agentPlanningData = {}; // Stores the planning data (weekKey -> day -> slots)
let initialPlanningState = {}; // Used to check for unsaved changes

// --- Helpers ---

/**
 * Formats a Date object into a YYYY-MM-DD string.
 * @param {Date} d - The Date object to format.
 * @returns {string} The formatted date (e.g., "2023-01-15").
 */
function formatDateToYYYYMMDD(d) {
    const dt = new Date(d);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}` +
        `-${String(dt.getDate()).padStart(2, '0')}`;
}

/**
 * Calculates the ISO 8601 week number for a given date.
 * Week 1 is the one containing the first Thursday of the year.
 * @param {Date} date - The date to calculate the week number for.
 * @returns {number} The ISO 8601 week number.
 */
function getCurrentISOWeek(date = new Date()) {
    const _date = new Date(date.getTime());
    _date.setHours(0, 0, 0, 0);
    // Thursday of the week
    _date.setDate(_date.getDate() + 3 - ((_date.getDay() + 6) % 7));
    // January 1st
    const week1 = new Date(_date.getFullYear(), 0, 4);
    // Adjust to the first Thursday of the year
    return (
        1 +
        Math.round(
            ((_date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7
        )
    );
}

/**
 * Retrieves the Date object for a specific day of a given ISO week.
 * @param {string} weekKey - The week key (e.g., "week-24").
 * @param {string} dayName - The French name of the day (e.g., "lundi").
 * @param {number} year - The year (defaults to current year).
 * @returns {Date|null} The corresponding Date object, or null if the day name is invalid.
 */
function getDateForDayInWeek(weekKey, dayName, year = new Date().getFullYear()) {
    const weekNum = parseInt(weekKey.split('-')[1]);
    
    // Get the Monday of the specific ISO week
    const simple = new Date(year, 0, 1 + (weekNum - 1) * 7);
    const dow = simple.getDay() || 7; // Sunday is 0, Monday is 1, ..., Saturday is 6. For ISO, Sunday is 7.
    const mondayOfISOWeek = new Date(simple);
    mondayOfISOWeek.setDate(simple.getDate() - (dow === 0 ? 6 : dow - 1));
    mondayOfISOWeek.setHours(0, 0, 0, 0); // Ensure time is midnight

    // Map dayName to day index (Lundi=0, Dimanche=6)
    const dayIndex = days.indexOf(dayName);
    if (dayIndex === -1) {
        console.error(`Invalid day name: ${dayName}`);
        return null;
    }

    const targetDate = new Date(mondayOfISOWeek);
    targetDate.setDate(mondayOfISOWeek.getDate() + dayIndex);
    return targetDate;
}


// 30-min slots over 24h (display)
const horaires = [];
const startHourDisplay = 7; // Display starts from 7 AM
for (let i = 0; i < 48; i++) { // 48 slots for 24 hours (2 per hour)
  const currentSlotHour = (startHourDisplay + Math.floor(i / 2)) % 24;
  const currentSlotMinute = (i % 2) * 30;
  const endSlotHour = (startHourDisplay + Math.floor((i + 1) / 2)) % 24;
  const endSlotMinute = ((i + 1) % 2) * 30;
  const start = `${String(currentSlotHour).padStart(2, '0')}:${String(currentSlotMinute).padStart(2, '0')}`;
  const end = `${String(endSlotHour).padStart(2, '0')}:${String(endSlotMinute).padStart(2, '0')}`;
  horaires.push(`${start} - ${end}`);
}

// DOM Elements
const agentPrenomSpan = document.getElementById("agent-prenom");
const agentNomSpan = document.getElementById("agent-nom");
// const agentQualificationsDisplay = document.getElementById('agentQualificationsDisplay'); // Remplacé - suppression des qualifications
const weekSelect = document.getElementById("week-select");
const syntheseBtn = document.getElementById("synthese-btn");
const tabButtons = document.querySelectorAll('.tab');
const planningContainer = document.getElementById("planning-container");
const loadingSpinner = document.getElementById("loading-spinner");
const saveButton = document.getElementById("save-button");
const clearSelectionBtn = document.getElementById("clear-selection-btn");
const logoutButton = document.getElementById("logout-button");
const selectionInfo = document.getElementById("selection-info"); // Added if this element is in your HTML


document.addEventListener("DOMContentLoaded", async () => {
  const userRole = sessionStorage.getItem("userRole");
  const agentPrenom = sessionStorage.getItem("agentPrenom");
  const agentNom = sessionStorage.getItem("agentNom");

  if (!userRole || userRole !== "agent" || !currentAgentId) {
    displayMessageModal("Accès non autorisé", "Vous devez être connecté en tant qu’agent.", "error", () => {
        sessionStorage.clear();
        window.location.href = "index.html";
    });
    return;
  }

  if (agentPrenomSpan && agentNomSpan) {
    agentPrenomSpan.textContent = agentPrenom || '';
    agentNomSpan.textContent = agentNom || '';
  }

  // await loadAgentQualifications(currentAgentId); // Remplacé - suppression des qualifications
  // displayAgentQualifications(); // Remplacé - suppression des qualifications

  generateWeekOptions();
  const today = new Date();
  const currentWeekNumber = getCurrentISOWeek(today);
  currentWeekKey = `week-${currentWeekNumber}`; // Set initial currentWeekKey

  // Set the selected week in sessionStorage for the synthesis page
  sessionStorage.setItem("selectedWeek", currentWeekKey); 

  if (weekSelect) {
    // Select the current week in the dropdown
    weekSelect.value = currentWeekKey;
  }

  // Load and render planning for the initial week and day
  await loadPlanningForAgent(currentAgentId, currentWeekKey, currentDay);

  if (weekSelect) {
    weekSelect.addEventListener("change", async () => {
      if (await hasUnsavedChanges()) { 
        const confirmed = await confirmModal("Vous avez des modifications non enregistrées pour le jour actuel. Voulez-vous les enregistrer maintenant ?");
        if (!confirmed) {
          weekSelect.value = currentWeekKey; // Revert selection if not confirmed
          return;
        }
        await savePlanning();
      }
      currentWeekKey = weekSelect.value;
      sessionStorage.setItem("selectedWeek", currentWeekKey); // Update sessionStorage for synthesis
      await loadPlanningForAgent(currentAgentId, currentWeekKey, currentDay);
    });
  }
  if (saveButton) saveButton.addEventListener("click", savePlanning);
  if (clearSelectionBtn) clearSelectionBtn.addEventListener("click", clearSelectedCells);
  if (logoutButton) logoutButton.addEventListener("click", logout);

  if (tabButtons.length > 0) {
    tabButtons.forEach(button => {
      button.addEventListener('click', async () => {
        const targetDay = button.dataset.day;
        if (await hasUnsavedChanges()) { 
          const confirmed = await confirmModal("Vous avez des modifications non enregistrées pour le jour actuel. Voulez-vous les enregistrer maintenant ?");
          if (!confirmed) {
            return;
          }
          await savePlanning();
        }
        currentDay = targetDay;
        tabButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        renderPlanningGrid(currentDay);
      });
    });
    // Activate the current day button on startup
    const initialActiveDayBtn = document.querySelector(`.tab[data-day="${currentDay}"]`);
    if (initialActiveDayBtn) {
        initialActiveDayBtn.classList.add('active');
    }
    renderPlanningGrid(currentDay); // Initial render of the planning grid
  }

  initCellSelection();
  showLoading(false);
});

// --- Qualification Management Functions (REMOVED) ---
// La gestion des qualifications de l'agent a été supprimée de ce fichier.
// Le code suivant est commenté ou supprimé pour alléger.

/*
async function loadAgentQualifications(agentId) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/admin/agents/${agentId}`, {
      headers: { 'X-User-Role': sessionStorage.getItem("userRole") } 
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Erreur lors du chargement des qualifications de l\'agent.');
    
    agentQualifications = data.qualifications || [];
    console.log(`Qualifications de ${agentId}:`, agentQualifications);
  } catch (error) {
    console.error('Erreur de chargement des qualifications de l\'agent:', error);
    if (agentQualificationsDisplay) {
      agentQualificationsDisplay.textContent = 'Impossible de charger vos qualifications.';
      agentQualificationsDisplay.style.color = 'red';
    }
    displayMessageModal("Erreur de Qualifications", `Impossible de charger vos qualifications : ${error.message}`, "error");
  }
}

function displayAgentQualifications() {
  if (agentQualificationsDisplay) {
    if (agentQualifications.length > 0) {
      agentQualificationsDisplay.innerHTML = 'Vos qualifications : ' + agentQualifications.map(q => `<span class="qualification-tag">${q}</span>`).join(', ');
    } else {
      agentQualificationsDisplay.textContent = 'Aucune qualification enregistrée.'; 
    }
  }
}
*/
// Fin de la section de gestion des qualifications (supprimée)


function getWeekDateRange(weekNumber, year = new Date().getFullYear()) {
  const simple = new Date(year, 0, 1 + (weekNumber - 1) * 7);
  const dow = simple.getDay() || 7;
  const ISOweekStart = new Date(simple);
  if (dow <= 4) {
    ISOweekStart.setDate(simple.getDate() - dow + 1);
  } else {
    ISOweekStart.setDate(simple.getDate() + 8 - dow);
  }
  const start = new Date(ISOweekStart);
  const end = new Date(ISOweekStart);
  end.setDate(start.getDate() + 6);
  const format = date => date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
  return `du ${format(start)} au ${format(end)}`;
}

function generateWeekOptions() {
  const select = document.getElementById("week-select");
  select.innerHTML = "";
  const today = new Date();
  const currentWeekNumber = getCurrentISOWeek(today);
  const currentYear = today.getFullYear();
  for (let i = 0; i < 6; i++) { // Generates current week and next 5
    const weekNum = currentWeekNumber + i;
    const option = document.createElement("option");
    option.value = `week-${weekNum}`;
    const dateRange = getWeekDateRange(weekNum, currentYear);
    option.textContent = `Semaine ${weekNum} (${dateRange})`;
    select.appendChild(option);
  }
}

function renderPlanningGrid(day) {
  if (!planningContainer) return;
  planningContainer.innerHTML = '';
  // agentPlanningData is now structured as { weekKey: { day: [slots] } }
  const currentWeekPlanning = agentPlanningData[currentWeekKey] || {};
  const dayPlanning = currentWeekPlanning[day] || [];
  
  horaires.forEach(timeSlot => {
    const button = document.createElement("button");
    button.classList.add("slot-button");
    button.dataset.day = day;
    button.dataset.time = timeSlot;
    button.textContent = timeSlot;
    if (dayPlanning.includes(timeSlot)) {
      button.classList.add('selected');
    }
    planningContainer.appendChild(button);
  });
}

let selectionStartIndex = null;
function initCellSelection() {
  if (!planningContainer) return;
  planningContainer.addEventListener('click', (e) => {
    if (!e.target.classList.contains('slot-button')) return;
    const buttons = Array.from(planningContainer.querySelectorAll('.slot-button'));
    const clickedIndex = buttons.indexOf(e.target);
    if (selectionStartIndex === null) {
      selectionStartIndex = clickedIndex;
      // On first click, toggle the clicked cell's state for immediate visual feedback
      e.target.classList.toggle('selected');
    } else {
      const start = Math.min(selectionStartIndex, clickedIndex);
      const end = Math.max(selectionStartIndex, clickedIndex);
      // Determine if cells in the selection will be selected or deselected
      // based on the state of the first clicked cell
      const shouldSelect = buttons[selectionStartIndex].classList.contains('selected'); 
      for (let i = start; i <= end; i++) {
        if (shouldSelect) {
          buttons[i].classList.add('selected');
        } else {
          buttons[i].classList.remove('selected');
        }
      }
      selectionStartIndex = null;
    }
  });
}

async function hasUnsavedChanges() {
  const currentSelectedSlots = Array.from(planningContainer.querySelectorAll('.slot-button.selected')).map(btn => btn.dataset.time);
  const savedSlotsForDay = initialPlanningState[currentWeekKey]?.[currentDay] || [];
  if (currentSelectedSlots.length !== savedSlotsForDay.length) return true;
  const currentSet = new Set(currentSelectedSlots);
  const savedSet = new Set(savedSlotsForDay);
  for (const slot of currentSet) if (!savedSet.has(slot)) return true;
  for (const slot of savedSet) if (!currentSet.has(slot)) return true;
  return false;
}

async function loadPlanningForAgent(agentId, weekKey, day) {
  showLoading(true);
  try {
    // This endpoint now returns the agent's full planning structured by week and day
    const response = await fetch(`${API_BASE_URL}/api/planning/${agentId}`);
    const data = await response.json(); // This data should now be { week-X: { day: [slots] } }
    if (!response.ok) throw new Error(data.message || 'Erreur lors du chargement du planning.');
    
    agentPlanningData = data; // Assign the fetched structured data
    initialPlanningState = JSON.parse(JSON.stringify(data)); // Deep copy for change detection
    renderPlanningGrid(day);
  } catch (error) {
    console.error('Erreur de chargement du planning:', error);
    displayMessageModal("Erreur de Chargement", `Erreur lors du chargement de votre planning : ${error.message}`, "error");
    agentPlanningData = {}; // Reset data on error
    initialPlanningState = {};
    renderPlanningGrid(day); // Render empty grid on error
  } finally {
    showLoading(false);
  }
}

async function savePlanning() {
  const selectedSlotsForCurrentDay = Array.from(planningContainer.querySelectorAll('.slot-button.selected')).map(btn => btn.dataset.time);
  
  // Convert "HH:MM - HH:MM" strings to {start: "HH:MM", end: "HH:MM"} objects for server
  const formattedAvailabilities = selectedSlotsForCurrentDay.map(slot => {
    const [start, end] = slot.split(' - ');
    return { start, end };
  });

  // Get the exact date for the current day of the current week
  const dateObj = getDateForDayInWeek(currentWeekKey, currentDay);
  if (!dateObj) {
      displayMessageModal("Erreur de Date", "Impossible de déterminer la date exacte pour l'enregistrement.", "error");
      showLoading(false, saveButton);
      return;
  }
  const dateKey = formatDateToYYYYMMDD(dateObj); // Use helper function for YYYY-MM-DD

  // Update local planning data for the current day immediately (optimistic update)
  if (!agentPlanningData[currentWeekKey]) agentPlanningData[currentWeekKey] = {};
  agentPlanningData[currentWeekKey][currentDay] = selectedSlotsForCurrentDay;


  showLoading(true, saveButton);
  try {
    const jsonBody = JSON.stringify(formattedAvailabilities);

    const response = await fetch(`${API_BASE_URL}/api/agent-availability/${dateKey}/${currentAgentId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: jsonBody, 
    });
    const data = await response.json();
    if (response.ok) {
      displayMessageModal("Succès", "Planning enregistré avec succès !", "success");
      initialPlanningState = JSON.parse(JSON.stringify(agentPlanningData)); // Update initial state after successful save
    } else {
      throw new Error(data.message || "Erreur lors de l'enregistrement.");
    }
  } catch (err) {
    console.error("Erreur lors de l'enregistrement du planning :", err);
    displayMessageModal("Erreur", `Erreur lors de l'enregistrement du planning : ${err.message}`, "error");
  } finally {
    showLoading(false, saveButton);
  }
}

function clearSelectedCells() {
  planningContainer.querySelectorAll('.slot-button.selected').forEach(button => {
    button.classList.remove('selected');
  });
  displayMessageModal("Sélection Effacée", "La sélection actuelle a été effacée. N'oubliez pas d'enregistrer vos modifications !", "info");
}

function logout() {
  sessionStorage.clear();
  window.location.href = "index.html";
}

function showLoading(isLoading, button = null) {
  if (isLoading) {
    if (loadingSpinner) loadingSpinner.classList.remove("hidden");
    if (saveButton) saveButton.disabled = true;
    if (clearSelectionBtn) clearSelectionBtn.disabled = true;
    if (logoutButton) logoutButton.disabled = true;
    if (syntheseBtn) syntheseBtn.classList.add('disabled');
    tabButtons.forEach(btn => btn.disabled = true);
    if (weekSelect) weekSelect.disabled = true;
    planningContainer.querySelectorAll('.slot-button').forEach(btn => btn.disabled = true);
  } else {
    if (loadingSpinner) loadingSpinner.classList.add("hidden");
    if (saveButton) saveButton.disabled = false;
    if (clearSelectionBtn) clearSelectionBtn.disabled = false;
    if (logoutButton) logoutButton.disabled = false;
    if (syntheseBtn) syntheseBtn.classList.remove('disabled');
    tabButtons.forEach(btn => btn.disabled = false);
    if (weekSelect) weekSelect.disabled = false;
    planningContainer.querySelectorAll('.slot-button').forEach(btn => btn.disabled = false);
  }
}

document.addEventListener('focusin', function(e) {
  if (e.target.matches('button, select, input, a')) {
    e.target.classList.add('focused-element');
  }
});
document.addEventListener('focusout', function(e) {
  if (e.target.matches('button, select, input, a')) {
    e.target.classList.remove('focused-element');
  }
});

// --- Message Modals (replaces alert() and confirm()) ---
/**
 * Displays a custom message modal.
 * @param {string} title - Modal title.
 * @param {string} message - Message to display.
 * @param {'info'|'success'|'error'|'warning'|'question'} type - Message type for styling.
 * @param {function(boolean)} [callback] - Callback function for confirmations.
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
            if (callback) callback(false); // Clicking outside cancels for confirmations
        }
    };
}

/**
 * Async function to simulate confirm() with the custom modal.
 * @param {string} message - Confirmation message.
 * @returns {Promise<boolean>} A promise that resolves with true if the user confirms, false otherwise.
 */
async function confirmModal(message) {
    return new Promise((resolve) => {
        displayMessageModal("Confirmation", message, "question", (result) => {
            resolve(result);
        });
    });
}

// Replace native alert and confirm functions with custom modals
window.alert = displayMessageModal.bind(null, "Information");
window.confirm = confirmModal;
