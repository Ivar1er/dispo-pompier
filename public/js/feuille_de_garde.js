// --------------------------------------------------
// 1️⃣ Constantes & Helpers
// --------------------------------------------------

// URL de l’API
const API_BASE_URL = "https://dispo-pompier.onrender.com";

// Créneaux de 07:00→07:00 sur 24h (30 min)
const horaires = [];
const startHourDisplay = 7;
for (let i = 0; i < 48; i++) {
  const h1 = (startHourDisplay + Math.floor(i/2)) % 24;
  const m1 = (i % 2) * 30;
  const h2 = (startHourDisplay + Math.floor((i+1)/2)) % 24;
  const m2 = ((i+1) % 2) * 30;
  horaires.push(
    `${String(h1).padStart(2,'0')}:${String(m1).padStart(2,'0')} - ` +
    `${String(h2).padStart(2,'0')}:${String(m2).padStart(2,'0')}`
  );
}

// Rôles attendus par type d’engin
const engineRoles = {
  FPT:  ['CA_FPT','COD1','EQ1_FPT','EQ2_FPT'],
  CCF:  ['CA_FDF2','COD2','EQ1_FDF1','EQ2_FDF1'],
  VSAV: ['CA_VSAV','COD0','EQ'], // EQ est un rôle générique pour équipier
  VTU:  ['CA_VTU','COD0','EQ'],
  VPMA: ['CA_VPMA','COD0','EQ']
};

// Mappage des rôles d'engin vers les qualifications réelles des agents
// IMPORTANT: Ajustez ceci si vos qualifications ont des noms différents
const roleToQualificationMap = {
    'CA_FPT': 'ca_fpt',
    'COD1': 'cod_1',
    'EQ1_FPT': 'eq1_fpt',
    'EQ2_FPT': 'eq2_fpt',
    'CA_FDF2': 'ca_ccf', // Supposition: FDF2 correspond à ca_ccf
    'COD2': 'cod_2',
    'EQ1_FDF1': 'eq1_ccf', // Supposition
    'EQ2_FDF1': 'eq2_ccf', // Supposition
    'CA_VSAV': 'ca_vsav',
    'COD0': 'cod_0',
    'EQ': 'eq_generique' // Ce rôle générique peut correspondre à plusieurs qualifications d'équipier
    // Pour 'EQ', on vérifiera si l'agent a n'importe quelle qualification d'équipier spécifique
    // comme 'eq_vsav', 'eq_vtu', 'eq_vpma', 'eq1_fpt', 'eq2_fpt', 'eq1_ccf', 'eq2_ccf'
};
const genericEqQualifications = [
    'eq_vsav', 'eq_vtu', 'eq_vpma', 'eq1_fpt', 'eq2_fpt', 'eq1_ccf', 'eq2_ccf'
];


// Références DOM
const rosterDateInput        = document.getElementById('roster-date');
const prevDayButton          = document.getElementById('prev-day-button');
const nextDayButton          = document.getElementById('next-day-button');
const generateAutoBtn        = document.getElementById('generate-auto-btn');
const availablePersonnelList = document.getElementById('available-personnel-list');
const onDutyAgentsGrid       = document.getElementById('on-duty-agents-grid');
const rosterGridContainer    = document.getElementById('roster-grid');
const engineDetailsPage      = document.getElementById('engine-details-page');
const backToRosterBtn        = document.getElementById('back-to-roster-btn');
const loadingSpinner         = document.getElementById('loading-spinner');

// NOUVEAU: Références DOM pour la modale d'affectation
const personnelAssignmentModal        = document.getElementById('personnel-assignment-modal');
const closePersonnelAssignmentModalBtn = document.getElementById('close-personnel-assignment-modal-btn');
const personnelAssignmentModalTitle   = document.getElementById('personnel-assignment-modal-title');
const availableAgentsInModalList      = document.getElementById('available-agents-in-modal-list');
const engineRolesContainer            = document.getElementById('engine-roles-container');


// États globaux
let currentRosterDate = new Date();
let allAgents         = [];
let appData           = { personnelAvailabilities: {} };

