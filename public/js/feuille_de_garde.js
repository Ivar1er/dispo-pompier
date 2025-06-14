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
  VSAV: ['CA_VSAV','COD0','EQ'],
  VTU:  ['CA_VTU','COD0','EQ'],
  VPMA: ['CA_VPMA','COD0','EQ']
};

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
function doTimeRangesOverlap(r1, r2) {
  let s1 = parseTimeToMinutes(r1.start), e1 = parseTimeToMinutes(r1.end);
  let s2 = parseTimeToMinutes(r2.start), e2 = parseTimeToMinutes(r2.end);
  if (e1 <= s1) e1 += 24*60;
  if (e2 <= s2) e2 += 24*60;
  return s1 < e2 && e1 > s2;
}
function createEmptyEngineAssignment(type) {
  const pers = {};
  (engineRoles[type] || []).forEach(role => pers[role] = 'none');
  return { personnel: pers };
}

/**
 * Convertit une heure (HH:MM) en un pourcentage de la journée (0-24h).
 * La journée est considérée de 00:00 à 24:00 pour le calcul de la largeur.
 * @param {string} timeStr - Heure au format HH:MM.
 * @returns {number} Pourcentage (0-100) représentant la position de l'heure sur 24h.
 */
function timeToPercentage(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    // Convertir l'heure en minutes depuis 00:00
    const totalMinutes = hours * 60 + minutes;
    // La journée complète fait 24 * 60 = 1440 minutes
    return (totalMinutes / 1440) * 100;
}

/**
 * Calcule la largeur et la position d'un segment de disponibilité sur une barre de 24h.
 * @param {string} startTime - Heure de début (HH:MM).
 * @param {string} endTime - Heure de fin (HH:MM).
 * @returns {Array<Object>} Un tableau d'objets { left: %, width: % } pour gérer les plages qui passent minuit.
 */
function getAvailabilitySegments(startTime, endTime) {
    let startMinutes = parseTimeToMinutes(startTime);
    let endMinutes = parseTimeToMinutes(endTime);

    const totalDayMinutes = 24 * 60; // 1440 minutes

    const segments = [];

    // **DÉBUT DE LA MODIFICATION**

    // Si la plage de temps est de durée nulle (ex: 07:00 - 07:00),
    // donnez-lui une petite largeur pour qu'elle soit visible.
    if (startMinutes === endMinutes) {
        const minWidthMinutes = 15; // Représente une durée minimale visible, par exemple 15 minutes
        let calculatedEndMinutes = endMinutes + minWidthMinutes;

        // S'assurer que le segment ne dépasse pas la fin de la journée (minuit)
        // Ou qu'il ne recouvre pas le début si c'est 00:00 - 00:00
        if (calculatedEndMinutes > totalDayMinutes || (startMinutes === 0 && endMinutes === 0)) {
            calculatedEndMinutes = totalDayMinutes;
        }

        const left = (startMinutes / totalDayMinutes) * 100;
        const width = ((calculatedEndMinutes - startMinutes) / totalDayMinutes) * 100;
        segments.push({ left, width });
        return segments; // Retourne immédiatement pour ne pas appliquer la logique ci-dessous
    }

    // **FIN DE LA MODIFICATION**

    // Cas simple: la plage ne traverse pas minuit (ex: 08:00 - 17:00)
    if (endMinutes > startMinutes) {
        const left = (startMinutes / totalDayMinutes) * 100;
        const width = ((endMinutes - startMinutes) / totalDayMinutes) * 100;
        segments.push({ left, width });
    }
    // Cas complexe: la plage traverse minuit (ex: 22:00 - 06:00)
    else {
        // Segment de début de journée jusqu'à minuit
        const left1 = (startMinutes / totalDayMinutes) * 100;
        const width1 = ((totalDayMinutes - startMinutes) / totalDayMinutes) * 100;
        segments.push({ left: left1, width: width1 });

        // Segment de minuit jusqu'à la fin de la plage (le lendemain)
        const left2 = 0; // Commence à 00:00
        const width2 = (endMinutes / totalDayMinutes) * 100;
        segments.push({ left: left2, width: width2 });
    }
    return segments;
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
    //console.log("Agents chargés:", allAgents); // Pour le débogage
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
    //console.log("Roster config chargée pour", dateKey, ":", appData[dateKey]); // Pour le débogage
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
    if (!resp.ok) throw new Error(`HTTP error! status: ${resp.status}`);
    //console.log("Roster config sauvegardée pour", dateKey); // Pour le débogage
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
    //console.log("Daily roster chargé pour", dateKey, ":", dr); // Pour le débogage
  } catch (error) {
    console.error('loadDailyRoster échoué', error);
  }
}

