document.addEventListener('DOMContentLoaded', () => {
  // --- Affichage prÃ©nom + nom agent ---
  const agentNameDisplay = document.getElementById('agent-name-display');
  let loggedInAgentId = null; // Variable globale pour stocker l'ID de l'agent connectÃ©

  // Fonction pour charger et afficher les informations de l'agent
  async function loadAgentInfo() {
    const token = sessionStorage.getItem('token'); 

    if (!token) {
      console.warn('Aucun token trouvÃ©. Affichage des informations par dÃ©faut.');
      agentNameDisplay.textContent = 'Agent Inconnu';
      // Rediriger vers la page de connexion si aucun token n'est trouvÃ©
      window.location.href = '/index.html'; // CHANGEMENT: Utiliser un chemin absolu vers votre page de connexion
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
        loggedInAgentId = agentInfo.id; 

        if (loggedInAgentId) {
            await loadWeeklySelections(loggedInAgentId, currentMonday);
            renderSlots(currentDay);
        }
      } else {
        const errorData = await response.json();
        console.error('Erreur lors de la rÃ©cupÃ©ration des infos de l\'agent :', errorData.message);
        agentNameDisplay.textContent = 'Erreur de chargement des infos';
        if (response.status === 403) {
          sessionStorage.removeItem('token'); 
          window.location.href = '/index.html'; // CHANGEMENT: Utiliser un chemin absolu
        }
      }
    } catch (error) {
      console.error('Erreur rÃ©seau lors de la rÃ©cupÃ©ration des infos de l\'agent :', error);
      agentNameDisplay.textContent = 'Erreur rÃ©seau';
    }
  }

  // --- Fonction ISO semaine ---
  function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1)/7);
    return weekNo;
  }

  // --- Gestion sÃ©lecteur semaine ---
  let currentMonday = getMonday(new Date());

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

  const SLOT_COUNT = 48;
  const START_HOUR = 7;

  let selections = Array(7).fill(null).map(() => []);
  let hasUnsavedChanges = false;

  let currentDay = 0;
  let isDragging = false;
  let dragStartIndex = null;
  let dragEndIndex = null;
  let isDeselectDrag = false; // Drag démarré sur un créneau déjà sélectionné => on désélectionne

  async function loadWeeklySelections(agentId, mondayDate) {
      selections = Array(7).fill(null).map(() => []);

      const year = mondayDate.getFullYear();
      const weekNum = getWeekNumber(mondayDate);
      const isoWeekString = `S ${weekNum}`;

      try {
          const token = sessionStorage.getItem('token');
          if (!token) {
              console.warn('Aucun token trouvÃ© pour charger les sÃ©lections hebdomadaires.');
              return;
          }

          const response = await fetch(`/api/planning/${agentId}`, {
              method: 'GET',
              headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
              }
          });

          if (response.ok) {
              const planning = await response.json();
              const currentWeekPlanning = planning[isoWeekString];

              hasUnsavedChanges = false;
              if (currentWeekPlanning) {
                  const dayMap = {
                      'lundi': 0, 'mardi': 1, 'mercredi': 2, 'jeudi': 3,
                      'vendredi': 4, 'samedi': 5, 'dimanche': 6
                  };

                  for (const dayName in currentWeekPlanning) {
                      const dayIndex = dayMap[dayName];
                      if (dayIndex !== undefined) {
                          selections[dayIndex] = currentWeekPlanning[dayName];
                      }
                  }
              }
          } else {
              console.error(`Erreur lors du chargement du planning hebdomadaire: ${response.status} ${response.statusText}`);
          }
      } catch (error) {
          console.error('Erreur rÃ©seau lors du chargement du planning hebdomadaire:', error);
      }
  }


  
  async function maybeSaveBeforeWeekChange() {
    if (!hasUnsavedChanges) return true;
    const wantSave = confirm('Vous avez des modifications non enregistrÃ©es pour cette semaine. Voulez-vous les enregistrer avant de changer de semaine ?');
    if (!wantSave) return true;
    try {
      const ok = await saveCurrentWeek();
      if (ok) { hasUnsavedChanges = false; }
      return true;
    } catch (e) {
      console.error('Erreur lors de l\'enregistrement avant changement de semaine:', e);
      return false;
    }
  }

  
  // --- Demander l'enregistrement avant DECONNEXION (même logique que changement de semaine) ---
  async function maybeSaveBeforeLogout() {
    if (!hasUnsavedChanges) return true;
    const wantSave = confirm('Vous avez des modifications non enregistrées pour cette semaine. Voulez-vous les enregistrer avant de vous déconnecter ?');
    if (!wantSave) return true;
    try {
      const ok = await saveCurrentWeek();
      if (ok) { hasUnsavedChanges = false; }
      return true;
    } catch (e) {
      console.error('Erreur lors de l\'enregistrement avant déconnexion:', e);
      // On laisse l'utilisateur décider de partir quand même
      return confirm('L\'enregistrement a échoué. Voulez-vous quand même vous déconnecter ?');
    }
  }