// Helpers
function formatDateToYYYYMMDD(d) {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}` +
         `-${String(dt.getDate()).padStart(2,'0')}`;
}
function parseTimeToMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Vérifie si deux plages horaires se chevauchent.
 * Gère le cas où une plage traverse minuit.
 * @param {{start: string, end: string}} r1 - Première plage horaire { "HH:MM", "HH:MM" }
 * @param {{start: string, end: string}} r2 - Deuxième plage horaire { "HH:MM", "HH:MM" }
 * @returns {boolean} True si les plages se chevauchent, False sinon.
 */
function doTimeRangesOverlap(r1, r2) {
    let s1 = parseTimeToMinutes(r1.start);
    let e1 = parseTimeToMinutes(r1.end);
    let s2 = parseTimeToMinutes(r2.start);
    let e2 = parseTimeToMinutes(r2.end);

    const totalDayMinutes = 24 * 60;

    // Si une plage traverse minuit, "l'étendre" sur 48h pour faciliter la comparaison.
    // Ex: 22:00 - 02:00 devient 22:00 - 26:00
    if (e1 <= s1) e1 += totalDayMinutes;
    if (e2 <= s2) e2 += totalDayMinutes;

    // Un chevauchement existe si :
    // (start1 < end2) ET (end1 > start2)
    return s1 < e2 && e1 > s2;
}

/**
 * Calcule la largeur et la position d'un segment de disponibilité sur une barre de 24h,
 * avec une journée qui commence à 07:00 et se termine à 07:00 le lendemain.
 * @param {string} startTime - Heure de début (HH:MM).
 * @param {string} endTime - Heure de fin (HH:MM).
 * @returns {Array<Object>} Un tableau d'objets { left: %, width: % } pour gérer les plages qui passent minuit.
 */
function getAvailabilitySegments(startTime, endTime) {
    const startHourOffset = 7 * 60; // 7h en minutes (la nouvelle origine de la journée 0%)
    const totalDayMinutes = 24 * 60; // 1440 minutes pour une journée complète

    let startMinutes = parseTimeToMinutes(startTime);
    let endMinutes = parseTimeToMinutes(endTime);

    // Normaliser les minutes pour la journée de 07:00 à 07:00
    // On décale toutes les heures de 7 heures en arrière pour que 07:00 soit 0 minutes, 08:00 soit 60 minutes, etc.
    startMinutes = (startMinutes - startHourOffset + totalDayMinutes) % totalDayMinutes;
    endMinutes = (endMinutes - startHourOffset + totalDayMinutes) % totalDayMinutes;

    const segments = [];

    // Si la plage de temps est de durée nulle (ex: 07:00 - 07:00, qui est la nouvelle "minuit")
    // Cela indique une disponibilité sur 24h sur ce fuseau visuel.
    if (startMinutes === endMinutes) {
        segments.push({ left: 0, width: 100 });
        return segments;
    }

    // Cas simple: la plage ne traverse pas la "nouvelle minuit" (07:00)
    // Ex: 08:00-17:00 (heure réelle) => 01:00-10:00 (heures décalées). Ici endMinutes > startMinutes
    if (endMinutes > startMinutes) {
        const left = (startMinutes / totalDayMinutes) * 100;
        const width = ((endMinutes - startMinutes) / totalDayMinutes) * 100;
        segments.push({ left, width });
    }
    // Cas complexe: la plage traverse la "nouvelle minuit" (07:00)
    // Ex: 04:00-09:00 (heure réelle) => 21:00-02:00 (heures décalées). Ici endMinutes < startMinutes
    else {
        // Segment de la "nouvelle origine" (07:00, ou 0 minutes décalées) jusqu'à la fin de la journée décalée (06:59 le lendemain, ou 1439 minutes décalées)
        const left1 = (startMinutes / totalDayMinutes) * 100;
        const width1 = ((totalDayMinutes - startMinutes) / totalDayMinutes) * 100;
        segments.push({ left: left1, width: width1 });

        // Segment du début de la journée décalée (07:00 du lendemain) jusqu'à la fin de la plage
        const left2 = 0; // Commence à la nouvelle origine
        const width2 = (endMinutes / totalDayMinutes) * 100;
        segments.push({ left: left2, width: width2 });
    }
    return segments;
}


function createEmptyEngineAssignment(type) {
  const pers = {};
  (engineRoles[type] || []).forEach(role => pers[role] = 'none');
  return { personnel: pers };
}

/**
 * Affiche le spinner de chargement.
 */
function showSpinner() {
  loadingSpinner.classList.remove('hidden');
}

/**
 * Cache le spinner de chargement.
 */
function hideSpinner() {
  loadingSpinner.classList.add('hidden');
}

// --------------------------------------------------
// 2️⃣ Chargement des données
// --------------------------------------------------

async function fetchAllAgents() {
  try {
    const resp = await fetch(`${API_BASE_URL}/api/admin/agents`, {
      headers: {'X-User-Role':'admin'}
    });
    if (!resp.ok) throw new Error(`HTTP error! status: ${resp.status}`);
    allAgents = await resp.json();
    // Ajustement du log pour refléter prenom et nom
    console.log("DEBUG: Agents chargés:", allAgents.map(a => ({ _id: a._id, prenom: a.prenom, nom: a.nom, qualifications: a.qualifications })));
  } catch (error) {
    console.error("Erreur lors du chargement des agents:", error);
    allAgents = []; // Assurez-vous que c'est un tableau vide en cas d'échec
  }
}

async function loadRosterConfig(dateKey) {
  try {
    const resp = await fetch(`${API_BASE_URL}/api/admin/roster-config/${dateKey}`, {
      headers: {'X-User-Role':'admin'}
    });
    if (!resp.ok) {
        if (resp.status === 404) {
            // Si la config n'existe pas, initialiser une nouvelle config par défaut
            appData[dateKey] = {
                timeSlots: {},
                onDutyAgents: Array(10).fill('none')
            };
            initializeDefaultTimeSlotsForDate(dateKey, true); // Force la création si 404
            console.log("Nouvelle configuration de feuille de garde initialisée pour", dateKey);
            return;
        }
        throw new Error(`HTTP error! status: ${resp.status}`);
    }
    appData[dateKey] = await resp.json();
    console.log("DEBUG: Roster config chargée pour", dateKey, ":", appData[dateKey]); // Pour le débogage
  } catch (error) {
    console.error("Erreur lors du chargement de la configuration du roster:", error);
    // Fallback: initialiser une configuration vide en cas d'erreur grave
    appData[dateKey] = {
      timeSlots: {},
      onDutyAgents: Array(10).fill('none')
    };
    initializeDefaultTimeSlotsForDate(dateKey, true);
  }
}


async function saveRosterConfig(dateKey) {
  try {
    const resp = await fetch(`${API_BASE_URL}/api/admin/roster-config/${dateKey}`, {
      method: 'POST',
      headers: {
        'Content-Type':'application/json',
        'X-User-Role':'admin'
      },
      body: JSON.stringify(appData[dateKey])
    });
    if (!resp.ok) {
        const errorText = await resp.text(); // Capture le texte de l'erreur du serveur
        throw new Error(`HTTP error! status: ${resp.status}, message: ${errorText}`);
    }
    console.log("DEBUG: Roster config sauvegardée pour", dateKey); // Pour le débogage
  } catch (error) {
    console.error("Erreur lors de la sauvegarde de la configuration du roster:", error);
  }
}

async function loadDailyRoster(dateKey) {
  try {
    const resp = await fetch(`${API_BASE_URL}/api/admin/daily-roster/${dateKey}`, {
      headers: {'X-User-Role':'admin'},
      credentials: 'include'
    });
    if (!resp.ok) {
      if (resp.status === 404) {
        console.warn("Daily roster non trouvé pour", dateKey, ". Utilisation de la configuration par défaut.");
        return; // Ce n'est pas une erreur si c'est vide
      }
      throw new Error(`HTTP error! status: ${resp.status}`);
    }
    const dr = await resp.json();
    if (dr && dr.onDutyAgents) {
      appData[dateKey].onDutyAgents = dr.onDutyAgents;
    }
    console.log("DEBUG: Daily roster chargé pour", dateKey, ":", dr); // Pour le débogage
  } catch (error) {
    console.error('loadDailyRoster échoué', error);
  }
}

async function saveDailyRoster(dateKey) {
  try {
    console.log(`Sending save request for daily roster ${dateKey} with data:`, { onDutyAgents: appData[dateKey].onDutyAgents });
    const resp = await fetch(`${API_BASE_URL}/api/admin/daily-roster/${dateKey}`, {
      method: 'POST',
      headers: {
        'Content-Type':'application/json',
        'X-User-Role':'admin'
      },
      credentials: 'include',
      body: JSON.stringify({ onDutyAgents: appData[dateKey].onDutyAgents })
    });
    if (!resp.ok) {
      const errorText = await resp.text(); // Capture le texte de l'erreur du serveur
      throw new Error(`HTTP error! status: ${resp.status}, message: ${errorText}`);
    }
    console.log("DEBUG: Daily roster sauvegardé pour", dateKey); // Pour le débogage
  } catch (error) {
    console.error('saveDailyRoster échoué:', error);
  }
}

// Variable globale pour stocker les noms des jours en français
const DAYS_OF_WEEK_FR = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

// --- NOUVELLE FONCTION POUR OBTENIR LE NUMÉRO DE SEMAINE ET LE NOM DU JOUR ---
function getWeekAndDayFromDate(dateString) {
    const date = new Date(dateString + 'T12:00:00'); // Ajout de 'T12:00:00' pour éviter les problèmes de fuseau horaire
    date.setHours(0, 0, 0, 0); // Réinitialiser l'heure pour éviter les décalages si le jour change à minuit local.

    // Calcul du numéro de semaine ISO 8601 (où la semaine 1 contient le 4 janvier)
    const dayNr = (date.getDay() + 6) % 7; // Lundi est 0, Dimanche est 6
    date.setDate(date.getDate() - dayNr + 3); // Aller au jeudi de la semaine courante
    const firstThursday = date.valueOf(); // Timestamp du jeudi
    date.setMonth(0, 1); // Aller au 1er janvier
    if (date.getDay() !== 4) { // Si le 1er janvier n'est pas un jeudi
        date.setMonth(0, 1 + ((4 - date.getDay()) + 7) % 7); // Aller au premier jeudi de janvier
    }
    const weekNo = 1 + Math.ceil((firstThursday - date) / 604800000); // 604800000 ms = 7 jours

    const dayName = DAYS_OF_WEEK_FR[new Date(dateString + 'T12:00:00').getDay()]; // Utiliser la date originale pour le nom du jour

    return { weekNo: `week-${weekNo}`, dayName: dayName };
}

// --- MODIFICATION DE loadAllPersonnelAvailabilities ---
async function loadAllPersonnelAvailabilities() {
  try {
    const resp = await fetch(`${API_BASE_URL}/api/planning`, {
      headers: {'X-User-Role':'admin'}
    });
    if (!resp.ok) throw new Error(`HTTP error! status: ${resp.status}`);
    
    const rawData = await resp.json(); // Réponse de l'API (avec week-XX et jour de la semaine)
    
    // Initialiser la structure attendue par le frontend
    appData.personnelAvailabilities = {}; 

    // Date clé actuelle pour laquelle nous voulons les disponibilités
    const dateKey = formatDateToYYYYMMDD(currentRosterDate);
    const { weekNo: currentWeekNo, dayName: currentDayName } = getWeekAndDayFromDate(dateKey);

    // Parcourir les données brutes et les transformer
    for (const agentKey in rawData) { // agentKey sera "bruneaum", "gesbertj", etc. (vos "_id")
        const agentAvailabilitiesByWeek = rawData[agentKey]; // ex: { "week-24": { "dimanche": [...] } }
        
        // CORRECTION ICI : Trouvez l'agent directement par son _id, car agentKey est déjà l'ID.
        const agentInAllAgents = allAgents.find(a => a._id === agentKey);
        
        if (!agentInAllAgents) {
            console.warn(`Agent avec la clé '${agentKey}' (issu de /api/planning) non trouvé dans la liste des agents (allAgents). Cet agent sera ignoré.`);
            // Ajustement du log pour refléter prenom et nom
            console.log("DEBUG: allAgents content for comparison:", allAgents.map(a => ({ _id: a._id, prenom: a.prenom, nom: a.nom })));
            continue; // Passer cet agent s'il n'est pas reconnu
        }
        const agentId = agentInAllAgents._id; // On utilise l'ID réel de l'agent pour la structure finale
        
        appData.personnelAvailabilities[agentId] = appData.personnelAvailabilities[agentId] || {};

        for (const weekKey in agentAvailabilitiesByWeek) { // ex: "week-24"
            const dailyData = agentAvailabilitiesByWeek[weekKey]; // ex: { "dimanche": [...] }
            for (const dayName in dailyData) { // ex: "dimanche"
                const timeRanges = dailyData[dayName]; // ex: ["07:00 - 07:30", ...]
                
                // On ne stocke les disponibilités que si la semaine et le jour correspondent à la date courante.
                if (weekKey === currentWeekNo && dayName === currentDayName) {
                    // Convertir les chaînes de temps en objets {start: "HH:MM", end: "HH:MM"}
                    const formattedRanges = timeRanges.map(range => {
                        const [start, end] = range.split(' - ');
                        return { start, end };
                    });
                    appData.personnelAvailabilities[agentId][dateKey] = formattedRanges;
                }
            }
        }
    }
    
    console.log("DEBUG: appData.personnelAvailabilities après transformation (pour la date courante):", appData.personnelAvailabilities);

  } catch (error) {
    console.error("Erreur lors du chargement des disponibilités du personnel (API /api/planning):", error);
    appData.personnelAvailabilities = {}; // Réinitialiser en cas d'erreur
  }
}

async function loadInitialData() {
  showSpinner();
  const dateKey = formatDateToYYYYMMDD(currentRosterDate);
  await fetchAllAgents(); // Chargez tous les agents avant de charger les configs
  await loadRosterConfig(dateKey); // Charge ou initialise la config de la date
  await loadAllPersonnelAvailabilities(); // Charge et transforme les dispos
  await loadDailyRoster(dateKey); // Charge le daily roster (agents d'astreinte)
  hideSpinner();
}

// --------------------------------------------------
// 3️⃣ Rendu & mise à jour de l’affichage
// --------------------------------------------------

function initializeDefaultTimeSlotsForDate(dateKey, force = false) {
  if (!appData[dateKey]) {
    appData[dateKey] = {
      timeSlots: {},
      onDutyAgents: Array(10).fill('none') // Initialise 10 slots vides pour les astreintes
    };
  }
  // Ne créer le créneau par défaut que s'il n'y en a aucun OU si force est vrai (ex: après un 404)
  if (Object.keys(appData[dateKey].timeSlots).length === 0 || force) {
    const id = `slot_0700_0700_${Date.now()}`;
    appData[dateKey].timeSlots[id] = {
      range: '07:00 - 07:00',
      engines: {}
    };
    Object.keys(engineRoles).forEach(et => {
      appData[dateKey].timeSlots[id].engines[et] =
        createEmptyEngineAssignment(et);
    });
  }
}


function renderTimeSlotButtons(dateKey) {
  const c = document.getElementById('time-slot-buttons-container');
  c.innerHTML = '';

  let clickTimeout = null;
  const DBLCLICK_DELAY = 300;

  // bouton “+”
  const add = document.createElement('button');
  add.textContent = '+';
  add.classList.add('add-time-slot-btn');
  add.addEventListener('click', () => {
    showTimeRangeSelectionModal('07:00', '07:00', async (ns, ne) => {
      const id = `slot_${ns.replace(':','')}_${ne.replace(':','')}_${Date.now()}`;
      appData[dateKey].timeSlots[id] = {
        range: `${ns} - ${ne}`,
        engines: {}
      };
      Object.keys(engineRoles).forEach(et => {
        appData[dateKey].timeSlots[id].engines[et] =
          createEmptyEngineAssignment(et);
      });
      await saveRosterConfig(dateKey);
      renderTimeSlotButtons(dateKey);
      renderRosterGrid();
      showMainRosterGrid();
    });
  });
  c.appendChild(add);

  // boutons existants
  Object.entries(appData[dateKey].timeSlots)
    .sort((a,b)=> {
      const sA = parseTimeToMinutes(a[1].range.split(' - ')[0]);
      const sB = parseTimeToMinutes(b[1].range.split(' - ')[0]);
      return sA - sB;
    })
    .forEach(([slotId, slot]) => {
      const btn = document.createElement('button');
      btn.textContent = slot.range;
      btn.classList.add('time-slot-button');
      btn.dataset.slotId = slotId;

      btn.addEventListener('click', () => {
        clearTimeout(clickTimeout);

        clickTimeout = setTimeout(() => {
          document.querySelectorAll('.time-slot-button').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          displayEnginesForSlot(dateKey, slotId);
        }, DBLCLICK_DELAY);
      });

      btn.addEventListener('dblclick', async (event) => {
        event.stopPropagation();
        clearTimeout(clickTimeout);
        
        const [cs, ce] = slot.range.split(' - ');
        showTimeRangeSelectionModal(cs, ce, async (ns, ne) => {
          slot.range = `${ns} - ${ne}`;
          await saveRosterConfig(dateKey);

          let sMin = parseTimeToMinutes(ns),
              eMin = parseTimeToMinutes(ne);
          if (eMin <= sMin) eMin += 24*60;
          const dayEndMinutes = parseTimeToMinutes('07:00') + 24*60;

          if (eMin < dayEndMinutes && ns !== ne) {
            const newSlotStartTime = ne;
            const newSlotEndTime = '07:00';

            const newSlotId = `slot_${newSlotStartTime.replace(':','')}_${newSlotEndTime.replace(':','')}_${Date.now()}`;
            
            const slotExists = Object.values(appData[dateKey].timeSlots).some(s => {
                const [existingStart, existingEnd] = s.range.split(' - ');
                return existingStart === newSlotStartTime && existingEnd === newSlotEndTime;
            });

            if (!slotExists) {
                appData[dateKey].timeSlots[newSlotId] = {
                    range: `${newSlotStartTime} - ${newSlotEndTime}`,
                    engines: {}
                };
                Object.keys(engineRoles).forEach(et => {
                    appData[dateKey].timeSlots[newSlotId].engines[et] = createEmptyEngineAssignment(et);
                });
                await saveRosterConfig(dateKey);
            }
          }
          renderTimeSlotButtons(dateKey);
          renderRosterGrid();
          showMainRosterGrid();
        });
      });

      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = 'x';
      deleteBtn.classList.add('delete-time-slot-btn');
      deleteBtn.addEventListener('click', async (event) => {
        event.stopPropagation();
        if (confirm(`Voulez-vous vraiment supprimer le créneau ${slot.range} ?`)) {
          delete appData[dateKey].timeSlots[slotId];
          await saveRosterConfig(dateKey);
          renderTimeSlotButtons(dateKey);
          renderRosterGrid();
          showMainRosterGrid();
        }
      });
      btn.appendChild(deleteBtn);

      c.appendChild(btn);
    });
}

function renderRosterGrid() {
  rosterGridContainer.innerHTML = '';

  const dateKey = formatDateToYYYYMMDD(currentRosterDate);
  const currentConfig = appData[dateKey];

  if (!currentConfig || Object.keys(currentConfig.timeSlots).length === 0) {
    rosterGridContainer.innerHTML = '<p class="loading-message">Aucun créneau horaire configuré pour cette date.</p>';
    return;
  }

  const table = document.createElement('table');
  table.classList.add('roster-table');

  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  headerRow.innerHTML = '<th>Créneau Horaire</th>';

  Object.keys(engineRoles).forEach(engineType => {
    const th = document.createElement('th');
    th.textContent = engineType;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  const sortedTimeSlots = Object.entries(currentConfig.timeSlots).sort((a, b) => {
    const sA = parseTimeToMinutes(a[1].range.split(' - ')[0]);
    const sB = parseTimeToMinutes(b[1].range.split(' - ')[0]);
    return sA - sB;
  });

  sortedTimeSlots.forEach(([slotId, slot]) => {
    const row = document.createElement('tr');
    const timeCell = document.createElement('td');
    timeCell.textContent = slot.range;
    row.appendChild(timeCell);

    Object.keys(engineRoles).forEach(engineType => {
      const engineCell = document.createElement('td');
      engineCell.classList.add('roster-cell');
      engineCell.dataset.slotId = slotId;
      engineCell.dataset.engineType = engineType;

      const assignedEngine = slot.engines[engineType];
      if (assignedEngine && assignedEngine.personnel) {
        const ul = document.createElement('ul');
        ul.classList.add('engine-personnel-list');
        Object.entries(assignedEngine.personnel).forEach(([role, agentId]) => {
          const agent = allAgents.find(a => a._id === agentId);
          // MODIFICATION: Créer l'élément li avant de l'utiliser
          const li = document.createElement('li'); // <-- Ligne ajoutée
          // Utilisation de prenom et nom
          li.textContent = `${role}: ${agent && agentId !== 'none' ? `${agent.prenom} ${agent.nom}` : 'Non affecté'}`;
          ul.appendChild(li);
        });
        engineCell.appendChild(ul);
      } else {
        engineCell.textContent = 'Non configuré';
      }

      engineCell.addEventListener('dragover', handleDragOver);
      engineCell.addEventListener('dragleave', handleDragLeave);
      engineCell.addEventListener('drop', handleDropOnEngine);

      row.appendChild(engineCell);
    });
    tbody.appendChild(row);
  });
  table.appendChild(tbody);

  rosterGridContainer.appendChild(table);
  document.querySelector('.loading-message')?.remove();
}

function renderPersonnelLists() {
    availablePersonnelList.innerHTML = '';
    const dateKey = formatDateToYYYYMMDD(currentRosterDate);
    const onDutyAgents = appData[dateKey]?.onDutyAgents || Array(10).fill('none');

    const filteredAvailableAgents = allAgents.filter(agent => {
        const isAlreadyOnDuty = onDutyAgents.includes(agent._id);
        if (isAlreadyOnDuty) return false;

        const agentAvailabilities = appData.personnelAvailabilities[agent._id] || {};
        const dailyAvailabilities = agentAvailabilities[dateKey] || [];
        
        // Un agent est considéré "disponible" s'il n'est pas d'astreinte ET a des disponibilités renseignées
        const hasAnyAvailability = dailyAvailabilities.length > 0;
        
        return hasAnyAvailability;
    });

    if (filteredAvailableAgents.length === 0) {
        availablePersonnelList.innerHTML = '<p class="no-available-personnel">Aucun agent disponible avec des disponibilités renseignées pour cette journée.</p>';
    }

    filteredAvailableAgents.forEach(agent => {
        const item = document.createElement('div');
        item.classList.add('available-personnel-item');
        item.innerHTML = `
            <div class="agent-info">
                <span class="agent-name">${agent.prenom} ${agent.nom || 'Agent Inconnu'}</span>
            </div>
            <div class="availability-bar-wrapper">
                <div class="availability-bar">
                    <div class="availability-base-bar"></div>
                </div>
                <div class="time-legend">
                    <span>07:00</span>
                    <span>13:00</span>
                    <span>19:00</span>
                    <span>01:00</span>
                    <span>07:00</span>
                </div>
            </div>
        `;
        
        item.dataset.agentId = agent._id;
        item.setAttribute('draggable', true);
        item.addEventListener('dragstart', handleDragStart);

        const availabilityBarBase = item.querySelector('.availability-base-bar');
        const agentAvailabilities = appData.personnelAvailabilities[agent._id] || {};
        const dailyAvailabilities = agentAvailabilities[dateKey] || [];

        dailyAvailabilities.forEach(range => {
            const segments = getAvailabilitySegments(range.start, range.end);
            segments.forEach(segment => {
                const highlightSegment = document.createElement('div');
                highlightSegment.classList.add('availability-highlight-segment', 'available'); // Toujours "available" pour la liste des disponibles
                highlightSegment.style.left = `${segment.left}%`;
                highlightSegment.style.width = `${segment.width}%`;
                
                // Amélioration du tooltip
                highlightSegment.dataset.fullRange = `${range.start} - ${range.end}`; // Stocke la plage complète pour le survol
                highlightSegment.title = `Disponible: ${range.start} - ${range.end}`;
                
                availabilityBarBase.appendChild(highlightSegment);
            });
        });
        
        item.appendChild(createTooltipForAvailabilityBar(dailyAvailabilities)); // Ajoute le tooltip global

        availablePersonnelList.appendChild(item);
    });
}

function renderOnDutyAgentsGrid() {
    onDutyAgentsGrid.innerHTML = '';
    const dateKey = formatDateToYYYYMMDD(currentRosterDate);
    const onDutyAgents = appData[dateKey]?.onDutyAgents || Array(10).fill('none');

    for (let i = 0; i < 10; i++) {
        const slot = document.createElement('div');
        slot.classList.add('on-duty-slot');
        slot.dataset.slotIndex = i;
        slot.addEventListener('dragover',  handleDragOver);
        slot.addEventListener('dragleave', handleDragLeave);
        slot.addEventListener('drop',      handleDropOnDuty);

        const agentId = onDutyAgents[i];
        if (agentId && agentId !== 'none') {
            const agent = allAgents.find(a => a._id === agentId);
            if (agent) {
                slot.classList.add('filled');
                slot.dataset.agentId = agent._id;
                slot.setAttribute('draggable', true);
                slot.addEventListener('dragstart', handleDragStart);

                slot.innerHTML = `
                    <div class="agent-info">
                        <span class="agent-name">${agent.prenom} ${agent.nom || 'Agent Inconnu'}</span>
                    </div>
                    <div class="availability-bar-wrapper">
                        <div class="availability-bar">
                            <div class="availability-base-bar"></div>
                        </div>
                        <div class="time-legend">
                            <span>07:00</span>
                            <span>13:00</span>
                            <span>19:00</span>
                            <span>01:00</span>
                            <span>07:00</span>
                        </div>
                    </div>
                    <button class="remove-agent-btn">x</button>
                `;

                const availabilityBarBase = slot.querySelector('.availability-base-bar');
                const agentAvailabilities = appData.personnelAvailabilities[agent._id] || {};
                const dailyAvailabilities = agentAvailabilities[dateKey] || [];

                // Créer une liste de toutes les plages de 30 minutes
                const fullDayMinutes = 24 * 60; // 1440 minutes
                const thirtyMinInterval = 30;
                
                // Définir la "vraie" plage de référence de la journée pour le calcul des pourcentages
                const dayStartOffsetMinutes = 7 * 60; // La journée visuelle commence à 7h

                for (let k = 0; k < (fullDayMinutes / thirtyMinInterval); k++) {
                    // Calculer l'heure de début et de fin de l'intervalle de 30 minutes
                    let intervalStartMin = (dayStartOffsetMinutes + k * thirtyMinInterval) % fullDayMinutes;
                    let intervalEndMin = (dayStartOffsetMinutes + (k + 1) * thirtyMinInterval) % fullDayMinutes;

                    // Si l'intervalle traverse minuit (ici 07h si la journée est 07h-07h), ajuster endMin
                    // Ceci est pour la comparaison avec doTimeRangesOverlap qui attend une plage "linéaire"
                    // mais les valeurs HH:MM restent standard.
                    let comparisonIntervalEndMin = intervalEndMin;
                    if (comparisonIntervalEndMin < intervalStartMin) {
                        comparisonIntervalEndMin += fullDayMinutes;
                    }

                    // Formater l'intervalle en HH:MM pour la comparaison et l'affichage
                    const currentInterval = {
                        start: `${String(Math.floor(intervalStartMin / 60)).padStart(2, '0')}:${String(intervalStartMin % 60).padStart(2, '0')}`,
                        end: `${String(Math.floor(intervalEndMin / 60)).padStart(2, '0')}:${String(intervalEndMin % 60).padStart(2, '0')}`
                    };
                    // Correction pour le cas où 24:00 est affiché comme 00:00 (si 07:00-07:00)
                    if (currentInterval.end === "00:00" && intervalEndMin !== 0) currentInterval.end = "24:00"; // Préférer 24:00 pour la fin si c'est vraiment la fin de la journée

                    let isAvailable = false;
                    let originalRange = null; // Pour stocker la plage d'origine si disponible

                    for (const range of dailyAvailabilities) {
                        // Utiliser doTimeRangesOverlap pour vérifier le chevauchement
                        if (doTimeRangesOverlap(currentInterval, range)) {
                            isAvailable = true;
                            originalRange = range; // Stocker la plage complète d'origine
                            break;
                        }
                    }

                    // On passe la plage horaire du segment à getAvailabilitySegments telle quelle,
                    // et c'est getAvailabilitySegments qui se charge de la convertir pour le rendu 07h-07h.
                    const segmentsToRender = getAvailabilitySegments(currentInterval.start, currentInterval.end);

                    segmentsToRender.forEach(segment => {
                        const highlightSegment = document.createElement('div');
                        highlightSegment.classList.add('availability-highlight-segment');
                        if (isAvailable) {
                            highlightSegment.classList.add('available');
                            highlightSegment.title = `Disponible: ${originalRange.start} - ${originalRange.end}`; // Tooltip avec la plage complète
                        } else {
                            highlightSegment.classList.add('unavailable');
                            highlightSegment.title = `Indisponible: ${currentInterval.start} - ${currentInterval.end}`; // Tooltip avec la tranche de 30 min indisponible
                        }
                        highlightSegment.style.left = `${segment.left}%`;
                        highlightSegment.style.width = `${segment.width}%`;
                        availabilityBarBase.appendChild(highlightSegment);
                    });
                }

                slot.appendChild(createTooltipForAvailabilityBar(dailyAvailabilities, true)); // Ajoute le tooltip global
                
                const removeBtn = slot.querySelector('.remove-agent-btn');
                removeBtn.addEventListener('click', async (e) => {
                  e.stopPropagation();
                  appData[dateKey].onDutyAgents[i] = 'none';
                  await saveDailyRoster(dateKey);
                  // MODIFICATION ICI: Appels directs pour un rafraîchissement ciblé
                  renderPersonnelLists();
                  renderOnDutyAgentsGrid();
                });

            } else {
                slot.textContent = `Astreinte ${i+1}`; // Garder simple si pas d'agent
            }
        } else {
            slot.textContent = `Astreinte ${i+1}`; // Afficher les slots vides
        }
        onDutyAgentsGrid.appendChild(slot);
    }
}

// Nouvelle fonction pour créer le tooltip d'affichage des plages complètes
function createTooltipForAvailabilityBar(dailyAvailabilities, showUnavailable = false) {
    const tooltip = document.createElement('div');
    tooltip.classList.add('availability-bar-tooltip');
    tooltip.style.display = 'none'; // Caché par défaut

    if (dailyAvailabilities.length > 0) {
        const ul = document.createElement('ul');
        ul.innerHTML += '<li><strong>Disponibilités:</strong></li>';
        dailyAvailabilities.forEach(range => {
            const li = document.createElement('li');
            li.textContent = `${range.start} - ${range.end}`;
            ul.appendChild(li);
        });
        tooltip.appendChild(ul);
    } else if (showUnavailable) {
        const p = document.createElement('p');
        p.textContent = 'Agent indisponible toute la journée.';
        tooltip.appendChild(p);
    } else {
        const p = document.createElement('p');
        p.textContent = 'Aucune disponibilité renseignée.';
        tooltip.appendChild(p);
    }

    // Gestion du survol pour afficher/masquer le tooltip
    const availabilityBarWrapper = tooltip.closest('.availability-bar-wrapper');
    if (availabilityBarWrapper) {
        availabilityBarWrapper.addEventListener('mouseenter', () => {
            tooltip.style.display = 'block';
        });
        availabilityBarWrapper.addEventListener('mouseleave', () => {
            tooltip.style.display = 'none';
        });
    }

    return tooltip;
}


async function updateDateDisplay() {
  showSpinner();
  const dateKey = formatDateToYYYYMMDD(currentRosterDate);
  await loadRosterConfig(dateKey);
  await loadAllPersonnelAvailabilities(); // Recharger les dispo après loadRosterConfig pour s'assurer que allAgents est à jour
  await loadDailyRoster(dateKey); // Charge le daily roster (agents d'astreinte)
  initializeDefaultTimeSlotsForDate(dateKey); // Assure un créneau par défaut si aucun n'existe
  

  rosterDateInput.valueAsDate = currentRosterDate;
  renderTimeSlotButtons(dateKey);
  renderPersonnelLists();
  renderOnDutyAgentsGrid();
  renderRosterGrid();
  hideSpinner();
}

// --------------------------------------------------
// 4️⃣ Handlers & Bootstrap
// --------------------------------------------------

/**
 * Affiche une modale pour sélectionner une plage horaire.
 * @param {string} currentStart - Heure de début par défaut (HH:MM).
 * @param {string} currentEnd - Heure de fin par défaut (HH:MM).
 * @param {function(string, string)} callback - Fonction appelée avec les nouvelles heures (start, end) si l'utilisateur valide.
 */
function showTimeRangeSelectionModal(currentStart, currentEnd, callback) {
  let modal = document.getElementById('time-range-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'time-range-modal';
    modal.classList.add('custom-modal');
    modal.innerHTML = `
      <div class="modal-content">
        <h2>Définir la Plage Horaire</h2>
        <div class="modal-form-group">
          <label for="start-time">Heure de début:</label>
          <select id="start-time"></select>
        </div>
        <div class="modal-form-group">
          <label for="end-time">Heure de fin:</label>
          <select id="end-time"></select>
        </div>
        <div class="modal-actions">
          <button id="cancel-time-range" class="btn btn-secondary">Annuler</button>
          <button id="save-time-range" class="btn btn-primary">Enregistrer</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  const startTimeSelect = modal.querySelector('#start-time');
  const endTimeSelect = modal.querySelector('#end-time');
  const saveButton = modal.querySelector('#save-time-range');
  const cancelButton = modal.querySelector('#cancel-time-range');

  startTimeSelect.innerHTML = '';
  endTimeSelect.innerHTML = '';

  const times = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      times.push(timeStr);
    }
  }

  times.forEach(time => {
    const startOption = document.createElement('option');
    startOption.value = time;
    startOption.textContent = time;
    startTimeSelect.appendChild(startOption);

    const endOption = document.createElement('option');
    endOption.value = time;
    endOption.textContent = time;
    endTimeSelect.appendChild(endOption);
  });

  startTimeSelect.value = currentStart;
  endTimeSelect.value = currentEnd;

  modal.style.display = 'flex';

  saveButton.onclick = null;
  cancelButton.onclick = null;

  saveButton.onclick = () => {
    const newStart = startTimeSelect.value;
    const newEnd = endTimeSelect.value;
    modal.style.display = 'none';
    callback(newStart, newEnd);
  };

  cancelButton.onclick = () => {
    modal.style.display = 'none';
  };

  modal.onclick = (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  };
}


