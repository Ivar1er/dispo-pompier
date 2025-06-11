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

// Répertoire persistant Render pour les plannings, les utilisateurs et les qualifications
const PERSISTENT_DIR = '/mnt/storage'; // Assurez-vous que ce répertoire est persistant sur Render
// Pour le développement local, vous pouvez utiliser :
// const PERSISTENT_DIR = process.env.NODE_ENV === 'production' ? '/mnt/storage' : path.join(__dirname, 'data');

const DATA_DIR = path.join(PERSISTENT_DIR, 'plannings');
const USERS_FILE_PATH = path.join(PERSISTENT_DIR, 'users.json');
const QUALIFICATIONS_FILE_PATH = path.join(PERSISTENT_DIR, 'qualifications.json');
const GRADES_FILE_PATH = path.join(PERSISTENT_DIR, 'grades.json'); // Nouveau chemin pour les grades
const FUNCTIONS_FILE_PATH = path.join(PERSISTENT_DIR, 'functions.json'); // Nouveau chemin pour les fonctions

// Nouveaux chemins pour la persistance de la feuille de garde
const ROSTER_CONFIG_DIR = path.join(PERSISTENT_DIR, 'roster_configs');
const DAILY_ROSTER_DIR = path.join(PERSISTENT_DIR, 'daily_rosters');

let USERS = {}; // L'objet USERS sera chargé depuis le fichier
let AVAILABLE_QUALIFICATIONS = []; // La liste des qualifications disponibles sera chargée depuis le fichier
let AVAILABLE_GRADES = []; // Nouvelle: La liste des grades disponibles sera chargée depuis le fichier
let AVAILABLE_FUNCTIONS = []; // Nouvelle: La liste des fonctions disponibles sera chargée depuis le fichier

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
          mdp: hashedPassword,
          role: "admin",
          qualifications: [], // Admin starts with no qualifications
          grades: [], // Nouvelle: Admin starts with no grades
          functions: [] // Nouvelle: Admin starts with no functions
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

// Nouvelle fonction pour charger les grades depuis grades.json
async function loadGrades() {
    try {
        const data = await fs.readFile(GRADES_FILE_PATH, 'utf8');
        AVAILABLE_GRADES = JSON.parse(data);
        console.log('Grades loaded from', GRADES_FILE_PATH);
    } catch (err) {
        if (err.code === 'ENOENT') {
            console.warn('grades.json not found. Creating default grades.');
            AVAILABLE_GRADES = [
                { id: 'sap', name: 'Sapeur' },
                { id: 'cpl', name: 'Caporal' },
                { id: 'sgt', name: 'Sergent' },
                { id: 'adj', name: 'Adjudant' }
            ];
            await saveGrades();
            console.log('Default grades created.');
        } else {
            console.error('Error loading grades:', err);
        }
    }
}

// Nouvelle fonction pour sauvegarder les grades vers grades.json
async function saveGrades() {
    try {
        await fs.writeFile(GRADES_FILE_PATH, JSON.stringify(AVAILABLE_GRADES, null, 2), 'utf8');
        console.log('Grades saved to', GRADES_FILE_PATH);
    } catch (err) {
        console.error('Error saving grades:', err);
    }
}

// Nouvelle fonction pour charger les fonctions depuis functions.json
async function loadFunctions() {
    try {
        const data = await fs.readFile(FUNCTIONS_FILE_PATH, 'utf8');
        AVAILABLE_FUNCTIONS = JSON.parse(data);
        console.log('Functions loaded from', FUNCTIONS_FILE_PATH);
    } catch (err) {
        if (err.code === 'ENOENT') {
            console.warn('functions.json not found. Creating default functions.');
            AVAILABLE_FUNCTIONS = [
                { id: 'standard', name: 'Standard' },
                { id: 'maint', name: 'Maintenance' },
                { id: 'com', name: 'Communication' }
            ];
            await saveFunctions();
            console.log('Default functions created.');
        } else {
            console.error('Error loading functions:', err);
        }
    }
}

