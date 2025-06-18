// agent.js

// Variables globales pour le suivi de l'état de l'application
let currentWeekIdentifier = ''; // Pour stocker l'identifiant de la semaine (ex: "2025-W25")
let currentWeekDates = {}; // { startDate: "JJ/MM", endDate: "JJ/MM" }
let currentDailyAvailabilities = {}; // Stocke les disponibilités de l'agent pour chaque jour de la semaine courante
let hasUnsavedChanges = false; // Indique si des changements non sauvegardés existent
let isDragging = false; // Pour la sélection multiple par glisser-déposer
let dragStartSlot = null; // Le créneau où le glisser-déposer a commencé
let currentAgentId = ''; // L'ID de l'agent connecté
let currentAgentName = ''; // Le nom complet de l'agent connecté
let currentAgentRole = ''; // Le rôle de l'agent connecté (pour distinguer admin/agent)

// Map pour les noms des jours (peut être utile pour l'affichage)
const dayNames = {
    'lundi': 'Lundi',
    'mardi': 'Mardi',
    'mercredi': 'Mercredi',
    'jeudi': 'Jeudi',
    'vendredi': 'Vendredi',
    'samedi': 'Samedi',
    'dimanche': 'Dimanche'
};
const dayNamesInverse = {
    'Lundi': 'lundi',
    'Mardi': 'mardi',
    'Mercredi': 'mercredi',
    'Jeudi': 'jeudi',
    'Vendredi': 'vendredi',
    'Samedi': 'samedi',
    'Dimanche': 'dimanche'
};
const daysOrder = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

// URL de base de votre API
const API_BASE_URL = "https://dispo-pompier.onrender.com";

// Références DOM globales (seront initialisées dans init())
let agentDisplayName, weekSelector, logoutBtn, saveSlotsBtn, clearSelectionBtn, synthesisBtn, loadingSpinner;
let messageBox, messageText, closeMessageBox; // Pour la boîte de message personnalisée

/**
 * Affiche ou masque le spinner de chargement.
 * @param {boolean} isLoading - True pour afficher, false pour masquer.
 */
function showSpinner(isLoading) {
    if (loadingSpinner) {
        loadingSpinner.classList.toggle("hidden", !isLoading);
        // Désactiver le bouton de sauvegarde pendant le chargement
        if (saveSlotsBtn) saveSlotsBtn.disabled = isLoading;
    }
}

/**
 * Affiche une boîte de message personnalisée au lieu d'alert().
 * @param {string} message - Le message à afficher.
 */
function showCustomMessage(message) {
    if (messageBox && messageText && closeMessageBox) {
        messageText.textContent = message;
        messageBox.classList.remove('hidden');
        closeMessageBox.onclick = () => {
            messageBox.classList.add('hidden');
        };
    } else {
        console.error("Éléments de la boîte de message personnalisée non trouvés. Affichage dans la console à la place : " + message);
    }
}

/**
 * Effectue un appel API authentifié.
 * Ajoute automatiquement le token JWT de localStorage dans l'en-tête Authorization.
 */
async function callApi(endpoint, method = 'GET', body = null) {
    const token = localStorage.getItem('token');
    if (!token) {
        console.warn("[AGENT.JS Debug] Token JWT manquant lors de l'appel API. Redirection vers la page de connexion.");
        showCustomMessage("Votre session a expiré ou n'est pas valide. Veuillez vous reconnecter.");
        logout();
        return null;
    }

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };

    const options = {
        method: method,
        headers: headers
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, options);

        if (response.status === 401 || response.status === 403) {
            const errorData = await response.json();
            console.error(`[AGENT.JS Debug] Erreur d'authentification/autorisation pour ${endpoint}:`, errorData.message);
            showCustomMessage(errorData.message || "Votre session a expiré ou n'est pas valide. Veuillez vous reconnecter.");
            logout();
            return null;
        }

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[AGENT.JS Debug] Erreur HTTP ${response.status} pour ${endpoint}:`, errorText);
            throw new Error(`Erreur serveur: ${response.status} ${errorText}`);
        }

        return await response.json();
    } catch (error) {
        console.error(`[AGENT.JS Debug] Erreur lors de l'appel API à ${endpoint}:`, error);
        throw error;
    }
}