// Variables pour le drag & drop GLOBAL (entre listes et grille)
let draggedAgentId = null;
let draggedElement = null; // Store a reference to the element being dragged

function handleDragStart(e) {
  console.log("Dragstart triggered on:", e.target);
  draggedAgentId = e.target.dataset.agentId; // Stocke l'ID de l'agent dragué
  if (draggedAgentId) { // S'assurer qu'il y a un agentId valide
    e.dataTransfer.setData('text/plain', draggedAgentId); // Nécessaire pour le drop
    e.dataTransfer.effectAllowed = 'move'; // Indique que l'élément sera déplacé
    draggedElement = e.target; // Store the reference
    draggedElement.classList.add('dragging');
    console.log("Agent being dragged (GLOBAL):", draggedAgentId);
  } else {
    // Si pas d'agentId, annuler le drag
    e.preventDefault();
    console.warn("Dragstart aborted (GLOBAL): No agentId found on element.", e.target);
  }
}

// Ajout pour s'assurer que la classe 'dragging' est retirée même si le drop échoue
document.addEventListener('dragend', (e) => {
    console.log("Dragend triggered.");
    if (draggedElement) {
        draggedElement.classList.remove('dragging');
        draggedElement = null;
    }
    draggedAgentId = null; // Réinitialiser aussi l'ID ici
});

