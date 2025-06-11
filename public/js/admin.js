const days = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const API_BASE_URL = "https://dispo-pompier.onrender.com";

let currentWeek = getCurrentWeek(); // Semaine actuelle par défaut
let currentDay = 'lundi'; // Jour actuel par défaut pour le planning
let planningData = {}; // Contiendra le planning global chargé de l'API
let agentDisplayInfos = {}; // Mapping dynamique agentId => {nom, prenom}
let availableQualifications = []; // Liste des qualifications disponibles chargée depuis l'API

// --- DOM Elements pour la navigation principale (onglets) ---
const mainTabButtons = document.querySelectorAll('.main-tab');
const mainTabContents = document.querySelectorAll('.main-tab-content');

// --- DOM Elements pour la vue "Planning Global" ---
const planningControls = document.getElementById('planning-controls'); // Conteneur pour les contrôles de semaine/export
const weekSelect = document.getElementById("week-select");
const dateRangeDisplay = document.getElementById("date-range"); // Rétabli, car il y a un p#date-range dans le HTML
const planningContainer = document.getElementById("global-planning");
const tabButtons = document.querySelectorAll(".tab"); // Boutons de jour (Lundi, Mardi...)
const adminInfo = document.getElementById("admin-info");

// --- DOM Elements pour la vue "Gestion des Agents" ---
const addAgentForm = document.getElementById('addAgentForm');
const newAgentQualificationsCheckboxes = document.getElementById('newAgentQualificationsCheckboxes'); // Nouveau: pour le formulaire d'ajout
const addAgentMessage = document.getElementById('addAgentMessage');
const agentsTableBody = document.getElementById('agentsTableBody');
const listAgentsMessage = document.getElementById('listAgentsMessage');

// --- DOM Elements pour la Modale de modification d'agent et de qualifications ---
const editAgentModal = document.getElementById('editAgentModal');
const closeButton = editAgentModal.querySelector('.close-button');
const editAgentForm = document.getElementById('editAgentForm');
const editAgentId = document.getElementById('editAgentId');
const editAgentNom = document.getElementById('editAgentNom');
const editAgentPrenom = document.getElementById('editAgentPrenom');
const editAgentNewPassword = document.getElementById('editAgentNewPassword');
const editAgentMessage = document.getElementById('editAgentMessage');
const qualificationsCheckboxesDiv = document.getElementById('qualificationsCheckboxes'); // Pour la modale de modification
const qualificationsMessage = document.getElementById('qualificationsMessage'); // Pour la modale de modification

// --- Global DOM Elements ---
const loadingSpinner = document.getElementById("loading-spinner");
const logoutButton = document.getElementById("logout-btn");


document.addEventListener("DOMContentLoaded", async () => {
    // **Vérification du rôle administrateur au chargement de la page**
    const userRole = sessionStorage.getItem("userRole");
    if (!userRole || userRole !== "admin") {
        alert("Accès non autorisé. Vous devez être administrateur.");
        sessionStorage.clear();
        window.location.href = "index.html";
        return;
    }

    // --- Initialisation des onglets principaux ---
    mainTabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTabId = button.dataset.mainTab;
            openMainTab(targetTabId);
        });
    });

    // --- Initialisation des onglets de jour pour le planning global ---
    tabButtons.forEach(tab => {
        tab.addEventListener("click", () => {
            const day = tab.dataset.day;
            showDay(day);
        });
    });

    // --- Initialisation des fonctionnalités par défaut de la page ---
    // Charger la liste des qualifications disponibles en premier
    await loadAvailableQualifications();
    // Rendre les checkboxes pour le formulaire d'ajout d'agent après le chargement des qualifications
    renderNewAgentQualificationsCheckboxes();

    // Ouvrir l'onglet "Planning Global" par défaut au chargement
    await openMainTab('global-planning-view'); // Attendre que le planning soit chargé avant d'afficher


    // --- Écouteurs d'événements pour les contrôles du planning global ---
    if (weekSelect) {
        weekSelect.addEventListener("change", async () => {
            currentWeek = parseInt(weekSelect.value.split('-')[1]); // Mise à jour de currentWeek
            await loadPlanningAndDisplay(); // Recharger et afficher le planning
        });
    }
    if (document.getElementById("export-pdf")) {
        document.getElementById("export-pdf").addEventListener("click", exportPdf);
    }

    // --- Écouteurs d'événements pour la vue "Gestion des Agents" ---
    if (addAgentForm) {
        addAgentForm.addEventListener('submit', handleAddAgent);
    }
    if (agentsTableBody) {
        agentsTableBody.addEventListener('click', handleAgentActions);
    }

    // --- Écouteurs d'événements pour la Modale de modification ---
    if (closeButton) {
        closeButton.addEventListener('click', () => {
            editAgentModal.style.display = 'none';
        });
    }
    window.addEventListener('click', (event) => {
        if (event.target == editAgentModal) {
            editAgentModal.style.display = 'none';
        }
    });
    if (editAgentForm) {
        editAgentForm.addEventListener('submit', handleEditAgent);
    }

    // --- Écouteur pour la déconnexion ---
    if (logoutButton) {
        logoutButton.addEventListener("click", logout);
    }
});


