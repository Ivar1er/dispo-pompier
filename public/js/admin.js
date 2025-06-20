// admin.js

const days = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const API_BASE_URL = "https://dispo-pompier.onrender.com";

let currentWeek; // Ex: 25 (number)
let currentDay = 'lundi'; // Jour actuel par default pour le planning
let planningData = {}; // Contiendra le planning global chargé de l'API { agentId: { week-X: { day: [slots] } } }
let agentDisplayInfos = {}; // Mapping dynamique agentId => {nom, prenom, qualifications, grades}
let availableQualifications = []; // Liste des qualifications disponibles chargée depuis l'API
let availableGrades = []; // Nouvelle: Liste des grades disponibles chargée depuis l'API

// --- DOM Elements pour la navigation principale (onglets) ---
const mainTabButtons = document.querySelectorAll('.main-tab');
const mainTabContents = document.querySelectorAll('.main-tab-content');

// --- DOM Elements pour la vue "Planning Global" ---
const headerPlanningControls = document.querySelector('.header-planning-controls');
const weekSelect = document.getElementById("week-select");
const dateRangeDisplay = document.getElementById("date-range");
const planningContainer = document.getElementById("global-planning");
const tabButtons = document.querySelectorAll(".tab");
const adminInfo = document.getElementById("admin-info");


// --- DOM Elements pour la vue "Gestion des Agents" ---
const addAgentForm = document.getElementById('addAgentForm');
const newAgentQualificationsCheckboxes = document.getElementById('newAgentQualificationsCheckboxes');
const newAgentGradesCheckboxes = document.getElementById('newAgentGradesCheckboxes');
const addAgentMessage = document.getElementById('addAgentMessage');
const agentsTableBody = document.getElementById('agentsTableBody');
const listAgentsMessage = document.getElementById('listAgentsMessage');

// --- DOM Elements pour la Modale de modification d'agent et de qualifications ---
const editAgentModalElement = document.getElementById('editAgentModal');
const closeEditAgentModalButton = editAgentModalElement ? editAgentModalElement.querySelector('.close-button') : null;
const editAgentFormElement = document.getElementById('editAgentForm');
const editAgentId = document.getElementById('editAgentId');
const editAgentNom = document.getElementById('editAgentNom');
const editAgentPrenom = document.getElementById('editAgentPrenom');
const editAgentNewPassword = document.getElementById('editAgentNewPassword');
const editAgentMessage = document.getElementById('editAgentMessage');
const qualificationsCheckboxesDiv = document.getElementById('qualificationsCheckboxes'); // Pour la modale de modification
const gradesCheckboxesDiv = document.getElementById('gradesCheckboxes'); // Pour la modale de modification
const qualificationsMessage = document.getElementById('qualificationsMessage');
const gradesMessage = document.getElementById('gradesMessage');

// --- DOM Elements pour la vue "Gestion des Qualifications" ---
const addQualificationFormElement = document.getElementById('addQualificationForm');
const addQualificationMessage = document.getElementById('addQualificationMessage');
const qualificationsTableBody = document.getElementById('qualificationsTableBody');
const listQualificationsMessage = document.getElementById('listQualificationsMessage');
const editQualificationModalElement = document.getElementById('editQualificationModal');
const closeQualButton = editQualificationModalElement ? editQualificationModalElement.querySelector('.close-button') : null;
const editQualificationFormElement = document.getElementById('editQualificationForm');
const editQualId = document.getElementById('editQualId');
const editQualName = document.getElementById('editQualName');
const editQualMessage = document.getElementById('editQualMessage');

// --- DOM Elements pour la vue "Gestion des Grades" ---
const addGradeFormElement = document.getElementById('addGradeForm');
const addGradeMessage = document.getElementById('addGradeMessage');
const gradesTableBody = document.getElementById('gradesTableBody');
const listGradesMessage = document.getElementById('listGradesMessage');
const editGradeModalElement = document.getElementById('editGradeModal');
const closeGradeButton = editGradeModalElement ? editGradeModalElement.querySelector('.close-button') : null;
const editGradeFormElement = document.getElementById('editGradeForm');
const editGradeId = document.getElementById('editGradeId');
const editGradeName = document.getElementById('editGradeName');
const editGradeMessage = document.getElementById('editGradeMessage');

// --- Global DOM Elements ---
const loadingSpinner = document.getElementById("loading-spinner");
const logoutButton = document.getElementById("logout-btn");


// Créneaux 30 min sur 24h
const horaires = [];
const startHourDisplay = 7;
for (let i = 0; i < 48; i++) {
  const currentSlotHour = (startHourDisplay + Math.floor(i / 2)) % 24;
  const currentSlotMinute = (i % 2) * 30;
  const endSlotHour = (startHourDisplay + Math.floor((i + 1) / 2)) % 24;
  const endSlotMinute = ((i + 1) % 2) * 30;
  const start = `${String(currentSlotHour).padStart(2, '0')}:${String(currentSlotMinute).padStart(2, '0')}`;
  const end = `${String(endSlotHour).padStart(2, '0')}:${String(endSlotMinute).padStart(2, '0')}`;
  horaires.push(`${start} - ${end}`);
}

// --- Helpers de date ---