// Nouvelle fonction pour sauvegarder les fonctions vers functions.json
async function saveFunctions() {
    try {
        await fs.writeFile(FUNCTIONS_FILE_PATH, JSON.stringify(AVAILABLE_FUNCTIONS, null, 2), 'utf8');
        console.log('Functions saved to', FUNCTIONS_FILE_PATH);
    } catch (err) {
        console.error('Error saving functions:', err);
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
  await loadGrades(); // Nouvelle: Loads grades at server startup
  await loadFunctions(); // Nouvelle: Loads functions at server startup
})();

// Middleware to check if the user is an administrator
// WARNING: This implementation is temporary and simplified for demonstration.
// In a production application, you should use a session system (express-session)
// or JSON Web Tokens (JWT) for secure authentication and authorization.
// For now, it's assumed the client sends an 'X-User-Role: admin' header
// after a successful admin login. This is NOT secure in production.
const authorizeAdmin = (req, res, next) => {
    const userRole = req.headers['x-user-role'];
    if (userRole === 'admin') {
        next();
    } else {
        return res.status(403).json({ message: 'Access denied. Administrator role required.' });
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

  // Retourne les informations complètes de l'utilisateur y compris qualifications, grades, functions
  res.json({
    prenom: user.prenom,
    nom: user.nom,
    role: user.role,
    qualifications: user.qualifications || [],
    grades: user.grades || [],
    functions: user.functions || []
  });
});

// Read agent's planning
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
  const newPlanningData = req.body;

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
          // Si l'erreur n'est pas "fichier non trouvé", la propager
          throw err;
      }
      // Si c'est "fichier non trouvé", currentPlanning reste {}
    }

    const mergedPlanning = { ...currentPlanning, ...newPlanningData };
    await fs.writeFile(filePath, JSON.stringify(mergedPlanning, null, 2), 'utf8');

    res.json({ message: 'Planning saved successfully' });
  } catch (err) {
    console.error('Error saving planning:', err);
    res.status(500).json({ message: 'Server error when saving planning.' });
  }
});

// GET /api/planning (This route is problematic if intended for all plannings due to `agent` param ambiguity)
// It is recommended to use specific routes or modify the frontend to call `/api/planning/:agent` for each agent.
// For now, if your frontend *does* call this to get all plannings, this existing route should work.
// I'm keeping it as is since it's already in your provided server.js
app.get('/api/planning', async (req, res) => {
  try {
    const files = await fs.readdir(DATA_DIR);
    const allPlannings = {};

    for (const file of files) {
      if (file.endsWith('.json')) {
        const agent = path.basename(file, '.json');
        const content = await fs.readFile(path.join(DATA_DIR, file), 'utf8');
        allPlannings[agent] = JSON.parse(content);
      }
    }

    res.json(allPlannings);
  } catch (err) {
    console.error('Error getting all plannings:', err);
    res.status(500).json({ message: 'Error getting plannings' });
  }
});

// --- Administration routes for agent management ---
// All these routes are protected by the authorizeAdmin middleware

// GET /api/admin/agents - Get all agents (excluding admin) - UNIQUE DEFINITION
app.get('/api/admin/agents', authorizeAdmin, (req, res) => {
    const agentsList = Object.keys(USERS)
        .filter(key => USERS[key].role === 'agent' || USERS[key].role === 'admin') // Include admin for dropdown/list purposes if needed
        .map(key => ({
            id: key, // Use the key from the USERS object as a unique identifier
            nom: USERS[key].nom,
            prenom: USERS[key].prenom,
            qualifications: USERS[key].qualifications || [], // Include qualifications
            grades: USERS[key].grades || [], // Nouvelle: Inclure les grades
            functions: USERS[key].functions || [] // Nouvelle: Inclure les fonctions
        }));
    res.json(agentsList);
});