async function saveDailyRoster(dateKey) {
  try {
    const resp = await fetch(`${API_BASE_URL}/api/admin/daily-roster/${dateKey}`, {
      method: 'POST',
      headers: {
        'Content-Type':'application/json',
        'X-User-Role':'admin'
      },
      credentials: 'include',
      body: JSON.stringify({ onDutyAgents: appData[dateKey].onDutyAgents })
    });
    if (!resp.ok) throw new Error(`HTTP error! status: ${resp.status}`);
    //console.log("Daily roster sauvegardé pour", dateKey); // Pour le débogage
  } catch (error) {
    console.error('saveDailyRoster échoué', error);
  }
}

async function loadAllPersonnelAvailabilities() {
  try {
    // Ajustement de l'API: Charger les disponibilités pour la date courante.
    // L'API devrait idéalement prendre une date en paramètre pour filtrer côté serveur.
    // Si votre API 'api/planning' retourne TOUTES les disponibilités,
    // le filtrage se fera côté client dans renderPersonnelLists.
    // Pour une meilleure performance, une API du type /api/planning?date=YYYY-MM-DD serait idéale.
    // En attendant, nous chargeons tout et filtrons.
    const resp = await fetch(`${API_BASE_URL}/api/planning`, {
      headers: {'X-User-Role':'admin'}
    });
    if (!resp.ok) throw new Error(`HTTP error! status: ${resp.status}`);
    appData.personnelAvailabilities = await resp.json();
    //console.log("Disponibilités du personnel chargées:", appData.personnelAvailabilities); // Pour le débogage
  } catch (error) {
    console.error("Erreur lors du chargement des disponibilités du personnel:", error);
    appData.personnelAvailabilities = {};
  }
}

async function loadInitialData() {
  showSpinner();
  const dateKey = formatDateToYYYYMMDD(currentRosterDate);
  await fetchAllAgents(); // Chargez tous les agents avant de charger les configs
  await loadRosterConfig(dateKey); // Charge ou initialise la config de la date
  await loadAllPersonnelAvailabilities(); // Charge toutes les dispos
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
    // Pas besoin de saveRosterConfig ici, car loadRosterConfig le gérera
  }
}


