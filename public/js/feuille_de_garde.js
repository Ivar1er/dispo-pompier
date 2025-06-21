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
// IMPORTANT: Les clés (ID de rôle) doivent correspondre aux 'id' dans engineDetails.
// Les valeurs (tableau de chaînes) doivent correspondre exactement aux qualifications (IDs)
// que les agents possèdent dans votre base de données et que votre API retourne.
// Un agent est qualifié si il possède AU MOINS UNE des qualifications du tableau.
const roleToQualificationMap = {
    // VSAV
    'ca_vsav': ['ca_vsav'], // Le rôle 'ca_vsav' requiert la qualification 'ca_vsav'
    'cod_0': ['cod_0'],     // Le rôle 'cod_0' requiert la qualification 'cod_0' (CD VSAV / VTU / VPMA)
    'eq_vsav': ['eq_vsav'], // Le rôle 'eq_vsav' requiert la qualification 'eq_vsav'
    'eq_vsav_2': ['eq_vsav'], // Le rôle 'eq_vsav_2' requiert la qualification 'eq_vsav' (même qualif que equipier 1)

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
    // 'cod_0' est géré ci-dessus si c'est le même Chef
    'eq_vtu': ['eq_vtu'],

    // VPMA
    'ca_vpma': ['ca_vpma'],
    'cod_0': ['cod_0'], // CD VPMA, peut être le même que COD VSAV/VTU
    'eq_vpma': ['eq_vpma']
};

// Nouvelle structure pour définir les détails de chaque engin, ses rôles et ses rôles critiques.
// C'est ici que tu définis les rôles clés pour l'affichage "INDISPO".
const engineDetails = {
    'VSAV': { // Le type doit correspondre à celui dans appData.timeSlots[id].engines
        name: "VSAV",
        roles: [
            { id: 'ca_vsav', name: 'CA VSAV', required: true },
            { id: 'cod_0', name: 'CD VSAV', required: true },
            { id: 'eq_vsav', name: 'EQ VSAV', required: true },
        ],
        criticalRoles: ['cod_0', 'ca_vsav'] // CD et CA sont critiques pour VSAV
    },
    'FPT': {
        name: "FPT",
        roles: [
            { id: 'ca_fpt', name: 'CA FPT', required: true },
            { id: 'cod_1', name: 'CD FPT', required: true },
            { id: 'eq1_fpt', name: 'EQ1 FPT', required: true },
            { id: 'eq2_fpt', name: 'EQ2 FPT', required: false }
        ],
        criticalRoles: ['cod_1', 'ca_fpt'] // CD et CA sont critiques pour FPT
    },
    'CCF': {
        name: "CCF",
        roles: [
            { id: 'ca_ccf', name: 'CA CCF', required: true },
            { id: 'cod_2', name: 'CD CCF', required: true },
            { id: 'eq1_ccf', name: 'EQ1 CCF', required: true },
            { id: 'eq2_ccf',name: 'EQ2 CCF', required: false },
        ],
        criticalRoles: ['cod_2', 'ca_ccf']
    },
    'VTU': {
        name: "VTU",
        roles: [
            { id: 'ca_vtu', name: 'CA VTU', required: true },
            { id: 'cod_0', name: 'CD VTU', required: true }, // Peut-être le même COD que VSAV
            { id: 'eq_vtu', name: 'EQ VTU', required: false }
        ],
        criticalRoles: ['cod_0',]
    },
     'VPMA': {
        name: "VPMA",
        roles: [
            { id: 'ca_vpma', name: 'CA VPMA', required: true },
            { id: 'cod_0', name: 'CD VPMA', required: true },
            { id: 'eq_vpma', name: 'EQ VPMA', required: false }
        ],
        criticalRoles: ['cod_0', 'eq_vpma'] // A revoir si des rôles critiques sont pertinents ici
    }
};

// Références DOM
const rosterDateInput        = document.getElementById('roster-date');
const prevDayButton          = document.getElementById('prev-day-button');
const nextDayButton          = document.getElementById('next-day-button');
const generateAutoBtn        = document.getElementById('generate-auto-btn');
const availablePersonnelList = document.getElementById('available-personnel-list');
const onDutyAgentsGrid       = document.getElementById('on-duty-agents-grid');
const rosterGridContainer    = document.getElementById('roster-grid');
const engineDetailsPage      = document.getElementById('engine-details-page');
const backToRosterBtn        = document.getElementById('back-to-roster-btn');
const loadingSpinner         = document.getElementById('loading-spinner');

// NOUVEAU: Références DOM pour la modale d'affectation
const personnelAssignmentModal        = document.getElementById('personnel-assignment-modal');
const closePersonnelAssignmentModalBtn = document.getElementById('close-personnel-assignment-modal-btn');
const personnelAssignmentModalTitle   = document.getElementById('personnel-assignment-modal-title');
const availableAgentsInModalList      = document.getElementById('available-agents-in-modal-list');
const engineRolesContainer            = document.getElementById('engine-roles-container');

// États globaux
let currentRosterDate = new Date();
let allAgents         = [];
// appData contiendra maintenant la configuration du roster par date, et personnelAvailabilities par agent
let appData           = { 
    personnelAvailabilities: {} 
};

// NOUVEAU: Variable globale pour stocker les qualifications de l'agent en cours de drag
// Cette variable n'est plus utilisée directement avec le nouveau D&D, conservée pour référence si besoin
let draggedAgentQualifications = []; 