// POST /api/admin/agents - Add a new agent
app.post('/api/admin/agents', authorizeAdmin, async (req, res) => {
    const { id, nom, prenom, password, qualifications, grades, functions } = req.body; // 'id' will be the unique identifier (e.g., username)
    if (!id || !nom || !prenom || !password) {
        return res.status(400).json({ message: 'Identifier, last name, first name and password are required.' });
    }
    const agentId = id.toLowerCase(); // Convert identifier to lowercase for consistency

    if (USERS[agentId]) {
        return res.status(409).json({ message: 'This agent identifier already exists.' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10); // Hash the password
        USERS[agentId] = {
            prenom: prenom,
            nom: nom,
            mdp: hashedPassword,
            role: 'agent', // Set the default role as 'agent'
            qualifications: qualifications || [], // Assign qualifications (empty array if not provided)
            grades: grades || [], // Nouvelle: Assign grades (empty array if not provided)
            functions: functions || [] // Nouvelle: Assign functions (empty array if not provided)
        };
        await saveUsers(); // Save changes to users.json file
        res.status(201).json({ message: 'Agent added successfully', agent: { id: agentId, nom, prenom, qualifications: USERS[agentId].qualifications, grades: USERS[agentId].grades, functions: USERS[agentId].functions } });
    } catch (error) {
        console.error("Error adding agent:", error);
        res.status(500).json({ message: 'Server error when adding agent.' });
    }
});

// PUT /api/admin/agents/:id - Modify an existing agent
app.put('/api/admin/agents/:id', authorizeAdmin, async (req, res) => {
    const agentId = req.params.id.toLowerCase();
    const { nom, prenom, newPassword, qualifications, grades, functions } = req.body; // Include qualifications, grades, functions in update

    // Check if agent exists and is not an administrator (to avoid modifying admin via this route)
    if (!USERS[agentId] || USERS[agentId].role !== 'agent') {
        return res.status(404).json({ message: 'Agent not found or not modifiable via this route.' });
    }

    // Update fields if provided
    USERS[agentId].nom = nom || USERS[agentId].nom;
    USERS[agentId].prenom = prenom || USERS[agentId].prenom;

    // Update password if a new one is provided
    if (newPassword) {
        try {
            USERS[agentId].mdp = await bcrypt.hash(newPassword, 10);
        } catch (error) {
            console.error("Password hashing error during update:", error);
            return res.status(500).json({ message: 'Error hashing new password.' });
        }
    }

    // Update qualifications if provided
    if (Array.isArray(qualifications)) {
        USERS[agentId].qualifications = qualifications;
    }
    // Nouvelle: Update grades if provided
    if (Array.isArray(grades)) {
        USERS[agentId].grades = grades;
    }
    // Nouvelle: Update functions if provided
    if (Array.isArray(functions)) {
        USERS[agentId].functions = functions;
    }

    try {
        await saveUsers(); // Save changes
        res.json({ message: 'Agent updated successfully', agent: { id: agentId, nom: USERS[agentId].nom, prenom: USERS[agentId].prenom, qualifications: USERS[agentId].qualifications, grades: USERS[agentId].grades, functions: USERS[agentId].functions } });
    } catch (error) {
        console.error("Error updating agent:", error);
        res.status(500).json({ message: 'Server error when updating agent.' });
    }
});

// DELETE /api/admin/agents/:id - Delete an agent
app.delete('/api/admin/agents/:id', authorizeAdmin, async (req, res) => {
    const agentId = req.params.id.toLowerCase();

    // Check if agent exists and is not an administrator (to avoid deleting admin)
    if (!USERS[agentId] || USERS[agentId].role !== 'agent') {
        return res.status(404).json({ message: 'Agent not found or not deletable via this route.' });
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

        res.json({ message: 'Agent and their planning (if existing) deleted successfully.' });
    } catch (error) {
        console.error("Error deleting agent:", error);
        res.status(500).json({ message: 'Server error when deleting agent.' });
    }
});

// GET /api/agents/names - Get agent names and first names for the login dropdown
// This route does not require authentication as it is used before login
app.get('/api/agents/names', (req, res) => {
    const agentsForDropdown = Object.keys(USERS)
        .filter(key => USERS[key].role === 'agent' || USERS[key].role === 'admin') // Include admin for the dropdown if necessary
        .map(key => ({
            id: key, // The identifier is the key (e.g., 'bruneau', 'admin')
            nom: USERS[key].nom,
            prenom: USERS[key].prenom
        }));
    res.json(agentsForDropdown);
});

// --- Qualifications Management Routes (EXISTANT) ---

// GET /api/qualifications - Get all available qualifications
app.get('/api/qualifications', authorizeAdmin, (req, res) => {
    res.json(AVAILABLE_QUALIFICATIONS);
});

// POST /api/qualifications - Add a new qualification
app.post('/api/qualifications', authorizeAdmin, async (req, res) => {
    const { id, name } = req.body;
    if (!id || !name) {
        return res.status(400).json({ message: 'ID and name for qualification are required.' });
    }
    const qualId = id.toLowerCase();
    if (AVAILABLE_QUALIFICATIONS.some(q => q.id === qualId)) {
        return res.status(409).json({ message: 'This qualification ID already exists.' });
    }

    AVAILABLE_QUALIFICATIONS.push({ id: qualId, name: name });
    try {
        await saveQualifications();
        res.status(201).json({ message: 'Qualification added successfully', qualification: { id: qualId, name } });
    } catch (error) {
        console.error("Error adding qualification:", error);
        res.status(500).json({ message: 'Server error when adding qualification.' });
    }
});

// PUT /api/qualifications/:id - Modify an existing qualification
app.put('/api/qualifications/:id', authorizeAdmin, async (req, res) => {
    const qualId = req.params.id.toLowerCase();
    const { name } = req.body;

    const index = AVAILABLE_QUALIFICATIONS.findIndex(q => q.id === qualId);
    if (index === -1) {
        return res.status(404).json({ message: 'Qualification not found.' });
    }

    AVAILABLE_QUALIFICATIONS[index].name = name || AVAILABLE_QUALIFICATIONS[index].name;
    try {
        await saveQualifications();
        res.json({ message: 'Qualification updated successfully', qualification: AVAILABLE_QUALIFICATIONS[index] });
    } catch (error) {
        console.error("Error updating qualification:", error);
        res.status(500).json({ message: 'Server error when updating qualification.' });
    }
});

// DELETE /api/qualifications/:id - Delete a qualification
app.delete('/api/qualifications/:id', authorizeAdmin, async (req, res) => {
    const qualId = req.params.id.toLowerCase();

    const initialLength = AVAILABLE_QUALIFICATIONS.length;
    AVAILABLE_QUALIFICATIONS = AVAILABLE_QUALIFICATIONS.filter(q => q.id !== qualId);

    if (AVAILABLE_QUALIFICATIONS.length === initialLength) {
        return res.status(404).json({ message: 'Qualification not found.' });
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
        res.json({ message: 'Qualification deleted successfully.' });
    } catch (error) {
        console.error("Error deleting qualification:", error);
        res.status(500).json({ message: 'Server error when deleting qualification.' });
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
        return res.status(400).json({ message: 'ID and name for grade are required.' });
    }
    const gradeId = id.toLowerCase();
    if (AVAILABLE_GRADES.some(g => g.id === gradeId)) {
        return res.status(409).json({ message: 'This grade ID already exists.' });
    }

    AVAILABLE_GRADES.push({ id: gradeId, name: name });
    try {
        await saveGrades();
        res.status(201).json({ message: 'Grade added successfully', grade: { id: gradeId, name } });
    } catch (error) {
        console.error("Error adding grade:", error);
        res.status(500).json({ message: 'Server error when adding grade.' });
    }
});

// PUT /api/grades/:id - Modify an existing grade
app.put('/api/grades/:id', authorizeAdmin, async (req, res) => {
    const gradeId = req.params.id.toLowerCase();
    const { name } = req.body;

    const index = AVAILABLE_GRADES.findIndex(g => g.id === gradeId);
    if (index === -1) {
        return res.status(404).json({ message: 'Grade not found.' });
    }

    AVAILABLE_GRADES[index].name = name || AVAILABLE_GRADES[index].name;
    try {
        await saveGrades();
        res.json({ message: 'Grade updated successfully', grade: AVAILABLE_GRADES[index] });
    } catch (error) {
        console.error("Error updating grade:", error);
        res.status(500).json({ message: 'Server error when updating grade.' });
    }
});

// DELETE /api/grades/:id - Delete a grade
app.delete('/api/grades/:id', authorizeAdmin, async (req, res) => {
    const gradeId = req.params.id.toLowerCase();

    const initialLength = AVAILABLE_GRADES.length;
    AVAILABLE_GRADES = AVAILABLE_GRADES.filter(g => g.id !== gradeId);

    if (AVAILABLE_GRADES.length === initialLength) {
        return res.status(404).json({ message: 'Grade not found.' });
    }

    // Optional: Remove this grade from all users who have it
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
            await saveUsers(); // Save users if their grades were updated
        }
        res.json({ message: 'Grade deleted successfully.' });
    } catch (error) {
        console.error("Error deleting grade:", error);
        res.status(500).json({ message: 'Server error when deleting grade.' });
    }
});

