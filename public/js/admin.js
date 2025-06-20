// admin.js

document.addEventListener('DOMContentLoaded', () => {
    const API_BASE_URL = "https://dispo-pompier.onrender.com"; // Assurez-vous que cette URL correspond à votre backend Render.com

    // --- Variables globales pour le stockage des données (localement) ---
    // Ces variables stockeront les données chargées du serveur pour l'affichage et la manipulation.
    let USERS_DATA = {}; // Stocke les données des agents pour affichage dans les tableaux
    let QUALIFICATIONS_DATA = [];
    let GRADES_DATA = [];
    let FUNCTIONS_DATA = [];
    let GLOBAL_PLANNING_DATA = {}; // Stocke le planning global chargé depuis le serveur

    // --- Éléments du DOM (à adapter selon votre HTML) ---
    const adminNameDisplay = document.getElementById('agent-name-display'); // Pour afficher le nom de l'admin
    const loadingSpinner = document.getElementById('loading-spinner');
    const messageModal = document.getElementById('message-modal');
    const messageModalContent = document.getElementById('message-modal-content');
    const messageModalTitle = document.getElementById('message-modal-title');
    const messageModalCloseBtn = document.getElementById('message-modal-close-btn');

    // Sections de l'admin panel (pour la navigation ou le masquage/affichage)
    const planningSection = document.getElementById('planning-section');
    const agentsSection = document.getElementById('agents-section');
    const qualificationsSection = document.getElementById('qualifications-section');
    const gradesSection = document.getElementById('grades-section');
    const functionsSection = document.getElementById('functions-section');

    // Tables pour l'affichage des données
    const agentsTableBody = document.getElementById('agents-table-body');
    const qualificationsTableBody = document.getElementById('qualifications-table-body');
    const gradesTableBody = document.getElementById('grades-table-body');
    const functionsTableBody = document.getElementById('functions-table-body');
    const planningTableBody = document.getElementById('planning-table-body');
    const planningTableHead = document.getElementById('planning-table-head');


    // Sélecteurs de semaine pour le planning global
    const planningWeekSelect = document.getElementById('planning-week-select');
    const prevPlanningWeekBtn = document.getElementById('prev-planning-week-btn');
    const nextPlanningWeekBtn = document.getElementById('next-planning-week-btn');

    let currentPlanningMonday = getMonday(new Date());
    let currentPlanningWeekNum = getWeekNumber(currentPlanningMonday);


    // --- Fonctions utilitaires génériques ---

    function getAuthHeaders(token) {
        return token ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
    }

    function showLoading(show) {
        if (loadingSpinner) {
            loadingSpinner.classList.toggle('hidden', !show);
        }
    }

    function displayMessageModal(title, message, type) {
        if (messageModal && messageModalContent && messageModalTitle) {
            messageModalTitle.textContent = title;
            messageModalContent.textContent = message;
            messageModal.className = 'message-modal'; // Réinitialise les classes
            messageModal.classList.add(`message-modal-${type}`); // Ajoute la classe de type (success, error, info)
            messageModal.classList.remove('hidden');
        }
    }

    if (messageModalCloseBtn) {
        messageModalCloseBtn.addEventListener('click', () => {
            if (messageModal) messageModal.classList.add('hidden');
        });
    }

    // --- Fonctions de gestion de date (similaires à agent.js pour cohérence) ---

    function getWeekNumber(d) {
        d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
        const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1)/7);
        return weekNo;
    }

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

    function formatSlotTime(startIndex, endIndex) {
        const START_HOUR = 7;
        const totalMinutesStart = (START_HOUR * 60) + (startIndex * 30);
        const totalMinutesEnd = (START_HOUR * 60) + (endIndex * 30) + 30;

        const hStart = Math.floor(totalMinutesStart / 60) % 24;
        const mStart = totalMinutesStart % 60;
        const hEnd = Math.floor(totalMinutesEnd / 60) % 24;
        const mEnd = totalMinutesEnd % 60;

        return `${hStart.toString().padStart(2,'0')}:${mStart.toString().padStart(2,'0')}-${hEnd.toString().padStart(2,'0')}:${mEnd.toString().padStart(2,'0')}`;
    }

    // --- Initialisation de la page Admin ---

    async function loadAdminInfo() {
        const token = sessionStorage.getItem('token');
        const userRole = sessionStorage.getItem('userRole');

        if (!token || userRole !== 'admin') {
            console.warn('Non authentifié ou non-admin. Redirection vers la page de connexion.');
            window.location.href = '/index.html';
            return;
        }

        const firstName = sessionStorage.getItem('agentPrenom');
        const lastName = sessionStorage.getItem('agentNom');
        if (adminNameDisplay) {
            adminNameDisplay.textContent = `${firstName || 'Admin'} ${lastName || 'Principal'}`;
        }

        // Charger toutes les données nécessaires pour l'interface admin
        await Promise.all([
            loadAgents(),
            loadQualifications(),
            loadGrades(),
            loadFunctions(),
            loadPlanningData(currentPlanningWeekNum) // Charger le planning de la semaine actuelle
        ]);
        initPlanningWeekSelector(); // Initialiser le sélecteur de semaine après le chargement du planning
    }


    // --- Fonctions de chargement des données (Appels API) ---

    // Charger tous les agents
    async function loadAgents() {
        showLoading(true);
        try {
            const token = sessionStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/admin/agents`, {
                headers: getAuthHeaders(token)
            });

            if (response.ok) {
                const agents = await response.json();
                USERS_DATA = {}; // Réinitialise les données des agents
                agents.forEach(agent => {
                    USERS_DATA[agent._id] = agent; // Stocke par ID pour un accès facile
                });
                renderAgentsTable();
                displayMessageModal('Agents chargés', 'La liste des agents a été mise à jour.', 'success');
            } else if (response.status === 403 || response.status === 401) {
                displayMessageModal('Accès refusé', 'Vos droits ne vous permettent pas d\'accéder à cette ressource ou votre session a expiré. Veuillez vous reconnecter.', 'error');
                sessionStorage.clear(); // Efface toutes les données de session
                window.location.href = '/index.html';
            } else {
                const errorData = await response.json();
                displayMessageModal('Erreur', `Impossible de charger les agents : ${errorData.message || response.statusText}`, 'error');
            }
        } catch (error) {
            console.error('Erreur réseau lors du chargement des agents :', error);
            displayMessageModal('Erreur réseau', 'Impossible de joindre le serveur pour charger les agents.', 'error');
        } finally {
            showLoading(false);
        }
    }

    // Charger les qualifications
    async function loadQualifications() {
        showLoading(true);
        try {
            const token = sessionStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/qualifications`, {
                headers: getAuthHeaders(token)
            });
            if (response.ok) {
                QUALIFICATIONS_DATA = await response.json();
                renderQualificationsTable();
            } else if (response.status === 403 || response.status === 401) {
                // Géré globalement par loadAdminInfo ou par le modal ci-dessous
            } else {
                const errorData = await response.json();
                displayMessageModal('Erreur', `Impossible de charger les qualifications : ${errorData.message || response.statusText}`, 'error');
            }
        } catch (error) {
            console.error('Erreur réseau lors du chargement des qualifications :', error);
        } finally {
            showLoading(false);
        }
    }

    // Charger les grades
    async function loadGrades() {
        showLoading(true);
        try {
            const token = sessionStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/grades`, {
                headers: getAuthHeaders(token)
            });
            if (response.ok) {
                GRADES_DATA = await response.json();
                renderGradesTable();
            } else if (response.status === 403 || response.status === 401) {
                // Géré globalement
            } else {
                const errorData = await response.json();
                displayMessageModal('Erreur', `Impossible de charger les grades : ${errorData.message || response.statusText}`, 'error');
            }
        } catch (error) {
            console.error('Erreur réseau lors du chargement des grades :', error);
        } finally {
            showLoading(false);
        }
    }

    // Charger les fonctions
    async function loadFunctions() {
        showLoading(true);
        try {
            const token = sessionStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/functions`, {
                headers: getAuthHeaders(token)
            });
            if (response.ok) {
                FUNCTIONS_DATA = await response.json();
                renderFunctionsTable();
            } else if (response.status === 403 || response.status === 401) {
                // Géré globalement
            } else {
                const errorData = await response.json();
                displayMessageModal('Erreur', `Impossible de charger les fonctions : ${errorData.message || response.statusText}`, 'error');
            }
        } catch (error) {
            console.error('Erreur réseau lors du chargement des fonctions :', error);
        } finally {
            showLoading(false);
        }
    }

    // Charger le planning global
    async function loadPlanningData(weekNum) {
        showLoading(true);
        try {
            const token = sessionStorage.getItem('token');
            const headers = getAuthHeaders(token);
            if (!headers.Authorization) {
                displayMessageModal('Authentification requise', 'Veuillez vous connecter pour accéder à cette page.', 'error');
                window.location.href = '/index.html';
                return;
            }

            const response = await fetch(`${API_BASE_URL}/api/planning`, {
                method: 'GET',
                headers: headers
            });

            if (response.ok) {
                GLOBAL_PLANNING_DATA = await response.json();
                console.log('Données de planning reçues :', GLOBAL_PLANNING_DATA);
                renderGlobalPlanning(weekNum); // Met à jour l'affichage avec les données globales
                displayMessageModal('Planning chargé', 'Le planning global a été mis à jour.', 'success');

            } else if (response.status === 403 || response.status === 401) {
                displayMessageModal('Accès refusé', 'Vos droits ne vous permettent pas d\'accéder à cette ressource ou votre session a expiré. Veuillez vous reconnecter.', 'error');
                sessionStorage.clear();
                window.location.href = '/index.html';
            } else if (response.status === 500) {
                const errorData = await response.json();
                console.error(`Erreur interne du serveur lors du chargement du planning :`, errorData);
                displayMessageModal('Erreur serveur', `Impossible de charger le planning : ${errorData.message || 'Erreur interne du serveur. Vérifiez les logs du serveur.'}`, 'error');
            } else {
                const errorData = await response.json();
                displayMessageModal('Erreur', `Impossible de charger le planning : ${errorData.message || response.statusText}`, 'error');
            }
        } catch (error) {
            console.error('Erreur réseau lors du chargement du planning global :', error);
            displayMessageModal('Erreur réseau', 'Impossible de joindre le serveur. Vérifiez votre connexion.', 'error');
        } finally {
            showLoading(false);
        }
    }


    // --- Fonctions de rendu des tableaux (à adapter à votre HTML) ---

    function renderAgentsTable() {
        if (!agentsTableBody) return;
        agentsTableBody.innerHTML = '';
        const agentsArray = Object.values(USERS_DATA);
        agentsArray.forEach(agent => {
            const row = agentsTableBody.insertRow();
            row.insertCell().textContent = agent.prenom;
            row.insertCell().textContent = agent.nom;
            row.insertCell().textContent = agent._id;
            row.insertCell().textContent = agent.qualifications.map(id => (QUALIFICATIONS_DATA.find(q => q.id === id) || { name: id }).name).join(', ');
            row.insertCell().textContent = agent.grades.map(id => (GRADES_DATA.find(g => g.id === id) || { name: id }).name).join(', ');
            row.insertCell().textContent = agent.functions.map(id => (FUNCTIONS_DATA.find(f => f.id === id) || { name: id }).name).join(', ');

            // Exemple de boutons d'action
            const actionsCell = row.insertCell();
            const editBtn = document.createElement('button');
            editBtn.textContent = 'Modifier';
            editBtn.onclick = () => handleEditAgent(agent._id);
            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'Supprimer';
            deleteBtn.onclick = () => handleDeleteAgent(agent._id);
            actionsCell.appendChild(editBtn);
            actionsCell.appendChild(deleteBtn);
        });
    }

    function renderQualificationsTable() {
        if (!qualificationsTableBody) return;
        qualificationsTableBody.innerHTML = '';
        QUALIFICATIONS_DATA.forEach(q => {
            const row = qualificationsTableBody.insertRow();
            row.insertCell().textContent = q.id;
            row.insertCell().textContent = q.name;
            const actionsCell = row.insertCell();
            const editBtn = document.createElement('button');
            editBtn.textContent = 'Modifier';
            editBtn.onclick = () => handleEditQualification(q.id);
            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'Supprimer';
            deleteBtn.onclick = () => handleDeleteQualification(q.id);
            actionsCell.appendChild(editBtn);
            actionsCell.appendChild(deleteBtn);
        });
    }

    function renderGradesTable() {
        if (!gradesTableBody) return;
        gradesTableBody.innerHTML = '';
        GRADES_DATA.forEach(g => {
            const row = gradesTableBody.insertRow();
            row.insertCell().textContent = g.id;
            row.insertCell().textContent = g.name;
            const actionsCell = row.insertCell();
            const editBtn = document.createElement('button');
            editBtn.textContent = 'Modifier';
            editBtn.onclick = () => handleEditGrade(g.id);
            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'Supprimer';
            deleteBtn.onclick = () => handleDeleteGrade(g.id);
            actionsCell.appendChild(editBtn);
            actionsCell.appendChild(deleteBtn);
        });
    }

    function renderFunctionsTable() {
        if (!functionsTableBody) return;
        functionsTableBody.innerHTML = '';
        FUNCTIONS_DATA.forEach(f => {
            const row = functionsTableBody.insertRow();
            row.insertCell().textContent = f.id;
            row.insertCell().textContent = f.name;
            const actionsCell = row.insertCell();
            const editBtn = document.createElement('button');
            editBtn.textContent = 'Modifier';
            editBtn.onclick = () => handleEditFunction(f.id);
            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'Supprimer';
            deleteBtn.onclick = () => handleDeleteFunction(f.id);
            actionsCell.appendChild(editBtn);
            actionsCell.appendChild(deleteBtn);
        });
    }

    // Rendu du planning global
    function renderGlobalPlanning(selectedWeekNum) {
        if (!planningTableBody || !planningTableHead) return;

        planningTableBody.innerHTML = '';
        planningTableHead.innerHTML = '';

        const daysOfWeekNames = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

        // Générer l'en-tête du tableau (jours de la semaine)
        const headerRow = document.createElement('tr');
        headerRow.innerHTML = '<th>Agent / Jour</th>'; // Première colonne pour les noms d'agent
        for (let i = 0; i < 7; i++) {
            const date = new Date(currentPlanningMonday);
            date.setDate(currentPlanningMonday.getDate() + i);
            headerRow.innerHTML += `<th class="day-header">${daysOfWeekNames[i].charAt(0).toUpperCase() + daysOfWeekNames[i].slice(1)} (${formatDate(date)})</th>`;
        }
        planningTableHead.appendChild(headerRow);

        // Obtenir tous les IDs d'agent uniques ayant des données de planning
        const allAgentIds = Object.keys(GLOBAL_PLANNING_DATA);
        // Trier les agents par nom/prénom pour un affichage cohérent
        allAgentIds.sort((a, b) => {
            const nameA = USERS_DATA[a] ? `${USERS_DATA[a].prenom} ${USERS_DATA[a].nom}` : a;
            const nameB = USERS_DATA[b] ? `${USERS_DATA[b].prenom} ${USERS_DATA[b].nom}` : b;
            return nameA.localeCompare(nameB);
        });

        // Créer une ligne pour chaque agent
        allAgentIds.forEach(agentId => {
            const agentPlanning = GLOBAL_PLANNING_DATA[agentId];
            const agentDetail = USERS_DATA[agentId]; // Récupère les détails de l'agent depuis USERS_DATA
            const agentName = agentDetail ? `${agentDetail.prenom} ${agentDetail.nom}` : agentId;

            const agentRow = document.createElement('tr');
            agentRow.innerHTML = `<td class="agent-name-cell">${agentName}</td>`; // Première cellule : nom de l'agent

            // Parcourir chaque jour de la semaine
            for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
                const dayName = daysOfWeekNames[dayIndex];
                const dayCell = document.createElement('td');
                dayCell.classList.add('planning-cell');

                // Récupérer le planning de l'agent pour la semaine et le jour actuels
                const weekKey = `S ${selectedWeekNum}`;
                const currentWeekDayPlanning = agentPlanning && agentPlanning[weekKey] && agentPlanning[weekKey][dayName] ? agentPlanning[weekKey][dayName] : [];

                if (currentWeekDayPlanning && currentWeekDayPlanning.length > 0) {
                    const ul = document.createElement('ul');
                    currentWeekDayPlanning.forEach(slot => {
                        const li = document.createElement('li');
                        li.textContent = formatSlotTime(slot.start, slot.end);
                        ul.appendChild(li);
                    });
                    dayCell.appendChild(ul);
                } else {
                    dayCell.textContent = 'Indispo'; // Ou vide si pas de dispo
                }
                agentRow.appendChild(dayCell);
            }
            planningTableBody.appendChild(agentRow);
        });
    }

    // --- Fonctions de gestion d'événements (ajout/modification/suppression) ---

    // Placeholder functions for CRUD operations - to be fully implemented based on your forms/modals
    async function handleAddAgent() { /* ... */ }
    async function handleEditAgent(id) { /* ... */ }
    async function handleDeleteAgent(id) {
        if (!confirm(`Voulez-vous vraiment supprimer l'agent ${id} ? Cette action est irréversible.`)) return;
        showLoading(true);
        try {
            const token = sessionStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/admin/agents/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders(token)
            });
            if (response.ok) {
                displayMessageModal('Succès', 'Agent supprimé avec succès.', 'success');
                await loadAgents(); // Recharger la liste
                await loadPlanningData(currentPlanningWeekNum); // Recharger le planning
            } else {
                const errorData = await response.json();
                displayMessageModal('Erreur', `Échec de la suppression de l'agent : ${errorData.message || response.statusText}`, 'error');
            }
        } catch (error) {
            console.error('Erreur réseau lors de la suppression de l\'agent :', error);
            displayMessageModal('Erreur réseau', 'Impossible de joindre le serveur pour supprimer l\'agent.', 'error');
        } finally {
            showLoading(false);
        }
    }

    async function handleAddQualification() { /* ... */ }
    async function handleEditQualification(id) { /* ... */ }
    async function handleDeleteQualification(id) {
        if (!confirm(`Voulez-vous vraiment supprimer la qualification ${id} ?`)) return;
        showLoading(true);
        try {
            const token = sessionStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/qualifications/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders(token)
            });
            if (response.ok) {
                displayMessageModal('Succès', 'Qualification supprimée.', 'success');
                await loadQualifications();
                await loadAgents(); // Peut affecter les agents
            } else {
                const errorData = await response.json();
                displayMessageModal('Erreur', `Échec de la suppression de la qualification : ${errorData.message || response.statusText}`, 'error');
            }
        } catch (error) {
            console.error('Erreur réseau lors de la suppression de la qualification :', error);
        } finally {
            showLoading(false);
        }
    }

    async function handleAddGrade() { /* ... */ }
    async function handleEditGrade(id) { /* ... */ }
    async function handleDeleteGrade(id) {
        if (!confirm(`Voulez-vous vraiment supprimer le grade ${id} ?`)) return;
        showLoading(true);
        try {
            const token = sessionStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/grades/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders(token)
            });
            if (response.ok) {
                displayMessageModal('Succès', 'Grade supprimé.', 'success');
                await loadGrades();
                await loadAgents(); // Peut affecter les agents
            } else {
                const errorData = await response.json();
                displayMessageModal('Erreur', `Échec de la suppression du grade : ${errorData.message || response.statusText}`, 'error');
            }
        } catch (error) {
            console.error('Erreur réseau lors de la suppression du grade :', error);
        } finally {
            showLoading(false);
        }
    }

    async function handleAddFunction() { /* ... */ }
    async function handleEditFunction(id) { /* ... */ }
    async function handleDeleteFunction(id) {
        if (!confirm(`Voulez-vous vraiment supprimer la fonction ${id} ?`)) return;
        showLoading(true);
        try {
            const token = sessionStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/functions/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders(token)
            });
            if (response.ok) {
                displayMessageModal('Succès', 'Fonction supprimée.', 'success');
                await loadFunctions();
                await loadAgents(); // Peut affecter les agents
            } else {
                const errorData = await response.json();
                displayMessageModal('Erreur', `Échec de la suppression de la fonction : ${errorData.message || response.statusText}`, 'error');
            }
        } catch (error) {
            console.error('Erreur réseau lors de la suppression de la fonction :', error);
        } finally {
            showLoading(false);
        }
    }

    // --- Fonction d'export PDF (issue de votre code précédent) ---
    async function exportPdf() {
        const planningContainer = document.getElementById('planning-table-container'); // Conteneur du tableau de planning
        if (!planningContainer) {
            console.error("Le conteneur du planning n'a pas été trouvé pour l'export PDF.");
            displayMessageModal('Erreur d\'export', 'Contenu du planning introuvable.', 'error');
            return;
        }

        showLoading(true, true); // Active le spinner avec option pour PDF
        const initialOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden'; // Empêche le défilement pendant la capture

        try {
            // Assurez-vous que tous les éléments sont visibles si nécessaire pour la capture
            const elementsToIgnore = (element) => {
                // Ignore le spinner de chargement, les boutons de navigation, le modal de message, etc.
                return element.id === 'loading-spinner' ||
                       element.closest('.no-print') || // Utilisez une classe CSS 'no-print'
                       element.classList.contains('message-modal');
            };

            const canvas = await html2canvas(planningContainer, {
                scale: 3, // Augmente la résolution
                useCORS: true,
                allowTaint: true,
                ignoreElements: elementsToIgnore,
                scrollX: 0,
                scrollY: -window.scrollY // Capture depuis le haut de la page visible
            });

            const { jsPDF } = window.jspdf;
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('l', 'mm', 'a4'); // 'l' pour paysage, 'mm' pour millimètres, 'a4' pour format A4

            const imgWidth = 297; // Largeur A4 en paysage
            const pageHeight = 210; // Hauteur A4 en paysage
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            let heightLeft = imgHeight;
            let position = 0;

            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;

            while (heightLeft >= 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
            }

            pdf.save('planning_global.pdf');
            displayMessageModal('Export PDF', 'Le planning a été exporté en PDF avec succès.', 'success');

        } catch (error) {
            console.error('Erreur lors de l\'export PDF :', error);
            displayMessageModal('Erreur d\'export', 'Une erreur est survenue lors de la création du PDF.', 'error');
        } finally {
            showLoading(false);
            document.body.style.overflow = initialOverflow; // Rétablit le défilement
        }
    }


    // --- Écouteurs d'événements ---

    // Bouton de déconnexion
    const logoutButton = document.getElementById('logout-btn');
    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            sessionStorage.clear(); // Efface toutes les données de session
            window.location.href = '/index.html'; // Redirige vers la page de connexion
        });
    }

    // Gestion du sélecteur de semaine pour le planning
    function initPlanningWeekSelector() {
        if (!planningWeekSelect) return;

        planningWeekSelect.innerHTML = '';
        const today = new Date();
        const currentYear = today.getFullYear();

        // Générer des options pour quelques semaines avant et après la semaine actuelle
        for (let i = -5; i <= 5; i++) {
            const monday = getMonday(new Date(currentPlanningMonday));
            monday.setDate(monday.getDate() + i * 7);
            const weekNum = getWeekNumber(monday);
            const sunday = new Date(monday);
            sunday.setDate(sunday.getDate() + 6);

            const option = document.createElement('option');
            option.value = weekNum; // La valeur est le numéro de semaine
            option.textContent = `S ${weekNum} (${formatDate(monday)} au ${formatDate(sunday)})`;
            if (weekNum === currentPlanningWeekNum) {
                option.selected = true;
            }
            planningWeekSelect.appendChild(option);
        }

        planningWeekSelect.addEventListener('change', (event) => {
            currentPlanningWeekNum = parseInt(event.target.value, 10);
            // Mettre à jour currentPlanningMonday pour qu'il corresponde à la semaine sélectionnée
            const selectedWeekOption = Array.from(planningWeekSelect.options).find(opt => parseInt(opt.value) === currentPlanningWeekNum);
            if (selectedWeekOption) {
                 // Extraire la date de début de l'option (par ex. "01/01" de "S X (01/01 au 07/01)")
                const dateMatch = selectedWeekOption.textContent.match(/\((\d{2}\/\d{2})/);
                if (dateMatch) {
                    const [dayStr, monthStr] = dateMatch[1].split('/');
                    // Reconstruire la date du lundi pour l'année en cours
                    currentPlanningMonday = new Date(currentYear, parseInt(monthStr) - 1, parseInt(dayStr));
                    currentPlanningMonday = getMonday(currentPlanningMonday); // S'assurer que c'est bien un lundi
                }
            }
            renderGlobalPlanning(currentPlanningWeekNum);
        });
    }

    if (prevPlanningWeekBtn) {
        prevPlanningWeekBtn.addEventListener('click', () => {
            currentPlanningMonday.setDate(currentPlanningMonday.getDate() - 7);
            currentPlanningWeekNum = getWeekNumber(currentPlanningMonday);
            initPlanningWeekSelector(); // Recharge le sélecteur pour mettre à jour la sélection
            renderGlobalPlanning(currentPlanningWeekNum);
        });
    }

    if (nextPlanningWeekBtn) {
        nextPlanningWeekBtn.addEventListener('click', () => {
            currentPlanningMonday.setDate(currentPlanningMonday.getDate() + 7);
            currentPlanningWeekNum = getWeekNumber(currentPlanningMonday);
            initPlanningWeekSelector(); // Recharge le sélecteur
            renderGlobalPlanning(currentPlanningWeekNum);
        });
    }

    // Exemple d'un bouton pour l'export PDF (s'il existe dans votre HTML)
    const exportPdfBtn = document.getElementById('export-pdf-btn');
    if (exportPdfBtn) {
        exportPdfBtn.addEventListener('click', exportPdf);
    }

    // Charger les données au démarrage de la page
    loadAdminInfo();
});