const API_BASE_URL = "https://dispo-pompier.onrender.com";

// Créneaux horaires de 07:00 à 07:00 le lendemain
const horaires = [];
const startHourDisplay = 7; // Heure de début des créneaux

for (let i = 0; i < 48; i++) { // 48 créneaux de 30 minutes = 24 heures
    const currentSlotHour = (startHourDisplay + Math.floor(i / 2)) % 24;
    const currentSlotMinute = (i % 2) * 30;

    const endSlotHour = (startHourDisplay + Math.floor((i + 1) / 2)) % 24;
    const endSlotMinute = ((i + 1) % 2) * 30;

    const start = `${String(currentSlotHour).padStart(2, '0')}:${String(currentSlotMinute).padStart(2, '0')}`;
    const end = `${String(endSlotHour).padStart(2, '0')}:${String(endSlotMinute).padStart(2, '0')}`;

    horaires.push(`${start} - ${end}`);
}

// DOM Elements
const rosterDateInput        = document.getElementById('roster-date');
const prevDayButton          = document.getElementById('prev-day-button');
const nextDayButton          = document.getElementById('next-day-button');
// Bouton "Générer Auto" (remplace l'ancien refresh-button)
const generateAutoBtn        = document.getElementById('generate-auto-btn');
const availablePersonnelList = document.getElementById('available-personnel-list');
const onDutyAgentsGrid       = document.getElementById('on-duty-agents-grid');
const rosterGridContainer    = document.getElementById('roster-grid');
const engineDetailsPage      = document.getElementById('engine-details-page');
const backToRosterBtn        = document.getElementById('back-to-roster-btn');
const loadingSpinner         = document.getElementById('loading-spinner');
const addTimeSlotBtn         = document.getElementById('add-time-slot-btn');

let currentRosterDate = new Date(); 
let allAgents         = [];
let currentRosterData = {};

let appData = {
    personnelAvailabilities: {} 
};

// -- Met à jour la date et tout l’affichage associé --
async function updateDateDisplay() {
  showLoading(true);
  const dateKey = formatDateToYYYYMMDD(currentRosterDate);
  rosterDateInput.value = dateKey;

  try {
    await loadRosterConfig(dateKey);
    if (!appData[dateKey] || Object.keys(appData[dateKey].timeSlots).length === 0) {
      initializeDefaultTimeSlotsForDate(dateKey);
    }
    await loadDailyRoster(dateKey);
    await loadAllPersonnelAvailabilities();

    renderTimeSlotButtons(dateKey);
    renderOnDutyAgentsGrid();
    renderAvailablePersonnel();
    showMainRosterGrid();
  } catch (err) {
    console.error("Error in updateDateDisplay:", err);
    showAlertModal(`Erreur mise à jour date : ${err.message}`);
  } finally {
    showLoading(false);
  }
}

// -- Affiche la vue principale (cacher détails engins) --
function showMainRosterGrid() {
  // Cache la page détails et remet la grille principale visible
  engineDetailsPage.style.display = 'none';
  document.querySelector('.personnel-management-section').style.display = 'grid';
  rosterGridContainer.style.display = 'block';
  // Déselectionne tous les boutons de créneaux
  document.querySelectorAll('.time-slot-button').forEach(btn => {
    btn.classList.remove('active', 'bg-blue-500', 'text-white', 'border-blue-500');
  });
  renderRosterGrid();
}


// ------------- UTILITAIRES --------------

// Formate une date au format AAAA-MM-JJ
function formatDateToYYYYMMDD(date) {
    if (!(date instanceof Date) || isNaN(date)) {
        console.error("Invalid Date object passed to formatDateToYYYYMMDD:", date);
        return "InvalidDate";
    }
    const d = new Date(date);
    const year  = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day   = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Parser une chaîne de temps "HH:MM" en minutes depuis minuit
function parseTimeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}