// --- Fonctions de gestion des onglets principaux (Planning Global / Gestion Agents) ---
async function openMainTab(tabId) {
    mainTabContents.forEach(tab => {
        tab.classList.remove('active');
    });
    mainTabButtons.forEach(button => {
        button.classList.remove('active');
    });

    document.getElementById(tabId).classList.add('active');
    document.querySelector(`.main-tab[data-main-tab="${tabId}"]`).classList.add('active');

    // Gérer la visibilité des contrôles spécifiques au planning
    if (tabId === 'global-planning-view') {
        planningControls.style.display = 'flex'; // Affiche les contrôles
        await loadPlanningAndDisplay(); // Recharger le planning si on revient sur cet onglet
    } else {
        planningControls.style.display = 'none'; // Cache les contrôles
        await loadAgents(); // Recharger la liste des agents quand on va sur cet onglet
    }
}


// --- Fonctions Utilitaire pour les dates et semaines ---
function getCurrentWeek(date = new Date()) {
    const target = new Date(date.valueOf());
    target.setDate(target.getDate() + 3 - (target.getDay() + 6) % 7);
    const firstThursday = new Date(target.getFullYear(), 0, 4);
    const weekNum = 1 + Math.round(((target - firstThursday) / 86400000 - 3 + (firstThursday.getDay() + 6) % 7) / 7);
    return weekNum;
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

    const format = date => date.toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit"
    });

    return `du ${format(start)} au ${format(end)}`;
}

function getMondayOfWeek(weekNum, year) {
    const simple = new Date(year, 0, 1 + (weekNum - 1) * 7);
    const dow = simple.getDay();
    if (dow <= 4) simple.setDate(simple.getDate() - dow + 1);
    else simple.setDate(simple.getDate() + 8 - dow);
    return simple;
}

// --- Fonctions de gestion du Planning Global ---

// Charge les plannings et met à jour l'affichage de la semaine
async function loadPlanningAndDisplay() {
    showLoading(true);
    try {
        const res = await fetch(`${API_BASE_URL}/api/planning`);
        if (!res.ok) {
            if (res.status === 404) {
                console.warn("Aucun planning global trouvé (404), initialisation à vide.");
                planningData = {};
            } else {
                throw new Error(`Erreur chargement planning global: HTTP ${res.status}`);
            }
        }
        planningData = await res.json() || {};

        // Récupérer la liste des agents depuis l'API pour un mapping dynamique
        const agentsResponse = await fetch(`${API_BASE_URL}/api/admin/agents`, {
            headers: { 'X-User-Role': 'admin' } // Toujours envoyer ce header pour la démo
        });
        const agentsData = await agentsResponse.json();
        agentDisplayInfos = {};
        agentsData.forEach(agent => {
            agentDisplayInfos[agent.id] = { nom: agent.nom, prenom: agent.prenom };
        });

        const allWeeksSet = new Set();
        for (const agentKey in planningData) {
            // Filtrer les agents qui ne sont pas dans agentDisplayInfos (ex: admin)
            if (!agentDisplayInfos[agentKey]) continue;
            const weeks = Object.keys(planningData[agentKey]);
            weeks.forEach(w => allWeeksSet.add(w));
        }

        if (allWeeksSet.size === 0) {
            allWeeksSet.add(`week-${getCurrentWeek()}`);
        }

        updateWeekSelector(allWeeksSet); // Met à jour le sélecteur de semaine
        showDay(currentDay); // Affiche le planning pour le jour actuel

    } catch (e) {
        console.error("Erreur lors du chargement ou de l'affichage du planning :", e);
        adminInfo.textContent = "Erreur lors du chargement du planning global. Veuillez réessayer.";
        adminInfo.style.backgroundColor = "#ffe6e6";
        adminInfo.style.borderColor = "#e6a4a4";
        adminInfo.style.color = "#a94442";
        planningData = {}; // Réinitialise les données du planning en cas d'erreur
    } finally {
        showLoading(false);
    }
}