function handleDragOver(e) {
  e.preventDefault(); // Permet le drop
  const target = e.target.closest('.on-duty-slot') || e.target.closest('.roster-cell') || e.target.closest('.engine-case') || e.target.closest('.modal-role-slot') || e.target.closest('.modal-available-agent-slot');
  if (target) {
    e.dataTransfer.dropEffect = 'move';
    if (!target.classList.contains('drag-over')) {
      target.classList.add('drag-over');
    }
  } else {
    e.dataTransfer.dropEffect = 'none';
  }
}

function handleDragLeave(e) {
  const target = e.target.closest('.on-duty-slot') || e.target.closest('.roster-cell') || e.target.closest('.engine-case') || e.target.closest('.modal-role-slot') || e.target.closest('.modal-available-agent-slot');
  if (target) {
    target.classList.remove('drag-over');
  }
}

async function handleDropOnDuty(e) {
  e.preventDefault();
  const targetSlot = e.target.closest('.on-duty-slot');
  if (targetSlot) {
    targetSlot.classList.remove('drag-over');
  }
  console.log("Drop on Duty Slot triggered on:", targetSlot, "with agent ID (from dataTransfer):", e.dataTransfer.getData('text/plain'));

  if (!targetSlot) {
    console.warn("DropOnDuty: Target slot not found. Aborting.");
    return;
  }

  const slotIndex = parseInt(targetSlot.dataset.slotIndex);
  const dateKey = formatDateToYYYYMMDD(currentRosterDate);
  const agentId = e.dataTransfer.getData('text/plain');

  if (!agentId || agentId === 'none') {
    console.warn("DropOnDuty: Agent ID is missing or 'none'. Aborting drop.");
    return;
  }

  // Empêcher l'ajout du même agent dans plusieurs slots d'astreinte
  const existingIndex = appData[dateKey].onDutyAgents.indexOf(agentId);
  if (existingIndex !== -1 && existingIndex !== slotIndex) {
      console.log(`Agent ${agentId} already in slot ${existingIndex}. Moving from there.`);
      appData[dateKey].onDutyAgents[existingIndex] = 'none'; // Libère l'ancien slot
  }
  
  // Si le slot de destination est déjà rempli par un agent différent, cet agent est "libéré"
  const agentCurrentlyInSlot = appData[dateKey].onDutyAgents[slotIndex];
  if (agentCurrentlyInSlot && agentCurrentlyInSlot !== 'none' && agentCurrentlyInSlot !== agentId) {
      console.log(`Slot ${slotIndex} already occupied by ${agentCurrentlyInSlot}. Replacing.`);
      // L'agent qui était dans ce slot sera automatiquement considéré "disponible" après re-render
  }

  appData[dateKey].onDutyAgents[slotIndex] = agentId;
  console.log("Attempting to save daily roster:", appData[dateKey].onDutyAgents);
  await saveDailyRoster(dateKey); // Ici, le spinner est montré
  console.log("SaveDailyRoster finished. Updating display...");
  
  // MODIFICATION ICI: Appels directs pour un rafraîchissement ciblé
  renderPersonnelLists();
  renderOnDutyAgentsGrid();
  
  console.log("Display updated.");
  draggedAgentId = null; // Important: Réinitialiser après un drop réussi
}

