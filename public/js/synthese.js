const days = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const agent = sessionStorage.getItem("agent");

// Calcule la plage de dates du lundi au dimanche d'une semaine ISO donnée
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

    // Liste des semaines disponibles pour cet agent
    const weeks = Object.keys(planningDataAgent)
      .filter(key => key.startsWith("week-"))
      .map(key => +key.split("-")[1])
      .sort((a, b) => a - b);

    // Remplit le <select> avec les semaines
    weekSelect.innerHTML = "";
    weeks.forEach(week => {
      const option = document.createElement("option");
      option.value = week;
      option.textContent = `Semaine ${week}`;
      weekSelect.appendChild(option);
    });

    // Affiche la première semaine par défaut
    if (weeks.length > 0) {
      weekSelect.value = weeks[0];
      updateDisplay(weeks[0], planningDataAgent);
    }

    // Écoute du changement de semaine
    weekSelect.addEventListener("change", () => {
      const selectedWeek = +weekSelect.value;
      updateDisplay(selectedWeek, planningDataAgent);
    });

  } catch (err) {
    console.error("Erreur lors du chargement :", err);
    alert("Erreur lors du chargement du planning.");
  }
});

// Met à jour la synthèse : plage de dates + tableau
function updateDisplay(weekNumber, planningData) {
  const dateRange = document.getElementById("date-range");
  dateRange.textContent = getWeekDateRange(weekNumber);

  showWeek(weekNumber, planningData);
}

function showWeek(weekNumber, planningData) {
  const weekKey = `week-${weekNumber}`;
  const container = document.getElementById("planning-container");
  container.innerHTML = "";

  const table = document.createElement("table");
  table.className = "planning-table";

  // Entête avec horaires
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  headRow.innerHTML = "<th>Jour</th>";

  const horaires = [];
  for (let h = 7; h < 31; h++) {
    const hour = h % 24;
    for (let m = 0; m < 60; m += 15) {
      const start = `${hour.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      const endM = (m + 15) % 60;
      const endH = (m + 15 >= 60) ? (hour + 1) % 24 : hour;
      const end = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;
      const label = `${start} - ${end}`;
      horaires.push(label);

      const th = document.createElement("th");
      th.textContent = label;
      headRow.appendChild(th);
    }
  }

  thead.appendChild(headRow);
  table.appendChild(thead);

  // Corps avec jours et créneaux
  const tbody = document.createElement("tbody");

  for (const day of days) {
    const tr = document.createElement("tr");

    const tdDay = document.createElement("td");
    tdDay.textContent = day.charAt(0).toUpperCase() + day.slice(1);
    tr.appendChild(tdDay);

    const daySlots = planningData[weekKey]?.[day] || [];

    for (const horaire of horaires) {
      const td = document.createElement("td");
      td.className = "slot";
      if (daySlots.includes(horaire)) {
        td.classList.add("selected");
      }
      tr.appendChild(td);
    }

    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
  container.appendChild(table);
}
