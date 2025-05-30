const days = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const agent = sessionStorage.getItem("agent");

document.addEventListener("DOMContentLoaded", async () => {
  if (!agent || agent === "admin") {
    alert("Vous devez être connecté en tant qu’agent.");
    window.location.href = "index.html";
    return;
  }

  try {
    const response = await fetch(`/api/planning/${agent}`);
    const planningData = await response.json();

    if (!Object.keys(planningData).length) {
      alert("Aucun planning trouvé.");
      return;
    }

    const weekSelect = document.getElementById("week-select");
    const container = document.getElementById("planning-container");

    const weeks = Object.keys(planningData)
      .filter(key => key.startsWith("week-"))
      .map(key => +key.split("-")[1])
      .sort((a, b) => a - b);

    // Remplit la liste déroulante
    weekSelect.innerHTML = "";
    weeks.forEach(week => {
      const option = document.createElement("option");
      option.value = week;
      option.textContent = `Semaine ${week}`;
      weekSelect.appendChild(option);
    });

    // Affiche la semaine sélectionnée par défaut
    if (weeks.length > 0) {
      weekSelect.value = weeks[0];
      afficherPlanningSemaine(weeks[0], planningData);
    }

    weekSelect.addEventListener("change", () => {
      const selectedWeek = +weekSelect.value;
      afficherPlanningSemaine(selectedWeek, planningData);
    });

  } catch (err) {
    console.error("Erreur lors du chargement du planning :", err);
    alert("Erreur lors du chargement du planning.");
  }
});

function afficherPlanningSemaine(weekNumber, planningData) {
  const container = document.getElementById("planning-container");
  container.innerHTML = "";

  const weekKey = `week-${weekNumber}`;
  const weekPlanning = planningData[weekKey];

  if (!weekPlanning) {
    container.textContent = "Aucun planning pour cette semaine.";
    return;
  }

  const table = document.createElement("table");
  table.className = "planning-table";

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  headRow.innerHTML = "<th>Jour</th><th>Créneaux</th>";
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  for (const day of days) {
    const tr = document.createElement("tr");

    const tdDay = document.createElement("td");
    tdDay.textContent = day.charAt(0).toUpperCase() + day.slice(1);
    tr.appendChild(tdDay);

    const tdSlots = document.createElement("td");
    const slots = weekPlanning[day] || [];
    tdSlots.textContent = slots.join(", ");
    tr.appendChild(tdSlots);

    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
  container.appendChild(table);
}
