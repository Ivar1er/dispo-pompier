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
      updateDisplay(+weekSelect.value, planningDataAgent);
    });

  } catch (err) {
    console.error("Erreur lors du chargement :", err);
    alert("Erreur lors du chargement du planning.");
  }
});

function updateDisplay(weekNumber, planningData) {
  document.getElementById("date-range").textContent = getWeekDateRange(weekNumber);
  showWeek(weekNumber, planningData);
}

function showWeek(weekNumber, planningData) {
  const weekKey = `week-${weekNumber}`;
  const container = document.getElementById("planning-container");
  const header = document.getElementById("header-hours");

  // Créneaux 30min de 7h à 6h30 le lendemain (48 slots)
  const slots = [];
  for (let i = 0; i < 48; i++) {
    const h = (7 + Math.floor(i / 2)) % 24;
    const m = i % 2 === 0 ? "00" : "30";
    const nextH = (h + (m === "30" ? 1 : 0)) % 24;
    const nextM = m === "00" ? "30" : "00";
    slots.push(`${String(h).padStart(2, '0')}:${m} - ${String(nextH).padStart(2, '0')}:${nextM}`);
  }

  // Header heures
  header.innerHTML = `<div class="sticky-day-col"></div>`;
  slots.forEach(slot => {
    const div = document.createElement("div");
    div.className = "hour-cell";
    div.textContent = slot.split(" - ")[0];
    header.appendChild(div);
  });

  // Contenu jours + créneaux
  container.innerHTML = "";
  days.forEach(day => {
    const row = document.createElement("div");
    row.className = "day-row";

    const dayLabel = document.createElement("div");
    dayLabel.className = "day-label sticky-day-col";
    dayLabel.textContent = day.charAt(0).toUpperCase() + day.slice(1);
    row.appendChild(dayLabel);

    const selectedSlots = planningData[weekKey]?.[day] || [];
    slots.forEach(slot => {
      const div = document.createElement("div");
      div.className = "slot";
      div.setAttribute("data-time", slot);
      if (selectedSlots.includes(slot)) {
        div.classList.add("selected");
      }
      row.appendChild(div);
    });

    container.appendChild(row);
  });
}