// Met à jour les options du sélecteur de semaine
function updateWeekSelector(availableWeeks) {
    weekSelect.innerHTML = "";
    const sortedWeeks = Array.from(availableWeeks).sort((a, b) => {
        return parseInt(a.split("-")[1]) - parseInt(b.split("-")[1]);
    });

    sortedWeeks.forEach(weekKey => {
        const opt = document.createElement("option");
        opt.value = weekKey;
        const weekNum = parseInt(weekKey.split("-")[1]);
        const dateRange = getWeekDateRange(weekNum);
        opt.textContent = `Semaine ${weekNum} (${dateRange})`;
        weekSelect.appendChild(opt);
    });

    // Sélectionne la semaine actuelle si elle existe, sinon la première semaine disponible
    if (sortedWeeks.includes(`week-${currentWeek}`)) {
        weekSelect.value = `week-${currentWeek}`;
    } else if (sortedWeeks.length > 0) {
        weekSelect.value = sortedWeeks[0];
        currentWeek = parseInt(sortedWeeks[0].split("-")[1]);
    } else {
        // Si aucune semaine n'est disponible (aucun planning), ajoute la semaine actuelle
        const currentWeekKey = `week-${getCurrentWeek()}`;
        const opt = document.createElement("option");
        opt.value = currentWeekKey;
        const dateRange = getWeekDateRange(getCurrentWeek());
        opt.textContent = `Semaine ${getCurrentWeek()} (${dateRange})`;
        weekSelect.appendChild(opt);
        weekSelect.value = currentWeekKey;
        currentWeek = getCurrentWeek();
    }

    // MODIFICATION: Vider le contenu de dateRangeDisplay pour enlever les dates redondantes
    dateRangeDisplay.textContent = "";
}