/**
 * Charge les informations de l'agent connecté.
 * Met à jour le nom affiché dans la navbar et initialise currentAgentId et currentAgentName.
 */
async function fetchAgentInfo() {
    showSpinner(true);
    try {
        const userId = localStorage.getItem('userId');
        if (!userId) {
            console.error("[AGENT.JS Debug] ID utilisateur non trouvé dans localStorage lors de fetchAgentInfo.");
            showCustomMessage("ID utilisateur manquant. Veuillez vous reconnecter.");
            logout();
            return;
        }

        // Si currentAgentName est déjà défini par localStorage au démarrage, on l'utilise
        // Sinon, on tente de le récupérer via l'API (moins optimal si déjà dans localStorage)
        if (!currentAgentName || !currentAgentRole) {
            const data = await callApi(`/api/users/${userId}`);
            if (data) {
                currentAgentName = `${data.prenom} ${data.nom}`;
                currentAgentRole = data.role; // Récupère le rôle de l'utilisateur
                localStorage.setItem('userName', currentAgentName); // Mise à jour si manquante
                localStorage.setItem('userRole', currentAgentRole); // Mise à jour si manquante
            }
        }

        if (agentDisplayName) {
            agentDisplayName.textContent = currentAgentName || 'Agent';
        }

        // Ajuster l'interface en fonction du rôle
        adjustUIForRole();

    } catch (error) {
        console.error("[AGENT.JS Debug] Erreur lors de la récupération des informations de l'agent:", error);
        showCustomMessage("Impossible de charger les informations de l'agent.");
        logout(); // Si on ne peut pas charger les infos, la session est peut-être corrompue
    } finally {
        showSpinner(false);
    }
}

/**
 * Charge les identifiants des semaines disponibles et remplit le sélecteur.
 * Charge ensuite le planning de la semaine la plus récente.
 */
async function fetchWeeks() {
    showSpinner(true);
    try {
        const weeks = await callApi(`/api/weeks`);
        if (weeks) {
            weekSelector.innerHTML = ''; // Effacer les options existantes
            // Trier les semaines pour que la plus récente soit sélectionnée par défaut
            weeks.sort((a, b) => b.localeCompare(a));

            weeks.forEach(weekId => {
                const option = document.createElement('option');
                option.value = weekId;
                option.textContent = `Semaine ${weekId.split('-W')[1]} (${weekId.split('-W')[0]})`;
                weekSelector.appendChild(option);
            });

            // Sélectionner la semaine la plus récente ou celle déjà en cours
            currentWeekIdentifier = weekSelector.value || weeks[0];
            if (currentWeekIdentifier) {
                weekSelector.value = currentWeekIdentifier;
                await fetchAgentPlanning(currentAgentId, currentWeekIdentifier);
            }
        }
    } catch (error) {
        console.error("[AGENT.JS Debug] Erreur lors du chargement des semaines:", error);
        showCustomMessage("Impossible de charger les semaines disponibles.");
    } finally {
        showSpinner(false);
    }
}

/**
 * Récupère le planning de l'agent pour une semaine donnée.
 * @param {string} agentId - L'ID de l'agent.
 * @param {string} weekId - L'identifiant de la semaine (ex: "2025-W25").
 */
async function fetchAgentPlanning(agentId, weekId) {
    showSpinner(true);
    try {
        const planning = await callApi(`/api/planning/${agentId}/${weekId}`);
        if (planning) {
            currentDailyAvailabilities = planning.dailyAvailabilities || {};
            currentWeekDates = planning.weekDates || {}; // Assurez-vous que weekDates est inclus
            renderSchedule();
            hasUnsavedChanges = false;
            updateSaveButtonVisibility();
        }
    } catch (error) {
        console.error(`[AGENT.JS Debug] Erreur lors du chargement du planning de l'agent ${agentId} pour la semaine ${weekId}:`, error);
        showCustomMessage("Impossible de charger le planning.");
        // Gérer le cas où le planning n'existe pas encore pour cette semaine/agent
        currentDailyAvailabilities = {}; // Réinitialise les disponibilités
        renderSchedule(); // Affiche un tableau vide
    } finally {
        showSpinner(false);
    }
}