/**
 * Calcule le numéro de semaine ISO 8601 pour une date donnée.
 * La semaine 1 est celle qui contient le premier jeudi de l'année.
 * @param {Date} date - La date pour laquelle calculer le numéro de semaine.
 * @returns {number} Le numéro de semaine ISO 8601.
 */
function getCurrentISOWeek(date = new Date()) {
    const _date = new Date(date.getTime());
    _date.setHours(0, 0, 0, 0);
    _date.setDate(_date.getDate() + 3 - ((_date.getDay() + 6) % 7));
    const week1 = new Date(_date.getFullYear(), 0, 4);
    return (
        1 +
        Math.round(
            ((_date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7
        )
    );
}

/**
 * Récupère la plage de dates (début-fin) pour un numéro de semaine ISO donné.
 * @param {number} weekNumber - Le numéro de semaine ISO.
 * @param {number} year - L'année.
 * @returns {string} La plage de dates formatée (ex: "du 16/06 au 22/06").
 */
function getWeekDateRange(weekNumber, year = new Date().getFullYear()) {
  const simple = new Date(year, 0, 1 + (weekNumber - 1) * 7);
  const dow = simple.getDay() || 7;
  const ISOweekStart = new Date(simple);
  if (dow <= 4) {
    ISOweekStart.setDate(simple.getDate() - dow + 1);
  } else {
    ISOweekStart.setDate(simple.getDate() + 8 - dow);
  }
  const start = new Date(ISOweekStart);
  const end = new Date(ISOweekStart);
  end.setDate(start.getDate() + 6);
  const format = date => date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
  return `du ${format(start)} au ${format(end)}`;
}

/**
 * Convertit une date YYYY-MM-DD et un index de jour (0-6) en un objet Date pour le lundi de la semaine.
 * @param {string} dateString - Date au format YYYY-MM-DD.
 * @param {number} dayIndex - Index du jour (0 pour Lundi, 6 pour Dimanche).
 * @returns {Date} L'objet Date pour le lundi de la semaine de la date donnée.
 */
function getMondayOfWeek(dateString, dayIndex) {
    const date = new Date(dateString + 'T00:00:00'); // 'T00:00:00' pour éviter les problèmes de fuseau horaire
    const day = date.getDay(); // 0 = dimanche, 1 = lundi, ...
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Ajuster au lundi
    return new Date(date.setDate(diff));
}

// Fonction pour afficher des messages modaux (copiée de synthese.js/agent.js)
function displayMessageModal(title, message, type = "info", callback = null) {
    let modal = document.getElementById('message-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'message-modal';
        modal.classList.add('custom-modal', 'message-modal');
        document.body.appendChild(modal);
    }
    modal.innerHTML = `
        <div class="modal-content ${type}">
            <h2 class="modal-title">${title}</h2>
            <p class="modal-message">${message}</p>
            <div class="modal-buttons">
                ${callback ? '<button id="modal-cancel-btn" class="btn btn-secondary">Annuler</button>' : ''}
                <button id="modal-ok-btn" class="btn btn-primary">OK</button>
            </div>
        </div>
    `;

    modal.style.display = 'flex';

    const okBtn = modal.querySelector('#modal-ok-btn');
    okBtn.onclick = () => {
        modal.style.display = 'none';
        if (callback) callback(true);
    };

    if (callback) {
        const cancelBtn = modal.querySelector('#modal-cancel-btn');
        cancelBtn.onclick = () => {
            modal.style.display = 'none';
            callback(false);
        };
    }

    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
            if (callback) callback(false);
        }
    };
}


// --- Fonctions de chargement des données de l'API ---