// Affiche le planning pour le jour sélectionné
function showDay(day) {
    currentDay = day;
    tabButtons.forEach(tab => {
        tab.classList.toggle("active", tab.dataset.day === day);
    });

    planningContainer.innerHTML = ""; // Vide le planning existant

    const table = document.createElement("table");
    table.className = "planning-table";

    // Header (créneaux horaires)
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");

    const thAgent = document.createElement("th");
    thAgent.textContent = "Agent";
    headerRow.appendChild(thAgent);

    const allTimeSlots = [];
    // Génère les créneaux horaires de 07:00 à 07:00 du jour suivant
    const startHour = 7; // Heure de début
    for (let i = 0; i < 48; i++) { // 48 créneaux de 30 minutes = 24 heures
        const currentSlotHour = (startHour + Math.floor(i / 2)) % 24;
        const currentSlotMinute = (i % 2) * 30;

        const endSlotHour = (startHour + Math.floor((i + 1) / 2)) % 24;
        const endSlotMinute = ((i + 1) % 2) * 30;

        const slotString = `${String(currentSlotHour).padStart(2, '0')}:${String(currentSlotMinute).padStart(2, '0')} - ${String(endSlotHour).padStart(2, '0')}:${String(endSlotMinute).padStart(2, '0')}`;
        allTimeSlots.push(slotString);

        const th = document.createElement("th");
        if (currentSlotMinute === 0) { // Regroupe 00:00-00:30 et 00:30-01:00 sous une entête 00:00
            th.textContent = `${String(currentSlotHour).padStart(2, '0')}:00`;
            th.colSpan = 2; // S'étend sur deux colonnes (00 et 30 minutes)
        } else {
            th.style.display = "none"; // Cache la deuxième colonne du créneau horaire
        }
        headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Body (planning par agent)
    const tbody = document.createElement("tbody");

    const weekKey = `week-${currentWeek}`;

    // Récupère les IDs des agents à partir de agentDisplayInfos et les trie
    const sortedAgentIds = Object.keys(agentDisplayInfos).sort();

    if (sortedAgentIds.length === 0) {
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = 1 + allTimeSlots.length;
        td.textContent = "Aucun agent ou planning disponible.";
        tr.appendChild(td);
        tbody.appendChild(tr);
    } else {
        sortedAgentIds.forEach(agentId => {
            const slots = planningData[agentId]?.[weekKey]?.[day] || []; // Récupère les créneaux de l'agent pour ce jour
            const agentInfo = agentDisplayInfos[agentId]; // Récupère le nom/prénom

            const tr = document.createElement("tr");
            const tdAgent = document.createElement("td");
            tdAgent.textContent = `${agentInfo.prenom} ${agentInfo.nom}`; // Affiche Prénom Nom
            tr.appendChild(tdAgent);

            allTimeSlots.forEach(slotString => {
                const td = document.createElement("td");
                td.classList.add('slot-cell');
                td.setAttribute("data-time", slotString);
                if (slots.includes(slotString)) {
                    td.classList.add('occupied'); // Marque la cellule comme occupée
                }
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
    }

    table.appendChild(tbody);
    planningContainer.appendChild(table);

    // Réinitialise le message d'info si tout va bien
    adminInfo.textContent = "Vue du planning global des agents.";
    adminInfo.style.backgroundColor = "";
    adminInfo.style.borderColor = "";
    adminInfo.style.color = "";
}


// --- Fonctions d'Export PDF ---
async function exportPdf() {
    const container = document.getElementById("global-planning");
    const table = container.querySelector('.planning-table');

    if (!table) {
        alert("La table de planning est introuvable. Impossible d'exporter.");
        return;
    }

    // Stocke les styles originaux
    const originalContainerOverflowX = container.style.overflowX;
    const originalTableWhiteSpace = table.style.whiteSpace;

    showLoading(true, true);

    try {
        container.style.overflowX = "visible";
        table.style.whiteSpace = "nowrap";

        await new Promise(r => setTimeout(r, 100)); // Petit délai pour le rendu des styles

        const { jsPDF } = window.jspdf;

        const year = new Date().getFullYear();
        const mondayDate = getMondayOfWeek(currentWeek, year);
        const sundayDate = new Date(mondayDate);
        sundayDate.setDate(mondayDate.getDate() + 6);

        function formatDate(d) {
            return d.getDate().toString().padStart(2, '0') + '/' + (d.getMonth() + 1).toString().padStart(2, '0');
        }
        const title = `Planning Semaine ${currentWeek} du ${formatDate(mondayDate)} au ${formatDate(sundayDate)}`;

        const canvas = await html2canvas(table, {
            scale: 2, // Augmente l'échelle pour une meilleure qualité d'image dans le PDF
            scrollY: -window.scrollY,
            useCORS: true,
            allowTaint: true,
            // background: '#ffffff',
            // logging: true
        });

        const imgData = canvas.toDataURL("image/png");

        const pdf = new jsPDF({
            orientation: "landscape",
            unit: "mm",
            format: "a3"
        });

        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 10;

        const imgProps = pdf.getImageProperties(imgData);
        let pdfWidth = pageWidth - 2 * margin;
        let pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

        if (pdfHeight > pageHeight - (2 * margin + 30)) {
            pdfHeight = pageHeight - (2 * margin + 30);
            pdfWidth = (imgProps.width * pdfHeight) / imgProps.height;
        }

        const x = (pageWidth - pdfWidth) / 2;
        const y = margin + 25;

        pdf.setFontSize(18);
        pdf.text(title, margin, margin + 5);
        pdf.setFontSize(14);
        pdf.text(`Jour : ${currentDay.charAt(0).toUpperCase() + currentDay.slice(1)}`, margin, margin + 12);

        if (canvas.width > pageWidth * 2) { // Si l'image est très large, indiquer une potentielle compression
            pdf.setFontSize(8);
            pdf.setTextColor(100);
            pdf.text("Note: Le planning a été ajusté pour tenir sur la page. Certains détails peuvent apparaître plus petits.", margin, margin + 18);
            pdf.setTextColor(0);
        }

        pdf.addImage(imgData, "PNG", x, y, pdfWidth, pdfHeight);
        pdf.save(`planning_${currentDay}_semaine${currentWeek}.pdf`);
        alert("Le PDF a été généré avec succès !");

    } catch (error) {
        console.error("Erreur lors de l'export PDF:", error);
        alert("Une erreur est survenue lors de la génération du PDF. Veuillez réessayer ou contacter l'administrateur. Détails: " + error.message);
    } finally {
        container.style.overflowX = originalContainerOverflowX;
        table.style.whiteSpace = originalTableWhiteSpace;
        showLoading(false, true);
    }
}


// --- Fonctions de gestion des qualifications (Frontend) ---

// Fonction pour charger la liste de toutes les qualifications possibles depuis le serveur
async function loadAvailableQualifications() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/qualifications`, {
            headers: { 'X-User-Role': 'admin' } // Assurez-vous que le backend protège cette route
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'Erreur lors du chargement des qualifications disponibles.');
        }
        availableQualifications = data;
        console.log('Qualifications disponibles chargées:', availableQualifications);
    } catch (error) {
        console.error('Erreur de chargement des qualifications:', error);
        if (qualificationsMessage) { // S'assurer que l'élément existe avant de le manipuler
            qualificationsMessage.textContent = `Erreur de chargement des qualifications: ${error.message}`;
            qualificationsMessage.style.color = 'red';
        }
    }
}

// Fonction pour générer les cases à cocher des qualifications pour le formulaire d'ajout
function renderNewAgentQualificationsCheckboxes() {
    if (!newAgentQualificationsCheckboxes) return; // S'assurer que l'élément DOM existe

    newAgentQualificationsCheckboxes.innerHTML = '';
    if (availableQualifications.length === 0) {
        newAgentQualificationsCheckboxes.textContent = 'Aucune qualification disponible. Ajoutez-en d\'abord via la gestion des qualifications (si implémenté).';
        return;
    }

    availableQualifications.forEach(qualification => {
        const checkboxContainer = document.createElement('div');
        checkboxContainer.classList.add('flex', 'items-center'); // Tailwind classes for alignment
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `new-qual-${qualification.id}`; // ID unique pour le formulaire d'ajout
        checkbox.value = qualification.id;
        checkbox.classList.add('form-checkbox', 'h-4', 'w-4', 'text-blue-600', 'rounded', 'border-gray-300', 'focus:ring-blue-500'); // Tailwind for checkbox styling

        const label = document.createElement('label');
        label.htmlFor = `new-qual-${qualification.id}`;
        label.textContent = qualification.name;
        label.classList.add('ml-2', 'text-gray-700', 'text-sm');

        checkboxContainer.appendChild(checkbox);
        checkboxContainer.appendChild(label);
        newAgentQualificationsCheckboxes.appendChild(checkboxContainer);
    });
}


// Fonction pour générer les cases à cocher des qualifications dans la modale de modification
function renderQualificationsCheckboxes(agentQualifications = []) {
    if (!qualificationsCheckboxesDiv) return; // S'assurer que l'élément DOM existe

    qualificationsCheckboxesDiv.innerHTML = '';
    if (availableQualifications.length === 0) {
        qualificationsCheckboxesDiv.textContent = 'Aucune qualification disponible.';
        if (qualificationsMessage) {
             qualificationsMessage.textContent = 'Veuillez ajouter des qualifications via l\'administration.';
             qualificationsMessage.style.color = 'orange';
        }
        return;
    }

    availableQualifications.forEach(qualification => {
        const checkboxContainer = document.createElement('div');
        checkboxContainer.classList.add('flex', 'items-center'); // Tailwind classes for alignment
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `edit-qual-${qualification.id}`; // ID unique pour la modale d'édition
        checkbox.value = qualification.id;
        checkbox.checked = agentQualifications.includes(qualification.id);
        checkbox.classList.add('form-checkbox', 'h-4', 'w-4', 'text-blue-600', 'rounded', 'border-gray-300', 'focus:ring-blue-500'); // Tailwind for checkbox styling

        const label = document.createElement('label');
        label.htmlFor = `edit-qual-${qualification.id}`;
        label.textContent = qualification.name;
        label.classList.add('ml-2', 'text-gray-700', 'text-sm');

        checkboxContainer.appendChild(checkbox);
        checkboxContainer.appendChild(label);
        qualificationsCheckboxesDiv.appendChild(checkboxContainer);
    });
    if (qualificationsMessage) {
        qualificationsMessage.textContent = ''; // Clear message if qualifications are loaded
    }
}


// --- Fonctions CRUD pour les agents (Backend) ---

async function loadAgents() {
    listAgentsMessage.textContent = 'Chargement des agents...';
    listAgentsMessage.style.color = 'blue';
    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/agents`, {
            headers: {
                'X-User-Role': 'admin' // Temporaire: à retirer si express-session ou JWT est implémenté
            }
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Erreur lors du chargement des agents.');
        }

        agentsTableBody.innerHTML = '';
        if (data.length === 0) {
            agentsTableBody.innerHTML = '<tr><td colspan="4">Aucun agent enregistré pour le moment.</td></tr>';
        } else {
            data.forEach(agent => {
                const row = agentsTableBody.insertRow();
                // Afficher les qualifications dans la table (optionnel, pour l'admin)
                const qualNames = (agent.qualifications || [])
                                    .map(id => {
                                        const qual = availableQualifications.find(q => q.id === id);
                                        return qual ? qual.name : id; // Affiche le nom ou l'ID si non trouvé
                                    })
                                    .join(', ');

                row.innerHTML = `
                    <td>${agent.id}</td>
                    <td>${agent.nom}</td>
                    <td>${agent.prenom}</td>
                    <td>${qualNames}</td> <!-- Nouvelle colonne pour les qualifications -->
                    <td>
                        <button class="edit-btn btn-secondary" data-id="${agent.id}" data-nom="${agent.nom}" data-prenom="${agent.prenom}" data-qualifications='${JSON.stringify(agent.qualifications || [])}'>Modifier</button>
                        <button class="delete-btn btn-danger" data-id="${agent.id}">Supprimer</button>
                    </td>
                `;
            });
        }
        listAgentsMessage.textContent = '';
    } catch (error) {
        console.error('Erreur de chargement des agents:', error);
        listAgentsMessage.textContent = `Erreur : ${error.message}`;
        listAgentsMessage.style.color = 'red';
        agentsTableBody.innerHTML = '<tr><td colspan="5">Impossible de charger la liste des agents.</td></tr>'; // Colspan ajusté
    }
}

async function handleAddAgent(event) {
    event.preventDefault();
    const id = document.getElementById('newAgentId').value.trim();
    const nom = document.getElementById('newAgentNom').value.trim();
    const prenom = document.getElementById('newAgentPrenom').value.trim();
    const password = document.getElementById('newAgentPassword').value.trim();

    // Récupérer les qualifications sélectionnées pour le nouvel agent
    const selectedQualifications = Array.from(newAgentQualificationsCheckboxes.querySelectorAll('input[type="checkbox"]:checked'))
                                       .map(checkbox => checkbox.value);

    addAgentMessage.textContent = 'Ajout en cours...';
    addAgentMessage.style.color = 'blue';

    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/agents`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-Role': 'admin' // Temporaire
            },
            body: JSON.stringify({ id, nom, prenom, password, qualifications: selectedQualifications }) // Envoyer les qualifications
        });
        const data = await response.json();

        if (response.ok) {
            addAgentMessage.textContent = data.message;
            addAgentMessage.style.color = 'green';
            addAgentForm.reset();
            // Réinitialiser les checkboxes après l'ajout
            newAgentQualificationsCheckboxes.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
            loadAgents(); // Recharger la liste
        } else {
            addAgentMessage.textContent = `Erreur : ${data.message}`;
            addAgentMessage.style.color = 'red';
        }
    } catch (error) {
        console.error('Erreur lors de l\'ajout de l\'agent:', error);
        addAgentMessage.textContent = 'Erreur réseau lors de l\'ajout de l\'agent.';
        addAgentMessage.style.color = 'red';
    }
}

async function handleAgentActions(event) {
    const target = event.target;
    const agentId = target.dataset.id;

    if (!agentId) return;

    if (target.classList.contains('edit-btn')) {
        editAgentId.value = agentId;
        editAgentNom.value = target.dataset.nom;
        editAgentPrenom.value = target.dataset.prenom;
        editAgentNewPassword.value = '';
        editAgentMessage.textContent = '';

        // Récupérer les qualifications de l'agent depuis le dataset
        const agentQualifications = JSON.parse(target.dataset.qualifications || '[]');
        renderQualificationsCheckboxes(agentQualifications); // Remplir les checkboxes

        editAgentModal.style.display = 'block';
    } else if (target.classList.contains('delete-btn')) {
        if (confirm(`Êtes-vous sûr de vouloir supprimer l'agent ${agentId} ?`)) {
            try {
                const response = await fetch(`${API_BASE_URL}/api/admin/agents/${agentId}`, {
                    method: 'DELETE',
                    headers: {
                        'X-User-Role': 'admin' // Temporaire
                    }
                });
                const data = await response.json();

                if (response.ok) {
                    alert(data.message);
                    loadAgents(); // Recharger la liste
                } else {
                    alert(`Erreur lors de la suppression : ${data.message}`);
                }
            } catch (error) {
                console.error('Erreur lors de la suppression de l\'agent:', error);
                alert('Erreur réseau lors de la suppression de l\'agent.');
            }
        }
    }
}

async function handleEditAgent(event) {
    event.preventDefault();
    const id = editAgentId.value.trim();
    const nom = editAgentNom.value.trim();
    const prenom = editAgentPrenom.value.trim();
    const newPassword = editAgentNewPassword.value.trim();

    // Récupérer les qualifications sélectionnées
    const selectedQualifications = Array.from(qualificationsCheckboxesDiv.querySelectorAll('input[type="checkbox"]:checked'))
                                       .map(checkbox => checkbox.value);

    editAgentMessage.textContent = 'Mise à jour en cours...';
    editAgentMessage.style.color = 'blue';

    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/agents/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-User-Role': 'admin' // Temporaire
            },
            body: JSON.stringify({ nom, prenom, newPassword, qualifications: selectedQualifications }) // Envoyer les qualifications
        });
        const data = await response.json();

        if (response.ok) {
            editAgentMessage.textContent = data.message;
            editAgentMessage.style.color = 'green';
            loadAgents(); // Recharger la liste des agents
            // editAgentModal.style.display = 'none'; // Optionnel: fermer la modale après succès
        } else {
            editAgentMessage.textContent = `Erreur : ${data.message}`;
            editAgentMessage.style.color = 'red';
        }
    } catch (error) {
        console.error('Erreur lors de la mise à jour de l\'agent:', error);
        editAgentMessage.textContent = 'Erreur réseau lors de la mise à jour de l\'agent.';
        editAgentMessage.style.color = 'red';
    }
}