/**
 * Sauvegarde les modifications du planning de l'agent.
 */
async function saveAllSelectedSlots() {
    showSpinner(true);
    try {
        // Préparer les données pour la sauvegarde (similaire à la structure de dailyAvailabilities)
        const updatedPlanning = {
            dailyAvailabilities: currentDailyAvailabilities,
            weekDates: currentWeekDates // Inclure les dates de la semaine
        };

        const response = await callApi(`/api/planning/${currentAgentId}/${currentWeekIdentifier}`, 'PUT', updatedPlanning);
        if (response) {
            showCustomMessage("Planning sauvegardé avec succès !");
            hasUnsavedChanges = false;
            updateSaveButtonVisibility();
            console.log("[AGENT.JS Debug] Planning sauvegardé:", response);
        }
    } catch (error) {
        console.error("[AGENT.JS Debug] Erreur lors de la sauvegarde du planning:", error);
        showCustomMessage("Erreur lors de la sauvegarde du planning.");
    } finally {
        showSpinner(false);
    }
}

/**
 * Rend le planning de la semaine dans les onglets.
 */
function renderSchedule() {
    const scheduleContainer = document.getElementById('schedule-container');
    if (!scheduleContainer) {
        console.error("[AGENT.JS Debug] Élément 'schedule-container' non trouvé.");
        return;
    }

    daysOrder.forEach(dayKey => {
        const dayDiv = document.getElementById(dayKey);
        if (!dayDiv) return;

        dayDiv.innerHTML = ''; // Nettoyer le contenu précédent

        const dayName = dayNames[dayKey];
        const date = currentWeekDates[dayKey] || ''; // Récupère la date spécifique du jour
        
        // Titre du jour avec la date
        const dayHeader = document.createElement('h5');
        dayHeader.textContent = `${dayName} ${date ? `(${date})` : ''}`;
        dayDiv.appendChild(dayHeader);

        const table = document.createElement('table');
        table.classList.add('table', 'table-bordered', 'mt-3');
        const tbody = document.createElement('tbody');

        const hours = [
            "00h-04h", "04h-08h", "08h-12h", "12h-16h", "16h-20h", "20h-00h"
        ];

        hours.forEach(hourSlot => {
            const row = document.createElement('tr');
            const hourCell = document.createElement('td');
            hourCell.textContent = hourSlot;
            row.appendChild(hourCell);

            const statusCell = document.createElement('td');
            statusCell.classList.add('slot-cell');
            statusCell.dataset.day = dayKey;
            statusCell.dataset.hour = hourSlot;

            const currentStatus = currentDailyAvailabilities[dayKey]?.[hourSlot] || 'indisponible';
            statusCell.classList.add(currentStatus); // 'disponible', 'indisponible', 'reserve'

            statusCell.textContent = currentStatus === 'disponible' ? 'Disponible' :
                                     currentStatus === 'indisponible' ? 'Indisponible' :
                                     currentStatus === 'reserve' ? 'Réservé' : '';


            row.appendChild(statusCell);
            tbody.appendChild(row);
        });

        table.appendChild(tbody);
        dayDiv.appendChild(table);
    });
}


/**
 * Gère le clic sur un créneau pour changer son statut.
 * @param {Event} event - L'événement de clic.
 */
