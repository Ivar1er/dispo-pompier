const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcryptjs'); // Importation de bcryptjs

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Répertoire public
const PUBLIC_DIR = path.join(__dirname, 'public');
console.log('Dossier public:', PUBLIC_DIR);
app.use(express.static(PUBLIC_DIR));

// Répertoire persistant Render pour les plannings, les utilisateurs, les qualifications, les grades et les fonctions
const PERSISTENT_DIR = '/mnt/storage'; // Assurez-vous que ce répertoire est persistant sur Render

const DATA_DIR = path.join(PERSISTENT_DIR, 'plannings');
const USERS_FILE_PATH = path.join(PERSISTENT_DIR, 'users.json');
const QUALIFICATIONS_FILE_PATH = path.join(PERSISTENT_DIR, 'qualifications.json');
const GRADES_FILE_PATH = path.join(PERSISTENT_DIR, 'grades.json'); // Nouveau chemin pour les grades
const FONCTIONS_FILE_PATH = path.join(PERSISTENT_DIR, 'fonctions.json'); // Chemin mis à jour pour les fonctions

// Nouveaux chemins pour la persistance de la feuille de garde (si utilisés ailleurs)
const ROSTER_CONFIG_DIR = path.join(PERSISTENT_DIR, 'roster_configs');
const DAILY_ROSTER_DIR = path.join(PERSISTENT_DIR, 'daily_rosters');

let USERS = {}; // L'objet USERS sera chargé depuis le fichier
let AVAILABLE_QUALIFICATIONS = []; // La liste des qualifications disponibles sera chargée depuis le fichier
let AVAILABLE_GRADES = []; // Nouvelle variable pour les grades disponibles
let AVAILABLE_FONCTIONS = []; // Variable mise à jour pour les fonctions disponibles

// Mot de passe par défaut pour le premier administrateur si le fichier users.json n'existe pas
const DEFAULT_ADMIN_PASSWORD = 'supersecureadminpassword'; // À changer absolument en production !

// Fonction pour charger les utilisateurs depuis users.json
async function loadUsers() {
  try {
    const data = await fs.readFile(USERS_FILE_PATH, 'utf8');
    USERS = JSON.parse(data);
    console.log('Users loaded from', USERS_FILE_PATH);
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.warn('users.json not found. Creating default admin user.');
      // Create a default admin if the file does not exist
      const hashedDefaultPassword = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10);
      USERS = {
        admin: {
          prenom: "Admin",
          nom: "Admin",
          mdp: hashedDefaultPassword,
          role: "admin",
          qualifications: [],
          grades: [], // Initialisation des grades pour l'admin
          fonctions: [] // Initialisation des fonctions pour l'admin
        }
      };
      await saveUsers(); // Save the default admin
      console.log(`Default admin created (id: admin, mdp: ${DEFAULT_ADMIN_PASSWORD}).`);
    } else {
      console.error('Error loading users:', err);
    }
  }
}

// Fonction pour sauvegarder les utilisateurs vers users.json
async function saveUsers() {
  try {
    await fs.writeFile(USERS_FILE_PATH, JSON.stringify(USERS, null, 2), 'utf8');
    console.log('Users saved to', USERS_FILE_PATH);
  } catch (err) {
    console.error('Error saving users:', err);
  }
}

// Fonction pour charger les qualifications depuis qualifications.json
async function loadQualifications() {
  try {
    const data = await fs.readFile(QUALIFICATIONS_FILE_PATH, 'utf8');
    AVAILABLE_QUALIFICATIONS = JSON.parse(data);
    console.log('Qualifications loaded from', QUALIFICATIONS_FILE_PATH);
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.warn('qualifications.json not found. Creating default qualifications.');
      // Create some default qualifications if the file does not exist
      AVAILABLE_QUALIFICATIONS = [
        { id: 'chef-agr', name: 'Chef d\'Agrès' },
        { id: 'conducteur', name: 'Conducteur' },
        { id: 'equipier', name: 'Équipier' },
        { id: 'secouriste', name: 'Secouriste' }
      ];
      await saveQualifications(); // Save default qualifications
      console.log('Default qualifications created.');
    } else {
      console.error('Error loading qualifications:', err);
    }
  }
}

// Fonction pour sauvegarder les qualifications vers qualifications.json
async function saveQualifications() {
  try {
    await fs.writeFile(QUALIFICATIONS_FILE_PATH, JSON.stringify(AVAILABLE_QUALIFICATIONS, null, 2), 'utf8');
    console.log('Qualifications saved to', QUALIFICATIONS_FILE_PATH);
  } catch (err) {
    console.error('Error saving qualifications:', err);
  }
}