// --- NOUVELLES ROUTES POUR LA GESTION DES FONCTIONS ---

// GET /api/functions - Get all available functions
app.get('/api/functions', authorizeAdmin, (req, res) => {
    res.json(AVAILABLE_FUNCTIONS);
});

// POST /api/functions - Add a new function
app.post('/api/functions', authorizeAdmin, async (req, res) => {
    const { id, name } = req.body;
    if (!id || !name) {
        return res.status(400).json({ message: 'ID and name for function are required.' });
    }
    const functionId = id.toLowerCase();
    if (AVAILABLE_FUNCTIONS.some(f => f.id === functionId)) {
        return res.status(409).json({ message: 'This function ID already exists.' });
    }

    AVAILABLE_FUNCTIONS.push({ id: functionId, name: name });
    try {
        await saveFunctions();
        res.status(201).json({ message: 'Function added successfully', func: { id: functionId, name } });
    } catch (error) {
        console.error("Error adding function:", error);
        res.status(500).json({ message: 'Server error when adding function.' });
    }
});

// PUT /api/functions/:id - Modify an existing function
app.put('/api/functions/:id', authorizeAdmin, async (req, res) => {
    const functionId = req.params.id.toLowerCase();
    const { name } = req.body;

    const index = AVAILABLE_FUNCTIONS.findIndex(f => f.id === functionId);
    if (index === -1) {
        return res.status(404).json({ message: 'Function not found.' });
    }

    AVAILABLE_FUNCTIONS[index].name = name || AVAILABLE_FUNCTIONS[index].name;
    try {
        await saveFunctions();
        res.json({ message: 'Function updated successfully', func: AVAILABLE_FUNCTIONS[index] });
    } catch (error) {
        console.error("Error updating function:", error);
        res.status(500).json({ message: 'Server error when updating function.' });
    }
});