function renderTimeSlotButtons(dateKey) {
  const c = document.getElementById('time-slot-buttons-container');
  c.innerHTML = '';

  // Variable pour gérer le délai entre clics
  let clickTimeout = null;
  const DBLCLICK_DELAY = 300; // Millisecondes pour distinguer un double-clic

  // bouton “+”
  const add = document.createElement('button');
  add.textContent = '+';
  add.classList.add('add-time-slot-btn'); // Ajout d'une classe pour le CSS
  add.addEventListener('click', () => {
    // Utilisez la nouvelle modale pour l'ajout
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

      // MODIFICATION ICI: Gérer les clics et double-clics avec un timeout
      btn.addEventListener('click', () => {
        clearTimeout(clickTimeout); // Efface tout timer précédent

        clickTimeout = setTimeout(() => {
          // Si ce code s'exécute, c'est un simple clic
          document.querySelectorAll('.time-slot-button').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          displayEnginesForSlot(dateKey, slotId);
        }, DBLCLICK_DELAY);
      });

      btn.addEventListener('dblclick', async (event) => {
        event.stopPropagation(); // Empêche la propagation du dblclick
        clearTimeout(clickTimeout); // Annule le timer du simple clic
        
        const [cs, ce] = slot.range.split(' - ');
        // Utilisez la nouvelle modale pour la modification
        showTimeRangeSelectionModal(cs, ce, async (ns, ne) => {
          slot.range = `${ns} - ${ne}`;
          await saveRosterConfig(dateKey);

          let sMin = parseTimeToMinutes(ns),
              eMin = parseTimeToMinutes(ne);
          if (eMin <= sMin) eMin += 24*60; // Gère les plages qui passent minuit
          const dayEndMinutes = parseTimeToMinutes('07:00') + 24*60; // 7:00 AM le lendemain pour la fin de cycle

          // Logique pour potentiellement créer un nouveau créneau pour le reste du cycle de 24h.
          // Cette partie doit être bien testée pour s'assurer qu'elle correspond au besoin.
          // Si vous modifiez un créneau "07:00 - 07:00" en "07:00 - 15:00",
          // cette logique créera un créneau "15:00 - 07:00" pour couvrir le reste de la journée.
          if (eMin < dayEndMinutes && ns !== ne) {
            const newSlotStartTime = ne;
            const newSlotEndTime = '07:00'; // Toujours 07:00 le lendemain pour boucler 24h

            const newSlotId = `slot_${newSlotStartTime.replace(':','')}_${newSlotEndTime.replace(':','')}_${Date.now()}`;
            
            // Vérifie si un créneau similaire existe déjà pour éviter les doublons
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
                await saveRosterConfig(dateKey); // Sauvegarde le nouveau créneau
            }
          }
          renderTimeSlotButtons(dateKey);
          renderRosterGrid();
          showMainRosterGrid();
        });
      });

      // Bouton de suppression pour chaque créneau
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
  rosterGridContainer.innerHTML = ''; // Nettoie le conteneur

  const dateKey = formatDateToYYYYMMDD(currentRosterDate);
  const currentConfig = appData[dateKey];

  if (!currentConfig || Object.keys(currentConfig.timeSlots).length === 0) {
    rosterGridContainer.innerHTML = '<p class="loading-message">Aucun créneau horaire configuré pour cette date.</p>';
    return;
  }

  const table = document.createElement('table');
  table.classList.add('roster-table'); // Ajoutez une classe pour le CSS

  // Créer l'en-tête du tableau
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  headerRow.innerHTML = '<th>Créneau Horaire</th>'; // Colonne pour les créneaux

  // Ajouter les types d'engins comme en-têtes de colonnes
  Object.keys(engineRoles).forEach(engineType => {
    const th = document.createElement('th');
    th.textContent = engineType;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Créer le corps du tableau
  const tbody = document.createElement('tbody');
  // Trier les créneaux par heure de début
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

    // Ajouter les cellules pour chaque type d'engin
    Object.keys(engineRoles).forEach(engineType => {
      const engineCell = document.createElement('td');
      engineCell.classList.add('roster-cell'); // Pour le CSS et le drag-over si besoin
      engineCell.dataset.slotId = slotId; // Ajouter des data-attributs pour le JS
      engineCell.dataset.engineType = engineType;

      const assignedEngine = slot.engines[engineType];
      if (assignedEngine && assignedEngine.personnel) {
        const ul = document.createElement('ul');
        ul.classList.add('engine-personnel-list');
        Object.entries(assignedEngine.personnel).forEach(([role, agentId]) => {
          const li = document.createElement('li');
          const agent = allAgents.find(a => a._id === agentId);
          // Afficher le rôle et le nom de l'agent, ou "Non affecté" si 'none'
          li.textContent = `${role}: ${agent && agentId !== 'none' ? agent.name : 'Non affecté'}`;
          ul.appendChild(li);
        });
        engineCell.appendChild(ul);
      } else {
        engineCell.textContent = 'Non configuré'; // Ou un bouton pour configurer
      }

      // Ajouter les événements de drag & drop pour l'affectation manuelle des agents aux engins (TODO plus tard)
      engineCell.addEventListener('dragover', handleDragOver);
      engineCell.addEventListener('dragleave', handleDragLeave);
      engineCell.addEventListener('drop', handleDropOnEngine); // Nouvelle fonction pour le drop sur un engin

      row.appendChild(engineCell);
    });
    tbody.appendChild(row);
  });
  table.appendChild(tbody);

  rosterGridContainer.appendChild(table);
  document.querySelector('.loading-message')?.remove(); // Supprime le message de chargement une fois le tableau rendu
}

function renderPersonnelLists() {
  availablePersonnelList.innerHTML = '';
  const dateKey = formatDateToYYYYMMDD(currentRosterDate);
  const onDutyAgents = appData[dateKey]?.onDutyAgents || Array(10).fill('none'); // Agents actuellement d'astreinte

  // Filtrer les agents disponibles : ceux qui ne sont PAS dans la liste d'astreinte
  // ET qui ont au moins une disponibilité pour la date actuelle.
  const filteredAvailableAgents = allAgents.filter(agent => {
    const isAlreadyOnDuty = onDutyAgents.includes(agent._id);
    if (isAlreadyOnDuty) return false;

    // Récupérer les disponibilités de l'agent pour la date courante
    const agentAvailabilities = appData.personnelAvailabilities[agent._id] || {};
    const dailyAvailabilities = agentAvailabilities[dateKey] || [];
    
    // Un agent est "disponible" s'il a au moins une plage renseignée pour la journée
    const hasAnyAvailability = dailyAvailabilities.length > 0;
    
    return hasAnyAvailability;
  });

  if (filteredAvailableAgents.length === 0) {
      availablePersonnelList.innerHTML = '<p class="no-available-personnel">Aucun agent disponible avec des disponibilités renseignées pour cette journée.</p>';
  }

  filteredAvailableAgents.forEach(agent => {
    const item = document.createElement('div');
    item.classList.add('available-personnel-item');
    item.textContent = agent.name;
    item.dataset.agentId = agent._id;
    item.setAttribute('draggable', true);
    item.addEventListener('dragstart', handleDragStart);

    // Récupérer les disponibilités de l'agent pour la date courante
    const agentAvailabilities = appData.personnelAvailabilities[agent._id] || {};
    const dailyAvailabilities = agentAvailabilities[dateKey] || [];

    // Créer la barre de disponibilité visuelle
    const availabilityBar = document.createElement('div');
    availabilityBar.classList.add('availability-bar');
    
    // Créer un div "base" de la barre de 24h
    const baseBar = document.createElement('div');
    baseBar.classList.add('availability-base-bar'); // Nouvelle classe CSS
    
    // Ajouter les segments de disponibilité par-dessus
    dailyAvailabilities.forEach(range => {
        const segments = getAvailabilitySegments(range.start, range.end);
        segments.forEach(segment => {
            const highlightSegment = document.createElement('div');
            highlightSegment.classList.add('availability-highlight-segment'); // Nouvelle classe CSS
            highlightSegment.style.left = `${segment.left}%`;
            highlightSegment.style.width = `${segment.width}%`;
            highlightSegment.title = `${range.start} - ${range.end}`; // Infobulle
            baseBar.appendChild(highlightSegment);
        });
    });
    
    availabilityBar.appendChild(baseBar);
    item.appendChild(availabilityBar); // Ajoute la barre à l'élément de l'agent
    
    availablePersonnelList.appendChild(item);
  });
}

function renderOnDutyAgentsGrid() {
  onDutyAgentsGrid.innerHTML = '';
  const dateKey = formatDateToYYYYMMDD(currentRosterDate);
  const onDutyAgents = appData[dateKey].onDutyAgents || Array(10).fill('none');

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
        const agentNameDiv = document.createElement('div');
        agentNameDiv.classList.add('agent-name');
        agentNameDiv.textContent = agent.name;
        slot.appendChild(agentNameDiv);

        // Afficher les disponibilités de l'agent d'astreinte aussi
        const agentAvailabilities = appData.personnelAvailabilities[agent._id] || {};
        const dailyAvailabilities = agentAvailabilities[dateKey] || [];

        const availabilityBar = document.createElement('div');
        availabilityBar.classList.add('availability-bar');
        const baseBar = document.createElement('div');
        baseBar.classList.add('availability-base-bar');

        dailyAvailabilities.forEach(range => {
            const segments = getAvailabilitySegments(range.start, range.end);
            segments.forEach(segment => {
                const highlightSegment = document.createElement('div');
                highlightSegment.classList.add('availability-highlight-segment');
                highlightSegment.style.left = `${segment.left}%`;
                highlightSegment.style.width = `${segment.width}%`;
                highlightSegment.title = `${range.start} - ${range.end}`;
                baseBar.appendChild(highlightSegment);
            });
        });
        availabilityBar.appendChild(baseBar);
        slot.appendChild(availabilityBar);

        const removeBtn = document.createElement('button');
        removeBtn.classList.add('remove-agent-btn');
        removeBtn.textContent = 'x';
        removeBtn.addEventListener('click', async (e) => {
          e.stopPropagation(); // Empêche le drop si on clique sur le X
          appData[dateKey].onDutyAgents[i] = 'none'; // Retire l'agent du slot
          await saveDailyRoster(dateKey);
          updateDateDisplay(); // Re-render pour mettre à jour les listes
        });
        slot.appendChild(removeBtn);
      } else {
        slot.textContent = `Astreinte ${i+1} (Agent inconnu)`;
      }
    } else {
      slot.textContent = `Astreinte ${i+1}`;
    }
  }
}

