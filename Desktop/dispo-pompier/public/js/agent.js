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

// --- NOUVEAU : Pour stocker les deux clics (début et fin) pour la sélection multiple ---
const selectedRange = {
  start: null,
  end: null
};

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
  if (!planningData[weekKey]) planningData[weekKey] = {};
  if (!planningData[weekKey][day]) planningData[weekKey][day] = [];
  const selectedSlots = planningData[weekKey][day];

  // Fonction pour convertir un créneau en index
  function slotIndex(slot) {
    return horaires.indexOf(slot);
  }

  horaires.forEach(horaire => {
    const button = document.createElement("button");
    button.className = "slot-button";
    button.dataset.day = day;
    button.textContent = horaire;

    if (selectedSlots.includes(horaire)) {
      button.classList.add("selected");
    }

    button.addEventListener("click", () => {
      // Si on a pas de début sélectionné, on le met
      if (selectedRange.start === null) {
        selectedRange.start = horaire;
        // Sélection temporaire du bouton cliqué
        clearTemporarySelection();
        button.classList.add("selected");
      }
      // Si on a un début et pas encore de fin, on le définit et sélectionne tout entre
      else if (selectedRange.end === null) {
        selectedRange.end = horaire;

        const startIdx = slotIndex(selectedRange.start);
        const endIdx = slotIndex(selectedRange.end);

        // Calculer min et max pour supporter clic inversé (fin avant début)
        const from = Math.min(startIdx, endIdx);
        const to = Math.max(startIdx, endIdx);

        // Ajouter tous les créneaux entre start et end (inclus)
        for (let i = from; i <= to; i++) {
          const slot = horaires[i];
          if (!selectedSlots.includes(slot)) {
            selectedSlots.push(slot);
          }
        }

        // Nettoyer la sélection temporaire
        clearTemporarySelection();

        // Rafraîchir l’affichage des boutons (pour refléter la sélection multiple)
        refreshButtonsSelection(container, selectedSlots);

        // Réinitialiser la sélection pour la prochaine plage
        selectedRange.start = null;
        selectedRange.end = null;
      }
      // Si on a déjà start ET end, on recommence une nouvelle sélection (reset)
      else {
        selectedRange.start = horaire;
        selectedRange.end = null;
        clearTemporarySelection();
        button.classList.add("selected");
      }
    });

    container.appendChild(button);
  });
}

// Nettoyer les sélections temporaires (boutons "start" seul sélectionné)
function clearTemporarySelection() {
  document.querySelectorAll(".slot-button").forEach(btn => {
    if (!btn.classList.contains("selected")) {
      btn.classList.remove("temp-selected");
    }
  });
}

// Met à jour les boutons sélectionnés visuellement en fonction de selectedSlots
function refreshButtonsSelection(container, selectedSlots) {
  container.querySelectorAll(".slot-button").forEach(btn => {
    if (selectedSlots.includes(btn.textContent.trim())) {
      btn.classList.add("selected");
    }
  });
}

function logout() {
  sessionStorage.removeItem("agent");
  window.location.href = "index.html";
}
