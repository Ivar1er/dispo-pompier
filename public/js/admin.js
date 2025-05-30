const days = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

let currentWeek = getCurrentWeek();
let currentDay = 'lundi';
let planningData = {};  // { agent: { "week-15": { lundi: [slots], ... } }, ... }

// Mapping agent => nom complet
const agentInfos = {
  bruneau: "Bruneau Mathieu",
  vatinel: "Vatinel Sébastien",
  gesbert: "Gesbert Jonathan",
  tuleu: "Tuleu Kévin",
  lelann: "Le Lann Philippe",
  cordel: "Cordel Camilla",
  boudet: "Boudet Sébastien",
  boulmé: "Boulmé Grégoire",
  maréchal: "Maréchal Nicolas",
  justice: "Justice Quentin",
  veniant: "Veniant Mathis",
  normand: "Normand Stéphane",
  schaeffer: "Schaeffer Caroline",
  boulet: "Boulet Aurélie",
  charenton: "Charenton Marilou",
  hérédia: "Hérédia Jules",
  loisel: "Loisel Charlotte",
  mailly: "Mailly Lucile",
  marlin: "Marlin Lilian",
  savigny: "Savigny Victoria",
  tinseau: "Tinseau Clément",
  admin: "Admin Admin"
};

const weekSelector = document.getElementById("week-selector");
const planningContainer = document.getElementById("global-planning");

// Get current week number (ISO week number)
function getCurrentWeek(date = new Date()) {
  const jan4 = new Date(date.getFullYear(), 0, 4);
  const dayOfWeek = jan4.getDay() || 7;
  const mondayOfWeek1 = new Date(jan4);
  mondayOfWeek1.setDate(jan4.getDate() - dayOfWeek + 1);
  const diff = date - mondayOfWeek1;
  return Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1;
}

// Calcul date du lundi ISO d'une semaine
function getMondayOfWeek(weekNum, year) {
  const simple = new Date(year, 0, 1 + (weekNum - 1) * 7);
  const dow = simple.getDay();
  if (dow <= 4) simple.setDate(simple.getDate() - dow + 1);
  else simple.setDate(simple.getDate() + 8 - dow);
  return simple;
}

function updateWeekSelector(availableWeeks) {
  weekSelector.innerHTML = "";
  const sorted = Array.from(availableWeeks).sort((a, b) => {
    return parseInt(a.split("-")[1]) - parseInt(b.split("-")[1]);
  });
  sorted.forEach(weekKey => {
    const opt = document.createElement("option");
    opt.value = weekKey;
    opt.textContent = "Semaine " + weekKey.split("-")[1];
    weekSelector.appendChild(opt);
  });

  if (sorted.includes(`week-${currentWeek}`)) {
    weekSelector.value = `week-${currentWeek}`;
  } else if (sorted.length) {
    weekSelector.value = sorted[0];
    currentWeek = parseInt(sorted[0].split("-")[1]);
  }

  showDay(currentDay);
}

// Charge planning global depuis API (tous les agents)
async function loadPlanning() {
  try {
    const res = await fetch('/api/planning');
    if (!res.ok) throw new Error("Erreur chargement planning global");
    const data = await res.json();
    planningData = data || {};
  } catch (e) {
    console.error(e);
    planningData = {};
  }
}