// NOUVELLE FONCTION : Charger les grades depuis grades.json
async function loadGrades() {
  try {
    const data = await fs.readFile(GRADES_FILE_PATH, 'utf8');
    AVAILABLE_GRADES = JSON.parse(data);
    console.log('Grades loaded from', GRADES_FILE_PATH);
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.warn('grades.json not found. Creating default grades.');
      AVAILABLE_GRADES = [
        { id: 'CATE', name: 'Chef d\'Agrès Tout Engin' },
        { id: 'CAUE', name: 'Chef d\'Agrès Un Engin' },
        { id: 'CAP', name: 'Caporal' },
        { id: 'SAP', name: 'Sapeur' }
      ];
      await saveGrades();
      console.log('Default grades created.');
    } else {
      console.error('Error loading grades:', err);
    }
  }
}

// NOUVELLE FONCTION : Sauvegarder les grades vers grades.json
async function saveGrades() {
  try {
    await fs.writeFile(GRADES_FILE_PATH, JSON.stringify(AVAILABLE_GRADES, null, 2), 'utf8');
    console.log('Grades saved to', GRADES_FILE_PATH);
  } catch (err) {
    console.error('Error saving grades:', err);
  }
}

// NOUVELLE FONCTION : Charger les fonctions depuis fonctions.json
async function loadFonctions() {
    try {
        const data = await fs.readFile(FONCTIONS_FILE_PATH, 'utf8');
        AVAILABLE_FONCTIONS = JSON.parse(data);
        console.log('Fonctions loaded from', FONCTIONS_FILE_PATH);
    } catch (err) {
        if (err.code === 'ENOENT') {
            console.warn('fonctions.json not found. Creating default fonctions.');
            AVAILABLE_FONCTIONS = [
                { id: 'EQ', name: 'Équipier' },
                { id: 'COD0', name: 'Conducteur VSAV' },
                { id: 'EQ1_FPT', name: 'Équipier 1 FPT' },
                { id: 'EQ2_FPT', name: 'Équipier 2 FPT' },
                { id: 'EQ1_FDF1', name: 'Équipier 1 FDF1' },
                { id: 'EQ2_FDF1', name: 'Équipier 2 FDF1' },
                { id: 'CA_VSAV', name: 'Chef Agrès VSAV' },
                { id: 'CA_FPT', name: 'Chef Agrès FPT' },
                { id: 'COD1', name: 'Conducteur FPT' },
                { id: 'COD2', name: 'Conducteur CCF' },
                { id: 'CA_FDF2', name: 'Chef Agrès FDF2' },
                { id: 'CA_VTU', name: 'Chef Agrès VTU' },
                { id: 'CA_VPMA', name: 'Chef Agrès VPMA' }
            ];
            await saveFonctions();
            console.log('Default fonctions created.');
        } else {
            console.error('Error loading fonctions:', err);
        }
    }
}

// NOUVELLE FONCTION : Sauvegarder les fonctions vers fonctions.json
async function saveFonctions() {
    try {
        await fs.writeFile(FONCTIONS_FILE_PATH, JSON.stringify(AVAILABLE_FONCTIONS, null, 2), 'utf8');
        console.log('Fonctions saved to', FONCTIONS_FILE_PATH);
    } catch (err) {
        console.error('Error saving fonctions:', err);
    }
}

// Fonction pour s'assurer que les dossiers de la feuille de garde existent
async function initializeRosterFolders() {
    await fs.mkdir(ROSTER_CONFIG_DIR, { recursive: true }).catch(console.error);
    await fs.mkdir(DAILY_ROSTER_DIR, { recursive: true }).catch(console.error);
    console.log('Roster data folders initialized.');
}

// Initialisation au démarrage du serveur
(async () => {
  await fs.mkdir(DATA_DIR, { recursive: true }).catch(console.error); // Creates the plannings folder
  await initializeRosterFolders(); // Initialize new roster folders
  await loadUsers(); // Loads users at server startup
  await loadQualifications(); // Loads qualifications at server startup
  await loadGrades(); // Charger les grades au démarrage
  await loadFonctions(); // Charger les fonctions au démarrage
  // La fonction initializeSampleRosterDataForTesting n'est pas appelée ici
  // car elle génère des données de feuille de garde spécifiques, pas des plannings d'agents.
  // Si vous voulez des plannings d'agents initiaux, vous devrez les ajouter manuellement
  // ou créer une fonction similaire à initializeSampleRosterDataForTesting
  // pour les fichiers agents.json.
})();

// Middleware to check if the user is an administrator
const authorizeAdmin = (req, res, next) => {
    // Dans une application de production, vous utiliseriez JWT ici.
    // Pour cette démo, on utilise un en-tête simple.
    const token = req.headers['authorization'];
    if (!token) {
        return res.status(401).json({ message: 'Accès non autorisé. Token manquant.' });
    }

    // Ici, le token est juste l'ID de l'utilisateur stocké dans sessionStorage
    // et passé en tant que 'Bearer admin' par exemple.
    // Vous devriez implémenter un JWT pour une sécurité réelle.
    const user = USERS['admin']; // Pour la démo, on suppose que seul 'admin' peut être admin
    if (user && token === `Bearer admin`) { // Vérification simplifiée pour la démo
        next();
    } else {
        return res.status(403).json({ message: 'Accès refusé. Rôle administrateur requis ou token invalide.' });
    }
};


