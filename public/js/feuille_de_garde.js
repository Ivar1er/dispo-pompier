// feuille_de_garde.js

// Styles injectés dynamiquement pour la mise à jour visuelle
const inlineCss = `
.engine-indispo-overlay, .engine-indispo-overlay-mini {
    background-color: rgba(0, 0, 0, 0.5); /* Adoucir le voile noir pour voir le fond (de 0.6 à 0.5) */
    display: flex; /* Centrer le texte INDISPO */
    align-items: center;
    justify-content: center;
    font-size: 1.2em; /* Taille du texte INDISPO */
    color: white; /* Couleur du texte INDISPO */
    text-shadow: 1px 1px 2px rgba(0,0,0,0.8); /* Ombre pour la lisibilité */
    font-weight: bold;
}

.availability-highlight-segment {
    position: absolute;
    display: flex; /* Utiliser flexbox pour centrer le texte */
    align-items: center;
    justify-content: center;
    overflow: hidden; /* Cacher le texte qui dépasse */
}

.availability-segment-text {
    color: white; /* Couleur du texte sur les segments de disponibilité */
    font-size: 0.7em; /* Taille de la police adaptée (de 0.6em à 0.7em) */
    white-space: nowrap; /* Empêcher le retour à la ligne du texte */
    text-overflow: ellipsis; /* Ajouter des points de suspension si le texte est trop long */
    padding: 0 4px; /* Plus de padding horizontal */
    line-height: 1; /* Resserre la hauteur du texte */
    pointer-events: none; /* Permet aux événements de souris de passer à l'élément parent (pour le tooltip) */
    box-sizing: border-box; /* Inclure padding dans la largeur/hauteur */
}

/* Styles pour le tooltip de disponibilité */
.availability-bar-tooltip {
    position: absolute;
    background-color: rgba(0, 0, 0, 0.85);
    color: white;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 0.8em;
    white-space: nowrap;
    z-index: 50; /* Au-dessus des autres éléments */
    bottom: 100%; /* Positionne le tooltip au-dessus de la barre */
    left: 50%;
    transform: translateX(-50%);
    margin-bottom: 5px; /* Petit espace entre la barre et le tooltip */
    pointer-events: none; /* Le tooltip ne doit pas bloquer les événements de souris sur la barre */
}

.availability-bar-tooltip ul {
    list-style: none;
    margin: 0;
    padding: 0;
}

.availability-bar-tooltip li {
    margin-bottom: 2px;
    font-size: 0.9em;
}

.availability-bar-tooltip li:last-child {
    margin-bottom: 0;
}
`;

// --------------------------------------------------
// 1️⃣ Constantes & Helpers
// --------------------------------------------------

// URL de l’API
const API_BASE_URL = "https://dispo-pompier.onrender.com";

let currentWeek; // Semaine ISO actuelle

// Références DOM
const weekSelect = document.getElementById('week-select');
const dateRangeDisplay = document.getElementById('date-range');
const rosterGridContainer = document.getElementById('roster-grid-container');
const loadingSpinner = document.getElementById("loading-spinner");
const noRosterMessage = document.getElementById("no-roster-message");


// Créneaux de 07:00→07:00 sur 24h (30 min)
const horaires = [];
const startHourDisplay = 7;
for (let i = 0; i < 48; i++) {
  const h1 = (startHourDisplay + Math.floor(i/2)) % 24;
  const m1 = (i % 2) * 30;
  const h2 = (startHourDisplay + Math.floor((i+1)/2)) % 24;
  const m2 = ((i+1) % 2) * 30;
  horaires.push(
    `${String(h1).padStart(2,'0')}:${String(m1).padStart(2,'0')} - ` +
    `${String(h2).padStart(2,'0')}:${String(m2).padStart(2,'0')}`
  );
}