async function fetchPlannings() {
    showLoading(true);
    try {
        const token = sessionStorage.getItem('token');
        if (!token) {
            console.error('Pas de token trouvé. Redirection vers la connexion.');
            window.location.href = '/index.html';
            return;
        }

        const response = await fetch(`${API_BASE_URL}/api/planning`, { // La semaine est filtrée côté client pour l'instant
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            if (response.status === 403) {
                displayMessageModal('Accès Refusé', 'Vous n\'avez pas les droits pour voir cette page. Redirection vers la page de connexion.', 'error');
                setTimeout(() => {
                    sessionStorage.removeItem('token');
                    window.location.href = '/index.html';
                }, 3000);
            }
            throw new Error(`Erreur HTTP: ${response.status} - ${response.statusText}`);
        }
        planningData = await response.json();
        console.log('Données de planning globales chargées:', planningData);
        await loadAllUsersForAdmin(); // Recharger les infos des agents pour s'assurer d'avoir les noms et rôles à jour
        renderPlanningTable();
    } catch (error) {
        console.error('Erreur lors du chargement des plannings:', error);
        displayMessageModal('Erreur de Chargement', 'Impossible de charger les plannings. ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

async function loadAllUsersForAdmin() {
    try {
        const token = sessionStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/api/admin/users`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const users = await response.json();
        agentDisplayInfos = {};
        users.forEach(user => {
            agentDisplayInfos[user.id] = {
                nom: user.lastName,
                prenom: user.firstName,
                role: user.role,
                qualifications: user.qualifications || [],
                grades: user.grades || []
            };
        });
        renderAgentsTable(users); // Afficher la table de gestion des agents
        console.log('Infos agents chargées pour l\'affichage:', agentDisplayInfos);
    } catch (error) {
        console.error("Erreur lors du chargement des infos des agents:", error);
        listAgentsMessage.textContent = "Erreur lors du chargement des agents.";
    }
}

async function loadQualifications() {
    try {
        const token = sessionStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/api/users/qualifications`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        availableQualifications = await response.json();
        renderQualificationsTable();
        populateQualificationsCheckboxes(newAgentQualificationsCheckboxes);
    } catch (error) {
        console.error("Erreur lors du chargement des qualifications:", error);
        listQualificationsMessage.textContent = "Erreur lors du chargement des qualifications.";
    }
}

async function loadGrades() {
    try {
        const token = sessionStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/api/users/grades`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        availableGrades = await response.json();
        renderGradesTable();
        populateGradesCheckboxes(newAgentGradesCheckboxes);
    } catch (error) {
        console.error("Erreur lors du chargement des grades:", error);
        listGradesMessage.textContent = "Erreur lors du chargement des grades.";
    }
}


// --- Fonctions de rendu (affichage HTML) ---

function renderPlanningTable() {
    planningContainer.innerHTML = ''; // Nettoyer le conteneur existant
    const year = new Date().getFullYear();
    dateRangeDisplay.textContent = getWeekDateRange(currentWeek, year);

    // Entête du tableau avec les heures
    const headerRow = document.createElement('div');
    headerRow.classList.add('planning-grid-row', 'header-row');
    headerRow.innerHTML = '<div class="header-cell sticky-header">Agent</div>'; // Cellule pour le nom de l'agent
    horaires.forEach(h => {
        const hourCell = document.createElement('div');
        hourCell.classList.add('header-cell');
        hourCell.textContent = h.split(' ')[0]; // Affiche seulement l'heure de début
        headerRow.appendChild(hourCell);
    });
    planningContainer.appendChild(headerRow);

    const sortedAgentIds = Object.keys(agentDisplayInfos).sort((a, b) => {
        const nameA = agentDisplayInfos[a].nom + agentDisplayInfos[a].prenom;
        const nameB = agentDisplayInfos[b].nom + agentDisplayInfos[b].prenom;
        return nameA.localeCompare(nameB);
    });

    days.forEach((day, dayIndex) => {
        const dayLabelRow = document.createElement('div');
        dayLabelRow.classList.add('planning-grid-row', 'day-label-row');
        const dayLabelCell = document.createElement('div');
        dayLabelCell.classList.add('header-cell', 'sticky-header', 'day-label');
        dayLabelCell.textContent = day.charAt(0).toUpperCase() + day.slice(1);
        dayLabelRow.appendChild(dayLabelCell);
        // Ajouter des cellules vides pour aligner avec les heures si besoin
        for(let i=0; i < horaires.length; i++) {
            dayLabelRow.appendChild(document.createElement('div'));
        }
        planningContainer.appendChild(dayLabelRow);

        const currentMonday = getMondayOfWeek(formatDateToYYYYMMDD(new Date()), dayIndex); // Calculer le lundi de la semaine courante
        const dateKey = formatDateToYYYYMMDD(currentMonday.setDate(currentMonday.getDate() + dayIndex));

        sortedAgentIds.forEach(agentId => {
            const agentRow = document.createElement('div');
            agentRow.classList.add('planning-grid-row', 'agent-row');

            const agentCell = document.createElement('div');
            agentCell.classList.add('agent-name-cell', 'sticky-header');
            agentCell.textContent = `${agentDisplayInfos[agentId].prenom} ${agentDisplayInfos[agentId].nom}`;
            agentRow.appendChild(agentCell);

            const agentWeekPlanning = planningData[agentId] ? planningData[agentId][`week-${currentWeek}`] : {};
            const dayPlanning = agentWeekPlanning ? agentWeekPlanning[dateKey] : null;

            // Remplir les créneaux pour l'agent et le jour
            horaires.forEach((slot, slotIndex) => {
                const slotCell = document.createElement('div');
                slotCell.classList.add('slot-cell');

                let isAvailable = false;
                if (dayPlanning && dayPlanning.creneaux) {
                    const creneauStart = slot.split(' - ')[0]; // "HH:MM"
                    isAvailable = dayPlanning.creneaux.includes(creneauStart);
                }
                // Si pas dispo par créneau, vérifier par plage
                if (!isAvailable && dayPlanning && dayPlanning.plages) {
                    const currentSlotMinutes = convertTimeToMinutes(slot.split(' - ')[0]);
                    const nextSlotMinutes = convertTimeToMinutes(slot.split(' - ')[1]); // Fin du créneau actuel

                    for (const plage of dayPlanning.plages) {
                        const plageStartMinutes = convertTimeToMinutes(plage.debut);
                        const plageEndMinutes = convertTimeToMinutes(plage.fin);

                        // Vérifier si le créneau est inclus dans une plage
                        if (currentSlotMinutes >= plageStartMinutes && nextSlotMinutes <= plageEndMinutes) {
                            isAvailable = true;
                            break;
                        }
                    }
                }

                if (isAvailable) {
                    slotCell.classList.add('available');
                } else {
                    slotCell.classList.add('unavailable');
                }
                agentRow.appendChild(slotCell);
            });
            planningContainer.appendChild(agentRow);
        });
    });
}

// Fonction pour convertir HH:MM en minutes depuis minuit
function convertTimeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}


function renderAgentsTable(users) {
    agentsTableBody.innerHTML = '';
    if (users.length === 0) {
        listAgentsMessage.textContent = "Aucun agent enregistré.";
        return;
    }
    listAgentsMessage.textContent = "";

    users.forEach(user => {
        const row = agentsTableBody.insertRow();
        row.insertCell().textContent = user.id;
        row.insertCell().textContent = user.firstName;
        row.insertCell().textContent = user.lastName;
        row.insertCell().textContent = user.role;
        row.insertCell().textContent = user.qualifications.map(qId => {
            const qual = availableQualifications.find(aq => aq.id === qId);
            return qual ? qual.name : qId;
        }).join(', ');
        row.insertCell().textContent = user.grades.map(gId => {
            const grade = availableGrades.find(ag => ag.id === gId);
            return grade ? grade.name : gId;
        }).join(', ');

        const actionsCell = row.insertCell();
        const editButton = document.createElement('button');
        editButton.textContent = 'Modifier';
        editButton.classList.add('btn', 'btn-edit');
        editButton.onclick = () => openEditAgentModal(user.id);
        actionsCell.appendChild(editButton);

        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Supprimer';
        deleteButton.classList.add('btn', 'btn-delete');
        deleteButton.onclick = () => confirmDeleteAgent(user.id);
        actionsCell.appendChild(deleteButton);
    });
}


function populateQualificationsCheckboxes(containerElement, selectedQuals = []) {
    if (!containerElement) return; // S'assurer que l'élément existe
    containerElement.innerHTML = '';
    availableQualifications.forEach(qual => {
        const div = document.createElement('div');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `qual-${qual.id}-${containerElement.id}`;
        checkbox.name = 'qualifications';
        checkbox.value = qual.id;
        checkbox.checked = selectedQuals.includes(qual.id);
        const label = document.createElement('label');
        label.htmlFor = `qual-${qual.id}-${containerElement.id}`;
        label.textContent = qual.name;
        div.appendChild(checkbox);
        div.appendChild(label);
        containerElement.appendChild(div);
    });
}

function populateGradesCheckboxes(containerElement, selectedGrades = []) {
    if (!containerElement) return; // S'assurer que l'élément existe
    containerElement.innerHTML = '';
    availableGrades.forEach(grade => {
        const div = document.createElement('div');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `grade-${grade.id}-${containerElement.id}`;
        checkbox.name = 'grades';
        checkbox.value = grade.id;
        checkbox.checked = selectedGrades.includes(grade.id);
        const label = document.createElement('label');
        label.htmlFor = `grade-${grade.id}-${containerElement.id}`;
        label.textContent = grade.name;
        div.appendChild(checkbox);
        div.appendChild(label);
        containerElement.appendChild(div);
    });
}


function renderQualificationsTable() {
    qualificationsTableBody.innerHTML = '';
    if (availableQualifications.length === 0) {
        listQualificationsMessage.textContent = "Aucune qualification enregistrée.";
        return;
    }
    listQualificationsMessage.textContent = "";

    availableQualifications.forEach(qual => {
        const row = qualificationsTableBody.insertRow();
        row.insertCell().textContent = qual.id;
        row.insertCell().textContent = qual.name;
        const actionsCell = row.insertCell();
        const editButton = document.createElement('button');
        editButton.textContent = 'Modifier';
        editButton.classList.add('btn', 'btn-edit');
        editButton.onclick = () => openEditQualificationModal(qual.id);
        actionsCell.appendChild(editButton);

        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Supprimer';
        deleteButton.classList.add('btn', 'btn-delete');
        deleteButton.onclick = () => confirmDeleteQualification(qual.id);
        actionsCell.appendChild(deleteButton);
    });
}

function renderGradesTable() {
    gradesTableBody.innerHTML = '';
    if (availableGrades.length === 0) {
        listGradesMessage.textContent = "Aucun grade enregistré.";
        return;
    }
    listGradesMessage.textContent = "";

    availableGrades.forEach(grade => {
        const row = gradesTableBody.insertRow();
        row.insertCell().textContent = grade.id;
        row.insertCell().textContent = grade.name;
        const actionsCell = row.insertCell();
        const editButton = document.createElement('button');
        editButton.textContent = 'Modifier';
        editButton.classList.add('btn', 'btn-edit');
        editButton.onclick = () => openEditGradeModal(grade.id);
        actionsCell.appendChild(editButton);

        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Supprimer';
        deleteButton.classList.add('btn', 'btn-delete');
        deleteButton.onclick = () => confirmDeleteGrade(grade.id);
        actionsCell.appendChild(deleteButton);
    });
}

// --- Fonctions de gestion (ajout, modification, suppression) ---

async function handleAddAgent(event) {
    event.preventDefault();
    const id = addAgentForm.newAgentId.value.trim();
    const firstName = addAgentForm.newAgentPrenom.value.trim();
    const lastName = addAgentForm.newAgentNom.value.trim();
    const password = addAgentForm.newAgentPassword.value.trim();
    const role = addAgentForm.newAgentRole.value;
    const qualifications = Array.from(newAgentQualificationsCheckboxes.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
    const grades = Array.from(newAgentGradesCheckboxes.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);

    addAgentMessage.textContent = '';
    if (!id || !firstName || !lastName || !password) {
        addAgentMessage.textContent = 'Tous les champs sont requis.';
        addAgentMessage.style.color = 'red';
        return;
    }

    try {
        const token = sessionStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/api/admin/users`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ id, firstName, lastName, password, role, qualifications, grades })
        });

        const data = await response.json();
        if (response.ok) {
            addAgentMessage.textContent = 'Agent ajouté avec succès.';
            addAgentMessage.style.color = 'green';
            addAgentForm.reset();
            loadAllUsersForAdmin(); // Recharger la liste des agents
        } else {
            addAgentMessage.textContent = `Erreur: ${data.message || 'Échec de l\'ajout de l\'agent.'}`;
            addAgentMessage.style.color = 'red';
        }
    } catch (error) {
        console.error('Erreur réseau ou serveur:', error);
        addAgentMessage.textContent = 'Erreur réseau ou serveur. Veuillez réessayer.';
        addAgentMessage.style.color = 'red';
    }
}