// DELETE /api/functions/:id - Delete a function
app.delete('/api/functions/:id', authorizeAdmin, async (req, res) => {
    const functionId = req.params.id.toLowerCase();

    const initialLength = AVAILABLE_FUNCTIONS.length;
    AVAILABLE_FUNCTIONS = AVAILABLE_FUNCTIONS.filter(f => f.id !== functionId);

    if (AVAILABLE_FUNCTIONS.length === initialLength) {
        return res.status(404).json({ message: 'Function not found.' });
    }

    // Optional: Remove this function from all users who have it
    let usersModified = false;
    for (const userId in USERS) {
        if (USERS[userId].functions && USERS[userId].functions.includes(functionId)) {
            USERS[userId].functions = USERS[userId].functions.filter(f => f !== functionId);
            usersModified = true;
        }
    }

    try {
        await saveFunctions();
        if (usersModified) {
            await saveUsers(); // Save users if their functions were updated
        }
        res.json({ message: 'Function deleted successfully.' });
    } catch (error) {
        console.error("Error deleting function:", error);
        res.status(500).json({ message: 'Server error when deleting function.' });
    }
});


// --- NOUVELLES ROUTES POUR LA FEUILLE DE GARDE (AJOUTÉES) ---

// GET /api/roster-config/:dateKey
// Récupère la configuration (créneaux, agents d'astreinte) pour une date
app.get('/api/roster-config/:dateKey', async (req, res) => {
    const dateKey = req.params.dateKey;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
        return res.status(400).json({ message: 'Format de date invalide. Attendu YYYY-MM-DD.' });
    }
    const filePath = path.join(ROSTER_CONFIG_DIR, `${dateKey}.json`);
    try {
        const data = await fs.readFile(filePath, 'utf8');
        res.json(JSON.parse(data));
    } catch (err) {
        if (err.code === 'ENOENT') {
            res.status(404).json({ message: 'Configuration de feuille de garde non trouvée pour cette date.' });
        } else {
            console.error(`Error reading roster config for ${dateKey}:`, err);
            res.status(500).json({ message: 'Server error when reading roster config.' });
        }
    }
});