// User login
app.post("/api/login", async (req, res) => {
  const { agent, mdp } = req.body;
  if (!agent || !mdp) {
    return res.status(400).json({ message: "Agent and password required" });
  }

  const user = USERS[agent.toLowerCase()];
  if (!user) {
    return res.status(401).json({ message: "Unknown agent" });
  }

  const isMatch = await bcrypt.compare(mdp, user.mdp);
  if (!isMatch) {
    return res.status(401).json({ message: "Incorrect password" });
  }

  // En production, renvoyez un JWT. Pour la démo, renvoyez l'ID de l'agent comme "token"
  // et les infos de l'utilisateur.
  res.json({ token: user.role === 'admin' ? 'admin' : agent.toLowerCase(), prenom: user.prenom, nom: user.nom, role: user.role });
});

// Read agent's planning (deprecated if planning is per week)
// If you want planning per agent and per week, you need to adjust this route.
// For now, it returns the content of agent.json which has keys like "lundi", "mardi"
app.get('/api/planning/:agent', async (req, res) => {
  const agent = req.params.agent.toLowerCase();
  const filePath = path.join(DATA_DIR, `${agent}.json`);

  try {
    const data = await fs.readFile(filePath, 'utf8');
    res.json(JSON.parse(data));
  } catch (err) {
    if (err.code === 'ENOENT') {
      res.json({}); // Return empty object if planning not found
    } else {
      console.error('Error reading planning:', err);
      res.status(500).json({ message: 'Server error when reading planning' });
    }
  }
});

// Save agent's planning
app.post('/api/planning/:agent', async (req, res) => {
  const agent = req.params.agent.toLowerCase();
  const newPlanningData = req.body; // { "lundi": ["07:00 - 07:30"], "mardi": [] }

  if (typeof newPlanningData !== 'object' || newPlanningData === null) {
    return res.status(400).json({ message: 'Invalid planning data' });
  }

  const filePath = path.join(DATA_DIR, `${agent}.json`);

  try {
    let currentPlanning = {};
    try {
      const data = await fs.readFile(filePath, 'utf8');
      currentPlanning = JSON.parse(data);
    } catch (err) {
      if (err.code !== 'ENOENT') {
          throw err;
      }
    }

    // Fusionne les nouvelles données avec les existantes (peut écraser des jours)
    const mergedPlanning = { ...currentPlanning, ...newPlanningData };
    await fs.writeFile(filePath, JSON.stringify(mergedPlanning, null, 2), 'utf8');

    res.json({ message: 'Planning saved successfully' });
  } catch (err) {
    console.error('Error saving planning:', err);
    res.status(500).json({ message: 'Server error when saving planning.' });
  }
});

// NOUVELLE ROUTE : Mise à jour d'un créneau spécifique pour un agent un jour donné
// PATCH /api/planning/:agentId/:day/:timeSlot
app.patch('/api/planning/:agentId/:day/:timeSlot', authorizeAdmin, async (req, res) => {
    const { agentId, day, timeSlot } = req.params;
    const { action } = req.body; // 'add' ou 'remove'

    const filePath = path.join(DATA_DIR, `${agentId.toLowerCase()}.json`);

    try {
        let agentPlanning = {};
        try {
            const data = await fs.readFile(filePath, 'utf8');
            agentPlanning = JSON.parse(data);
        } catch (err) {
            if (err.code !== 'ENOENT') {
                throw err;
            }
            // Si le fichier n'existe pas, initialiser un planning vide
            agentPlanning = {};
        }

        // Assurez-vous que le jour existe dans le planning
        if (!agentPlanning[day]) {
            agentPlanning[day] = [];
        }

        const currentSlots = agentPlanning[day];
        const slotExists = currentSlots.includes(timeSlot);

        if (action === 'add' && !slotExists) {
            currentSlots.push(timeSlot);
            currentSlots.sort(); // Garder les créneaux triés pour la cohérence
        } else if (action === 'remove' && slotExists) {
            agentPlanning[day] = currentSlots.filter(s => s !== timeSlot);
        } else {
            return res.status(400).json({ message: 'Action invalide ou état du créneau inchangé.' });
        }

        await fs.writeFile(filePath, JSON.stringify(agentPlanning, null, 2), 'utf8');
        res.json({ message: `Créneau ${timeSlot} pour ${agentId} le ${day} mis à jour.`, planning: agentPlanning[day] });

    } catch (error) {
        console.error(`Erreur lors de la mise à jour du créneau pour ${agentId}:`, error);
        res.status(500).json({ message: 'Erreur serveur lors de la mise à jour du créneau.' });
    }
});