async function handleDropOnEngine(e) {
    e.preventDefault();
    const targetElement = e.target.closest('.engine-case') || e.target.closest('.roster-cell');
    if (targetElement) {
        targetElement.classList.remove('drag-over');
    }
    console.log("Drop on Engine triggered on:", targetElement, "with agent ID (from dataTransfer):", e.dataTransfer.getData('text/plain'));

    const agentId = e.dataTransfer.getData('text/plain');
    const dateKey = formatDateToYYYYMMDD(currentRosterDate);

    if (!agentId || agentId === 'none') {
        console.warn("DropOnEngine: Agent ID is missing or 'none'. Aborting drop.");
        return;
    }
    if (!targetElement) {
        console.warn("Drop non valide : pas sur un engin ou une cellule de roster.");
        return;
    }

    const slotId = targetElement.dataset.slotId;
    const engineType = targetElement.dataset.engineType;

    if (!slotId || !engineType) {
        console.warn("DropOnEngine: Missing slotId or engineType on targetElement.", targetElement);
        return;
    }

    // Retirer l'agent des astreintes s'il y était
    const onDutyAgents = appData[dateKey].onDutyAgents;
    const onDutyIndex = onDutyAgents.indexOf(agentId);
    if (onDutyIndex !== -1) {
        console.log(`Agent ${agentId} was on duty at slot ${onDutyIndex}. Removing from there.`);
        onDutyAgents[onDutyIndex] = 'none';
        await saveDailyRoster(dateKey); // Sauvegarder immédiatement les changements d'astreinte
    }

    const currentEngineAssignment = appData[dateKey].timeSlots[slotId].engines[engineType].personnel;
    let assigned = false;

    // Chercher un rôle libre spécifique
    for (const role of engineRoles[engineType]) {
        if (currentEngineAssignment[role] === 'none') {
            currentEngineAssignment[role] = agentId;
            assigned = true;
            console.log(`Agent ${agentId} assigned to role ${role} in ${engineType}.`);
            break;
        }
    }
    
    // Si tous les rôles spécifiques sont pris, mais qu'il y a un rôle 'EQ' (équipier générique)
    if (!assigned && engineRoles[engineType].includes('EQ')) {
        // Vérifier si le rôle 'EQ' existe et n'est pas déjà affecté
        if (currentEngineAssignment.hasOwnProperty('EQ') && currentEngineAssignment['EQ'] === 'none') {
            currentEngineAssignment['EQ'] = agentId;
            assigned = true;
            console.log(`Agent ${agentId} assigned to generic 'EQ' role in ${engineType}.`);
        }
    }

    if (assigned) {
      console.log("Attempting to save roster config after engine drop.");
      await saveRosterConfig(dateKey);
      console.log("SaveRosterConfig finished. Updating display...");
      updateDateDisplay(); // Re-render pour refléter tous les changements
      console.log("Display updated.");
    } else {
        alert("Aucun rôle libre trouvé pour cet agent dans cet engin. Veuillez utiliser la modale de gestion détaillée si nécessaire.");
        console.warn(`Agent ${agentId} could not be assigned to ${engineType}. All roles occupied or no suitable role.`);
    }
    draggedAgentId = null; // Important: Réinitialiser après un drop réussi
}


