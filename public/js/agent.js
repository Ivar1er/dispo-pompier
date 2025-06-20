// js/agent.js

document.addEventListener('DOMContentLoaded', () => {
  const agentNameDisplay = document.getElementById('agent-name-display');
  const agentQualificationsDisplay = document.getElementById('agentQualificationsDisplay');

  const agent = JSON.parse(sessionStorage.getItem("agent"));

  // Vérifier si l'objet agent est disponible et rediriger si ce n'est pas le cas
  if (!agent || !agent.id || !agent.firstName || !agent.lastName) {
    console.error("Agent data not found in sessionStorage or incomplete. Redirecting to login.");
    window.location.href = 'login.html';
    return;
  }

  agentNameDisplay.textContent = `${agent.firstName} ${agent.lastName}`;

  // URL de base de votre API
  const API_BASE_URL = "https://dispo-pompier.onrender.com";

  // Fonctions utilitaires pour les qualifications (pour l'affichage)
  let availableQualifications = [];
  async function fetchQualificationsForDisplay() {
      try {
          const response = await fetch(`${API_BASE_URL}/api/qualifications`, {
              headers: { 'Authorization': `Bearer ${sessionStorage.getItem('jwtToken')}` }
          });
          if (!response.ok) throw new Error('Failed to fetch qualifications');
          availableQualifications = await response.json();
          renderAgentQualifications();
      } catch (error) {
          console.error('Error fetching qualifications for display:', error);
          agentQualificationsDisplay.textContent = 'Erreur chargement qualifications.';
      }
  }

  function renderAgentQualifications() {
    if (agent.qualifications && agent.qualifications.length > 0) {
      const qualificationNames = agent.qualifications.map(qId => {
        const qual = availableQualifications.find(aq => aq.id === qId);
        return qual ? qual.name : qId; // Afficher le nom si trouvé, sinon l'ID
      }).join(', ').toUpperCase();
      agentQualificationsDisplay.textContent = `Qualifications: ${qualificationNames}`;
    } else {
      agentQualificationsDisplay.textContent = 'Aucune qualification renseignée.';
    }
  }


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

  function formatDateToYYYYMMDD(date) {
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      return `${year}-${month}-${day}`;
  }

  function getDateForDayInWeek(weekNum, dayIndex, year = new Date().getFullYear()) {
      const simple = new Date(year, 0, 1 + (weekNum - 1) * 7);
      const dow = simple.getDay() || 7;
      const mondayOfISOWeek = new Date(simple);
      mondayOfISOWeek.setDate(simple.getDate() - (dow === 0 ? 6 : dow - 1));
      mondayOfISOWeek.setHours(0, 0, 0, 0);

      const targetDate = new Date(mondayOfISOWeek);
      targetDate.setDate(mondayOfISOWeek.getDate() + dayIndex);
      return targetDate;
  }


  // --- Gestion sélecteur semaine et navigation ---
  const weekSelect = document.getElementById('week-select');
  const prevWeekBtn = document.getElementById('prev-week-btn');
  const nextWeekBtn = document.getElementById('next-week-btn');

  let currentYear = new Date().getFullYear();
  let currentWeekNumber = getWeekNumber(new Date());

  function populateWeekSelect() {
    weekSelect.innerHTML = '';
    const today = new Date();
    const currentYearForSelect = today.getFullYear();
    const startYear = currentYearForSelect - 1;
    const endYear = currentYearForSelect + 2;

    for (let year = startYear; year <= endYear; year++) {
      for (let week = 1; week <= 53; week++) {
        const option = document.createElement('option');
        const mondayOfCurrentWeek = getDateForDayInWeek(week, 0, year);
        const sundayOfCurrentWeek = new Date(mondayOfCurrentWeek);
        sundayOfCurrentWeek.setDate(mondayOfCurrentWeek.getDate() + 6);

        if (getWeekNumber(mondayOfCurrentWeek) !== week || mondayOfCurrentWeek.getFullYear() !== year) {
            continue;
        }

        const dates = `${formatDate(mondayOfCurrentWeek)} - ${formatDate(sundayOfCurrentWeek)}`;
        option.value = `${year}-W${week}`;
        option.textContent = `Semaine ${week} (${dates})`;
        weekSelect.appendChild(option);
      }
    }
    weekSelect.value = `${currentYear}-W${currentWeekNumber}`;
  }

  function updateWeekDisplay() {
    const selectedWeekValue = weekSelect.value;
    const [yearStr, weekStr] = selectedWeekValue.split('-W');
    currentYear = parseInt(yearStr);
    currentWeekNumber = parseInt(weekStr);

    loadAndRenderAgentPlanning(agent.id, currentYear, currentWeekNumber);
  }

  weekSelect.addEventListener('change', updateWeekDisplay);

  prevWeekBtn.addEventListener('click', () => {
    let newWeekNumber = currentWeekNumber - 1;
    let newYear = currentYear;
    if (newWeekNumber < 1) {
      newYear--;
      const dateForLastWeekOfPrevYear = new Date(newYear, 11, 31);
      newWeekNumber = getWeekNumber(dateForLastWeekOfPrevYear); 
    }
    weekSelect.value = `${newYear}-W${newWeekNumber}`;
    updateWeekDisplay();
  });

  nextWeekBtn.addEventListener('click', () => {
    let newWeekNumber = currentWeekNumber + 1;
    let newYear = currentYear;
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

  let currentDay = 0;
  let selections = {};

  const START_HOUR = 7;
  const NUMBER_OF_SLOTS = 48;

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

  function getDateForCurrentSelection(weekNumber, dayIndex, year) {
    const mondayOfCurrentWeek = getDateForDayInWeek(weekNumber, 0, year);
    const targetDate = new Date(mondayOfCurrentWeek);
    targetDate.setDate(mondayOfCurrentWeek.getDate() + dayIndex);
    return formatDateToYYYYMMDD(targetDate);
  }

  function renderSlots(dayIndex) {
    slotsSliderContainer.innerHTML = '';
    const currentWeekKey = `week-${currentWeekNumber}`;
    const currentDayName = getDayName(dayIndex);
    const daySelections = selections[currentWeekKey] ? selections[currentWeekKey][currentDayName] : [];

    for (let i = 0; i < NUMBER_OF_SLOTS; i++) {
      const slotBlock = document.createElement('div');
      slotBlock.classList.add('time-slot-block');
      slotBlock.dataset.index = i;
      slotBlock.dataset.time = formatSlotTimeDisplay(i);
      slotBlock.dataset.day = dayIndex; // Add day index to slot block

      const slotTimeText = document.createElement('span');
      slotTimeText.classList.add('slot-time-text');
      slotTimeText.textContent = `${String(START_HOUR + Math.floor(i / 2)).padStart(2, '0')}:${String((i % 2) * 30).padStart(2, '0')}`;
      
      slotBlock.appendChild(slotTimeText);

      const isSelected = daySelections.some(range => i >= range.start && i <= range.end);
      if (isSelected) {
        slotBlock.classList.add('selected');
      }

      slotBlock.addEventListener('click', (e) => {
        // Only toggle if not part of a drag selection
        if (!isDragging) {
            toggleSlotSelection(i);
        }
      });
      slotBlock.addEventListener('mousedown', handleMouseDown);
      slotBlock.addEventListener('mouseup', handleMouseUp);
      slotsSliderContainer.appendChild(slotBlock);
    }
    updateSelectionInfo();
  }

  // Drag selection logic
  let isDragging = false;
  let startDragIndex = -1;
  let currentDragDay = -1;

  function handleMouseDown(e) {
      if (e.button !== 0) return; // Only left click
      isDragging = true;
      startDragIndex = parseInt(e.target.closest('.time-slot-block').dataset.index);
      currentDragDay = parseInt(e.target.closest('.time-slot-block').dataset.day);

      // Deselect all for the current day to start a fresh selection (or removal)
      const currentWeekKey = `week-${currentWeekNumber}`;
      const currentDayName = getDayName(currentDragDay);
      selections[currentWeekKey][currentDayName] = [];
      renderSlots(currentDragDay); // Clear visual selection

      e.target.closest('.time-slot-block').classList.add('selected'); // Select the starting slot
  }

  function handleMouseUp(e) {
      if (!isDragging) return;
      isDragging = false;
      startDragIndex = -1;
      currentDragDay = -1;
      // Re-render to finalize selection (the one at mouse move is temporary)
      renderSlots(parseInt(e.target.closest('.time-slot-block').dataset.day));
  }

  slotsSliderContainer.addEventListener('mousemove', (e) => {
      if (!isDragging || currentDragDay === -1) return;

      const targetBlock = e.target.closest('.time-slot-block');
      if (!targetBlock || parseInt(targetBlock.dataset.day) !== currentDragDay) return;

      const currentHoverIndex = parseInt(targetBlock.dataset.index);
      const currentWeekKey = `week-${currentWeekNumber}`;
      const currentDayName = getDayName(currentDragDay);

      // Clear current visual selection for the day (important for smooth drag)
      slotsSliderContainer.querySelectorAll('.time-slot-block').forEach(block => {
          if (parseInt(block.dataset.day) === currentDragDay) {
              block.classList.remove('selected');
          }
      });

      // Highlight slots between startDragIndex and currentHoverIndex
      const minIndex = Math.min(startDragIndex, currentHoverIndex);
      const maxIndex = Math.max(startDragIndex, currentHoverIndex);

      // Dynamically create a temporary range during drag
      const tempRanges = [{ start: minIndex, end: maxIndex }];
      selections[currentWeekKey][currentDayName] = tempRanges; // Temporarily update selections

      for (let i = minIndex; i <= maxIndex; i++) {
          const block = slotsSliderContainer.querySelector(`[data-index="${i}"][data-day="${currentDragDay}"]`);
          if (block) {
              block.classList.add('selected');
          }
      }
      updateSelectionInfo(); // Update info during drag
  });

  // Global mouseup to stop dragging if mouse leaves the container
  document.addEventListener('mouseup', () => {
      if (isDragging) {
          isDragging = false;
          // Finalize the selection based on what was selected during drag
          // The selections object already holds the latest range from mousemove
          renderSlots(currentDay); 
      }
  });


  function toggleSlotSelection(index) {
    const currentWeekKey = `week-${currentWeekNumber}`;
    const currentDayName = getDayName(currentDay);

    if (!selections[currentWeekKey]) {
      selections[currentWeekKey] = {
        'lundi': [], 'mardi': [], 'mercredi': [], 'jeudi': [],
        'vendredi': [], 'samedi': [], 'dimanche': []
      };
    }
    
    if (isSlotSelected(index)) {
      removeSlotFromSelection(index);
    } else {
      addSlotToSelection(index);
    }
    renderSlots(currentDay);
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

    for (const range of ranges) {
      if (index === range.start - 1) {
        newRanges.push({ start: index, end: range.end });
        merged = true;
      } else if (index === range.end + 1) {
        newRanges.push({ start: range.start, end: index });
        merged = true;
      } else {
        newRanges.push(range);
      }
    }

    if (!merged) {
      newRanges.push({ start: index, end: index });
    }

    newRanges.sort((a, b) => a.start - b.start);
    const finalRanges = [];
    if (newRanges.length > 0) {
      let currentRange = newRanges[0];
      for (let i = 1; i < newRanges.length; i++) {
        const nextRange = newRanges[i];
        if (nextRange.start <= currentRange.end + 1) {
          currentRange.end = Math.max(currentRange.end, nextRange.end);
        } else {
          finalRanges.push(currentRange);
          currentRange = nextRange;
        }
      }
      finalRanges.push(currentRange);
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
        newRanges.push(range);
      } else {
        if (index > range.start) {
          newRanges.push({ start: range.start, end: index - 1 });
        }
        if (index < range.end) {
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

  async function loadAgentPlanning(agentId) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/planning/${agentId}`, {
        headers: {
          'Authorization': `Bearer ${sessionStorage.getItem('jwtToken')}`
        }
      });
      if (!response.ok) {
        if (response.status === 403) {
            displayMessageModal('Accès refusé', 'Vous n\'avez pas les droits pour accéder à ce planning.', 'error');
            return null;
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
    const planningData = await loadAgentPlanning(agentId);
    if (planningData) {
      const weekKey = `week-${weekNumber}`;
      
      if (!selections[weekKey]) {
        selections[weekKey] = {
          'lundi': [], 'mardi': [], 'mercredi': [], 'jeudi': [],
          'vendredi': [], 'samedi': [], 'dimanche': []
        };
      } else {
        for (const dayName in selections[weekKey]) {
          selections[weekKey][dayName] = [];
        }
      }

      if (planningData[weekKey]) {
        for (const dayName of ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']) {
            const slotsForDay = planningData[weekKey][dayName] || [];
            const ranges = [];
            let currentRange = null;

            if (Array.isArray(slotsForDay) && slotsForDay.length > 0) {
                const slotIndices = slotsForDay.map(slotStr => {
                    const [startTime] = slotStr.split(' - ');
                    const [hour, minute] = startTime.split(':').map(Number);
                    return ((hour + 24 - START_HOUR) % 24) * 2 + (minute / 30);
                }).sort((a,b) => a - b);

                for (let i = 0; i < slotIndices.length; i++) {
                    const index = slotIndices[i];
                    if (currentRange === null) {
                        currentRange = { start: index, end: index };
                    } else if (index === currentRange.end + 1) {
                        currentRange.end = index;
                    } else {
                        ranges.push(currentRange);
                        currentRange = { start: index, end: index };
                    }
                }
                if (currentRange !== null) {
                    ranges.push(currentRange);
                }
            }
            selections[weekKey][dayName] = ranges;
        }
      } 
    } else {
        selections[`week-${weekNumber}`] = { 
            'lundi': [], 'mardi': [], 'mercredi': [], 'jeudi': [],
            'vendredi': [], 'samedi': [], 'dimanche': []
        };
    }
    renderSlots(currentDay);
  }

  saveButton.addEventListener('click', async () => {
    const currentWeekKey = `week-${currentWeekNumber}`;
    const agentId = agent.id;
    const currentYearForDate = currentYear;

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
          body: JSON.stringify(availabilitiesForDay)
        });

        if (!response.ok) {
          throw new Error(`Erreur serveur lors de la sauvegarde des créneaux pour ${dayName} (${dateKey}): ${response.statusText}`);
        }
      } catch (error) {
        console.error('Erreur de sauvegarde des créneaux :', error);
        displayMessageModal('Erreur de sauvegarde', `Impossible d'enregistrer les créneaux pour ${dayName}. Veuillez réessayer.`, 'error');
        return;
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
        if (callback && type === 'question') callback(false);
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

    window.onclick = (event) => {
      if (event.target == modal && type !== 'question') {
        modal.style.display = 'none';
        if (callback && type === 'question') callback(false);
      }
    };
  }

  // --- Déconnexion ---
  const logoutButton = document.getElementById('logout-btn');
  if (logoutButton) {
      logoutButton.addEventListener('click', () => {
          sessionStorage.removeItem('jwtToken');
          sessionStorage.removeItem('agent');
          window.location.href = 'login.html';
      });
  }

  // --- Initialisation ---
  populateWeekSelect();
  updateWeekDisplay();
  fetchQualificationsForDisplay(); // Fetch qualifications for display
});
