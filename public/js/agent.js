document.addEventListener('DOMContentLoaded', () => {
  // --- Affichage prénom + nom agent ---
  const agentNameDisplay = document.getElementById('agent-name-display');
  let loggedInAgentId = null; // Variable globale pour stocker l'ID de l'agent connecté

  // Fonction pour charger et afficher les informations de l'agent
  async function loadAgentInfo() {
    const token = sessionStorage.getItem('token'); 

    if (!token) {
      console.warn('Aucun token trouvé. Affichage des informations par défaut.');
      agentNameDisplay.textContent = 'Agent Inconnu';
      // Rediriger vers la page de connexion si aucun token n'est trouvé
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
        console.error('Erreur lors de la récupération des infos de l\'agent :', errorData.message);
        // En cas d'erreur (token invalide, par exemple), rediriger vers la page de connexion
        window.location.href = '/index.html';
      }
    } catch (error) {
      console.error('Erreur réseau lors de la récupération des infos de l\'agent :', error);
      // Rediriger vers la page de connexion en cas d'erreur réseau
      window.location.href = '/index.html';
    }
  }

  // --- Gestion du temps (jours, semaines, etc.) ---
  const dayDisplay = document.getElementById('day-display');
  const prevDayBtn = document.getElementById('prev-day-btn');
  const nextDayBtn = document.getElementById('next-day-btn');
  const slotContainer = document.getElementById('slot-container');
  const weekSelect = document.getElementById('week-select');
  const prevWeekBtn = document.getElementById('prev-week-btn');
  const nextWeekBtn = document.getElementById('next-week-btn');

  let currentDay = new Date();
  let currentMonday = new Date();
  let selectedSlots = {};
  const daysOfWeekNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  
  // Utiliser une Map pour un accès rapide aux sélections par date
  let weeklySelections = new Map();
  let hasUnsavedChanges = false;
  
  // Fonction pour initialiser la date de début de semaine
  function getStartOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Ajuste pour Lundi = 1, Dimanche = 0
    return new Date(d.getFullYear(), d.getMonth(), diff);
  }

  // Fonction pour formater la date pour l'affichage
  function formatDate(date) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('fr-FR', options);
  }
  
  function getWeekNumber(d) {
    // Copy date so don't modify original
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    // Set to nearest Thursday: current date + 4 - current day number
    // Make Sunday's day number 7
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
    // Get first day of year
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    // Calculate full weeks to go
    var weekNo = Math.ceil((((d - yearStart) / 86400000) + 1)/7);
    return weekNo;
  }

  // Fonction pour charger les plannings depuis l'API
  async function loadWeeklySelections(agentId, monday) {
    const token = sessionStorage.getItem('token');
    const weekKey = `W${getWeekNumber(monday)}-${monday.getFullYear()}`;
    const dateKey = monday.toISOString().split('T')[0];

    try {
        const response = await fetch(`/api/planning/${agentId}?week=${weekKey}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const data = await response.json();
            
            // Initialisation avec le planning récupéré
            selectedSlots = {};
            for (const day in data) {
                selectedSlots[day] = data[day].sort((a, b) => a.start - b.start);
            }
        } else {
            console.error(`Erreur de chargement du planning pour la semaine ${weekKey}. Code: ${response.status}`);
            // Si le planning n'existe pas, on initialise un objet vide
            selectedSlots = {};
        }
    } catch (error) {
        console.error(`Erreur réseau lors du chargement du planning pour la semaine ${weekKey}:`, error);
        selectedSlots = {}; // En cas d'erreur, on part sur un planning vide pour la semaine
    }
  }

  // Fonction pour vérifier si une heure est déjà dans un créneau existant
  function isTimeInAnySlot(day, time) {
    if (!selectedSlots[day]) return false;
    return selectedSlots[day].some(slot => time >= slot.start && time < slot.end);
  }
  
  function addSelectionRange(day, start, end) {
    if (!selectedSlots[day]) {
      selectedSlots[day] = [];
    }

    // Fusionner ou ajouter le nouveau créneau
    let newSlots = [];
    let added = false;

    // Trier pour faciliter la fusion
    const sortedSlots = [...selectedSlots[day], { start, end }].sort((a, b) => a.start - b.start);

    for (let i = 0; i < sortedSlots.length; i++) {
      if (newSlots.length === 0 || sortedSlots[i].start > newSlots[newSlots.length - 1].end) {
        // Créneau non fusionnable, on l'ajoute
        newSlots.push({ ...sortedSlots[i] });
      } else {
        // Fusion du créneau
        newSlots[newSlots.length - 1].end = Math.max(newSlots[newSlots.length - 1].end, sortedSlots[i].end);
      }
    }
    selectedSlots[day] = newSlots;
    hasUnsavedChanges = true;
  }
  
  function removeSlotFromSelection(time) {
      const currentSelections = weeklySelections.get(currentDay.toISOString().split('T')[0]);
      if (!currentSelections) return;

      const newSelections = [];
      let found = false;
      for (const slot of currentSelections) {
          if (time >= slot.start && time < slot.end) {
              // Séparation du créneau
              if (time > slot.start) {
                  newSelections.push({ start: slot.start, end: time });
              }
              if (time + 1 < slot.end) {
                  newSelections.push({ start: time + 1, end: slot.end });
              }
              found = true;
          } else {
              newSelections.push(slot);
          }
      }
      if (found) {
          weeklySelections.set(currentDay.toISOString().split('T')[0], newSelections);
          hasUnsavedChanges = true;
      }
  }


  // --- Fonction pour l'affichage des créneaux ---
  function renderSlots(date) {
    slotContainer.innerHTML = '';
    const dayKey = date.toISOString().split('T')[0];
    dayDisplay.textContent = `${daysOfWeekNames[date.getDay()]} - ${formatDate(date)}`;

    for (let i = 0; i < 24; i++) {
      const slot = document.createElement('div');
      slot.classList.add('slot');
      slot.textContent = `${String(i).padStart(2, '0')}:00`;
      slot.dataset.hour = i;

      // Vérifier si le créneau est sélectionné
      if (isTimeInAnySlot(dayKey, i)) {
          slot.classList.add('selected');
      }

      // --- Gestion du glisser-déposer ---
      let isDragging = false;
      let startHour = null;
      let endHour = null;

      // Correction: on ajoute les listeners une seule fois pour tous les slots
      slot.addEventListener('mousedown', (e) => {
          isDragging = true;
          startHour = parseInt(e.target.dataset.hour);
          endHour = startHour;
          addSelectionRange(dayKey, startHour, endHour + 1);
          renderSlots(date);
      });
      
      slot.addEventListener('mouseenter', (e) => {
          if (isDragging) {
              const currentHour = parseInt(e.target.dataset.hour);
              const newStart = Math.min(startHour, currentHour);
              const newEnd = Math.max(startHour, currentHour);

              selectedSlots[dayKey] = selectedSlots[dayKey].filter(slot => slot.start < newStart || slot.end > newEnd + 1);
              addSelectionRange(dayKey, newStart, newEnd + 1);
              renderSlots(date);
          }
      });
      
      // *** CORRECTION CLÉ : on réinitialise isDragging ***
      // On écoute le "mouseup" sur l'ensemble de la page pour ne rien manquer
      document.body.addEventListener('mouseup', () => {
        isDragging = false;
      });

      // La gestion du glisser-déposer est prioritaire, on n'utilise le click que si ce n'est pas un drag
      slot.addEventListener('click', () => {
        if (isDragging) return;
        if (slot.classList.contains('selected')) {
          removeSlotFromSelection(dayKey, i); // Assurez-vous que cette fonction est correctement implémentée
        } else {
          addSelectionRange(dayKey, i, i + 1);
        }
        hasUnsavedChanges = true;
        renderSlots(date);
      });

      slotContainer.appendChild(slot);
    }
  }

  // --- Fonctions de navigation ---
  prevDayBtn.addEventListener('click', () => {
    currentDay.setDate(currentDay.getDate() - 1);
    renderSlots(currentDay);
  });
  
  nextDayBtn.addEventListener('click', () => {
    currentDay.setDate(currentDay.getDate() + 1);
    renderSlots(currentDay);
  });
  
  async function maybeSaveBeforeWeekChange() {
    if (!hasUnsavedChanges) return true;
    const wantSave = confirm('Vous avez des modifications non enregistrées pour cette semaine. Voulez-vous les enregistrer avant de changer de semaine ?');
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

  // Correction: Gérer le changement de semaine
  weekSelect.addEventListener('change', async () => {
    const newWeekStr = weekSelect.value;
    const [year, weekNum] = newWeekStr.split('-');

    // Calculer la date du lundi pour la nouvelle semaine
    const monday = new Date(year, 0, 1 + (weekNum - 1) * 7);
    const day = monday.getDay();
    const diff = monday.getDate() - day + (day === 0 ? -6 : 1);
    monday.setDate(diff);

    currentMonday = monday;
    currentDay = monday;
    await loadWeeklySelections(loggedInAgentId, currentMonday);
    renderSlots(currentDay);
  });

  prevWeekBtn.addEventListener('click', async () => {
    if (await maybeSaveBeforeWeekChange()) {
      currentMonday.setDate(currentMonday.getDate() - 7);
      currentDay = currentMonday;
      await loadWeeklySelections(loggedInAgentId, currentMonday);
      renderSlots(currentDay);
    }
  });

  nextWeekBtn.addEventListener('click', async () => {
    if (await maybeSaveBeforeWeekChange()) {
      currentMonday.setDate(currentMonday.getDate() + 7);
      currentDay = currentMonday;
      await loadWeeklySelections(loggedInAgentId, currentMonday);
      renderSlots(currentDay);
    }
  });


  // --- API / Fonctions de sauvegarde ---
  const saveButton = document.getElementById('save-btn');
  const agentId = sessionStorage.getItem('agentId'); // Assurez-vous que l'agentId est bien stocké
  
  async function saveCurrentWeek() {
    if (!agentId) {
      alert('Erreur: Agent ID non trouvé.');
      return false;
    }

    // Créer un objet avec les données à sauvegarder
    const payload = {};
    for (const day in selectedSlots) {
        payload[day] = selectedSlots[day];
    }
    
    // Convertir les données en JSON
    const dataToSend = JSON.stringify(payload);
    
    // Envoyer les données à l'API
    try {
        const response = await fetch(`/api/agent-availability/${agentId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionStorage.getItem('token')}`
            },
            body: dataToSend
        });
        
        if (response.ok) {
            alert('Créneaux sauvegardés avec succès !');
            hasUnsavedChanges = false;
            return true;
        } else {
            const errorData = await response.json();
            alert(`Erreur d'enregistrement : ${errorData.message}`);
            return false;
        }
    } catch (error) {
        console.error('Erreur réseau lors de l\'enregistrement:', error);
        alert('Erreur réseau. Veuillez vérifier votre connexion.');
        return false;
    }
  }
  
  // Fonction pour sauvegarder la semaine actuelle
  async function saveCurrentWeek() {
    const monday = getStartOfWeek(currentDay);
    const weekKey = `W${getWeekNumber(monday)}-${monday.getFullYear()}`;
    const token = sessionStorage.getItem('token');
    
    if (!token) {
        alert('Non authentifié. Veuillez vous reconnecter.');
        return false;
    }

    const unsavedDays = {};
    for (const key of weeklySelections.keys()) {
      unsavedDays[key] = weeklySelections.get(key);
    }

    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < 7; i++) {
        const date = new Date(currentMonday);
        date.setDate(currentMonday.getDate() + i);
        const dateKey = date.toISOString().split('T')[0];

        const dayData = selectedSlots[dateKey] || [];

        try {
            const response = await fetch(`/api/agent-availability/${loggedInAgentId}/${dateKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ slots: dayData })
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
    logoutButton.addEventListener('click', () => {
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