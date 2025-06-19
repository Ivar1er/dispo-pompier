document.addEventListener('DOMContentLoaded', () => {
  // --- Affichage prénom + nom agent ---
  const agentNameDisplay = document.getElementById('agent-name-display');
  const agentFirstName = 'Jean';  // à remplacer dynamiquement
  const agentLastName = 'Dupont'; // à remplacer dynamiquement
  agentNameDisplay.textContent = `${agentFirstName} ${agentLastName}`;

  // --- Fonction ISO semaine ---
  function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1)/7);
    return weekNo;
  }

  // --- Gestion sélecteur semaine ---
  function getMonday(d) {
    d = new Date(d);
    const day = d.getDay();
    const diff = (day === 0 ? -6 : 1) - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0,0,0,0);
    return d;
  }

  function formatDate(d) {
    return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}`;
  }

  function formatSlotTime(startIndex) {
    const START_HOUR = 7;
    const totalMinutesStart = (START_HOUR * 60) + (startIndex * 30);
    const totalMinutesEnd = totalMinutesStart + 30;

    const hStart = Math.floor(totalMinutesStart / 60) % 24;
    const mStart = totalMinutesStart % 60;
    const hEnd = Math.floor(totalMinutesEnd / 60) % 24;
    const mEnd = totalMinutesEnd % 60;

    return `${hStart.toString().padStart(2,'0')}:${mStart.toString().padStart(2,'0')}-${hEnd.toString().padStart(2,'0')}:${mEnd.toString().padStart(2,'0')}`;
  }

  function initWeekSelector() {
    const weekSelect = document.getElementById('week-select');
    
    const today = new Date();
    const currentMonday = getMonday(today);
    
    const weeks = [];
    for (let i = -1; i <= 3; i++) {
      const monday = new Date(currentMonday);
      monday.setDate(monday.getDate() + i * 7);
      weeks.push(monday);
    }

    weekSelect.innerHTML = '';

    weeks.forEach((mondayDate, idx) => {
      const weekNum = getWeekNumber(mondayDate);
      const sundayDate = new Date(mondayDate);
      sundayDate.setDate(sundayDate.getDate() + 6);
      const option = document.createElement('option');
      option.value = idx;
      option.textContent = `S ${weekNum} (${formatDate(mondayDate)} au ${formatDate(sundayDate)})`;
      weekSelect.appendChild(option);
    });

    weekSelect.selectedIndex = 1;

    weekSelect.addEventListener('change', () => {
      // Plus d’affichage sous le select, donc rien ici pour l’instant
    });
  }

  initWeekSelector();

  // --- Sélection des créneaux horaires ---
  const dayButtons = document.querySelectorAll('.day-btn');
  const slotsContainer = document.getElementById('slots-slider-container');
  const saveButton = document.getElementById('save-slots-btn');
  const clearButton = document.getElementById('clear-selection-btn');

  const SLOT_COUNT = 48;
  const START_HOUR = 7;

  const selections = Array(7).fill(null).map(() => []);

  let currentDay = 0;
  let isDragging = false;
  let dragStartIndex = null;
  let dragEndIndex = null;

  function renderSlots(dayIndex) {
    slotsContainer.innerHTML = '';
    const daySelections = selections[dayIndex];

    for (let i = 0; i < SLOT_COUNT; i++) {
      const slot = document.createElement('div');
      slot.classList.add('time-slot-block');
      slot.setAttribute('data-index', i);

      slot.textContent = formatSlotTime(i);

      if (isSlotSelected(i, daySelections)) {
        slot.classList.add('selected');
      }

      slot.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        isDragging = true;
        dragStartIndex = i;
        dragEndIndex = i;
        updateSelectionVisual(dragStartIndex, dragEndIndex);
        e.preventDefault();
      });

      slot.addEventListener('mouseenter', () => {
        if (!isDragging) return;
        dragEndIndex = i;
        updateSelectionVisual(dragStartIndex, dragEndIndex);
      });

      slot.addEventListener('mouseup', () => {
        if (!isDragging) return;
        isDragging = false;
        finalizeSelection(dragStartIndex, dragEndIndex);
      });

      slot.addEventListener('click', () => {
        if (isDragging) return;
        if (slot.classList.contains('selected')) {
          removeSlotFromSelection(i);
          renderSlots(currentDay);
        }
      });

      slotsContainer.appendChild(slot);
    }

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        finalizeSelection(dragStartIndex, dragEndIndex);
      }
    }, { once: true });
  }

  function isSlotSelected(index, daySelections) {
    for (const range of daySelections) {
      if (index >= range.start && index <= range.end) return true;
    }
    return false;
  }

  function updateSelectionVisual(start, end) {
    const minI = Math.min(start, end);
    const maxI = Math.max(start, end);

    const slots = slotsContainer.querySelectorAll('.time-slot-block');
    slots.forEach((slot, idx) => {
      if (idx >= minI && idx <= maxI) {
        slot.classList.add('selected');
      } else {
        if (!isSlotSelected(idx, selections[currentDay])) {
          slot.classList.remove('selected');
        }
      }
    });
  }

  function finalizeSelection(start, end) {
    const minI = Math.min(start, end);
    const maxI = Math.max(start, end);
    addSelectionRange(currentDay, minI, maxI);
    renderSlots(currentDay);
  }

  function addSelectionRange(dayIndex, start, end) {
    let ranges = selections[dayIndex];

    const newRange = { start, end };
    const newRanges = [];
    for (const range of ranges) {
      if (range.end < newRange.start - 1 || range.start > newRange.end + 1) {
        newRanges.push(range);
      } else {
        newRange.start = Math.min(newRange.start, range.start);
        newRange.end = Math.max(newRange.end, range.end);
      }
    }
    newRanges.push(newRange);
    newRanges.sort((a,b) => a.start - b.start);
    selections[dayIndex] = newRanges;
  }

  function removeSlotFromSelection(index) {
    let ranges = selections[currentDay];
    const newRanges = [];

    for (const range of ranges) {
      if (index < range.start || index > range.end) {
        newRanges.push(range);
      } else {
        if (index > range.start) {
          newRanges.push({ start: range.start, end: index -1 });
        }
        if (index < range.end) {
          newRanges.push({ start: index +1, end: range.end });
        }
      }
    }

    selections[currentDay] = newRanges;
  }

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

  clearButton.addEventListener('click', () => {
    selections[currentDay] = [];
    renderSlots(currentDay);
  });

  saveButton.addEventListener('click', () => {
    console.log('Créneaux sélectionnés :', selections);
    alert('Créneaux sauvegardés (voir console)');
  });

  renderSlots(currentDay);
});
