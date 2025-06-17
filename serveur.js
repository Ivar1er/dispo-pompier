const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcryptjs');

const app = express();
const port = process.env.PORT || 3000;

// Listez toutes les origines depuis lesquelles votre frontend peut se connecter.
// Cela inclut votre environnement de développement local et votre déploiement sur Render.
const allowedOrigins = [
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'https://dispo-pompier.onrender.com'
];

app.use(cors({
  origin: function (origin, callback) {
    // Permet les requêtes sans origine (ex: requêtes directes via Postman, curl, ou fichiers locaux ouverts directement par le navigateur)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true // Très important pour permettre l'envoi et la réception de cookies/sessions
}));

app.use(express.json());

// Répertoire public
const PUBLIC_DIR = path.join(__dirname, 'public');
app.use(express.static(PUBLIC_DIR));

// Répertoire persistant (./data en dev, ou défini par l'environnement Render)
const PERSISTENT_DIR = process.env.PERSISTENT_DIR || path.join(__dirname, 'data');

// Assurez-vous que le répertoire persistant existe
fs.mkdir(PERSISTENT_DIR, { recursive: true }).catch(console.error);

// Routes d'authentification
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  // En production, stockez les utilisateurs dans une base de données
  // Pour cet exemple, utilisez des informations d'identification codées en dur pour les tests
  const users = {
    'admin': await bcrypt.hash('adminpass', 10),
    'agent': await bcrypt.hash('agentpass', 10)
  };

  const storedHashedPassword = users[username];

  if (storedHashedPassword && await bcrypt.compare(password, storedHashedPassword)) {
    const role = username; // Pour cet exemple, le rôle est le nom d'utilisateur
    res.status(200).json({ message: 'Login successful', role: role, agentId: username === 'agent' ? 'agent_example_id' : null });
  } else {
    res.status(401).json({ message: 'Invalid credentials' });
  }
});

// ----------------------------------------------
// Routes de gestion des agents (Admin seulement)
// ----------------------------------------------

const AGENTS_FILE = path.join(PERSISTENT_DIR, 'agents.json');

// POST: Ajouter un nouvel agent
app.post('/api/admin/agents', async (req, res) => {
  if (req.headers['x-user-role'] !== 'admin') {
    return res.status(403).json({ message: 'Forbidden' });
  }
  try {
    const newAgent = req.body;
    let agents = [];
    try {
      const data = await fs.readFile(AGENTS_FILE, 'utf8');
      agents = JSON.parse(data);
    } catch (readErr) {
      if (readErr.code !== 'ENOENT') throw readErr;
    }
    newAgent._id = Date.now().toString(); // Simple ID unique
    agents.push(newAgent);
    await fs.writeFile(AGENTS_FILE, JSON.stringify(agents, null, 2), 'utf8');
    res.status(201).json(newAgent);
  } catch (error) {
    console.error('Erreur lors de l\'ajout de l\'agent:', error);
    res.status(500).json({ message: 'Server error adding agent.' });
  }
});

// GET: Récupérer tous les agents
app.get('/api/admin/agents', async (req, res) => {
  if (req.headers['x-user-role'] !== 'admin' && req.headers['x-user-role'] !== 'agent') {
    return res.status(403).json({ message: 'Forbidden' });
  }
  try {
    const data = await fs.readFile(AGENTS_FILE, 'utf8');
    res.status(200).json(JSON.parse(data));
  } catch (error) {
    if (error.code === 'ENOENT') {
      return res.status(200).json([]); // Aucun agent si le fichier n'existe pas
    }
    console.error('Erreur lors de la récupération des agents:', error);
    res.status(500).json({ message: 'Server error retrieving agents.' });
  }
});

// NOUVELLE ROUTE : GET /api/agents/names pour la page de connexion
app.get('/api/agents/names', async (req, res) => {
  try {
    const data = await fs.readFile(AGENTS_FILE, 'utf8');
    const agents = JSON.parse(data);
    // Renvoie uniquement l'ID, le prénom et le nom de chaque agent
    const agentNames = agents.map(agent => ({
      _id: agent._id,
      prenom: agent.prenom,
      nom: agent.nom
    }));
    res.status(200).json(agentNames);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('[INFO Serveur] Fichier agents.json non trouvé pour /api/agents/names. Envoi 200 OK avec un tableau vide.');
      return res.status(200).json([]); // Aucun agent si le fichier n'existe pas
    }
    console.error('Erreur lors de la récupération des noms d\'agents:', error);
    res.status(500).json({ message: 'Server error retrieving agent names.' });
  }
});