function handleSlotClick(event) {
    const target = event.target.closest('.slot-cell');
    if (!target) return;

    const day = target.dataset.day;
    const hour = target.dataset.hour;

    // Ne pas modifier les créneaux déjà "réservés" par un admin
    if (currentDailyAvailabilities[day]?.[hour] === 'reserve') {
        showCustomMessage("Ce créneau est déjà réservé et ne peut pas être modifié par vous.");
        return;
    }

    // Toggle entre 'disponible' et 'indisponible'
    const currentStatus = currentDailyAvailabilities[day]?.[hour] || 'indisponible';
    const newStatus = (currentStatus === 'indisponible' || currentStatus === 'reserve') ? 'disponible' : 'indisponible';

    // Mettre à jour l'objet de données local
    if (!currentDailyAvailabilities[day]) {
        currentDailyAvailabilities[day] = {};
    }
    currentDailyAvailabilities[day][hour] = newStatus;

    // Mettre à jour la classe CSS
    target.classList.remove('disponible', 'indisponible', 'reserve');
    target.classList.add(newStatus);
    target.textContent = newStatus === 'disponible' ? 'Disponible' : 'Indisponible';

    hasUnsavedChanges = true;
    updateSaveButtonVisibility();
}

/**
 * Configure les écouteurs de souris pour la sélection multiple par glisser-déposer.
 */
function setupMouseListenersForSelection() {
    const scheduleContainer = document.getElementById('schedule-container');
    if (!scheduleContainer) return;

    scheduleContainer.addEventListener('mousedown', (e) => {
        const target = e.target.closest('.slot-cell');
        if (target) {
            isDragging = true;
            dragStartSlot = { day: target.dataset.day, hour: target.dataset.hour };
            // Appliquer immédiatement le changement au premier slot
            handleSlotClick(e); // Simule un clic pour le premier élément sélectionné
            target.classList.add('drag-selection'); // Ajouter une classe visuelle pour le drag
        }
    });

    scheduleContainer.addEventListener('mouseover', (e) => {
        if (isDragging) {
            const target = e.target.closest('.slot-cell');
            if (target && target.dataset.day && target.dataset.hour) {
                // Seulement si le slot n'est pas "reservé"
                if (currentDailyAvailabilities[target.dataset.day]?.[target.dataset.hour] !== 'reserve') {
                    // Appliquer le changement de statut au slot survolé
                    // (on bascule toujours vers 'disponible' lors d'un drag, ou on le garde si déjà réservé/indispo)
                    const day = target.dataset.day;
                    const hour = target.dataset.hour;
                    const initialStatus = currentDailyAvailabilities[dragStartSlot.day][dragStartSlot.hour];
                    
                    if (!currentDailyAvailabilities[day]) {
                        currentDailyAvailabilities[day] = {};
                    }
                    
                    // Si le slot de départ était 'disponible', tous les slots dragués deviennent 'disponible'
                    // Si le slot de départ était 'indisponible', tous les slots dragués deviennent 'indisponible'
                    const newStatus = initialStatus === 'disponible' ? 'disponible' : 'indisponible';

                    // Appliquer ce statut au slot survolé (sauf si réservé)
                    if (currentDailyAvailabilities[day]?.[hour] !== 'reserve') {
                         currentDailyAvailabilities[day][hour] = newStatus;
                    }
                   
                    // Mettre à jour l'affichage
                    target.classList.remove('disponible', 'indisponible', 'reserve');
                    target.classList.add(currentDailyAvailabilities[day][hour]);
                    target.textContent = currentDailyAvailabilities[day][hour] === 'disponible' ? 'Disponible' :
                                         currentDailyAvailabilities[day][hour] === 'indisponible' ? 'Indisponible' :
                                         'Réservé'; // Si c'est 'reserve', ne change pas le texte


                    hasUnsavedChanges = true;
                    updateSaveButtonVisibility();
                }
            }
        }
    });

    scheduleContainer.addEventListener('mouseup', () => {
        isDragging = false;
        dragStartSlot = null;
        // Supprimer la classe de sélection visuelle après le drag
        document.querySelectorAll('.slot-cell').forEach(cell => {
            cell.classList.remove('drag-selection');
        });
    });

    // Empêcher la sélection de texte lors du glisser-déposer
    scheduleContainer.addEventListener('selectstart', (e) => {
        if (isDragging) e.preventDefault();
    });
}

/**
 * Efface toutes les sélections de disponibilité faites par l'utilisateur pour la semaine courante,
 * ramenant tous les créneaux à 'indisponible', sauf ceux qui sont 'réservé'.
 */
