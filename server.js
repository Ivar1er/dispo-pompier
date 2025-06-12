const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken'); // NOUVEAU : Importation de jsonwebtoken

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// TRÈS IMPORTANT : Le secret JWT doit être une variable d'environnement en production !
// Générez une chaîne longue et aléatoire et définissez-la sur Render comme JWT_SECRET_KEY.
const JWT_SECRET = process.env.JWT_SECRET_KEY || 'un_secret_jwt_par_defaut_tres_long_et_securise_a_changer';

// Répertoire public
const PUBLIC_DIR = path.join(__dirname, 'public');
console.log('Dossier public:', PUBLIC_DIR);
app.use(express.static(PUBLIC_DIR));

// Répertoire persistant Render pour les plannings, les utilisateurs, les qualifications, les grades et les fonctions
const PERSISTENT_DIR = '/mnt/storage'; // Assurez-vous que ce répertoire est persistant sur Render
// Pour le développement local, vous pouvez utiliser :
// const PERSISTENT_DIR = process.env.NODE_ENV === 'production' ? '/mnt/storage' : path.join(__dirname, 'data');

const DATA_DIR = path.join(PERSISTENT_DIR, 'plannings');
const USERS_FILE_PATH = path.join(PERSISTENT_DIR, 'users.json');
const QUALIFICATIONS_FILE_PATH = path.join(PERSISTENT_DIR, 'qualifications.json');
const GRADES_FILE_PATH = path.join(PERSISTENT_DIR, 'grades.json');
const FONCTIONS_FILE_PATH = path.join(PERSISTENT_DIR, 'fonctions.json');

// Nouveaux chemins pour la persistance de la feuille de garde
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

// Initialisation des données de test pour la feuille de garde si les fichiers n'existent pas
// Ceci est à garder en développement ou pour un premier déploiement
async function initializeSampleRosterDataForTesting() {
    const sampleDateKey = "2025-06-12"; // Ou toute autre date pour vos tests
    const rosterConfigFile = path.join(ROSTER_CONFIG_DIR, `${sampleDateKey}.json`);
    const dailyRosterFile = path.join(DAILY_ROSTER_DIR, `${sampleDateKey}.json`);

    try {
        await fs.access(rosterConfigFile); // Vérifie si le fichier existe
        console.log(`Roster config file for ${sampleDateKey} already exists. Skipping sample data initialization.`);
    } catch (err) {
        if (err.code === 'ENOENT') {
            console.log(`Initializing sample roster config for ${sampleDateKey}.`);
            const defaultRosterConfig = {
                timeSlots: [
                    { id: 'slot1', name: '08:00 - 12:00' },
                    { id: 'slot2', name: '12:00 - 18:00' },
                    { id: 'slot3', name: '18:00 - 00:00' }
                ],
                onDutyAgents: [
                    { id: 'agentA', name: 'Agent Alpha' },
                    { id: 'agentB', name: 'Agent Beta' }
                ]
            };
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

// Initialisation au démarrage du serveur
(async () => {
  await fs.mkdir(DATA_DIR, { recursive: true }).catch(console.error); // Creates the plannings folder
  await initializeRosterFolders(); // Initialize new roster folders
  await loadUsers(); // Loads users at server startup
  await loadQualifications(); // Loads qualifications at server startup
  await loadGrades(); // Charger les grades au démarrage
  await loadFonctions(); // Charger les fonctions au démarrage
  await initializeSampleRosterDataForTesting(); // Appel de la fonction d'initialisation des données de test
})();


// NOUVEAU : Middleware d'authentification basé sur JWT
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Extrait le token 'Bearer <token>'

    if (token == null) {
        return res.status(401).json({ message: 'Jeton d\'authentification requis.' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.error("Erreur de vérification JWT:", err);
            return res.status(403).json({ message: 'Jeton invalide ou expiré.' });
        }
        req.user = user; // Le payload du token (qui contient {id: ..., role: ...}) est attaché à req.user
        next();
    });
};

// NOUVEAU : Middleware d'autorisation pour les administrateurs (s'appuie sur authenticateToken)
const authorizeAdmin = (req, res, next) => {
    // req.user est défini par authenticateToken
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        return res.status(403).json({ message: 'Accès refusé. Rôle administrateur requis.' });
    }
};

// User login
app.post("/api/login", async (req, res) => {
  const { agent, mdp } = req.body;
  if (!agent || !mdp) {
    return res.status(400).json({ message: "Agent et mot de passe requis" });
  }

  const user = USERS[agent.toLowerCase()];
  if (!user) {
    return res.status(401).json({ message: "Agent inconnu" });
  }

  const isMatch = await bcrypt.compare(mdp, user.mdp);
  if (!isMatch) {
    return res.status(401).json({ message: "Mot de passe incorrect" });
  }

  // --- NOUVEAU : Génération du JWT après authentification réussie ---
  const userPayload = { id: agent.toLowerCase(), role: user.role }; // Assurez-vous que le payload contient l'ID et le rôle
  const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '1h' }); // Token valable 1 heure

  res.json({ prenom: user.prenom, nom: user.nom, role: user.role, token: token });
});