function createOnDutySlots() {
  // Cette fonction ne fait que créer les divs vides initiales.
  // Le remplissage est fait par renderOnDutyAgentsGrid().
  onDutyAgentsGrid.innerHTML = '';
  for (let i = 0; i < 10; i++) {
    const slot = document.createElement('div');
    slot.classList.add('on-duty-slot');
    slot.dataset.slotIndex = i;
    // Les écouteurs de drag/drop sont ajoutés dans renderOnDutyAgentsGrid()
    // pour garantir qu'ils sont présents sur les éléments réels et non temporaires.
    onDutyAgentsGrid.appendChild(slot);
  }
}

function displayEnginesForSlot(dateKey, slotId) {
  const rosterContent = document.querySelector('.roster-content');
  rosterContent.style.display = 'none';

  engineDetailsPage.style.display = 'block';

  const currentSlot = appData[dateKey].timeSlots[slotId];
  if (!currentSlot) {
    console.error("Créneau horaire non trouvé:", slotId);
    return;
  }

  const engineGridContainer = engineDetailsPage.querySelector('.engine-grid');
  engineGridContainer.innerHTML = '';

  Object.entries(currentSlot.engines).forEach(([engineType, assignment]) => {
    const engineCase = document.createElement('div');
    engineCase.classList.add('engine-case');
    engineCase.dataset.slotId = slotId;
    engineCase.dataset.engineType = engineType;
    engineCase.innerHTML = `
      <h3>${engineType}</h3>
      <span class="places-count">${Object.keys(engineRoles[engineType] || {}).length} places</span>
      <ul class="personnel-list">
        ${Object.entries(assignment.personnel).map(([role, agentId]) => {
          const agent = allAgents.find(a => a._id === agentId);
          // Utilisation de prenom et nom
          return `<li><strong>${role}:</strong> ${agent && agentId !== 'none' ? `${agent.prenom} ${agent.nom}` : 'Non affecté'}</li>`;
        }).join('')}
      </ul>
      <button class="assign-engine-personnel-btn">Gérer le personnel</button>
    `;
    engineCase.querySelector('.assign-engine-personnel-btn').addEventListener('click', () => {
      openPersonnelAssignmentModal(dateKey, slotId, engineType);
    });

    engineCase.addEventListener('dragover', handleDragOver);
    engineCase.addEventListener('dragleave', handleDragLeave);
    engineCase.addEventListener('drop', handleDropOnEngine);

    engineGridContainer.appendChild(engineCase);
  });
}