async function updateDateDisplay() {
  showSpinner();
  const dateKey = formatDateToYYYYMMDD(currentRosterDate);
  await loadRosterConfig(dateKey); // Recharge la config pour la nouvelle date
  await loadDailyRoster(dateKey); // Recharge les agents d'astreinte
  initializeDefaultTimeSlotsForDate(dateKey); // S'assure qu'un slot par défaut existe
  await loadAllPersonnelAvailabilities(); // Recharger les dispo pour la nouvelle date (si l'API était filtrée)

  rosterDateInput.valueAsDate = currentRosterDate; // Met à jour l'input date
  renderTimeSlotButtons(dateKey);
  renderPersonnelLists(); // Mise à jour de la liste du personnel disponible
  renderOnDutyAgentsGrid(); // Mise à jour de la grille des agents d'astreinte
  renderRosterGrid(); // Mise à jour de la grille principale
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
    modal.classList.add('custom-modal'); // Utiliser la classe générale pour les modales
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

  // Remplir les selects avec des options de 30 minutes
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

  // Sélectionner les valeurs par défaut
  startTimeSelect.value = currentStart;
  endTimeSelect.value = currentEnd;

  // Afficher la modale
  modal.style.display = 'flex';

  // Nettoyer les écouteurs précédents
  saveButton.onclick = null;
  cancelButton.onclick = null;

  // Gérer les actions
  saveButton.onclick = () => {
    const newStart = startTimeSelect.value;
    const newEnd = endTimeSelect.value;
    modal.style.display = 'none';
    callback(newStart, newEnd);
  };

  cancelButton.onclick = () => {
    modal.style.display = 'none';
  };

  // Fermer la modale si on clique en dehors
  modal.onclick = (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  };
}


