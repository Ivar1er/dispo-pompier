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
  credentials: true 
}));

app.use(express.json());

// Répertoire public
const PUBLIC_DIR = path.join(__dirname, 'public');
app.use(express.static(PUBLIC_DIR));

// Répertoire persistant (./data en dev, ou défini par l'env var PERSISTENT_DIR en prod)
const PERSISTENT_DIR = process.env.PERSISTENT_DIR || path.join(__dirname, 'data');

const DATA_DIR               = path.join(PERSISTENT_DIR, 'plannings'); // Ancien dossier, à ne plus utiliser pour les dispo agent
const USERS_FILE_PATH        = path.join(PERSISTENT_DIR, 'users.json');
const QUALIFICATIONS_FILE_PATH = path.join(PERSISTENT_DIR, 'qualifications.json');
const GRADES_FILE_PATH       = path.join(PERSISTENT_DIR, 'grades.json');
const FUNCTIONS_FILE_PATH    = path.join(PERSISTENT_DIR, 'functions.json'); // Maintenu car d'autres parties du code pourraient y faire référence (même si on l'a désactivé côté client admin)

const ROSTER_CONFIG_DIR      = path.join(PERSISTENT_DIR, 'roster_configs');
const DAILY_ROSTER_DIR       = path.join(PERSISTENT_DIR, 'daily_rosters');
// NOUVEAU : Répertoire pour les disponibilités individuelles des agents
const AGENT_AVAILABILITY_DIR = path.join(PERSISTENT_DIR, 'agent_availabilities'); 


let USERS = {};
let AVAILABLE_QUALIFICATIONS = [];
let AVAILABLE_GRADES = [];
let AVAILABLE_FUNCTIONS = [];

const DEFAULT_ADMIN_PASSWORD = 'supersecureadminpassword';

// --- Helpers de date (pour la structuration des plannings) ---
// Ces fonctions doivent être en sync avec celles côté client
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

function getDateForDayInWeek(weekNum, dayIndex, year = new Date().getFullYear()) {
    const daysOfWeek = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
    if (dayIndex === -1) { // dayIndex is already 0-6
        return null;
    }

    const simple = new Date(year, 0, 1 + (weekNum - 1) * 7);
    const dow = simple.getDay() || 7; 
    const mondayOfISOWeek = new Date(simple);
    mondayOfISOWeek.setDate(simple.getDate() - (dow === 0 ? 6 : dow - 1));
    mondayOfISOWeek.setHours(0, 0, 0, 0);

    const targetDate = new Date(mondayOfISOWeek);
    targetDate.setDate(mondayOfISOWeek.getDate() + dayIndex);
    return targetDate;
}

