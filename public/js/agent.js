document.addEventListener('DOMContentLoaded', () => {
  // --- Affichage prénom + nom agent ---
  const agentNameDisplay = document.getElementById('agent-name-display');
  // Récupérer les informations de l'agent depuis le sessionStorage
  const agent = JSON.parse(sessionStorage.getItem("agent"));
  if (agent && agent.firstName && agent.lastName) {
    agentNameDisplay.textContent = `${agent.firstName} ${agent.lastName}`;
  } else {
    agentNameDisplay.textContent = 'Agent Inconnu';
  }

  // --- Affichage des qualifications (à compléter avec la logique réelle) ---
  const agentQualificationsDisplay = document.getElementById('agentQualificationsDisplay');
  // Exemple de qualifications (vous devrez les récupérer de l'objet agent ou de l'API)
  if (agent && agent.qualifications && agent.qualifications.length > 0) {
    // Supposons que nous avons une fonction pour obtenir les noms des qualifications par leur ID
    // Pour l'instant, affichons juste les IDs, ou une chaîne jointe
    agentQualificationsDisplay.textContent = `Qualifications: ${agent.qualifications.join(', ').toUpperCase()}`;
  } else {
    agentQualificationsDisplay.textContent = 'Aucune qualification renseignée.';
  }

  // URL de base de votre API (doit correspondre à celle du serveur)
  const API_BASE_URL = "https://dispo-pompier.onrender.com";

  // --- Fonctions de date (synchronisées avec le serveur et disponibles ici) ---
  function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1)/7);
    return weekNo;
  }

  function getMonday(d) {
    d = new Date(d);
    const day = d.getDay();
    const diff = (day === 0 ? -6 : 1) - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0,0,0,0);
    return d;
  }

  function formatDate(d) {
    return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2, '0')}`;
  }

  // Fonction pour obtenir la date au format YYYY-MM-DD
  function formatDateToYYYYMMDD(date) {
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      return `${year}-${month}-${day}`;
  }

  // Fonction pour obtenir une date spécifique (Lundi-Dimanche) dans une semaine ISO
  function getDateForDayInWeek(weekNum, dayIndex, year = new Date().getFullYear()) {
      // dayIndex: 0=Lundi, 1=Mardi, ..., 6=Dimanche
      const simple = new Date(year, 0, 1 + (weekNum - 1) * 7);
      const dow = simple.getDay() || 7; // 0 for Sunday, 1 for Monday, ..., 7 for Sunday (ISO)
      const mondayOfISOWeek = new Date(simple);
      mondayOfISOWeek.setDate(simple.getDate() - (dow === 0 ? 6 : dow - 1)); // Adjust to get the Monday of the ISO week
      mondayOfISOWeek.setHours(0, 0, 0, 0);

      const targetDate = new Date(mondayOfISOWeek);
      targetDate.setDate(mondayOfISOWeek.getDate() + dayIndex); // Add the day offset
      return targetDate;
  }


  // --- Gestion sélecteur semaine et navigation ---
  const weekSelect = document.getElementById('week-select');
  const prevWeekBtn = document.getElementById('prev-week-btn');
  const nextWeekBtn = document.getElementById('next-week-btn');

  let currentYear = new Date().getFullYear();
  let currentWeekNumber = getWeekNumber(new Date());

  // Peupler le sélecteur de semaine
  function populateWeekSelect() {
    weekSelect.innerHTML = '';
    const today = new Date();
    const currentYearForSelect = today.getFullYear();
    const startYear = currentYearForSelect - 1; // Un an en arrière
    const endYear = currentYearForSelect + 2;   // Deux ans en avant

    for (let year = startYear; year <= endYear; year++) {
      for (let week = 1; week <= 53; week++) { // 53 semaines pour couvrir tous les cas
        const option = document.createElement('option');
        // Générer une date pour le lundi de la semaine ISO pour obtenir la plage de dates
        // Note: dayIndex 0 pour Lundi dans getDateForDayInWeek
        const mondayOfCurrentWeek = getDateForDayInWeek(week, 0, year); 
        const sundayOfCurrentWeek = new Date(mondayOfCurrentWeek);
        sundayOfCurrentWeek.setDate(mondayOfCurrentWeek.getDate() + 6);

        // Assurez-vous que la date est dans la bonne année ISO
        // La condition `mondayOfCurrentWeek.getFullYear() > year + 1 || mondayOfCurrentWeek.getFullYear() < year -1`
        // a été retirée pour s'assurer que toutes les options pour les années +2/-1 sont générées correctement,
        // même si la semaine 53 de l'année N-1 est en début d'année N ou inversement.
        // Le serveur gère la logique précise des dates associées aux semaines ISO.

        const dates = `${formatDate(mondayOfCurrentWeek)} - ${formatDate(sundayOfCurrentWeek)}`;
        option.value = `${year}-W${week}`; // Format: "YYYY-WNN"
        option.textContent = `Semaine ${week} (${dates})`;
        weekSelect.appendChild(option);
      }
    }
    // Sélectionner la semaine courante
    weekSelect.value = `${currentYear}-W${currentWeekNumber}`;
  }

  // Fonction pour mettre à jour la semaine affichée
  function updateWeekDisplay() {
    const selectedWeekValue = weekSelect.value;
    const [yearStr, weekStr] = selectedWeekValue.split('-W');
    currentYear = parseInt(yearStr);
    currentWeekNumber = parseInt(weekStr);

    // Charger les plannings pour la semaine sélectionnée
    loadAndRenderAgentPlanning(agent.id, currentYear, currentWeekNumber);
  }

  weekSelect.addEventListener('change', updateWeekDisplay);

  prevWeekBtn.addEventListener('click', () => {
    let newWeekNumber = currentWeekNumber - 1;
    let newYear = currentYear;
    if (newWeekNumber < 1) {
      newYear--;
      // Calculer la dernière semaine de l'année précédente
      const dateForLastWeekOfPrevYear = new Date(newYear, 11, 31);
      newWeekNumber = getWeekNumber(dateForLastWeekOfPrevYear); 
    }
    weekSelect.value = `${newYear}-W${newWeekNumber}`;
    updateWeekDisplay();
  });

  nextWeekBtn.addEventListener('click', () => {
    let newWeekNumber = currentWeekNumber + 1;
    let newYear = currentYear;
    // Calculer la dernière semaine de l'année actuelle
    const dateForLastWeekOfCurrentYear = new Date(newYear, 11, 31);
    const maxWeek = getWeekNumber(dateForLastWeekOfCurrentYear); 
    if (newWeekNumber > maxWeek) {
      newYear++;
      newWeekNumber = 1;
    }
    weekSelect.value = `${newYear}-W${newWeekNumber}`;
    updateWeekDisplay();
  });

  // --- Gestion des créneaux horaires ---
  const slotsSliderContainer = document.getElementById('slots-slider-container');
  const selectionInfo = document.getElementById('selection-info');
  const saveButton = document.getElementById('save-slots-btn');
  const clearButton = document.getElementById('clear-selection-btn');
  const dayButtons = document.querySelectorAll('.day-btn');
  const API_URL = `${API_BASE_URL}/api/agent-availability`;

  let currentDay = 0; // 0 = Lundi, 1 = Mardi, etc.
  // Structure pour stocker les sélections : { weekKey: { dayName: [{ start: index, end: index }] } }
  let selections = {}; // { 'week-25': { 'lundi': [{start: 0, end: 10}], 'mardi': [] }, ... }

  // Créneaux 30 min sur 24h, affichage de 7h à 7h le lendemain
  const START_HOUR = 7; // Heure de début de l'affichage
  const NUMBER_OF_SLOTS = 48; // Nombre total de créneaux de 30 min sur 24h

  function formatSlotTimeDisplay(startIndex) {
    const totalMinutesStart = START_HOUR * 60 + startIndex * 30;
    const hourStart = Math.floor(totalMinutesStart / 60) % 24;
    const minuteStart = totalMinutesStart % 60;

    const totalMinutesEnd = START_HOUR * 60 + (startIndex + 1) * 30;
    const hourEnd = Math.floor(totalMinutesEnd / 60) % 24;
    const minuteEnd = totalMinutesEnd % 60;

    return `${String(hourStart).padStart(2, '0')}:${String(minuteStart).padStart(2, '0')} - ` +
           `${String(hourEnd).padStart(2, '0')}:${String(minuteEnd).padStart(2, '0')}`;
  }

  function getDayName(dayIndex) {
    const days = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
    return days[dayIndex];
  }

  // Renvoie la date spécifique (YYYY-MM-DD) pour un jour et une semaine donnés
  function getDateForCurrentSelection(weekNumber, dayIndex, year) {
    // dayIndex ici est 0=Lundi, 1=Mardi... 6=Dimanche (du frontend)
    const mondayOfCurrentWeek = getDateForDayInWeek(weekNumber, 0, year); // Obtient le LUNDI de la semaine ISO (dayIndex 0 pour Lundi)
    const targetDate = new Date(mondayOfCurrentWeek);
    targetDate.setDate(mondayOfCurrentWeek.getDate() + dayIndex); // Ajoute le décalage pour atteindre le jour voulu
    return formatDateToYYYYMMDD(targetDate);
  }

  // Rend les créneaux horaires pour un jour donné
  function renderSlots(dayIndex) {
    slotsSliderContainer.innerHTML = '';
    const currentWeekKey = `week-${currentWeekNumber}`;
    const currentDayName = getDayName(dayIndex);
    const daySelections = selections[currentWeekKey] ? selections[currentWeekKey][currentDayName] : [];

    for (let i = 0; i < NUMBER_OF_SLOTS; i++) {
      const slotBlock = document.createElement('div');
      slotBlock.classList.add('time-slot-block');
      slotBlock.dataset.index = i;
      slotBlock.dataset.time = formatSlotTimeDisplay(i); // Pour l'infobulle

      const slotTimeText = document.createElement('span');
      slotTimeText.classList.add('slot-time-text');
      slotTimeText.textContent = `${String(START_HOUR + Math.floor(i / 2)).padStart(2, '0')}:${String((i % 2) * 30).padStart(2, '0')}`;
      
      slotBlock.appendChild(slotTimeText);

      // Vérifier si le créneau est sélectionné
      const isSelected = daySelections.some(range => i >= range.start && i <= range.end);
      if (isSelected) {
        slotBlock.classList.add('selected');
      }

      slotBlock.addEventListener('click', () => toggleSlotSelection(i));
      slotsSliderContainer.appendChild(slotBlock);
    }
    updateSelectionInfo();
  }

  function toggleSlotSelection(index) {
    const currentWeekKey = `week-${currentWeekNumber}`;
    const currentDayName = getDayName(currentDay);

    // Initialise la sélection pour la semaine/jour si elle n'existe pas
    if (!selections[currentWeekKey]) {
      selections[currentWeekKey] = {
        'lundi': [], 'mardi': [], 'mercredi': [], 'jeudi': [],
        'vendredi': [], 'samedi': [], 'dimanche': []
      };
    }
    
    // Si le créneau est déjà sélectionné, le désélectionner
    if (isSlotSelected(index)) {
      removeSlotFromSelection(index);
    } else {
      // Sinon, l'ajouter
      addSlotToSelection(index);
    }
    renderSlots(currentDay); // Re-rendre pour refléter le changement
  }

  function isSlotSelected(index) {
    const currentWeekKey = `week-${currentWeekNumber}`;
    const currentDayName = getDayName(currentDay);
    const daySelections = selections[currentWeekKey] ? selections[currentWeekKey][currentDayName] : [];
    return daySelections.some(range => index >= range.start && index <= range.end);
  }

  function addSlotToSelection(index) {
    const currentWeekKey = `week-${currentWeekNumber}`;
    const dayName = getDayName(currentDay);

    let ranges = selections[currentWeekKey][dayName];
    let newRanges = [];
    let merged = false;

    // Tenter de fusionner avec une plage existante
    for (const range of ranges) {
      if (index === range.start - 1) { // Peut fusionner à gauche
        newRanges.push({ start: index, end: range.end });
        merged = true;
      } else if (index === range.end + 1) { // Peut fusionner à droite
        newRanges.push({ start: range.start, end: index });
        merged = true;
      } else {
        newRanges.push(range);
      }
    }

    if (!merged) { // Si aucune fusion, ajouter comme une nouvelle plage de 1
      newRanges.push({ start: index, end: index });
    }

    // Deuxième passe pour fusionner les plages qui pourraient maintenant se toucher
    newRanges.sort((a, b) => a.start - b.start);
    const finalRanges = [];
    if (newRanges.length > 0) {
      let currentRange = newRanges[0];
      for (let i = 1; i < newRanges.length; i++) {
        const nextRange = newRanges[i];
        if (nextRange.start <= currentRange.end + 1) { // Les plages se chevauchent ou se touchent
          currentRange.end = Math.max(currentRange.end, nextRange.end);
        } else {
          finalRanges.push(currentRange);
          currentRange = nextRange;
        }
      }
      finalRanges.push(currentRange); // Ajouter la dernière plage
    }
    selections[currentWeekKey][dayName] = finalRanges;
  }

  function removeSlotFromSelection(index) {
    const currentWeekKey = `week-${currentWeekNumber}`;
    const dayName = getDayName(currentDay);

    let ranges = selections[currentWeekKey][dayName];
    const newRanges = [];

    for (const range of ranges) {
      if (index < range.start || index > range.end) {
        newRanges.push(range); // La plage actuelle n'est pas affectée
      } else {
        // Le créneau est dans cette plage, nous devons la scinder
        if (index > range.start) { // Partie gauche de la plage
          newRanges.push({ start: range.start, end: index - 1 });
        }
        if (index < range.end) { // Partie droite de la plage
          newRanges.push({ start: index + 1, end: range.end });
        }
      }
    }
    selections[currentWeekKey][dayName] = newRanges.sort((a,b) => a.start - b.start);
  }

  function updateSelectionInfo() {
    const currentWeekKey = `week-${currentWeekNumber}`;
    const currentDayName = getDayName(currentDay);
    const daySelections = selections[currentWeekKey] ? selections[currentWeekKey][currentDayName] : [];

    if (daySelections.length > 0) {
      const formattedTimes = daySelections.map(range => {
        // Formate chaque plage en "HH:MM - HH:MM"
        const startFormatted = `${String(START_HOUR + Math.floor(range.start / 2)).padStart(2, '0')}:${String((range.start % 2) * 30).padStart(2, '0')}`;
        const endFormatted = `${String(START_HOUR + Math.floor((range.end + 1) / 2)).padStart(2, '0')}:${String(((range.end + 1) % 2) * 30).padStart(2, '0')}`;
        return `${startFormatted} - ${endFormatted}`;
      });
      selectionInfo.textContent = `Créneaux sélectionnés pour ${currentDayName} : ${formattedTimes.join(', ')}`;
    } else {
      selectionInfo.textContent = `Aucun créneau sélectionné pour ${currentDayName}.`;
    }
  }

  // --- Chargement et sauvegarde des plannings ---

  // Charger le planning de l'agent pour la semaine actuelle
  async function loadAgentPlanning(agentId) { // Suppression de weekNumber et year car le serveur renvoie tout le planning de l'agent
    try {
      const response = await fetch(`${API_BASE_URL}/api/planning/${agentId}`, {
        headers: {
          'Authorization': `Bearer ${sessionStorage.getItem('jwtToken')}`
        }
      });
      if (!response.ok) {
        // Si 403, c'est une erreur d'autorisation, on ne doit pas vider la sélection
        if (response.status === 403) {
            displayMessageModal('Accès refusé', 'Vous n\'avez pas les droits pour accéder à ce planning.', 'error');
            return null; // Retourne null pour indiquer un échec
        }
        throw new Error(`Erreur HTTP: ${response.status}`);
      }
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Erreur lors du chargement du planning de l\'agent :', error);
      displayMessageModal('Erreur de chargement', 'Impossible de charger votre planning. Veuillez réessayer.', 'error');
      return null;
    }
  }

  async function loadAndRenderAgentPlanning(agentId, year, weekNumber) {
    const planningData = await loadAgentPlanning(agentId); // Appelle sans weekNumber/year
    if (planningData) {
      const weekKey = `week-${weekNumber}`; // La weekKey est maintenant générée ici
      
      // Assurer que la structure de base existe pour la semaine courante
      if (!selections[weekKey]) {
        selections[weekKey] = {
          'lundi': [], 'mardi': [], 'mercredi': [], 'jeudi': [],
          'vendredi': [], 'samedi': [], 'dimanche': []
        };
      } else {
        // Vider les sélections existantes pour cette semaine avant de charger de nouvelles données
        for (const dayName in selections[weekKey]) {
          selections[weekKey][dayName] = [];
        }
      }

      if (planningData[weekKey]) {
        // Le serveur renvoie des tableaux de chaînes "HH:MM - HH:MM" pour chaque jour.
        // Nous devons les convertir en plages {start, end} pour l'interface de sélection.
        for (const dayName of ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']) {
            const slotsForDay = planningData[weekKey][dayName] || [];
            const ranges = [];
            let currentRange = null;

            if (Array.isArray(slotsForDay) && slotsForDay.length > 0) {
                const slotIndices = slotsForDay.map(slotStr => {
                    const [startTime] = slotStr.split(' - ');
                    const [hour, minute] = startTime.split(':').map(Number);
                    return ((hour + 24 - START_HOUR) % 24) * 2 + (minute / 30);
                }).sort((a,b) => a - b); // Trier les indices pour faciliter le regroupement

                for (let i = 0; i < slotIndices.length; i++) {
                    const index = slotIndices[i];
                    if (currentRange === null) {
                        currentRange = { start: index, end: index };
                    } else if (index === currentRange.end + 1) { // Si le créneau est contigu
                        currentRange.end = index;
                    } else { // Nouvelle plage si non contigu
                        ranges.push(currentRange);
                        currentRange = { start: index, end: index };
                    }
                }
                if (currentRange !== null) { // Ajouter la dernière plage
                    ranges.push(currentRange);
                }
            }
            selections[weekKey][dayName] = ranges;
        }
      } 
    } else { // Si le chargement a échoué ou n'a rien retourné
        // S'assurer que la semaine est vide si le chargement a échoué
        selections[`week-${weekNumber}`] = { 
            'lundi': [], 'mardi': [], 'mercredi': [], 'jeudi': [],
            'vendredi': [], 'samedi': [], 'dimanche': []
        };
    }
    renderSlots(currentDay); // Rendre les slots pour le jour actif
  }

  saveButton.addEventListener('click', async () => {
    const currentWeekKey = `week-${currentWeekNumber}`;
    const agentId = agent.id; // L'ID de l'agent connecté
    const currentYearForDate = currentYear; // Année pour former la date complète

    // Envoyer les données jour par jour
    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
      const dayName = getDayName(dayIndex);
      const availabilitiesForDay = selections[currentWeekKey] ? selections[currentWeekKey][dayName] : [];
      const dateKey = getDateForCurrentSelection(currentWeekNumber, dayIndex, currentYearForDate);

      try {
        const response = await fetch(`${API_URL}/${dateKey}/${agentId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionStorage.getItem('jwtToken')}`
          },
          body: JSON.stringify(availabilitiesForDay) // Envoyer les plages {start, end}
        });

        if (!response.ok) {
          throw new Error(`Erreur serveur lors de la sauvegarde des créneaux pour ${dayName} (${dateKey}): ${response.statusText}`);
        }
        // console.log(`Créneaux pour ${dayName} (${dateKey}) sauvegardés avec succès.`);
      } catch (error) {
        console.error('Erreur de sauvegarde des créneaux :', error);
        displayMessageModal('Erreur de sauvegarde', `Impossible d'enregistrer les créneaux pour ${dayName}. Veuillez réessayer.`, 'error');
        return; // Arrêter si une erreur se passe
      }
    }
    displayMessageModal('Succès', 'Vos créneaux ont été enregistrés !', 'success');
  });

  clearButton.addEventListener('click', () => {
    const currentWeekKey = `week-${currentWeekNumber}`;
    const currentDayName = getDayName(currentDay);
    if (selections[currentWeekKey]) {
      selections[currentWeekKey][currentDayName] = [];
    }
    renderSlots(currentDay);
    displayMessageModal('Sélection effacée', 'Les créneaux de ce jour ont été effacés localement.', 'info');
  });

  dayButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.classList.contains('active')) return;
      dayButtons.forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      currentDay = parseInt(btn.dataset.day, 10);
      renderSlots(currentDay);
    });
  });

  // --- Modales de messages ---
  function displayMessageModal(title, message, type = "info", callback = null) {
    let modal = document.getElementById('message-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'message-modal';
      modal.classList.add('modal');
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="modal-content ${type}">
        <span class="close-button">&times;</span>
        <h3 class="modal-title">${title}</h3>
        <p class="modal-message">${message}</p>
        ${type === 'question' ? '<div class="modal-actions"><button class="btn btn-primary" id="modal-confirm-btn">Oui</button><button class="btn btn-secondary" id="modal-cancel-btn">Annuler</button></div>' : ''}
      </div>
    `;
    modal.style.display = 'block';

    const closeButton = modal.querySelector('.close-button');
    if (closeButton) {
      closeButton.onclick = () => {
        modal.style.display = 'none';
        if (callback && type === 'question') callback(false); // Annuler si on ferme
      };
    }

    const confirmBtn = modal.querySelector('#modal-confirm-btn');
    if (confirmBtn) {
      confirmBtn.onclick = () => {
        modal.style.display = 'none';
        if (callback) callback(true);
      };
    }

    const cancelBtn = modal.querySelector('#modal-cancel-btn');
    if (cancelBtn) {
      cancelBtn.onclick = () => {
        modal.style.display = 'none';
        if (callback) callback(false);
      };
    }

    // Fermer si clic en dehors de la modale (sauf pour type 'question' pour forcer la réponse)
    window.onclick = (event) => {
      if (event.target == modal && type !== 'question') {
        modal.style.display = 'none';
        if (callback && type === 'question') callback(false);
      }
    };
  }

  // --- Initialisation ---
  populateWeekSelect();
  updateWeekDisplay(); // Charge le planning de la semaine actuelle au démarrage
});