// Variables pour le drag & drop
let draggedAgentId = null;

function handleDragStart(e) {
  draggedAgentId = e.target.dataset.agentId; // Stocke l'ID de l'agent dragué
  e.dataTransfer.setData('text/plain', draggedAgentId); // Nécessaire pour le drop
  e.target.classList.add('dragging');
  //console.log("Drag started:", draggedAgentId);
}
function handleDragOver(e) {
  e.preventDefault(); // Permet le drop
  if (e.target.classList.contains('on-duty-slot') || e.target.classList.contains('roster-cell') || e.target.classList.contains('engine-case')) {
    e.target.classList.add('drag-over');
  }
}
function handleDragLeave(e) {
  e.target.classList.remove('drag-over');
}
async function handleDropOnDuty(e) {
  e.preventDefault();
  e.target.classList.remove('drag-over');
  // Assurez-vous de cibler le slot, pas un enfant de celui-ci
  const targetSlot = e.target.closest('.on-duty-slot');
  if (!targetSlot) return; // Si le drop n'est pas sur un slot valide

  const slotIndex = targetSlot.dataset.slotIndex;
  const dateKey = formatDateToYYYYMMDD(currentRosterDate);

  if (draggedAgentId) {
    // Vérifier si l'agent est déjà dans un autre slot d'astreinte et le retirer
    const existingIndex = appData[dateKey].onDutyAgents.indexOf(draggedAgentId);
    if (existingIndex > -1) {
      appData[dateKey].onDutyAgents[existingIndex] = 'none'; // Libère l'ancien slot
    }

    // Si le slot de destination est déjà rempli par un agent différent, on le déplace
    const targetAgentId = appData[dateKey].onDutyAgents[slotIndex];
    if (targetAgentId && targetAgentId !== 'none' && targetAgentId !== draggedAgentId) {
        // Option simple : l'agent qui était là retourne dans la liste des disponibles
        // Si vous voulez échanger, la logique serait plus complexe ici
    }
    appData[dateKey].onDutyAgents[slotIndex] = draggedAgentId; // Placer le nouvel agent

    await saveDailyRoster(dateKey); // Sauvegarder les modifications
    updateDateDisplay(); // Re-render pour mettre à jour les listes
  }
  draggedAgentId = null; // Réinitialiser
}

