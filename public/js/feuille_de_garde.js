// URL de l’API
const API_BASE_URL = "https://dispo-pompier.onrender.com";

// Créneaux de 07:00→07:00 sur 24h (30 min)
const horaires = [];
const startHourDisplay = 7;
for (let i = 0; i < 48; i++) {
  const h1 = (startHourDisplay + Math.floor(i/2)) % 24;
  const m1 = (i % 2) * 30;
  const h2 = (startHourDisplay + Math.floor((i+1)/2)) % 24;
  const m2 = ((i+1)%2) * 30;
  horaires.push(
    `${String(h1).padStart(2,'0')}:${String(m1).padStart(2,'0')} - ` +
    `${String(h2).padStart(2,'0')}:${String(m2).padStart(2,'0')}`
  );
}

// Rôles attendus par type d’engin
const engineRoles = {
  FPT:   ['CA_FPT','COD1','EQ1_FPT','EQ2_FPT'],
  CCF:   ['CA_FDF2','COD2','EQ1_FDF1','EQ2_FDF1'],
  VSAV:  ['CA_VSAV','COD0','EQ'],
  VTU:   ['CA_VTU','COD0','EQ'],
  VPMA:  ['CA_VPMA','COD0','EQ']
};

const rosterDateInput     = document.getElementById('roster-date');
const prevDayButton       = document.getElementById('prev-day-button');
const nextDayButton       = document.getElementById('next-day-button');
const generateAutoBtn     = document.getElementById('generate-auto-btn');
const availablePersonnelList = document.getElementById('available-personnel-list');
const onDutyAgentsGrid    = document.getElementById('on-duty-agents-grid');
const rosterGridContainer = document.getElementById('roster-grid');
const engineDetailsPage   = document.getElementById('engine-details-page');
const backToRosterBtn     = document.getElementById('back-to-roster-btn');
const loadingSpinner      = document.getElementById('loading-spinner');

let currentRosterDate = new Date();
let allAgents         = [];
let appData           = { personnelAvailabilities: {} };

