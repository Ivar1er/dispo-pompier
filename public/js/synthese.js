// synthese.js

// Jours de la semaine
const days = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
// Récupère l'ID de l'agent depuis le sessionStorage (doit être défini lors de la connexion)
const agent = sessionStorage.getItem("agent");
// URL de base de votre API
const API_BASE_URL = "https://dispo-pompier.onrender.com";

// Références aux éléments DOM de la page synthese.html
const weekSelect = document.getElementById("week-select");
const planningContainer = document.getElementById("planning-container");
const headerHours = document.getElementById("header-hours");
const noPlanningMessage = document.getElementById("no-planning-message");
const loadingSpinner = document.getElementById("loading-spinner");

// --- Fonctions de modales (copiées de agent.js pour une cohérence des messages utilisateur) ---

/**
 * Affiche une modale de message personnalisée.
 * @param {string} title - Titre de la modale.
 * @param {string} message - Message à afficher.
 * @param {'info'|'success'|'error'|'warning'|'question'} type - Type de message pour le style.
 * @param {function(boolean)} [callback] - Fonction de rappel pour les confirmations (true si OK, false si Annuler/clic extérieur).
 */
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
            <div class="modal-actions">
                ${callback ? '<button id="modal-cancel-btn" class="btn btn-secondary">Annuler</button>' : ''}
                <button id="modal-ok-btn" class="btn btn-primary">OK</button>
            </div>
        </div>
    `;

    modal.style.display = 'flex'; // Affiche la modale

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

    // Gère le clic en dehors de la modale pour la fermer
    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
            if (callback) callback(false); // Si c'était une confirmation, considérer comme annulation
        }
    };
}

/**
 * Fonction asynchrone pour simuler confirm() avec la modale personnalisée.
 * @param {string} message - Message de confirmation.
 * @returns {Promise<boolean>} Une promesse qui se résout avec true si l'utilisateur confirme, false sinon.
 */
async function confirmModal(message) {
    return new Promise((resolve) => {
        displayMessageModal("Confirmation", message, "question", (result) => {
            resolve(result);
        });
    });
}
// Remplace les fonctions globales alert et confirm par nos modales personnalisées
window.alert = displayMessageModal.bind(null, "Information");
window.confirm = confirmModal;


// --- Fonctions utilitaires pour les semaines et les heures ---

/**
 * Calcule le numéro de semaine ISO 8601 pour une date donnée.
 * @param {Date} date - La date à utiliser.
 * @returns {number} Le numéro de la semaine ISO.
 */
function getCurrentISOWeek(date = new Date()) {
  const _date = new Date(date.getTime());
  _date.setHours(0, 0, 0, 0);
  _date.setDate(_date.getDate() + 3 - ((_date.getDay() + 6) % 7)); // Ajuste au jeudi de la semaine
  const week1 = new Date(_date.getFullYear(), 0, 4); // Le 4 janvier est toujours dans la première semaine ISO de l'année
  return (
    1 +
    Math.round(
      ((_date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7
    )
  );
}

/**
 * Obtient la plage de dates (début et fin) pour un numéro de semaine donné dans l'année courante.
 * Cette fonction a été revue pour s'assurer qu'elle génère des dates valides.
 * @param {number} weekNumber - Le numéro de la semaine.
 * @param {number} [year=new Date().getFullYear()] - L'année.
 * @returns {string} La plage de dates formatée (ex: "du 01/01 au 07/01").
 */
function getWeekDateRange(weekNumber, year = new Date().getFullYear()) {
    // Crée une date pour le 4 janvier de l'année, qui est toujours dans la première semaine ISO
    const jan4 = new Date(year, 0, 4);
    // Trouve le jour de la semaine du 4 janvier (0=Dimanche, 1=Lundi...)
    // Et ajuste pour trouver le lundi de la première semaine ISO
    const firstMonday = new Date(jan4.setDate(jan4.getDate() - (jan4.getDay() === 0 ? 6 : jan4.getDay() - 1)));

    // Calcule le début de la semaine spécifiée
    const startOfWeek = new Date(firstMonday);
    startOfWeek.setDate(firstMonday.getDate() + (weekNumber - 1) * 7);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // La fin de la semaine est 6 jours après le début

    const format = date => date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
    return `du ${format(startOfWeek)} au ${format(endOfWeek)}`;
}


/**
 * Convertit une chaîne de temps "HH:MM" en nombre de minutes depuis minuit.
 * @param {string} timeStr - La chaîne de temps (ex: "08:30").
 * @returns {number} Le nombre total de minutes.
 */
function timeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}

/**
 * Convertit un nombre de minutes depuis minuit en chaîne de temps "HH:MM".
 * @param {number} totalMinutes - Le nombre total de minutes.
 * @returns {string} La chaîne de temps formatée (ex: "08:30").
 */
function minutesToTime(totalMinutes) {
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

// --- Logique principale au chargement du DOM ---
document.addEventListener("DOMContentLoaded", async () => {
  // Vérifie si un agent est connecté, sinon redirige vers la page de connexion
  // Si 'agent' est 'admin', l'accès est aussi refusé car cette page est pour les agents.
  if (!agent || agent === "admin") {
    displayMessageModal("Accès non autorisé", "Vous devez être connecté en tant qu’agent.", "error", () => {
        window.location.href = "index.html";
    });
    return;
  }

  showLoading(true); // Affiche le spinner de chargement

  try {
    // Récupère le planning complet de l'agent depuis l'API
    // L'API est censée retourner un objet structuré comme : { "week-X": { "day": [{ "start": "HH:MM", "end": "HH:MM" }] } }
    // Ajout d'un en-tête 'X-User-ID' si votre API l'utilise pour l'autorisation
    // Ou si vous avez un token d'auth, ce serait 'Authorization': 'Bearer votre_token'
    const response = await fetch(`${API_BASE_URL}/api/planning/${agent}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'X-User-ID': agent // Exemple d'en-tête, à adapter selon votre API
            // Si vous utilisez un token JWT: 'Authorization': `Bearer ${sessionStorage.getItem('jwtToken')}`
        }
    });

    if (!response.ok) {
        // Gérer les erreurs HTTP comme 401, 403, 404, 500
        const errorData = await response.json();
        throw new Error(errorData.message || `Erreur HTTP: ${response.status} ${response.statusText}`);
    }

    const planningDataAgent = await response.json();

    // Si aucun planning n'est disponible pour l'agent, affiche un message
    if (!Object.keys(planningDataAgent).length) {
      noPlanningMessage.classList.remove("hidden");
      planningContainer.innerHTML = ""; // Vide le tableau de planning
      headerHours.innerHTML = ""; // Vide l'en-tête des heures
      weekSelect.innerHTML = "<option value=''>Aucune semaine disponible</option>";
      weekSelect.disabled = true; // Désactive le sélecteur
      return;
    } else {
      noPlanningMessage.classList.add("hidden"); // Cache le message si des données existent
      weekSelect.disabled = false; // Active le sélecteur
    }

    // Extrait toutes les clés de semaine ("week-X") des données de planning
    const weekKeys = Object.keys(planningDataAgent).filter(key => key.startsWith("week-"));
    // Convertit les clés en numéros de semaine et filtre les invalides
    const weekNums = weekKeys.map(key => Number(key.split("-")[1])).filter(num => !isNaN(num));

    // Remplit le sélecteur de semaine
    weekSelect.innerHTML = ""; // Vide les options existantes
    // Trie les semaines numériquement et crée une option pour chacune
    weekNums.sort((a, b) => a - b).forEach(week => {
      const option = document.createElement("option");
      option.value = `week-${week}`;
      option.textContent = `Semaine ${week} (${getWeekDateRange(week)})`;
      weekSelect.appendChild(option);
    });

    // Détermine la semaine à afficher au démarrage
    // Priorité: 1. Semaine stockée en session, 2. Première semaine disponible, 3. Semaine actuelle ISO
    let selectedWeekKey = sessionStorage.getItem("selectedWeek");
    if (!selectedWeekKey || !weekKeys.includes(selectedWeekKey)) {
      selectedWeekKey = weekKeys.length > 0 ? weekKeys[0] : `week-${getCurrentISOWeek()}`;
      // Si la semaine actuelle n'est pas dans les données, mais qu'il y a des données, prendre la première semaine disponible
      if (!weekKeys.includes(selectedWeekKey) && weekKeys.length > 0) {
          selectedWeekKey = weekKeys[0];
      }
    }
    weekSelect.value = selectedWeekKey; // Sélectionne l'option dans le sélecteur

    // Affiche le planning pour la semaine sélectionnée
    updateDisplay(selectedWeekKey, planningDataAgent);

    // Ajoute un écouteur d'événements pour le changement de semaine dans le sélecteur
    weekSelect.addEventListener("change", () => {
      sessionStorage.setItem("selectedWeek", weekSelect.value); // Met à jour la semaine en session
      updateDisplay(weekSelect.value, planningDataAgent); // Met à jour l'affichage
    });

  } catch (err) {
    console.error("Erreur lors du chargement :", err);
    // Afficher un message d'erreur plus spécifique à l'utilisateur
    displayMessageModal("Erreur de Chargement", `Erreur lors du chargement du planning : ${err.message}. Veuillez réessayer ou vérifier vos accès.`, "error");
    noPlanningMessage.classList.remove("hidden"); // Affiche le message d'erreur utilisateur
  } finally {
    showLoading(false); // Cache le spinner de chargement
  }
});