async function handleDropOnEngine(e) {
  e.preventDefault();
  e.target.classList.remove('drag-over');
  const agentId = e.dataTransfer.getData('text/plain'); // Récupère l'ID de l'agent dragué
  const dateKey = formatDateToYYYYMMDD(currentRosterDate);

  // Cibler l'élément .engine-case ou .roster-cell parent
  const targetElement = e.target.closest('.engine-case') || e.target.closest('.roster-cell');
  if (!targetElement) {
    console.warn("Drop non valide : pas sur un engin ou une cellule de roster.");
    return;
  }

  const slotId = targetElement.dataset.slotId;
  const engineType = targetElement.dataset.engineType;

  if (agentId && slotId && engineType) {
    // Si l'agent est un agent d'astreinte, on le retire de l'astreinte
    const onDutyAgents = appData[dateKey].onDutyAgents;
    const onDutyIndex = onDutyAgents.indexOf(agentId);
    if (onDutyIndex !== -1) {
        onDutyAgents[onDutyIndex] = 'none'; // Libère le slot d'astreinte
        await saveDailyRoster(dateKey); // Sauvegarder le changement dans les agents d'astreinte
    }

    const currentEngineAssignment = appData[dateKey].timeSlots[slotId].engines[engineType].personnel;
    let assigned = false;

    // Tente d'affecter l'agent au premier rôle libre ou au rôle 'EQ' par défaut
    for (const role of engineRoles[engineType]) {
      if (currentEngineAssignment[role] === 'none') {
        currentEngineAssignment[role] = agentId;
        assigned = true;
        break;
      }
    }
    // Si tous les rôles principaux sont pris, mais qu'il y a un rôle 'EQ'
    // Cette logique pourrait être ajustée si 'EQ' n'est pas un rôle par défaut pour tous
    if (!assigned && engineRoles[engineType].includes('EQ')) {
        // Vérifie si EQ est déjà pris pour éviter d'écraser un agent déjà en EQ
        if (currentEngineAssignment['EQ'] === 'none') {
            currentEngineAssignment['EQ'] = agentId;
            assigned = true;
        }
    }

    if (assigned) {
      await saveRosterConfig(dateKey); // Sauvegarder l'affectation à l'engin
      updateDateDisplay(); // Re-render pour mettre à jour l'affichage partout
    } else {
        alert("Aucun rôle libre trouvé pour cet agent dans cet engin. Veuillez utiliser la modale de gestion détaillée.");
    }
  }
  draggedAgentId = null;
}