// GET /api/planning (Global planning for admin view)
// This route now returns a structured object by agent, then by week, then by day.
// This matches how admin.js expects planningData to be structured.
app.get('/api/planning', authorizeAdmin, async (req, res) => {
    try {
        const files = await fs.readdir(DATA_DIR);
        const allPlannings = {};

        // Pour simuler la structure par semaine (puisque vos fichiers agents.json n'ont pas de semaine directe)
        // Nous allons créer une structure fictive 'week-XX' pour chaque agent
        // où tous les plannings du fichier agent.json sont regroupés sous la semaine actuelle.
        // C'est une simplification, si vous avez besoin d'historique par semaine réelle,
        // la structure de vos fichiers agents.json devra changer (ex: agent.json contient { "week-XX": { "lundi": [...] } }).

        const currentWeekNumber = getWeekNumber(new Date()); // Fonction utilitaire pour la semaine actuelle

        for (const file of files) {
            if (file.endsWith('.json')) {
                const agentId = path.basename(file, '.json');
                try {
                    const content = await fs.readFile(path.join(DATA_DIR, file), 'utf8');
                    const agentDailyPlanning = JSON.parse(content); // { "lundi": [...], "mardi": [...] }

                    // Groupez les plannings quotidiens sous la semaine actuelle
                    allPlannings[agentId] = {
                        [`week-${currentWeekNumber}`]: agentDailyPlanning // Exemple de structuration
                    };
                } catch (parseError) {
                    console.warn(`Error parsing planning file for agent ${agentId}: ${parseError.message}`);
                    // Si le fichier est corrompu, on l'ignore pour cet agent
                }
            }
        }
        res.json(allPlannings);
    } catch (err) {
        console.error('Error getting all plannings for admin view:', err);
        res.status(500).json({ message: 'Error getting plannings' });
    }
});


// --- Administration routes for agent management ---
// All these routes are protected by the authorizeAdmin middleware

// GET /api/admin-info - Get basic admin info (for welcome message)
app.get('/api/admin-info', authorizeAdmin, (req, res) => {
    // Si l'authentification est gérée par un token, vous pouvez dÃ©coder l'utilisateur
    // Pour cette dÃ©mo simplifiÃ©e, on renvoie un nom gÃ©nÃ©rique ou celui de l'admin par dÃ©faut.
    res.json({ username: 'Administrateur', role: 'admin' });
});

// GET /api/admin/agents - Get all agents (excluding admin) - UNIQUE DEFINITION
app.get('/api/admin/agents', authorizeAdmin, (req, res) => {
    const agentsList = Object.keys(USERS)
        .filter(key => USERS[key].role === 'agent' || USERS[key].role === 'admin') // Inclure admin si vous voulez qu'il apparaisse dans la liste, sinon filter par 'agent'
        .map(key => {
            const user = USERS[key];
            // RÃ©cupÃ©rer les noms des grades Ã  partir de leurs IDs
            const gradeNames = (user.grades || []).map(gradeId => {
                const grade = AVAILABLE_GRADES.find(g => g.id === gradeId);
                return grade ? grade.name : gradeId; // Renvoie le nom si trouvÃ©, sinon l'ID
            });
             // RÃ©cupÃ©rer les noms des fonctions Ã  partir de leurs IDs
            const fonctionNames = (user.fonctions || []).map(fonctionId => {
                const fonction = AVAILABLE_FONCTIONS.find(f => f.id === fonctionId);
                return fonction ? fonction.name : fonctionId; // Renvoie le nom si trouvÃ©, sinon l'ID
            });
            return {
                id: key, // Use the key from the USERS object as a unique identifier
                nom: user.nom,
                prenom: user.prenom,
                qualifications: user.qualifications || [], // Include qualifications (IDs)
                grades: user.grades || [], // Inclure les grades (IDs)
                grade_nom: gradeNames.join(', '), // Nom(s) des grades
                fonctions: user.fonctions || [], // Inclure les fonctions (IDs)
                fonction_nom: fonctionNames.join(', ') // Nom(s) des fonctions
            };
        });
    res.json(agentsList);
});

// MODIFICATION : Cette route NE DOIT PAS être protégée par authorizeAdmin pour la page de connexion
// GET /api/agents/display-info - Get agent names and first names for general display
// (e.g., in planning view to map agent IDs to readable names)
app.get('/api/agents/display-info', (req, res) => { // Suppression de authorizeAdmin ici
    const displayInfos = Object.keys(USERS)
        .filter(key => USERS[key].role === 'agent' || USERS[key].role === 'admin')
        .map(key => ({
            id: key,
            nom: USERS[key].nom,
            prenom: USERS[key].prenom
        }));
    res.json(displayInfos);
});