// Formate les minutes depuis minuit en chaîne "HH:MM"
function formatMinutesToTime(minutes) {
    const hours = Math.floor(minutes / 60) % 24;
    const mins  = minutes % 60;
    return `${String(hours).padStart(2,'0')}:${String(mins).padStart(2,'0')}`;
}

// Vérifie si deux plages horaires se chevauchent (avec ajustement pour traversée de minuit)
function doTimeRangesOverlap(range1, range2) {
    const start1 = parseTimeToMinutes(range1.start);
    let end1   = parseTimeToMinutes(range1.end);
    const start2 = parseTimeToMinutes(range2.start);
    let end2   = parseTimeToMinutes(range2.end);

    if (end1 <= start1) end1 += 24 * 60;
    if (end2 <= start2) end2 += 24 * 60;

    return start1 < end2 && end1 > start2;
}

// --- NOUVEAU : couverture totale des créneaux ---
function doesAvailabilityCover(slot, availability) {
    return availability.start <= slot.start && availability.end >= slot.end;
}

// Trie le personnel par grade (priorité la plus basse d'abord)
function sortPersonnelByGrade(personnelArray) {
    const gradePriority = {
        'CATE': 1,
        'CAUE': 2,
        'CAP': 3,
        'SAP': 4,
        'none': 99
    };
    return [...personnelArray].sort((a, b) => {
        return (gradePriority[a.grade] || Infinity) - (gradePriority[b.grade] || Infinity);
    });
}

// Helper pour obtenir le type de rôle à partir de la clé de rôle
function getRoleType(roleKey) {
    if (roleKey.startsWith('CA_')) return 'CA';
    if (roleKey.startsWith('COD')) return 'COD';
    if (roleKey.startsWith('EQ'))  return 'EQ';
    return 'unknown';
}

// Définition des priorités de grade et préférences de rôle
const gradePriority = { 'CATE':1,'CAUE':2,'CAP':3,'SAP':4,'none':99 };
const roleGradePreferences = {
    'EQ': ['SAP','CAP','CAUE','CATE'],
    'COD0': ['CAP','SAP','CAUE','CATE'],
    'EQ1_FPT': ['CAP','SAP','CAUE','CATE'],
    'EQ2_FPT': ['SAP','CAP','CAUE','CATE'],
    'EQ1_FDF1': ['CAP','SAP','CAUE','CATE'],
    'EQ2_FDF1': ['SAP','CAP','CAUE','CATE'],
    'CA_VSAV': ['CAUE','CATE','CAP','SAP'],
    'CA_FPT': ['CATE','CAUE','CAP','SAP'],
    'COD1': ['SAP','CAP','CAUE','CATE'],
    'COD2': ['SAP','CAP','CAUE','CATE'],
    'CA_FDF2': ['CATE','CAUE','CAP','SAP'],
    'CA_VTU': ['CAUE','CATE','CAP','SAP'],
    'CA_VPMA': ['CAUE','CATE','CAP','SAP']
};
const roleTypePriority = { 'CA':1,'COD':2,'EQ':3 };

// ---------- INITIALISATION & ÉVÉNEMENTS ----------

document.addEventListener('DOMContentLoaded', async () => {
    const userRole = sessionStorage.getItem("userRole");
    if (userRole !== "admin") {
        showAlertModal("Accès non autorisé. Vous devez être administrateur.");
        sessionStorage.clear();
        window.location.href = "index.html";
        return;
    }

    rosterDateInput.valueAsDate = currentRosterDate;

    rosterDateInput.addEventListener('change', () => {
        currentRosterDate = new Date(rosterDateInput.value);
        updateDateDisplay();
    });
    prevDayButton.addEventListener('click', () => {
        currentRosterDate.setDate(currentRosterDate.getDate() - 1);
        rosterDateInput.valueAsDate = currentRosterDate;
        updateDateDisplay();
    });
    nextDayButton.addEventListener('click', () => {
        currentRosterDate.setDate(currentRosterDate.getDate() + 1);
        rosterDateInput.valueAsDate = currentRosterDate;
        updateDateDisplay();
    });

    generateAutoBtn.addEventListener('click', () => {
        showConfirmationModal(
            "Voulez-vous générer automatiquement la feuille de garde pour la journée ? Les postes vides seront remplis.",
            confirmed => {
                if (confirmed) generateAutomaticRoster(formatDateToYYYYMMDD(currentRosterDate));
            }
        );
    });

    backToRosterBtn.addEventListener('click', showMainRosterGrid);

    createOnDutySlots();
    await loadInitialData();
    await updateDateDisplay();
});

