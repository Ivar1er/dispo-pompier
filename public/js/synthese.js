const days = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const agent = sessionStorage.getItem("agent");
const API_BASE_URL = "https://dispo-pompier.onrender.com"; // Assurez-vous que cette URL est correcte

// DOM Elements
const weekSelect = document.getElementById("week-select");
const dateRangeDisplay = document.getElementById("date-range");
const planningContainer = document.getElementById("planning-container");
const headerHours = document.getElementById("header-hours");
const noPlanningMessage = document.getElementById("no-planning-message");
const loadingSpinner = document.getElementById("loading-spinner");

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
    alert("Vous devez être connecté en tant qu’agent."); // Garde l'alerte pour cette vérification cruciale
    window.location.href = "index.html";
    return;
  }

  showLoading(true);
  try {
    const response = await fetch(`${API_BASE_URL}/api/planning/${agent}`);
    if (!response.ok) {
        if (response.status === 404) {
            // Aucun planning trouvé, ce n'est pas une erreur critique ici
            noPlanningMessage.classList.remove("hidden");
            planningContainer.innerHTML = ""; // Vider le planning
            headerHours.innerHTML = ""; // Vider l'en-tête d'heures
            weekSelect.innerHTML = "<option value=''>Aucune semaine</option>"; // Vider le sélecteur
            weekSelect.disabled = true; // Désactiver le sélecteur
            dateRangeDisplay.textContent = "";
            return;
        }
        throw new Error(`Erreur HTTP ${response.status}`);
    }
    const planningDataAgent = await response.json();

    if (!Object.keys(planningDataAgent).length) {
      noPlanningMessage.classList.remove("hidden");
      planningContainer.innerHTML = "";
      headerHours.innerHTML = "";
      weekSelect.innerHTML = "<option value=''>Aucune semaine</option>";
      weekSelect.disabled = true;
      dateRangeDisplay.textContent = "";
      return;
    } else {
        noPlanningMessage.classList.add("hidden"); // Cache le message si planning trouvé
        weekSelect.disabled = false; // Réactive le sélecteur
    }

    const weeks = Object.keys(planningDataAgent)
      .filter(key => key.startsWith("week-"))
      .map(key => +key.split("-")[1])
      .sort((a, b) => a - b);

    weekSelect.innerHTML = "";
    weeks.forEach(week => {
      const option = document.createElement("option");
      option.value = week;
      option.textContent = `Semaine ${week} (${getWeekDateRange(week)})`;
      weekSelect.appendChild(option);
    });

    if (weeks.length > 0) {
      weekSelect.value = weeks[0]; // Sélectionne la première semaine disponible
      updateDisplay(weeks[0], planningDataAgent);
    }

    weekSelect.addEventListener("change", () => {
      updateDisplay(+weekSelect.value, planningDataAgent);
    });

  } catch (err) {
    console.error("Erreur lors du chargement :", err);
    alert("Erreur lors du chargement du planning. Veuillez réessayer.");
    noPlanningMessage.classList.remove("hidden"); // Affiche le message d'erreur générique
  } finally {
    showLoading(false);
  }
});

function updateDisplay(weekNumber, planningData) {
  dateRangeDisplay.textContent = getWeekDateRange(weekNumber);
  showWeek(weekNumber, planningData);
}

function showWeek(weekNumber, planningData) {
  const weekKey = `week-${weekNumber}`;
  const container = document.getElementById("planning-container");
  const header = document.getElementById("header-hours");

  // Créneaux 30min de 7h à 6h30 le lendemain (48 slots)
  const allSlots = [];
  for (let i = 0; i < 48; i++) {
    const h = (7 + Math.floor(i / 2)) % 24;
    const m = i % 2 === 0 ? "00" : "30";
    const nextH = (h + (m === "30" ? 1 : 0)) % 24;
    const nextM = m === "00" ? "30" : "00";
    allSlots.push(`${String(h).padStart(2, '0')}:${m} - ${String(nextH).padStart(2, '0')}:${nextM}`);
  }

  // Header heures (affiche seulement les heures pleines, chaque cellule couvre 2 créneaux)
  header.innerHTML = `<div class="day-label sticky-day-col"></div>`; // Colonne vide pour alignement
  for (let i = 0; i < 24; i++) { // 24 heures complètes
    const hour = (7 + i) % 24; // De 7h à 6h (le lendemain)
    const div = document.createElement("div");
    div.className = "hour-cell";
    div.textContent = `${String(hour).padStart(2, '0')}:00`;
    div.style.gridColumn = `span 2`; // Chaque cellule d'heure couvre 2 colonnes de créneaux (30min * 2 = 1h)
    header.appendChild(div);
  }
  // Ajuste la template-columns pour le header et les lignes de jour
  header.style.gridTemplateColumns = `100px repeat(24, 2fr)`; // 100px pour le label jour, puis 24 colonnes qui couvrent 2 créneaux

  // Contenu jours + créneaux
  container.innerHTML = "";
  days.forEach(day => {
    const row = document.createElement("div");
    row.className = "day-row";
    // Ajuste la template-columns pour les lignes de jour
    row.style.gridTemplateColumns = `100px repeat(48, 1fr)`; // Retour à 48 colonnes pour les slots individuels

    const dayLabel = document.createElement("div");
    dayLabel.className = "day-label sticky-day-col";
    dayLabel.textContent = day.charAt(0).toUpperCase() + day.slice(1);
    row.appendChild(dayLabel);

    const selectedSlots = planningData[weekKey]?.[day] || [];
    allSlots.forEach(slot => {
      const div = document.createElement("div");
      div.className = "slot";
      div.setAttribute("data-time", slot);
      if (selectedSlots.includes(slot)) {
        div.classList.add("occupied"); // Utiliser 'occupied' pour la synthèse
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