// --------------------------------------------------
// 5️⃣ Nouvelle Modale d'affectation du personnel aux engins
// --------------------------------------------------

function openPersonnelAssignmentModal(dateKey, slotId, engineType) {
    const currentSlot = appData[dateKey].timeSlots[slotId];
    if (!currentSlot) {
        console.error("Créneau horaire introuvable pour la modale:", slotId);
        return;
    }
    const currentEngine = currentSlot.engines[engineType];
    if (!currentEngine) {
        console.error("Engin introuvable pour la modale:", engineType);
        return;
    }

    personnelAssignmentModalTitle.textContent = `Affecter le personnel pour ${engineType} (${currentSlot.range})`;
    availableAgentsInModalList.innerHTML = '';
    engineRolesContainer.innerHTML = '';

    // Agents d'astreinte disponibles pour cette date
    const onDutyAgents = appData[dateKey].onDutyAgents.filter(id => id !== 'none').map(id => allAgents.find(a => a._id === id));
    
    // Agents déjà affectés à cet engin
    const assignedAgentsInThisEngine = Object.values(currentEngine.personnel).filter(id => id !== 'none');

    // Filtrer les agents d'astreinte qui ne sont PAS encore affectés à cet engin
    const agentsForModal = onDutyAgents.filter(agent => agent && !assignedAgentsInThisEngine.includes(agent._id));

    // Remplir la liste des agents disponibles dans la modale
    if (agentsForModal.length === 0) {
        availableAgentsInModalList.innerHTML = '<p class="no-available-personnel-modal">Aucun agent d\'astreinte disponible pour l\'affectation à cet engin.</p>';
    } else {
        agentsForModal.forEach(agent => {
            const agentDiv = document.createElement('div');
            agentDiv.classList.add('modal-available-agent-slot');
            agentDiv.dataset.agentId = agent._id;
            agentDiv.setAttribute('draggable', true);
            agentDiv.addEventListener('dragstart', handleModalDragStart);
            agentDiv.textContent = `${agent.prenom} ${agent.nom}`;
            availableAgentsInModalList.appendChild(agentDiv);
        });
    }

    // Remplir les slots de rôles de l'engin
    engineRoles[engineType].forEach(role => {
        const roleDiv = document.createElement('div');
        roleDiv.classList.add('modal-role-slot');
        roleDiv.dataset.role = role;
        roleDiv.dataset.slotId = slotId; // Pour la référence lors du drop
        roleDiv.dataset.engineType = engineType; // Pour la référence lors du drop

        const agentIdInRole = currentEngine.personnel[role];
        const agentInRole = allAgents.find(a => a._id === agentIdInRole);

        roleDiv.innerHTML = `
            <span class="role-name">${role}:</span>
            <div class="assigned-agent-placeholder ${agentIdInRole !== 'none' ? 'filled' : ''}" 
                 data-current-agent-id="${agentIdInRole || 'none'}">
                ${agentInRole && agentIdInRole !== 'none' ? 
                    `<span class="assigned-agent-name" data-agent-id="${agentInRole._id}" draggable="true">${agentInRole.prenom} ${agentInRole.nom}</span>
                     <button class="remove-assigned-agent-btn">x</button>` 
                    : 'Glisser un agent ici'}
            </div>
        `;
        
        // Ajouter les événements de drag & drop aux placeholders et agents affectés
        const placeholder = roleDiv.querySelector('.assigned-agent-placeholder');
        placeholder.addEventListener('dragover', handleDragOver);
        placeholder.addEventListener('dragleave', handleDragLeave);
        placeholder.addEventListener('drop', (e) => handleModalDropOnRole(e, dateKey, slotId, engineType, role));

        const assignedAgentSpan = roleDiv.querySelector('.assigned-agent-name');
        if (assignedAgentSpan) {
            assignedAgentSpan.addEventListener('dragstart', handleModalDragStart);
        }

        const removeBtn = roleDiv.querySelector('.remove-assigned-agent-btn');
        if (removeBtn) {
            removeBtn.addEventListener('click', () => {
                currentEngine.personnel[role] = 'none'; // Désaffecte l'agent
                savePersonnelAssignments(dateKey); // Sauvegarde et rafraîchit
                openPersonnelAssignmentModal(dateKey, slotId, engineType); // Rafraîchit la modale
            });
        }

        engineRolesContainer.appendChild(roleDiv);
    });

    personnelAssignmentModal.style.display = 'flex';
}

function handleModalDragStart(e) {
    console.log("Modal Dragstart triggered on:", e.target);
    const agentId = e.target.dataset.agentId;
    if (agentId) {
        e.dataTransfer.setData('text/plain', agentId);
        e.dataTransfer.effectAllowed = 'move';
        // Pas besoin de draggedElement global ici, la logique de la modale est auto-contenue
        e.target.classList.add('dragging-modal');
        console.log("Agent being dragged (MODAL):", agentId);
    } else {
        e.preventDefault();
        console.warn("Modal Dragstart aborted: No agentId found on element.", e.target);
    }
}

// Retire la classe dragging après la fin du drag modal
personnelAssignmentModal.addEventListener('dragend', (e) => {
    console.log("Modal Dragend triggered.");
    const draggedModalElement = document.querySelector('.dragging-modal');
    if (draggedModalElement) {
        draggedModalElement.classList.remove('dragging-modal');
    }
});


/**
 * Vérifie si un agent a la qualification requise pour un rôle donné.
 * @param {Object} agent - L'objet agent avec sa liste de qualifications.
 * @param {string} role - Le nom du rôle (ex: 'CA_FPT', 'EQ').
 * @returns {boolean} True si l'agent est qualifié, False sinon.
 */
function isAgentQualifiedForRole(agent, role) {
    if (!agent || !agent.qualifications) {
        return false;
    }
    const requiredQualification = roleToQualificationMap[role];

    if (role === 'EQ') {
        // Pour le rôle générique EQ, vérifier si l'agent a N'IMPORTE QUELLE qualification d'équipier
        return agent.qualifications.some(q => genericEqQualifications.includes(q));
    } else if (requiredQualification) {
        return agent.qualifications.includes(requiredQualification);
    }
    return false; // Rôle non reconnu ou pas de qualification spécifique mappée
}