// ---------- CHARGEMENT DES DONNÉES ----------

async function loadInitialData() {
    showLoading(true);
    const dateKey = formatDateToYYYYMMDD(currentRosterDate);
    try {
        await fetchAllAgents(); 
        await loadRosterConfig(dateKey);
        if (!appData[dateKey] || Object.keys(appData[dateKey].timeSlots).length === 0) {
            initializeDefaultTimeSlotsForDate(dateKey);
        }
        await loadDailyRoster(dateKey);
        await loadAllPersonnelAvailabilities();

        renderTimeSlotButtons(dateKey);
        renderOnDutyAgentsGrid();
        renderAvailablePersonnel();
        renderRosterGrid();
    } catch (error) {
        console.error("Erreur lors du chargement initial :", error);
        showAlertModal("Erreur lors du chargement initial. Vérifiez les logs.");
    } finally {
        showLoading(false);
    }
}

async function fetchAllAgents() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/agents`, {
            headers: { 'X-User-Role': 'admin' }
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        allAgents = data;
    } catch (error) {
        console.error("Erreur fetchAllAgents :", error);
        throw error;
    }
}

async function loadRosterConfig(dateKey) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) throw new Error("Invalid DateKey");
    try {
        const response = await fetch(`${API_BASE_URL}/api/roster-config/${dateKey}`);
        const data = await response.json();
        if (!response.ok) {
            if (response.status === 404) {
                appData[dateKey] = { timeSlots: {}, onDutyAgents: Array(10).fill('none') };
            } else throw new Error(data.message);
        } else {
            appData[dateKey] = {
                timeSlots: data.timeSlots || {},
                onDutyAgents: data.onDutyAgents || Array(10).fill('none')
            };
        }
    } catch (error) {
        console.error("Erreur loadRosterConfig :", error);
        throw error;
    }
}

async function saveRosterConfig(dateKey) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || !appData[dateKey]) return;
    try {
        await fetch(`${API_BASE_URL}/api/roster-config/${dateKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-User-Role': 'admin' },
            body: JSON.stringify({
                timeSlots: appData[dateKey].timeSlots,
                onDutyAgents: appData[dateKey].onDutyAgents
            })
        });
    } catch (error) {
        console.error("Erreur saveRosterConfig :", error);
        showAlertModal(`Erreur sauvegarde config : ${error.message}`);
    }
}

async function loadDailyRoster(dateKey) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) throw new Error("Invalid DateKey");
    try {
        const response = await fetch(`${API_BASE_URL}/api/daily-roster/${dateKey}`);
        const data = await response.json();
        if (!response.ok && response.status !== 404) throw new Error(data.message);
        if (response.ok) {
            for (const slotId in data.roster) {
                if (appData[dateKey].timeSlots[slotId]) {
                    appData[dateKey].timeSlots[slotId].engines = data.roster[slotId].engines || {};
                }
            }
        } else {
            for (const slotId in appData[dateKey].timeSlots) {
                for (const engineType of ['FPT','CCF','VSAV','VTU','VPMA']) {
                    appData[dateKey].timeSlots[slotId].engines[engineType] = createEmptyEngineAssignment(engineType);
                }
            }
        }
    } catch (error) {
        console.error("Erreur loadDailyRoster :", error);
        throw error;
    }
}