function openEditAgentModal(agentId) {
    const userToEdit = agentDisplayInfos[agentId];
    if (!userToEdit) {
        displayMessageModal('Erreur', 'Agent non trouvé pour modification.', 'error');
        return;
    }

    editAgentId.value = userToEdit.id;
    editAgentId.disabled = true; // Empêcher la modification de l'ID
    editAgentNom.value = userToEdit.nom;
    editAgentPrenom.value = userToEdit.prenom;
    editAgentNewPassword.value = ''; // Toujours vider le champ mot de passe
    editAgentFormElement.editAgentRole.value = userToEdit.role;

    populateQualificationsCheckboxes(qualificationsCheckboxesDiv, userToEdit.qualifications);
    populateGradesCheckboxes(gradesCheckboxesDiv, userToEdit.grades);

    editAgentMessage.textContent = '';
    editAgentModalElement.style.display = 'block';
}

async function handleEditAgent(event) {
    event.preventDefault();
    const id = editAgentId.value.trim();
    const firstName = editAgentPrenom.value.trim();
    const lastName = editAgentNom.value.trim();
    const password = editAgentNewPassword.value.trim();
    const role = editAgentFormElement.editAgentRole.value;
    const qualifications = Array.from(qualificationsCheckboxesDiv.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
    const grades = Array.from(gradesCheckboxesDiv.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);


    editAgentMessage.textContent = '';
    if (!firstName || !lastName) {
        editAgentMessage.textContent = 'Le prénom et le nom sont requis.';
        editAgentMessage.style.color = 'red';
        return;
    }

    try {
        const token = sessionStorage.getItem('token');
        const updateData = { firstName, lastName, role, qualifications, grades };
        if (password) {
            updateData.password = password;
        }

        const response = await fetch(`${API_BASE_URL}/api/admin/users/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(updateData)
        });

        const data = await response.json();
        if (response.ok) {
            editAgentMessage.textContent = 'Agent mis à jour avec succès.';
            editAgentMessage.style.color = 'green';
            editAgentModalElement.style.display = 'none';
            loadAllUsersForAdmin(); // Recharger la liste des agents
        } else {
            editAgentMessage.textContent = `Erreur: ${data.message || 'Échec de la mise à jour de l\'agent.'}`;
            editAgentMessage.style.color = 'red';
        }
    } catch (error) {
        console.error('Erreur réseau ou serveur:', error);
        editAgentMessage.textContent = 'Erreur réseau ou serveur. Veuillez réessayer.';
        editAgentMessage.style.color = 'red';
    }
}

async function confirmDeleteAgent(agentId) {
    displayMessageModal('Confirmer la suppression', `Êtes-vous sûr de vouloir supprimer l'agent ${agentId} ? Cela supprimera aussi son planning.`, 'question', async (result) => {
        if (result) {
            try {
                const token = sessionStorage.getItem('token');
                const response = await fetch(`${API_BASE_URL}/api/admin/users/${agentId}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                const data = await response.json();
                if (response.ok) {
                    displayMessageModal('Succès', 'Agent supprimé avec succès.', 'success');
                    loadAllUsersForAdmin();
                    fetchPlannings(); // Recharger les plannings car un agent a été supprimé
                } else {
                    displayMessageModal('Erreur', `Échec de la suppression: ${data.message || 'Erreur inconnue.'}`, 'error');
                }
            } catch (error) {
                console.error('Erreur réseau ou serveur:', error);
                displayMessageModal('Erreur', 'Erreur réseau ou serveur lors de la suppression.', 'error');
            }
        }
    });
}

async function handleAddQualification(event) {
    event.preventDefault();
    const id = addQualificationFormElement.newQualId.value.trim();
    const name = addQualificationFormElement.newQualName.value.trim();

    addQualificationMessage.textContent = '';
    if (!id || !name) {
        addQualificationMessage.textContent = 'ID et nom sont requis.';
        addQualificationMessage.style.color = 'red';
        return;
    }

    try {
        const token = sessionStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/api/admin/qualifications`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ id, name })
        });

        const data = await response.json();
        if (response.ok) {
            addQualificationMessage.textContent = 'Qualification ajoutée avec succès.';
            addQualificationMessage.style.color = 'green';
            addQualificationFormElement.reset();
            loadQualifications(); // Recharger la liste des qualifications
            loadAllUsersForAdmin(); // Pour rafraîchir les checkboxes dans la gestion des agents
        } else {
            addQualificationMessage.textContent = `Erreur: ${data.message || 'Échec de l\'ajout de la qualification.'}`;
            addQualificationMessage.style.color = 'red';
        }
    } catch (error) {
        console.error('Erreur réseau ou serveur:', error);
        addQualificationMessage.textContent = 'Erreur réseau ou serveur. Veuillez réessayer.';
        addQualificationMessage.style.color = 'red';
    }
}

function openEditQualificationModal(qualId) {
    const qualToEdit = availableQualifications.find(q => q.id === qualId);
    if (!qualToEdit) {
        displayMessageModal('Erreur', 'Qualification non trouvée pour modification.', 'error');
        return;
    }
    editQualId.value = qualToEdit.id;
    editQualId.disabled = true; // Empêcher la modification de l'ID
    editQualName.value = qualToEdit.name;
    editQualMessage.textContent = '';
    editQualificationModalElement.style.display = 'block';
}

async function handleEditQualification(event) {
    event.preventDefault();
    const id = editQualId.value.trim(); // L'ID n'est pas modifiable, on le récupère pour la requête
    const name = editQualName.value.trim();

    editQualMessage.textContent = '';
    if (!name) {
        editQualMessage.textContent = 'Le nom de la qualification est requis.';
        editQualMessage.style.color = 'red';
        return;
    }

    try {
        const token = sessionStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/api/admin/qualifications/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name })
        });

        const data = await response.json();
        if (response.ok) {
            editQualMessage.textContent = 'Qualification mise à jour avec succès.';
            editQualMessage.style.color = 'green';
            editQualificationModalElement.style.display = 'none';
            loadQualifications(); // Recharger la liste
            loadAllUsersForAdmin(); // Pour rafraîchir les noms dans la gestion des agents
        } else {
            editQualMessage.textContent = `Erreur: ${data.message || 'Échec de la mise à jour de la qualification.'}`;
            editQualMessage.style.color = 'red';
        }
    } catch (error) {
        console.error('Erreur réseau ou serveur:', error);
        editQualMessage.textContent = 'Erreur réseau ou serveur. Veuillez réessayer.';
        editQualMessage.style.color = 'red';
    }
}

