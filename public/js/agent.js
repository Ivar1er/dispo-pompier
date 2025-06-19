document.addEventListener('DOMContentLoaded', () => {
  // --- Affichage prénom + nom agent ---
  const agentNameDisplay = document.getElementById('agent-name-display');

  // Fonction pour charger et afficher les informations de l'agent
  async function loadAgentInfo() {
    // Récupérer le token JWT depuis le localStorage (ou sessionStorage)
    const token = localStorage.getItem('token'); // Assurez-vous que le token est stocké ici après la connexion

    if (!token) {
      console.warn('Aucun token trouvé. Affichage des informations par défaut.');
      agentNameDisplay.textContent = 'Agent Inconnu'; // Afficher un nom par défaut ou gérer la redirection
      // Optionnel : rediriger l'utilisateur vers la page de connexion si non authentifié
      // window.location.href = '/login.html';
      return;
    }

    try {
      const response = await fetch('/api/agent-info', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const agentInfo = await response.json();
        agentNameDisplay.textContent = `${agentInfo.firstName} ${agentInfo.lastName}`;
      } else {
        const errorData = await response.json();
        console.error('Erreur lors de la récupération des infos de l\'agent :', errorData.message);
        agentNameDisplay.textContent = 'Erreur de chargement des infos';
        // Si le token est invalide (403), l'utilisateur doit probablement se reconnecter
        if (response.status === 403) {
          localStorage.removeItem('token'); // Nettoyer le token invalide
          // window.location.href = '/login.html'; // Rediriger vers la connexion
        }
      }
    } catch (error) {
      console.error('Erreur réseau lors de la récupération des infos de l\'agent :', error);
      agentNameDisplay.textContent = 'Erreur réseau';
    }
  }

  // Appeler la fonction au chargement de la page
  loadAgentInfo();

  // --- Fonction ISO semaine ---
  function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1)/7);
    return weekNo;
  }

  // --- Gestion sélecteur semaine ---
  let currentMonday = getMonday(new Date()); // Initialize currentMonday globally

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
    
    // Clear previous options
    weekSelect.innerHTML = '';

    const weeks = [];
    // Generate options for previous, current, and next 3 weeks
    for (let i = -1; i <= 3; i++) {
      const monday = new Date(currentMonday);
      monday.setDate(monday.getDate() + i * 7);
      weeks.push(monday);
    }

    weeks.forEach((mondayDate, idx) => {
      const weekNum = getWeekNumber(mondayDate);
      const sundayDate = new Date(mondayDate);
      sundayDate.setDate(sundayDate.getDate() + 6);
      const option = document.createElement('option');
      option.value = idx;
      option.textContent = `S ${weekNum} (${formatDate(mondayDate)} au ${formatDate(sundayDate)})`;
      weekSelect.appendChild(option);
    });

    // Set the selected index to the current week (index 1 in our generated array)
    weekSelect.selectedIndex = 1;

    weekSelect.addEventListener('change', (event) => {
      const selectedIndex = parseInt(event.target.value, 10);
      const newMonday = new Date(currentMonday);
      newMonday.setDate(newMonday.getDate() + (selectedIndex - 1) * 7); // Adjust based on initial offset
      currentMonday = getMonday(newMonday);
      initWeekSelector(); // Re-render week selector to center around new currentMonday
      // No need to display anything under the select for now as per HTML comment
    });
  }

  // Event listeners for week navigation buttons
  const prevWeekBtn = document.getElementById('prev-week-btn');
  const nextWeekBtn = document.getElementById('next-week-btn');

  prevWeekBtn.addEventListener('click', () => {
    currentMonday.setDate(currentMonday.getDate() - 7);
    initWeekSelector();
  });

  nextWeekBtn.addEventListener('click', () => {
    currentMonday.setDate(currentMonday.getDate() + 7);
    initWeekSelector();
  });

  initWeekSelector();

  // --- Sélection des créneaux horaires ---
  const dayButtons = document.querySelectorAll('.day-btn');
  const slotsContainer = document.getElementById('slots-slider-container');
  const saveButton = document.getElementById('save-slots-btn');
  const clearButton = document.getElementById('clear-selection-btn');

  const SLOT_COUNT = 48;
  const START_HOUR = 7;

  // Initialize selections for 7 days, each with an empty array of ranges
  const selections = Array(7).fill(null).map(() => []);

  let currentDay = 0; // 0 for Monday, 6 for Sunday
  let isDragging = false;
  let dragStartIndex = null;
  let dragEndIndex = null;

  function renderSlots(dayIndex) {
    slotsContainer.innerHTML = ''; // Clear existing slots
    const daySelections = selections[dayIndex]; // Get selections for the current day

    for (let i = 0; i < SLOT_COUNT; i++) {
      const slot = document.createElement('div');
      slot.classList.add('time-slot-block');
      slot.setAttribute('data-index', i); // Store index for easy access

      // Set displayed time and tooltip
      const slotTime = formatSlotTime(i);
      slot.textContent = slotTime;
      slot.setAttribute('data-time', slotTime); // Tooltip text

      // Apply 'selected' class if the slot is part of a selected range
      if (isSlotSelected(i, daySelections)) {
        slot.classList.add('selected');
      }

      // Add mouse event listeners for drag-to-select functionality
      slot.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return; // Only respond to left click
        isDragging = true;
        dragStartIndex = i;
        dragEndIndex = i;
        updateSelectionVisual(dragStartIndex, dragEndIndex);
        e.preventDefault(); // Prevent text selection
      });

      slot.addEventListener('mouseenter', () => {
        if (!isDragging) return; // Only update on hover if dragging
        dragEndIndex = i;
        updateSelectionVisual(dragStartIndex, dragEndIndex);
      });

      slot.addEventListener('mouseup', () => {
        if (!isDragging) return;
        isDragging = false;
        finalizeSelection(dragStartIndex, dragEndIndex);
      });

      // Add click listener for single slot deselection
      slot.addEventListener('click', () => {
        if (isDragging) return; // Avoid conflict with drag
        if (slot.classList.contains('selected')) {
          removeSlotFromSelection(i);
          renderSlots(currentDay); // Re-render to update visuals
        }
      });

      slotsContainer.appendChild(slot);
    }

    // Global mouseup listener to finalize selection even if mouse leaves a slot
    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        finalizeSelection(dragStartIndex, dragEndIndex);
      }
    }, { once: true }); // Use { once: true } to ensure it runs only once per drag
  }

  // Helper function to check if a slot is within any selected range for a day
  function isSlotSelected(index, daySelections) {
    for (const range of daySelections) {
      if (index >= range.start && index <= range.end) return true;
    }
    return false;
  }

  // Visually update slots during drag
  function updateSelectionVisual(start, end) {
    const minI = Math.min(start, end);
    const maxI = Math.max(start, end);

    const slots = slotsContainer.querySelectorAll('.time-slot-block');
    slots.forEach((slot, idx) => {
      if (idx >= minI && idx <= maxI) {
        slot.classList.add('selected');
      } else {
        // Only remove 'selected' if it's not part of a *previously* finalized selection
        if (!isSlotSelected(idx, selections[currentDay])) {
          slot.classList.remove('selected');
        }
      }
    });
  }

  // Finalize selection after drag ends
  function finalizeSelection(start, end) {
    const minI = Math.min(start, end);
    const maxI = Math.max(start, end);
    addSelectionRange(currentDay, minI, maxI);
    renderSlots(currentDay); // Re-render to reflect the finalized selection
  }

  // Add a new selected range, merging with existing ones if they overlap
  function addSelectionRange(dayIndex, start, end) {
    let ranges = selections[dayIndex];

    const newRange = { start, end };
    const newRanges = [];
    let merged = false;

    // Check for overlaps and merge
    for (const range of ranges) {
      if (range.end < newRange.start - 1 || range.start > newRange.end + 1) {
        // No overlap, keep the existing range
        newRanges.push(range);
      } else {
        // Overlap or touch, merge ranges
        newRange.start = Math.min(newRange.start, range.start);
        newRange.end = Math.max(newRange.end, range.end);
        merged = true;
      }
    }
    newRanges.push(newRange); // Add the new (or merged) range

    // Sort ranges by start time for consistency
    newRanges.sort((a,b) => a.start - b.start);
    selections[dayIndex] = newRanges;
  }

  // Remove a single slot from selection, potentially splitting a range
  function removeSlotFromSelection(index) {
    let ranges = selections[currentDay];
    const newRanges = [];

    for (const range of ranges) {
      if (index < range.start || index > range.end) {
        // Slot is outside this range, keep the range
        newRanges.push(range);
      } else {
        // Slot is within this range, potentially split it
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

  // Event listeners for day buttons to switch active day
  dayButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.classList.contains('active')) return; // Do nothing if already active
      dayButtons.forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      currentDay = parseInt(btn.dataset.day, 10); // Update current day
      renderSlots(currentDay); // Render slots for the new day
    });
  });

  // Event listener for "Clear Selection" button
  clearButton.addEventListener('click', () => {
    selections[currentDay] = []; // Clear all selections for the current day
    renderSlots(currentDay); // Re-render to show cleared state
  });

  // Event listener for "Save Slots" button
  saveButton.addEventListener('click', () => {
    console.log('Créneaux sélectionnés :', selections);
    // In a real application, you would send 'selections' to a server here
    alert('Créneaux sauvegardés (voir console)');
  });

  // Initial rendering of slots for the default day (Monday)
  renderSlots(currentDay);
});
