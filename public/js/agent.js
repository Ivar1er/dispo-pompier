document.addEventListener('DOMContentLoaded', () => {
  // --- Affichage prénom + nom agent ---
  const agentNameDisplay = document.getElementById('agent-name-display');
  let loggedInAgentId = null; // Variable globale pour stocker l'ID de l'agent connecté

  // Fonction pour charger et afficher les informations de l'agent
  async function loadAgentInfo() {
    const token = localStorage.getItem('token'); // Assurez-vous que le token est stocké ici après la connexion

    if (!token) {
      console.warn('Aucun token trouvé. Affichage des informations par défaut.');
      agentNameDisplay.textContent = 'Agent Inconnu';
      // Pour une application réelle, vous voudriez peut-être rediriger vers la page de connexion ici.
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
        loggedInAgentId = agentInfo.id; // Stocker l'ID de l'agent

        // Une fois l'ID de l'agent disponible, charger son planning et l'afficher
        if (loggedInAgentId) {
            await loadWeeklySelections(loggedInAgentId, currentMonday);
            renderSlots(currentDay);
        }
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

  // --- Fonction ISO semaine ---
  function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1)/7);
    return weekNo;
  }

  // --- Gestion sélecteur semaine ---
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

  // selections est maintenant une variable globale qui sera remplie par les données du serveur
  // Elle représente les créneaux sélectionnés pour toute la semaine
  let selections = Array(7).fill(null).map(() => []);

  let currentDay = 0;
  let isDragging = false;
  let dragStartIndex = null;
  let dragEndIndex = null;

  // Fonction pour charger les sélections de la semaine depuis le serveur
  async function loadWeeklySelections(agentId, mondayDate) {
      // Réinitialiser les sélections en mémoire avant de charger de nouvelles données
      selections = Array(7).fill(null).map(() => []);

      const year = mondayDate.getFullYear();
      const weekNum = getWeekNumber(mondayDate);
      // Le format de la clé de semaine doit correspondre à ce que le serveur renvoie (ex: "S 25")
      const isoWeekString = `S ${weekNum}`;

      try {
          const token = localStorage.getItem('token');
          if (!token) {
              console.warn('Aucun token trouvé pour charger les sélections hebdomadaires.');
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
              const planning = await response.json(); // Données complètes du planning de l'agent
              const currentWeekPlanning = planning[isoWeekString]; // Planning pour la semaine actuelle

              if (currentWeekPlanning) {
                  // Mappage des noms de jours du serveur aux index de jours du client (0=Lun, 6=Dim)
                  const dayMap = {
                      'lundi': 0, 'mardi': 1, 'mercredi': 2, 'jeudi': 3,
                      'vendredi': 4, 'samedi': 5, 'dimanche': 6
                  };

                  for (const dayName in currentWeekPlanning) {
                      const dayIndex = dayMap[dayName];
                      if (dayIndex !== undefined) {
                          // Les données du serveur sont déjà des objets {start, end}
                          selections[dayIndex] = currentWeekPlanning[dayName];
                      }
                  }
              }
          } else {
              console.error(`Erreur lors du chargement du planning hebdomadaire: ${response.status} ${response.statusText}`);
          }
      } catch (error) {
          console.error('Erreur réseau lors du chargement du planning hebdomadaire:', error);
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
      const selectedIndex = parseInt(event.target.value, 10);
      const newMonday = new Date(currentMonday);
      newMonday.setDate(newMonday.getDate() + (selectedIndex - 1) * 7);
      currentMonday = getMonday(newMonday);
      initWeekSelector();

      // Charger les sélections de la nouvelle semaine si l'agent est connecté
      if (loggedInAgentId) {
          await loadWeeklySelections(loggedInAgentId, currentMonday);
          renderSlots(currentDay);
      } else {
          // Si pas d'ID d'agent (ex: pas encore chargé), réinitialiser les sélections
          selections = Array(7).fill(null).map(() => []);
          renderSlots(currentDay);
      }
    });
  }

  // Event listeners for week navigation buttons
  const prevWeekBtn = document.getElementById('prev-week-btn');
  const nextWeekBtn = document.getElementById('next-week-btn');

  prevWeekBtn.addEventListener('click', async () => {
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

  initWeekSelector(); // Initialiser le sélecteur de semaine au chargement

  // --- Sélection des créneaux horaires ---
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
          newRanges.push({ start: index + 1, end: range.end });
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

  // Logique du bouton "Enregistrer" modifiée pour envoyer au serveur
  saveButton.addEventListener('click', async () => {
    if (!loggedInAgentId) {
        alert('Impossible d\'enregistrer : ID de l\'agent non disponible. Veuillez vous reconnecter.');
        return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
        alert('Impossible d\'enregistrer : non authentifié. Veuillez vous reconnecter.');
        return;
    }

    const daysOfWeekNames = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < 7; i++) {
        const daySelections = selections[i]; // Sélections pour ce jour (index 0-6)

        // Calculer la date exacte pour ce jour de la semaine actuelle
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
                body: JSON.stringify(daySelections) // Envoyer le tableau d'objets {start, end} pour ce jour
            });

            if (response.ok) {
                successCount++;
            } else {
                const errorData = await response.json();
                console.error(`Erreur d'enregistrement pour le ${daysOfWeekNames[i]} (${dateKey}) :`, errorData.message);
                errorCount++;
            }
        } catch (error) {
            console.error(`Erreur réseau lors de l'enregistrement pour le ${daysOfWeekNames[i]} (${dateKey}) :`, error);
            errorCount++;
        }
    }

    if (errorCount === 0) {
        alert('Créneaux sauvegardés avec succès pour toute la semaine !');
    } else {
        alert(`Enregistrement terminé avec ${successCount} succès et ${errorCount} échecs. Vérifiez la console pour les détails.`);
    }
  });

  // --- Logique du bouton de déconnexion ---
  const logoutButton = document.getElementById('logout-btn');
  if (logoutButton) {
    logoutButton.addEventListener('click', () => {
      localStorage.removeItem('token'); // Supprime le token JWT du localStorage
      // Optionnel : Si vous avez un agentId stocké, supprimez-le aussi
      // localStorage.removeItem('agentId'); 
      window.location.href = 'login.html'; // Redirige vers la page de connexion
    });
  }

  // Appeler la fonction de chargement des infos de l'agent au tout début
  loadAgentInfo();
});