// Mappage des rôles d'engin vers les qualifications réelles des agents
const roleToQualificationMap = {
    // VSAV
    'ca_vsav': ['ca_vsav'],
    'cod_0': ['cod_0', 'cod_vtu', 'cod_vpma'], // Un chef peut couvrir plusieurs engins légers
    'eq_vsav': ['eq_vsav'],
    // FPT
    'ca_fpt': ['ca_fpt'],
    'cod_1': ['cod_1'],
    'eq1_fpt': ['eq1_fpt'],
    'eq2_fpt': ['eq2_fpt'],
    // CCF
    'ca_ccf': ['ca_ccf'],
    'cod_2': ['cod_2'],
    'eq1_ccf': ['eq1_ccf'],
    'eq2_ccf': ['eq2_ccf'],
    // VTU
    'ca_vtu': ['ca_vtu'],
    'eq_vtu': ['eq_vtu'],
    // VPMA
    'ca_vpma': ['ca_vpma'],
    'eq_vpma': ['eq_vpma']
};

// Nouvelle structure pour définir les détails de chaque engin, ses rôles et ses rôles critiques.
const engineDetails = {
    'VSAV': {
        name: "VSAV",
        roles: [
            { id: 'ca_vsav', name: 'CA VSAV', required: true },
            { id: 'cod_0', name: 'CD VSAV', required: true },
            { id: 'eq_vsav', name: 'EQ VSAV', required: true },
        ],
        criticalRoles: ['cod_0', 'ca_vsav']
    },
    'FPT': {
        name: "FPT",
        roles: [
            { id: 'ca_fpt', name: 'CA FPT', required: true },
            { id: 'cod_1', name: 'CD FPT', required: true },
            { id: 'eq1_fpt', name: 'EQ1 FPT', required: true },
            { id: 'eq2_fpt', name: 'EQ2 FPT', required: false }
        ],
        criticalRoles: ['cod_1', 'ca_fpt']
    },
    'CCF': {
        name: "CCF",
        roles: [
            { id: 'ca_ccf', name: 'CA CCF', required: true },
            { id: 'cod_2', name: 'CD CCF', required: true },
            { id: 'eq1_ccf', name: 'EQ1 CCF', required: true },
            { id: 'eq2_ccf', name: 'EQ2 CCF', required: false }
        ],
        criticalRoles: ['cod_2', 'ca_ccf']
    },
    'VTU': {
        name: "VTU",
        roles: [
            { id: 'ca_vtu', name: 'CA VTU', required: true },
            { id: 'cod_0', name: 'CD VTU', required: true },
            { id: 'eq_vtu', name: 'EQ VTU', required: false }
        ],
        criticalRoles: ['cod_0', 'ca_vtu']
    },
    'VPMA': {
        name: "VPMA",
        roles: [
            { id: 'ca_vpma', name: 'CA VPMA', required: true },
            { id: 'cod_0', name: 'CD VPMA', required: true },
            { id: 'eq_vpma', name: 'EQ VPMA', required: false }
        ],
        criticalRoles: ['cod_0', 'ca_vpma']
    }
};

const daysOfWeekNames = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];


// --- Fonctions de modales (copiées de agent.js/synthese.js pour une cohérence des messages utilisateur) ---
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


// --- Fonctions de date (copiées pour être autonomes) ---
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

