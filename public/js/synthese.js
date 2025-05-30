const days = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const agent = sessionStorage.getItem("agent");

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

  try {
    const response = await fetch(`/api/planning/${agent}`);
    if (!response.ok) throw new Error(`Erreur HTTP ${response.status}`);
    const planningDataAgent = await response.json();

    if (!Object.keys(planningDataAgent).length) {
      alert("Aucun planning trouvé pour cet agent.");
      return;
    }

    const weekSelect = document.getElementById("week-select");
    const dateRange = document.getElementById("date-range");
    const container = document.getElementById("planning-container");

    // Ajout bandeau graduations heures
    const headerHoursDiv = document.createElement("div");
    headerHoursDiv.id = "header-hours";
    container.appendChild(headerHoursDiv);

    const weeks = Object.keys(planningDataAgent)
      .filter(key => key.startsWith("week-"))
      .map(key => +key.split("-")[1])
      .sort((a, b) => a - b);

    weekSelect.innerHTML = "";
    weeks.forEach(week => {
      const option = document.createElement("option");
      option.value = week;
      option.textContent = `Semaine ${week}`;
      weekSelect.appendChild(option);
    });

    if (weeks.length > 0) {
      weekSelect.value = weeks[0];
      updateDisplay(weeks[0], planningDataAgent);
    }

    weekSelect.addEventListener("change", () => {
      const selectedWeek = +weekSelect.value;
      updateDisplay(selectedWeek, planningDataAgent);
    });

  } catch (err) {
    console.error("Erreur lors du chargement :", err);
    alert("Erreur lors du chargement du planning.");
  }
});

function updateDisplay(weekNumber, planningData) {
  const dateRange = document.getElementById("date-range");
  dateRange.textContent = getWeekDateRange(weekNumber);
  showWeek(weekNumber, planningData);
}

function showWeek(weekNumber, planningData) {
  const weekKey = `week-${weekNumber}`;
  const container = document.getElementById("planning-container");

  // On garde seulement le header heures, on vide le reste
  const headerHours = document.getElementById("header-hours");
  container.innerHTML = "";
  container.appendChild(headerHours);

  // Créneaux 30 minutes de 7h00 à 7h00 (24h)
  const slots = [];
  for (let h = 7; ; h += 0.5) {
    const hour = Math.floor(h) % 24;
    const min = (h % 1 === 0) ? "00" : "30";
    const startLabel = `${hour.toString().padStart(2, '0')}:${min}`;
    let endH = Math.floor((h + 0.5)) % 24;
    let endMin = ((h + 0.5) % 1 === 0) ? "00" : "30";
    const endLabel = `${endH.toString().padStart(2, '0')}:${endMin}`;
    slots.push(`${startLabel} - ${endLabel}`);
    if (hour === 6 && min === "30") break; // Arrêt à 6h30 (fin créneau 7h00)
  }

  // Affiche bandeau heures avec graduations
  headerHours.innerHTML = "";
  slots.forEach(slot => {
    const div = document.createElement("div");
    div.className = "hour-mark";

    const startHour = slot.split(" - ")[0];
    if (startHour.endsWith(":00")) {
      div.classList.add("full-hour");
      div.textContent = startHour;
    }
    headerHours.appendChild(div);
  });

  // Pour chaque jour : créer une ligne avec nom jour + barre de créneaux
  days.forEach(day => {
    const dayRow = document.createElement("div");
    dayRow.className = "day-row";

    // Label jour
    const dayLabel = document.createElement("div");
    dayLabel.className = "day-label";
    dayLabel.textContent = day.charAt(0).toUpperCase() + day.slice(1);
    dayRow.appendChild(dayLabel);

    // Barre des créneaux
    const bar = document.createElement("div");
    bar.className = "time-bar";

    const selectedSlots = planningData[weekKey]?.[day] || [];

    slots.forEach(slot => {
      const slotDiv = document.createElement("div");
      slotDiv.className = "slot-block";
      if (selectedSlots.includes(slot)) {
        slotDiv.classList.add("selected");
      } else {
        slotDiv.classList.add("empty");
      }
      bar.appendChild(slotDiv);
    });

    dayRow.appendChild(bar);
    container.appendChild(dayRow);
  });
}