// Read agent's planning (requiert seulement l'authentification, pas forcément admin)
app.get('/api/planning/:agent', authenticateToken, async (req, res) => { // AJOUT de authenticateToken
  const agent = req.params.agent.toLowerCase();
  // Vérification que l'agent demandé est bien l'utilisateur authentifié, sauf si admin
  if (req.user.role !== 'admin' && req.user.id !== agent) {
      return res.status(403).json({ message: 'Accès refusé. Vous ne pouvez pas consulter le planning d\'un autre agent.' });
  }

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

// Save agent's planning (requiert seulement l'authentification, pas forcément admin)
app.post('/api/planning/:agent', authenticateToken, async (req, res) => { // AJOUT de authenticateToken
  const agent = req.params.agent.toLowerCase();
  // Vérification que l'agent demandé est bien l'utilisateur authentifié, sauf si admin
  if (req.user.role !== 'admin' && req.user.id !== agent) {
      return res.status(403).json({ message: 'Accès refusé. Vous ne pouvez pas modifier le planning d\'un autre agent.' });
  }

  const newPlanningData = req.body;

  if (typeof newPlanningData !== 'object' || newPlanningData === null) {
    return res.status(400).json({ message: 'Données de planning invalides' });
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

    const mergedPlanning = { ...currentPlanning, ...newPlanningData };
    await fs.writeFile(filePath, JSON.stringify(mergedPlanning, null, 2), 'utf8');

    res.json({ message: 'Planning sauvegardé avec succès' });
  } catch (err) {
    console.error('Error saving planning:', err);
    res.status(500).json({ message: 'Erreur serveur lors de la sauvegarde du planning.' });
  }
});

// GET /api/planning (pour tous les plannings, devrait être réservé aux admins)
app.get('/api/planning', authenticateToken, authorizeAdmin, async (req, res) => { // AJOUT de authenticateToken et authorizeAdmin
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
    res.status(500).json({ message: 'Erreur lors de la récupération des plannings' });
  }
});

// --- Administration routes for agent management ---
// All these routes are protected by the authorizeAdmin middleware

// GET /api/admin/agents - Get all agents (excluding admin)
app.get('/api/admin/agents', authenticateToken, authorizeAdmin, (req, res) => { // AJOUT de authenticateToken
    const agentsList = Object.keys(USERS)
        .filter(key => USERS[key].role === 'agent' || USERS[key].role === 'admin')
        .map(key => ({
            id: key,
            nom: USERS[key].nom,
            prenom: USERS[key].prenom,
            qualifications: USERS[key].qualifications || [],
            grades: USERS[key].grades || [],
            fonctions: USERS[key].fonctions || []
        }));
    res.json(agentsList);
});

// POST /api/admin/agents - Add a new agent
app.post('/api/admin/agents', authenticateToken, authorizeAdmin, async (req, res) => { // AJOUT de authenticateToken
    const { id, nom, prenom, password, qualifications, grades, fonctions } = req.body;
    if (!id || !nom || !prenom || !password) {
        return res.status(400).json({ message: 'Identifiant, nom, prénom et mot de passe sont requis.' });
    }
    const agentId = id.toLowerCase();

    if (USERS[agentId]) {
        return res.status(409).json({ message: 'Cet identifiant d\'agent existe déjà.' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        USERS[agentId] = {
            prenom: prenom,
            nom: nom,
            mdp: hashedPassword,
            role: 'agent',
            qualifications: qualifications || [],
            grades: grades || [],
            fonctions: fonctions || []
        };
        await saveUsers();
        res.status(201).json({ message: 'Agent ajouté avec succès', agent: { id: agentId, nom, prenom, qualifications: USERS[agentId].qualifications, grades: USERS[agentId].grades, fonctions: USERS[agentId].fonctions } });
    } catch (error) {
        console.error("Erreur lors de l'ajout de l'agent:", error);
        res.status(500).json({ message: 'Erreur serveur lors de l\'ajout de l\'agent.' });
    }
});

// PUT /api/admin/agents/:id - Modify an existing agent
app.put('/api/admin/agents/:id', authenticateToken, authorizeAdmin, async (req, res) => { // AJOUT de authenticateToken
    const agentId = req.params.id.toLowerCase();
    const { nom, prenom, newPassword, qualifications, grades, fonctions } = req.body;

    if (!USERS[agentId] || USERS[agentId].role !== 'agent') {
        return res.status(404).json({ message: 'Agent non trouvé ou non modifiable via cette route.' });
    }

    USERS[agentId].nom = nom || USERS[agentId].nom;
    USERS[agentId].prenom = prenom || USERS[agentId].prenom;

    if (newPassword) {
        try {
            USERS[agentId].mdp = await bcrypt.hash(newPassword, 10);
        } catch (error) {
            console.error("Erreur de hachage de mot de passe lors de la mise à jour:", error);
            return res.status(500).json({ message: 'Erreur lors du hachage du nouveau mot de passe.' });
        }
    }

    if (Array.isArray(qualifications)) {
        USERS[agentId].qualifications = qualifications;
    }
    if (Array.isArray(grades)) {
        USERS[agentId].grades = grades;
    }
    if (Array.isArray(fonctions)) {
        USERS[agentId].fonctions = fonctions;
    }

    try {
        await saveUsers();
        res.json({ message: 'Agent mis à jour avec succès', agent: { id: agentId, nom: USERS[agentId].nom, prenom: USERS[agentId].prenom, qualifications: USERS[agentId].qualifications, grades: USERS[agentId].grades, fonctions: USERS[agentId].fonctions } });
    } catch (error) {
        console.error("Erreur lors de la mise à jour de l'agent:", error);
        res.status(500).json({ message: 'Erreur serveur lors de la mise à jour de l\'agent.' });
    }
});

// DELETE /api/admin/agents/:id - Delete an agent
app.delete('/api/admin/agents/:id', authenticateToken, authorizeAdmin, async (req, res) => { // AJOUT de authenticateToken
    const agentId = req.params.id.toLowerCase();

    if (!USERS[agentId] || USERS[agentId].role !== 'agent') {
        return res.status(404).json({ message: 'Agent non trouvé ou non supprimable via cette route.' });
    }

    try {
        delete USERS[agentId];
        await saveUsers();

        const planningFilePath = path.join(DATA_DIR, `${agentId}.json`);
        try {
            await fs.unlink(planningFilePath);
            console.log(`Fichier de planning ${agentId}.json supprimé.`);
        } catch (err) {
            if (err.code === 'ENOENT') {
                console.warn(`Le fichier de planning ${agentId}.json n'existait pas.`);
            } else {
                console.error(`Erreur lors de la suppression du fichier de planning ${agentId}.json:`, err);
            }
        }

        res.json({ message: 'Agent et son planning (si existant) supprimés avec succès.' });
    } catch (error) {
        console.error("Erreur lors de la suppression de l'agent:", error);
        res.status(500).json({ message: 'Erreur serveur lors de la suppression de l\'agent.' });
    }
});

// GET /api/agents/names - Get agent names and first names for the login dropdown
// Cette route ne requiert PAS d'authentification car elle est utilisée AVANT le login
app.get('/api/agents/names', (req, res) => {
    const agentsForDropdown = Object.keys(USERS)
        .filter(key => USERS[key].role === 'agent' || USERS[key].role === 'admin')
        .map(key => ({
            id: key,
            nom: USERS[key].nom,
            prenom: USERS[key].prenom
        }));
    res.json(agentsForDropdown);
});

// --- Qualifications Management Routes ---

// GET /api/qualifications - Get all available qualifications
app.get('/api/qualifications', authenticateToken, authorizeAdmin, (req, res) => { // AJOUT de authenticateToken
    res.json(AVAILABLE_QUALIFICATIONS);
});

// POST /api/qualifications - Add a new qualification
app.post('/api/qualifications', authenticateToken, authorizeAdmin, async (req, res) => { // AJOUT de authenticateToken
    const { id, name } = req.body;
    if (!id || !name) {
        return res.status(400).json({ message: 'ID et nom de la qualification sont requis.' });
    }
    const qualId = id.toLowerCase();
    if (AVAILABLE_QUALIFICATIONS.some(q => q.id === qualId)) {
        return res.status(409).json({ message: 'Cet ID de qualification existe déjà.' });
    }

    AVAILABLE_QUALIFICATIONS.push({ id: qualId, name: name });
    try {
        await saveQualifications();
        res.status(201).json({ message: 'Qualification ajoutée avec succès', qualification: { id: qualId, name } });
    } catch (error) {
        console.error("Erreur lors de l'ajout de la qualification:", error);
        res.status(500).json({ message: 'Erreur serveur lors de l\'ajout de la qualification.' });
    }
});

// PUT /api/qualifications/:id - Modify an existing qualification
app.put('/api/qualifications/:id', authenticateToken, authorizeAdmin, async (req, res) => { // AJOUT de authenticateToken
    const qualId = req.params.id.toLowerCase();
    const { name } = req.body;

    const index = AVAILABLE_QUALIFICATIONS.findIndex(q => q.id === qualId);
    if (index === -1) {
        return res.status(404).json({ message: 'Qualification non trouvée.' });
    }

    AVAILABLE_QUALIFICATIONS[index].name = name || AVAILABLE_QUALIFICATIONS[index].name;
    try {
        await saveQualifications();
        res.json({ message: 'Qualification mise à jour avec succès', qualification: AVAILABLE_QUALIFICATIONS[index] });
    } catch (error) {
        console.error("Erreur lors de la mise à jour de la qualification:", error);
        res.status(500).json({ message: 'Erreur serveur lors de la mise à jour de la qualification.' });
    }
});

// DELETE /api/qualifications/:id - Delete a qualification
app.delete('/api/qualifications/:id', authenticateToken, authorizeAdmin, async (req, res) => { // AJOUT de authenticateToken
    const qualId = req.params.id.toLowerCase();

    const initialLength = AVAILABLE_QUALIFICATIONS.length;
    AVAILABLE_QUALIFICATIONS = AVAILABLE_QUALIFICATIONS.filter(q => q.id !== qualId);

    if (AVAILABLE_QUALIFICATIONS.length === initialLength) {
        return res.status(404).json({ message: 'Qualification non trouvée.' });
    }

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
            await saveUsers();
        }
        res.json({ message: 'Qualification supprimée avec succès.' });
    } catch (error) {
        console.error("Erreur lors de la suppression de la qualification:", error);
        res.status(500).json({ message: 'Erreur serveur lors de la suppression de la qualification.' });
    }
});

// --- NOUVELLES ROUTES POUR LA GESTION DES GRADES ---

// GET /api/grades - Get all available grades
app.get('/api/grades', authenticateToken, authorizeAdmin, (req, res) => { // AJOUT de authenticateToken
    res.json(AVAILABLE_GRADES);
});

// POST /api/grades - Add a new grade
app.post('/api/grades', authenticateToken, authorizeAdmin, async (req, res) => { // AJOUT de authenticateToken
    const { id, name } = req.body;
    if (!id || !name) {
        return res.status(400).json({ message: 'ID et nom du grade sont requis.' });
    }
    const gradeId = id.toUpperCase();
    if (AVAILABLE_GRADES.some(g => g.id === gradeId)) {
        return res.status(409).json({ message: 'Cet ID de grade existe déjà.' });
    }

    AVAILABLE_GRADES.push({ id: gradeId, name: name });
    try {
        await saveGrades();
        res.status(201).json({ message: 'Grade ajouté avec succès', grade: { id: gradeId, name } });
    } catch (error) {
        console.error("Erreur lors de l'ajout du grade:", error);
        res.status(500).json({ message: "Erreur serveur lors de l'ajout du grade." });
    }
});

// PUT /api/grades/:id - Modify an existing grade
app.put('/api/grades/:id', authenticateToken, authorizeAdmin, async (req, res) => { // AJOUT de authenticateToken
    const gradeId = req.params.id.toUpperCase();
    const { name } = req.body;

    const index = AVAILABLE_GRADES.findIndex(g => g.id === gradeId);
    if (index === -1) {
        return res.status(404).json({ message: 'Grade non trouvé.' });
    }

    AVAILABLE_GRADES[index].name = name || AVAILABLE_GRADES[index].name;
    try {
        await saveGrades();
        res.json({ message: 'Grade mis à jour avec succès', grade: AVAILABLE_GRADES[index] });
    } catch (error) {
        console.error("Erreur lors de la mise à jour du grade:", error);
        res.status(500).json({ message: "Erreur serveur lors de la mise à jour du grade." });
    }
});

// DELETE /api/grades/:id - Delete a grade
app.delete('/api/grades/:id', authenticateToken, authorizeAdmin, async (req, res) => { // AJOUT de authenticateToken
    const gradeId = req.params.id.toUpperCase();

    const initialLength = AVAILABLE_GRADES.length;
    AVAILABLE_GRADES = AVAILABLE_GRADES.filter(g => g.id !== gradeId);

    if (AVAILABLE_GRADES.length === initialLength) {
        return res.status(404).json({ message: 'Grade non trouvé.' });
    }

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
        res.json({ message: 'Grade supprimé avec succès.' });
    } catch (error) {
        console.error("Erreur lors de la suppression du grade:", error);
        res.status(500).json({ message: "Erreur serveur lors de la suppression du grade." });
    }
});

