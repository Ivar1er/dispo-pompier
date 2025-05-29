const days = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const agent = sessionStorage.getItem("agent");

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

function capitalizeWords(str) {
  return str.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
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

  try {
    // Récupération des données de planning + infos agent
    const response = await fetch(`/api/planning/${agent}`);
    if (!response.ok) throw new Error(`Erreur HTTP ${response.status}`);
    const data = await response.json();

    planningDataAgent = data.planning || data; // selon ta structure
    const prenom = data.prenom || '';
    const nom = data.nom || agent; // fallback au nom agent simple

    // Affichage Prénom Nom capitalisé
    document.getElementById("agent-name").textContent = capitalizeWords(`${prenom} ${nom}`);

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

    // Gestion du bouton effacer la dernière plage sélectionnée du jour actif
    document.getElementById("clear-selection-btn").addEventListener("click", () => {
      const currentWeek = weekSelect.value;
      const currentDay = document.querySelector(".tab.active")?.textContent.toLowerCase();
      if (!currentDay) return;

      const weekKey = `week-${currentWeek}`;
      if (!planningDataAgent[weekKey]) return;

      const selectedSlots = planningDataAgent[weekKey][currentDay] || [];
      if (selectedSlots.length === 0) return;

      // Supprime la dernière plage sélectionnée
      selectedSlots.pop();

      // Met à jour les données
      planningDataAgent[weekKey][currentDay] = selectedSlots;

      // Met à jour l'affichage
      showDay(currentDay, currentWeek, planningDataAgent);
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

  const horairesWithIndex = horaires.map((h, idx) => ({ horaire: h, index: idx }));

  horairesWithIndex.forEach(({ horaire, index }) => {
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