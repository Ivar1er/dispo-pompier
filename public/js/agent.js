document.addEventListener('DOMContentLoaded', () => {
  // --- Affichage prénom + nom agent ---
  const agentNameDisplay = document.getElementById('agent-name-display');
  let loggedInAgentId = null; // Variable globale pour stocker l'ID de l'agent connecté
  let hasUnsavedChanges = false; // Drapeau pour suivre les modifications non enregistrées

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
        window.location.href = '/index.html';
      }
    } catch (error) {
      console.error('Erreur réseau lors de la récupération des infos de l\'agent :', error);
      window.location.href = '/index.html';
    }
  }

  // --- Gestion du planning ---
  const slotsContainer = document.getElementById('slots-container');
  const dayButtonsContainer = document.querySelector('.day-buttons-container');
  const daysOfWeekNames = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
  let weeklySelections = {};
  let currentMonday = new Date();
  let currentDay = 0; // 0 pour Lundi, 6 pour Dimanche

  // Initialisation de la semaine courante au lundi
  function setMonday() {
    const today = new Date();
    currentMonday = new Date(today);
    currentMonday.setDate(today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1)); // Ajuste pour que le lundi soit le jour 1 et le dimanche le jour 0
  }
  setMonday();

  // Fonction pour formater une date en YYYY-MM-DD
  function formatDate(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Fonction pour obtenir la date pour un jour donné de la semaine en cours
  function getDateForDay(dayIndex) {
    const date = new Date(currentMonday);
    date.setDate(currentMonday.getDate() + dayIndex);
    return date;
  }

  // Fonction pour rendre les créneaux
  function renderSlots(dayIndex) {
    const slotsSliderContainer = document.getElementById('slots-slider-container');
    slotsSliderContainer.innerHTML = ''; // Nettoyer l'affichage précédent
    const todayDate = getDateForDay(dayIndex);
    const dateKey = formatDate(todayDate);
    const selectedSlots = weeklySelections[dateKey] || [];

    for (let i = 0; i < 48; i++) {
      const slot = document.createElement('div');
      slot.classList.add('slot');
      const slotHour = Math.floor(i / 2);
      const slotMinute = (i % 2) * 30;
      const slotTime = `${String(slotHour).padStart(2, '0')}:${String(slotMinute).padStart(2, '0')}`;
      slot.setAttribute('data-slot-id', i);
      slot.setAttribute('data-time', slotTime);

      const isSelected = selectedSlots.includes(i);
      if (isSelected) {
        slot.classList.add('selected');
      }

      const slotLabel = document.createElement('span');
      slotLabel.classList.add('slot-label');
      slotLabel.textContent = slotTime;
      slot.appendChild(slotLabel);

      slotsSliderContainer.appendChild(slot);
    }
  }

  // Gestion des clics sur les créneaux pour sélectionner/désélectionner
  slotsContainer.addEventListener('click', (event) => {
    const slot = event.target.closest('.slot');
    if (slot) {
      const slotId = parseInt(slot.getAttribute('data-slot-id'));
      const dateKey = formatDate(getDateForDay(currentDay));
      
      // S'assurer que le tableau pour cette journée existe
      if (!weeklySelections[dateKey]) {
        weeklySelections[dateKey] = [];
      }

      const index = weeklySelections[dateKey].indexOf(slotId);
      if (index > -1) {
        // Le créneau est déjà sélectionné, on le désélectionne
        weeklySelections[dateKey].splice(index, 1);
        slot.classList.remove('selected');
      } else {
        // Le créneau n'est pas sélectionné, on l'ajoute
        weeklySelections[dateKey].push(slotId);
        slot.classList.add('selected');
      }

      // Indiquer qu'il y a des modifications non enregistrées
      hasUnsavedChanges = true;
      console.log('Modifications non enregistrées.');
    }
  });

  // Gestion du clic sur les boutons de jour
  dayButtonsContainer.addEventListener('click', async (event) => {
    const dayBtn = event.target.closest('.day-btn');
    if (dayBtn && hasUnsavedChanges) {
        const userAction = await showUnsavedChangesModal();
        if (userAction === 'cancel') {
          return; // Empêche le changement de page
        }
        if (userAction === 'save') {
          await saveCurrentWeek();
        }
    }
    if (dayBtn) {
      document.querySelectorAll('.day-btn').forEach(btn => btn.classList.remove('active', 'btn-primary'));
      dayBtn.classList.add('active', 'btn-primary');
      currentDay = parseInt(dayBtn.dataset.day);
      renderSlots(currentDay);
    }
  });


  // --- Fonctionnalités de navigation ---
  const prevWeekBtn = document.getElementById('prev-week-btn');
  const nextWeekBtn = document.getElementById('next-week-btn');
  const weekSelect = document.getElementById('week-select');

  prevWeekBtn.addEventListener('click', async () => {
    if (hasUnsavedChanges) {
        const userAction = await showUnsavedChangesModal();
        if (userAction === 'cancel') return;
        if (userAction === 'save') await saveCurrentWeek();
    }
    changeWeek(-1);
  });
  nextWeekBtn.addEventListener('click', async () => {
    if (hasUnsavedChanges) {
        const userAction = await showUnsavedChangesModal();
        if (userAction === 'cancel') return;
        if (userAction === 'save') await saveCurrentWeek();
    }
    changeWeek(1);
  });
  weekSelect.addEventListener('change', async () => {
    if (hasUnsavedChanges) {
        const userAction = await showUnsavedChangesModal();
        if (userAction === 'cancel') {
          // Annuler le changement de sélection si l'utilisateur annule
          weekSelect.value = formatDate(currentMonday);
          return;
        }
        if (userAction === 'save') await saveCurrentWeek();
    }
    const selectedDate = new Date(weekSelect.value + 'T00:00:00Z');
    currentMonday = selectedDate;
    await loadWeeklySelections(loggedInAgentId, currentMonday);
    renderSlots(currentDay);
  });

  // Gère le changement de semaine
  async function changeWeek(direction) {
    currentMonday.setDate(currentMonday.getDate() + direction * 7);
    const newMondayFormatted = formatDate(currentMonday);
    
    // Mettre à jour la sélection dans le <select>
    weekSelect.value = newMondayFormatted;
    
    await loadWeeklySelections(loggedInAgentId, currentMonday);
    renderSlots(currentDay);
  }

  // Génère les options pour la sélection de la semaine
  function generateWeekOptions() {
    weekSelect.innerHTML = '';
    const today = new Date();
    const currentMonday = new Date(today);
    currentMonday.setDate(today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1));

    // Générer les 4 semaines passées, la semaine actuelle, et 4 semaines à venir
    for (let i = -4; i <= 4; i++) {
      const optionDate = new Date(currentMonday);
      optionDate.setDate(currentMonday.getDate() + i * 7);
      const optionText = `${formatDate(optionDate)} au ${formatDate(new Date(optionDate.getTime() + 6 * 24 * 60 * 60 * 1000))}`;
      const optionValue = formatDate(optionDate);
      const option = new Option(optionText, optionValue);
      weekSelect.add(option);
    }
    weekSelect.value = formatDate(currentMonday);
  }

  // --- Sauvegarde et chargement des données ---
  const saveButton = document.getElementById('save-slots-btn');
  const clearButton = document.getElementById('clear-selection-btn');
  const infoMessage = document.getElementById('selection-info');

  // Charge les sélections de l'agent depuis le serveur pour toute la semaine
  async function loadWeeklySelections(agentId, mondayDate) {
    weeklySelections = {};
    const mondayKey = formatDate(mondayDate);
    const endOfWeek = new Date(mondayDate.getTime() + 6 * 24 * 60 * 60 * 1000);
    const endOfWeekKey = formatDate(endOfWeek);
    const token = sessionStorage.getItem('token');

    try {
      const response = await fetch(`/api/planning/${agentId}?start=${mondayKey}&end=${endOfWeekKey}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
      });
      if (!response.ok) {
        throw new Error('Erreur de chargement du planning.');
      }
      const data = await response.json();
      weeklySelections = data.planning;
      console.log('Planning chargé avec succès:', weeklySelections);
    } catch (error) {
      console.error('Erreur lors du chargement du planning:', error);
      infoMessage.textContent = 'Erreur lors du chargement des données.';
    }
  }

  async function saveCurrentWeek() {
    const token = sessionStorage.getItem('token');
    if (!loggedInAgentId) {
      alert('Erreur: ID agent non trouvé.');
      return false;
    }

    let successCount = 0;
    let errorCount = 0;
    const savePromises = [];

    for (let i = 0; i < 7; i++) {
        const dateKey = formatDate(getDateForDay(i));
        const selections = weeklySelections[dateKey] || [];
        
        savePromises.push(
            fetch(`/api/planning/${loggedInAgentId}/day/${dateKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ slots: selections })
            })
            .then(response => {
                if (response.ok) {
                    successCount++;
                } else {
                    return response.json().then(errorData => {
                        console.error(`Erreur d'enregistrement pour le ${daysOfWeekNames[i]} (${dateKey}) :`, errorData.message);
                        errorCount++;
                    }).catch(() => {
                        console.error(`Erreur d'enregistrement pour le ${daysOfWeekNames[i]} (${dateKey}) : Réponse non-JSON`);
                        errorCount++;
                    });
                }
            })
            .catch(error => {
                console.error(`Erreur réseau lors de l'enregistrement pour le ${daysOfWeekNames[i]} (${dateKey}) :`, error);
                errorCount++;
            })
        );
    }

    await Promise.allSettled(savePromises);

    if (errorCount === 0) {
        // J'ai remplacé les alertes par une info dans l'UI pour éviter les problèmes
        infoMessage.textContent = 'Créneaux sauvegardés avec succès !';
        setTimeout(() => infoMessage.textContent = '', 3000);
    } else {
        infoMessage.textContent = `Enregistrement terminé avec ${successCount} succès et ${errorCount} échecs.`;
    }
 
    return errorCount === 0;
  }

  saveButton.addEventListener('click', async () => {
    const ok = await saveCurrentWeek();
    if (ok) {
      hasUnsavedChanges = false;
    }
  });

  clearButton.addEventListener('click', () => {
    const dateKey = formatDate(getDateForDay(currentDay));
    weeklySelections[dateKey] = [];
    hasUnsavedChanges = true; // Une modification a été faite
    renderSlots(currentDay);
  });
  
  // --- Gestion des popups et de la déconnexion ---
  const logoutButton = document.getElementById('logout-btn');
  const modal = document.getElementById('unsaved-changes-modal');
  const modalSaveBtn = document.getElementById('modal-save-btn');
  const modalLeaveBtn = document.getElementById('modal-leave-btn');
  const modalCancelBtn = document.getElementById('modal-cancel-btn');

  // Fonction pour afficher la modale
  function showUnsavedChangesModal() {
    return new Promise(resolve => {
      modal.classList.add('visible');

      const onSave = async () => {
        modal.classList.remove('visible');
        const saved = await saveCurrentWeek();
        resolve(saved ? 'save' : 'cancel'); // Si la sauvegarde échoue, on annule
        removeListeners();
      };
      
      const onLeave = () => {
        modal.classList.remove('visible');
        resolve('leave');
        removeListeners();
      };
      
      const onCancel = () => {
        modal.classList.remove('visible');
        resolve('cancel');
        removeListeners();
      };

      const removeListeners = () => {
        modalSaveBtn.removeEventListener('click', onSave);
        modalLeaveBtn.removeEventListener('click', onLeave);
        modalCancelBtn.removeEventListener('click', onCancel);
      };

      modalSaveBtn.addEventListener('click', onSave);
      modalLeaveBtn.addEventListener('click', onLeave);
      modalCancelBtn.addEventListener('click', onCancel);
    });
  }

  // Gestion du clic de déconnexion
  logoutButton.addEventListener('click', async (event) => {
    event.preventDefault(); // Empêche la redirection immédiate
    if (hasUnsavedChanges) {
      const userAction = await showUnsavedChangesModal();
      if (userAction === 'cancel') {
        return; // L'utilisateur a annulé, on ne fait rien
      }
    }
    // Si pas de changements ou l'utilisateur a choisi de quitter/sauvegarder
    sessionStorage.removeItem('token'); 
    sessionStorage.removeItem('agentId'); 
    sessionStorage.removeItem('agentPrenom');
    sessionStorage.removeItem('agentNom');
    sessionStorage.removeItem('userRole');
    window.location.href = '/index.html'; 
  });
  
  // --- Gestion du rafraichissement de page / de la fermeture d'onglet ---
  // L'événement 'beforeunload' est moins fiable et ne peut afficher un message personnalisé
  // mais on le garde pour une confirmation de base
  window.addEventListener('beforeunload', (event) => {
    if (hasUnsavedChanges) {
      // Le message personnalisé ne s'affiche plus pour des raisons de sécurité,
      // mais la simple existence de returnValue suffit à afficher un message du navigateur.
      event.returnValue = 'Vous avez des modifications non enregistrées. Voulez-vous vraiment quitter ?';
    }
  });


  // --- Exécution initiale ---
  generateWeekOptions();
  loadAgentInfo();
});