// --- NOUVELLES ROUTES POUR LA GESTION DES FONCTIONS ---

// GET /api/fonctions - Get all available fonctions
app.get('/api/fonctions', authenticateToken, authorizeAdmin, (req, res) => { // AJOUT de authenticateToken
    res.json(AVAILABLE_FONCTIONS);
});

// POST /api/fonctions - Add a new fonction
app.post('/api/fonctions', authenticateToken, authorizeAdmin, async (req, res) => { // AJOUT de authenticateToken
    const { id, name } = req.body;
    if (!id || !name) {
        return res.status(400).json({ message: 'ID et nom de la fonction sont requis.' });
    }
    const fonctionId = id;
    if (AVAILABLE_FONCTIONS.some(f => f.id === fonctionId)) {
        return res.status(409).json({ message: 'Cet ID de fonction existe déjà.' });
    }

    AVAILABLE_FONCTIONS.push({ id: fonctionId, name: name });
    try {
        await saveFonctions();
        res.status(201).json({ message: 'Fonction ajoutée avec succès', fonction: { id: fonctionId, name } });
    } catch (error) {
        console.error("Erreur lors de l'ajout de la fonction:", error);
        res.status(500).json({ message: "Erreur serveur lors de l'ajout de la fonction." });
    }
});

// PUT /api/fonctions/:id - Modify an existing fonction
app.put('/api/fonctions/:id', authenticateToken, authorizeAdmin, async (req, res) => { // AJOUT de authenticateToken
    const fonctionId = req.params.id;
    const { name } = req.body;

    const index = AVAILABLE_FONCTIONS.findIndex(f => f.id === fonctionId);
    if (index === -1) {
        return res.status(404).json({ message: 'Fonction non trouvée.' });
    }

    AVAILABLE_FONCTIONS[index].name = name || AVAILABLE_FONCTIONS[index].name;
    try {
        await saveFonctions();
        res.json({ message: 'Fonction mise à jour avec succès', fonction: AVAILABLE_FONCTIONS[index] });
    } catch (error) {
        console.error("Erreur lors de la mise à jour de la fonction:", error);
        res.status(500).json({ message: "Erreur serveur lors de la mise à jour de la fonction." });
    }
});

