const days = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const API_BASE_URL = "https://dispo-pompier.onrender.com";

let currentWeekKey;
let currentAgentId = sessionStorage.getItem("agent");
let agentQualifications = [];
let currentDay = 'lundi';
let agentPlanningData = {};
let initialPlanningState = {};

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

// Créneaux 30 min sur 24h
const horaires = [];
const startHourDisplay = 7;
for (let i = 0; i < 48; i++) {
  const currentSlotHour = (startHourDisplay + Math.floor(i / 2)) % 24;
  const currentSlotMinute = (i % 2) * 30;
  const endSlotHour = (startHourDisplay + Math.floor((i + 1) / 2)) % 24;
  const endSlotMinute = ((i + 1) % 2) * 30;
  const start = `${String(currentSlotHour).padStart(2, '0')}:${String(currentSlotMinute).padStart(2, '0')}`;
  const end = `${String(endSlotHour).padStart(2, '0')}:${String(endSlotMinute).padStart(2, '0')}`;
  horaires.push(`${start} - ${end}`);
}

// Eléments du DOM
const agentPrenomSpan = document.getElementById("agent-prenom");
const agentNomSpan = document.getElementById("agent-nom");
const agentQualificationsDisplay = document.getElementById('agentQualificationsDisplay');
const weekSelect = document.getElementById("week-select");
const syntheseBtn = document.getElementById("synthese-btn");
const tabButtons = document.querySelectorAll('.tab');
const planningContainer = document.getElementById("planning-container");
const loadingSpinner = document.getElementById("loading-spinner");
const saveButton = document.getElementById("save-button");
const clearSelectionBtn = document.getElementById("clear-selection-btn");
const logoutButton = document.getElementById("logout-button");
const selectionInfo = document.getElementById("selection-info");

document.addEventListener("DOMContentLoaded", async () => {
  const userRole = sessionStorage.getItem("userRole");
  const agentPrenom = sessionStorage.getItem("agentPrenom");
  const agentNom = sessionStorage.getItem("agentNom");

  if (!userRole || userRole !== "agent" || !currentAgentId) {
    alert("Accès non autorisé. Vous devez être connecté en tant qu’agent.");
    sessionStorage.clear();
    window.location.href = "index.html";
    return;
  }

  if (agentPrenomSpan && agentNomSpan) {
    agentPrenomSpan.textContent = agentPrenom || '';
    agentNomSpan.textContent = agentNom || '';
  }

  await loadAgentQualifications(currentAgentId);
  displayAgentQualifications();

  generateWeekOptions();
  const today = new Date();
  const currentWeekNumber = getCurrentISOWeek(today);
  currentWeekKey = `week-${currentWeekNumber}`;
  // SAUVEGARDE DANS LE SESSIONSTORAGE pour la synthèse
  sessionStorage.setItem("selectedWeek", currentWeekKey);

  if (weekSelect) {
    for (let option of weekSelect.options) {
      if (option.value === currentWeekKey) {
        weekSelect.value = currentWeekKey;
        break;
      }
    }
  }

  await loadPlanningForAgent(currentAgentId, currentWeekKey, currentDay);

  if (weekSelect) {
    weekSelect.addEventListener("change", async () => {
      if (hasUnsavedChanges()) {
        if (!confirm("Vous avez des modifications non enregistrées pour le jour actuel. Voulez-vous les enregistrer maintenant ?")) {
          weekSelect.value = currentWeekKey;
          return;
        }
        await savePlanning();
      }
      currentWeekKey = weekSelect.value;
      // SAUVEGARDE DANS LE SESSIONSTORAGE pour la synthèse
      sessionStorage.setItem("selectedWeek", currentWeekKey);
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
        if (hasUnsavedChanges()) {
          if (!confirm("Vous avez des modifications non enregistrées pour le jour actuel. Voulez-vous les enregistrer maintenant ?")) {
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
    renderPlanningGrid(currentDay);
  }

  initCellSelection();
  showLoading(false);
});

// --- Fonctions de gestion des qualifications ---
async function loadAgentQualifications(agentId) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/admin/agents/${agentId}`, {
      headers: { 'X-User-Role': 'admin' }
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
  }
}

function displayAgentQualifications() {
  if (agentQualificationsDisplay) {
    if (agentQualifications.length > 0) {
      agentQualificationsDisplay.innerHTML = 'Vos qualifications : ' + agentQualifications.map(q => `<span class="qualification-tag">${q}</span>`).join(', ');
    } else {
      agentQualificationsDisplay.textContent = '';
    }
  }
}

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
  for (let i = 0; i < 6; i++) {
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
      // Pas d'action au 1er clic (on attend le 2e)
    } else {
      const start = Math.min(selectionStartIndex, clickedIndex);
      const end = Math.max(selectionStartIndex, clickedIndex);
      const shouldSelect = !buttons[selectionStartIndex].classList.contains('selected');
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

function hasUnsavedChanges() {
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
    const response = await fetch(`${API_BASE_URL}/api/planning/${agentId}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Erreur lors du chargement du planning.');
    agentPlanningData = data;
    initialPlanningState = JSON.parse(JSON.stringify(data));
    renderPlanningGrid(day);
  } catch (error) {
    console.error('Erreur de chargement du planning:', error);
    alert(`Erreur lors du chargement du planning : ${error.message}`);
    agentPlanningData = {};
    initialPlanningState = {};
    renderPlanningGrid(day);
  } finally {
    showLoading(false);
  }
}

async function savePlanning() {
  const selectedSlotsForCurrentDay = Array.from(planningContainer.querySelectorAll('.slot-button.selected')).map(btn => btn.dataset.time);
  if (!agentPlanningData[currentWeekKey]) agentPlanningData[currentWeekKey] = {};
  agentPlanningData[currentWeekKey][currentDay] = selectedSlotsForCurrentDay;
  showLoading(true, saveButton);
  try {
    const response = await fetch(`${API_BASE_URL}/api/planning/${currentAgentId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(agentPlanningData),
    });
    const data = await response.json();
    if (response.ok) {
      alert("Planning enregistré avec succès !");
      initialPlanningState = JSON.parse(JSON.stringify(agentPlanningData));
    } else {
      throw new Error(data.message || "Erreur lors de l'enregistrement.");
    }
  } catch (err) {
    console.error("Erreur lors de l'enregistrement du planning :", err);
    alert(`Erreur lors de l'enregistrement du planning : ${err.message}`);
  } finally {
    showLoading(false, saveButton);
  }
}

function clearSelectedCells() {
  planningContainer.querySelectorAll('.slot-button.selected').forEach(button => {
    button.classList.remove('selected');
  });
  alert("La sélection actuelle a été effacée. N'oubliez pas d'enregistrer vos modifications !");
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