/**
 * Fonction de mise à jour de l'affichage du planning.
 * @param {string} weekKey - La clé de la semaine à afficher (ex: "week-25").
 * @param {object} planningData - L'objet complet des données de planning de l'agent.
 */
function updateDisplay(weekKey, planningData) {
  showWeek(weekKey, planningData);
}

/**
 * Rend la grille du planning hebdomadaire avec des barres de disponibilité continues.
 * @param {string} weekKey - La clé de la semaine à afficher (ex: "week-25").
 * @param {object} planningData - L'objet complet des données de planning de l'agent.
 */
function showWeek(weekKey, planningData) {
  const container = planningContainer;
  const header = headerHours;

  // Efface le contenu précédent du planning
  container.innerHTML = "";
  // Efface et recrée l'en-tête des heures avec la première cellule vide pour le label du jour
  header.innerHTML = `<div class="day-label sticky-day-col"></div>`;

  // Crée les en-têtes d'heures (de 7h00 à 6h30 du matin suivant, soit 24 heures)
  // Chaque heure occupe 2 colonnes dans la grille (pour représenter des créneaux de 30 minutes)
  for (let i = 0; i < 24; i++) {
    const hour = (7 + i) % 24; // Débute à 7h00, continue jusqu'à 6h00 le lendemain (représentation sur 24h)
    const div = document.createElement("div");
    div.className = "hour-cell";
    div.textContent = `${String(hour).padStart(2, '0')}:00`;
    div.style.gridColumn = `span 2`; // Chaque heure s'étend sur 2 colonnes (pour les slots de 30 min)
    header.appendChild(div);
  }

  // Pour chaque jour de la semaine
  days.forEach(day => {
    const row = document.createElement("div");
    row.className = "day-row";

    // Ajoute le label du jour dans la première colonne, le rendant collant
    const dayLabel = document.createElement("div");
    dayLabel.className = "day-label sticky-day-col";
    dayLabel.textContent = day.charAt(0).toUpperCase() + day.slice(1);
    row.appendChild(dayLabel);

    // Récupère les plages de disponibilité (créneaux) pour le jour et la semaine courants
    // Les données sont attendues sous forme d'un tableau d'objets { start: "HH:MM", "end": "HH:MM" }
    const dayRanges = planningData[weekKey]?.[day] || [];

    // Définit l'heure de début de la grille en minutes (7h00)
    const gridStartHourInMinutes = 7 * 60;

    // Pour chaque "slot" vide dans la grille (qui servira de fond)
    // Nous avons 48 slots de 30 minutes pour couvrir 24 heures (de 7h00 à 6h59 le lendemain)
    for (let i = 0; i < 48; i++) {
        const slotDiv = document.createElement("div");
        slotDiv.className = "slot";
        // Optionnel: ajouter un attribut pour le temps si besoin de débogage
        // slotDiv.setAttribute("data-slot-time", minutesToTime(gridStartHourInMinutes + i * 30));
        row.appendChild(slotDiv);
    }

    // Traite et crée les barres visuelles pour les plages de disponibilité
    dayRanges.forEach(range => {
      let startMinutes = timeToMinutes(range.start);
      let endMinutes = timeToMinutes(range.end);

      // Gère les plages qui traversent minuit (ex: 23:00 - 02:00)
      // En ajoutant 24 heures à l'heure de fin si elle est avant l'heure de début
      if (endMinutes <= startMinutes) {
        endMinutes += 24 * 60;
      }

      // Calcule les heures de début et de fin effectives pour l'affichage dans la grille
      // On s'assure que les barres ne commencent pas avant 7h00 ni ne dépassent 6h59 le lendemain
      let effectiveStartMinutes = Math.max(startMinutes, gridStartHourInMinutes);
      let effectiveEndMinutes = Math.min(endMinutes, gridStartHourInMinutes + (24 * 60));

      // Calcule la colonne de début et l'étendue (nombre de colonnes) dans la grille
      // La grille commence à la colonne 2 car la colonne 1 est pour le label du jour
      const startColumn = ((effectiveStartMinutes - gridStartHourInMinutes) / 30) + 2;
      const spanColumns = (effectiveEndMinutes - effectiveStartMinutes) / 30;

      // N'ajoute la barre que si elle a une longueur positive (visible)
      if (spanColumns > 0) {
        const bar = document.createElement("div");
        bar.className = "availability-bar";
        // Positionne la barre dans la grille
        bar.style.gridColumn = `${startColumn} / span ${spanColumns}`;
        bar.title = `Disponible: ${range.start} - ${range.end}`; // Infobulle
        row.appendChild(bar); // Ajoute la barre à la ligne du jour
      }
    });
    container.appendChild(row); // Ajoute la ligne du jour au conteneur principal du planning
  });
}

/**
 * Affiche ou masque le spinner de chargement.
 * @param {boolean} isLoading - True pour afficher, false pour masquer.
 */
function showLoading(isLoading) {
  if (isLoading) {
    loadingSpinner.classList.remove("hidden");
    if (weekSelect) weekSelect.disabled = true; // Désactive le sélecteur pendant le chargement
  } else {
    loadingSpinner.classList.add("hidden");
    if (weekSelect) weekSelect.disabled = false; // Active le sélecteur après le chargement
  }
}