async function confirmDeleteQualification(qualId) {
    displayMessageModal('Confirmer la suppression', `Êtes-vous sûr de vouloir supprimer la qualification "${qualId}" ? Elle sera retirée des agents qui la possèdent.`, 'question', async (result) => {
        if (result) {
            try {
                const token = sessionStorage.getItem('token');
                const response = await fetch(`${API_BASE_URL}/api/admin/qualifications/${qualId}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                const data = await response.json();
                if (response.ok) {
                    displayMessageModal('Succès', 'Qualification supprimée avec succès.', 'success');
                    loadQualifications(); // Recharger la liste
                    loadAllUsersForAdmin(); // Recharger les agents pour mettre à jour leurs qualifications
                } else {
                    displayMessageModal('Erreur', `Échec de la suppression: ${data.message || 'Erreur inconnue.'}`, 'error');
                }
            } catch (error) {
                console.error('Erreur réseau ou serveur:', error);
                displayMessageModal('Erreur', 'Erreur réseau ou serveur lors de la suppression.', 'error');
            }
        }
    });
}

async function handleAddGrade(event) {
    event.preventDefault();
    const id = addGradeFormElement.newGradeId.value.trim();
    const name = addGradeFormElement.newGradeName.value.trim();

    addGradeMessage.textContent = '';
    if (!id || !name) {
        addGradeMessage.textContent = 'ID et nom sont requis.';
        addGradeMessage.style.color = 'red';
        return;
    }

    try {
        const token = sessionStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/api/admin/grades`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ id, name })
        });

        const data = await response.json();
        if (response.ok) {
            addGradeMessage.textContent = 'Grade ajouté avec succès.';
            addGradeMessage.style.color = 'green';
            addGradeFormElement.reset();
            loadGrades(); // Recharger la liste des grades
            loadAllUsersForAdmin(); // Pour rafraîchir les checkboxes dans la gestion des agents
        } else {
            addGradeMessage.textContent = `Erreur: ${data.message || 'Échec de l\'ajout du grade.'}`;
            addGradeMessage.style.color = 'red';
        }
    } catch (error) {
        console.error('Erreur réseau ou serveur:', error);
        addGradeMessage.textContent = 'Erreur réseau ou serveur. Veuillez réessayer.';
        addGradeMessage.style.color = 'red';
    }
}