// DELETE /api/fonctions/:id - Delete a fonction
app.delete('/api/fonctions/:id', authenticateToken, authorizeAdmin, async (req, res) => { // AJOUT de authenticateToken
    const fonctionId = req.params.id;

    const initialLength = AVAILABLE_FONCTIONS.length;
    AVAILABLE_FONCTIONS = AVAILABLE_FONCTIONS.filter(f => f.id !== fonctionId);

    if (AVAILABLE_FONCTIONS.length === initialLength) {
        return res.status(404).json({ message: 'Fonction non trouvée.' });
    }

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
        res.json({ message: 'Fonction supprimée avec succès.' });
    } catch (error) {
        console.error("Erreur lors de la suppression de la fonction:", error);
        res.status(500).json({ message: "Erreur serveur lors de la suppression de la fonction." });
    }
});


// --- NOUVELLES ROUTES POUR LA FEUILLE DE GARDE ---

// GET /api/roster-config/:dateKey
app.get('/api/roster-config/:dateKey', authenticateToken, async (req, res) => { // AJOUT de authenticateToken
    const dateKey = req.params.dateKey;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
        return res.status(400).json({ message: 'Format de date invalide. Attendu : YYYY-MM-DD.' });
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
            res.status(500).json({ message: 'Erreur serveur lors de la lecture de la configuration de feuille de garde.' });
        }
    }
});