async function handleModalDropOnRole(e, dateKey, slotId, engineType, targetRole) {
    e.preventDefault();
    const placeholder = e.target.closest('.assigned-agent-placeholder');
    if (placeholder) {
        placeholder.classList.remove('drag-over');
    }

    const newAgentId = e.dataTransfer.getData('text/plain');
    if (!newAgentId || newAgentId === 'none') return;

    const agentToAssign = allAgents.find(a => a._id === newAgentId);
    if (!agentToAssign) {
        console.error("Agent non trouvé pour l'affectation:", newAgentId);
        return;
    }

    // Vérification de la qualification
    if (!isAgentQualifiedForRole(agentToAssign, targetRole)) {
        alert(`L'agent ${agentToAssign.prenom} ${agentToAssign.nom} n'a pas la qualification requise pour le rôle ${targetRole}.`);
        return; // Empêche l'affectation si non qualifié
    }

    const currentEnginePersonnel = appData[dateKey].timeSlots[slotId].engines[engineType].personnel;

    // 1. Libérer l'agent de son ancien rôle (s'il était déjà affecté dans cet engin)
    for (const role in currentEnginePersonnel) {
        if (currentEnginePersonnel[role] === newAgentId) {
            currentEnginePersonnel[role] = 'none';
            break; // Un agent ne peut être que dans un seul rôle par engin
        }
    }

    // 2. Libérer l'agent qui était éventuellement déjà dans le rôle cible
    const oldAgentInTargetRole = currentEnginePersonnel[targetRole];
    if (oldAgentInTargetRole && oldAgentInTargetRole !== 'none') {
        // L'agent sera automatiquement de nouveau disponible dans la liste "agents disponibles"
        console.log(`L'agent ${allAgents.find(a => a._id === oldAgentInTargetRole)?.prenom} ${allAgents.find(a => a._id === oldAgentInTargetRole)?.nom} a été libéré du rôle ${targetRole}.`);
    }

    // 3. Affecter le nouvel agent au rôle cible
    currentEnginePersonnel[targetRole] = newAgentId;

    await saveRosterConfig(dateKey); // Sauvegarde les changements
    openPersonnelAssignmentModal(dateKey, slotId, engineType); // Rafraîchit la modale
    updateDateDisplay(); // Rafraîchit la grille principale en arrière-plan
}


// --- Fonctions de fermeture de la modale ---
closePersonnelAssignmentModalBtn.addEventListener('click', () => {
    personnelAssignmentModal.style.display = 'none';
    showMainRosterGrid(); // Retourne à l'affichage principal
});
personnelAssignmentModal.addEventListener('click', (e) => {
    if (e.target === personnelAssignmentModal) {
        personnelAssignmentModal.style.display = 'none';
        showMainRosterGrid(); // Retourne à l'affichage principal
    }
});


async function savePersonnelAssignments(dateKey) { // Utilisé pour rafraîchir après un changement dans la modale
  const currentKey = dateKey || formatDateToYYYYMMDD(currentRosterDate);
  await saveRosterConfig(currentKey);
  // Pas besoin de updateDateDisplay() ici car openPersonnelAssignmentModal
  // est appelée après chaque changement dans la modale, et elle se rafraîchit elle-même.
  // Cependant, on veut aussi que la grille principale se met à jour:
  updateDateDisplay(); 
}


function assignPersonnelToSlot(dateKey, slotId) {
  const currentSlot = appData[dateKey].timeSlots[slotId];
  if (!currentSlot) return;

  const onDutyAgents = appData[dateKey].onDutyAgents.filter(id => id !== 'none');

  // Retirer tous les agents de leurs affectations d'engins précédentes
  // Pour éviter qu'un agent ne soit affecté à un engin ET d'astreinte
  // Et pour s'assurer que seuls les agents d'astreinte actuels sont affectés
  Object.keys(currentSlot.engines).forEach(engineType => {
      Object.keys(currentSlot.engines[engineType].personnel).forEach(role => {
          currentSlot.engines[engineType].personnel[role] = 'none';
      });
  });

  // Créer une copie modifiable des agents d'astreinte
  const availableAgentsForAuto = [...onDutyAgents];

  // Affecter les agents aux engins, rôle par rôle
  Object.keys(engineRoles).forEach(engineType => {
    const rolesForEngine = engineRoles[engineType];
    rolesForEngine.forEach(role => {
        if (availableAgentsForAuto.length > 0) {
            // Trouver le meilleur agent qualifié en priorité
            let bestAgentIndex = -1;
            for (let i = 0; i < availableAgentsForAuto.length; i++) {
                const agent = allAgents.find(a => a._id === availableAgentsForAuto[i]);
                if (agent && isAgentQualifiedForRole(agent, role)) {
                    bestAgentIndex = i;
                    break; // Prend le premier agent qualifié trouvé
                }
            }

            let agentToAssignId;
            if (bestAgentIndex !== -1) {
                agentToAssignId = availableAgentsForAuto.splice(bestAgentIndex, 1)[0]; // Retire l'agent qualifié
            } else {
                // Si aucun agent qualifié, prend le premier agent disponible (si c'est acceptable dans votre logique)
                agentToAssignId = availableAgentsForAuto.shift(); 
                const agent = allAgents.find(a => a._id === agentToAssignId);
                if (agent) {
                    console.warn(`Aucun agent qualifié trouvé pour le rôle '${role}' dans l'engin '${engineType}'. Agent '${agent.prenom} ${agent.nom}' affecté sans qualification spécifique.`);
                }
            }
            
            if (agentToAssignId) {
                currentSlot.engines[engineType].personnel[role] = agentToAssignId;
            }
        }
    });
  });
}

async function generateAutomaticRoster(dateKey) {
  if (!appData[dateKey]) {
      console.warn("Pas de données de roster pour la date spécifiée. Impossible de générer automatiquement.");
      return;
  }
  showSpinner();
  Object.keys(appData[dateKey].timeSlots).forEach(slotId => {
    assignPersonnelToSlot(dateKey, slotId);
  });
  await saveRosterConfig(dateKey);
  await saveDailyRoster(dateKey); // Sauvegarder aussi les modifications aux astreintes si l'auto-génération les a déplacées
  updateDateDisplay();
  hideSpinner();
}

function showMainRosterGrid() {
  engineDetailsPage.style.display = 'none';
  document.querySelector('.roster-content').style.display = 'block';
  document.querySelectorAll('.time-slot-button').forEach(b => b.classList.remove('active'));
}


document.addEventListener('DOMContentLoaded', async () => {
  const role = sessionStorage.getItem("userRole");
  if (role !== "admin") return window.location.href = "index.html";

  rosterDateInput.valueAsDate = currentRosterDate;

  prevDayButton.addEventListener('click', async () => {
    currentRosterDate.setDate(currentRosterDate.getDate() - 1);
    await updateDateDisplay();
  });
  nextDayButton.addEventListener('click', async () => {
    currentRosterDate.setDate(currentRosterDate.getDate() + 1);
    await updateDateDisplay();
  });

  rosterDateInput.addEventListener('change', async (e) => {
    currentRosterDate = e.target.valueAsDate;
    await updateDateDisplay();
  });

  generateAutoBtn.addEventListener('click', async () => {
    if (confirm("Générer automatiquement ce planning ? Cela écrasera les affectations manuelles et pourra modifier les agents d'astreinte.")) {
      await generateAutomaticRoster(formatDateToYYYYMMDD(currentRosterDate));
      alert("Génération automatique terminée.");
    }
  });

  backToRosterBtn.addEventListener('click', showMainRosterGrid);

  createOnDutySlots(); // Crée les divs des slots une seule fois au démarrage

  await loadInitialData();
  await updateDateDisplay(); // Appelle une première fois pour le rendu initial

  showMainRosterGrid(); // S'assure que la grille principale est affichée au démarrage
});