function formatDateToYYYYMMDD(d) {
    const dt = new Date(d);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}` + `-${String(dt.getDate()).padStart(2, '0')}`;
}

function convertTimeToMinutes(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') {
        console.warn('Invalid time string for conversion:', timeStr);
        return 0;
    }
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}

function minutesToTime(totalMinutes) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

// --------------------------------------------------
// 2️⃣ Fonctions de chargement des données (feuille de garde)
// --------------------------------------------------

async function loadRosterData() {
    showLoading(true);
    rosterGridContainer.innerHTML = '';
    noRosterMessage.classList.add('hidden');

    try {
        const token = sessionStorage.getItem('token');
        if (!token) {
            console.error('Pas de token trouvé. Redirection vers la connexion.');
            window.location.href = '/index.html';
            return;
        }

        // Récupérer les plannings de tous les agents
        const planningResponse = await fetch(`${API_BASE_URL}/api/planning`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!planningResponse.ok) {
            throw new Error(`Erreur HTTP planning: ${planningResponse.status}`);
        }
        const allPlannings = await planningResponse.json();

        // Récupérer les infos de tous les utilisateurs (nom, qualif)
        const usersInfoResponse = await fetch(`${API_BASE_URL}/api/users/names`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!usersInfoResponse.ok) {
            throw new Error(`Erreur HTTP users info: ${usersInfoResponse.status}`);
        }
        const allUsersInfo = await usersInfoResponse.json();

        // Récupérer toutes les qualifications disponibles (pour un mapping nom-id si besoin)
        const qualificationsResponse = await fetch(`${API_BASE_URL}/api/users/qualifications`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!qualificationsResponse.ok) {
            throw new Error(`Erreur HTTP qualifications: ${qualificationsResponse.status}`);
        }
        const allQualifications = await qualificationsResponse.json();


        renderGlobalPlanning(allPlannings, allUsersInfo, allQualifications);

    } catch (error) {
        console.error('Erreur lors du chargement des données de la feuille de garde:', error);
        displayMessageModal('Erreur de Chargement', 'Impossible de charger la feuille de garde. ' + error.message, 'error');
        noRosterMessage.classList.remove('hidden'); // Afficher le message d'erreur si échec
        noRosterMessage.textContent = 'Impossible de charger la feuille de garde. Veuillez réessayer ou vérifier les logs.';
    } finally {
        showLoading(false);
    }
}


// --------------------------------------------------
// 3️⃣ Fonction de rendu principal (Feuille de Garde)
// --------------------------------------------------

function renderGlobalPlanning(allPlannings, allUsersInfo, allQualifications) {
    rosterGridContainer.innerHTML = ''; // Nettoyer le conteneur

    const year = new Date().getFullYear();
    dateRangeDisplay.textContent = getWeekDateRange(currentWeek, year);

    // Filter agents to display only those with 'agent' or 'admin' role
    const agents = allUsersInfo.filter(user => user.role === 'agent' || user.role === 'admin');

    if (agents.length === 0) {
        noRosterMessage.classList.remove('hidden');
        noRosterMessage.textContent = 'Aucun agent disponible pour afficher la feuille de garde.';
        return;
    }
    noRosterMessage.classList.add('hidden'); // Hide if agents are found

    // Créer l'en-tête de la grille avec les heures
    const headerRow = document.createElement('div');
    headerRow.classList.add('roster-grid-header');
    headerRow.innerHTML = '<div class="header-cell sticky-header">Engin / Rôle</div>';
    horaires.forEach(h => {
        const hourCell = document.createElement('div');
        hourCell.classList.add('header-cell');
        hourCell.textContent = h.split(' - ')[0]; // Afficher seulement l'heure de début
        headerRow.appendChild(hourCell);
    });
    rosterGridContainer.appendChild(headerRow);


    // Pour chaque jour de la semaine
    daysOfWeekNames.forEach((dayName, dayIndex) => {
        const currentMonday = new Date(); // Utilisez la date actuelle comme base
        const dateKey = formatDateToYYYYMMDD(new Date(currentMonday.setDate(currentMonday.getDate() - currentMonday.getDay() + (dayIndex + 1)))); // Lundi = 1, Dimanche = 0 ou 7. Ajuster pour le lundi de la semaine ISO.
        // Recalculer le lundi de la semaine ISO courante
        const baseDateForWeek = new Date(); // Date actuelle
        baseDateForWeek.setHours(0,0,0,0);
        baseDateForWeek.setDate(baseDateForWeek.getDate() + 3 - (baseDateForWeek.getDay() + 6) % 7); // Set to Thursday of current week
        const mondayOfISOWeek = new Date(baseDateForWeek.getFullYear(), 0, 4); // Jan 4th of current year
        mondayOfISOWeek.setDate(mondayOfISOWeek.getDate() - (mondayOfISOWeek.getDay() + 6) % 7); // Set to first monday of the year
        const currentYear = new Date().getFullYear();
        let mondayOfTargetWeek = new Date(currentYear, 0, 1 + (currentWeek - 1) * 7); // Get Jan 1 + (week-1)*7
        mondayOfTargetWeek.setDate(mondayOfTargetWeek.getDate() - (mondayOfTargetWeek.getDay() === 0 ? 6 : mondayOfTargetWeek.getDay() - 1)); // Adjust to monday
        
        const targetDate = new Date(mondayOfTargetWeek);
        targetDate.setDate(mondayOfTargetWeek.getDate() + dayIndex);
        const actualDateKey = formatDateToYYYYMMDD(targetDate);


        // Afficher le label du jour
        const dayLabelRow = document.createElement('div');
        dayLabelRow.classList.add('roster-grid-row', 'day-label-row');
        const dayLabelCell = document.createElement('div');
        dayLabelCell.classList.add('header-cell', 'day-label', 'sticky-header');
        dayLabelCell.textContent = `${dayName.charAt(0).toUpperCase() + dayName.slice(1)} ${targetDate.getDate().toString().padStart(2, '0')}/${(targetDate.getMonth() + 1).toString().padStart(2, '0')}`;
        dayLabelRow.appendChild(dayLabelCell);
        // Ajouter des cellules vides pour aligner avec les heures
        for(let i=0; i < horaires.length; i++) {
            dayLabelRow.appendChild(document.createElement('div'));
        }
        rosterGridContainer.appendChild(dayLabelRow);


        // Pour chaque engin
        for (const engineType in engineDetails) {
            const engine = engineDetails[engineType];

            // Pour chaque rôle de l'engin
            engine.roles.forEach(role => {
                const roleRow = document.createElement('div');
                roleRow.classList.add('roster-grid-row', 'engine-role-row');

                const roleNameCell = document.createElement('div');
                roleNameCell.classList.add('role-name-cell', 'sticky-header');
                roleNameCell.textContent = role.name;
                roleRow.appendChild(roleNameCell);

                // Pour chaque créneau horaire
                horaires.forEach((slot, slotIndex) => {
                    const slotCell = document.createElement('div');
                    slotCell.classList.add('roster-slot-cell');
                    slotCell.dataset.slotIndex = slotIndex; // Utile pour le débogage ou futures interactions

                    const slotStartTimeMinutes = convertTimeToMinutes(slot.split(' - ')[0]);
                    const slotEndTimeMinutes = convertTimeToMinutes(slot.split(' - ')[1]);

                    let agentsAvailableForRole = [];

                    // Vérifier la disponibilité de chaque agent pour ce rôle et ce créneau
                    agents.forEach(agent => {
                        const agentPlanningForWeek = allPlannings[agent.id] ? allPlannings[agent.id][`week-${currentWeek}`] : null;
                        const agentDayPlanning = agentPlanningForWeek ? agentPlanningForWeek[actualDateKey] : null;

                        if (agentDayPlanning) {
                            let isAgentAvailableInSlot = false;

                            // Vérifier par créneaux précis
                            if (agentDayPlanning.creneaux && agentDayPlanning.creneaux.includes(slot.split(' - ')[0])) {
                                isAgentAvailableInSlot = true;
                            }

                            // Vérifier par plages
                            if (!isAgentAvailableInSlot && agentDayPlanning.plages) {
                                for (const plage of agentDayPlanning.plages) {
                                    const plageStartMinutes = convertTimeToMinutes(plage.debut);
                                    const plageEndMinutes = convertTimeToTimeToMidnight(plage.fin); // Gérer les fins à 00:00 (minuit)

                                    if (plageStartMinutes <= slotStartTimeMinutes && plageEndMinutes >= slotEndTimeMinutes) {
                                        isAgentAvailableInSlot = true;
                                        break;
                                    }
                                }
                            }

                            // Si l'agent est disponible pour ce créneau, vérifier ses qualifications
                            if (isAgentAvailableInSlot) {
                                const requiredQuals = roleToQualificationMap[role.id] || [];
                                const agentHasRequiredQual = requiredQuals.some(reqQual => agent.qualifications.includes(reqQual));

                                if (agentHasRequiredQual) {
                                    agentsAvailableForRole.push(agent);
                                }
                            }
                        }
                    });

                    // Afficher les agents disponibles ou l'état "Indispo"
                    if (agentsAvailableForRole.length > 0) {
                        const agentNames = agentsAvailableForRole.map(a => `${a.prenom.charAt(0)}. ${a.nom}`).join(', ');
                        const agentNamesFull = agentsAvailableForRole.map(a => `${a.prenom} ${a.nom}`).join(', ');

                        const highlight = document.createElement('div');
                        highlight.classList.add('availability-highlight-segment');
                        // Colorer différemment si plusieurs agents sont dispo pour un même rôle
                        if (agentsAvailableForRole.length > 1) {
                            highlight.style.backgroundColor = 'rgba(0, 128, 0, 0.7)'; // Vert foncé si plusieurs
                        } else {
                            highlight.style.backgroundColor = 'rgba(0, 128, 0, 0.5)'; // Vert clair si un seul
                        }

                        const textSpan = document.createElement('span');
                        textSpan.classList.add('availability-segment-text');
                        textSpan.textContent = agentNames;
                        highlight.appendChild(textSpan);

                        // Ajout d'un tooltip détaillé
                        const tooltip = document.createElement('div');
                        tooltip.classList.add('availability-bar-tooltip');
                        tooltip.innerHTML = `<ul><li>${role.name} (${slot.split(' - ')[0]} - ${slot.split(' - ')[1]})</li><li>${agentNamesFull.split(', ').join('</li><li>')}</li></ul>`;
                        highlight.appendChild(tooltip);

                        // Gérer l'affichage du tooltip au survol
                        highlight.addEventListener('mouseenter', () => tooltip.style.display = 'block');
                        highlight.addEventListener('mouseleave', () => tooltip.style.display = 'none');


                        slotCell.appendChild(highlight);
                    } else if (role.required) { // Si le rôle est requis et personne n'est dispo
                        slotCell.classList.add('unavailable-role'); // Fond rouge clair
                        const indispoOverlay = document.createElement('div');
                        indispoOverlay.classList.add('engine-indispo-overlay-mini');
                        indispoOverlay.textContent = 'X'; // Indique l'indisponibilité pour ce rôle
                        slotCell.appendChild(indispoOverlay);
                    }
                    roleRow.appendChild(slotCell);
                });
                rosterGridContainer.appendChild(roleRow);
            });
        }
    });

    // Évaluer l'état "INDISPO" pour chaque engin globalement
    checkEngineReadiness(allPlannings, agents, allQualifications);
}

// Helper pour gérer le cas où l'heure de fin est minuit (00:00) le jour suivant
function convertTimeToTimeToMidnight(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    if (hours === 0 && minutes === 0) {
        return 24 * 60; // Représente minuit le jour suivant
    }
    return hours * 60 + minutes;
}


function checkEngineReadiness(allPlannings, allUsersInfo, allQualifications) {
    const rosterCells = rosterGridContainer.querySelectorAll('.roster-slot-cell');

    horaires.forEach((slot, slotIndex) => {
        const slotStartTimeMinutes = convertTimeToMinutes(slot.split(' - ')[0]);
        const slotEndTimeMinutes = convertTimeToTimeToMidnight(slot.split(' - ')[1]);

        for (const engineType in engineDetails) {
            const engine = engineDetails[engineType];
            let isEngineReady = true;

            // Pour chaque rôle critique de l'engin
            engine.criticalRoles.forEach(criticalRoleId => {
                const criticalRole = engine.roles.find(r => r.id === criticalRoleId);
                if (!criticalRole) return; // Ce cas ne devrait pas arriver si criticalRoles est bien défini

                let roleIsCovered = false;
                const requiredQuals = roleToQualificationMap[criticalRole.id] || [];

                allUsersInfo.forEach(agent => {
                    const agentPlanningForWeek = allPlannings[agent.id] ? allPlannings[agent.id][`week-${currentWeek}`] : null;
                    const agentDayPlanning = agentPlanningForWeek ? agentPlanningForWeek[formatDateToYYYYMMDD(new Date())] : null; // Pour le jour actuel, simplifier

                    if (agentDayPlanning) {
                        let isAgentAvailableInSlot = false;

                        // Vérifier par créneaux précis
                        if (agentDayPlanning.creneaux && agentDayPlanning.creneaux.includes(slot.split(' - ')[0])) {
                            isAgentAvailableInSlot = true;
                        }

                        // Vérifier par plages
                        if (!isAgentAvailableInSlot && agentDayPlanning.plages) {
                            for (const plage of agentDayPlanning.plages) {
                                const plageStartMinutes = convertTimeToMinutes(plage.debut);
                                const plageEndMinutes = convertTimeToTimeToMidnight(plage.fin);

                                if (plageStartMinutes <= slotStartTimeMinutes && plageEndMinutes >= slotEndTimeMinutes) {
                                    isAgentAvailableInSlot = true;
                                    break;
                                }
                            }
                        }

                        if (isAgentAvailableInSlot) {
                            const agentHasRequiredQual = requiredQuals.some(reqQual => agent.qualifications.includes(reqQual));
                            if (agentHasRequiredQual) {
                                roleIsCovered = true;
                                return; // Rôle couvert par cet agent
                            }
                        }
                    }
                });

                if (!roleIsCovered) {
                    isEngineReady = false;
                }
            });

            // Appliquer le voile "INDISPO" à toutes les cellules de l'engin pour ce créneau
            const engineRoleRows = rosterGridContainer.querySelectorAll('.engine-role-row');
            engineRoleRows.forEach(row => {
                const roleName = row.querySelector('.role-name-cell').textContent.split(' ')[1]; // Ex: "VSAV" de "CA VSAV"
                if (engine.name.includes(roleName) || roleName.includes(engine.name)) { // Logique simple pour lier rôle à engin
                     const cell = row.querySelector(`.roster-slot-cell[data-slot-index="${slotIndex}"]`);
                    if (cell) {
                        // Supprimer les overlays existants pour éviter les doublons
                        const existingOverlay = cell.querySelector('.engine-indispo-overlay');
                        if (existingOverlay) {
                            cell.removeChild(existingOverlay);
                        }
                        
                        if (!isEngineReady) {
                            const indispoOverlay = document.createElement('div');
                            indispoOverlay.classList.add('engine-indispo-overlay');
                            indispoOverlay.textContent = 'INDISPO';
                            cell.appendChild(indispoOverlay);
                        }
                    }
                }
            });
        }
    });
}


function showLoading(isLoading) {
    if (isLoading) {
        loadingSpinner.classList.remove("hidden");
        if (weekSelect) weekSelect.disabled = true;
    } else {
        loadingSpinner.classList.add("hidden");
        if (weekSelect) weekSelect.disabled = false;
    }
}


// --- Initialisation ---

document.addEventListener('DOMContentLoaded', () => {
    // Injecter les styles CSS dynamiquement
    const styleSheet = document.createElement("style");
    styleSheet.type = "text/css";
    styleSheet.innerText = inlineCss;
    document.head.appendChild(styleSheet);

    // Initialiser la semaine actuelle
    currentWeek = getCurrentISOWeek();

    // Remplir le sélecteur de semaine
    const currentYear = new Date().getFullYear();
    for (let i = currentWeek - 20; i <= currentWeek + 20; i++) { // Afficher +/- 20 semaines
        let week = i;
        let year = currentYear;
        if (week <= 0) { // Gérer le passage à l'année précédente
            week += 52; // Approximation, pourrait être 52 ou 53 selon l'année ISO
            year--;
        } else if (week > 52) { // Gérer le passage à l'année suivante
            week -= 52; // Approximation
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

    // Écouteur pour le changement de semaine
    if (weekSelect) {
        weekSelect.addEventListener('change', (e) => {
            currentWeek = parseInt(e.target.value);
            loadRosterData(); // Recharger les données pour la nouvelle semaine
        });
    }

    loadRosterData(); // Charger les données initiales au démarrage
});