function openEditGradeModal(gradeId) {
    const gradeToEdit = availableGrades.find(g => g.id === gradeId);
    if (!gradeToEdit) {
        displayMessageModal('Erreur', 'Grade non trouvé pour modification.', 'error');
        return;
    }
    editGradeId.value = gradeToEdit.id;
    editGradeId.disabled = true; // Empêcher la modification de l'ID
    editGradeName.value = gradeToEdit.name;
    editGradeMessage.textContent = '';
    editGradeModalElement.style.display = 'block';
}

async function handleEditGrade(event) {
    event.preventDefault();
    const id = editGradeId.value.trim(); // L'ID n'est pas modifiable, on le récupère pour la requête
    const name = editGradeName.value.trim();

    editGradeMessage.textContent = '';
    if (!name) {
        editGradeMessage.textContent = 'Le nom du grade est requis.';
        editGradeMessage.style.color = 'red';
        return;
    }

    try {
        const token = sessionStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/api/admin/grades/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name })
        });

        const data = await response.json();
        if (response.ok) {
            editGradeMessage.textContent = 'Grade mis à jour avec succès.';
            editGradeMessage.style.color = 'green';
            editGradeModalElement.style.display = 'none';
            loadGrades(); // Recharger la liste
            loadAllUsersForAdmin(); // Pour rafraîchir les noms dans la gestion des agents
        } else {
            editGradeMessage.textContent = `Erreur: ${data.message || 'Échec de la mise à jour du grade.'}`;
            editGradeMessage.style.color = 'red';
        }
    } catch (error) {
        console.error('Erreur réseau ou serveur:', error);
        editGradeMessage.textContent = 'Erreur réseau ou serveur. Veuillez réessayer.';
        editGradeMessage.style.color = 'red';
    }
}