function formatDateToYYYYMMDD(d) {
    const dt = new Date(d);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}` +
        `-${String(dt.getDate()).padStart(2, '0')}`;
}


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
          mdp: hashedDefaultPassword,
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
        { id: 'ca_vsav', name: "CA VSAV" },
        { id: 'ca_fpt', name: 'CA FPT' },
        { id: 'ca_vtu', name: 'CA VTU' },
        { id: 'ca_vpma', name: 'CA VPMA' },
        { id: 'ca_ccf', name: 'CA CCF' },

        { id: 'cod_0', name: 'CD VSAV / VTU / VPMA' },
        { id: 'cod_1', name: 'CD FPT' },
        { id: 'cod_2', name: 'CD CCF' },

        { id: 'eq_vsav', name: 'EQ VSAV' },
        { id: 'eq_vtu', name: 'EQ VTU' },
        { id: 'eq_vpma', name: 'EQ VPMA' },
        { id: 'eq1_fpt', name: 'EQ1 FPT' },
        { id: 'eq2_fpt', name: 'EQ2 FPT' },
        { id: 'eq1_ccf', name: 'EQ1 CCF' },
        { id: 'eq2_ccf', name: 'EQ2 CCF' },
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
        { id: 'cch', name: 'Caporal-chef' },
        { id: 'sgt', name: 'Sergent' },
        { id: 'sch', name: 'Sergent-chef' },
        { id: 'adj', name: 'Adjudant' },
        { id: 'adc', name: 'Adjudant-chef' }
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

// --- Chargement / sauvegarde des fonctions (maintenu si besoin pour d'anciennes références) ---

async function loadFunctions() {
  try {
    const data = await fs.readFile(FUNCTIONS_FILE_PATH, 'utf8');
    AVAILABLE_FUNCTIONS = JSON.parse(data);
  } catch (err) {
    if (err.code === 'ENOENT') {
      AVAILABLE_FUNCTIONS = []; // Vide par défaut si supprimé du frontend
      await saveFunctions();
      console.log('Default functions created (empty).');
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
  // NOUVEAU : Création du dossier pour les disponibilités individuelles
  await fs.mkdir(AGENT_AVAILABILITY_DIR, { recursive: true }).catch(console.error);
}

// --- Initialisation globale au démarrage ---

(async () => {
  await fs.mkdir(PERSISTENT_DIR, { recursive: true }).catch(console.error);
  // DATA_DIR n'est plus utilisé pour les dispo agent, mais peut être utile pour d'autres usages.
  // await fs.mkdir(DATA_DIR,       { recursive: true }).catch(console.error); 
  await initializeRosterFolders();

  await loadUsers();
  await loadQualifications();
  await loadGrades();
  await loadFunctions(); // Maintenu pour la compatibilité, mais devrait charger vide si vous l'avez supprimé.

})();

// --- Middleware d’admin ---

const authorizeAdmin = (req, res, next) => {
  // Cette partie pourrait nécessiter une amélioration si vous utilisez de vraies sessions/tokens
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

// --- Routes de planning (disponibilités individuelles des agents) ---

// Nouvelle fonction pour charger toutes les disponibilités d'un agent et les structurer
// Elle lira tous les fichiers de l'agent dans les sous-dossiers de dates
async function loadAgentPlanningFromFiles(agentId) {
    const agentPlanning = {}; // { week-X: { day: [slots] } }
    const daysOfWeek = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

    try {
        // Lire tous les dossiers de dates dans AGENT_AVAILABILITY_DIR
        const dateFolders = await fs.readdir(AGENT_AVAILABILITY_DIR);

        for (const dateFolder of dateFolders) {
            const datePath = path.join(AGENT_AVAILABILITY_DIR, dateFolder);
            const stats = await fs.stat(datePath);

            if (stats.isDirectory()) {
                const filePath = path.join(datePath, `${agentId}.json`);
                try {
                    const data = await fs.readFile(filePath, 'utf8');
                    const availabilitiesForDate = JSON.parse(data); // C'est un tableau d'objets {start, end}

                    // Déduire la semaine et le jour à partir de dateFolder (ex: 2025-06-17)
                    const dateParts = dateFolder.split('-');
                    if (dateParts.length === 3) {
                        const year = parseInt(dateParts[0]);
                        const month = parseInt(dateParts[1]) - 1; // Mois 0-indexé
                        const day = parseInt(dateParts[2]);
                        const dateObj = new Date(year, month, day);

                        const weekNum = getCurrentISOWeek(dateObj);
                        const dayIndex = dateObj.getDay(); // 0 pour Dimanche, 1 pour Lundi, etc.
                        const clientDayName = daysOfWeek[(dayIndex === 0 ? 6 : dayIndex - 1)]; // Convertir 0 (Dim) en 6 (Dim), 1 (Lun) en 0 (Lun)

                        const weekKey = `week-${weekNum}`;
                        
                        if (!agentPlanning[weekKey]) {
                            agentPlanning[weekKey] = {};
                        }
                        // Convertir les objets {start, end} en chaînes "HH:MM - HH:MM" pour le client
                        agentPlanning[weekKey][clientDayName] = availabilitiesForDate.map(slot => `${slot.start} - ${slot.end}`);
                    }
                } catch (readErr) {
                    if (readErr.code === 'ENOENT') {
                        // console.warn(`[AVERTISSEMENT Serveur] Fichier de disponibilité pour l'agent ${agentId} le ${dateFolder} non trouvé. Ignoré.`);
                    } else {
                        console.error(`[ERREUR Serveur] Erreur de lecture du fichier de disponibilité pour ${agentId} le ${dateFolder}:`, readErr);
                    }
                }
            }
        }
    } catch (err) {
        if (err.code === 'ENOENT') {
            console.log(`[INFO Serveur] Le dossier de disponibilités des agents n'existe pas ou est vide. Retourne un objet vide.`);
        } else {
            console.error(`[ERREUR Serveur] Erreur inattendue lors du chargement des plannings de l'agent ${agentId}:`, err);
        }
    }
    return agentPlanning;
}


// Route pour obtenir le planning d'un agent spécifique (STRUCTURÉ PAR SEMAINE/JOUR)
app.get('/api/planning/:agentId', async (req, res) => {
  const agentId = req.params.agentId.toLowerCase();
  try {
    const planning = await loadAgentPlanningFromFiles(agentId);
    res.status(200).json(planning);
  } catch (err) {
    console.error(`[ERREUR Serveur] Erreur de récupération du planning de l'agent ${agentId}:`, err);
    res.status(500).json({ message: 'Erreur serveur lors de la récupération du planning.' });
  }
});