// POST /api/admin/agents - Add a new agent
app.post('/api/admin/agents', authorizeAdmin, async (req, res) => {
    const { id, nom, prenom, password, qualifications, grades, fonctions } = req.body; // Inclure grades et fonctions
    if (!id || !nom || !prenom || !password) {
        return res.status(400).json({ message: 'Identifiant, nom, prÃ©nom et mot de passe sont requis.' });
    }
    const agentId = id.toLowerCase(); // Convert identifier to lowercase for consistency

    if (USERS[agentId]) {
        return res.status(409).json({ message: 'Cet identifiant d\'agent existe dÃ©jÃ .' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10); // Hash the password
        USERS[agentId] = {
            prenom: prenom,
            nom: nom,
            mdp: hashedPassword,
            role: 'agent', // Set the default role as 'agent'
            qualifications: qualifications || [], // Assign qualifications (empty array if not provided)
            grades: grades || [], // Assign grades
            fonctions: fonctions || [] // Assign functions
        };
        await saveUsers(); // Save changes to users.json file
        res.status(201).json({ message: 'Agent ajoutÃ© avec succÃ¨s', agent: { id: agentId, nom, prenom, qualifications: USERS[agentId].qualifications, grades: USERS[agentId].grades, fonctions: USERS[agentId].fonctions } });
    } catch (error) {
        console.error("Erreur lors de l'ajout de l'agent:", error);
        res.status(500).json({ message: 'Erreur serveur lors de l\'ajout de l\'agent.' });
    }
});

// PUT /api/admin/agents/:id - Modify an existing agent
app.put('/api/admin/agents/:id', authorizeAdmin, async (req, res) => {
    const agentId = req.params.id.toLowerCase();
    const { nom, prenom, newPassword, qualifications, grades, fonctions } = req.body; // Inclure grades et fonctions

    // Check if agent exists and is not an administrator (to avoid modifying admin via this route)
    if (!USERS[agentId] || (USERS[agentId].role !== 'agent' && agentId !== 'admin')) { // Permet de modifier l'admin lui-même via cette route si besoin
        return res.status(404).json({ message: 'Agent non trouvÃ© ou non modifiable via cette route.' });
    }

    // Update fields if provided
    USERS[agentId].nom = nom || USERS[agentId].nom;
    USERS[agentId].prenom = prenom || USERS[agentId].prenom;

    // Update password if a new one is provided
    if (newPassword) {
        try {
            USERS[agentId].mdp = await bcrypt.hash(newPassword, 10);
        } catch (error) {
            console.error("Erreur de hachage du mot de passe lors de la mise Ã  jour:", error);
            return res.status(500).json({ message: 'Erreur lors du hachage du nouveau mot de passe.' });
        }
    }

    // Update qualifications if provided
    if (Array.isArray(qualifications)) {
        USERS[agentId].qualifications = qualifications;
    }
    // Update grades if provided
    if (Array.isArray(grades)) {
        USERS[agentId].grades = grades;
    }
    // Update functions if provided
    if (Array.isArray(fonctions)) {
        USERS[agentId].fonctions = fonctions;
    }

    try {
        await saveUsers(); // Save changes
        res.json({ message: 'Agent mis Ã  jour avec succÃ¨s', agent: { id: agentId, nom: USERS[agentId].nom, prenom: USERS[agentId].prenom, qualifications: USERS[agentId].qualifications, grades: USERS[agentId].grades, fonctions: USERS[agentId].fonctions } });
    } catch (error) {
        console.error("Erreur lors de la mise Ã  jour de l'agent:", error);
        res.status(500).json({ message: 'Erreur serveur lors de la mise Ã  jour de l\'agent.' });
    }
});

// DELETE /api/admin/agents/:id - Delete an agent
app.delete('/api/admin/agents/:id', authorizeAdmin, async (req, res) => {
    const agentId = req.params.id.toLowerCase();

    // Check if agent exists and is not an administrator (to avoid deleting admin)
    if (!USERS[agentId] || USERS[agentId].role !== 'agent') {
        return res.status(404).json({ message: 'Agent non trouvÃ© ou non supprimable via cette route.' });
    }

    try {
        delete USERS[agentId]; // Delete the agent from the USERS object
        await saveUsers(); // Save changes

        // Also delete the agent's planning file if it exists
        const planningFilePath = path.join(DATA_DIR, `${agentId}.json`);
        try {
            await fs.unlink(planningFilePath);
            console.log(`Planning file ${agentId}.json deleted.`);
        } catch (err) {
            if (err.code === 'ENOENT') {
                console.warn(`Planning file ${agentId}.json did not exist.`);
            } else {
                console.error(`Error deleting planning file ${agentId}.json:`, err);
            }
        }

        res.json({ message: 'Agent et son planning (si existant) supprimÃ©s avec succÃ¨s.' });
    } catch (error) {
        console.error("Erreur lors de la suppression de l'agent:", error);
        res.status(500).json({ message: 'Erreur serveur lors de la suppression de l\'agent.' });
    }
});


// --- Qualifications Management Routes ---

// GET /api/qualifications - Get all available qualifications
app.get('/api/qualifications', authorizeAdmin, (req, res) => {
    res.json(AVAILABLE_QUALIFICATIONS);
});

// POST /api/qualifications - Add a new qualification
app.post('/api/qualifications', authorizeAdmin, async (req, res) => {
    const { id, name } = req.body;
    if (!id || !name) {
        return res.status(400).json({ message: 'ID et nom de la qualification sont requis.' });
    }
    const qualId = id.toLowerCase();
    if (AVAILABLE_QUALIFICATIONS.some(q => q.id === qualId)) {
        return res.status(409).json({ message: 'Cet ID de qualification existe dÃ©jÃ .' });
    }

    AVAILABLE_QUALIFICATIONS.push({ id: qualId, name: name });
    try {
        await saveQualifications();
        res.status(201).json({ message: 'Qualification ajoutÃ©e avec succÃ¨s', qualification: { id: qualId, name } });
    } catch (error) {
        console.error("Erreur lors de l'ajout de la qualification:", error);
        res.status(500).json({ message: 'Erreur serveur lors de l\'ajout de la qualification.' });
    }
});

// PUT /api/qualifications/:id - Modify an existing qualification
app.put('/api/qualifications/:id', authorizeAdmin, async (req, res) => {
    const qualId = req.params.id.toLowerCase();
    const { name } = req.body;

    const index = AVAILABLE_QUALIFICATIONS.findIndex(q => q.id === qualId);
    if (index === -1) {
        return res.status(404).json({ message: 'Qualification non trouvÃ©e.' });
    }

    AVAILABLE_QUALIFICATIONS[index].name = name || AVAILABLE_QUALIFICATIONS[index].name;
    try {
        await saveQualifications();
        res.json({ message: 'Qualification mise Ã  jour avec succÃ¨s', qualification: AVAILABLE_QUALIFICATIONS[index] });
    } catch (error) {
        console.error("Erreur lors de la mise Ã  jour de la qualification:", error);
        res.status(500).json({ message: 'Erreur serveur lors de la mise Ã  jour de la qualification.' });
    }
});

// DELETE /api/qualifications/:id - Delete a qualification
app.delete('/api/qualifications/:id', authorizeAdmin, async (req, res) => {
    const qualId = req.params.id.toLowerCase();

    const initialLength = AVAILABLE_QUALIFICATIONS.length;
    AVAILABLE_QUALIFICATIONS = AVAILABLE_QUALIFICATIONS.filter(q => q.id !== qualId);

    if (AVAILABLE_QUALIFICATIONS.length === initialLength) {
        return res.status(404).json({ message: 'Qualification non trouvÃ©e.' });
    }

    // Optional: Remove this qualification from all users who have it
    let usersModified = false;
    for (const userId in USERS) {
        if (USERS[userId].qualifications && USERS[userId].qualifications.includes(qualId)) {
            USERS[userId].qualifications = USERS[userId].qualifications.filter(q => q !== qualId);
            usersModified = true;
        }
    }

    try {
        await saveQualifications();
        if (usersModified) {
            await saveUsers(); // Save users if their qualifications were updated
        }
        res.json({ message: 'Qualification supprimÃ©e avec succÃ¨s.' });
    } catch (error) {
        console.error("Erreur lors de la suppression de la qualification:", error);
        res.status(500).json({ message: 'Erreur serveur lors de la suppression de la qualification.' });
    }
});

// --- NOUVELLES ROUTES POUR LA GESTION DES GRADES ---

// GET /api/grades - Get all available grades
app.get('/api/grades', authorizeAdmin, (req, res) => {
    res.json(AVAILABLE_GRADES);
});

// POST /api/grades - Add a new grade
app.post('/api/grades', authorizeAdmin, async (req, res) => {
    const { id, name } = req.body;
    if (!id || !name) {
        return res.status(400).json({ message: 'ID et nom du grade sont requis.' });
    }
    const gradeId = id.toUpperCase(); // Les IDs de grade sont gÃ©nÃ©ralement en majuscules
    if (AVAILABLE_GRADES.some(g => g.id === gradeId)) {
        return res.status(409).json({ message: 'Cet ID de grade existe dÃ©jÃ .' });
    }

    AVAILABLE_GRADES.push({ id: gradeId, name: name });
    try {
        await saveGrades();
        res.status(201).json({ message: 'Grade ajoutÃ© avec succÃ¨s', grade: { id: gradeId, name } });
    } catch (error) {
        console.error("Erreur lors de l'ajout du grade:", error);
        res.status(500).json({ message: "Erreur serveur lors de l'ajout du grade." });
    }
});

// PUT /api/grades/:id - Modify an existing grade
app.put('/api/grades/:id', authorizeAdmin, async (req, res) => {
    const gradeId = req.params.id.toUpperCase();
    const { name } = req.body;

    const index = AVAILABLE_GRADES.findIndex(g => g.id === gradeId);
    if (index === -1) {
        return res.status(404).json({ message: 'Grade non trouvÃ©.' });
    }

    AVAILABLE_GRADES[index].name = name || AVAILABLE_GRADES[index].name;
    try {
        await saveGrades();
        res.json({ message: 'Grade mis Ã  jour avec succÃ¨s', grade: AVAILABLE_GRADES[index] });
    } catch (error) {
        console.error("Erreur lors de la mise Ã  jour du grade:", error);
        res.status(500).json({ message: "Erreur serveur lors de la mise Ã  jour du grade." });
    }
});

// DELETE /api/grades/:id - Delete a grade
app.delete('/api/grades/:id', authorizeAdmin, async (req, res) => {
    const gradeId = req.params.id.toUpperCase();

    const initialLength = AVAILABLE_GRADES.length;
    AVAILABLE_GRADES = AVAILABLE_GRADES.filter(g => g.id !== gradeId);

    if (AVAILABLE_GRADES.length === initialLength) {
        return res.status(404).json({ message: 'Grade non trouvÃ©.' });
    }

    // Optionnel: Supprimer ce grade de tous les utilisateurs qui l'ont
    let usersModified = false;
    for (const userId in USERS) {
        if (USERS[userId].grades && USERS[userId].grades.includes(gradeId)) {
            USERS[userId].grades = USERS[userId].grades.filter(g => g !== gradeId);
            usersModified = true;
        }
    }

    try {
        await saveGrades();
        if (usersModified) {
            await saveUsers();
        }
        res.json({ message: 'Grade supprimÃ© avec succÃ¨s.' });
    } catch (error) {
        console.error("Erreur lors de la suppression du grade:", error);
        res.status(500).json({ message: "Erreur serveur lors de la suppression du grade." });
    }
});

// --- NOUVELLES ROUTES POUR LA GESTION DES FONCTIONS ---

// GET /api/fonctions - Get all available fonctions
app.get('/api/fonctions', authorizeAdmin, (req, res) => {
    res.json(AVAILABLE_FONCTIONS);
});

// POST /api/fonctions - Add a new fonction
app.post('/api/fonctions', authorizeAdmin, async (req, res) => {
    const { id, name } = req.body;
    if (!id || !name) {
        return res.status(400).json({ message: 'ID et nom de la fonction sont requis.' });
    }
    const fonctionId = id; // Garder l'ID tel quel si les fonctions ont des IDs spÃ©cifiques
    if (AVAILABLE_FONCTIONS.some(f => f.id === fonctionId)) {
        return res.status(409).json({ message: 'Cet ID de fonction existe dÃ©jÃ .' });
    }

    AVAILABLE_FONCTIONS.push({ id: fonctionId, name: name });
    try {
        await saveFonctions();
        res.status(201).json({ message: 'Fonction ajoutÃ©e avec succÃ¨s', fonction: { id: fonctionId, name } });
    } catch (error) {
        console.error("Erreur lors de l'ajout de la fonction:", error);
        res.status(500).json({ message: "Erreur serveur lors de l'ajout de la fonction." });
    }
});

// PUT /api/fonctions/:id - Modify an existing fonction
app.put('/api/fonctions/:id', authorizeAdmin, async (req, res) => {
    const fonctionId = req.params.id;
    const { name } = req.body;

    const index = AVAILABLE_FONCTIONS.findIndex(f => f.id === fonctionId);
    if (index === -1) {
        return res.status(404).json({ message: 'Fonction non trouvÃ©e.' });
    }

    AVAILABLE_FONCTIONS[index].name = name || AVAILABLE_FONCTIONS[index].name;
    try {
        await saveFonctions();
        res.json({ message: 'Fonction mise Ã  jour avec succÃ¨s', fonction: AVAILABLE_FONCTIONS[index] });
    } catch (error) {
        console.error("Erreur lors de la mise Ã  jour de la fonction:", error);
        res.status(500).json({ message: "Erreur serveur lors de la mise Ã  jour de la fonction." });
    }
});

// DELETE /api/fonctions/:id - Delete a fonction
app.delete('/api/fonctions/:id', authorizeAdmin, async (req, res) => {
    const fonctionId = req.params.id;

    const initialLength = AVAILABLE_FONCTIONS.length;
    AVAILABLE_FONCTIONS = AVAILABLE_FONCTIONS.filter(f => f.id !== fonctionId);

    if (AVAILABLE_FONCTIONS.length === initialLength) {
        return res.status(404).json({ message: 'Fonction non trouvÃ©e.' });
    }

    // Optionnel: Supprimer cette fonction de tous les utilisateurs qui l'ont
    let usersModified = false;
    for (const userId in USERS) {
        if (USERS[userId].fonctions && USERS[userId].fonctions.includes(fonctionId)) {
            USERS[userId].fonctions = USERS[userId].fonctions.filter(f => f !== fonctionId);
            usersModified = true;
        }
    }

    try {
        await saveFonctions();
        if (usersModified) {
            await saveUsers();
        }
        res.json({ message: 'Fonction supprimÃ©e avec succÃ¨s.' });
    } catch (error) {
        console.error("Erreur lors de la suppression de la fonction:", error);
        res.status(500).json({ message: "Erreur serveur lors de la suppression de la fonction." });
    }
});


// --- NOUVELLES ROUTES POUR LA FEUILLE DE GARDE (AJOUTÃ‰ES) ---

// GET /api/roster-config/:dateKey
// RÃ©cupÃ¨re la configuration (crÃ©neaux, agents d'astreinte) pour une date
app.get('/api/roster-config/:dateKey', async (req, res) => {
    const dateKey = req.params.dateKey;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
        return res.status(400).json({ message: 'Format de date invalide. Attendu-MM-DD.' });
    }
    const filePath = path.join(ROSTER_CONFIG_DIR, `${dateKey}.json`);
    try {
        const data = await fs.readFile(filePath, 'utf8');
        res.json(JSON.parse(data));
    } catch (err) {
        if (err.code === 'ENOENT') {
            res.status(404).json({ message: 'Configuration de feuille de garde non trouvÃ©e pour cette date.' });
        } else {
            console.error(`Error reading roster config for ${dateKey}:`, err);
            res.status(500).json({ message: 'Server error when reading roster config.' });
        }
    }
});