async function saveDailyRoster(dateKey) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || !appData[dateKey]) return;
    const rosterToSave = {};
    for (const slotId in appData[dateKey].timeSlots) {
        rosterToSave[slotId] = { engines: appData[dateKey].timeSlots[slotId].engines };
    }
    try {
        await fetch(`${API_BASE_URL}/api/daily-roster/${dateKey}`, {
            method: 'POST',
            headers: { 'Content-Type':'application/json','X-User-Role':'admin' },
            body: JSON.stringify({ roster: rosterToSave })
        });
        showAlertModal("Feuille de garde enregistrée avec succès !");
    } catch (error) {
        console.error("Erreur saveDailyRoster :", error);
        showAlertModal(`Erreur sauvegarde garde : ${error.message}`);
    }
}

async function loadAllPersonnelAvailabilities() {
    const agentsResp = await fetch(`${API_BASE_URL}/api/admin/agents`,{headers:{'X-User-Role':'admin'}});
    const agents = await agentsResp.json();
    const allAvail = {};
    for (const agent of agents) {
        try {
            const resp = await fetch(`${API_BASE_URL}/api/planning/${agent.id}`);
            if (!resp.ok) continue;
            const plan = await resp.json();
            for (const weekKey in plan) {
                const weekNum = parseInt(weekKey.replace('week-',''));
                const year = currentRosterDate.getFullYear();
                for (const day in plan[weekKey]) {
                    const date = getDateFromWeekAndDay(year, weekNum, day);
                    const dateKey = formatDateToYYYYMMDD(date);
                    allAvail[agent.id] = allAvail[agent.id]||{};
                    allAvail[agent.id][dateKey]=[];
                    plan[weekKey][day].forEach(range=>{
                        const [s,e]=range.split(' - ').map(s=>s.trim());
                        allAvail[agent.id][dateKey].push({start:s,end:e});
                    });
                }
            }
        } catch(e){
            console.error(`Planning ${agent.id} :`,e);
        }
    }
    appData.personnelAvailabilities = allAvail;
    renderAvailablePersonnel();
}

// ---------- GESTION DES CRÉNEAUX HORAIRE & UI ----------

function renderTimeSlotButtons(dateKey) {
    const container = document.getElementById('time-slot-buttons-container');
    container.innerHTML = '';

    // Bouton "+"
    const addBtn = document.createElement('button');
    addBtn.id = 'add-time-slot-btn';
    addBtn.classList.add('px-4','py-2','rounded-full','bg-green-500','text-white','hover:bg-green-600');
    addBtn.textContent = '+';
    addBtn.title = 'Ajouter un nouveau créneau horaire';
    addBtn.addEventListener('click', () => {
        showTimeRangePromptModal('07:00','07:00',(newStart,newEnd)=>{
            if (newStart && newEnd) {
                const slotId = `slot_${newStart.replace(':','')}_${newEnd.replace(':','')}_${Date.now()}`;
                appData[dateKey].timeSlots[slotId] = {
                    range: `${newStart} - ${newEnd}`,
                    engines: {}
                };
                ['FPT','CCF','VSAV','VTU','VPMA'].forEach(type=>{
                    appData[dateKey].timeSlots[slotId].engines[type] = createEmptyEngineAssignment(type);
                });
                saveRosterConfig(dateKey);
                renderTimeSlotButtons(dateKey);
                renderAvailablePersonnel();
            }
        });
    });
    container.appendChild(addBtn);

    // Tous les créneaux existants
    const slots = Object.entries(appData[dateKey].timeSlots)
        .sort((a,b)=>{
            const t1 = parseTimeToMinutes(a[1].range.split(' - ')[0]);
            const t2 = parseTimeToMinutes(b[1].range.split(' - ')[0]);
            return t1 - t2;
        });

    slots.forEach(([slotId,slot])=>{
        const btn = document.createElement('button');
        btn.classList.add('time-slot-button','px-4','py-2','border','rounded-md');
        btn.dataset.slotId = slotId;
        btn.textContent = slot.range;
        // suppression
        const del = document.createElement('span');
        del.textContent = '×';
        del.classList.add('ml-2','text-red-500','cursor-pointer');
        del.addEventListener('click',e=>{
            e.stopPropagation();
            showConfirmationModal(`Supprimer ${slot.range} ?`,confirmed=>{
                if(confirmed){
                    delete appData[dateKey].timeSlots[slotId];
                    saveRosterConfig(dateKey);
                    renderTimeSlotButtons(dateKey);
                    renderAvailablePersonnel();
                }
            });
        });
        btn.appendChild(del);
        // sélection
        btn.addEventListener('click',()=>{
            document.querySelectorAll('.time-slot-button').forEach(x=>x.classList.remove('bg-blue-500','text-white'));
            btn.classList.add('bg-blue-500','text-white');
            displayEnginesForSlot(dateKey,slotId);
        });
        container.appendChild(btn);
    });
}