// PUT: Mettre à jour un agent existant
app.put('/api/admin/agents/:id', async (req, res) => {
  if (req.headers['x-user-role'] !== 'admin') {
    return res.status(403).json({ message: 'Forbidden' });
  }
  try {
    const agentId = req.params.id;
    const updatedAgentData = req.body;
    const data = await fs.readFile(AGENTS_FILE, 'utf8');
    let agents = JSON.parse(data);
    const index = agents.findIndex(a => a._id === agentId);
    if (index === -1) {
      return res.status(404).json({ message: 'Agent not found.' });
    }
    agents[index] = { ...agents[index], ...updatedAgentData, _id: agentId }; // Conserver l'ID original
    await fs.writeFile(AGENTS_FILE, JSON.stringify(agents, null, 2), 'utf8');
    res.status(200).json(agents[index]);
  } catch (error) {
    console.error('Erreur lors de la mise à jour de l\'agent:', error);
    res.status(500).json({ message: 'Server error updating agent.' });
  }
});

// DELETE: Supprimer un agent
app.delete('/api/admin/agents/:id', async (req, res) => {
  if (req.headers['x-user-role'] !== 'admin') {
    return res.status(403).json({ message: 'Forbidden' });
  }
  try {
    const agentId = req.params.id;
    const data = await fs.readFile(AGENTS_FILE, 'utf8');
    let agents = JSON.parse(data);
    const initialLength = agents.length;
    agents = agents.filter(a => a._id !== agentId);
    if (agents.length === initialLength) {
      return res.status(404).json({ message: 'Agent not found.' });
    }
    await fs.writeFile(AGENTS_FILE, JSON.stringify(agents, null, 2), 'utf8');
    res.status(204).send(); // No Content
  } catch (error) {
    console.error('Erreur lors de la suppression de l\'agent:', error);
    res.status(500).json({ message: 'Server error deleting agent.' });
  }
});

// ----------------------------------------------------
// Routes de gestion des qualifications (Admin seulement)
// ----------------------------------------------------

const QUALIFICATIONS_FILE = path.join(PERSISTENT_DIR, 'qualifications.json');

// POST: Ajouter une nouvelle qualification
app.post('/api/admin/qualifications', async (req, res) => {
  if (req.headers['x-user-role'] !== 'admin') {
    return res.status(403).json({ message: 'Forbidden' });
  }
  try {
    const newQualification = req.body;
    let qualifications = [];
    try {
      const data = await fs.readFile(QUALIFICATIONS_FILE, 'utf8');
      qualifications = JSON.parse(data);
    } catch (readErr) {
      if (readErr.code !== 'ENOENT') throw readErr;
    }
    newQualification._id = Date.now().toString();
    qualifications.push(newQualification);
    await fs.writeFile(QUALIFICATIONS_FILE, JSON.stringify(qualifications, null, 2), 'utf8');
    res.status(201).json(newQualification);
  } catch (error) {
    console.error('Erreur lors de l\'ajout de la qualification:', error);
    res.status(500).json({ message: 'Server error adding qualification.' });
  }
});

// GET: Récupérer toutes les qualifications
app.get('/api/admin/qualifications', async (req, res) => {
  if (req.headers['x-user-role'] !== 'admin') {
    return res.status(403).json({ message: 'Forbidden' });
  }
  try {
    const data = await fs.readFile(QUALIFICATIONS_FILE, 'utf8');
    res.status(200).json(JSON.parse(data));
  } catch (error) {
    if (error.code === 'ENOENT') {
      return res.status(200).json([]);
    }
    console.error('Erreur lors de la récupération des qualifications:', error);
    res.status(500).json({ message: 'Server error retrieving qualifications.' });
  }
});

// PUT: Mettre à jour une qualification existante
app.put('/api/admin/qualifications/:id', async (req, res) => {
  if (req.headers['x-user-role'] !== 'admin') {
    return res.status(403).json({ message: 'Forbidden' });
  }
  try {
    const qualId = req.params.id;
    const updatedQualData = req.body;
    const data = await fs.readFile(QUALIFICATIONS_FILE, 'utf8');
    let qualifications = JSON.parse(data);
    const index = qualifications.findIndex(q => q._id === qualId);
    if (index === -1) {
      return res.status(404).json({ message: 'Qualification not found.' });
    }
    qualifications[index] = { ...qualifications[index], ...updatedQualData, _id: qualId };
    await fs.writeFile(QUALIFICATIONS_FILE, JSON.stringify(qualifications, null, 2), 'utf8');
    res.status(200).json(qualifications[index]);
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la qualification:', error);
    res.status(500).json({ message: 'Server error updating qualification.' });
  }
});

