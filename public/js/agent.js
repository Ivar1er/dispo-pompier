const days = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const agent = sessionStorage.getItem("agent");

const horaires = [];

// Génère 48 créneaux de 30 min sur 24h (00:00-00:30, 00:30-01:00, ...)
for (let i = 0; i < 48; i++) {
  const hour = Math.floor(i / 2);
  const minute = (i % 2) * 30;

  const endMinute = (minute + 30) % 60;
  const endHour = (minute + 30 >= 60) ? (hour + 1) % 24 : hour;

  const start = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  const end = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;

  horaires.push(`${start} - ${end}`);
}

// Décalage pour démarrer à 07:00 au lieu de 00:00
const startIndex = horaires.findIndex(h => h.startsWith("07:00"));
const horairesDecales = horaires.slice(startIndex).concat(horaires.slice(0, startIndex));

function getCurrentISOWeek() {
  const date = new Date();
  const target = new Date(date.valueOf());
  target.setDate(target.getDate() + 3 - (target.getDay() + 6) % 7);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  return 1 + Math.round(((target - firstThursday) / 86400000 - 3 + (firstThursday.getDay() + 6) % 7) / 7);
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

  const format = date => date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit"
  });

  return `du ${format(start)} au ${format(end)}`;
}

let planningDataAgent = {};
let firstSelectedIndex = null;
let lastSelectedIndex = null;

document.addEventListener("DOMContentLoaded", async () => {
  if (!agent || agent === "admin") {
    alert("Vous devez être connecté en tant qu’agent.");
    window.location.href = "index.html";
    return;
  }

  document.getElementById("agent-name").textContent = agent;

  try {
    const response = await fetch(`/api/planning/${agent}`);
    if (!response.ok) throw new Error(`Erreur HTTP ${response.status}`);
    planningDataAgent = await response.json();

    const currentWeek = getCurrentISOWeek();

    const allWeeks = [];
    for (let i = currentWeek; i < currentWeek + 8; i++) {
      allWeeks.push(i);
    }

    const weekSelect = document.getElementById("week-select");
    weekSelect.innerHTML = "";

    allWeeks.forEach(week => {
      const option = document.createElement("option");
      option.value = week;
      option.textContent = `Semaine ${week}`;
      weekSelect.appendChild(option);
    });

    weekSelect.value = currentWeek;
    updateDisplay(currentWeek);

    weekSelect.addEventListener("change", () => {
      const selectedWeek = +weekSelect.value;
      updateDisplay(selectedWeek);
    });

    document.querySelectorAll(".tab").forEach(tab => {
      tab.addEventListener("click", () => {
        const onclickText = tab.getAttribute("onclick") || "";
        const match = onclickText.match(/'(\w+)'/);
        const day = match ? match[1] : 'lundi';
        const week = +weekSelect.value;
        showDay(day, week, planningDataAgent);
      });
    });

    document.getElementById("save-button").addEventListener("click", async () => {
      const week = weekSelect.value;
      const weekKey = `week-${week}`;

      const currentDay = document.querySelector(".tab.active")?.textContent.toLowerCase();
      const selectedSlots = Array.from(document.querySelectorAll(`.slot-button[data-day="${currentDay}"].selected`))
        .map(btn => btn.textContent.trim());

      const existingWeekData = planningDataAgent[weekKey] || {};

      // Combine les anciennes plages avec les nouvelles sans doublon
      const previousSlots = existingWeekData[currentDay] || [];
      const combinedSlots = Array.from(new Set([...previousSlots, ...selectedSlots]));

      // Met à jour uniquement le jour affiché avec la combinaison
      const updatedWeekData = {
        ...existingWeekData,
        [currentDay]: combinedSlots
      };

      const updatedPlanning = {
        ...planningDataAgent,
        [weekKey]: updatedWeekData
      };

      const saveResponse = await fetch(`/api/planning/${agent}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedPlanning)
      });

      if (saveResponse.ok) {
        alert("Créneaux enregistrés avec succès !");
        planningDataAgent = updatedPlanning;
      } else {
        alert("Erreur lors de l’enregistrement.");
      }
    });

    document.getElementById('clear-selection-btn').addEventListener('click', () => {
      const weekKey = `week-${weekSelect.value}`;
      const activeTab = document.querySelector('.tab.active');
      if (!activeTab) return;
      const day = activeTab.textContent.toLowerCase();

      if (planningDataAgent[weekKey]?.[day]?.length > 0) {
        // Supprime seulement le dernier créneau sélectionné
        planningDataAgent[weekKey][day].pop();
        showDay(day, +weekSelect.value, planningDataAgent);
      } else {
        alert("Aucun créneau à supprimer.");
      }
    });

  } catch (err) {
    console.error("Erreur lors du chargement :", err);
    alert("Erreur lors du chargement du planning.");
  }
});

function updateDisplay(weekNumber) {
  document.getElementById("date-range").textContent = getWeekDateRange(weekNumber);
  showDay('lundi', weekNumber, planningDataAgent);
}

function showDay(day, weekNumber = document.getElementById("week-select").value, planningData = {}) {
  document.querySelectorAll(".tab").forEach(tab => tab.classList.remove("active"));
  document.querySelectorAll(".tab").forEach(tab => {
    const onclickText = tab.getAttribute("onclick") || "";
    const match = onclickText.match(/'(\w+)'/);
    if (match && match[1] === day) {
      tab.classList.add("active");
    }
  });

  const container = document.getElementById("planning-container");
  container.innerHTML = "";

  const weekKey = `week-${weekNumber}`;
  const selectedSlots = planningData[weekKey]?.[day] || [];

  horairesDecales.forEach((horaire, index) => {
    const button = document.createElement("button");
    button.className = "slot-button";
    button.dataset.day = day;
    button.textContent = horaire;

    if (selectedSlots.includes(horaire)) {
      button.classList.add("selected");
    }

    button.addEventListener("click", () => {
      if (button.classList.contains("selected")) {
        button.classList.remove("selected");
        return;
      }

      if (firstSelectedIndex === null) {
        firstSelectedIndex = index;
        lastSelectedIndex = null;
        selectRange(day, weekKey, firstSelectedIndex, firstSelectedIndex);
      } else if (lastSelectedIndex === null) {
        lastSelectedIndex = index;
        selectRange(day, weekKey, firstSelectedIndex, lastSelectedIndex);
        firstSelectedIndex = null;
        lastSelectedIndex = null;
      }
    });

    container.appendChild(button);
  });
}

function selectRange(day, weekKey, startIndex, endIndex) {
  const minIndex = Math.min(startIndex, endIndex);
  const maxIndex = Math.max(startIndex, endIndex);

  const allButtons = document.querySelectorAll(`.slot-button[data-day="${day}"]`);
  for (let i = minIndex; i <= maxIndex; i++) {
    const btn = allButtons[i];
    if (btn) btn.classList.add("selected");
  }
}

function logout() {
  sessionStorage.removeItem("agent");
  window.location.href = "index.html";
}
