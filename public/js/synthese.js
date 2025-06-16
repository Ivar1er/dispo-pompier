const days = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const agent = sessionStorage.getItem("agent");
const API_BASE_URL = "https://dispo-pompier.onrender.com";

const weekSelect = document.getElementById("week-select");
const planningContainer = document.getElementById("planning-container");
const headerHours = document.getElementById("header-hours");
const noPlanningMessage = document.getElementById("no-planning-message");
const loadingSpinner = document.getElementById("loading-spinner");

// Fonction ISO fiable
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
    alert("Vous devez être connecté en tant qu’agent.");
    window.location.href = "index.html";
    return;
  }

  showLoading(true);
  try {
    const response = await fetch(`${API_BASE_URL}/api/planning/${agent}`);
    const planningDataAgent = await response.json();

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

    // Détection des clés disponibles (compatibilité week-XX)
    const weekKeys = Object.keys(planningDataAgent).filter(key => key.startsWith("week-"));
    const weekNums = weekKeys.map(key => Number(key.split("-")[1])).filter(num => !isNaN(num));

    // Génère le select semaine
    weekSelect.innerHTML = "";
    weekNums.forEach(week => {
      const option = document.createElement("option");
      option.value = `week-${week}`;
      option.textContent = `Semaine ${week} (${getWeekDateRange(week)})`;
      weekSelect.appendChild(option);
    });

    // --- Synchronisation avec agent.js ---
    // Va chercher la semaine sélectionnée en sessionStorage
    let selectedWeekKey = sessionStorage.getItem("selectedWeek");
    if (!selectedWeekKey || !weekNums.includes(Number(selectedWeekKey.split('-')[1]))) {
      // Si pas de semaine stockée, ou la semaine n'est pas dans la liste, prend la première dispo
      selectedWeekKey = `week-${weekNums[0]}`;
    }
    weekSelect.value = selectedWeekKey;
    updateDisplay(selectedWeekKey, planningDataAgent);

    weekSelect.addEventListener("change", () => {
      sessionStorage.setItem("selectedWeek", weekSelect.value); // MAJ session pour l’autre page
      updateDisplay(weekSelect.value, planningDataAgent);
    });

  } catch (err) {
    console.error("Erreur lors du chargement :", err);
    alert("Erreur lors du chargement du planning. Veuillez réessayer.");
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

  // Créneaux 30min de 7h à 6h30 le lendemain (48 slots)
  const allSlots = [];
  for (let i = 0; i < 48; i++) {
    const h = (7 + Math.floor(i / 2)) % 24;
    const m = i % 2 === 0 ? "00" : "30";
    const nextH = (h + (m === "30" ? 1 : 0)) % 24;
    const nextM = m === "00" ? "30" : "00";
    allSlots.push(`${String(h).padStart(2, '0')}:${m} - ${String(nextH).padStart(2, '0')}:${nextM}`);
  }

  // Header heures
  header.innerHTML = `<div class="day-label sticky-day-col"></div>`;
  for (let i = 0; i < 24; i++) {
    const hour = (7 + i) % 24;
    const div = document.createElement("div");
    div.className = "hour-cell";
    div.textContent = `${String(hour).padStart(2, '0')}:00`;
    div.style.gridColumn = `span 2`;
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

    // PATCH : Si la semaine n’existe pas dans le planning, ne rien afficher
    const selectedSlots = planningData[weekKey]?.[day] || [];
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
    weekSelect.disabled = true;
  } else {
    loadingSpinner.classList.add("hidden");
    weekSelect.disabled = false;
  }
}