function showDay(day) {
  currentDay = day;
  document.querySelectorAll(".tab").forEach(tab => {
    tab.classList.toggle("active", tab.textContent.toLowerCase() === day);
  });

  planningContainer.innerHTML = "";

  const table = document.createElement("table");
  table.className = "planning-table";

  // Header
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");

  const thAgent = document.createElement("th");
  thAgent.textContent = "Agent";
  headerRow.appendChild(thAgent);

  for (let h = 7; h < 31; h++) {
    const hour = h % 24;
    for (let m = 0; m < 60; m += 15) {
      const start = `${hour.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`;
      const endM = (m + 15) % 60;
      const endH = (m + 15 >= 60) ? (hour + 1) % 24 : hour;
      const end = `${endH.toString().padStart(2,'0')}:${endM.toString().padStart(2,'0')}`;
      const th = document.createElement("th");
      th.textContent = `${start} - ${end}`;
      headerRow.appendChild(th);
    }
  }
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Body
  const tbody = document.createElement("tbody");

  let foundAny = false;
  const weekKey = weekSelector.value;

  for (const [agent, weeks] of Object.entries(planningData)) {
    if (agent === "admin") continue; // Ignore admin

    const slots = weeks[weekKey]?.[day] || [];
    if (slots.length === 0) continue;

    foundAny = true;

    const tr = document.createElement("tr");
    const tdAgent = document.createElement("td");
    tdAgent.textContent = agentInfos[agent] || agent;
    tr.appendChild(tdAgent);

    // Parcours des créneaux horaires
    for (let h = 7; h < 31; h++) {
      const hour = h % 24;
      for (let m = 0; m < 60; m += 15) {
        const start = `${hour.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`;
        const endM = (m + 15) % 60;
        const endH = (m + 15 >= 60) ? (hour + 1) % 24 : hour;
        const end = `${endH.toString().padStart(2,'0')}:${endM.toString().padStart(2,'0')}`;
        const td = document.createElement("td");

        const slotString = `${start} - ${end}`;
        if (slots.includes(slotString)) {
          td.textContent = "X";
          td.classList.add("marked");
        }
        tr.appendChild(td);
      }
    }

    tbody.appendChild(tr);
  }

  if (!foundAny) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 1 + (24 * 4);
    td.textContent = `Aucun créneau trouvé pour ${day} semaine ${weekKey.split("-")[1]}`;
    tr.appendChild(td);
    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
  planningContainer.appendChild(table);
}

// Initialisation
async function init() {
  await loadPlanning();

  const allWeeksSet = new Set();

  for (const agent in planningData) {
    if (agent === "admin") continue;
    const weeks = Object.keys(planningData[agent]);
    weeks.forEach(w => allWeeksSet.add(w));
  }

  if (allWeeksSet.size === 0) {
    allWeeksSet.add(`week-${currentWeek}`);
  }

  updateWeekSelector(allWeeksSet);

  weekSelector.addEventListener("change", () => {
    const val = weekSelector.value;
    currentWeek = parseInt(val.split("-")[1]);
    showDay(currentDay);
  });
}

init();

// Gérer les clics sur les onglets jour
document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    const day = tab.dataset.day;
    showDay(day);
  });
});

// Gestion de la déconnexion
document.getElementById("logout-btn").addEventListener("click", () => {
  sessionStorage.removeItem("agent");
  window.location.href = "index.html";
});

document.getElementById("export-pdf").addEventListener("click", async () => {
  const container = document.getElementById("global-planning");

  const originalOverflowX = container.style.overflowX;
  const originalWidth = container.style.width;

  // Désactive scroll horizontal et ajuste largeur
  container.style.overflowX = "visible";
  container.style.width = "max-content";

  await new Promise(r => setTimeout(r, 100));

  const { jsPDF } = window.jspdf;

  const year = new Date().getFullYear();
  const mondayDate = getMondayOfWeek(currentWeek, year);
  const sundayDate = new Date(mondayDate);
  sundayDate.setDate(mondayDate.getDate() + 6);

  function formatDate(d) {
    return d.getDate().toString().padStart(2, '0') + '/' + (d.getMonth() + 1).toString().padStart(2, '0');
  }
  const title = `Semaine ${currentWeek} du ${formatDate(mondayDate)} au ${formatDate(sundayDate)}`;

  const canvas = await html2canvas(container, {
    scale: 2,
    scrollY: -window.scrollY,
  });

  container.style.overflowX = originalOverflowX;
  container.style.width = originalWidth;

  const imgData = canvas.toDataURL("image/png");

  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a3"
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 10;

  pdf.setFontSize(18);
  pdf.text(title, margin, 20);

  // Ligne jour ajoutée ici
  pdf.setFontSize(14);
  pdf.text(`Jour : ${currentDay.charAt(0).toUpperCase() + currentDay.slice(1)}`, margin, 28);

  const imgProps = pdf.getImageProperties(imgData);
  const pdfWidth = pageWidth - 2 * margin;
  const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

  pdf.addImage(imgData, "PNG", margin, 35, pdfWidth, pdfHeight);

  pdf.save(`planning_${currentDay}_semaine${currentWeek}.pdf`);
});