// Route pour sauvegarder le planning d'un agent spécifique pour UNE DATE
app.post('/api/agent-availability/:dateKey/:agentId', async (req, res) => {
    const dateKey = req.params.dateKey; // YYYY-MM-DD
    const agentId = req.params.agentId.toLowerCase();
    const availabilities = req.body; // C'est un tableau d'objets {start, end}

    if (!Array.isArray(availabilities)) {
        console.error(`[ERREUR Serveur] Availabilities doit être un tableau. Reçu type: ${typeof availabilities}, contenu:`, availabilities);
        return res.status(400).json({ message: 'Availabilities must be an array.' });
    }

    const filePath = path.join(AGENT_AVAILABILITY_DIR, dateKey, `${agentId}.json`);
    await fs.mkdir(path.dirname(filePath), { recursive: true }); // Crée le dossier de date si n'existe pas

    try {
        await fs.writeFile(filePath, JSON.stringify(availabilities, null, 2), 'utf8');
        console.log(`[INFO Serveur] Disponibilités de l'agent ${agentId} enregistrées pour la date ${dateKey}.`);
        res.status(200).json({ message: 'Disponibilités enregistrées avec succès.' });
    } catch (err) {
        console.error(`[ERREUR Serveur] Erreur lors de l'écriture du fichier de disponibilité pour ${agentId} sur ${dateKey}:`, err);
        res.status(500).json({ message: 'Erreur serveur lors de l\'enregistrement des disponibilités.' });
    }
});

// Route pour obtenir tous les plannings (utilisé pour le planning global de l'admin)
app.get('/api/planning', async (req, res) => {
  try {
    const allAgentIds = Object.keys(USERS).filter(id => USERS[id].role === 'agent');
    const allPlannings = {};
    for (const agentId of allAgentIds) {
      allPlannings[agentId] = await loadAgentPlanningFromFiles(agentId);
    }
    res.json(allPlannings);
  } catch (err) {
    console.error(`[ERREUR Serveur] Erreur de récupération de tous les plannings (admin):`, err);
    res.status(500).json({ message: 'Error getting all plannings' });
  }
});

// --- Routes d’administration des agents ---

app.get('/api/admin/agents', authorizeAdmin, (req, res) => {
  const list = Object.entries(USERS)
    .filter(([_,u]) => u.role === 'agent' || u.role === 'admin')
    .map(([id,u]) => ({
      _id: id, 
      prenom: u.prenom,
      nom:    u.nom,
      qualifications: u.qualifications || [],
      grades:         u.grades || [],
      functions:      u.functions || [] // Maintenu pour la compatibilité
    }));
  res.json(list);
});