function logout() {
    // Si vous avez une route de déconnexion côté serveur, appelez-la ici
    // Exemple: fetch(`${API_BASE_URL}/api/logout`, { method: 'POST' })
    //   .then(res => res.json())
    //   .finally(() => {
    sessionStorage.clear();
    window.location.href = "index.html";
    //   });
}

// --- Fonction pour gérer l'affichage du spinner de chargement et désactiver/réactiver les contrôles ---
function showLoading(isLoading, forPdf = false) {
    if (isLoading) {
        loadingSpinner.classList.remove("hidden");
        // Désactiver les contrôles globaux et ceux de l'onglet actif
        document.querySelectorAll('button, select, input, a').forEach(el => {
            if (el.id !== 'logout-btn') { // Ne pas désactiver le bouton de déconnexion
                el.disabled = true;
                if (el.tagName === 'A') el.classList.add('disabled-link'); // Ajoute une classe pour les liens
            }
        });
        // Pour les boutons principaux d'onglet, on peut les désactiver aussi
        mainTabButtons.forEach(btn => btn.disabled = true);

        if (forPdf) {
            adminInfo.textContent = "Génération du PDF en cours, veuillez patienter...";
            adminInfo.style.backgroundColor = "#fff3cd";
            adminInfo.style.borderColor = "#ffeeba";
            adminInfo.style.color = "#856404";
        }
    } else {
        loadingSpinner.classList.add("hidden");
        // Réactiver les contrôles globaux et ceux de l'onglet actif
        document.querySelectorAll('button, select, input, a').forEach(el => {
            if (el.id !== 'logout-btn') {
                el.disabled = false;
                if (el.tagName === 'A') el.classList.remove('disabled-link');
            }
        });
        mainTabButtons.forEach(btn => btn.disabled = false);


        if (forPdf) {
            adminInfo.textContent = "Vue du planning global des agents.";
            adminInfo.style.backgroundColor = "";
            adminInfo.style.borderColor = "";
            adminInfo.style.color = "";
        }
    }
}