async function confirmDeleteGrade(gradeId) {
    displayMessageModal('Confirmer la suppression', `Êtes-vous sûr de vouloir supprimer le grade "${gradeId}" ? Il sera retiré des agents qui le possèdent.`, 'question', async (result) => {
        if (result) {
            try {
                const token = sessionStorage.getItem('token');
                const response = await fetch(`${API_BASE_URL}/api/admin/grades/${gradeId}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                const data = await response.json();
                if (response.ok) {
                    displayMessageModal('Succès', 'Grade supprimé avec succès.', 'success');
                    loadGrades(); // Recharger la liste
                    loadAllUsersForAdmin(); // Recharger les agents pour mettre à jour leurs grades
                } else {
                    displayMessageModal('Erreur', `Échec de la suppression: ${data.message || 'Erreur inconnue.'}`, 'error');
                }
            } catch (error) {
                console.error('Erreur réseau ou serveur:', error);
                displayMessageModal('Erreur', 'Erreur réseau ou serveur lors de la suppression.', 'error');
            }
        }
    });
}


// --- Fonctions utilitaires ---

function showLoading(isLoading) {
    if (isLoading) {
        loadingSpinner.classList.remove("hidden");
    } else {
        loadingSpinner.classList.add("hidden");
    }
}

function logout() {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('userRole');
    window.location.href = '/index.html';
}


// --- Initialisation et écouteurs d'événements ---

document.addEventListener('DOMContentLoaded', async () => {
    // Vérifier si l'utilisateur est un admin
    const userRole = sessionStorage.getItem('userRole');
    if (userRole !== 'admin') {
        displayMessageModal('Accès Non Autorisé', 'Vous n\'êtes pas autorisé à accéder à cette page.', 'error');
        setTimeout(() => {
            window.location.href = '/index.html'; // Rediriger vers la page de connexion
        }, 3000);
        return;
    }

    // Initialiser la semaine actuelle à la semaine ISO en cours
    currentWeek = getCurrentISOWeek();

    // Remplir le sélecteur de semaine (exemple pour les 52 dernières et prochaines semaines)
    const currentYear = new Date().getFullYear();
    for (let i = currentWeek - 20; i <= currentWeek + 20; i++) { // Afficher +/- 20 semaines
        // Gérer le passage d'année si nécessaire (simplifié ici)
        let week = i;
        let year = currentYear;
        if (week <= 0) {
            week += 52; // Approximation, gérer années précédentes
            year--;
        } else if (week > 52) {
            week -= 52; // Approximation, gérer années suivantes
            year++;
        }
        const option = document.createElement('option');
        option.value = week;
        option.textContent = `Semaine ${week} (${getWeekDateRange(week, year)})`;
        if (week === currentWeek) {
            option.selected = true;
        }
        weekSelect.appendChild(option);
    }

    // Écouteurs d'événements pour la navigation par onglets (principale)
    mainTabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.dataset.tab;
            openMainTab(tabId);
        });
    });

    // Écouteurs d'événements pour les boutons de jour (Planning Global)
    tabButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            currentDay = e.target.dataset.day;
            // Retirer la classe 'active' de tous les boutons et l'ajouter au bouton cliqué
            tabButtons.forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            renderPlanningTable(); // Mettre à jour l'affichage du planning pour le jour sélectionné
        });
    });

    // Écouteur pour le changement de semaine
    if (weekSelect) {
        weekSelect.addEventListener('change', (e) => {
            currentWeek = parseInt(e.target.value);
            fetchPlannings(); // Recharger les plannings pour la nouvelle semaine
        });
    } else {
        console.warn("L'élément weekSelect est introuvable.");
    }


    // Fonctions d'initialisation des données
    await fetchPlannings(); // Charge les plannings
    await loadQualifications(); // Charge les qualifications disponibles
    await loadGrades(); // Charge les grades disponibles


    // --- Écouteurs d'événements pour la vue "Gestion des Agents" ---
    if (addAgentForm) {
        addAgentForm.addEventListener('submit', handleAddAgent);
    } else {
        console.warn("Le formulaire d'ajout d'agent est introuvable dans admin.html.");
    }

    if (agentsTableBody) {
        // La gestion des clics pour modifier/supprimer est dans renderAgentsTable via onclick
    } else {
        console.warn("Le corps de la table des agents est introuvable dans admin.html.");
    }

    if (closeEditAgentModalButton) {
        closeEditAgentModalButton.addEventListener('click', () => {
            editAgentModalElement.style.display = 'none';
        });
    }

    if (editAgentFormElement) {
        editAgentFormElement.addEventListener('submit', handleEditAgent);
    } else {
        console.warn("Le formulaire d'édition d'agent est introuvable dans admin.html.");
    }

    // --- Écouteurs d'événements pour la vue "Gestion des Qualifications" ---
    if (addQualificationFormElement) {
        addQualificationFormElement.addEventListener('submit', handleAddQualification);
    } else {
        console.warn("Le formulaire d'ajout de qualification est introuvable dans admin.html.");
    }

    if (qualificationsTableBody) {
        // Les écouteurs pour modifier/supprimer sont attachés directement dans renderQualificationsTable
    } else {
        console.warn("Le corps de la table des qualifications est introuvable dans admin.html.");
    }

    if (editQualificationModalElement && closeQualButton) {
        closeQualButton.addEventListener('click', () => {
            editQualificationModalElement.style.display = 'none';
        });
    } else {
        console.warn("La modale d'édition de qualification ou son bouton de fermeture est introuvable dans admin.html.");
    }

    if (editQualificationFormElement) {
        editQualificationFormElement.addEventListener('submit', handleEditQualification);
    } else {
        console.warn("Le formulaire d'édition de qualification est introuvable dans admin.html.");
    }

    // --- Écouteurs d'événements pour la vue "Gestion des Grades" ---
    if (addGradeFormElement) {
        addGradeFormElement.addEventListener('submit', handleAddGrade);
    } else {
        console.warn("Le formulaire d'ajout de grade est introuvable dans admin.html.");
    }

    if (gradesTableBody) {
        gradesTableBody.addEventListener('click', handleGradeActions); // Garder cet écouteur si il y a des actions plus complexes que juste le click sur bouton
    } else {
        console.warn("Le corps de la table des grades est introuvable dans admin.html.");
    }

    if (editGradeModalElement && closeGradeButton) {
        closeGradeButton.addEventListener('click', () => {
            editGradeModalElement.style.display = 'none';
        });
    } else {
        console.warn("La modale d'édition de grade ou son bouton de fermeture est introuvable dans admin.html.");
    }

    if (editGradeFormElement) {
        editGradeFormElement.addEventListener('submit', handleEditGrade);
    } else {
        console.warn("Le formulaire d'édition de grade est introuvable dans admin.html.");
    }

    // --- Écouteur pour la déconnexion ---
    if (logoutButton) {
        logoutButton.addEventListener("click", logout);
    } else {
        console.warn("Le bouton de déconnexion est introuvable dans admin.html.");
    }
});


// Fonction pour gérer l'ouverture des onglets principaux (Agent, Planning Global, Gestion Utilisateurs etc.)
function openMainTab(tabId) {
    mainTabContents.forEach(content => {
        content.classList.remove('active');
        if (content.id === tabId) {
            content.classList.add('active');
        }
    });

    mainTabButtons.forEach(button => {
        button.classList.remove('active');
        if (button.dataset.tab === tabId) {
            button.classList.add('active');
        }
    });

    // Masquer ou afficher les contrôles de planning en fonction de l'onglet actif
    if (tabId === 'global-planning-tab') {
        headerPlanningControls.classList.remove('hidden');
        fetchPlannings(); // Recharger les plannings quand on revient sur cet onglet
    } else {
        headerPlanningControls.classList.add('hidden');
    }

    // Charger les données spécifiques à l'onglet si nécessaire
    if (tabId === 'manage-agents-tab') {
        loadAllUsersForAdmin(); // Recharger la liste des agents
        loadQualifications(); // Recharger les qualifications pour les checkboxes
        loadGrades(); // Recharger les grades pour les checkboxes
    } else if (tabId === 'manage-qualifications-tab') {
        loadQualifications(); // Recharger les qualifications
    } else if (tabId === 'manage-grades-tab') {
        loadGrades(); // Recharger les grades
    }
}

// Fonction de gestionnaire d'événements pour les actions de grade (pourrait être utilisée si la logique est plus complexe que juste un onclick)
function handleGradeActions(event) {
    // Exemple : Si tu avais des boutons dynamiques ajoutés après le chargement initial
    // const target = event.target;
    // if (target.classList.contains('btn-edit')) {
    //     openEditGradeModal(target.dataset.id);
    // } else if (target.classList.contains('btn-delete')) {
    //     confirmDeleteGrade(target.dataset.id);
    // }
}