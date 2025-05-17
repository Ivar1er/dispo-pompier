const days = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const agent = sessionStorage.getItem("agent");

// Créneaux de 07:00 (jour J) à 07:00 (jour J+1)
const horaires = [];
for (let h = 7; h < 31; h++) {
  const hour = h % 24;
  for (let m = 0; m < 60; m += 15) {
    const start = `${hour.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    const endM = (m + 15) % 60;
    const endH = (m + 15 >= 60) ? (hour + 1) % 24 : hour;
    const end = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;
    horaires.push(`${start} - ${end}`);
  }
}

function getCurrentISOWeek() {
  const now = new Date();
  const jan4 = new Date(now.getFullYear(), 0, 4);
  const dayDiff = (now - jan4) / 86400000;
  return Math.ceil((dayDiff + jan4.getDay() + 1) / 7);
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

    // ✅ Enregistrement corrigé : mise à jour d’un seul jour dans la semaine
    document.getElementById("save-button").addEventListener("click", async () => {
      const week = weekSelect.value;
      const weekKey = `week-${week}`;

      const currentDay = document.querySelector(".tab.active")?.textContent.toLowerCase();
      const selectedSlots = Array.from(document.querySelectorAll(`.slot-button[data-day="${currentDay}"].selected`))
        .map(btn => btn.textContent.trim());

      const existingWeekData = planningDataAgent[weekKey] || {};
      const updatedWeekData = {
        ...existingWeekData,
        [currentDay]: selectedSlots
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

  horaires.forEach(horaire => {
    const button = document.createElement("button");
    button.className = "slot-button";
    button.dataset.day = day;
    button.textContent = horaire;

    if (selectedSlots.includes(horaire)) {
      button.classList.add("selected");
    }

    button.addEventListener("click", () => {
      button.classList.toggle("selected");

      const weekKey = `week-${weekNumber}`;
      if (!planningDataAgent[weekKey]) planningDataAgent[weekKey] = {};
      if (!planningDataAgent[weekKey][day]) planningDataAgent[weekKey][day] = [];

      const slotText = button.textContent.trim();
      const index = planningDataAgent[weekKey][day].indexOf(slotText);

      if (button.classList.contains("selected")) {
        if (index === -1) planningDataAgent[weekKey][day].push(slotText);
      } else {
        if (index > -1) planningDataAgent[weekKey][day].splice(index, 1);
      }
    });

    container.appendChild(button);
  });
}

function logout() {
  sessionStorage.removeItem("agent");
  window.location.href = "index.html";
}