function clearSelection() {
    showCustomMessage("Voulez-vous vraiment effacer toutes vos sélections pour cette semaine ? Cela mettra tous les créneaux à 'Indisponible' (sauf les créneaux réservés).",
        () => { // Callback si l'utilisateur confirme
            for (const day in currentDailyAvailabilities) {
                for (const hour in currentDailyAvailabilities[day]) {
                    // Ne pas effacer les créneaux "réservés" par un admin
                    if (currentDailyAvailabilities[day][hour] !== 'reserve') {
                        currentDailyAvailabilities[day][hour] = 'indisponible';
                    }
                }
            }
            renderSchedule(); // Re-rendre le tableau avec les modifications
            hasUnsavedChanges = true;
            updateSaveButtonVisibility();
            showCustomMessage("Sélection effacée.");
        },
        true // Indique que c'est une confirmation, pas juste un message d'info
    );
}

/**
 * Affiche/masque les boutons "Enregistrer" et "Effacer la sélection"
 * en fonction de la présence de changements non sauvegardés.
 */
function updateSaveButtonVisibility() {
    if (saveSlotsBtn && clearSelectionBtn) {
        if (hasUnsavedChanges) {
            saveSlotsBtn.style.display = 'inline-block';
            clearSelectionBtn.style.display = 'inline-block';
        } else {
            saveSlotsBtn.style.display = 'none';
            clearSelectionBtn.style.display = 'none';
        }
    }
}

/**
 * Configure les onglets Bootstrap pour le planning quotidien.
 */
function setupDayTabs() {
    const triggerTabList = document.querySelectorAll('#myTab button');
    triggerTabList.forEach(triggerEl => {
        const tabTrigger = new bootstrap.Tab(triggerEl);

        triggerEl.addEventListener('click', event => {
            event.preventDefault();
            tabTrigger.show();
        });
    });

    // Attacher les gestionnaires d'événements de clic aux cellules des slots
    const scheduleContainer = document.getElementById('schedule-container');
    if (scheduleContainer) {
        scheduleContainer.addEventListener('click', handleSlotClick);
    }
}

/**
 * Affiche la synthèse des réservations de l'agent.
 */
async function showSynthesis() {
    showSpinner(true);
    try {
        const synthesis = await callApi(`/api/planning/${currentAgentId}/${currentWeekIdentifier}/synthesis`);
        if (synthesis) {
            let synthesisMessage = `Synthèse des réservations pour la semaine ${currentWeekIdentifier}:\n\n`;
            if (synthesis.reservations && synthesis.reservations.length > 0) {
                synthesis.reservations.forEach(r => {
                    synthesisMessage += `- ${dayNames[r.dayKey]} (${r.date}): ${r.hourSlot} - Statut: ${r.status}\n`;
                });
            } else {
                synthesisMessage += "Aucune réservation pour cette semaine.";
            }
            showCustomMessage(synthesisMessage);
        }
    } catch (error) {
        console.error("[AGENT.JS Debug] Erreur lors de l'affichage de la synthèse:", error);
        showCustomMessage("Impossible d'afficher la synthèse des réservations.");
    } finally {
        showSpinner(false);
    }
}

/**
 * Fonction de déconnexion.
 * Nettoie le localStorage et redirige vers la page de connexion.
 */
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userId');
    localStorage.removeItem('userName');
    currentAgentId = '';
    currentAgentName = '';
    currentAgentRole = '';
    window.location.href = 'index.html'; // Redirection vers la page de connexion
}

/**
 * Ajuste les éléments de l'interface utilisateur en fonction du rôle de l'agent.
 * Par exemple, masquer/afficher des boutons d'admin.
 */
function adjustUIForRole() {
    const isAdmin = (currentAgentRole === 'admin');
    const adminPanelLink = document.getElementById('admin-panel-link');
    // Si adminPanelLink existe et si l'agent est un admin, le montre. Sinon, le cache.
    if (adminPanelLink) {
        adminPanelLink.style.display = isAdmin ? 'block' : 'none';
    }

    // Si d'autres éléments spécifiques à l'admin existent, les gérer ici
    // Exemple: adminOnlyButton.style.display = isAdmin ? 'block' : 'none';
}