// NOUVEAU : Route pour obtenir les détails d'un agent spécifique par ID
app.get('/api/admin/agents/:id', authorizeAdmin, (req, res) => {
    const agentId = req.params.id.toLowerCase();
    const agent = USERS[agentId];
    if (agent && (agent.role === 'agent' || agent.role === 'admin')) {
        res.json({
            _id: agentId,
            prenom: agent.prenom,
            nom: agent.nom,
            qualifications: agent.qualifications || [],
            grades: agent.grades || [],
            functions: agent.functions || [] // Maintenu pour la compatibilité
        });
    } else {
        res.status(404).json({ message: 'Agent not found or not authorized.' });
    }
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
  
  // Supprimer les fichiers de disponibilité de l'agent dans tous les dossiers de dates
  try {
      const dateFolders = await fs.readdir(AGENT_AVAILABILITY_DIR);
      for (const dateFolder of dateFolders) {
          const filePath = path.join(AGENT_AVAILABILITY_DIR, dateFolder, `${key}.json`);
          await fs.unlink(filePath).catch((err) => {
              if (err.code !== 'ENOENT') console.warn(`[AVERTISSEMENT Serveur] Erreur lors de la suppression du fichier de dispo de l'agent ${key} pour ${dateFolder}:`, err);
          });
      }
      console.log(`[INFO Serveur] Tous les fichiers de disponibilité pour l'agent ${key} ont été supprimés.`);
  } catch (err) {
      if (err.code === 'ENOENT') {
          console.log(`[INFO Serveur] Aucun dossier de disponibilité trouvé pour l'agent ${key}.`);
      } else {
          console.error(`[ERREUR Serveur] Erreur lors de la suppression des dossiers de disponibilité de l'agent ${key}:`, err);
      }
  }

  // Ancien chemin de planning, ne devrait plus exister pour les nouvelles données
  // const planningFile = path.join(DATA_DIR, `${key}.json`);
  // await fs.unlink(planningFile).catch(() => {}); 
  
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

// --- Gestion des fonctions (maintenu si besoin pour d'anciennes références) ---

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

// --- Routes de la feuille de garde (Configuration Admin) ---

app.get('/api/roster-config/:dateKey', async (req, res) => {
  const dateKey = req.params.dateKey;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    console.error(`[ERREUR Serveur] Format de date invalide pour roster-config: ${dateKey}`);
    return res.status(400).json({ message: 'Invalid date format. ExpectedYYYY-MM-DD.' });
  }
  const filePath = path.join(ROSTER_CONFIG_DIR, `${dateKey}.json`);
  try {
    const data = await fs.readFile(filePath, 'utf8');
    // Log pour le débogage : confirmation de la lecture du fichier
    console.log(`[INFO Serveur] Roster config found for ${dateKey}. Sending 200 OK.`);
    res.json(JSON.parse(data));
  } catch (err) {
    if (err.code === 'ENOENT') {
      // NOUVEAU : Retourne un objet vide si le fichier n'existe pas, avec un statut 200 OK
      console.log(`[INFO Serveur] Roster config file not found for ${dateKey}. Sending 200 OK with empty object.`);
      return res.status(200).json({});
    }
    console.error(`[ERREUR Serveur] Erreur inattendue de lecture de la config de roster pour ${dateKey}:`, err);
    res.status(500).json({ message: 'Server error reading roster config.' });
  }
});

app.post('/api/roster-config/:dateKey', authorizeAdmin, async (req, res) => {
  const dateKey = req.params.dateKey;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return res.status(400).json({ message: 'Invalid date format. ExpectedYYYY-MM-DD.' });
  }
  const { timeSlots, onDutyAgents } = req.body;
  if (!timeSlots || !onDutyAgents) {
    return res.status(400).json({ message: 'Missing timeSlots or onDutyAgents.' });
  }
  const filePath = path.join(ROSTER_CONFIG_DIR, `${dateKey}.json`);
  try {
    await fs.writeFile(filePath, JSON.stringify({ timeSlots, onDutyAgents }, null, 2), 'utf8');
    console.log(`[INFO Serveur] Roster config saved for ${dateKey}.`);
    res.json({ message: 'Roster config saved.' });
  } catch (err) {
    console.error(`[ERREUR Serveur] Erreur de sauvegarde de la config de roster pour ${dateKey}:`, err);
    res.status(500).json({ message: 'Server error saving roster config.' });
  }
});

// --- Routes de la feuille de garde (Daily Roster Admin - agents réellement en poste) ---

app.get('/api/daily-roster/:dateKey', async (req, res) => {
  const dateKey = req.params.dateKey;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    console.error(`[ERREUR Serveur] Format de date invalide pour daily-roster: ${dateKey}`);
    return res.status(400).json({ message: 'Invalid date format. ExpectedYYYY-MM-DD.' });
  }
  const filePath = path.join(DAILY_ROSTER_DIR, `${dateKey}.json`);
  try {
    const data = await fs.readFile(filePath, 'utf8');
    // Log pour le débogage : confirmation de la lecture du fichier
    console.log(`[INFO Serveur] Daily roster found for ${dateKey}. Sending 200 OK.`);
    res.json(JSON.parse(data));
  } catch (err) {
    if (err.code === 'ENOENT') {
      // NOUVEAU : Retourne un objet vide si le fichier n'existe pas, avec un statut 200 OK
      console.log(`[INFO Serveur] Daily roster file not found for ${dateKey}. Sending 200 OK with empty object.`);
      return res.status(200).json({});
    }
    console.error(`[ERREUR Serveur] Erreur inattendue de lecture du daily roster pour ${dateKey}:`, err);
    res.status(500).json({ message: 'Server error reading daily roster.' });
  }
});

app.post('/api/daily-roster/:dateKey', authorizeAdmin, async (req, res) => {
  const dateKey = req.params.dateKey;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return res.status(400).json({ message: 'Invalid date format. ExpectedYYYY-MM-DD.' });
  }
  const { onDutyAgents } = req.body; 
  if (!onDutyAgents) { 
    return res.status(400).json({ message: 'Missing onDutyAgents data.' }); 
  }
  const filePath = path.join(DAILY_ROSTER_DIR, `${dateKey}.json`);
  try {
    await fs.writeFile(filePath, JSON.stringify({ onDutyAgents }, null, 2), 'utf8');
    console.log(`[INFO Serveur] Daily roster saved for ${dateKey}.`);
    res.json({ message: 'Daily roster saved.' });
  } catch (err) {
    console.error(`[ERREUR Serveur] Erreur de sauvegarde du daily roster pour ${dateKey}:`, err);
    res.status(500).json({ message: 'Server error saving daily roster.' });
  }
});


app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