function createEmptyEngineAssignment(engineType) {
    const personnel = {};
    (engineRoles[engineType]||[]).forEach(role=>{
        personnel[role]='none';
    });
    return { personnel };
}

// Initialise par défaut si aucune config
function initializeDefaultTimeSlotsForDate(dateKey) {
    if (!appData[dateKey]) appData[dateKey]={timeSlots:{},onDutyAgents:Array(10).fill('none')};
    if (Object.keys(appData[dateKey].timeSlots).length>0) return;
    const defaults = [
        {id:`slot_0700_1400_${Date.now()}`,range:'07:00 - 14:00'},
        {id:`slot_1400_1700_${Date.now()+1}`,range:'14:00 - 17:00'},
        {id:`slot_1700_0700_${Date.now()+2}`,range:'17:00 - 07:00'},
    ];
    defaults.forEach(d=>{
        appData[dateKey].timeSlots[d.id]={range:d.range,engines:{}};
        ['FPT','CCF','VSAV','VTU','VPMA'].forEach(type=>{
            appData[dateKey].timeSlots[d.id].engines[type]=createEmptyEngineAssignment(type);
        });
    });
    saveRosterConfig(dateKey);
}

// Affiche les engins pour un créneau
function displayEnginesForSlot(dateKey,slotId) {
    rosterGridContainer.style.display='none';
    document.querySelector('.personnel-management-section').style.display='grid';
    engineDetailsPage.style.display='block';
    const grid = engineDetailsPage.querySelector('.engine-grid');
    grid.innerHTML='';
    const slot = appData[dateKey].timeSlots[slotId];
    if (!slot) {
        grid.innerHTML='<p>Aucune donnée pour ce créneau.</p>';
        return;
    }
    ['FPT','CCF','VSAV','VTU','VPMA'].forEach(engineType=>{
        let eng = slot.engines[engineType];
        if(!eng){
            eng=createEmptyEngineAssignment(engineType);
            slot.engines[engineType]=eng;
        }
        const div = document.createElement('div');
        div.classList.add('engine-case');
        div.dataset.engineType=engineType;
        div.dataset.slotId=slotId;
        let html=`<h3>${engineType}</h3><ul>`;
        (engineRoles[engineType]||[]).forEach(role=>{
            const pid=eng.personnel[role];
            const p = allAgents.find(a=>a.id===pid);
            html+=`<li>${role}: ${p?`${p.prenom} ${p.nom}`:'Non assigné'}</li>`;
        });
        html+='</ul>';
        div.innerHTML=html;
        div.addEventListener('click',()=>openPersonnelAssignmentModal(dateKey,slotId,engineType));
        grid.appendChild(div);
    });
}

// Création de la modale d’affectation
function createPersonnelAssignmentModal() {
    // implémentation inchangée…
}

// Ouvre la modale
function openPersonnelAssignmentModal(dateKey,slotId,engineType) {
    // implémentation inchangée…
}

// Vérifie doublon dans un engin
function isPersonnelAlreadyAssignedInEngine(personnelId,currentAssignments,roleBeingAssigned) {
    if(personnelId==='none')return null;
    for(const role in currentAssignments){
        if(role!==roleBeingAssigned && currentAssignments[role]===personnelId){
            const p=allAgents.find(a=>a.id===personnelId);
            return {role,personnelName:`${p.prenom} ${p.nom}`};
        }
    }
    return null;
}