function formatDateToYYYYMMDD(d) {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}` +
         `-${String(dt.getDate()).padStart(2,'0')}`;
}
function parseTimeToMinutes(t) {
  const [h,m] = t.split(':').map(Number);
  return h*60 + m;
}
function doTimeRangesOverlap(r1, r2) {
  let e1 = parseTimeToMinutes(r1.end), s1 = parseTimeToMinutes(r1.start);
  let e2 = parseTimeToMinutes(r2.end), s2 = parseTimeToMinutes(r2.start);
  if (e1<=s1) e1 += 24*60;
  if (e2<=s2) e2 += 24*60;
  return s1 < e2 && e1 > s2;
}
function createEmptyEngineAssignment(type) {
  const pers = {};
  (engineRoles[type]||[]).forEach(role => pers[role] = 'none');
  return { personnel: pers };
}
// (et autres: sortPersonnelByGrade, getRoleType, gradePriority, roleGradePreferences…)
function showTimeRangePromptModal(start, end, callback) {
  // Simple prompt, à remplacer par ta modale personnalisée
  const newStart = prompt("Heure de début", start);
  if (!newStart) return;
  const newEnd   = prompt("Heure de fin", end);
  if (!newEnd) return;
  callback(newStart, newEnd);
}

function handleDragStart(e) {
  e.dataTransfer.setData('text/plain', e.target.dataset.agentId);
  e.target.classList.add('dragging');
}
function handleDragOver(e) {
  e.preventDefault();
  e.target.classList.add('drag-over');
}
function handleDragLeave(e) {
  e.target.classList.remove('drag-over');
}
async function handleDropOnDuty(e) {
  e.preventDefault();
  e.target.classList.remove('drag-over');
  // …(logique de swap/insert + saveRosterConfig)…
}

function createOnDutySlots() {
  onDutyAgentsGrid.innerHTML = '';
  for (let i = 0; i < 10; i++) {
    const slot = document.createElement('div');
    slot.classList.add('on-duty-slot');
    slot.dataset.slotIndex = i;
    slot.textContent = `Astreinte ${i+1}`;
    slot.setAttribute('draggable', true);
    slot.addEventListener('dragstart', handleDragStart);
    slot.addEventListener('dragover',  handleDragOver);
    slot.addEventListener('dragleave', handleDragLeave);
    slot.addEventListener('drop',      handleDropOnDuty);
    onDutyAgentsGrid.appendChild(slot);
  }
}
function renderOnDutyAgentsGrid() {
  // … boucle sur appData[date].onDutyAgents, ajoute/remplace texte & classes …
}

async function fetchAllAgents() {
  const resp = await fetch(`${API_BASE_URL}/api/admin/agents`, { headers:{'X-User-Role':'admin'} });
  allAgents = await resp.json();
}
async function loadRosterConfig(dateKey) { /* GET /api/roster-config/... */ }
async function saveRosterConfig(dateKey) { /* POST /api/roster-config/... */ }
async function loadDailyRoster(dateKey) { /* GET /api/daily-roster/... */ }
async function saveDailyRoster(dateKey) { /* POST /api/daily-roster/... */ }
async function loadAllPersonnelAvailabilities() { /* fetch /api/planning/... */ }

function initializeDefaultTimeSlotsForDate(dateKey) {
  if (!appData[dateKey]) appData[dateKey] = { timeSlots:{}, onDutyAgents:Array(10).fill('none') };
  if (Object.keys(appData[dateKey].timeSlots).length===0) {
    const id = `slot_0700_0700_${Date.now()}`;
    appData[dateKey].timeSlots[id] = { range:'07:00 - 07:00', engines:{} };
    ['FPT','CCF','VSAV','VTU','VPMA']
      .forEach(et => appData[dateKey].timeSlots[id].engines[et] = createEmptyEngineAssignment(et));
    saveRosterConfig(dateKey);
  }
}
function renderTimeSlotButtons(dateKey) {
  const c = document.getElementById('time-slot-buttons-container');
  c.innerHTML = '';
  // bouton “+”
  const add = document.createElement('button');
  add.textContent = '+';
  add.addEventListener('click', () => {
    showTimeRangePromptModal('07:00','07:00', (ns,ne) => {
      const id = `slot_${ns.replace(':','')}_${ne.replace(':','')}_${Date.now()}`;
      appData[dateKey].timeSlots[id] = { range:`${ns} - ${ne}`, engines:{} };
      ['FPT','CCF','VSAV','VTU','VPMA']
        .forEach(et=> appData[dateKey].timeSlots[id].engines[et] = createEmptyEngineAssignment(et));
      saveRosterConfig(dateKey);
      renderTimeSlotButtons(dateKey);
    });
  });
  c.appendChild(add);

  // boutons existants + dblclick pour auto-split
  Object.entries(appData[dateKey].timeSlots)
    .sort((a,b)=> parseTimeToMinutes(a[1].range.split(' - ')[0]) -
                  parseTimeToMinutes(b[1].range.split(' - ')[0]))
    .forEach(([slotId,slot]) => {
      const btn = document.createElement('button');
      btn.textContent = slot.range;
      btn.addEventListener('click', () => displayEnginesForSlot(dateKey, slotId));
      btn.addEventListener('dblclick', () => {
        const [cs, ce] = slot.range.split(' - ');
        showTimeRangePromptModal(cs, ce, (ns, ne) => {
          slot.range = `${ns} - ${ne}`;
          saveRosterConfig(dateKey);
          // auto-split si nécessaire
          let sMin = parseTimeToMinutes(ns), eMin = parseTimeToMinutes(ne);
          if (eMin <= sMin) eMin += 24*60;
          const endOfDay = parseTimeToMinutes('07:00') + 24*60;
          if (eMin < endOfDay) {
            const id2 = `slot_${ne.replace(':','')}_0700_${Date.now()}`;
            if (!Object.values(appData[dateKey].timeSlots).some(s=> s.range===`${ne} - 07:00`)) {
              appData[dateKey].timeSlots[id2] = { range:`${ne} - 07:00`, engines:{} };
              ['FPT','CCF','VSAV','VTU','VPMA']
                .forEach(et=> appData[dateKey].timeSlots[id2].engines[et] = createEmptyEngineAssignment(et));
            }
          }
          renderTimeSlotButtons(dateKey);
        });
      });
      c.appendChild(btn);
  });
}

function renderRosterGrid() {
  rosterGridContainer.innerHTML = '';
  const table = document.createElement('table');
  // en-tête…
  // corps : pour chaque 30min de `horaires` on fait un <td>,
  // on ajoute drag/drop si chevauche avec un créneau configuré
}
function handleDragOverRoster(e) { /* … */ }
function handleDragLeaveRoster(e) { /* … */ }
async function handleDropRoster(e) { /* … */ }

function displayEnginesForSlot(dateKey, slotId) {
  // cache main, affiche engineDetailsPage, boucle engineRoles…
}
function createPersonnelAssignmentModal() { /* ta modale custom */ }
function openPersonnelAssignmentModal(dateKey, slotId, engineType) { /* … */ }
async function savePersonnelAssignments() { /* … */ }

function getQualifiedPersonnelForRole(role, pool) { /* tri par grade… */ }
function assignPersonnelToSlot(dateKey, slotId) { /* parcourt chaque rôle… */ }
async function generateAutomaticRoster(dateKey) {
  // init if needed, boucle slotId → assignPersonnelToSlot, saveDailyRoster, renderRosterGrid
}

function getDateFromWeekAndDay(year, weekNum, dayName) { /* calcul ISO week… */ }

document.addEventListener('DOMContentLoaded', async () => {
  const role = sessionStorage.getItem("userRole");
  if (role!=="admin") return window.location.href="index.html";

  rosterDateInput.valueAsDate = currentRosterDate;
  // Bouton “<” : jour précédent
  prevDayButton.addEventListener('click', () => {
    currentRosterDate.setDate(currentRosterDate.getDate() - 1);
    rosterDateInput.valueAsDate = currentRosterDate;
    updateDateDisplay();
  });

  // Bouton “>” : jour suivant
  nextDayButton.addEventListener('click', () => {
    currentRosterDate.setDate(currentRosterDate.getDate() + 1);
    rosterDateInput.valueAsDate = currentRosterDate;
    updateDateDisplay();
  });

  // Sélection de date manuelle
  rosterDateInput.addEventListener('change', (e) => {
    currentRosterDate = e.target.valueAsDate;
    updateDateDisplay();
  });

  // Génération automatique
  generateAutoBtn.addEventListener('click', async () => {
    if (confirm("Voulez-vous vraiment générer le planning automatiquement pour ce jour ?")) {
      await generateAutomaticRoster(formatDateToYYYYMMDD(currentRosterDate));
    }
  });

  // Retour à la vue principale
  backToRosterBtn.addEventListener('click', showMainRosterGrid);

  createOnDutySlots();
  await fetchAllAgents();
  await loadInitialData();
  await updateDateDisplay();
});
