document.addEventListener('DOMContentLoaded', () => {
  // --- Affichage prénom + nom agent ---
  const agentNameDisplay = document.getElementById('agent-name-display');
  const agentQualificationsDisplay = document.getElementById('agentQualificationsDisplay');
  const weekDateRangeDisplay = document.getElementById('week-date-range');
  const slotsContainer = document.getElementById('slots-slider-container');
  const saveButton = document.getElementById('save-slots-btn');
  const clearButton = document.getElementById('clear-selection-btn');
  const dayButtonsContainer = document.querySelector('.day-buttons-container');
  const prevWeekBtn = document.getElementById('prev-week-btn');
  const nextWeekBtn = document.getElementById('next-week-btn');
  const weekSelect = document.getElementById('week-select');
  const selectionInfo = document.getElementById('selection-info');
  const logoutButton = document.getElementById('logout-btn');

  let loggedInAgentId = null; // Variable globale pour stocker l'ID de l'agent connecté
  const daysOfWeekNames = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
  let currentMonday = new Date();
  let currentDay = 0; // 0 pour lundi, 6 pour dimanche
  let currentSelections = {};
  let hasUnsavedChanges = false;
  let weeklyPlanning = {};

  // Fonction utilitaire pour formater une date en YYYY-MM-DD
  function formatDate(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Fonctions de gestion de la semaine
  function getMonday(d) {
    d = new Date(d);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Ajustement pour dimanche (day=0)
    return new Date(d.setDate(diff));
  }

  function addDays(date, days) {
    const newDate = new Date(date);
    newDate.setDate(date.getDate() + days);
    return newDate;
  }

  function updateWeekDisplay() {
    const startOfWeek = getMonday(currentMonday);
    const endOfWeek = addDays(startOfWeek, 6);
    weekDateRangeDisplay.textContent = `Du ${formatDate(startOfWeek)} au ${formatDate(endOfWeek)}`;
  }

  async function loadWeeklySelections(agentId, monday) {
    const mondayKey = formatDate(monday);
    const token = sessionStorage.getItem('token');
    try {
      const response = await fetch(`/api/planning/${agentId}/week?start_date=${mondayKey}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        weeklyPlanning = await response.json();
        currentSelections = {};
        for (const date in weeklyPlanning) {
          currentSelections[date] = weeklyPlanning[date].slots;
        }
        renderSlots(currentDay);
      } else {
        console.error("Erreur lors du chargement du planning de la semaine.");
        weeklyPlanning = {};
        currentSelections = {};
        renderSlots(currentDay);
      }
    } catch (error) {
      console.error("Erreur réseau lors du chargement du planning de la semaine :", error);
    }
  }

  function renderSlots(dayIndex) {
    slotsContainer.innerHTML = '';
    const startOfDay = addDays(currentMonday, dayIndex);
    const dateKey = formatDate(startOfDay);
    const slotsForDay = currentSelections[dateKey] || [];
    selectionInfo.textContent = `Sélection actuelle pour le ${daysOfWeekNames[dayIndex]} : ${slotsForDay.length} créneaux`;

    for (let i = 0; i < 48; i++) {
      const slot = document.createElement('div');
      slot.className = 'time-slot-block';
      slot.dataset.slotIndex = i;
      const hour = Math.floor(i / 2);
      const minute = (i % 2) * 30;
      slot.dataset.time = `${hour.toString().padStart(2, '0')}h${minute.toString().padStart(2, '0')}`;

      if (slotsForDay.includes(i)) {
        slot.classList.add('selected');
      }

      slot.addEventListener('click', () => {
        slot.classList.toggle('selected');
        const index = parseInt(slot.dataset.slotIndex);
        const slotsForDay = currentSelections[dateKey] || [];
        if (slot.classList.contains('selected')) {
          if (!slotsForDay.includes(index)) {
            slotsForDay.push(index);
          }
        } else {
          const slotIndex = slotsForDay.indexOf(index);
          if (slotIndex > -1) {
            slotsForDay.splice(slotIndex, 1);
          }
        }
        currentSelections[dateKey] = slotsForDay;
        selectionInfo.textContent = `Sélection actuelle pour le ${daysOfWeekNames[dayIndex]} : ${slotsForDay.length} créneaux`;
        hasUnsavedChanges = true;
      });
      slotsContainer.appendChild(slot);
    }
  }

  // --- Gestion des événements ---
  // CORRECTION: Ajout des listeners pour la navigation entre les semaines
  prevWeekBtn.addEventListener('click', () => {
    currentMonday = addDays(currentMonday, -7);
    updateWeekDisplay();
    loadWeeklySelections(loggedInAgentId, currentMonday);
  });

  nextWeekBtn.addEventListener('click', () => {
    currentMonday = addDays(currentMonday, 7);
    updateWeekDisplay();
    loadWeeklySelections(loggedInAgentId, currentMonday);
  });

  // CORRECTION: Ajout des listeners pour la navigation entre les jours
  dayButtonsContainer.addEventListener('click', (event) => {
    const target = event.target;
    if (target.classList.contains('day-btn')) {
      const dayIndex = parseInt(target.dataset.day);
      currentDay = dayIndex;

      // Met à jour la classe 'active' sur les boutons de jour
      document.querySelectorAll('.day-btn').forEach(btn => btn.classList.remove('active'));
      target.classList.add('active');

      renderSlots(currentDay);
    }
  });


  // Initialisation du sélecteur de semaine
  function populateWeekSelect() {
    weekSelect.innerHTML = '';
    const today = new Date();
    for (let i = 0; i < 52; i++) {
      const monday = getMonday(addDays(today, i * 7));
      const option = document.createElement('option');
      option.value = formatDate(monday);
      option.textContent = `Semaine du ${formatDate(monday)}`;
      weekSelect.appendChild(option);
    }
  }

  weekSelect.addEventListener('change', (event) => {
    currentMonday = new Date(event.target.value);
    updateWeekDisplay();
    loadWeeklySelections(loggedInAgentId, currentMonday);
  });

  // Fonction pour charger et afficher les informations de l'agent
  async function loadAgentInfo() {
    const token = sessionStorage.getItem('token');

    if (!token) {
      console.warn('Aucun token trouvé. Redirection vers la page de connexion.');
      window.location.href = '/index.html';
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
        agentQualificationsDisplay.textContent = `Qualifié pour : ${agentInfo.qualifications.join(', ')}`;
        loggedInAgentId = agentInfo.id;

        if (loggedInAgentId) {
          currentMonday = getMonday(new Date());
          updateWeekDisplay();
          populateWeekSelect();
          await loadWeeklySelections(loggedInAgentId, currentMonday);
          renderSlots(currentDay);
        }
      } else {
        const errorData = await response.json();
        console.error('Erreur lors de la récupération des infos de l\'agent :', errorData.message);
        window.location.href = '/index.html';
      }
    } catch (error) {
      console.error('Erreur réseau lors de la récupération des infos de l\'agent :', error);
      window.location.href = '/index.html';
    }
  }

  async function saveCurrentWeek() {
    const token = sessionStorage.getItem('token');
    const startOfWeek = getMonday(currentMonday);
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < 7; i++) {
      const day = addDays(startOfWeek, i);
      const dateKey = formatDate(day);
      const slotsToSave = currentSelections[dateKey] || [];

      try {
        const response = await fetch(`/api/planning/${loggedInAgentId}/${dateKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ slots: slotsToSave })
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
      // Remplacer alert() par une solution UI plus élégante
      // alert('Créneaux sauvegardés avec succès pour toute la semaine !');
    } else {
      // Remplacer alert() par une solution UI plus élégante
      // alert(`Enregistrement terminé avec ${successCount} succès et ${errorCount} échecs. Vérifiez la console pour les détails.`);
    }

    return true;
  }

  saveButton.addEventListener('click', async () => {
    const ok = await saveCurrentWeek();
    if (ok) {
      hasUnsavedChanges = false;
    }
  });

  clearButton.addEventListener('click', () => {
    const dayButtons = document.querySelectorAll('.day-btn');
    const activeDayBtn = Array.from(dayButtons).find(btn => btn.classList.contains('active'));
    const dayIndex = parseInt(activeDayBtn.dataset.day);
    const dateKey = formatDate(addDays(currentMonday, dayIndex));
    currentSelections[dateKey] = [];
    renderSlots(dayIndex);
  });

  // CORRECTION: Ajout du listener pour le bouton de déconnexion
  if (logoutButton) {
    logoutButton.addEventListener('click', () => {
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('agentId');
      sessionStorage.removeItem('agentPrenom');
      sessionStorage.removeItem('agentNom');
      sessionStorage.removeItem('userRole');
      window.location.href = '/index.html';
    });
  }

  loadAgentInfo();
});