// DELETE: Supprimer une qualification
app.delete('/api/admin/qualifications/:id', async (req, res) => {
  if (req.headers['x-user-role'] !== 'admin') {
    return res.status(403).json({ message: 'Forbidden' });
  }
  try {
    const qualId = req.params.id;
    const data = await fs.readFile(QUALIFICATIONS_FILE, 'utf8');
    let qualifications = JSON.parse(data);
    const initialLength = qualifications.length;
    qualifications = qualifications.filter(q => q._id !== qualId);
    if (qualifications.length === initialLength) {
      return res.status(404).json({ message: 'Qualification not found.' });
    }
    await fs.writeFile(QUALIFICATIONS_FILE, JSON.stringify(qualifications, null, 2), 'utf8');
    res.status(204).send();
  } catch (error) {
    console.error('Erreur lors de la suppression de la qualification:', error);
    res.status(500).json({ message: 'Server error deleting qualification.' });
  }
});


// ----------------------------------------------------
// Routes de gestion des grades (Admin seulement)
// ----------------------------------------------------

const GRADES_FILE = path.join(PERSISTENT_DIR, 'grades.json');

// POST: Ajouter un nouveau grade
app.post('/api/admin/grades', async (req, res) => {
  if (req.headers['x-user-role'] !== 'admin') {
    return res.status(403).json({ message: 'Forbidden' });
  }
  try {
    const newGrade = req.body;
    let grades = [];
    try {
      const data = await fs.readFile(GRADES_FILE, 'utf8');
      grades = JSON.parse(data);
    } catch (readErr) {
      if (readErr.code !== 'ENOENT') throw readErr;
    }
    newGrade._id = Date.now().toString();
    grades.push(newGrade);
    await fs.writeFile(GRADES_FILE, JSON.stringify(grades, null, 2), 'utf8');
    res.status(201).json(newGrade);
  } catch (error) {
    console.error('Erreur lors de l\'ajout du grade:', error);
    res.status(500).json({ message: 'Server error adding grade.' });
  }
});

// GET: Récupérer tous les grades
app.get('/api/admin/grades', async (req, res) => {
  if (req.headers['x-user-role'] !== 'admin') {
    return res.status(403).json({ message: 'Forbidden' });
  }
  try {
    const data = await fs.readFile(GRADES_FILE, 'utf8');
    res.status(200).json(JSON.parse(data));
  } catch (error) {
    if (error.code === 'ENOENT') {
      return res.status(200).json([]);
    }
    console.error('Erreur lors de la récupération des grades:', error);
    res.status(500).json({ message: 'Server error retrieving grades.' });
  }
});

// PUT: Mettre à jour un grade existant
app.put('/api/admin/grades/:id', async (req, res) => {
  if (req.headers['x-user-role'] !== 'admin') {
    return res.status(403).json({ message: 'Forbidden' });
  }
  try {
    const gradeId = req.params.id;
    const updatedGradeData = req.body;
    const data = await fs.readFile(GRADES_FILE, 'utf8');
    let grades = JSON.parse(data);
    const index = grades.findIndex(g => g._id === gradeId);
    if (index === -1) {
      return res.status(404).json({ message: 'Grade not found.' });
    }
    grades[index] = { ...grades[index], ...updatedGradeData, _id: gradeId };
    await fs.writeFile(GRADES_FILE, JSON.stringify(grades, null, 2), 'utf8');
    res.status(200).json(grades[index]);
  } catch (error) {
    console.error('Erreur lors de la mise à jour du grade:', error);
    res.status(500).json({ message: 'Server error updating grade.' });
  }
});

// DELETE: Supprimer un grade
app.delete('/api/admin/grades/:id', async (req, res) => {
  if (req.headers['x-user-role'] !== 'admin') {
    return res.status(403).json({ message: 'Forbidden' });
  }
  try {
    const gradeId = req.params.id;
    const data = await fs.readFile(GRADES_FILE, 'utf8');
    let grades = JSON.parse(data);
    const initialLength = grades.length;
    grades = grades.filter(g => g._id !== gradeId);
    if (grades.length === initialLength) {
      return res.status(404).json({ message: 'Grade not found.' });
    }
    await fs.writeFile(GRADES_FILE, JSON.stringify(grades, null, 2), 'utf8');
    res.status(204).send();
  } catch (error) {
    console.error('Erreur lors de la suppression du grade:', error);
    res.status(500).json({ message: 'Server error deleting grade.' });
  }
});