// POST /api/roster-config/:dateKey
// Sauvegarde ou met Ã  jour la configuration pour une date
app.post('/api/roster-config/:dateKey', authorizeAdmin, async (req, res) => {
    const dateKey = req.params.dateKey;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
        return res.status(400).json({ message: 'Format de date invalide. Attendu-MM-DD.' });
    }
    const { timeSlots, onDutyAgents } = req.body;
    if (!timeSlots || !onDutyAgents) {
        return res.status(400).json({ message: 'DonnÃ©es de configuration manquantes (timeSlots ou onDutyAgents).' });
    }
    const filePath = path.join(ROSTER_CONFIG_DIR, `${dateKey}.json`);
    try {
        await fs.writeFile(filePath, JSON.stringify({ timeSlots, onDutyAgents }, null, 2), 'utf8');
        res.status(200).json({ message: 'Configuration de feuille de garde sauvegardÃ©e avec succÃ¨s.' });
    } catch (error) {
        console.error(`Error saving roster config for ${dateKey}:`, error);
        res.status(500).json({ message: 'Erreur serveur lors de la sauvegarde de la configuration.' });
    }
});

// GET /api/daily-roster/:dateKey
// RÃ©cupÃ¨re les affectations d'engins pour une date spÃ©cifique
app.get('/api/daily-roster/:dateKey', async (req, res) => {
    const dateKey = req.params.dateKey;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
        return res.status(400).json({ message: 'Format de date invalide. Attendu-MM-DD.' });
    }
    const filePath = path.join(DAILY_ROSTER_DIR, `${dateKey}.json`);
    try {
        const data = await fs.readFile(filePath, 'utf8');
        res.json(JSON.parse(data));
    } catch (err) {
        if (err.code === 'ENOENT') {
            res.status(404).json({ message: 'Feuille de garde d\'affectation non trouvÃ©e pour cette date.' });
        } else {
            console.error(`Error reading daily roster for ${dateKey}:`, err);
            res.status(500).json({ message: 'Erreur serveur lors de la lecture de la feuille de garde quotidienne.' });
        }
    }
});

