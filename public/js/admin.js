const days = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

const API_BASE_URL = "https://dispo-pompier.onrender.com"; // Assurez-vous que cette URL est correcte et accessible

let currentWeek = getCurrentWeek();
let currentDay = 'lundi';
let planningData = {};

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

// DOM Elements
const weekSelect = document.getElementById("week-select");
const dateRangeDisplay = document.getElementById("date-range");
const planningContainer = document.getElementById("global-planning");
const loadingSpinner = document.getElementById("loading-spinner");
const tabButtons = document.querySelectorAll(".tab");
const adminInfo = document.getElementById("admin-info"); // Ajouté pour faciliter l'accès au message d'info

// Get current week number (ISO week number)
function getCurrentWeek(date = new Date()) {
  const target = new Date(date.valueOf());
  target.setDate(target.getDate() + 3 - (target.getDay() + 6) % 7);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((target - firstThursday) / 86400000 - 3 + (firstThursday.getDay() + 6) % 7) / 7);
  return weekNum;
}

// Calcul date du lundi ISO d'une semaine
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

function updateWeekSelector(availableWeeks) {
  weekSelect.innerHTML = "";
  const sorted = Array.from(availableWeeks).sort((a, b) => {
    return parseInt(a.split("-")[1]) - parseInt(b.split("-")[1]);
  });
  sorted.forEach(weekKey => {
    const opt = document.createElement("option");
    opt.value = weekKey;
    opt.textContent = `Semaine ${weekKey.split("-")[1]}`;
    weekSelect.appendChild(opt);
  });

  if (sorted.includes(`week-${currentWeek}`)) {
    weekSelect.value = `week-${currentWeek}`;
  } else if (sorted.length) {
    weekSelect.value = sorted[0];
    currentWeek = parseInt(sorted[0].split("-")[1]);
  }

  updateDisplay(currentWeek, planningData);
}

// Charge planning global depuis API (tous les agents)
async function loadPlanning() {
  showLoading(true);
  try {
    const res = await fetch(`${API_BASE_URL}/api/planning`);
    if (!res.ok) {
      if (res.status === 404) {
        console.warn("Aucun planning global trouvé (404), initialisation à vide.");
        planningData = {};
      } else {
        throw new Error(`Erreur chargement planning global: HTTP ${res.status}`);
      }
    }
    const data = await res.json();
    planningData = data || {};
  } catch (e) {
    console.error(e);
    alert("Erreur lors du chargement du planning global. Veuillez réessayer.");
    planningData = {};
  } finally {
    showLoading(false);
  }
}

// Nouvelle fonction pour gérer la mise à jour de l'affichage (date et planning)
function updateDisplay(weekNumber, planningData) {
  if (dateRangeDisplay) {
    dateRangeDisplay.textContent = getWeekDateRange(weekNumber);
  }
  showDay(currentDay);
}