// Sauvegarde de la modale
async function savePersonnelAssignments() {
    // implémentation inchangée…
}

// Modale prompt plage horaire
function showTimeRangePromptModal(start,end,callback) {
    // implémentation inchangée…
}

// ----- Drag & Drop pour les cases d'astreinte -----

function handleDragStart(e) {
  const agentId = e.target.dataset.agentId;
  e.dataTransfer.setData('text/plain', agentId);
  e.target.classList.add('dragging');
}

function handleDragOver(e) {
  e.preventDefault();
  if (e.target.classList.contains('on-duty-slot')) {
    e.target.classList.add('drag-over');
  }
}

function handleDragLeave(e) {
  if (e.target.classList.contains('on-duty-slot')) {
    e.target.classList.remove('drag-over');
  }
}

async function handleDropOnDuty(e) {
  e.preventDefault();
  e.target.classList.remove('drag-over');
  const droppedAgentId = e.dataTransfer.getData('text/plain');
  const idx = parseInt(e.target.dataset.slotIndex, 10);
  const dateKey = formatDateToYYYYMMDD(currentRosterDate);

  let onDuty = appData[dateKey].onDutyAgents || Array(10).fill('none');

  const existing = onDuty.indexOf(droppedAgentId);
  if (existing !== -1) {
    if (existing !== idx) {
      if (onDuty[idx] !== 'none') {
        onDuty[existing] = onDuty[idx];
      } else {
        onDuty[existing] = 'none';
      }
      onDuty[idx] = droppedAgentId;
    }
  } else {
    if (onDuty[idx] === 'none') {
      onDuty[idx] = droppedAgentId;
    } else {
      showAlertModal("Cette case est déjà occupée. Retirez d'abord l'agent existant.");
      return;
    }
  }

  appData[dateKey].onDutyAgents = onDuty;
  renderOnDutyAgentsGrid();
  await saveRosterConfig(dateKey);
}


// ----- Création des cases d'astreinte -----

function createOnDutySlots() {
  onDutyAgentsGrid.innerHTML = '';
  for (let i = 0; i < 10; i++) {
    const slotDiv = document.createElement('div');
    slotDiv.classList.add('on-duty-slot');
    slotDiv.dataset.slotIndex = i;
    slotDiv.textContent = `Astreinte ${i + 1}`;
    slotDiv.addEventListener('dragstart', handleDragStart);
    slotDiv.addEventListener('dragover', handleDragOver);
    slotDiv.addEventListener('dragleave', handleDragLeave);
    slotDiv.addEventListener('drop', handleDropOnDuty);
    onDutyAgentsGrid.appendChild(slotDiv);
  }
}

function renderOnDutyAgentsGrid() {
  onDutyAgentsGrid.querySelectorAll('.on-duty-slot').forEach(slotDiv => {
    const idx = parseInt(slotDiv.dataset.slotIndex, 10);
    const dateKey = formatDateToYYYYMMDD(currentRosterDate);
    let onDuty = appData[dateKey].onDutyAgents;
    if (!Array.isArray(onDuty) || onDuty.length !== 10) {
      onDuty = appData[dateKey].onDutyAgents = Array(10).fill('none');
    }
    const pid = onDuty[idx];
    const agent = allAgents.find(a => a.id === pid);
    slotDiv.textContent = agent && pid !== 'none'
      ? `${agent.prenom} ${agent.nom}`
      : `Astreinte ${idx + 1}`;
    slotDiv.className = 'on-duty-slot';
    if (agent && pid !== 'none') {
      slotDiv.classList.add('filled');
      slotDiv.setAttribute('draggable', true);
    } else {
      slotDiv.removeAttribute('draggable');
    }
  });
  renderAvailablePersonnel();
}


// ----- Grille principale de la feuille de garde -----