// POST /api/roster-config/:dateKey
// Sauvegarde ou met à jour la configuration pour une date
app.post('/api/roster-config/:dateKey', authorizeAdmin, async (req, res) => {
    const dateKey = req.params.dateKey;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
        return res.status(400).json({ message: 'Format de date invalide. Attendu YYYY-MM-DD.' });
    }
    const { timeSlots, onDutyAgents } = req.body;
    if (!timeSlots || !onDutyAgents) {
        return res.status(400).json({ message: 'Données de configuration manquantes (timeSlots ou onDutyAgents).' });
    }
    const filePath = path.join(ROSTER_CONFIG_DIR, `${dateKey}.json`);
    try {
        await fs.writeFile(filePath, JSON.stringify({ timeSlots, onDutyAgents }, null, 2), 'utf8');
        res.status(200).json({ message: 'Configuration de feuille de garde sauvegardée avec succès.' });
    } catch (error) {
        console.error(`Error saving roster config for ${dateKey}:`, error);
        res.status(500).json({ message: 'Server error when saving roster config.' });
    }
});

// GET /api/daily-roster/:dateKey
// Récupère les affectations d'engins pour une date spécifique
app.get('/api/daily-roster/:dateKey', async (req, res) => {
    const dateKey = req.params.dateKey;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
        return res.status(400).json({ message: 'Format de date invalide. Attendu YYYY-MM-DD.' });
    }
    const filePath = path.join(DAILY_ROSTER_DIR, `${dateKey}.json`);
    try {
        const data = await fs.readFile(filePath, 'utf8');
        res.json(JSON.parse(data));
    } catch (err) {
        if (err.code === 'ENOENT') {
            res.status(404).json({ message: 'Feuille de garde d\'affectation non trouvée pour cette date.' });
        } else {
            console.error(`Error reading daily roster for ${dateKey}:`, err);
            res.status(500).json({ message: 'Server error when reading daily roster.' });
        }
    }
});

// POST /api/daily-roster/:dateKey
// Sauvegarde ou met à jour les affectations d'engins pour une date spécifique
app.post('/api/daily-roster/:dateKey', authorizeAdmin, async (req, res) => {
    const dateKey = req.params.dateKey;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
        return res.status(400).json({ message: 'Format de date invalide. Attendu YYYY-MM-DD.' });
    }
    const { roster } = req.body;
    if (!roster) {
        return res.status(400).json({ message: 'Données de feuille de garde manquantes (roster).' });
    }
    const filePath = path.join(DAILY_ROSTER_DIR, `${dateKey}.json`);
    try {
        await fs.writeFile(filePath, JSON.stringify({ roster }, null, 2), 'utf8'); // Stocke l'objet roster complet
        res.status(200).json({ message: 'Feuille de garde d\'affectation sauvegardée avec succès.' });
    } catch (error) {
        console.error(`Error saving daily roster for ${dateKey}:`, error);
        res.status(500).json({ message: 'Server error when saving daily roster.' });
    }
});


// 🔧 ROUTE DE TEST DISK RENDER (à conserver pour la vérification de persistance sur Render)
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

// --- Fonctions utilitaires (à inclure si elles ne sont pas déjà définies ailleurs) ---
// (Ces fonctions sont normalement utilisées dans le frontend, mais si elles sont nécessaires
// pour la logique de démarrage côté serveur, elles doivent être ici)