function showDay(day) {
  currentDay = day;
  tabButtons.forEach(tab => {
    tab.classList.toggle("active", tab.dataset.day === day);
  });

  planningContainer.innerHTML = "";

  const table = document.createElement("table");
  table.className = "planning-table"; // Conserve cette classe, elle est importante

  // Header
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");

  const thAgent = document.createElement("th");
  thAgent.textContent = "Agent";
  headerRow.appendChild(thAgent);

  const allTimeSlots = [];
  for (let i = 0; i < 48; i++) {
    const h = (7 + Math.floor(i / 2)) % 24;
    const m = i % 2 === 0 ? "00" : "30";
    const nextH = (h + (m === "30" ? 1 : 0)) % 24;
    const nextM = m === "00" ? "30" : "00";
    const slotString = `${String(h).padStart(2, '0')}:${m} - ${String(nextH).padStart(2, '0')}:${nextM}`;
    allTimeSlots.push(slotString);

    const th = document.createElement("th");
    if (m === "00") {
      th.textContent = `${String(h).padStart(2, '0')}:00`;
      th.colSpan = 2;
    } else {
      th.style.display = "none";
    }
    headerRow.appendChild(th);
  }

  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Body
  const tbody = document.createElement("tbody");

  const weekKey = weekSelect.value;

  const allAgents = new Set([...Object.keys(agentInfos), ...Object.keys(planningData)]);
  const sortedAgents = Array.from(allAgents).filter(agent => agent !== "admin").sort();

  if (sortedAgents.length === 0) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 1 + allTimeSlots.length;
      td.textContent = "Aucun agent ou planning trouvé.";
      tr.appendChild(td);
      tbody.appendChild(tr);
  } else {
      sortedAgents.forEach(agent => {
        const slots = planningData[agent]?.[weekKey]?.[day] || [];

        const tr = document.createElement("tr");
        const tdAgent = document.createElement("td");
        tdAgent.textContent = agentInfos[agent] || agent;
        tr.appendChild(tdAgent);

        allTimeSlots.forEach(slotString => {
          const td = document.createElement("td");
          td.classList.add('slot-cell');
          td.setAttribute("data-time", slotString); // Ajout de l'attribut data-time
          if (slots.includes(slotString)) {
            td.classList.add('occupied');
          }
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
  }

  table.appendChild(tbody);
  planningContainer.appendChild(table);
}

// Initialisation
async function init() {
  const loggedInAgent = sessionStorage.getItem("agent");
  if (!loggedInAgent || loggedInAgent !== "admin") {
    alert("Accès refusé. Vous devez être connecté en tant qu'administrateur.");
    window.location.href = "index.html";
    return;
  }

  await loadPlanning();

  const allWeeksSet = new Set();

  for (const agentKey in planningData) {
    if (agentKey === "admin") continue;
    const weeks = Object.keys(planningData[agentKey]);
    weeks.forEach(w => allWeeksSet.add(w));
  }

  if (allWeeksSet.size === 0) {
    allWeeksSet.add(`week-${getCurrentWeek()}`);
  }

  updateWeekSelector(allWeeksSet);

  weekSelect.addEventListener("change", () => {
    const val = weekSelect.value;
    currentWeek = parseInt(val.split("-")[1]);
    updateDisplay(currentWeek, planningData);
  });
}

init();

// Gérer les clics sur les onglets jour
tabButtons.forEach(tab => {
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

// Fonction pour gérer l'affichage du spinner de chargement et désactiver/réactiver les contrôles
function showLoading(isLoading, forPdf = false) {
    if (isLoading) {
        loadingSpinner.classList.remove("hidden");
        weekSelect.disabled = true;
        document.getElementById("export-pdf").disabled = true;
        const feuilleDeGardeLink = document.querySelector("a[href='feuille_de_garde.html']");
        if (feuilleDeGardeLink) {
            feuilleDeGardeLink.classList.add("disabled");
        }
        tabButtons.forEach(btn => btn.disabled = true);

        if (forPdf) {
            adminInfo.textContent = "Génération du PDF en cours, veuillez patienter...";
            adminInfo.style.backgroundColor = "#fff3cd";
            adminInfo.style.borderColor = "#ffeeba";
            adminInfo.style.color = "#856404";
        }
    } else {
        loadingSpinner.classList.add("hidden");
        weekSelect.disabled = false;
        document.getElementById("export-pdf").disabled = false;
        const feuilleDeGardeLink = document.querySelector("a[href='feuille_de_garde.html']");
        if (feuilleDeGardeLink) {
            feuilleDeGardeLink.classList.remove("disabled");
        }
        tabButtons.forEach(btn => btn.disabled = false);

        if (forPdf) {
            adminInfo.textContent = "Vue du planning global des agents.";
            adminInfo.style.backgroundColor = "";
            adminInfo.style.borderColor = "";
            adminInfo.style.color = "";
        }
    }
}

document.getElementById("export-pdf").addEventListener("click", async () => {
  const container = document.getElementById("global-planning");
  const table = container.querySelector('.planning-table'); // Récupère la table directement

  if (!table) {
    alert("La table de planning est introuvable. Impossible d'exporter.");
    return;
  }

  // Stocke les styles originaux
  const originalContainerOverflowX = container.style.overflowX;
  const originalContainerWidth = container.style.width;
  const originalContainerMaxWidth = container.style.maxWidth;
  
  // Stocke les styles originaux de la table (si nécessaire)
  const originalTableWidth = table.style.width;
  const originalTableWhiteSpace = table.style.whiteSpace;


  showLoading(true, true);

  try {
    // Applique des styles temporaires pour que la table ne déborde pas
    // et que html2canvas puisse la "voir" en entier.
    // L'overflow-x est crucial pour que html2canvas rende la partie cachée
    // sans la barre de défilement visible.
    container.style.overflowX = "visible"; 
    // container.style.width et maxWidth peuvent être maintenus,
    // l'important est que la table elle-même soit visible ou gérée.
    // Pour la table, on s'assure qu'elle ne force pas de retour à la ligne
    table.style.whiteSpace = "nowrap"; // Empêche les cellules de revenir à la ligne, forçant la largeur
    // Récupère la largeur réelle du tableau après avoir appliqué les styles temporaires
    const tableActualWidth = table.offsetWidth;
    const tableActualHeight = table.offsetHeight;

    // Définir une limite de largeur pour html2canvas (ex: 10000px, une valeur courante et sûre)
    // Au-delà de cela, html2canvas commence à avoir des problèmes.
    const MAX_CANVAS_WIDTH = 8000; // Augmenté un peu, mais soyez conscient des limites.
                                  // Certains navigateurs peuvent aller jusqu'à 16384, mais 8000 est plus sûr.
    const MAX_CANVAS_HEIGHT = 8000; // Aussi important, surtout si vous avez beaucoup d'agents.

    let scale = 1;
    // Si la largeur actuelle du tableau dépasse la limite max du canvas, on calcule une échelle
    if (tableActualWidth > MAX_CANVAS_WIDTH) {
        scale = MAX_CANVAS_WIDTH / tableActualWidth;
    }
    // Assurez-vous que l'échelle ne rend pas la hauteur trop grande non plus
    if (tableActualHeight * scale > MAX_CANVAS_HEIGHT) {
        scale = MAX_CANVAS_HEIGHT / tableActualHeight;
    }
    // On peut aussi fixer une échelle minimale pour que le rendu ne soit pas trop pixellisé
    if (scale < 0.5) { // Empêche l'échelle de devenir trop petite, compromettant la lisibilité
        console.warn("L'échelle calculée est très petite. Le contenu pourrait être illisible. Envisagez de diviser le planning.");
        // scale = 0.5; // Vous pouvez choisir de fixer une valeur minimale ici
    }

    console.log(`Table width: ${tableActualWidth}px, Table height: ${tableActualHeight}px`);
    console.log(`Calculated scale for html2canvas: ${scale}`);


    // Petit délai pour permettre au navigateur de rendre les changements de style
    await new Promise(r => setTimeout(r, 100));

    const { jsPDF } = window.jspdf;

    const year = new Date().getFullYear();
    const mondayDate = getMondayOfWeek(currentWeek, year);
    const sundayDate = new Date(mondayDate);
    sundayDate.setDate(mondayDate.getDate() + 6);

    function formatDate(d) {
      return d.getDate().toString().padStart(2, '0') + '/' + (d.getMonth() + 1).toString().padStart(2, '0');
    }
    const title = `Planning Semaine ${currentWeek} du ${formatDate(mondayDate)} au ${formatDate(sundayDate)}`;

    // Capture la table directement, pas le conteneur #global-planning
    const canvas = await html2canvas(table, { // Cible la TABLE elle-même
      scale: scale, // Utilise l'échelle calculée dynamiquement
      scrollY: -window.scrollY, // Conserve le scroll
      useCORS: true,
      allowTaint: true,
      // background: '#ffffff', // Optionnel: force un fond blanc si des zones transparentes posent problème
      // logging: true // Décommentez pour plus de logs de html2canvas
    });

    const imgData = canvas.toDataURL("image/png");

    // --- LOGS DE DÉBOGAGE AJOUTÉS ICI ---
    console.log("--- Début du diagnostic html2canvas ---");
    console.log("Longueur de imgData :", imgData.length);
    console.log("Début de imgData :", imgData.substring(0, 100)); // Affiche les 100 premiers caractères
    if (imgData.length < 500) { // Une dataURL PNG valide devrait être bien plus longue que 50 caractères
        console.error("imgData semble être trop courte ou vide. Problème probable de capture html2canvas.");
        throw new Error("La capture visuelle du planning a échoué. L'image est vide ou corrompue.");
    }
    console.log("Canvas width:", canvas.width, "Canvas height:", canvas.height);
    console.log("--- Fin du diagnostic html2canvas ---");
    // ------------------------------------

    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a3" // A3 est un bon choix pour un planning large
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;

    const imgProps = pdf.getImageProperties(imgData);
    let pdfWidth = pageWidth - 2 * margin;
    let pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

    // S'assurer que l'image tient sur la page en hauteur également
    if (pdfHeight > pageHeight - (2 * margin + 30)) { // 30mm pour les titres
        pdfHeight = pageHeight - (2 * margin + 30);
        pdfWidth = (imgProps.width * pdfHeight) / imgProps.height;
    }

    const x = (pageWidth - pdfWidth) / 2;
    const y = margin + 25; // Espace pour les titres

    pdf.setFontSize(18);
    pdf.text(title, margin, margin + 5);
    pdf.setFontSize(14);
    pdf.text(`Jour : ${currentDay.charAt(0).toUpperCase() + currentDay.slice(1)}`, margin, margin + 12);
    
    // Ajoutez une note si l'échelle est basse pour indiquer que le contenu est compressé
    if (scale < 0.8) { // Si l'échelle est inférieure à 80%
        pdf.setFontSize(8);
        pdf.setTextColor(100); // Couleur grise
        pdf.text("Note: Le planning a été ajusté pour tenir sur la page. Certains détails peuvent apparaître plus petits.", margin, margin + 18);
        pdf.setTextColor(0); // Réinitialiser la couleur pour le contenu principal
    }


    pdf.addImage(imgData, "PNG", x, y, pdfWidth, pdfHeight);

    pdf.save(`planning_${currentDay}_semaine${currentWeek}.pdf`);
    alert("Le PDF a été généré avec succès !");

  } catch (error) {
    console.error("Erreur lors de l'export PDF:", error);
    alert("Une erreur est survenue lors de la génération du PDF. Veuillez réessayer ou contacter l'administrateur. Détails: " + error.message);
  } finally {
    // Rétablit les styles originaux
    container.style.overflowX = originalContainerOverflowX;
    container.style.width = originalContainerWidth;
    container.style.maxWidth = originalContainerMaxWidth;

    table.style.width = originalTableWidth; // Rétablit la largeur originale de la table
    table.style.whiteSpace = originalTableWhiteSpace; // Rétablit le white-space original

    showLoading(false, true);
  }
});

// Petite fonction utilitaire pour getMondayOfWeek utilisée par l'export PDF
function getMondayOfWeek(weekNum, year) {
  const simple = new Date(year, 0, 1 + (weekNum - 1) * 7);
  const dow = simple.getDay();
  if (dow <= 4) simple.setDate(simple.getDate() - dow + 1);
  else simple.setDate(simple.getDate() + 8 - dow);
  return simple;
}