function createOnDutySlots() {
  // Cette fonction est appelée une seule fois au démarrage
  // Le rendu du contenu réel des slots est fait par renderOnDutyAgentsGrid()
  onDutyAgentsGrid.innerHTML = '';
  for (let i = 0; i < 10; i++) {
    const slot = document.createElement('div');
    slot.classList.add('on-duty-slot');
    slot.dataset.slotIndex = i;
    // Les événements de drag & drop sont attachés dans renderOnDutyAgentsGrid et handleDropOnDuty
    onDutyAgentsGrid.appendChild(slot);
  }
}

function displayEnginesForSlot(dateKey, slotId) {
  const rosterContent = document.querySelector('.roster-content');
  rosterContent.style.display = 'none'; // Cache la grille principale

  engineDetailsPage.style.display = 'block'; // Affiche la page de détails

  const currentSlot = appData[dateKey].timeSlots[slotId];
  if (!currentSlot) {
    console.error("Créneau horaire non trouvé:", slotId);
    return;
  }

  const engineGridContainer = engineDetailsPage.querySelector('.engine-grid');
  engineGridContainer.innerHTML = ''; // Nettoie le conteneur

  Object.entries(currentSlot.engines).forEach(([engineType, assignment]) => {
    const engineCase = document.createElement('div');
    engineCase.classList.add('engine-case');
    engineCase.dataset.slotId = slotId; // Ajoutez les data-attributs pour un éventuel drop ici
    engineCase.dataset.engineType = engineType;
    engineCase.innerHTML = `
      <h3>${engineType}</h3>
      <span class="places-count">${Object.keys(engineRoles[engineType] || {}).length} places</span>
      <ul class="personnel-list">
        ${Object.entries(assignment.personnel).map(([role, agentId]) => {
          const agent = allAgents.find(a => a._id === agentId);
          return `<li><strong>${role}:</strong> ${agent && agentId !== 'none' ? agent.name : 'Non affecté'}</li>`;
        }).join('')}
      </ul>
      <button class="assign-engine-personnel-btn">Gérer le personnel</button>
    `;
    // Événement pour ouvrir la modale d'affectation détaillée (à implémenter)
    engineCase.querySelector('.assign-engine-personnel-btn').addEventListener('click', () => {
      openPersonnelAssignmentModal(dateKey, slotId, engineType);
    });

    // Ajoutez les événements de drag & drop pour l'affectation sur l'engin direct
    engineCase.addEventListener('dragover', handleDragOver);
    engineCase.addEventListener('dragleave', handleDragLeave);
    engineCase.addEventListener('drop', handleDropOnEngine); // Réutilise la même fonction

    engineGridContainer.appendChild(engineCase);
  });
}

function createPersonnelAssignmentModal() {
  // TODO: implémenter ta modale
  // Cette fonction devrait créer l'élément DOM de la modale une seule fois
  // et la rendre prête à être affichée/masquée
}
function openPersonnelAssignmentModal(dateKey, slotId, engineType) {
  // Pour l'instant, juste un message. Vous devrez implémenter la vraie modale.
  alert(`Ouvrir la modale d'affectation pour l'engin ${engineType} du créneau ${slotId} pour la date ${dateKey}.\n\n(Fonction à implémenter)`);
  // TODO: implémenter ta modale détaillée
  // Ici vous chargeriez les agents disponibles et les agents déjà affectés
  // Permettriez de glisser-déposer ou de sélectionner/désélectionner
  // Et appelleriez savePersonnelAssignments() après confirmation
}
async function savePersonnelAssignments() {
  // TODO: POST vers une API ou saveDailyRoster
  // Cette fonction serait appelée après qu'un utilisateur ait confirmé les changements dans la modale
  const dateKey = formatDateToYYYYMMDD(currentRosterDate);
  await saveRosterConfig(dateKey); // Sauvegarde la configuration avec les nouvelles affectations
  updateDateDisplay(); // Rafraîchit l'ensemble de l'affichage
}