// Fonction pour obtenir le numéro de semaine ISO 8601
function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    var weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return weekNo;
}

// Fonction pour obtenir le nom du jour en français
function getDayName(date) {
    const days = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    return days[date.getDay()];
}

// Fonction pour formater la date en YYYY-MM-DD
function formatDateToYYYYMMDD(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// --- Initialisation de données de feuille de garde pour les tests ---
// Cette fonction ne s'exécutera que si les fichiers n'existent pas déjà.
// Elle est utile pour un premier démarrage ou après un nettoyage des données persistantes.
async function initializeSampleRosterDataForTesting() {
    const today = new Date();
    const sampleDateKey = formatDateToYYYYMMDD(today);

    const rosterConfigFile = path.join(ROSTER_CONFIG_DIR, `${sampleDateKey}.json`);
    const dailyRosterFile = path.join(DAILY_ROSTER_DIR, `${sampleDateKey}.json`);

    try {
        await fs.access(rosterConfigFile); // Vérifie si le fichier existe
        console.log(`Roster config file for ${sampleDateKey} already exists. Skipping sample data initialization.`);
    } catch (err) {
        if (err.code === 'ENOENT') {
            console.log(`Initializing sample roster config for ${sampleDateKey}.`);
            const defaultRosterConfig = {
                timeSlots: {
                    'slot_0700_1400_default': { range: '07:00 - 14:00', engines: {} },
                    'slot_1400_1700_default': { range: '14:00 - 17:00', engines: {} },
                    'slot_1700_0700_default': { range: '17:00 - 07:00', engines: {} }
                },
                onDutyAgents: ['bruneau', 'vatinel', 'none', 'none', 'none', 'none', 'none', 'none', 'none', 'none']
            };
            // Initialise les engins vides pour les créneaux par défaut
            for (const slotId in defaultRosterConfig.timeSlots) {
                ['FPT', 'CCF', 'VSAV', 'VTU', 'VPMA'].forEach(engineType => {
                    defaultRosterConfig.timeSlots[slotId].engines[engineType] = { personnel: {} }; // Structure de base
                    const roles = {
                        'FPT': ['CA_FPT', 'COD1', 'EQ1_FPT', 'EQ2_FPT'],
                        'CCF': ['CA_FDF2', 'COD2', 'EQ1_FDF1', 'EQ2_FDF1'],
                        'VSAV': ['CA_VSAV', 'COD0', 'EQ'],
                        'VTU': ['CA_VTU', 'COD0', 'EQ'],
                        'VPMA': ['CA_VPMA', 'COD0', 'EQ'],
                    };
                    (roles[engineType] || []).forEach(role => {
                        defaultRosterConfig.timeSlots[slotId].engines[engineType].personnel[role] = 'none';
                    });
                });
            }
            await fs.writeFile(rosterConfigFile, JSON.stringify(defaultRosterConfig, null, 2), 'utf8');
        } else {
            console.error(`Error checking/initializing roster config file:`, err);
        }
    }

    try {
        await fs.access(dailyRosterFile); // Vérifie si le fichier existe
        console.log(`Daily roster file for ${sampleDateKey} already exists. Skipping sample data initialization.`);
    } catch (err) {
        if (err.code === 'ENOENT') {
            console.log(`Initializing empty daily roster for ${sampleDateKey}.`);
            const emptyDailyRoster = {
                roster: {} // Initialiser vide, sera rempli par le frontend ou la génération auto
            };
            await fs.writeFile(dailyRosterFile, JSON.stringify(emptyDailyRoster, null, 2), 'utf8');
        } else {
            console.error(`Error checking/initializing daily roster file:`, err);
        }
    }
}

// Appeler la fonction d'initialisation des données de test au démarrage du serveur
// après que les dossiers persistants aient été créés.
(async () => {
    await fs.mkdir(DATA_DIR, { recursive: true }).catch(console.error);
    await initializeRosterFolders();
    await loadUsers();
    await loadQualifications();
    await initializeSampleRosterDataForTesting(); // Appel de la fonction d'initialisation des données de test
})();