// Helpers
function formatDateToYYYYMMDD(d) {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}` +
         `-${String(dt.getDate()).padStart(2,'0')}`;
}
function parseTimeToMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Vérifie si deux plages horaires se chevauchent, en tenant compte d'une journée conceptuelle
 * commençant à `startHourOffset` (par exemple 07:00).
 * @param {{start: string, end: string}} r1 - Première plage horaire { "HH:MM", "HH:MM" }
 * @param {{start: string, end: string}} r2 - Deuxième plage horaire { "HH:MM", "HH:MM" }
 * @returns {boolean} True si les plages se chevauchent, False sinon.
 */
function doTimeRangesOverlap(r1, r2) {
    const startHourOffset = 7 * 60; // 7h en minutes, la nouvelle origine de la journée 0%
    const totalDayMinutes = 24 * 60;

    let s1 = (parseTimeToMinutes(r1.start) - startHourOffset + totalDayMinutes) % totalDayMinutes;
    let e1 = (parseTimeToMinutes(r1.end) - startHourOffset + totalDayMinutes) % totalDayMinutes;
    let s2 = (parseTimeToMinutes(r2.start) - startHourOffset + totalDayMinutes) % totalDayMinutes;
    let e2 = (parseTimeToMinutes(r2.end) - startHourOffset + totalDayMinutes) % totalDayMinutes;

    // Si une plage traverse la "nouvelle minuit" (07:00 décalée), l'étendre sur 48h.
    // Ex: 04:00-09:00 (heure réelle) devient 21:00-02:00 (heures décalées). Ici endMinutes < startMinutes.
    // On ajoute totalDayMinutes pour que la fin soit après le début sur une ligne temporelle continue.
    if (e1 <= s1) e1 += totalDayMinutes;
    if (e2 <= s2) e2 += totalDayMinutes;

    // Un chevauchement existe si : (start1 < end2) ET (end1 > start2)
    return s1 < e2 && e1 > s2;
}


/**
 * Calcule la largeur et la position d'un segment de disponibilité sur une barre de 24h,
 * avec une journée qui commence à 07:00 et se termine à 07:00 le lendemain.
 * @param {string} startTime - Heure de début (HH:MM).
 * @param {string} endTime - Heure de fin (HH:MM).
 * @returns {Array<Object>} Un tableau d'objets { left: %, width: % } pour gérer les plages qui passent minuit.
 */
function getAvailabilitySegments(startTime, endTime) {
    const startHourOffset = 7 * 60; // 7h en minutes (la nouvelle origine de la journée 0%)
    const totalDayMinutes = 24 * 60; // 1440 minutes pour une journée complète

    let startMinutes = parseTimeToMinutes(startTime);
    let endMinutes = parseTimeToMinutes(endTime);

    // Normaliser les minutes pour la journée de 07:00 à 07:00
    // On décale toutes les heures de 7 heures en arrière pour que 07:00 soit 0 minutes, 08:00 soit 60 minutes, etc.
    startMinutes = (startMinutes - startHourOffset + totalDayMinutes) % totalDayMinutes;
    endMinutes = (endMinutes - startHourOffset + totalDayMinutes) % totalDayMinutes;

    const segments = [];

    // Si la plage de temps est de durée nulle (ex: 07:00 - 07:00, qui est la nouvelle "minuit")
    // Cela indique une disponibilité sur 24h sur ce fuseau visuel.
    if (startMinutes === endMinutes) {
        segments.push({ left: 0, width: 100 });
        return segments;
    }

    // Cas simple: la plage ne traverse pas la "nouvelle minuit" (07:00)
    // Ex: 08:00-17:00 (heure réelle) => 01:00-10:00 (heures décalées). Ici endMinutes > startMinutes
    if (endMinutes > startMinutes) {
        const left = (startMinutes / totalDayMinutes) * 100;
        const width = ((endMinutes - startMinutes) / totalDayMinutes) * 100;
        segments.push({ left, width });
    }
    // Cas complexe: la plage traverse la "nouvelle minuit" (07:00)
    // Ex: 04:00-09:00 (heure réelle) => 21:00-02:00 (heures décalées). Ici endMinutes < startMinutes
    else {
        // Segment de la "nouvelle origine" (07:00, ou 0 minutes décalées) jusqu'à la fin de la journée décalée (06:59 le lendemain, ou 1439 minutes décalées)
        const left1 = (startMinutes / totalDayMinutes) * 100;
        const width1 = ((totalDayMinutes - startMinutes) / totalDayMinutes) * 100;
        segments.push({ left: left1, width: width1 });

        // Segment du début de la journée décalée (07:00 du lendemain) jusqu'à la fin de la plage
        const left2 = 0; // Commence à la nouvelle origine
        const width2 = (endMinutes / totalDayMinutes) * 100;
        segments.push({ left: left2, width: width2 });
    }
    return segments;
}


function createEmptyEngineAssignment(type) {
  const pers = {};
  // Utilise engineDetails pour obtenir les rôles d'un type d'engin spécifique
  // Assure-toi que engineDetails[type] existe et a une propriété 'roles'.
  (engineDetails[type]?.roles || []).forEach(role => pers[role.id] = 'none'); // Utilise role.id
  return pers; // Renvoie l'objet personnel directement, comme attendu par le backend
}

/**
 * Vérifie si un agent est qualifié pour un rôle donné en fonction de ses qualifications et de la map.
 * @param {Object} agent - L'objet agent avec sa liste de qualifications (agent.qualifications).
 * @param {string} roleId - L'ID du rôle à vérifier (ex: 'ca_fpt', 'cod_0', 'eq_vsav').
 * @returns {boolean} True si l'agent est qualifié, False sinon.
 */
function isAgentQualifiedForRole(agent, roleId) {
    if (!agent || !Array.isArray(agent.qualifications)) {
        // console.warn(`isAgentQualifiedForRole: Agent ou qualifications non valides pour le rôle '${roleId}'.`, agent);
        return false;
    }

    const requiredQualifications = roleToQualificationMap[roleId];
    
    // Si aucune qualification n'est définie dans roleToQualificationMap pour ce rôle,
    // on considère l'agent qualifié par défaut pour ce rôle (pas de restriction).
    if (!requiredQualifications || requiredQualifications.length === 0) {
        return true;
    }

    // L'agent est qualifié si il possède au moins une des qualifications requises.
    return requiredQualifications.some(q => agent.qualifications.includes(q));
}


/**
 * Affiche le spinner de chargement.
 */
function showSpinner() {
  loadingSpinner.classList.remove('hidden');
}

/**
 * Cache le spinner de chargage.
 */
function hideSpinner() {
  loadingSpinner.classList.add('hidden');
}

// --------------------------------------------------
// 2️⃣ Chargement des données
// --------------------------------------------------

async function fetchAllAgents() {
  try {
    // IMPORTANT: Utiliser sessionStorage pour récupérer le token
    const token = sessionStorage.getItem('token'); 
    if (!token) {
        console.warn('fetchAllAgents: Aucun token trouvé. Authentification requise.');
        // Potentiellement rediriger ou afficher un message d'erreur à l'utilisateur
        return; 
    }

    const resp = await fetch(`${API_BASE_URL}/api/admin/agents`, {
      headers: {
        'Authorization': `Bearer ${token}`, // Envoyer le token
        'X-User-Role':'admin' // Garder l'en-tête de rôle
      }
    });
    if (!resp.ok) {
        if (resp.status === 401 || resp.status === 403) {
            displayMessageModal("Accès Refusé", "Votre session a expiré ou vous n'êtes pas autorisé. Veuillez vous reconnecter.", "error", () => {
                sessionStorage.clear();
                window.location.href = "/index.html";
            });
            return;
        }
        throw new Error(`HTTP error! status: ${resp.status}`);
    }
    allAgents = await resp.json();
  } catch (error) {
    console.error("Erreur lors du chargement des agents:", error);
    allAgents = []; // Assurez-vous que c'est un tableau vide en cas d'échec
  }
}

async function loadRosterConfig(dateKey) {
  try {
    // IMPORTANT: Utiliser sessionStorage pour récupérer le token
    const token = sessionStorage.getItem('token');
    if (!token) {
        console.warn('loadRosterConfig: Aucun token trouvé. Authentification requise.');
        return;
    }

    const resp = await fetch(`${API_BASE_URL}/api/roster-config/${dateKey}`, {
      headers: {
        'Authorization': `Bearer ${token}`, // Envoyer le token
        'X-User-Role':'admin'
      }
    });
    if (!resp.ok) {
        if (resp.status === 401 || resp.status === 403) {
            // Pas de redirection ici car loadInitialData gérera l'erreur globale si elle se propage.
            // On jette l'erreur pour que le catch de loadInitialData puisse la gérer.
            throw new Error(`HTTP error! status: ${resp.status}`);
        }
        throw new Error(`HTTP error! status: ${resp.status}`); // Gérer les autres types d'erreurs HTTP
    }
    appData[dateKey] = await resp.json();
    if (Object.keys(appData[dateKey]).length === 0) {
        appData[dateKey] = {
            timeSlots: {},
            onDutyAgents: Array(10).fill('none')
        };
        initializeDefaultTimeSlotsForDate(dateKey, true); // Force la création si le fichier était vide
    } else {
        if (appData[dateKey].timeSlots) {
            for (const slotId in appData[dateKey].timeSlots) {
                const timeSlot = appData[dateKey].timeSlots[slotId];
                if (timeSlot.engines) {
                    for (const engineType in timeSlot.engines) {
                                if (typeof timeSlot.engines[engineType].personnel === 'undefined') {
                                    timeSlot.engines[engineType] = { personnel: timeSlot.engines[engineType] };
                                }
                                const definedRoles = engineDetails[engineType]?.roles || [];
                                definedRoles.forEach(role => {
                                    if (typeof timeSlot.engines[engineType].personnel[role.id] === 'undefined') {
                                        timeSlot.engines[engineType].personnel[role.id] = 'none';
                                    }
                                });
                            }
                        }
                    }
                }
            }
          } catch (error) {
            console.error("Erreur lors du chargement de la configuration du roster:", error);
            appData[dateKey] = {
              timeSlots: {},
              onDutyAgents: Array(10).fill('none')
            };
            // Si l'erreur est une 401/403, elle a déjà été gérée par fetchAllAgents
            // ou sera gérée par loadInitialData. Ne pas initializeDefaultTimeSlotsForDate ici si l'erreur vient du token.
            if (!error.message.includes('401') && !error.message.includes('403')) {
                initializeDefaultTimeSlotsForDate(dateKey, true);
            }
          }
        }


        async function saveRosterConfig(dateKey) {
          try {
            // IMPORTANT: Utiliser sessionStorage pour récupérer le token
            const token = sessionStorage.getItem('token');
            if (!token) {
                console.warn('saveRosterConfig: Aucun token trouvé. Authentification requise.');
                return;
            }

            const resp = await fetch(`${API_BASE_URL}/api/roster-config/${dateKey}`, {
              method: 'POST',
              headers: {
                'Content-Type':'application/json',
                'Authorization': `Bearer ${token}`, // Envoyer le token
                'X-User-Role':'admin'
              },
              body: JSON.stringify(appData[dateKey])
            });
            if (!resp.ok) {
                const errorText = await resp.text();
                if (resp.status === 401 || resp.status === 403) {
                    displayMessageModal("Accès Refusé", "Votre session a expiré ou vous n'êtes pas autorisé. Veuillez vous reconnecter.", "error", () => {
                        sessionStorage.clear();
                        window.location.href = "/index.html";
                    });
                    return;
                }
                throw new Error(`HTTP error! status: ${resp.status}, message: ${errorText}`);
            }
          } catch (error) {
            console.error("Erreur lors de la sauvegarde de la configuration du roster:", error);
            displayMessageModal("Erreur de Sauvegarde", `Impossible de sauvegarder la configuration du roster : ${error.message}`, "error");
          }
        }

        async function loadDailyRoster(dateKey) {
          try {
            // IMPORTANT: Utiliser sessionStorage pour récupérer le token
            const token = sessionStorage.getItem('token');
            if (!token) {
                console.warn('loadDailyRoster: Aucun token trouvé. Authentification requise.');
                return;
            }

            const resp = await fetch(`${API_BASE_URL}/api/daily-roster/${dateKey}`, {
              headers: {
                'Authorization': `Bearer ${token}`, // Envoyer le token
                'X-User-Role':'admin'
              },
              credentials: 'include'
            });
            if (!resp.ok) {
                if (resp.status === 401 || resp.status === 403) {
                    throw new Error(`HTTP error! status: ${resp.status}`);
                }
                throw new Error(`HTTP error! status: ${resp.status}`);
            }
            const dr = await resp.json();
            if (dr && dr.onDutyAgents) {
                appData[dateKey].onDutyAgents = dr.onDutyAgents;
            } else {
                appData[dateKey].onDutyAgents = Array(10).fill('none');
            }
          } catch (error) {
            console.error('loadDailyRoster échoué', error);
            appData[dateKey].onDutyAgents = Array(10).fill('none');
             if (!error.message.includes('401') && !error.message.includes('403')) {
                displayMessageModal("Erreur de Chargement", `Impossible de charger le roster quotidien : ${error.message}`, "error");
            }
          }
        }

        async function saveDailyRoster(dateKey) {
          try {
            // IMPORTANT: Utiliser sessionStorage pour récupérer le token
            const token = sessionStorage.getItem('token');
            if (!token) {
                console.warn('saveDailyRoster: Aucun token trouvé. Authentification requise.');
                return;
            }

            const resp = await fetch(`${API_BASE_URL}/api/daily-roster/${dateKey}`, {
              method: 'POST',
              headers: {
                'Content-Type':'application/json',
                'Authorization': `Bearer ${token}`, // Envoyer le token
                'X-User-Role':'admin'
              },
              credentials: 'include',
              body: JSON.stringify({ onDutyAgents: appData[dateKey].onDutyAgents })
            });
            if (!resp.ok) {
              const errorText = await resp.text();
                if (resp.status === 401 || resp.status === 403) {
                    displayMessageModal("Accès Refusé", "Votre session a expiré ou vous n'êtes pas autorisé. Veuillez vous reconnecter.", "error", () => {
                        sessionStorage.clear();
                        window.location.href = "/index.html";
                    });
                    return;
                }
              throw new Error(`HTTP error! status: ${resp.status}, message: ${errorText}`);
            }
          } catch (error) {
            console.error('saveDailyRoster échoué:', error);
            displayMessageModal("Erreur de Sauvegarde", `Impossible de sauvegarder le roster quotidien : ${error.message}`, "error");
          }
        }

        // Variable globale pour stocker les noms des jours en français
        const DAYS_OF_WEEK_FR = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

        function getWeekAndDayFromDate(dateString) {
            const date = new Date(dateString + 'T12:00:00');
            date.setHours(0, 0, 0, 0);

            const dayNr = (date.getDay() + 6) % 7;
            date.setDate(date.getDate() - dayNr + 3);
            const firstThursday = date.valueOf();
            date.setMonth(0, 1);
            if (date.getDay() !== 4) {
                date.setMonth(0, 1 + ((4 - date.getDay()) + 7) % 7);
            }
            const weekNo = 1 + Math.ceil((firstThursday - date) / 604800000);

            const dayName = DAYS_OF_WEEK_FR[new Date(dateString + 'T12:00:00').getDay()];

            return { weekNo: `week-${weekNo}`, dayName: dayName };
        }

        async function loadAllPersonnelAvailabilities() {
          try {
            const dateKey = formatDateToYYYYMMDD(currentRosterDate);
            const token = sessionStorage.getItem('token'); 
            if (!token) {
                console.warn('loadAllPersonnelAvailabilities: Aucun token trouvé. Authentification requise.');
                displayMessageModal("Session expirée", "Votre session a expiré ou n'est pas valide. Veuillez vous reconnecter.", "error", () => {
                    sessionStorage.clear();
                    window.location.href = "/index.html";
                });
                return; 
            }

            // D'abord, initialiser les disponibilités de TOUS les agents connus à vide pour la date actuelle.
            // Cela assure que tout agent non explicitement disponible par l'API sera traité comme indisponible.
            appData.personnelAvailabilities = {}; // Réinitialise les disponibilités pour la date actuelle
            allAgents.forEach(agent => {
                appData.personnelAvailabilities[agent._id] = {
                    [dateKey]: [] // Par défaut, l'agent est considéré comme indisponible (tableau vide)
                };
            });

            const resp = await fetch(`${API_BASE_URL}/api/agent-availability/${dateKey}`, {
              headers: {
                'Authorization': `Bearer ${token}`, // Utilise le token pour l'authentification
                'X-User-Role':'admin' // Garde l'en-tête de rôle si nécessaire pour le backend
              }
            });
            if (!resp.ok) {
                if (resp.status === 401 || resp.status === 403) {
                     displayMessageModal("Accès Refusé", "Votre session a expiré ou vous n'êtes pas autorisé à charger les disponibilités. Veuillez vous reconnecter.", "error", () => {
                        sessionStorage.clear();
                        window.location.href = "/index.html";
                    });
                    return;
                }
                console.error(`[ERREUR Client] Erreur HTTP lors du chargement des disponibilités: ${resp.status}`);
                throw new Error(`HTTP error! status: ${resp.status}`);
            }
            
            const data = await resp.json(); // data contient { available: [...], onCall: [...] }
            
            // Combiner les agents disponibles et d'astreinte renvoyés par l'API
            const allPersonnelWithAPIResponse = [...(data.available || []), ...(data.onCall || [])];
            
            // Mettre à jour les disponibilités des agents explicitement renvoyés par l'API.
            // Si 'availabilities' est absent ou null/undefined, l'agent sera considéré indisponible (tableau vide).
            allPersonnelWithAPIResponse.forEach(agent => {
                const availabilitiesForAgent = agent.availabilities || []; 
                appData.personnelAvailabilities[agent._id][dateKey] = availabilitiesForAgent;
            });

          } catch (error) {
            console.error("Erreur lors du chargement des disponibilités du personnel (API /api/agent-availability):", error);
            // Pas besoin de réinitialiser appData.personnelAvailabilities ici, il a déjà été initialisé avec les valeurs par défaut.
            // N'afficher la modale que si ce n'est pas un problème de token déjà géré.
            if (!error.message.includes('401') && !error.message.includes('403') && !error.message.includes('Session expirée')) {
                displayMessageModal("Erreur de Chargement", `Impossible de charger les disponibilités du personnel : ${error.message}`, "error");
            }
          }
        }

        async function updateDateDisplay() {
            showSpinner();
            try {
                const dateKey = formatDateToYYYYMMDD(currentRosterDate);
                await fetchAllAgents(); 
                await loadRosterConfig(dateKey);
                await loadDailyRoster(dateKey); 
                await loadAllPersonnelAvailabilities(); // Ceci doit charger les dispo pour TOUS les agents
                initializeDefaultTimeSlotsForDate(dateKey); // S'assure qu'au moins un créneau par défaut existe

                rosterDateInput.valueAsDate = currentRosterDate;
                renderTimeSlotButtons(dateKey);
                renderPersonnelLists(); // Appel pour rafraîchir la liste des agents disponibles
                renderOnDutyAgentsGrid(); // Appel pour rafraîchir la grille des agents d'astreinte
                renderRosterGrid();
            } catch (error) {
                console.error("Erreur lors de la mise à jour et du rendu de l'affichage:", error);
                // Si l'erreur n'a pas déjà été gérée par une modale de session expirée,
                // afficher une alerte plus générique.
                if (!error.message.includes('Session expirée')) {
                    displayMessageModal("Erreur d'Affichage", `Une erreur est survenue lors du chargement ou de l'affichage des données : ${error.message}`, "error");
                }
            } finally {
                hideSpinner();
            }
        }

        // --------------------------------------------------
        // 3️⃣ Rendu & mise à jour de l’affichage
        // --------------------------------------------------

        function initializeDefaultTimeSlotsForDate(dateKey, force = false) {
          if (!appData[dateKey]) {
            appData[dateKey] = {
              timeSlots: {},
              onDutyAgents: Array(10).fill('none')
            };
          }
          if (Object.keys(appData[dateKey].timeSlots).length === 0 || force) {
            const id = `slot_0700_0700_${Date.now()}`;
            appData[dateKey].timeSlots[id] = {
              range: '07:00 - 07:00',
              engines: {}
            };
            Object.keys(engineDetails).forEach(et => {
              appData[dateKey].timeSlots[id].engines[et] =
                createEmptyEngineAssignment(et);
            });
          }
        }


        function renderTimeSlotButtons(dateKey) {
          const c = document.getElementById('time-slot-buttons-container');
          c.innerHTML = '';

          let clickTimeout = null;
          const DBLCLICK_DELAY = 300;

          // bouton “+”
          const add = document.createElement('button');
          add.textContent = '+';
          add.classList.add('add-time-slot-btn');
          add.addEventListener('click', () => {
            showTimeRangeSelectionModal('07:00', '07:00', async (ns, ne) => {
              const id = `slot_${ns.replace(':','')}_${ne.replace(':','')}_${Date.now()}`;
              appData[dateKey].timeSlots[id] = {
                range: `${ns} - ${ne}`,
                engines: {}
              };
              Object.keys(engineDetails).forEach(et => {
                appData[dateKey].timeSlots[id].engines[et] =
                  createEmptyEngineAssignment(et);
              });
              await saveRosterConfig(dateKey);
              renderTimeSlotButtons(dateKey);
              renderRosterGrid();
              showMainRosterGrid();
            });
          });
          c.appendChild(add);

          // boutons existants
          Object.entries(appData[dateKey].timeSlots)
            .sort((a,b)=> {
              const sA = parseTimeToMinutes(a[1].range.split(' - ')[0]);
              const sB = parseTimeToMinutes(b[1].range.split(' - ')[0]);
              return sA - sB;
            })
            .forEach(([slotId, slot]) => {
              const btn = document.createElement('button');
              btn.textContent = slot.range;
              btn.classList.add('time-slot-button');
              btn.dataset.slotId = slotId;

              btn.addEventListener('click', () => {
                clearTimeout(clickTimeout);

                clickTimeout = setTimeout(() => {
                  document.querySelectorAll('.time-slot-button').forEach(b => b.classList.remove('active'));
                  btn.classList.add('active');
                  displayEnginesForSlot(dateKey, slotId);
                }, DBLCLICK_DELAY);
              });

              btn.addEventListener('dblclick', async (event) => {
                event.stopPropagation();
                clearTimeout(clickTimeout);
                
                const [cs, ce] = slot.range.split(' - ');
                showTimeRangeSelectionModal(cs, ce, async (ns, ne) => {
                  slot.range = `${ns} - ${ne}`;
                  await saveRosterConfig(dateKey);

                  let sMin = parseTimeToMinutes(ns),
                      eMin = parseTimeToMinutes(ne);
                  if (eMin <= sMin) eMin += 24*60;
                  const dayEndMinutes = parseTimeToMinutes('07:00') + 24*60;

                  if (eMin < dayEndMinutes && ns !== ne) {
                    const newSlotStartTime = ne;
                    const newSlotEndTime = '07:00';

                    const newSlotId = `slot_${newSlotStartTime.replace(':','')}_${newSlotEndTime.replace(':','')}_${Date.now()}`;
                    
                    const slotExists = Object.values(appData[dateKey].timeSlots).some(s => {
                        const [existingStart, existingEnd] = s.range.split(' - ');
                        return existingStart === newSlotStartTime && existingEnd === newSlotEndTime;
                    });

                    if (!slotExists) {
                        appData[dateKey].timeSlots[newSlotId] = {
                            range: `${newSlotStartTime} - ${newSlotEndTime}`,
                            engines: {}
                        };
                        Object.keys(engineDetails).forEach(et => {
                            appData[dateKey].timeSlots[newSlotId].engines[et] = createEmptyEngineAssignment(et);
                        });
                        await saveRosterConfig(dateKey);
                    }
                  }
                  renderTimeSlotButtons(dateKey);
                  renderRosterGrid();
                  showMainRosterGrid();
                });
              });

              const deleteBtn = document.createElement('button');
              deleteBtn.textContent = 'x';
              deleteBtn.classList.add('delete-time-slot-btn');
              deleteBtn.addEventListener('click', async (event) => {
                event.stopPropagation();
                if (await confirm("Voulez-vous vraiment supprimer le créneau " + slot.range + " ?")) { // Utilisation de await confirm()
                  delete appData[dateKey].timeSlots[slotId];
                  await saveRosterConfig(dateKey);
                  renderTimeSlotButtons(dateKey);
                  renderRosterGrid();
                  showMainRosterGrid();
                }
              });
              btn.appendChild(deleteBtn);
              c.appendChild(btn);
            });
        }

        function renderRosterGrid() {
          rosterGridContainer.innerHTML = '';
          const table = document.createElement('table');
          table.classList.add('roster-table');

          const thead = document.createElement('thead');
          const headerRow = document.createElement('tr');
          const emptyTh = document.createElement('th');
          headerRow.appendChild(emptyTh);

          Object.keys(engineDetails).forEach(engineType => {
            const th = document.createElement('th');
            th.textContent = engineDetails[engineType].name;
            headerRow.appendChild(th);
          });
          thead.appendChild(headerRow);
          table.appendChild(thead);

          const tbody = document.createElement('tbody');
          const dateKey = formatDateToYYYYMMDD(currentRosterDate);

          const sortedTimeSlots = Object.entries(appData[dateKey].timeSlots || {}).sort((a, b) => {
            const sA = parseTimeToMinutes(a[1].range.split(' - ')[0]);
            const sB = parseTimeToMinutes(b[1].range.split(' - ')[0]);
            return sA - sB;
          });

          sortedTimeSlots.forEach(([slotId, slot]) => {
            const row = document.createElement('tr');
            const timeCell = document.createElement('td');
            timeCell.classList.add('time-slot-cell');
            timeCell.textContent = slot.range;
            row.appendChild(timeCell);

            Object.keys(engineDetails).forEach(engineType => {
              const engineCell = document.createElement('td');
              engineCell.classList.add('roster-cell');
              engineCell.dataset.slotId = slotId;
              engineCell.dataset.engineType = engineType;

              const assignment = slot.engines[engineType] || {}; 
              if (!assignment.personnel || typeof assignment.personnel !== 'object') {
                  assignment.personnel = createEmptyEngineAssignment(engineType);
              }

              const engConfig = engineDetails[engineType];
              if (!engConfig) {
                  console.warn(`Configuration d'engin introuvable pour le type : ${engineType}.`);
                  engineCell.textContent = "Erreur config";
                  row.appendChild(engineCell);
                  return; 
              }

              let isEngineIndispo = false;
              if (engConfig.criticalRoles) {
                  for (const criticalRoleId of engConfig.criticalRoles) {
                      const assignedAgentId = (assignment && assignment.personnel ? assignment.personnel[criticalRoleId] : undefined);
                      const assignedAgent = allAgents.find(a => a._id === assignedAgentId);

                      if (!assignedAgentId || assignedAgentId === 'none' || assignedAgentId === null ||
                          (assignedAgent && !isAgentQualifiedForRole(assignedAgent, criticalRoleId))) {
                          isEngineIndispo = true;
                          break;
                      }
                  }
              }

              engineCell.innerHTML = `
                  <div class="engine-display">
                      <span class="engine-name-mini">${engConfig.name}</span>
                      <ul class="assigned-personnel-mini">
                          ${engConfig.roles.map(roleDef => {
                              const agentId = (assignment && assignment.personnel ? assignment.personnel[roleDef.id] : undefined);
                              const agent = allAgents.find(a => a._id === agentId);
                              const agentDisplay = agent && agentId !== 'none' ? `${agent.prenom.charAt(0)}. ${agent.nom}` : '';
                              const isQualified = agent && isAgentQualifiedForRole(agent, roleDef.id);
                              
                              let agentClass = '';
                              let agentTitle = '';
                              if (agentId !== 'none' && !isQualified) {
                                  agentClass = 'unqualified-mini';
                                  agentTitle = `Non qualifié pour ${roleDef.name}`;
                              } else if (roleDef.required && (!agentId || agentId === 'none')) {
                                  agentClass = 'missing-mini';
                                  agentTitle = `Manquant (Rôle obligatoire ${roleDef.name})`;
                              }

                              return `<li class="${agentClass}" title="${agentTitle}">
                                        <span class="role-abbr">${roleDef.name.substring(0,2)}:</span> ${agentDisplay}
                                     </li>`;
                          }).join('')}
                      </ul>
                  </div>
                  ${isEngineIndispo ? '<div class="engine-indispo-overlay-mini">INDISPO</div>' : ''}
              `;

              engineCell.addEventListener('dragover', handleDragOver);
              engineCell.addEventListener('dragleave', handleDragLeave);
              engineCell.addEventListener('drop', handleDropOnEngine);

              row.appendChild(engineCell);
            });
            tbody.appendChild(row);
          });
          table.appendChild(tbody);

          rosterGridContainer.appendChild(table);
          document.querySelector('.loading-message')?.remove();
        }

        function renderPersonnelLists() {
            availablePersonnelList.innerHTML = '';
            const dateKey = formatDateToYYYYMMDD(currentRosterDate);
            const onDutyAgents = appData[dateKey]?.onDutyAgents || Array(10).fill('none');

            const filteredAvailableAgents = allAgents.filter(agent => {
                const isAlreadyOnDuty = onDutyAgents.includes(agent._id);
                // Récupère les disponibilités de l'agent pour la date sélectionnée
                const agentAvailabilities = appData.personnelAvailabilities[agent._id] || {};
                const dailyAvailabilities = agentAvailabilities[dateKey] || [];
                
                // N'inclut que les agents qui ne sont PAS d'astreinte ET qui ont au moins une disponibilité renseignée.
                return !isAlreadyOnDuty && dailyAvailabilities.length > 0;
            });

            if (filteredAvailableAgents.length === 0) {
                availablePersonnelList.innerHTML = '<p class="no-available-personnel">Aucun agent disponible avec des disponibilités renseignées pour cette journée.</p>';
            }


            filteredAvailableAgents.forEach(agent => {
                const item = document.createElement('div');
                item.classList.add('available-personnel-item');
                item.style.marginBottom = '10px';
                
                const agentInfoDiv = document.createElement('div');
                agentInfoDiv.classList.add('agent-info');
                agentInfoDiv.innerHTML = `<span class="agent-name">${agent.prenom} ${agent.nom || 'Agent Inconnu'}</span>`;
                item.appendChild(agentInfoDiv);

                const availabilityBarWrapper = document.createElement('div');
                availabilityBarWrapper.classList.add('availability-bar-wrapper');
                item.appendChild(availabilityBarWrapper);

                const availabilityBar = document.createElement('div');
                availabilityBar.classList.add('availability-bar');
                availabilityBarWrapper.appendChild(availabilityBar);

                const availabilityBarBase = document.createElement('div');
                availabilityBarBase.classList.add('availability-base-bar');
                availabilityBar.appendChild(availabilityBarBase);

                const timeLegend = document.createElement('div');
                timeLegend.classList.add('time-legend');
                timeLegend.innerHTML = `
                    <span>07:00</span>
                    <span>13:00</span>
                    <span>19:00</span>
                    <span>01:00</span>
                    <span>07:00</span>
                `;
                availabilityBarWrapper.appendChild(timeLegend);

                item.dataset.agentId = agent._id;
                item.setAttribute('draggable', true);
                item.addEventListener('dragstart', handleDragStart);

                const agentAvailabilities = appData.personnelAvailabilities[agent._id] || {};
                // Utilise appData.personnelAvailabilities[agent._id][dateKey] qui est déjà initialisé
                const dailyAvailabilities = agentAvailabilities[dateKey] || []; 

                const fullDayMinutes = 24 * 60; 
                const thirtyMinInterval = 30;
                const dayStartOffsetMinutes = 7 * 60; 

                // Si aucune disponibilité n'est définie pour l'agent (dailyAvailabilities est vide),
                // on génère une seule plage pour toute la journée 07:00-07:00 pour la barre visuelle.
                // NOTE: Avec le nouveau filtre, dailyAvailabilities ne sera jamais vide ici si l'agent est affiché.
                const visualAvailabilities = dailyAvailabilities.length > 0 
                    ? dailyAvailabilities 
                    : [{ start: "07:00", end: "07:00" }]; // Représente une indisponibilité totale si pas de plages

                // Boucle pour couvrir l'ensemble de la journée de 07:00 à 07:00 le lendemain (48 créneaux de 30min)
                // Afin de déterminer l'état de chaque segment visuel.
                for (let k = 0; k < (fullDayMinutes / thirtyMinInterval); k++) {
                    let intervalStartMin = (dayStartOffsetMinutes + k * thirtyMinInterval) % fullDayMinutes;
                    let intervalEndMin = (dayStartOffsetMinutes + (k + 1) * thirtyMinInterval) % fullDayMinutes;

                    const currentInterval = {
                        start: `${String(Math.floor(intervalStartMin / 60)).padStart(2, '0')}:${String(intervalStartMin % 60).padStart(2, '0')}`,
                        end: `${String(Math.floor(intervalEndMin / 60)).padStart(2, '0')}:${String(intervalEndMin % 60).padStart(2, '0')}`
                    };

                    let isAvailable = false;
                    let originalRange = null; 

                    for (const range of visualAvailabilities) { // Utilise visualAvailabilities ici
                        // Utilise la fonction doTimeRangesOverlap modifiée
                        if (doTimeRangesOverlap(currentInterval, range)) {
                            isAvailable = true;
                            originalRange = range;
                            break;
                        }
                    }

                    // On utilise getAvailabilitySegments pour calculer la position et la largeur
                    // du segment *dans la barre de 24h virtuelle* (décalée à 07:00).
                    const segmentsToRender = getAvailabilitySegments(currentInterval.start, currentInterval.end);

                    segmentsToRender.forEach(segment => {
                        const highlightSegment = document.createElement('div');
                        highlightSegment.classList.add('availability-highlight-segment');
                        
                        const segmentText = document.createElement('span'); // Élément pour le texte
                        segmentText.classList.add('availability-segment-text');

                        if (isAvailable && dailyAvailabilities.length > 0) { // S'assurer que c'est vraiment disponible si des plages existent
                            highlightSegment.classList.add('available');
                            highlightSegment.title = `Disponible: ${originalRange.start} - ${originalRange.end}`;
                            segmentText.textContent = `${originalRange.start} - ${originalRange.end}`; // Texte pour les segments disponibles
                        } else {
                            highlightSegment.classList.add('unavailable');
                            highlightSegment.title = `Indisponible: ${currentInterval.start} - ${currentInterval.end}`;
                            segmentText.textContent = `${currentInterval.start} - ${currentInterval.end}`; // Texte pour les segments indisponibles (intervalle de 30 min)
                        }
                        highlightSegment.style.left = `${segment.left}%`;
                        highlightSegment.style.width = `${segment.width}%`;
                        
                        highlightSegment.appendChild(segmentText); // Ajouter le texte au segment
                        availabilityBarBase.appendChild(highlightSegment);
                    });
                }
                
                item.appendChild(createTooltipForAvailabilityBar(dailyAvailabilities, dailyAvailabilities.length === 0)); // Passer true si pas de dispo
                availablePersonnelList.appendChild(item);
            });
        }

            function renderOnDutyAgentsGrid() {
                onDutyAgentsGrid.innerHTML = '';
                const dateKey = formatDateToYYYYMMDD(currentRosterDate);
                const onDutyAgents = appData[dateKey]?.onDutyAgents || Array(10).fill('none');

                for (let i = 0; i < 10; i++) {
                    const slot = document.createElement('div');
                    slot.classList.add('on-duty-slot');
                    slot.dataset.slotIndex = i;
                    slot.addEventListener('dragover',  handleDragOver);
                    slot.addEventListener('dragleave', handleDragLeave);
                    slot.addEventListener('drop',      handleDropOnDuty);

                    const agentId = onDutyAgents[i];
                    if (agentId && agentId !== 'none') {
                        const agent = allAgents.find(a => a._id === agentId);
                        if (agent) {
                            slot.classList.add('filled');
                            slot.dataset.agentId = agent._id;
                            slot.setAttribute('draggable', true);
                            slot.addEventListener('dragstart', handleDragStart);

                            slot.innerHTML = `
                                <div class="agent-info">
                                    <span class="agent-name">${agent.prenom} ${agent.nom || 'Agent Inconnu'}</span>
                                </div>
                                <div class="availability-bar-wrapper">
                                    <div class="availability-bar">
                                        <div class="availability-base-bar"></div>
                                    </div>
                                    <div class="time-legend">
                                        <span>07:00</span>
                                        <span>13:00</span>
                                        <span>19:00</span>
                                        <span>01:00</span>
                                        <span>07:00</span>
                                    </div>
                                </div>
                                <button class="remove-agent-btn">x</button>
                            `;

                            const availabilityBarBase = slot.querySelector('.availability-base-bar');
                            const agentAvailabilities = appData.personnelAvailabilities[agent._id] || {};
                            const dailyAvailabilities = agentAvailabilities[dateKey] || [];

                            const fullDayMinutes = 24 * 60;
                            const thirtyMinInterval = 30;
                            const dayStartOffsetMinutes = 7 * 60;

                            const visualAvailabilities = dailyAvailabilities.length > 0 
                                ? dailyAvailabilities 
                                : [{ start: "07:00", end: "07:00" }]; // Représente une indisponibilité totale si pas de plages

                            for (let k = 0; k < (fullDayMinutes / thirtyMinInterval); k++) {
                                let intervalStartMin = (dayStartOffsetMinutes + k * thirtyMinInterval) % fullDayMinutes;
                                let intervalEndMin = (dayStartOffsetMinutes + (k + 1) * thirtyMinInterval) % fullDayMinutes;

                                let comparisonIntervalEndMin = intervalEndMin;
                                if (comparisonIntervalEndMin < intervalStartMin) {
                                    comparisonIntervalEndMin += fullDayMinutes;
                                }

                                const currentInterval = {
                                    start: `${String(Math.floor(intervalStartMin / 60)).padStart(2, '0')}:${String(intervalStartMin % 60).padStart(2, '0')}`,
                                    end: `${String(Math.floor(intervalEndMin / 60)).padStart(2, '0')}:${String(intervalEndMin % 60).padStart(2, '0')}`
                                };
                                if (currentInterval.end === "00:00" && intervalEndMin !== 0) {
                                    currentInterval.end = "24:00";
                                }


                                let isAvailable = false;
                                let originalRange = null;

                                for (const range of visualAvailabilities) {
                                    if (doTimeRangesOverlap(currentInterval, range)) {
                                        isAvailable = true;
                                        originalRange = range;
                                        break;
                                    }
                                }

                                const segmentsToRender = getAvailabilitySegments(currentInterval.start, currentInterval.end);

                                segmentsToRender.forEach(segment => {
                                    const highlightSegment = document.createElement('div');
                                    highlightSegment.classList.add('availability-highlight-segment');

                                    const segmentText = document.createElement('span'); // Élément pour le texte
                                    segmentText.classList.add('availability-segment-text');

                                    if (isAvailable && dailyAvailabilities.length > 0) {
                                        highlightSegment.classList.add('available');
                                        highlightSegment.title = `Disponible: ${originalRange.start} - ${originalRange.end}`;
                                        segmentText.textContent = `${originalRange.start} - ${originalRange.end}`; // Texte pour les segments disponibles
                                    } else {
                                        highlightSegment.classList.add('unavailable');
                                        highlightSegment.title = `Indisponible: ${currentInterval.start} - ${currentInterval.end}`;
                                        segmentText.textContent = `${currentInterval.start} - ${currentInterval.end}`; // Texte pour les segments indisponibles (intervalle de 30 min)
                                    }
                                    highlightSegment.style.left = `${segment.left}%`;
                                    highlightSegment.style.width = `${segment.width}%`;
                                    highlightSegment.appendChild(segmentText); // Ajouter le texte au segment
                                    availabilityBarBase.appendChild(highlightSegment);
                                });
                            }

                            slot.appendChild(createTooltipForAvailabilityBar(dailyAvailabilities, dailyAvailabilities.length === 0)); // Passer true si pas de dispo
                            
                            const removeBtn = slot.querySelector('.remove-agent-btn');
                            removeBtn.addEventListener('click', async (e) => {
                            e.stopPropagation();
                            appData[dateKey].onDutyAgents[i] = 'none';
                            await saveDailyRoster(dateKey);
                            renderPersonnelLists();
                            renderOnDutyAgentsGrid();
                            renderRosterGrid();
                            });

                        } else {
                            slot.textContent = `Astreinte ${i+1}`;
                        }
                    } else {
                        slot.textContent = `Astreinte ${i+1}`;
                    }
                    onDutyAgentsGrid.appendChild(slot);
                }
            }

            // Nouvelle fonction pour créer le tooltip d'affichage des plages complètes
            function createTooltipForAvailabilityBar(dailyAvailabilities, showUnavailable = false) {
                const tooltip = document.createElement('div');
                tooltip.classList.add('availability-bar-tooltip');
                tooltip.style.display = 'none';

                if (dailyAvailabilities.length > 0) {
                    const ul = document.createElement('ul');
                    ul.innerHTML += '<li><strong>Disponibilités:</strong></li>';
                    dailyAvailabilities.forEach(range => {
                        const li = document.createElement('li');
                        li.textContent = `${range.start} - ${range.end}`;
                        ul.appendChild(li);
                    });
                    tooltip.appendChild(ul);
                } else if (showUnavailable) {
                    const p = document.createElement('p');
                    p.textContent = 'Agent indisponible toute la journée.';
                    tooltip.appendChild(p);
                } else {
                    const p = document.createElement('p');
                    p.textContent = 'Aucune disponibilité renseignée.';
                    tooltip.appendChild(p);
                }

                const parentItem = tooltip.closest('.available-personnel-item') || tooltip.closest('.on-duty-slot');
                if (parentItem) {
                    parentItem.addEventListener('mouseenter', () => {
                        tooltip.style.display = 'block';
                    });
                    parentItem.addEventListener('mouseleave', () => {
                        tooltip.style.display = 'none';
                    });
                }

                return tooltip;
            }


            async function updateDateDisplay() {
            showSpinner();
            const dateKey = formatDateToYYYYMMDD(currentRosterDate);
            await fetchAllAgents(); 
            await loadRosterConfig(dateKey);
            await loadDailyRoster(dateKey); 
            await loadAllPersonnelAvailabilities(); // Ceci doit charger les dispo pour TOUS les agents
            initializeDefaultTimeSlotsForDate(dateKey); // S'assure qu'au moins un créneau par défaut existe

            rosterDateInput.valueAsDate = currentRosterDate;
            renderTimeSlotButtons(dateKey);
            renderPersonnelLists(); // Appel pour rafraîchir la liste des agents disponibles
            renderOnDutyAgentsGrid(); // Appel pour rafraîchir la grille des agents d'astreinte
            renderRosterGrid();
            hideSpinner();
            }

            // --------------------------------------------------
            // 4️⃣ Handlers & Bootstrap
            // --------------------------------------------------

            /**
             * Affiche une modale pour sélectionner une plage horaire.
             * @param {string} currentStart - Heure de début par défaut (HH:MM).
             * @param {string} currentEnd - Heure de fin par défaut (HH:MM).
             * @param {function(string, string)} callback - Fonction appelée avec les nouvelles heures (start, end) si l'utilisateur valide.
             */
            function showTimeRangeSelectionModal(currentStart, currentEnd, callback) {
            let modal = document.getElementById('time-range-modal');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'time-range-modal';
                modal.classList.add('custom-modal');
                modal.innerHTML = `
                <div class="modal-content">
                    <h2>Définir la Plage Horaire</h2>
                    <div class="modal-form-group">
                    <label for="start-time">Heure de début:</label>
                    <select id="start-time"></select>
                    </div>
                    <div class="modal-form-group">
                    <label for="end-time">Heure de fin:</label>
                    <select id="end-time"></select>
                    </div>
                    <div class="modal-actions">
                    <button id="cancel-time-range" class="btn btn-secondary">Annuler</button>
                    <button id="save-time-range" class="btn btn-primary">Enregistrer</button>
                    </div>
                </div>
                `;
                document.body.appendChild(modal);
            }

            const startTimeSelect = modal.querySelector('#start-time');
            const endTimeSelect = modal.querySelector('#end-time');
            const saveButton = modal.querySelector('#save-time-range');
            const cancelButton = modal.querySelector('#cancel-time-range');

            startTimeSelect.innerHTML = '';
            endTimeSelect.innerHTML = '';

            const times = [];
            for (let h = 0; h < 24; h++) {
                for (let m = 0; m < 60; m += 30) {
                const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                times.push(timeStr);
                }
            }

            times.forEach(time => {
                const startOption = document.createElement('option');
                startOption.value = time;
                startOption.textContent = time;
                startTimeSelect.appendChild(startOption);

                const endOption = document.createElement('option');
                endOption.value = time;
                endOption.textContent = time;
                endTimeSelect.appendChild(endOption);
            });

            startTimeSelect.value = currentStart;
            endTimeSelect.value = currentEnd;

            modal.style.display = 'flex';

            saveButton.onclick = null;
            cancelButton.onclick = null;

            saveButton.onclick = () => {
                const newStart = startTimeSelect.value;
                const newEnd = endTimeSelect.value;
                modal.style.display = 'none';
                callback(newStart, newEnd);
            };

            cancelButton.onclick = () => {
                modal.style.display = 'none';
            };

            modal.onclick = (e) => {
                if (e.target === modal) {
                modal.style.display = 'none';
                }
            };
            }


            // Variables pour le drag & drop GLOBAL (entre listes et grille)
            let draggedAgentId = null;
            let draggedElement = null;

            function handleDragStart(e) {
            draggedAgentId = e.target.dataset.agentId;
            if (draggedAgentId) {
                e.dataTransfer.setData('text/plain', draggedAgentId);
                e.dataTransfer.effectAllowed = 'move';
                draggedElement = e.target;
                draggedElement.classList.add('dragging');
            } else {
                e.preventDefault();
                console.warn("Dragstart aborted (GLOBAL): No agentId found on element.", e.target);
            }
            }

            document.addEventListener('dragend', (e) => {
                if (draggedElement) {
                    draggedElement.classList.remove('dragging');
                    draggedElement = null;
                }
                draggedAgentId = null;
            });

            function handleDragOver(e) {
            e.preventDefault();
            const target = e.target.closest('.on-duty-slot') || 
                            e.target.closest('.roster-cell') || 
                            e.target.closest('.engine-case') || 
                            e.target.closest('.modal-role-slot') || 
                            e.target.closest('.modal-available-agent-slot') || 
                            e.target.closest('.assigned-agent-placeholder');
            
            if (target) {
                e.dataTransfer.dropEffect = 'move';
                if (!target.classList.contains('drag-over')) {
                target.classList.add('drag-over');
                }
            } else {
                e.dataTransfer.dropEffect = 'none';
            }
            }

            function handleDragLeave(e) {
            const target = e.target.closest('.on-duty-slot') || e.target.closest('.roster-cell') || e.target.closest('.engine-case') || e.target.closest('.modal-role-slot') || e.target.closest('.modal-available-agent-slot') || e.target.closest('.assigned-agent-placeholder');
            if (target) {
                target.classList.remove('drag-over');
            }
            }

            async function handleDropOnDuty(e) {
            e.preventDefault();
            const targetSlot = e.target.closest('.on-duty-slot');
            if (targetSlot) {
                targetSlot.classList.remove('drag-over');
            }

            if (!targetSlot) {
                console.warn("DropOnDuty: Target slot not found. Aborting.");
                return;
            }

            const slotIndex = parseInt(targetSlot.dataset.slotIndex);
            const dateKey = formatDateToYYYYMMDD(currentRosterDate);
            const agentId = e.dataTransfer.getData('text/plain');

            if (!agentId || agentId === 'none') {
                console.warn("DropOnDuty: Agent ID is missing or 'none'. Aborting drop.");
                return;
            }

            const existingIndex = appData[dateKey].onDutyAgents.indexOf(agentId);
            if (existingIndex !== -1 && existingIndex !== slotIndex) {
                appData[dateKey].onDutyAgents[existingIndex] = 'none';
            }
            
            const agentCurrentlyInSlot = appData[dateKey].onDutyAgents[slotIndex];
            if (agentCurrentlyInSlot && agentCurrentlyInSlot !== 'none' && agentCurrentlyInSlot !== agentId) {
            }

            if (appData[dateKey] && appData[dateKey].timeSlots) {
                Object.keys(appData[dateKey].timeSlots).forEach(sId => {
                    const currentSlotEngines = appData[dateKey].timeSlots[sId].engines;
                    if (currentSlotEngines) {
                        Object.keys(currentSlotEngines).forEach(eType => {
                            const personnel = currentSlotEngines[eType]?.personnel;
                            if (personnel) {
                                for (const roleId in personnel) {
                                    if (personnel[roleId] === agentId) {
                                        personnel[roleId] = 'none';
                                    }
                                }
                            }
                        });
                    }
                });
            }

            appData[dateKey].onDutyAgents[slotIndex] = agentId;
            await saveDailyRoster(dateKey);
            
            updateDateDisplay();
            
            draggedAgentId = null;
            }

            async function handleDropOnEngine(e) {
                e.preventDefault();
                const targetElement = e.target.closest('.engine-case') || e.target.closest('.roster-cell');
                if (targetElement) {
                    targetElement.classList.remove('drag-over');
                }

                const agentId = e.dataTransfer.getData('text/plain');
                const dateKey = formatDateToYYYYMMDD(currentRosterDate);

                if (!agentId || agentId === 'none') {
                    console.warn("DropOnEngine: Agent ID is missing or 'none'. Aborting drop.");
                    return;
                }
                if (!targetElement) {
                    console.warn("Drop non valide : pas sur un engin ou une cellule de roster.");
                    return;
                }

                const slotId = targetElement.dataset.slotId;
                const engineType = targetElement.dataset.engineType;

                if (!slotId || !engineType) {
                    console.warn("DropOnEngine: Missing slotId or engineType on targetElement.", targetElement);
                    return;
                }

                const onDutyAgents = appData[dateKey]?.onDutyAgents;
                if (onDutyAgents) {
                const onDutyIndex = onDutyAgents.indexOf(agentId);
                if (onDutyIndex !== -1) {
                    onDutyAgents[onDutyIndex] = 'none';
                    await saveDailyRoster(dateKey);
                }
                }


                const currentEngineAssignment = appData[dateKey]?.timeSlots?.[slotId]?.engines?.[engineType]?.personnel;
                if (!currentEngineAssignment) {
                    console.error(`Impossible de trouver l'affectation de l'engin pour ${engineType} dans le créneau ${slotId}.`);
                    return;
                }
                let assigned = false;

                const engineConfig = engineDetails[engineType];
                if (!engineConfig) {
                    console.error(`Configuration d'engin introuvable pour le type : ${engineType}`);
                    return;
                }

                const agentToAssign = allAgents.find(a => a._id === agentId);
                if (!agentToAssign) {
                    console.error("Agent à affecter non trouvé:", agentId);
                    return;
                }

                for (const roleDef of engineConfig.roles) {
                    const roleId = roleDef.id;
                    if (currentEngineAssignment[roleId] === 'none') {
                        if (isAgentQualifiedForRole(agentToAssign, roleId)) {
                            currentEngineAssignment[roleId] = agentId;
                            assigned = true;
                            break;
                        } else {
                        }
                    }
                }
                
                if (assigned) {
                await saveRosterConfig(dateKey);
                updateDateDisplay();
                } else {
                    displayMessageModal("Affectation Impossible", "L'agent n'a pas pu être affecté : aucun rôle libre ou l'agent n'est pas qualifié pour les rôles disponibles dans cet engin. Veuillez utiliser la modale de gestion détaillée si nécessaire.", "warning");
                    console.warn(`Agent ${agentId} could not be assigned to ${engineType}. All roles occupied or no suitable qualified role.`);
                }
                draggedAgentId = null;
            }


            function createOnDutySlots() {
            onDutyAgentsGrid.innerHTML = '';
            for (let i = 0; i < 10; i++) {
                const slot = document.createElement('div');
                slot.classList.add('on-duty-slot');
                slot.dataset.slotIndex = i;
                onDutyAgentsGrid.appendChild(slot);
            }
            }

            function displayEnginesForSlot(dateKey, slotId) {
            const rosterContent = document.querySelector('.roster-content');
            rosterContent.style.display = 'none';

            engineDetailsPage.style.display = 'block';

            const currentSlot = appData[dateKey]?.timeSlots?.[slotId];
            if (!currentSlot) {
                console.error("Créneau horaire non trouvé:", slotId);
                return;
            }

            const engineGridContainer = engineDetailsPage.querySelector('.engine-grid');
            engineGridContainer.innerHTML = '';

            Object.entries(currentSlot.engines || {}).forEach(([engineType, assignment]) => {
                const engineCase = document.createElement('div');
                engineCase.classList.add('engine-case');
                engineCase.dataset.slotId = slotId;
                engineCase.dataset.engineType = engineType;

                if (!assignment.personnel || typeof assignment.personnel !== 'object') {
                    assignment.personnel = createEmptyEngineAssignment(engineType);
                }
            
                const engConfig = engineDetails[engineType];
                if (!engConfig) {
                    console.warn(`Configuration d'engin introuvable pour le type : ${engineType}.`);
                    engineCase.textContent = "Erreur config";
                    engineGridContainer.appendChild(engineCase);
                    return; 
                }

                let isEngineIndispo = false;
                if (engConfig.criticalRoles) {
                    for (const criticalRoleId of engConfig.criticalRoles) {
                        const assignedAgentId = (assignment && assignment.personnel ? assignment.personnel[criticalRoleId] : undefined);
                        const assignedAgent = allAgents.find(a => a._id === assignedAgentId);

                        if (!assignedAgentId || assignedAgentId === 'none' || assignedAgentId === null ||
                            (assignedAgent && !isAgentQualifiedForRole(assignedAgent, criticalRoleId))) {
                            isEngineIndispo = true;
                            break;
                        }
                    }
                }

                engineCase.innerHTML = `
                <h3>${engConfig.name}</h3>
                <span class="places-count">${engConfig.roles.length} places</span>
                <ul class="personnel-list">
                    ${engConfig.roles.map(roleDef => {
                    const agentId = (assignment && assignment.personnel ? assignment.personnel[roleDef.id] : undefined);
                    const agent = allAgents.find(a => a._id === agentId);
                    const isQualified = agent && isAgentQualifiedForRole(agent, roleDef.id); 
                    const agentDisplay = agent && agentId !== 'none' ? `${agent.prenom} ${agent.nom}` : '-----------';
                    
                    let roleClass = '';
                    let roleTitle = '';
                    if (agentId !== 'none' && !isQualified) {
                        roleClass = 'unqualified-agent';
                        roleTitle = `Agent ${agent.prenom} ${agent.nom} non qualifié pour le rôle ${roleDef.name}`;
                    } else if (roleDef.required && (!agentId || agentId === 'none')) {
                        roleClass = 'missing-required-role';
                        roleTitle = `Rôle obligatoire ${roleDef.name} non pourvu.`;
                    }

                    return `<li class="${roleClass}" title="${roleTitle}"><strong>${roleDef.name}:</strong> ${agentDisplay}</li>`;
                    }).join('')}
                </ul>
                <button class="assign-engine-personnel-btn">Gérer le personnel</button>
                ${isEngineIndispo ? '<div class="engine-indispo-overlay">INDISPO</div>' : ''} `;
                engineCase.querySelector('.assign-engine-personnel-btn').addEventListener('click', () => {
                openPersonnelAssignmentModal(dateKey, slotId, engineType);
                });

                engineCase.addEventListener('dragover', handleDragOver);
                engineCase.addEventListener('dragleave', handleDragLeave);
                engineCase.addEventListener('drop', handleDropOnEngine);

                engineGridContainer.appendChild(engineCase);
            });
            }

            // --------------------------------------------------
            // 5️⃣ Nouvelle Modale d'affectation du personnel aux engins
            // --------------------------------------------------

            function openPersonnelAssignmentModal(dateKey, slotId, engineType) {
                const currentSlot = appData[dateKey].timeSlots[slotId];
                if (!currentSlot) {
                    console.error("Créneau horaire introuvable pour la modale:", slotId);
                    return;
                }
                const currentEngine = currentSlot.engines[engineType];
                if (!currentEngine) {
                    console.error("Engin introuvable pour la modale:", engineType);
                    return;
                }

                const engineConfig = engineDetails[engineType];
                if (!engineConfig) {
                    console.error(`Configuration d'engin introuvable pour le type : ${engineType}.`);
                    return;
                }

                personnelAssignmentModalTitle.textContent = `Affecter le personnel pour ${engineConfig.name} (${currentSlot.range})`;
                availableAgentsInModalList.innerHTML = '';
                engineRolesContainer.innerHTML = '';

                const onDutyAgents = appData[dateKey]?.onDutyAgents.filter(id => id !== 'none').map(id => allAgents.find(a => a._id === id));
                
                const assignedAgentsInThisEngine = Object.values(currentEngine.personnel || {}).filter(id => id !== 'none');

                const agentsForModal = onDutyAgents.filter(agent => agent && !assignedAgentsInThisEngine.includes(agent._id));

                if (agentsForModal.length === 0) {
                    availableAgentsInModalList.innerHTML = '<p class="no-available-personnel-modal">Aucun agent d\'astreinte disponible pour l\'affectation à cet engin.</p>';
                } else {
                    agentsForModal.forEach(agent => {
                        const agentDiv = document.createElement('div');
                        agentDiv.classList.add('modal-available-agent-slot');
                        agentDiv.dataset.agentId = agent._id;
                        agentDiv.setAttribute('draggable', true);
                        agentDiv.addEventListener('dragstart', handleModalDragStart);
                        agentDiv.textContent = `${agent.prenom} ${agent.nom}`;
                        availableAgentsInModalList.appendChild(agentDiv);
                    });
                }

                engineConfig.roles.forEach(roleDef => {
                    const roleDiv = document.createElement('div');
                    roleDiv.classList.add('modal-role-slot');
                    roleDiv.dataset.role = roleDef.id;
                    roleDiv.dataset.slotId = slotId;
                    roleDiv.dataset.engineType = engineType;

                    const agentIdInRole = currentEngine.personnel[roleDef.id];
                    const agentInRole = allAgents.find(a => a._id === agentIdInRole);

                    const isQualified = agentInRole && isAgentQualifiedForRole(agentInRole, roleDef.id); 

                    let placeholderContent;
                    let placeholderClasses = ['assigned-agent-placeholder'];
                    let roleNameClasses = ['role-name'];

                    if (agentIdInRole !== 'none') {
                        placeholderClasses.push('filled');
                        let agentSpanClasses = ['assigned-agent-name'];
                        let agentSpanTitle = '';
                        if (!isQualified) {
                            agentSpanClasses.push('unqualified-agent-modal');
                            agentSpanTitle = `Non qualifié pour ce rôle (${roleDef.name})`;
                        }
                        placeholderContent = `
                            <span class="${agentSpanClasses.join(' ')}" data-agent-id="${agentInRole._id}" draggable="true" title="${agentSpanTitle}">${agentInRole.prenom} ${agentInRole.nom}</span>
                            <button class="remove-assigned-agent-btn">x</button>
                        `;
                    } else {
                        placeholderContent = 'Glisser un agent ici';
                        if (roleDef.required) {
                            roleNameClasses.push('required-role');
                            placeholderContent = `Glisser un agent ici (Obligatoire)`;
                        }
                    }
                    
                    roleDiv.innerHTML = `
                        <span class="${roleNameClasses.join(' ')}">${roleDef.name}${roleDef.required ? '*' : ''}:</span>
                        <div class="${placeholderClasses.join(' ')}" 
                            data-current-agent-id="${agentIdInRole || 'none'}">
                            ${placeholderContent}
                        </div>
                    `;
                    
                    const placeholder = roleDiv.querySelector('.assigned-agent-placeholder');
                    placeholder.addEventListener('dragover', handleDragOver);
                    placeholder.addEventListener('dragleave', handleDragLeave);
                    placeholder.addEventListener('drop', (e) => handleModalDropOnRole(e, dateKey, slotId, engineType, roleDef.id));

                    const assignedAgentSpan = roleDiv.querySelector('.assigned-agent-name');
                    if (assignedAgentSpan) {
                        assignedAgentSpan.addEventListener('dragstart', handleModalDragStart);
                    }

                    const removeBtn = roleDiv.querySelector('.remove-assigned-agent-btn');
                    if (removeBtn) {
                        removeBtn.addEventListener('click', () => {
                            currentEngine.personnel[roleDef.id] = 'none';
                            savePersonnelAssignments(dateKey);
                            openPersonnelAssignmentModal(dateKey, slotId, engineType);
                        });
                    }

                    engineRolesContainer.appendChild(roleDiv);
                });

                personnelAssignmentModal.style.display = 'flex';
            }

            function handleModalDragStart(e) {
                const agentId = e.target.dataset.agentId;
                if (agentId) {
                    e.dataTransfer.setData('text/plain', agentId);
                    e.dataTransfer.effectAllowed = 'move';
                    e.target.classList.add('dragging-modal');
                } else {
                    e.preventDefault();
                    console.warn("Modal Dragstart aborted: No agentId found on element.", e.target);
                }
            }

            personnelAssignmentModal.addEventListener('dragend', (e) => {
                const draggedModalElement = document.querySelector('.dragging-modal');
                if (draggedModalElement) {
                    draggedModalElement.classList.remove('dragging-modal');
                }
            });


            async function handleModalDropOnRole(e, dateKey, slotId, engineType, targetRoleId) {
                e.preventDefault();
                const placeholder = e.target.closest('.assigned-agent-placeholder');
                if (placeholder) {
                    placeholder.classList.remove('drag-over');
                }

                const newAgentId = e.dataTransfer.getData('text/plain');
                if (!newAgentId || newAgentId === 'none') {
                    console.warn("handleModalDropOnRole: Agent ID is missing or 'none'. Aborting drop.");
                    return;
                }

                const agentToAssign = allAgents.find(a => a._id === newAgentId);
                if (!agentToAssign) {
                    console.error("Agent non trouvé pour l'affectation:", newAgentId);
                    return;
                }

                if (!isAgentQualifiedForRole(agentToAssign, targetRoleId)) {
                    const roleName = engineDetails[engineType]?.roles.find(r => r.id === targetRoleId)?.name || targetRoleId;
                    displayMessageModal("Qualification Requise", `L'agent ${agentToAssign.prenom} ${agentToAssign.nom} n'a pas la qualification requise pour le rôle "${roleName}".`, "error");
                    return;
                }

                const currentEnginePersonnel = appData[dateKey].timeSlots[slotId].engines[engineType].personnel;

                // Retirer l'agent de tous les autres rôles dans CET engin (pour éviter qu'il occupe plusieurs rôles dans le même engin)
                for (const roleIdInEngine in currentEnginePersonnel) {
                    if (currentEnginePersonnel[roleIdInEngine] === newAgentId) {
                        currentEnginePersonnel[roleIdInEngine] = 'none';
                        break; // Supprime une seule fois si l'agent est trouvé
                    }
                }

                // Assigner l'agent au nouveau rôle
                currentEnginePersonnel[targetRoleId] = newAgentId;

                await saveRosterConfig(dateKey);
                // On rafraîchit la modale pour refléter les changements
                openPersonnelAssignmentModal(dateKey, slotId, engineType);
                // On rafraîchit l'affichage principal
                updateDateDisplay();
            }


            // --- Fonctions de fermeture de la modale ---
            closePersonnelAssignmentModalBtn.addEventListener('click', () => {
                personnelAssignmentModal.style.display = 'none';
                showMainRosterGrid();
            });
            personnelAssignmentModal.addEventListener('click', (e) => {
                if (e.target === personnelAssignmentModal) {
                    personnelAssignmentModal.style.display = 'none';
                    showMainRosterGrid();
                }
            });


            async function savePersonnelAssignments(dateKey) {
            const currentKey = dateKey || formatDateToYYYYMMDD(currentRosterDate);
            await saveRosterConfig(currentKey);
            updateDateDisplay();
            }


            function assignPersonnelToSlot(dateKey, slotId) { // Ajout de slotId comme paramètre
            if (!appData[dateKey]) {
                console.warn("assignPersonnelToSlot: Pas de données de roster pour la date spécifiée.");
                return;
            }
            const currentSlot = appData[dateKey].timeSlots[slotId];
            if (!currentSlot) {
                console.warn("assignPersonnelToSlot: Créneau horaire non trouvé:", slotId);
                return;
            }

            const onDutyAgents = appData[dateKey].onDutyAgents.filter(id => id !== 'none');

            // Réinitialiser les affectations pour ce créneau/engin avant de réassigner
            Object.keys(currentSlot.engines).forEach(engineType => {
                Object.keys(currentSlot.engines[engineType].personnel).forEach(roleId => {
                    currentSlot.engines[engineType].personnel[roleId] = 'none';
                });
            });

            // Créer une copie triée des agents d'astreinte disponibles pour l'affectation automatique
            // Triage: agents avec plus de qualifications en premier, puis par ID (ou nom)
            const availableAgentsForAuto = [...onDutyAgents].sort((aId1, aId2) => {
                const agent1 = allAgents.find(a => a._id === aId1);
                const agent2 = allAgents.find(a => a._id === aId2);
                return (agent2?.qualifications?.length || 0) - (agent1?.qualifications?.length || 0); // Plus de qualifs en premier
            });


            // Trier les types d'engin : ceux avec le plus de rôles critiques en premier, puis le plus de rôles au total
            const sortedEngineTypes = Object.keys(engineDetails).sort((a, b) => {
                const criticalA = engineDetails[a].criticalRoles?.length || 0;
                const criticalB = engineDetails[b].criticalRoles?.length || 0;
                const rolesA = engineDetails[a].roles?.length || 0;
                const rolesB = engineDetails[b].roles?.length || 0;
                return (criticalB - criticalA) || (rolesB - rolesA); // Plus de rôles critiques, puis plus de rôles au total
            });

            sortedEngineTypes.forEach(engineType => {
                const rolesForEngine = engineDetails[engineType].roles;
                // Trier les rôles : critiques/obligatoires en premier
                rolesForEngine.sort((rA, rB) => {
                    const isCriticalA = engineDetails[engineType].criticalRoles?.includes(rA.id);
                    const isCriticalB = engineDetails[engineType].criticalRoles?.includes(rB.id);
                    const isRequiredA = rA.required;
                    const isRequiredB = rB.required;

                    // Priorité 1: Rôles critiques ET obligatoires
                    if (isCriticalA && isRequiredA && (!isCriticalB || !isRequiredB)) return -1;
                    if ((!isCriticalA || !isRequiredA) && isCriticalB && isRequiredB) return 1;
                    // Priorité 2: Rôles obligatoires (si pas déjà géré par P1)
                    if (isRequiredA && !isRequiredB) return -1;
                    if (!isRequiredA && isRequiredB) return 1;
                    // Priorité 3: Rôles critiques (si pas déjà géré par P1/P2)
                    if (isCriticalA && !isCriticalB) return -1;
                    if (!isCriticalA && isCriticalB) return 1;
                    return 0; // Pas de différence de priorité
                }).forEach(roleDef => {
                    const roleId = roleDef.id;
                    if (availableAgentsForAuto.length > 0) {
                        let bestAgentIndex = -1;
                        // Trouver le meilleur agent qualifié DANS la liste des agents disponibles
                        for (let i = 0; i < availableAgentsForAuto.length; i++) {
                            const agent = allAgents.find(a => a._id === availableAgentsForAuto[i]);
                            if (agent && isAgentQualifiedForRole(agent, roleId)) {
                                bestAgentIndex = i;
                                break;
                            }
                        }

                        let agentToAssignId;
                        if (bestAgentIndex !== -1) {
                            // Supprimer l'agent de la liste des disponibles une fois affecté
                            agentToAssignId = availableAgentsForAuto.splice(bestAgentIndex, 1)[0];
                        } else if (!roleDef.required) {
                            // Si le rôle n'est pas obligatoire et aucun qualifié, prendre le premier disponible
                            agentToAssignId = availableAgentsForAuto.shift(); 
                            const agent = allAgents.find(a => a._id === agentToAssignId);
                            if (agent) {
                                console.warn(`Génération auto: Aucun agent qualifié trouvé pour le rôle '${roleId}' dans l'engin '${engineType}'. Agent '${agent.prenom} ${agent.nom}' affecté sans qualification spécifique (rôle non obligatoire).`);
                            }
                        } else {
                            console.warn(`Génération auto: Rôle obligatoire '${roleId}' dans l'engin '${engineType}' n'a pas pu être pourvu par un agent qualifié ou un agent du tout.`);
                        }
                        
                        if (agentToAssignId) {
                            currentSlot.engines[engineType].personnel[roleId] = agentToAssignId;
                        }
                    } else {
                        console.warn(`Génération auto: Plus d'agents disponibles pour affecter le rôle '${roleId}' dans l'engin '${engineType}'.`);
                    }
                });
            });
            }

            async function generateAutomaticRoster(dateKey) {
            if (!appData[dateKey]) {
                console.warn("Pas de données de roster pour la date spécifiée. Impossible de générer automatiquement.");
                return;
            }
            showSpinner();
            // Réinitialiser les affectations de tous les engins pour tous les créneaux de la date
            Object.keys(appData[dateKey].timeSlots).forEach(slotId => {
                Object.keys(appData[dateKey].timeSlots[slotId].engines).forEach(engineType => {
                    appData[dateKey].timeSlots[slotId].engines[engineType].personnel = createEmptyEngineAssignment(engineType);
                });
            });


            Object.keys(appData[dateKey].timeSlots).forEach(slotId => {
                assignPersonnelToSlot(dateKey, slotId);
            });
            await saveRosterConfig(dateKey);
            await saveDailyRoster(dateKey); // Sauvegarde également les agents d'astreinte après la génération
            updateDateDisplay();
            hideSpinner();
            }

            function showMainRosterGrid() {
            engineDetailsPage.style.display = 'none';
            document.querySelector('.roster-content').style.display = 'block';
            document.querySelectorAll('.time-slot-button').forEach(b => b.classList.remove('active'));
            }


            document.addEventListener('DOMContentLoaded', async () => {
            // Inject custom CSS
            const styleElement = document.createElement('style');
            styleElement.textContent = inlineCss;
            document.head.appendChild(styleElement);

            const role = sessionStorage.getItem("userRole");
            if (role !== "admin") {
                // Rediriger si l'utilisateur n'est pas admin, en effaçant le token
                sessionStorage.clear();
                return window.location.href = "index.html";
            }

            rosterDateInput.valueAsDate = currentRosterDate;

            prevDayButton.addEventListener('click', async () => {
                currentRosterDate.setDate(currentRosterDate.getDate() - 1);
                await updateDateDisplay();
            });
            nextDayButton.addEventListener('click', async () => {
                currentRosterDate.setDate(currentRosterDate.getDate() + 1);
                await updateDateDisplay();
            });

            rosterDateInput.addEventListener('change', async (e) => {
                currentRosterDate = e.target.valueAsDate;
                await updateDateDisplay();
            });

            generateAutoBtn.addEventListener('click', async () => {
                const confirmed = await confirm("Générer automatiquement ce planning ? Cela écrasera les affectations manuelles et pourra modifier les agents d'astreinte.");
                if (confirmed) {
                await generateAutomaticRoster(formatDateToYYYYMMDD(currentRosterDate));
                displayMessageModal("Génération Automatique", "Le planning a été généré automatiquement avec succès.", "success");
                }
            });

            backToRosterBtn.addEventListener('click', showMainRosterGrid);

            createOnDutySlots(); // Cela initialise la grille d'astreinte

            // Appel de updateDateDisplay pour charger les données et rendre l'interface dès le chargement de la page
            await updateDateDisplay(); 

            showMainRosterGrid(); // Affiche la grille principale après chargement initial complet.
            });

            // Fonctions utilitaires de la modale (qui étaient en commentaire dans les versions précédentes)
            function minutesToHeure(mins) {
                const h = Math.floor(mins / 60).toString().padStart(2, '0');
                const m = (mins % 60).toString().padStart(2, '0');
                return h + ':' + m;
            }

            // La fonction displayMessageModal est présente ici pour assurer sa disponibilité.
            function displayMessageModal(title, message, type = "info", callback = null) {
                let modal = document.getElementById('custom-message-modal');
                if (!modal) {
                    modal = document.createElement('div');
                    modal.id = 'custom-message-modal';
                    modal.className = 'modal-overlay';
                    document.body.appendChild(modal);

                    // Styles CSS pour la modale (vous pouvez les déplacer dans un fichier CSS)
                    const modalCss = `
                        .modal-overlay {
                            position: fixed;
                            top: 0;
                            left: 0;
                            width: 100%;
                            height: 100%;
                            background-color: rgba(0, 0, 0, 0.6);
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            z-index: 1000;
                            font-family: 'Inter', sans-serif;
                        }
                        .modal-content {
                            background-color: #fff;
                            padding: 25px 35px;
                            border-radius: 12px;
                            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
                            width: 90%;
                            max-width: 450px;
                            animation: fadeIn 0.3s ease-out;
                            display: flex;
                            flex-direction: column;
                            gap: 20px;
                        }
                        .modal-header {
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                            border-bottom: 1px solid #eee;
                            padding-bottom: 15px;
                            margin-bottom: 15px;
                        }
                        .modal-header h2 {
                            margin: 0;
                            color: #333;
                            font-size: 1.5em;
                        }
                        .modal-body {
                            color: #555;
                            font-size: 1em;
                            line-height: 1.6;
                        }
                        .modal-footer {
                            display: flex;
                            justify-content: flex-end;
                            gap: 10px;
                            padding-top: 15px;
                            border-top: 1px solid #eee;
                            margin-top: 15px;
                        }
                        .btn {
                            padding: 10px 20px;
                            border: none;
                            border-radius: 8px;
                            cursor: pointer;
                            font-size: 0.95em;
                            font-weight: 500;
                            transition: background-color 0.2s ease, transform 0.1s ease;
                        }
                        .btn-primary {
                            background-color: #007bff;
                            color: white;
                        }
                        .btn-primary:hover {
                            background-color: #0056b3;
                            transform: translateY(-1px);
                        }
                        .btn-secondary {
                            background-color: #6c757d;
                            color: white;
                        }
                        .btn-secondary:hover {
                            background-color: #5a6268;
                            transform: translateY(-1px);
                        }
                        .modal-icon {
                            font-size: 2em;
                            margin-right: 15px;
                            align-self: flex-start;
                        }
                        .modal-icon.info { color: #007bff; }
                        .modal-icon.success { color: #28a745; }
                        .modal-icon.warning { color: #ffc107; }
                        .modal-icon.error { color: #dc3545; }
                        .modal-icon.question { color: #6c757d; }

                        @keyframes fadeIn {
                            from { opacity: 0; transform: scale(0.9); }
                            to { opacity: 1; transform: scale(1); }
                        }
                    `;
                    const styleSheet = document.createElement("style");
                    styleSheet.type = "text/css";
                    styleSheet.innerText = modalCss;
                    document.head.appendChild(styleSheet);
                }

                let iconHtml = '';
                switch (type) {
                    case 'info': iconHtml = '💡'; break;
                    case 'success': iconHtml = '✅'; break;
                    case 'warning': iconHtml = '⚠️'; break;
                    case 'error': iconHtml = '❌'; break;
                    case 'question': iconHtml = '❓'; break;
                }

                modal.innerHTML = `
                    <div class="modal-content">
                        <div class="modal-header">
                            <span class="modal-icon ${type}">${iconHtml}</span>
                            <h2>${title}</h2>
                        </div>
                        <div class="modal-body">
                            <p>${message}</p>
                        </div>
                        <div class="modal-footer">
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
            // Remplacement des fonctions natives alert et confirm pour utiliser les modales personnalisées
            // Ces lignes étaient déjà présentes à la fin du fichier, je les laisse telles quelles
            // pour garantir qu'elles prennent le dessus sur les fonctions natives.
            window.confirm = (message) => {
                return new Promise((resolve) => {
                    displayMessageModal("Confirmation", message, "question", (result) => {
                        resolve(result);
                    });
                });
            };
            window.alert = (message) => {
                displayMessageModal("Information", message, "info");
            };
