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
    const container = document.getElementById("planning-container");

    // Crée le header des heures (barre du haut)
    const headerHoursDiv = document.createElement("div");
    headerHoursDiv.className = "header-hours";
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

  // Récupérer la barre des heures avant de vider le container
  const headerHours = container.querySelector(".header-hours");
  container.innerHTML = "";
  container.appendChild(headerHours);

  // Générer tous les créneaux 30 min de 7h00 à 6h30 (lendemain)
  const slots = [];
  for (let h = 7; ; h += 0.5) {
    const hour = Math.floor(h) % 24;
    const min = (h % 1 === 0) ? "00" : "30";

    let endH = Math.floor((h + 0.5)) % 24;
    let endMin = ((h + 0.5) % 1 === 0) ? "00" : "30";

    const slotLabel = `${hour.toString().padStart(2, '0')}:${min} - ${endH.toString().padStart(2, '0')}:${endMin}`;
    slots.push(slotLabel);

    // Stop à 6h30 (fin créneau 7h00)
    if (hour === 6 && min === "30") break;
  }

  // Remplir la barre des heures (header)
  headerHours.innerHTML = ""; // vider

  slots.forEach(slot => {
    // Div heure
    const hourLabel = document.createElement("div");
    hourLabel.className = "hour-label";

    const startHour = slot.split(" - ")[0];

    // Afficher l'heure pleine (ex: 07:00, 08:00) avec label et demi-heure sous
    if (startHour.endsWith(":00")) {
      hourLabel.textContent = startHour;

      // Ajouter sous-label demi-heure (ex: 07:30)
      const halfHour = document.createElement("div");
      halfHour.className = "half-hour-label";
      // Heure suivante 30min plus tard
      let [h, m] = startHour.split(":").map(Number);
      m += 30;
      if (m >= 60) {
        m -= 60;
        h = (h + 1) % 24;
      }
      halfHour.textContent = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;

      hourLabel.appendChild(halfHour);
    }

    headerHours.appendChild(hourLabel);
  });

  // Créer la ligne par jour avec barre des créneaux
  days.forEach(day => {
    const dayRow = document.createElement("div");
    dayRow.className = "day-row";

    // Label jour à gauche
    const dayLabel = document.createElement("div");
    dayLabel.className = "day-label";
    dayLabel.textContent = day.charAt(0).toUpperCase() + day.slice(1);
    dayRow.appendChild(dayLabel);

    // Barre des créneaux
    const bar = document.createElement("div");
    bar.className = "slots-bar";

    const selectedSlots = planningData[weekKey]?.[day] || [];

    slots.forEach(slot => {
      const slotDiv = document.createElement("div");
      slotDiv.className = "slot";

      if (selectedSlots.includes(slot)) {
        slotDiv.classList.add("selected");
      }
      bar.appendChild(slotDiv);
    });

    dayRow.appendChild(bar);
    container.appendChild(dayRow);
  });
}