function initWeekSelector() {
    const weekSelect = document.getElementById('week-select');

    weekSelect.innerHTML = '';

    const weeks = [];
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

    weekSelect.selectedIndex = 1;

    weekSelect.addEventListener('change', async (event) => {
    const canProceed = await maybeSaveBeforeWeekChange();
    if (!canProceed) { event.preventDefault(); return; }
      const selectedIndex = parseInt(event.target.value, 10);
      const newMonday = new Date(currentMonday);
      newMonday.setDate(newMonday.getDate() + (selectedIndex - 1) * 7);
      currentMonday = getMonday(newMonday);
      initWeekSelector();

      if (loggedInAgentId) {
          await loadWeeklySelections(loggedInAgentId, currentMonday);
          renderSlots(currentDay);
      } else {
          selections = Array(7).fill(null).map(() => []);
          renderSlots(currentDay);
      }
    });
  }

  const prevWeekBtn = document.getElementById('prev-week-btn');
  const nextWeekBtn = document.getElementById('next-week-btn');

  prevWeekBtn.addEventListener('click', async () => {
    const canProceed = await maybeSaveBeforeWeekChange();
    if (!canProceed) return;
    currentMonday.setDate(currentMonday.getDate() - 7);
    initWeekSelector();
    if (loggedInAgentId) {
        await loadWeeklySelections(loggedInAgentId, currentMonday);
        renderSlots(currentDay);
    } else {
        selections = Array(7).fill(null).map(() => []);
        renderSlots(currentDay);
    }
  });

  nextWeekBtn.addEventListener('click', async () => {
    const canProceed = await maybeSaveBeforeWeekChange();
    if (!canProceed) return;
    currentMonday.setDate(currentMonday.getDate() + 7);
    initWeekSelector();
    if (loggedInAgentId) {
        await loadWeeklySelections(loggedInAgentId, currentMonday);
        renderSlots(currentDay);
    } else {
        selections = Array(7).fill(null).map(() => []);
        renderSlots(currentDay);
    }
  });

  initWeekSelector();

  const dayButtons = document.querySelectorAll('.day-btn');
  const slotsContainer = document.getElementById('slots-slider-container');
  const saveButton = document.getElementById('save-slots-btn');
  const clearButton = document.getElementById('clear-selection-btn');

  function renderSlots(dayIndex) {
    slotsContainer.innerHTML = '';
    const daySelections = selections[dayIndex];

    for (let i = 0; i < SLOT_COUNT; i++) {
      const slot = document.createElement('div');
      slot.classList.add('time-slot-block');
      slot.setAttribute('data-index', i);

      const slotTime = formatSlotTime(i);
      slot.textContent = slotTime;
      slot.setAttribute('data-time', slotTime);

      if (isSlotSelected(i, daySelections)) {
        slot.classList.add('selected');
      }

      slot.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        isDragging = true;
        isDeselectDrag = isSlotSelected(i, selections[currentDay]);
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
        if (isDeselectDrag) {
          removeSelectionRange(currentDay, dragStartIndex, dragEndIndex);
        } else {
          finalizeSelection(dragStartIndex, dragEndIndex);
        }
        isDeselectDrag = false;
      });
      // --- Touch support for mobile ---
      slot.addEventListener('touchstart', (e) => {
        isDragging = true;
        isDeselectDrag = isSlotSelected(i, selections[currentDay]);
        dragStartIndex = i;
        dragEndIndex = i;
        updateSelectionVisual(dragStartIndex, dragEndIndex);
        // EmpÃªcher le dÃ©filement de la page lors du glisser-dÃ©poser
        e.preventDefault(); 
      }, { passive: false });

      slot.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        const touch = e.touches[0];
        const target = document.elementFromPoint(touch.clientX, touch.clientY);
        if (target && target.classList.contains('time-slot-block')) {
            dragEndIndex = parseInt(target.getAttribute('data-index'), 10);
            updateSelectionVisual(dragStartIndex, dragEndIndex);
        }
        e.preventDefault(); // EmpÃªcher le dÃ©filement
      }, { passive: false });

      slot.addEventListener('touchend', () => {
        if (!isDragging) return;
        isDragging = false;
        finalizeSelection(dragStartIndex, dragEndIndex);
      });

      slot.addEventListener('click', () => {
        // La gestion du glisser-dÃ©poser est prioritaire, on n'utilise le click que si ce n'est pas un drag
        if (isDragging) return; 
        if (slot.classList.contains('selected')) {
          removeSlotFromSelection(i);
        } else {
          addSelectionRange(currentDay, i, i);
        }
        hasUnsavedChanges = true;
        renderSlots(currentDay);
      });
      
      slotsContainer.appendChild(slot);
    }

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        if (isDeselectDrag) {
          removeSelectionRange(currentDay, dragStartIndex, dragEndIndex);
        } else {
          finalizeSelection(dragStartIndex, dragEndIndex);
        }
        isDeselectDrag = false;
      }
    }, { once: true });

    document.addEventListener('touchend', () => {
        if (isDragging) {
            isDragging = false;
            if (isDeselectDrag) {
                removeSelectionRange(currentDay, dragStartIndex, dragEndIndex);
            } else {
                finalizeSelection(dragStartIndex, dragEndIndex);
            }
            isDeselectDrag = false;
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
      const inDrag = idx >= minI && idx <= maxI;
      const currently = isSlotSelected(idx, selections[currentDay]);
      const shouldBeSelected = isDeselectDrag ? (currently && !inDrag) : (currently || inDrag);
      if (shouldBeSelected) {
        slot.classList.add('selected');
      } else {
        slot.classList.remove('selected');
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
    hasUnsavedChanges = true;
  }

  // Supprimer une plage [start, end] de la sélection du jour donné
  function removeSelectionRange(dayIndex, start, end) {
    const minI = Math.min(start, end);
    const maxI = Math.max(start, end);
    const ranges = selections[dayIndex];
    const newRanges = [];
    for (const r of ranges) {
      if (r.end < minI || r.start > maxI) {
        // Aucun recouvrement
        newRanges.push(r);
      } else {
        // Conserver la partie gauche si elle existe
        if (r.start < minI) {
          newRanges.push({ start: r.start, end: minI - 1 });
        }
        // Conserver la partie droite si elle existe
        if (r.end > maxI) {
          newRanges.push({ start: maxI + 1, end: r.end });
        }
      }
    }
    newRanges.sort((a,b) => a.start - b.start);
    selections[dayIndex] = newRanges;
    hasUnsavedChanges = true;
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
          newRanges.push({ start: index + 1, end: range.end });
        }
      }
    }
    selections[currentDay] = newRanges;
    hasUnsavedChanges = true;
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
    hasUnsavedChanges = true;
    renderSlots(currentDay);
  });

  
  async function saveCurrentWeek() {
    if (!loggedInAgentId) {
        alert('Impossible d\'enregistrer : ID de l\'agent non disponible. Veuillez vous reconnecter.');
        return;
    }

    const token = sessionStorage.getItem('token');
    if (!token) {
        alert('Impossible d\'enregistrer : non authentifiÃ©. Veuillez vous reconnecter.');
        return;
    }

    const daysOfWeekNames = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < 7; i++) {
        const daySelections = selections[i];

        const dateForDay = new Date(currentMonday);
        dateForDay.setDate(currentMonday.getDate() + i);
        const dateKey = `${dateForDay.getFullYear()}-${String(dateForDay.getMonth() + 1).padStart(2, '0')}-${String(dateForDay.getDate()).padStart(2, '0')}`;

        try {
            const response = await fetch(`/api/agent-availability/${dateKey}/${loggedInAgentId}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(daySelections)
            });

            if (response.ok) {
                successCount++;
            } else {
                const errorData = await response.json();
                console.error(`Erreur d'enregistrement pour le ${daysOfWeekNames[i]} (${dateKey}) :`, errorData.message);
                errorCount++;
            }
        } catch (error) {
            console.error(`Erreur rÃ©seau lors de l'enregistrement pour le ${daysOfWeekNames[i]} (${dateKey}) :`, error);
            errorCount++;
        }
    }

    if (errorCount === 0) {
        alert('CrÃ©neaux sauvegardÃ©s avec succÃ¨s pour toute la semaine !');
    } else {
        alert(`Enregistrement terminÃ© avec ${successCount} succÃ¨s et ${errorCount} Ã©checs. VÃ©rifiez la console pour les dÃ©tails.`);
    }
 
    return true;
  }

  saveButton.addEventListener('click', async () => {
    const ok = await saveCurrentWeek();
    if (ok) {
      hasUnsavedChanges = false;
    }
  });


  const logoutButton = document.getElementById('logout-btn');
  if (logoutButton) {
    logoutButton.addEventListener('click', async () => {
      const canLogout = await maybeSaveBeforeLogout();
      if (!canLogout) return;
      sessionStorage.removeItem('token'); 
      sessionStorage.removeItem('agentId'); 
      sessionStorage.removeItem('agentPrenom');
      sessionStorage.removeItem('agentNom');
      sessionStorage.removeItem('userRole');

      // CHANGEMENT CRUCIAL ICI: Utiliser un chemin absolu pour la redirection
      window.location.href = '/index.html'; // Assurez-vous que index.html est votre page de connexion
    });
  }

  loadAgentInfo();
});