// POST /api/daily-roster/:dateKey
// Sauvegarde ou met Ã  jour les affectations d'engins pour une date spÃ©cifique
app.post('/api/daily-roster/:dateKey', authorizeAdmin, async (req, res) => {
    const dateKey = req.params.dateKey;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
        return res.status(400).json({ message: 'Format de date invalide. Attendu-MM-DD.' });
    }
    const { roster } = req.body;
    if (!roster) {
        return res.status(400).json({ message: 'DonnÃ©es de feuille de garde manquantes (roster).' });
    }
    const filePath = path.join(DAILY_ROSTER_DIR, `${dateKey}.json`);
    try {
        await fs.writeFile(filePath, JSON.stringify({ roster }, null, 2), 'utf8'); // Stocke l'objet roster complet
        res.status(200).json({ message: 'Feuille de garde d\'affectation sauvegardÃ©e avec succÃ¨s.' });
    } catch (error) {
        console.error(`Error saving daily roster for ${dateKey}:`, error);
        res.status(500).json({ message: 'Erreur serveur lors de la sauvegarde de la feuille de garde quotidienne.' });
    }
});


// 🔧 ROUTE DE TEST DISK RENDER (Ã  conserver pour la vÃ©rification de persistance sur Render)
const diskTestPath = path.join(PERSISTENT_DIR, 'test.txt');