// ----------------------------------------------------
// Routes de gestion des fonctions (Admin seulement)
// ----------------------------------------------------

const FUNCTIONS_FILE = path.join(PERSISTENT_DIR, 'functions.json');

// POST: Ajouter une nouvelle fonction
app.post('/api/admin/functions', async (req, res) => {
  if (req.headers['x-user-role'] !== 'admin') {
    return res.status(403).json({ message: 'Forbidden' });
  }
  try {
    const newFunction = req.body;
    let functions = [];
    try {
      const data = await fs.readFile(FUNCTIONS_FILE, 'utf8');
      functions = JSON.parse(data);
    } catch (readErr) {
      if (readErr.code !== 'ENOENT') throw readErr;
    }
    newFunction._id = Date.now().toString();
    functions.push(newFunction);
    await fs.writeFile(FUNCTIONS_FILE, JSON.stringify(functions, null, 2), 'utf8');
    res.status(201).json(newFunction);
  } catch (error) {
    console.error('Erreur lors de l\'ajout de la fonction:', error);
    res.status(500).json({ message: 'Server error adding function.' });
  }
});

// GET: Récupérer toutes les fonctions
app.get('/api/admin/functions', async (req, res) => {
  if (req.headers['x-user-role'] !== 'admin') {
    return res.status(403).json({ message: 'Forbidden' });
  }
  try {
    const data = await fs.readFile(FUNCTIONS_FILE, 'utf8');
    res.status(200).json(JSON.parse(data));
  } catch (error) {
    if (error.code === 'ENOENT') {
      return res.status(200).json([]);
    }
    console.error('Erreur lors de la récupération des fonctions:', error);
    res.status(500).json({ message: 'Server error retrieving functions.' });
  }
});

// PUT: Mettre à jour une fonction existante
app.put('/api/admin/functions/:id', async (req, res) => {
  if (req.headers['x-user-role'] !== 'admin') {
    return res.status(403).json({ message: 'Forbidden' });
  }
  try {
    const funcId = req.params.id;
    const updatedFuncData = req.body;
    const data = await fs.readFile(FUNCTIONS_FILE, 'utf8');
    let functions = JSON.parse(data);
    const index = functions.findIndex(f => f._id === funcId);
    if (index === -1) {
      return res.status(404).json({ message: 'Function not found.' });
    }
    functions[index] = { ...functions[index], ...updatedFuncData, _id: funcId };
    await fs.writeFile(FUNCTIONS_FILE, JSON.stringify(functions, null, 2), 'utf8');
    res.status(200).json(functions[index]);
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la fonction:', error);
    res.status(500).json({ message: 'Server error updating function.' });
  }
});

// DELETE: Supprimer une fonction
app.delete('/api/admin/functions/:id', async (req, res) => {
  if (req.headers['x-user-role'] !== 'admin') {
    return res.status(403).json({ message: 'Forbidden' });
  }
  try {
    const funcId = req.params.id;
    const data = await fs.readFile(FUNCTIONS_FILE, 'utf8');
    let functions = JSON.parse(data);
    const initialLength = functions.length;
    functions = functions.filter(f => f._id !== funcId);
    if (functions.length === initialLength) {
      return res.status(404).json({ message: 'Function not found.' });
    }
    await fs.writeFile(FUNCTIONS_FILE, JSON.stringify(functions, null, 2), 'utf8');
    res.status(204).send();
  } catch (error) {
    console.error('Erreur lors de la suppression de la fonction:', error);
    res.status(500).json({ message: 'Server error deleting function.' });
  }
});

// ---------------------------------------------------------------------------------------------------------
// Routes pour les disponibilités des agents (utilisées par agent.js et feuille_de_garde.js)
// ---------------------------------------------------------------------------------------------------------

const AGENT_AVAILABILITY_DIR = path.join(PERSISTENT_DIR, 'agent_availabilities');