function renderRosterGrid() {
  rosterGridContainer.innerHTML = '';
  const table = document.createElement('table');
  table.classList.add('roster-table');

  // En-tête
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  headerRow.insertCell().textContent = "Poste / Agent";
  horaires.forEach(slot => {
    const th = document.createElement('th');
    th.textContent = slot.split(' - ')[0];
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Corps
  const tbody = document.createElement('tbody');
  const teamRow = tbody.insertRow();
  teamRow.insertCell().textContent = "Équipe";
  const dateKey = formatDateToYYYYMMDD(currentRosterDate);
  const cfgSlots = Object.values(appData[dateKey]?.timeSlots || {});

  horaires.forEach(fullSlot => {
    const cell = teamRow.insertCell();
    cell.classList.add('roster-cell');
    const overlap = cfgSlots.find(cfg => doTimeRangesOverlap(
      { start: fullSlot.split(' - ')[0], end: fullSlot.split(' - ')[1] },
      { start: cfg.range.split(' - ')[0], end: cfg.range.split(' - ')[1] }
    ));
    if (overlap) {
      cell.addEventListener('dragover', handleDragOverRoster);
      cell.addEventListener('dragleave', handleDragLeaveRoster);
      cell.addEventListener('drop', handleDropRoster);
    } else {
      cell.classList.add('disabled');
    }
  });

  table.appendChild(tbody);
  rosterGridContainer.appendChild(table);
}
// ---------- Drag & Drop pour la grille de la feuille de garde ----------

function handleDragOverRoster(e) {
  e.preventDefault();
  if (e.target.classList.contains('roster-cell') && !e.target.classList.contains('disabled')) {
    e.target.classList.add('drag-over');
  }
}

function handleDragLeaveRoster(e) {
  e.target.classList.remove('drag-over');
}

async function handleDropRoster(e) {
  e.preventDefault();
  e.target.classList.remove('drag-over');

  if (e.target.classList.contains('disabled')) {
    showAlertModal("Vous ne pouvez pas affecter un agent à un créneau non configuré.");
    return;
  }

  const droppedAgentId = e.dataTransfer.getData('text/plain');
  const fullSlot = e.target.dataset.timeSlot;
  if (!droppedAgentId || !fullSlot) return;

  const agentInfo = allAgents.find(a => a.id === droppedAgentId);
  if (!agentInfo) return;

  const dateKey = formatDateToYYYYMMDD(currentRosterDate);

  // Trouve le créneau configuré contenant ce 30min
  const relevantSlotId = Object.keys(appData[dateKey].timeSlots || {}).find(slotId => {
    const cfg = appData[dateKey].timeSlots[slotId];
    return doTimeRangesOverlap(
      { start: fullSlot.split(' - ')[0], end: fullSlot.split(' - ')[1] },
      { start: cfg.range.split(' - ')[0], end: cfg.range.split(' - ')[1] }
    );
  });

  if (!relevantSlotId) {
    showAlertModal("Impossible d'affecter un agent à ce créneau.");
    return;
  }

  // Assure la structure FPT/EQ existe
  const slotEngines = appData[dateKey].timeSlots[relevantSlotId].engines;
  if (!slotEngines.FPT) {
    slotEngines.FPT = createEmptyEngineAssignment('FPT');
  }

  // Vérifie si EQ est déjà rempli
  if (slotEngines.FPT.personnel.EQ !== 'none') {
    showAlertModal("Un agent est déjà assigné à ce poste.");
    return;
  }

  // Assigne l'agent
  slotEngines.FPT.personnel.EQ = droppedAgentId;

  renderRosterGrid();
  await saveDailyRoster(dateKey);
  showAlertModal(`Agent ${agentInfo.prenom} ${agentInfo.nom} assigné.`);
}


// ---------- Fonctions de génération automatique ----------

function getQualifiedPersonnelForRole(role, personnelPool) {
  const preferredGrades = roleGradePreferences[role] || [];
  return personnelPool
    .filter(p => p.qualifications.includes(role))
    .sort((a, b) => {
      const ia = preferredGrades.indexOf(a.grade);
      const ib = preferredGrades.indexOf(b.grade);
      const va = ia === -1 ? Infinity : ia;
      const vb = ib === -1 ? Infinity : ib;
      return va - vb;
    });
}

function assignPersonnelToSlot(dateKey, slotId) {
  const slot = appData[dateKey].timeSlots[slotId];
  const onDutyIds = appData[dateKey].onDutyAgents.filter(id => id !== 'none');
  const onDutyPersonnel = onDutyIds
    .map(id => allAgents.find(p => p.id === id))
    .filter(p => p);

  ['FPT','CCF','VSAV','VTU','VPMA'].forEach(engineType => {
    const engAssign = slot.engines[engineType];
    const assignedInEngine = new Set(Object.values(engAssign.personnel).filter(id => id !== 'none'));

    // Trier les rôles par priorité
    const roles = (engineRoles[engineType] || []).sort((a, b) => {
      return (roleTypePriority[getRoleType(a)] || Infinity) 
           - (roleTypePriority[getRoleType(b)] || Infinity);
    });

    roles.forEach(role => {
      if (engAssign.personnel[role] !== 'none') return;

      // Filtrer candidats dispo et non encore assignés dans cet engin
      const candidates = onDutyPersonnel.filter(p => {
        if (!p.qualifications.includes(role)) return false;
        if (assignedInEngine.has(p.id)) return false;
        const daily = appData.personnelAvailabilities[p.id]?.[dateKey] || [];
        return daily.some(avail => 
          doTimeRangesOverlap(
            { start: slot.range.split(' - ')[0], end: slot.range.split(' - ')[1] },
            avail
          )
        );
      });

      const qualified = getQualifiedPersonnelForRole(role, candidates);
      if (qualified.length === 0) return;

      const bestGrade = gradePriority[qualified[0].grade];
      const topCands = qualified.filter(p => gradePriority[p.grade] === bestGrade);

      // Choix aléatoire si ex æquo
      const pick = topCands[Math.floor(Math.random() * topCands.length)];
      engAssign.personnel[role] = pick.id;
      assignedInEngine.add(pick.id);
    });
  });
}

async function generateAutomaticRoster(dateKey) {
  if (!appData[dateKey]) {
    appData[dateKey] = { timeSlots:{}, onDutyAgents: Array(10).fill('none') };
    initializeDefaultTimeSlotsForDate(dateKey);
  }

  showLoading(true);
  rosterGridContainer.innerHTML = '<p class="loading-message">Génération automatique en cours...</p>';

  for (const slotId in appData[dateKey].timeSlots) {
    assignPersonnelToSlot(dateKey, slotId);
  }

  await saveDailyRoster(dateKey);
  renderRosterGrid();
  showLoading(false);
  showAlertModal("La feuille de garde a été générée automatiquement !");
}


// ---------- Fonctions utilitaires diverses ----------

function getDateFromWeekAndDay(year, weekNumber, dayName) {
  const simple = new Date(year, 0, 1 + (weekNumber - 1) * 7);
  const dow = simple.getDay() || 7;
  if (dow <= 4) simple.setDate(simple.getDate() - dow + 1);
  else simple.setDate(simple.getDate() + 8 - dow);

  const daysMap = {
    'lundi': 0, 'mardi': 1, 'mercredi': 2, 'jeudi': 3,
    'vendredi':4, 'samedi':5, 'dimanche':6
  };
  const offset = daysMap[dayName];
  if (offset === undefined) return null;
  simple.setDate(simple.getDate() + offset);
  return simple;
}

function showLoading(isLoading) {
  if (isLoading) {
    loadingSpinner && loadingSpinner.classList.remove('hidden');
    document.body.classList.add('loading-active');
    document.querySelectorAll('button, input, select, a').forEach(el => el.disabled = true);
  } else {
    loadingSpinner && loadingSpinner.classList.add('hidden');
    document.body.classList.remove('loading-active');
    document.querySelectorAll('button, input, select, a').forEach(el => el.disabled = false);
  }
}