app.get('/test-disk', async (req, res) => {
  try {
    await fs.writeFile(diskTestPath, 'Test from /test-disk route');
    const contenu = await fs.readFile(diskTestPath, 'utf8');
    res.send(`Disk content: ${contenu}`);
  } catch (err) {
    res.status(500).send(`Disk error: ${err.message}`);
  }
});

app.listen(port, () => {
  console.log(`Server launched on http://localhost:${port}`);
});

// --- Fonctions utilitaires (Ã  inclure si elles ne sont pas dÃ©jÃ  dÃ©finies ailleurs) ---
// Fonction pour obtenir le numÃ©ro de semaine ISO 8601
function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    var weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return weekNo;
}

// Fonction pour obtenir le nom du jour en franÃ§ais
function getDayName(date) {
    const days = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    return days[date.getDay()];
}

// Fonction pour formater la date en-MM-DD
function formatDateToYYYYMMDD(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// NOTE: initializeSampleRosterDataForTesting n'est pas appelÃ©e ici
// car elle gÃ©nÃ¨re des donnÃ©es spÃ©cifiques aux "feuilles de garde"
// et non aux "plannings d'agents" qui sont les fichiers agent.json.
// Si vous avez besoin d'initialiser des fichiers agent.json,
// vous devrez ajouter une fonction sÃ©parÃ©e pour cela.