// POST /api/roster-config/:dateKey
app.post('/api/roster-config/:dateKey', authenticateToken, authorizeAdmin, async (req, res) => { // AJOUT de authenticateToken
    const dateKey = req.params.dateKey;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
        return res.status(400).json({ message: 'Format de date invalide. Attendu : YYYY-MM-DD.' });
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
        res.status(500).json({ message: 'Erreur serveur lors de la sauvegarde de la configuration de feuille de garde.' });
    }
});

// GET /api/daily-roster/:dateKey
app.get('/api/daily-roster/:dateKey', authenticateToken, async (req, res) => { // AJOUT de authenticateToken
    const dateKey = req.params.dateKey;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
        return res.status(400).json({ message: 'Format de date invalide. Attendu : YYYY-MM-DD.' });
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
            res.status(500).json({ message: 'Erreur serveur lors de la lecture de la feuille de garde journalière.' });
        }
    }
});

// POST /api/daily-roster/:dateKey
app.post('/api/daily-roster/:dateKey', authenticateToken, authorizeAdmin, async (req, res) => { // AJOUT de authenticateToken
    const dateKey = req.params.dateKey;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
        return res.status(400).json({ message: 'Format de date invalide. Attendu : YYYY-MM-DD.' });
    }
    const { roster } = req.body;
    if (!roster) {
        return res.status(400).json({ message: 'Données de feuille de garde manquantes (roster).' });
    }
    const filePath = path.join(DAILY_ROSTER_DIR, `${dateKey}.json`);
    try {
        await fs.writeFile(filePath, JSON.stringify({ roster }, null, 2), 'utf8');
        res.status(200).json({ message: 'Feuille de garde d\'affectation sauvegardée avec succès.' });
    } catch (error) {
        console.error(`Error saving daily roster for ${dateKey}:`, error);
        res.status(500).json({ message: 'Erreur serveur lors de la sauvegarde de la feuille de garde journalière.' });
    }
});

// 🔧 ROUTE DE TEST DISK RENDER (à conserver pour la vérification de persistance)
app.get('/api/disk-test', async (req, res) => {
    try {
        const testFilePath = path.join(PERSISTENT_DIR, 'test_file.txt');
        const testContent = `Test data: ${new Date().toISOString()}\n`;
        await fs.writeFile(testFilePath, testContent, 'utf8');
        const readContent = await fs.readFile(testFilePath, 'utf8');
        res.status(200).json({
            message: 'Disk test successful',
            written: testContent.trim(),
            read: readContent.trim()
        });
    } catch (error) {
        console.error('Disk test failed:', error);
        res.status(500).json({ message: 'Disk test failed', error: error.message });
    }
});


app.listen(port, () => {
  console.log(`Serveur démarré sur le port ${port}`);
});