/**
 * Fonction d'initialisation principale, appelée au chargement du DOM.
 */
function init() {
    // Initialiser les références DOM
    agentDisplayName = document.getElementById("agent-display-name");
    weekSelector = document.getElementById("week-selector");
    logoutBtn = document.getElementById("logout-btn");
    saveSlotsBtn = document.getElementById("save-slots-btn");
    clearSelectionBtn = document.getElementById("clear-selection-btn");
    synthesisBtn = document.getElementById("synthesis-btn");
    loadingSpinner = document.getElementById("loading-spinner");
    messageBox = document.getElementById('message-box');
    messageText = document.getElementById('message-text');
    closeMessageBox = document.getElementById('close-message-box');


    // Vérifier l'authentification au chargement de la page agent/admin
    const token = localStorage.getItem('token');
    const userRole = localStorage.getItem('userRole');
    const userIdFromStorage = localStorage.getItem('userId');
    const userNameFromStorage = localStorage.getItem('userName');

    console.log(`[AGENT.JS Debug] --- Vérification Session au chargement ---`);
    console.log(`[AGENT.JS Debug] Token from localStorage: ${token ? 'Présent' : 'Absent'}`);
    console.log(`[AGENT.JS Debug] Rôle from localStorage: ${userRole}`);
    console.log(`[AGENT.JS Debug] ID utilisateur from localStorage: ${userIdFromStorage}`);
    console.log(`[AGENT.JS Debug] Nom utilisateur from localStorage: ${userNameFromStorage}`);
    console.log(`[AGENT.JS Debug] --- Fin Vérification Session ---`);

    if (!token || !userRole || !userIdFromStorage) {
        console.warn("[AGENT.JS] Aucun token, rôle ou ID utilisateur trouvé au chargement de la page. Redirection vers la connexion.");
        showCustomMessage("Votre session a expiré ou n'est pas valide. Veuillez vous reconnecter.");
        logout(); // Redirige si pas de token/rôle
        return; // Arrête l'exécution de init()
    }

    currentAgentId = userIdFromStorage;
    currentAgentName = userNameFromStorage;
    currentAgentRole = userRole; // Assigner le rôle récupéré

    // Mettre à jour le nom affiché dans la navbar immédiatement
    if (agentDisplayName) {
        agentDisplayName.textContent = currentAgentName || 'Chargement...';
    }

    // Attacher les écouteurs d'événements
    if (weekSelector) {
        weekSelector.addEventListener('change', (e) => {
            currentWeekIdentifier = e.target.value;
            fetchAgentPlanning(currentAgentId, currentWeekIdentifier);
        });
    }

    if (saveSlotsBtn) {
        saveSlotsBtn.addEventListener('click', saveAllSelectedSlots);
    }
    if (clearSelectionBtn) {
        clearSelectionBtn.addEventListener('click', clearSelection);
    }
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
    if (synthesisBtn) {
        synthesisBtn.addEventListener('click', showSynthesis);
    }

    // Gérer l'avertissement de fermeture de page avec des changements non sauvegardés
    window.addEventListener('beforeunload', function(event) {
        if (hasUnsavedChanges) {
            const confirmationMessage = 'Vous avez des modifications non sauvegardées. Êtes-vous sûr de vouloir quitter ?';
            event.returnValue = confirmationMessage; // Standard pour les anciens navigateurs
            return confirmationMessage; // Pour les navigateurs modernes
        }
    });

    // Chargement initial des données
    fetchAgentInfo(); // Charge les infos de l'agent au démarrage et set currentAgentId/Name/Role
    fetchWeeks(); // Charge les semaines et le planning de la semaine par défaut
    setupDayTabs(); // Initialise les onglets Bootstrap
    setupMouseListenersForSelection(); // Configure les écouteurs de souris pour le glisser-déposer
    adjustUIForRole(); // Ajuste l'UI en fonction du rôle
}

// Appel de la fonction d'initialisation principale une fois le DOM entièrement chargé
document.addEventListener('DOMContentLoaded', init); // Fin de DOMContentLoaded
