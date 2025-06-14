const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcryptjs');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Répertoire public
const PUBLIC_DIR = path.join(__dirname, 'public');
app.use(express.static(PUBLIC_DIR));

// Répertoire persistant (./data en dev, ou défini par l'env var PERSISTENT_DIR en prod)
const PERSISTENT_DIR = process.env.PERSISTENT_DIR || path.join(__dirname, 'data');

const DATA_DIR               = path.join(PERSISTENT_DIR, 'plannings');
const USERS_FILE_PATH        = path.join(PERSISTENT_DIR, 'users.json');
const QUALIFICATIONS_FILE_PATH = path.join(PERSISTENT_DIR, 'qualifications.json');
const GRADES_FILE_PATH       = path.join(PERSISTENT_DIR, 'grades.json');
const FUNCTIONS_FILE_PATH    = path.join(PERSISTENT_DIR, 'functions.json');

const ROSTER_CONFIG_DIR      = path.join(PERSISTENT_DIR, 'roster_configs');
const DAILY_ROSTER_DIR       = path.join(PERSISTENT_DIR, 'daily_rosters');

let USERS = {};
let AVAILABLE_QUALIFICATIONS = [];
let AVAILABLE_GRADES = [];
let AVAILABLE_FUNCTIONS = [];

const DEFAULT_ADMIN_PASSWORD = 'supersecureadminpassword';

// --- Chargement / sauvegarde des utilisateurs ---

async function loadUsers() {
  try {
    const data = await fs.readFile(USERS_FILE_PATH, 'utf8');
    USERS = JSON.parse(data);
  } catch (err) {
    if (err.code === 'ENOENT') {
      // Création d'un admin par défaut
      const hashedDefaultPassword = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10);
      USERS = {
        admin: {
          prenom: "Admin",
          nom: "Admin",
          mdp: hashedDefaultPassword,    // corrigé
          role: "admin",
          qualifications: [],
          grades: [],
          functions: []
        }
      };
      await saveUsers();
      console.log(`Default admin created (id: admin, mdp: ${DEFAULT_ADMIN_PASSWORD}).`);
    } else {
      console.error('Error loading users:', err);
    }
  }
}