// GET: Récupérer les disponibilités pour un agent spécifique et une date donnée
// Utilisé par la page 'agent' pour afficher son planning
app.get('/api/agent-availability/:agentId/:dateKey', async (req, res) => {
  const { agentId, dateKey } = req.params;
  const userRole = req.headers['x-user-role'];
  const requestedAgentId = req.params.agentId; // L'ID de l'agent dont le client demande le planning

  // Logique d'autorisation: un agent ne peut voir que son propre planning
  // L'administrateur peut voir tous les plannings
  if (userRole === 'agent' && req.session.agentId !== requestedAgentId) {
    return res.status(403).json({ message: 'Forbidden: You can only access your own availability.' });
  }

  const filePath = path.join(AGENT_AVAILABILITY_DIR, dateKey, `${agentId}.json`);
  try {
    const data = await fs.readFile(filePath, 'utf8');
    res.json(JSON.parse(data));
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.log(`[INFO Serveur] Fichier de disponibilité pour l'agent ${agentId} le ${dateKey} non trouvé. Envoi 200 OK avec un tableau vide.`);
      return res.status(200).json([]);
    }
    console.error(`[ERREUR Serveur] Erreur de lecture du fichier de disponibilité pour ${agentId} le ${dateKey}:`, err);
    res.status(500).json({ message: 'Server error retrieving agent availability.' });
  }
});

// POST: Enregistrer les disponibilités pour un agent spécifique et une date donnée
// Utilisé par la page 'agent' pour soumettre son planning
app.post('/api/agent-availability/:agentId/:dateKey', async (req, res) => {
  const { agentId, dateKey } = req.params;
  const userRole = req.headers['x-user-role'];
  const requestedAgentId = req.params.agentId;

  if (userRole === 'agent' && req.session.agentId !== requestedAgentId) {
    return res.status(403).json({ message: 'Forbidden: You can only update your own availability.' });
  }

  const dateDirPath = path.join(AGENT_AVAILABILITY_DIR, dateKey);
  const filePath = path.join(dateDirPath, `${agentId}.json`);
  const availabilityData = req.body;

  try {
    await fs.mkdir(dateDirPath, { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(availabilityData, null, 2), 'utf8');
    res.status(200).json({ message: 'Availability saved successfully' });
  } catch (err) {
    console.error(`[ERREUR Serveur] Erreur lors de l'écriture du fichier de disponibilité pour ${agentId} le ${dateKey}:`, err);
    res.status(500).json({ message: 'Server error saving availability.' });
  }
});


// NOUVELLE ROUTE POUR LA FEUILLE DE GARDE
// GET: Récupérer TOUTES les disponibilités des agents pour une date donnée
// C'est cette route qui est appelée par feuille_de_garde.js
app.get('/api/agent-availability/:dateKey', async (req, res) => {
  const { dateKey } = req.params;
  // Assurez-vous que l'appelant est un administrateur pour cette route globale
  if (req.headers['x-user-role'] !== 'admin') {
      console.warn(`[AVERTISSEMENT Serveur] Tentative d'accès non autorisé à /api/agent-availability/${dateKey} par rôle: ${req.headers['x-user-role']}`);
      return res.status(403).json({ message: 'Forbidden: Admin access required.' });
  }

  const dateDirPath = path.join(AGENT_AVAILABILITY_DIR, dateKey);
  let allAgentAvailabilities = {};

  try {
    const files = await fs.readdir(dateDirPath);
    console.log(`[INFO Serveur] Lecture des fichiers de disponibilité dans ${dateDirPath}.`);

    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const agentId = file.replace('.json', '');
      const filePath = path.join(dateDirPath, file);
      try {
        const data = await fs.readFile(filePath, 'utf8');
        allAgentAvailabilities[agentId] = JSON.parse(data);
      } catch (readErr) {
        // This is for individual agent files being corrupt/missing within an existing directory
        if (readErr.code === 'ENOENT') {
             console.warn(`[AVERTISSEMENT Serveur] Fichier de disponibilité pour l'agent ${agentId} le ${dateKey} non trouvé. Ignoré.`);
        } else {
            console.error(`[ERREUR Serveur] Erreur de lecture du fichier de disponibilité pour ${agentId} le ${dateKey}:`, readErr);
        }
        // Continue to next file even if one is bad
      }
    }
    console.log(`[INFO Serveur] All agent availabilities retrieved for ${dateKey}. Found ${Object.keys(allAgentAvailabilities).length} agents. Sending 200 OK.`);
    res.json(allAgentAvailabilities);
  } catch (err) {
    if (err.code === 'ENOENT') {
      // This catches if the *directory* for the date doesn't exist
      console.log(`[INFO Serveur] Agent availabilities directory not found for ${dateKey}. Sending 200 OK with empty object.`);
      return res.status(200).json({});
    }
    console.error(`[ERREUR Serveur] Erreur inattendue lors de la récupération des disponibilités de tous les agents pour ${dateKey}:`, err);
    res.status(500).json({ message: 'Server error retrieving all agent availabilities.' });
  }
});