function getQualifiedPersonnelForRole(role, pool) {
  // TODO: trier allAgents selon rôle et disponibilités
  // C'est ici que vous implémenteriez une logique de filtrage complexe
  // pour trouver les agents appropriés pour un rôle donné parmi le 'pool' (e.g., agents d'astreinte)
  // Pour l'instant, retourne tous les agents pour la démo
  return pool;
}

function assignPersonnelToSlot(dateKey, slotId) {
  const currentSlot = appData[dateKey].timeSlots[slotId];
  if (!currentSlot) return;

  const onDutyAgents = appData[dateKey].onDutyAgents.filter(id => id !== 'none'); // Agents réellement d'astreinte

  // Réinitialise les affectations pour ce créneau avant de réaffecter
  Object.keys(currentSlot.engines).forEach(engineType => {
    currentSlot.engines[engineType] = createEmptyEngineAssignment(engineType);
  });

  const availableAgentsForAuto = [...onDutyAgents]; // Copie des agents d'astreinte pour les affecter

  // Logique simple: remplir les rôles dans l'ordre des engins et des rôles
  Object.keys(engineRoles).forEach(engineType => {
    const rolesForEngine = engineRoles[engineType];
    rolesForEngine.forEach(role => {
      if (availableAgentsForAuto.length > 0) {
        const agentToAssign = availableAgentsForAuto.shift(); // Prend le premier agent disponible
        currentSlot.engines[engineType].personnel[role] = agentToAssign;
      }
    });
  });
}

async function generateAutomaticRoster(dateKey) {
  showSpinner();
  Object.keys(appData[dateKey].timeSlots).forEach(slotId => {
    assignPersonnelToSlot(dateKey, slotId);
  });
  await saveRosterConfig(dateKey); // Sauvegarde les affectations générées
  await saveDailyRoster(dateKey); // Assure que les agents d'astreinte sont bien sauvegardés si modifiés
  updateDateDisplay(); // Rafraîchit l'ensemble de l'affichage
  hideSpinner();
}

function showMainRosterGrid() {
  engineDetailsPage.style.display = 'none';
  document.querySelector('.roster-content').style.display = 'block';
  // Désélectionne tous les boutons de créneau quand on revient à la vue principale
  document.querySelectorAll('.time-slot-button').forEach(b => b.classList.remove('active'));
}

function showSpinner() {
    loadingSpinner.classList.remove('hidden');
}

function hideSpinner() {
    loadingSpinner.classList.add('hidden');
}


document.addEventListener('DOMContentLoaded', async () => {
  const role = sessionStorage.getItem("userRole");
  if (role !== "admin") return window.location.href = "index.html";

  // Valeur initiale de la date
  rosterDateInput.valueAsDate = currentRosterDate;

  // Navigation jour
  prevDayButton.addEventListener('click', async () => {
    currentRosterDate.setDate(currentRosterDate.getDate() - 1);
    await updateDateDisplay();
  });
  nextDayButton.addEventListener('click', async () => {
    currentRosterDate.setDate(currentRosterDate.getDate() + 1);
    await updateDateDisplay();
  });

  // Changement manuel de date
  rosterDateInput.addEventListener('change', async (e) => {
    currentRosterDate = e.target.valueAsDate;
    await updateDateDisplay();
  });

  // Génération automatique
  generateAutoBtn.addEventListener('click', async () => {
    if (confirm("Générer automatiquement ce planning ? Cela écrasera les affectations manuelles.")) {
      await generateAutomaticRoster(formatDateToYYYYMMDD(currentRosterDate));
      alert("Génération automatique terminée.");
    }
  });

  // Retour à la vue principale
  backToRosterBtn.addEventListener('click', showMainRosterGrid);

  // Création des cases d’astreinte (structure HTML)
  createOnDutySlots();

  // Chargements + affichage initial
  await loadInitialData();
  await updateDateDisplay();

  // AJOUT : Assurez-vous que la vue principale est affichée au chargement initial
  showMainRosterGrid();
});