async function saveUsers() {
  try {
    await fs.writeFile(USERS_FILE_PATH, JSON.stringify(USERS, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving users:', err);
  }
}

// --- Chargement / sauvegarde des qualifications ---

async function loadQualifications() {
  try {
    const data = await fs.readFile(QUALIFICATIONS_FILE_PATH, 'utf8');
    AVAILABLE_QUALIFICATIONS = JSON.parse(data);
  } catch (err) {
    if (err.code === 'ENOENT') {
      AVAILABLE_QUALIFICATIONS = [
        { id: 'chef-agr', name: "Chef d'Agrès" },
        { id: 'conducteur', name: 'Conducteur' },
        { id: 'equipier', name: 'Équipier' },
        { id: 'secouriste', name: 'Secouriste' }
      ];
      await saveQualifications();
      console.log('Default qualifications created.');
    } else {
      console.error('Error loading qualifications:', err);
    }
  }
}

async function saveQualifications() {
  try {
    await fs.writeFile(QUALIFICATIONS_FILE_PATH, JSON.stringify(AVAILABLE_QUALIFICATIONS, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving qualifications:', err);
  }
}

// --- Chargement / sauvegarde des grades ---

async function loadGrades() {
  try {
    const data = await fs.readFile(GRADES_FILE_PATH, 'utf8');
    AVAILABLE_GRADES = JSON.parse(data);
  } catch (err) {
    if (err.code === 'ENOENT') {
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

async function saveGrades() {
  try {
    await fs.writeFile(GRADES_FILE_PATH, JSON.stringify(AVAILABLE_GRADES, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving grades:', err);
  }
}

// --- Chargement / sauvegarde des fonctions ---

async function loadFunctions() {
  try {
    const data = await fs.readFile(FUNCTIONS_FILE_PATH, 'utf8');
    AVAILABLE_FUNCTIONS = JSON.parse(data);
  } catch (err) {
    if (err.code === 'ENOENT') {
      AVAILABLE_FUNCTIONS = [
        { id: 'standard', name: 'Standard' },
        { id: 'maint',    name: 'Maintenance' },
        { id: 'com',      name: 'Communication' }
      ];
      await saveFunctions();
      console.log('Default functions created.');
    } else {
      console.error('Error loading functions:', err);
    }
  }
}

async function saveFunctions() {
  try {
    await fs.writeFile(FUNCTIONS_FILE_PATH, JSON.stringify(AVAILABLE_FUNCTIONS, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving functions:', err);
  }
}

// --- Initialisation des dossiers de données ---

async function initializeRosterFolders() {
  await fs.mkdir(ROSTER_CONFIG_DIR, { recursive: true }).catch(console.error);
  await fs.mkdir(DAILY_ROSTER_DIR,  { recursive: true }).catch(console.error);
}

// --- Initialisation globale au démarrage ---

(async () => {
  await fs.mkdir(PERSISTENT_DIR, { recursive: true }).catch(console.error);
  await fs.mkdir(DATA_DIR,       { recursive: true }).catch(console.error);
  await initializeRosterFolders();

  await loadUsers();
  await loadQualifications();
  await loadGrades();
  await loadFunctions();

  // Optionnel : initialiser des données d’exemple si vous le souhaitez
  // await initializeSampleRosterDataForTesting();
})();

// --- Middleware d’admin ---

const authorizeAdmin = (req, res, next) => {
  if (req.headers['x-user-role'] === 'admin') return next();
  return res.status(403).json({ message: 'Access denied. Administrator role required.' });
};

// --- Routes d’authentification ---

app.post("/api/login", async (req, res) => {
  const { agent, mdp } = req.body;
  if (!agent || !mdp) return res.status(400).json({ message: "Agent and password required" });

  const user = USERS[agent.toLowerCase()];
  if (!user) return res.status(401).json({ message: "Unknown agent" });
  const match = await bcrypt.compare(mdp, user.mdp);
  if (!match) return res.status(401).json({ message: "Incorrect password" });

  res.json({
    prenom: user.prenom,
    nom:    user.nom,
    role:   user.role,
    qualifications: user.qualifications || [],
    grades:         user.grades || [],
    functions:      user.functions || []
  });
});

// --- Routes de planning ---

app.get('/api/planning/:agent', async (req, res) => {
  const agent = req.params.agent.toLowerCase();
  const filePath = path.join(DATA_DIR, `${agent}.json`);
  try {
    const data = await fs.readFile(filePath, 'utf8');
    res.json(JSON.parse(data));
  } catch (err) {
    if (err.code === 'ENOENT') return res.json({});
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/planning/:agent', async (req, res) => {
  const agent = req.params.agent.toLowerCase();
  const filePath = path.join(DATA_DIR, `${agent}.json`);
  try {
    await fs.writeFile(filePath, JSON.stringify(req.body, null, 2), 'utf8');
    res.json({ message: 'Planning saved successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error when saving planning.' });
  }
});

app.get('/api/planning', async (req, res) => {
  try {
    const files = await fs.readdir(DATA_DIR);
    const all = {};
    for (const file of files.filter(f => f.endsWith('.json'))) {
      const agent = path.basename(file, '.json');
      const content = await fs.readFile(path.join(DATA_DIR, file), 'utf8');
      all[agent] = JSON.parse(content);
    }
    res.json(all);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error getting plannings' });
  }
});

// --- Routes d’administration des agents ---

app.get('/api/admin/agents', authorizeAdmin, (req, res) => {
  const list = Object.entries(USERS)
    .filter(([_,u]) => u.role === 'agent' || u.role === 'admin')
    .map(([id,u]) => ({
      id,
      prenom: u.prenom,
      nom:    u.nom,
      qualifications: u.qualifications || [],
      grades:         u.grades || [],
      functions:      u.functions || []
    }));
  res.json(list);
});

app.post('/api/admin/agents', authorizeAdmin, async (req, res) => {
  const { id, nom, prenom, password, qualifications, grades, functions } = req.body;
  if (!id || !nom || !prenom || !password) {
    return res.status(400).json({ message: 'Missing fields' });
  }
  const key = id.toLowerCase();
  if (USERS[key]) return res.status(409).json({ message: 'Agent exists' });

  USERS[key] = {
    nom,
    prenom,
    mdp: await bcrypt.hash(password, 10),
    role: 'agent',
    qualifications: qualifications || [],
    grades:         grades || [],
    functions:      functions || []
  };
  await saveUsers();
  res.status(201).json({ message: 'Agent added', agent: { id: key, nom, prenom, qualifications, grades, functions } });
});

app.put('/api/admin/agents/:id', authorizeAdmin, async (req, res) => {
  const key = req.params.id.toLowerCase();
  if (!USERS[key] || USERS[key].role !== 'agent') {
    return res.status(404).json({ message: 'Agent not found or not modifiable.' });
  }
  const { nom, prenom, newPassword, qualifications, grades, functions } = req.body;
  if (nom)       USERS[key].nom = nom;
  if (prenom)    USERS[key].prenom = prenom;
  if (Array.isArray(qualifications)) USERS[key].qualifications = qualifications;
  if (Array.isArray(grades))         USERS[key].grades         = grades;
  if (Array.isArray(functions))      USERS[key].functions      = functions;
  if (newPassword) {
    USERS[key].mdp = await bcrypt.hash(newPassword, 10);
  }
  await saveUsers();
  res.json({ message: 'Agent updated', agent: { id: key, nom: USERS[key].nom, prenom: USERS[key].prenom, qualifications: USERS[key].qualifications, grades: USERS[key].grades, functions: USERS[key].functions } });
});

app.delete('/api/admin/agents/:id', authorizeAdmin, async (req, res) => {
  const key = req.params.id.toLowerCase();
  if (!USERS[key] || USERS[key].role !== 'agent') {
    return res.status(404).json({ message: 'Agent not found or not deletable.' });
  }
  delete USERS[key];
  await saveUsers();
  const planningFile = path.join(DATA_DIR, `${key}.json`);
  await fs.unlink(planningFile).catch(() => {});
  res.json({ message: 'Agent and planning deleted.' });
});

// --- Dropdown login list ---

app.get('/api/agents/names', (req, res) => {
  const list = Object.entries(USERS)
    .filter(([_,u]) => u.role === 'agent' || u.role === 'admin')
    .map(([id,u]) => ({ id, prenom: u.prenom, nom: u.nom }));
  res.json(list);
});

// --- Gestion des qualifications ---

app.get('/api/qualifications', authorizeAdmin,    (req, res) => res.json(AVAILABLE_QUALIFICATIONS));
app.post('/api/qualifications', authorizeAdmin, async (req, res) => {
  const { id, name } = req.body;
  const key = id.toLowerCase();
  if (!id||!name) return res.status(400).json({message:'Missing'});
  if (AVAILABLE_QUALIFICATIONS.some(q=>q.id===key)) {
    return res.status(409).json({message:'Exists'});
  }
  AVAILABLE_QUALIFICATIONS.push({id:key,name});
  await saveQualifications();
  res.status(201).json({message:'Added', qualification:{id:key,name}});
});
app.put('/api/qualifications/:id', authorizeAdmin, async (req,res)=>{
  const key=req.params.id.toLowerCase(), {name}=req.body;
  const idx=AVAILABLE_QUALIFICATIONS.findIndex(q=>q.id===key);
  if(idx===-1) return res.status(404).json({message:'Not found'});
  AVAILABLE_QUALIFICATIONS[idx].name = name || AVAILABLE_QUALIFICATIONS[idx].name;
  await saveQualifications();
  res.json({message:'Updated', qualification:AVAILABLE_QUALIFICATIONS[idx]});
});
app.delete('/api/qualifications/:id', authorizeAdmin, async (req,res)=>{
  const key=req.params.id.toLowerCase();
  const before=AVAILABLE_QUALIFICATIONS.length;
  AVAILABLE_QUALIFICATIONS = AVAILABLE_QUALIFICATIONS.filter(q=>q.id!==key);
  if(AVAILABLE_QUALIFICATIONS.length===before) {
    return res.status(404).json({message:'Not found'});
  }
  // retirer des utilisateurs
  let modified=false;
  for(const u in USERS){
    if(USERS[u].qualifications?.includes(key)){
      USERS[u].qualifications = USERS[u].qualifications.filter(x=>x!==key);
      modified=true;
    }
  }
  await saveQualifications();
  if(modified) await saveUsers();
  res.json({message:'Deleted'});
});

// --- Gestion des grades ---

app.get('/api/grades', authorizeAdmin,    (req,res)=>res.json(AVAILABLE_GRADES));
app.post('/api/grades', authorizeAdmin, async (req,res)=>{
  const {id,name}=req.body;
  const key=id.toLowerCase();
  if(!id||!name) return res.status(400).json({message:'Missing'});
  if(AVAILABLE_GRADES.some(g=>g.id===key)) return res.status(409).json({message:'Exists'});
  AVAILABLE_GRADES.push({id:key,name});
  await saveGrades();
  res.status(201).json({message:'Added', grade:{id:key,name}});
});
app.put('/api/grades/:id', authorizeAdmin, async (req,res)=>{
  const key=req.params.id.toLowerCase(), {name}=req.body;
  const idx=AVAILABLE_GRADES.findIndex(g=>g.id===key);
  if(idx===-1) return res.status(404).json({message:'Not found'});
  AVAILABLE_GRADES[idx].name = name || AVAILABLE_GRADES[idx].name;
  await saveGrades();
  res.json({message:'Updated', grade:AVAILABLE_GRADES[idx]});
});
app.delete('/api/grades/:id', authorizeAdmin, async (req,res)=>{
  const key=req.params.id.toLowerCase();
  const before=AVAILABLE_GRADES.length;
  AVAILABLE_GRADES=AVAILABLE_GRADES.filter(g=>g.id!==key);
  if(AVAILABLE_GRADES.length===before) return res.status(404).json({message:'Not found'});
  let modified=false;
  for(const u in USERS){
    if(USERS[u].grades?.includes(key)){
      USERS[u].grades=USERS[u].grades.filter(x=>x!==key);
      modified=true;
    }
  }
  await saveGrades();
  if(modified) await saveUsers();
  res.json({message:'Deleted'});
});

// --- Gestion des fonctions ---

app.get('/api/functions', authorizeAdmin,    (req,res)=>res.json(AVAILABLE_FUNCTIONS));
app.post('/api/functions', authorizeAdmin, async (req,res)=>{
  const {id,name}=req.body;
  const key=id.toLowerCase();
  if(!id||!name) return res.status(400).json({message:'Missing'});
  if(AVAILABLE_FUNCTIONS.some(f=>f.id===key)) return res.status(409).json({message:'Exists'});
  AVAILABLE_FUNCTIONS.push({id:key,name});
  await saveFunctions();
  res.status(201).json({message:'Added', func:{id:key,name}});
});
app.put('/api/functions/:id', authorizeAdmin, async (req,res)=>{
  const key=req.params.id.toLowerCase(), {name}=req.body;
  const idx=AVAILABLE_FUNCTIONS.findIndex(f=>f.id===key);
  if(idx===-1) return res.status(404).json({message:'Not found'});
  AVAILABLE_FUNCTIONS[idx].name = name || AVAILABLE_FUNCTIONS[idx].name;
  await saveFunctions();
  res.json({message:'Updated', func:AVAILABLE_FUNCTIONS[idx]});
});
app.delete('/api/functions/:id', authorizeAdmin, async (req,res)=>{
  const key=req.params.id.toLowerCase();
  const before=AVAILABLE_FUNCTIONS.length;
  AVAILABLE_FUNCTIONS=AVAILABLE_FUNCTIONS.filter(f=>f.id!==key);
  if(AVAILABLE_FUNCTIONS.length===before) return res.status(404).json({message:'Not found'});
  let modified=false;
  for(const u in USERS){
    if(USERS[u].functions?.includes(key)){
      USERS[u].functions=USERS[u].functions.filter(x=>x!==key);
      modified=true;
    }
  }
  await saveFunctions();
  if(modified) await saveUsers();
  res.json({message:'Deleted'});
});

// --- Routes de la feuille de garde ---

app.get('/api/roster-config/:dateKey', async (req, res) => {
  const dateKey = req.params.dateKey;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return res.status(400).json({ message: 'Invalid date format. Expected YYYY-MM-DD.' });
  }
  const filePath = path.join(ROSTER_CONFIG_DIR, `${dateKey}.json`);
  try {
    const data = await fs.readFile(filePath, 'utf8');
    res.json(JSON.parse(data));
  } catch (err) {
    if (err.code === 'ENOENT') {
      return res.status(404).json({ message: 'Roster config not found for this date.' });
    }
    console.error(err);
    res.status(500).json({ message: 'Server error reading roster config.' });
  }
});

app.post('/api/roster-config/:dateKey', authorizeAdmin, async (req, res) => {
  const dateKey = req.params.dateKey;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return res.status(400).json({ message: 'Invalid date format. Expected YYYY-MM-DD.' });
  }
  const { timeSlots, onDutyAgents } = req.body;
  if (!timeSlots || !onDutyAgents) {
    return res.status(400).json({ message: 'Missing timeSlots or onDutyAgents.' });
  }
  const filePath = path.join(ROSTER_CONFIG_DIR, `${dateKey}.json`);
  await fs.writeFile(filePath, JSON.stringify({ timeSlots, onDutyAgents }, null, 2), 'utf8');
  res.json({ message: 'Roster config saved.' });
});

app.get('/api/daily-roster/:dateKey', async (req, res) => {
  const dateKey = req.params.dateKey;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return res.status(400).json({ message: 'Invalid date format. Expected YYYY-MM-DD.' });
  }
  const filePath = path.join(DAILY_ROSTER_DIR, `${dateKey}.json`);
  try {
    const data = await fs.readFile(filePath, 'utf8');
    res.json(JSON.parse(data));
  } catch (err) {
    if (err.code === 'ENOENT') {
      return res.status(404).json({ message: "Daily roster not found for this date." });
    }
    console.error(err);
    res.status(500).json({ message: 'Server error reading daily roster.' });
  }
});

app.post('/api/daily-roster/:dateKey', authorizeAdmin, async (req, res) => {
  const dateKey = req.params.dateKey;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return res.status(400).json({ message: 'Invalid date format. Expected YYYY-MM-DD.' });
  }
  const { roster } = req.body;
  if (!roster) {
    return res.status(400).json({ message: 'Missing roster data.' });
  }
  const filePath = path.join(DAILY_ROSTER_DIR, `${dateKey}.json`);
  await fs.writeFile(filePath, JSON.stringify({ roster }, null, 2), 'utf8');
  res.json({ message: 'Daily roster saved.' });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