// --------------------------------------------------
// Routes pour le roster (planning des créneaux et affectations)
// --------------------------------------------------

const ROSTER_CONFIG_DIR = path.join(PERSISTENT_DIR, 'roster_configs');

// GET: Récupérer la configuration du roster pour une date
app.get('/api/roster-config/:dateKey', async (req, res) => {
  const { dateKey } = req.params;
  const filePath = path.join(ROSTER_CONFIG_DIR, `${dateKey}.json`);

  if (req.headers['x-user-role'] !== 'admin') {
      return res.status(403).json({ message: 'Forbidden' });
  }

  try {
    const data = await fs.readFile(filePath, 'utf8');
    res.json(JSON.parse(data));
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.log(`[INFO Serveur] Fichier de configuration du roster pour ${dateKey} non trouvé. Envoi 200 OK avec un objet vide.`);
      return res.status(200).json({});
    }
    console.error(`[ERREUR Serveur] Erreur de lecture du fichier de configuration du roster pour ${dateKey}:`, err);
    res.status(500).json({ message: 'Server error retrieving roster config.' });
  }
});

// POST: Enregistrer la configuration du roster pour une date
app.post('/api/roster-config/:dateKey', async (req, res) => {
  const { dateKey } = req.params;
  const filePath = path.join(ROSTER_CONFIG_DIR, `${dateKey}.json`);
  const rosterConfig = req.body;

  if (req.headers['x-user-role'] !== 'admin') {
      return res.status(403).json({ message: 'Forbidden' });
  }

  try {
    await fs.mkdir(ROSTER_CONFIG_DIR, { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(rosterConfig, null, 2), 'utf8');
    res.status(200).json({ message: 'Roster config saved successfully' });
  } catch (err) {
    console.error(`[ERREUR Serveur] Erreur lors de l'écriture du fichier de configuration du roster pour ${dateKey}:`, err);
    res.status(500).json({ message: 'Server error saving roster config.' });
  }
});

// --------------------------------------------------
// Routes pour le planning quotidien des agents d'astreinte
// --------------------------------------------------

const DAILY_ROSTER_DIR = path.join(PERSISTENT_DIR, 'daily_rosters');

// GET: Récupérer le planning quotidien (agents d'astreinte) pour une date
app.get('/api/daily-roster/:dateKey', async (req, res) => {
  const { dateKey } = req.params;
  const filePath = path.join(DAILY_ROSTER_DIR, `${dateKey}.json`);

  // Assurez-vous que seul un admin peut accéder à cette route
  if (req.headers['x-user-role'] !== 'admin') {
      return res.status(403).json({ message: 'Forbidden' });
  }

  try {
    const data = await fs.readFile(filePath, 'utf8');
    res.status(200).json(JSON.parse(data));
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.log(`[INFO Serveur] Fichier de planning quotidien pour ${dateKey} non trouvé. Envoi 200 OK avec un objet vide.`);
      return res.status(200).json({});
    }
    console.error(`[ERREUR Serveur] Erreur de lecture du fichier de planning quotidien pour ${dateKey}:`, err);
    res.status(500).json({ message: 'Server error retrieving daily roster.' });
  }
});

// POST: Enregistrer le planning quotidien (agents d'astreinte) pour une date
app.post('/api/daily-roster/:dateKey', async (req, res) => {
  const { dateKey } = req.params;
  const filePath = path.join(DAILY_ROSTER_DIR, `${dateKey}.json`);
  const dailyRosterData = req.body; // Expects { onDutyAgents: [...] }

  // Assurez-vous que seul un admin peut modifier cette route
  if (req.headers['x-user-role'] !== 'admin') {
      return res.status(403).json({ message: 'Forbidden' });
  }

  try {
    await fs.mkdir(DAILY_ROSTER_DIR, { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(dailyRosterData, null, 2), 'utf8');
    res.status(200).json({ message: 'Daily roster saved successfully' });
  } catch (err) {
    console.error(`[ERREUR Serveur] Erreur lors de l'écriture du fichier de planning quotidien pour ${dateKey}:`, err);
    res.status(500).json({ message: 'Server error saving daily roster.' });
  }
});


// Démarrer le serveur
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
