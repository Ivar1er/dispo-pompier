
// serveur.js

const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcryptjs'); // Pour le hachage des mots de passe
const jwt = require('jsonwebtoken'); // Pour la gestion des tokens JWT

const app = express();
const port = process.env.PORT || 3000;

// Listez toutes les origines depuis lesquelles votre frontend peut se connecter.
// CORS: autorise localhost, 127.0.0.1, IPs LAN, et le domaine Render (HTTPS)
const cors = require('cors');
const corsOptions = {
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    const patterns = [
      /^http:\/\/localhost(?::\d+)?$/,
      /^http:\/\/127\.0\.0\.1(?::\d+)?$/,
      /^http:\/\/(10|192\.168|172\.(1[6-9]|2\d|3[0-1]))\.\d+\.\d+(?::\d+)?$/,
      /^https:\/\/dispo-pompier\.onrender\.com$/
    ];
    const ok = patterns.some(re => re.test(origin));
    return ok ? callback(null, true) : callback(new Error('CORS: origin not allowed: ' + origin));
  },
  credentials: true
};
app.use(cors(corsOptions));

app.use(express.json()); // Middleware pour parser les requêtes JSON
app.use(express.json()); // Middleware pour parser les requêtes JSON

// Répertoire public pour les fichiers statiques (HTML, CSS, JS du frontend)
const PUBLIC_DIR = path.join(__dirname, 'public');
app.use(express.static(PUBLIC_DIR));

// Répertoire persistant pour les données de l'application (en local ou sur Render)
const PERSISTENT_DIR = process.env.PERSISTENT_DIR || path.join(__dirname, 'data');

// Chemins des fichiers et dossiers de données
const USERS_FILE_PATH          = path.join(PERSISTENT_DIR, 'users.json');
const QUALIFICATIONS_FILE_PATH = path.join(PERSISTENT_DIR, 'qualifications.json');
const GRADES_FILE_PATH         = path.join(PERSISTENT_DIR, 'grades.json');
const FUNCTIONS_FILE_PATH      = path.join(PERSISTENT_DIR, 'functions.json'); // Maintenu pour compatibilité
const ENGINES_FILE_PATH        = path.join(PERSISTENT_DIR, 'engines.json'); // NOUVEAU: Chemin pour les engins
const ROSTER_CONFIG_DIR        = path.join(PERSISTENT_DIR, 'roster_configs');
const DAILY_ROSTER_DIR         = path.join(PERSISTENT_DIR, 'daily_rosters');
const AGENT_AVAILABILITY_DIR   = path.join(PERSISTENT_DIR, 'agent_availabilities'); // Dossier pour les dispo individuelles

// Variables globales pour stocker les données en mémoire (chargées au démarrage)
let USERS = {};
let AVAILABLE_QUALIFICATIONS = [];
let AVAILABLE_GRADES = [];
let AVAILABLE_FUNCTIONS = [];
let AVAILABLE_ENGINES = []; // NOUVEAU: Variable pour stocker les engins

// Mot de passe par défaut pour l'admin, utilisé si aucun fichier users.json n'existe au démarrage
const DEFAULT_ADMIN_PASSWORD = 'supersecureadminpassword'; // À CHANGER EN PROD ET UTILISER UNE VARIABLE D'ENV !
const JWT_SECRET = process.env.JWT_SECRET || 'pompier_de_beaune_la_rolande_2025_marechal'; // Clé secrète JWT


// --- Helpers de date (utilisés pour la structuration des plannings) ---
// Ces fonctions doivent être en phase avec celles utilisées côté client si nécessaire.
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

/**
 * Calcule les dates de début et de fin d'une semaine ISO (YYYY-Wnn).
 * @param {string} isoWeekString - L'identifiant de la semaine ISO (ex: "2025-W25").
 * @returns {object} Un objet avec startDate et endDate formatés en JJ/MM.
 */
function getDatesForISOWeek(isoWeekString) {
    const [yearStr, weekStr] = isoWeekString.split('-W');
    const year = parseInt(yearStr);
    const weekNum = parseInt(weekStr);

    // Commencez par le 4 janvier de l'année (toujours dans la première semaine ISO de l'année)
    const jan4 = new Date(year, 0, 4);
    // Obtenez le jour de la semaine pour le 4 janvier (0 = Dimanche, 1 = Lundi, ..., 6 = Samedi)
    // Ajustez pour que Lundi soit 0, Mardi 1, etc.
    const jan4DayOfWeek = (jan4.getDay() + 6) % 7; // Lundi = 0, Mardi = 1, etc.

    // Trouvez le premier lundi de l'année
    const firstMonday = new Date(jan4);
    firstMonday.setDate(jan4.getDate() - jan4DayOfWeek);

    // Calculez le lundi de la semaine spécifiée
    const targetMonday = new Date(firstMonday);
    targetMonday.setDate(firstMonday.getDate() + (weekNum - 1) * 7);

    const targetSunday = new Date(targetMonday);
    targetSunday.setDate(targetMonday.getDate() + 6);

    const format_dd_mm = (date) => {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        return `${day}/${month}`;
    };

    return {
        startDate: format_dd_mm(targetMonday),
        endDate: format_dd_mm(targetSunday)
    };
}


// --- Chargement / sauvegarde des utilisateurs ---

async function loadUsers() {
    try {
        const data = await fs.readFile(USERS_FILE_PATH, 'utf8');
        USERS = JSON.parse(data);
    } catch (err) {
        if (err.code === 'ENOENT') {
            // Si le fichier users.json n'existe pas, créer un utilisateur admin par défaut
            const hashedDefaultPassword = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10);
            const hashedAgentPassword = await bcrypt.hash("password", 10); // Mot de passe simple pour les agents

            USERS = {
                admin: {
                    id: 'admin', // Ajout de l'ID pour être cohérent avec les autres agents
                    prenom: "Admin",
                    nom: "Principal",
                    username: "Admin Principal", // Ajouté pour la cohérence
                    mdp: hashedDefaultPassword,
                    role: "admin",
                    qualifications: [],
                    grades: [],
                    functions: [],
                    availability: [] // Ajouté pour la cohérence
                },
                agent1: {
                    id: 'agent1',
                    prenom: "Jean",
                    nom: "Dupont",
                    username: "Jean Dupont", // Ajouté pour la cohérence
                    mdp: hashedAgentPassword,
                    role: "agent",
                    qualifications: ["ca_vsav", "cod_1", "eq1_fpt"], // Exemple de qualifications
                    grades: ["sap"],
                    functions: [],
                    availability: [
                        // Exemple de disponibilité pour la date actuelle
                        { "year": new Date().getFullYear(), "month": new Date().getMonth() + 1, "day": new Date().getDate(), "slots": [{ "start": 14, "end": 28 }] }
                    ]
                },
                agent2: {
                    id: 'agent2',
                    prenom: "Marie",
                    nom: "Curie",
                    username: "Marie Curie", // Ajouté pour la cohérence
                    mdp: hashedAgentPassword,
                    role: "agent",
                    qualifications: ["eq_vsav", "cod_0", "ca_fpt"], // Exemple de qualifications
                    grades: ["cpl"],
                    functions: [],
                    availability: [
                        // Exemple de disponibilité pour la date actuelle
                        { "year": new Date().getFullYear(), "month": new Date().getMonth() + 1, "day": new Date().getDate(), "slots": [{ "start": 0, "end": 14 }] }
                    ]
                }
            };
            await saveUsers();
            console.log(`[INFO] Utilisateurs par défaut créés (admin, agent1, agent2). Admin: id: admin, mdp: ${DEFAULT_ADMIN_PASSWORD}. Agents: mdp: password.`);
        } else {
            console.error('[ERREUR] Erreur lors du chargement des utilisateurs :', err);
        }
    }
}

async function saveUsers() {
    try {
        await fs.writeFile(USERS_FILE_PATH, JSON.stringify(USERS, null, 2), 'utf8');
    } catch (err) {
        console.error('[ERREUR] Erreur lors de la sauvegarde des utilisateurs :', err);
    }
}

// --- Fonctions génériques de chargement/sauvegarde pour les qualifications, grades, fonctions, ENGINES ---

async function loadData(filePath, defaultData, setterFunction, name) {
    try {
        const data = await fs.readFile(filePath, 'utf8');
        setterFunction(JSON.parse(data));
    } catch (err) {
        if (err.code === 'ENOENT') {
            setterFunction(defaultData);
            await saveData(filePath, defaultData);
            console.log(`[INFO] Données par défaut pour ${name} créées.`);
        } else {
            console.error(`[ERREUR] Erreur lors du chargement des ${name} :`, err);
        }
    }
}

async function saveData(filePath, data) {
    try {
        await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
        console.error(`[ERREUR] Erreur lors de la sauvegarde des données vers ${filePath} :`, err);
    }
}

async function loadQualifications() {
    await loadData(QUALIFICATIONS_FILE_PATH, [
        { id: 'ca_vsav', name: "CA VSAV" }, { id: 'ca_fpt', name: 'CA FPT' },
        { id: 'ca_vtu', name: 'CA VTU' }, { id: 'ca_vpma', name: 'CA VPMA' },
        { id: 'ca_ccf', name: 'CA CCF' }, { id: 'cod_0', name: 'CD VSAV / VTU / VPMA' },
        { id: 'cod_1', name: 'CD FPT' }, { id: 'cod_2', name: 'CD CCF' },
        { id: 'eq_vsav', name: 'EQ VSAV' }, { id: 'eq_vtu', name: 'EQ VTU' }, // Ajouté pour VTU
        { id: 'eq_vpma', name: 'EQ VPMA' }, // Ajouté pour VPMA
        { id: 'eq1_fpt', name: 'EQ1 FPT' },
        { id: 'eq2_fpt', name: 'EQ2 FPT' }, { id: 'eq1_ccf', name: 'EQ1 CCF' },
        { id: 'eq2_ccf', name: 'EQ2 CCF' },
    ], (data) => AVAILABLE_QUALIFICATIONS = data, 'qualifications');
}
async function saveQualifications() { await saveData(QUALIFICATIONS_FILE_PATH, AVAILABLE_QUALIFICATIONS); }

async function loadGrades() {
    await loadData(GRADES_FILE_PATH, [
        { id: 'sap', name: 'Sapeur' }, { id: 'cpl', name: 'Caporal' },
        { id: 'cch', name: 'Caporal-chef' }, { id: 'sgt', name: 'Sergent' },
        { id: 'sch', name: 'Sergent-chef' }, { id: 'adj', name: 'Adjudant' },
        { id: 'adc', name: 'Adjudant-chef' }
    ], (data) => AVAILABLE_GRADES = data, 'grades');
}
async function saveGrades() { await saveData(GRADES_FILE_PATH, AVAILABLE_GRADES); }

async function loadFunctions() {
    await loadData(FUNCTIONS_FILE_PATH, [], (data) => AVAILABLE_FUNCTIONS = data, 'functions');
}
async function saveFunctions() { await saveData(FUNCTIONS_FILE_PATH, AVAILABLE_FUNCTIONS); }

// NOUVEAU: Fonctions de chargement et sauvegarde des engins
async function loadEngines() {
    await loadData(ENGINES_FILE_PATH, [
        {
            id: 'vsav1',
            name: 'VSAV 1',
            roles: [
                { id: 'ch_vsav', name: 'Chef d\'agrès VSAV', qualificationIds: ['ca_vsav'], gradeIds: [] },
                { id: 'cod_vsav', name: 'Conducteur VSAV', qualificationIds: ['cod_0'], gradeIds: [] },
                { id: 'eq1_vsav', name: 'Équipier 1 VSAV', qualificationIds: ['eq_vsav'], gradeIds: [] },
            ]
        },
        {
            id: 'fpt1',
            name: 'FPT 1',
            roles: [
                { id: 'ch_fpt', name: 'Chef d\'agrès FPT', qualificationIds: ['ca_fpt'], gradeIds: [] },
                { id: 'cod_fpt', name: 'Conducteur FPT', qualificationIds: ['cod_1'], gradeIds: [] },
                { id: 'eq1_fpt', name: 'Équipier 1 FPT', qualificationIds: ['eq1_fpt'], gradeIds: [] },
                { id: 'eq2_fpt', name: 'Équipier 2 FPT', qualificationIds: ['eq2_fpt'], gradeIds: [] }
            ]
        },
        {
            id: 'vtu1',
            name: 'VTU 1',
            roles: [
                { id: 'ch_vtu', name: 'Chef d\'agrès VTU', qualificationIds: ['ca_vtu'], gradeIds: [] },
                { id: 'cod_vtu', name: 'Conducteur VTU', qualificationIds: ['cod_0'], gradeIds: [] }
            ]
        }
    ], (data) => AVAILABLE_ENGINES = data, 'engines');
}
async function saveEngines() { await saveData(ENGINES_FILE_PATH, AVAILABLE_ENGINES); }


// --- Initialisation des dossiers de données au démarrage du serveur ---

async function initializeDataFolders() {
    await fs.mkdir(PERSISTENT_DIR, { recursive: true }).catch(err => console.error(`[ERREUR] Impossible de créer le dossier persistant : ${err.message}`));
    await fs.mkdir(ROSTER_CONFIG_DIR, { recursive: true }).catch(err => console.error(`[ERREUR] Impossible de créer le dossier de configs de roster : ${err.message}`));
    await fs.mkdir(DAILY_ROSTER_DIR, { recursive: true }).catch(err => console.error(`[ERREUR] Impossible de créer le dossier de daily rosters : ${err.message}`));
    await fs.mkdir(AGENT_AVAILABILITY_DIR, { recursive: true }).catch(err => console.error(`[ERREUR] Impossible de créer le dossier de dispo agents : ${err.message}`));
}

// --- Initialisation globale au démarrage du serveur ---
// Charge toutes les données initiales
(async () => {
    await initializeDataFolders();
    await loadUsers();
    await loadQualifications();
    await loadGrades();
    await loadFunctions();
    await loadEngines(); // NOUVEAU: Charger les engins au démarrage
    console.log('[INFO] Serveur initialisé et données chargées.');
})();


// --- Middleware d'authentification et d'autorisation (JWT basé) ---

// Middleware d'authentification: vérifie la validité du token JWT
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Format: "Bearer TOKEN"

    if (token == null) {
        console.warn('[AUTH] Tentative d\'accès sans token.');
        return res.sendStatus(401); // Non autorisé
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.error('[AUTH] Vérification JWT échouée :', err.message);
            return res.sendStatus(403); // Interdit (token invalide ou expiré)
        }
        req.user = user; // Attache les infos de l'utilisateur décodées à la requête
        next(); // Passe à la route suivante
    });
}

// Middleware d'autorisation: vérifie si l'utilisateur a le rôle 'admin'
function authorizeAdmin(req, res, next) {
    // S'appuie sur req.user qui est défini par authenticateToken
    if (!req.user || req.user.role !== 'admin') {
        console.warn(`[AUTH] Accès admin refusé pour l'utilisateur : ${req.user ? req.user.id : 'Non authentifié'}`);
        return res.status(403).json({ message: 'Accès refusé. Rôle administrateur requis.' });
    }
    next();
}

// --- Routes d'authentification ---

app.post("/api/login", async (req, res) => {
    const { username, password } = req.body; // Renommé 'agent' en 'username' pour cohérence
    if (!username || !password) {
        return res.status(400).json({ message: "Nom d'utilisateur et mot de passe requis." });
    }

    const user = USERS[username.toLowerCase()];
    if (!user) {
        return res.status(401).json({ message: "Nom d'utilisateur ou mot de passe incorrect." });
    }

    const match = await bcrypt.compare(password, user.mdp);
    if (!match) {
        return res.status(401).json({ message: "Nom d'utilisateur ou mot de passe incorrect." });
    }

    // Génère un token JWT si l'authentification est réussie
    // Ajoute le prénom et le nom de l'utilisateur au payload du token
    const token = jwt.sign(
        { id: username.toLowerCase(), prenom: user.prenom, nom: user.nom, role: user.role },
        JWT_SECRET,
        { expiresIn: '1h' } // Le token expire après 1 heure
    );

    res.json({
        token: token,
        user: { // Retourne aussi les infos de l'utilisateur pour le frontend
            id: username.toLowerCase(),
            prenom: user.prenom,
            nom: user.nom,
            role: user.role,
            qualifications: user.qualifications || [],
            grades: user.grades || [],
            functions: user.functions || []
        }
    });
});

// --- Nouvelle route pour obtenir les informations de l'agent connecté ---
app.get('/api/agent-info', authenticateToken, (req, res) => {
    // Les informations de l'agent sont disponibles dans req.user grâce à authenticateToken
    // Elles incluent maintenant prenom et nom grâce à la modification dans la route /api/login
    const { id, prenom, nom, role } = req.user;
    // Ajout du champ username pour la cohérence avec le frontend
    const username = `${prenom} ${nom}`;
    res.json({ id, firstName: prenom, lastName: nom, username, role });
});


// Route de déconnexion (côté serveur, optionnel si la déconnexion est gérée uniquement côté client)
app.post('/logout', authenticateToken, (req, res) => {
    // Dans une vraie application, vous pourriez invalider le token côté serveur (liste noire JWT)
    console.log(`[AUTH] Utilisateur ${req.user.id} déconnecté.`);
    res.status(200).json({ message: 'Déconnexion réussie.' });
});

// --- Routes de gestion des agents (Admin) ---

// Récupérer tous les agents (protégé par admin)
app.get('/api/admin/agents', authenticateToken, authorizeAdmin, (req, res) => {
    const list = Object.entries(USERS)
        .filter(([_, u]) => u.role === 'agent' || u.role === 'admin') // Inclut les admins aussi
        .map(([id, u]) => ({
            _id: id,
            prenom: u.prenom,
            nom: u.nom,
            username: u.username, // Assurez-vous que le champ username est inclus
            qualifications: u.qualifications || [],
            grades: u.grades || [],
            functions: u.functions || []
        }));
    res.json(list);
});

// Récupérer les détails d'un agent spécifique par ID (protégé par admin)
app.get('/api/admin/agents/:id', authenticateToken, authorizeAdmin, (req, res) => {
    const agentId = req.params.id.toLowerCase();
    const agent = USERS[agentId];
    if (agent && (agent.role === 'agent' || agent.role === 'admin')) {
        res.json({
            _id: agentId,
            prenom: agent.prenom,
            nom: agent.nom,
            username: agent.username, // Assurez-vous que le champ username est inclus
            qualifications: agent.qualifications || [],
            grades: agent.grades || [],
            functions: agent.functions || []
        });
    } else {
        res.status(404).json({ message: 'Agent non trouvé ou non autorisé.' });
    }
});

// Ajouter un nouvel agent (protégé par admin)
app.post('/api/admin/agents', authenticateToken, authorizeAdmin, async (req, res) => {
    const { id, nom, prenom, password, qualifications, grades, functions } = req.body;
    if (!id || !nom || !prenom || !password) {
        return res.status(400).json({ message: 'Champs manquants.' });
    }
    const key = id.toLowerCase();
    if (USERS[key]) return res.status(409).json({ message: 'L\'agent existe déjà.' });

    USERS[key] = {
        id: key, // Ajout de l'ID pour être cohérent
        nom,
        prenom,
        username: `${prenom} ${nom}`, // Création du username pour l'affichage
        mdp: await bcrypt.hash(password, 10),
        role: 'agent', // Rôle par défaut 'agent'
        qualifications: qualifications || [],
        grades: grades || [],
        functions: functions || [],
        availability: [] // Initialise l'historique de disponibilité
    };
    await saveUsers();
    res.status(201).json({ message: 'Agent ajouté', agent: { id: key, nom, prenom, username: USERS[key].username, qualifications, grades, functions } });
});

// Mettre à jour un agent existant (protégé par admin)
app.put('/api/admin/agents/:id', authenticateToken, authorizeAdmin, async (req, res) => {
    const key = req.params.id.toLowerCase();
    if (!USERS[key] || USERS[key].role !== 'agent') {
        return res.status(404).json({ message: 'Agent non trouvé ou non modifiable.' });
    }
    const { nom, prenom, newPassword, qualifications, grades, functions } = req.body;
    if (nom) USERS[key].nom = nom;
    if (prenom) USERS[key].prenom = prenom;
    USERS[key].username = `${USERS[key].prenom} ${USERS[key].nom}`; // Mise à jour du username
    if (Array.isArray(qualifications)) USERS[key].qualifications = qualifications;
    if (Array.isArray(grades)) USERS[key].grades = grades;
    if (Array.isArray(functions)) USERS[key].functions = functions;
    if (newPassword) {
        USERS[key].mdp = await bcrypt.hash(newPassword, 10);
    }
    await saveUsers();
    res.json({ message: 'Agent mis à jour', agent: { id: key, nom: USERS[key].nom, prenom: USERS[key].prenom, username: USERS[key].username, qualifications: USERS[key].qualifications, grades: USERS[key].grades, functions: USERS[key].functions } });
});

// Supprimer un agent (protégé par admin)
app.delete('/api/admin/agents/:id', authenticateToken, authorizeAdmin, async (req, res) => {
    const key = req.params.id.toLowerCase();
    if (!USERS[key] || USERS[key].role !== 'agent') {
        return res.status(404).json({ message: 'Agent non trouvé ou non supprimable.' });
    }
    delete USERS[key];
    await saveUsers();

    // Tente de supprimer les fichiers de disponibilité de l'agent
    try {
        const dateFolders = await fs.readdir(AGENT_AVAILABILITY_DIR);
        for (const dateFolder of dateFolders) {
            const filePath = path.join(AGENT_AVAILABILITY_DIR, dateFolder, `${key}.json`);
            await fs.unlink(filePath).catch((err) => {
                // Ignore l'erreur si le fichier n'existe pas (ENOENT)
                if (err.code !== 'ENOENT') console.warn(`[AVERTISSEMENT] Erreur lors de la suppression du fichier de dispo de l'agent ${key} pour ${dateFolder}:`, err);
            });
        }
        console.log(`[INFO] Tous les fichiers de disponibilité pour l'agent ${key} ont été supprimés.`);
    } catch (err) {
        if (err.code === 'ENOENT') {
            console.log(`[INFO] Aucun dossier de disponibilité trouvé pour l'agent ${key}.`);
        } else {
            console.error(`[ERREUR] Erreur lors de la suppression des dossiers de disponibilité de l'agent ${key}:`, err);
        }
    }

    res.json({ message: 'Agent et plannings supprimés.' });
});

// --- Route pour la liste déroulante de connexion ---
// Accessible publiquement, ne révèle pas de données sensibles
app.get('/api/agents/names', (req, res) => {
    const list = Object.entries(USERS)
        .filter(([_, u]) => u.role === 'agent' || u.role === 'admin')
        .map(([id, u]) => ({ id, prenom: u.prenom, nom: u.nom, username: u.username })); // Inclure username
    res.json(list);
});

// --- Routes de gestion des qualifications (Admin) ---

app.get('/api/qualifications', authenticateToken, authorizeAdmin, (req, res) => res.json(AVAILABLE_QUALIFICATIONS));
app.post('/api/qualifications', authenticateToken, authorizeAdmin, async (req, res) => {
    const { id, name } = req.body;
    const key = id.toLowerCase();
    if (!id || !name) return res.status(400).json({ message: 'Champs manquants.' });
    if (AVAILABLE_QUALIFICATIONS.some(q => q.id === key)) {
        return res.status(409).json({ message: 'Cette qualification existe déjà.' });
    }
    AVAILABLE_QUALIFICATIONS.push({ id: key, name });
    await saveQualifications();
    res.status(201).json({ message: 'Qualification ajoutée', qualification: { id: key, name } });
});
app.put('/api/qualifications/:id', authenticateToken, authorizeAdmin, async (req, res) => {
    const key = req.params.id.toLowerCase(), { name } = req.body;
    const idx = AVAILABLE_QUALIFICATIONS.findIndex(q => q.id === key);
    if (idx === -1) return res.status(404).json({ message: 'Qualification non trouvée.' });
    AVAILABLE_QUALIFICATIONS[idx].name = name || AVAILABLE_QUALIFICATIONS[idx].name;
    await saveQualifications();
    res.json({ message: 'Qualification mise à jour', qualification: AVAILABLE_QUALIFICATIONS[idx] });
});
app.delete('/api/qualifications/:id', authenticateToken, authorizeAdmin, async (req, res) => {
    const key = req.params.id.toLowerCase();
    const before = AVAILABLE_QUALIFICATIONS.length;
    AVAILABLE_QUALIFICATIONS = AVAILABLE_QUALIFICATIONS.filter(q => q.id !== key);
    if (AVAILABLE_QUALIFICATIONS.length === before) {
        return res.status(404).json({ message: 'Qualification non trouvée.' });
    }
    // Retirer cette qualification de tous les utilisateurs qui la possédaient
    let modified = false;
    for (const u in USERS) {
        if (USERS[u].qualifications?.includes(key)) {
            USERS[u].qualifications = USERS[u].qualifications.filter(x => x !== key);
            modified = true;
        }
    }
    await saveQualifications();
    if (modified) await saveUsers(); // Sauvegarde les utilisateurs si des changements ont été faits
    res.json({ message: 'Qualification supprimée.' });
});

// --- Routes de gestion des grades (Admin) ---

app.get('/api/grades', authenticateToken, authorizeAdmin, (req, res) => res.json(AVAILABLE_GRADES));
app.post('/api/grades', authenticateToken, authorizeAdmin, async (req, res) => {
    const { id, name } = req.body;
    const key = id.toLowerCase();
    if (!id || !name) return res.status(400).json({ message: 'Champs manquants.' });
    if (AVAILABLE_GRADES.some(g => g.id === key)) return res.status(409).json({ message: 'Ce grade existe déjà.' });
    AVAILABLE_GRADES.push({ id: key, name });
    await saveGrades();
    res.status(201).json({ message: 'Grade ajouté', grade: { id: key, name } });
});
app.put('/api/grades/:id', authenticateToken, authorizeAdmin, async (req, res) => {
    const key = req.params.id.toLowerCase(), { name } = req.body;
    const idx = AVAILABLE_GRADES.findIndex(g => g.id === key);
    if (idx === -1) return res.status(404).json({ message: 'Grade non trouvé.' });
    AVAILABLE_GRADES[idx].name = name || AVAILABLE_GRADES[idx].name;
    await saveGrades();
    res.json({ message: 'Grade mis à jour', grade: AVAILABLE_GRADES[idx] });
});
app.delete('/api/grades/:id', authenticateToken, authorizeAdmin, async (req, res) => {
    const key = req.params.id.toLowerCase();
    const before = AVAILABLE_GRADES.length;
    AVAILABLE_GRADES = AVAILABLE_GRADES.filter(g => g.id !== key);
    if (AVAILABLE_GRADES.length === before) return res.status(404).json({ message: 'Grade non trouvé.' });
    // Retirer ce grade de tous les utilisateurs qui le possédaient
    let modified = false;
    for (const u in USERS) {
        if (USERS[u].grades?.includes(key)) {
            USERS[u].grades = USERS[u].grades.filter(x => x !== key);
            modified = true;
        }
    }
    await saveGrades();
    if (modified) await saveUsers();
    res.json({ message: 'Grade supprimé.' });
});

// --- Routes de gestion des fonctions (Admin - si encore utilisées) ---
// Similaires aux qualifications/grades, à maintenir si vous avez des données ou des usages.

app.get('/api/functions', authenticateToken, authorizeAdmin, (req, res) => res.json(AVAILABLE_FUNCTIONS));
app.post('/api/functions', authenticateToken, authorizeAdmin, async (req, res) => {
    const { id, name } = req.body;
    const key = id.toLowerCase();
    if (!id || !name) return res.status(400).json({ message: 'Champs manquants.' });
    if (AVAILABLE_FUNCTIONS.some(f => f.id === key)) return res.status(409).json({ message: 'Cette fonction existe déjà.' });
    AVAILABLE_FUNCTIONS.push({ id: key, name });
    await saveFunctions();
    res.status(201).json({ message: 'Fonction ajoutée', func: { id: key, name } });
});
app.put('/api/functions/:id', authenticateToken, authorizeAdmin, async (req, res) => {
    const key = req.params.id.toLowerCase(), { name } = req.body;
    const idx = AVAILABLE_FUNCTIONS.findIndex(f => f.id === key);
    if (idx === -1) return res.status(404).json({ message: 'Fonction non trouvée.' });
    AVAILABLE_FUNCTIONS[idx].name = name || AVAILABLE_FUNCTIONS[idx].name;
    await saveFunctions();
    res.json({ message: 'Fonction mise à jour', func: AVAILABLE_FUNCTIONS[idx] });
});
app.delete('/api/functions/:id', authenticateToken, authorizeAdmin, async (req, res) => {
    const key = req.params.id.toLowerCase();
    const before = AVAILABLE_FUNCTIONS.length;
    AVAILABLE_FUNCTIONS = AVAILABLE_FUNCTIONS.filter(f => f.id !== key);
    if (AVAILABLE_FUNCTIONS.length === before) return res.status(404).json({ message: 'Fonction non trouvée.' });
    let modified = false;
    for (const u in USERS) {
        if (USERS[u].functions?.includes(key)) {
            USERS[u].functions = USERS[u].functions.filter(x => x !== key);
            modified = true;
        }
    }
    await saveFunctions();
    if (modified) await saveUsers();
    res.json({ message: 'Fonction supprimée.' });
});

// NOUVEAU: Routes de gestion des engins (Admin)
app.get('/api/engines', authenticateToken, authorizeAdmin, (req, res) => {
    res.json(AVAILABLE_ENGINES);
});

app.post('/api/engines', authenticateToken, authorizeAdmin, async (req, res) => {
    const { id, name, roles } = req.body;
    const key = id.toLowerCase();
    if (!id || !name || !Array.isArray(roles)) {
        return res.status(400).json({ message: 'Champs manquants ou format invalide.' });
    }
    if (AVAILABLE_ENGINES.some(e => e.id === key)) {
        return res.status(409).json({ message: 'Cet engin existe déjà.' });
    }
    AVAILABLE_ENGINES.push({ id: key, name, roles });
    await saveEngines();
    res.status(201).json({ message: 'Engin ajouté', engine: { id: key, name, roles } });
});

app.put('/api/engines/:id', authenticateToken, authorizeAdmin, async (req, res) => {
    const key = req.params.id.toLowerCase();
    const { name, roles } = req.body;
    const idx = AVAILABLE_ENGINES.findIndex(e => e.id === key);
    if (idx === -1) {
        return res.status(404).json({ message: 'Engin non trouvé.' });
    }
    if (name) AVAILABLE_ENGINES[idx].name = name;
    if (Array.isArray(roles)) AVAILABLE_ENGINES[idx].roles = roles;
    await saveEngines();
    res.json({ message: 'Engin mis à jour', engine: AVAILABLE_ENGINES[idx] });
});

app.delete('/api/engines/:id', authenticateToken, authorizeAdmin, async (req, res) => {
    const key = req.params.id.toLowerCase();
    const before = AVAILABLE_ENGINES.length;
    AVAILABLE_ENGINES = AVAILABLE_ENGINES.filter(e => e.id !== key);
    if (AVAILABLE_ENGINES.length === before) {
        return res.status(404).json({ message: 'Engin non trouvé.' });
    }
    await saveEngines();
    res.json({ message: 'Engin supprimé.' });
});


// --- Routes de la feuille de garde (Configuration Admin) ---
// Gère la configuration des créneaux horaires et des affectations d'engin pour une date donnée.

app.get('/api/roster-config/:dateKey', authenticateToken, authorizeAdmin, async (req, res) => {
    const dateKey = req.params.dateKey;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
        console.error(`[ERREUR Serveur] Format de date invalide pour roster-config: ${dateKey}`);
        return res.status(400).json({ message: 'Invalid date format. ExpectedYYYY-MM-DD.' });
    }
    const filePath = path.join(ROSTER_CONFIG_DIR, `${dateKey}.json`);
    try {
        const data = await fs.readFile(filePath, 'utf8');
        console.log(`[INFO Serveur] Roster config found for ${dateKey}.`);
        res.json(JSON.parse(data));
    } catch (err) {
        if (err.code === 'ENOENT') {
            // Retourne un objet vide si le fichier n'existe pas, avec un statut 200 OK
            console.log(`[INFO Serveur] Roster config file not found for ${dateKey}. Sending 200 OK with empty object.`);
            return res.status(200).json({});
        }
        console.error(`[ERREUR Serveur] Erreur inattendue de lecture de la config de roster pour ${dateKey}:`, err);
        res.status(500).json({ message: 'Server error reading roster config.' });
    }
});

app.post('/api/roster-config/:dateKey', authenticateToken, authorizeAdmin, async (req, res) => {
    const dateKey = req.params.dateKey;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
        return res.status(400).json({ message: 'Invalid date format. ExpectedYYYY-MM-DD.' });
    }
    const { timeSlots } = req.body; // onDutyAgents est géré par la route daily-roster
    if (!timeSlots) {
        return res.status(400).json({ message: 'Missing timeSlots data.' });
    }
    const filePath = path.join(ROSTER_CONFIG_DIR, `${dateKey}.json`);
    try {
        // Lire la config existante pour préserver onDutyAgents si la config n'a pas été chargée avant
        let existingConfig = {};
        try {
            const currentData = await fs.readFile(filePath, 'utf8');
            existingConfig = JSON.parse(currentData);
        } catch (readErr) {
            if (readErr.code !== 'ENOENT') {
                console.warn(`[WARN Serveur] Erreur de lecture de la config existante pour ${dateKey}, mais continuons:`, readErr);
            }
        }

        // Fusionner avec les timeSlots fournis, mais conserver les onDutyAgents existants
        const configToSave = {
            timeSlots: timeSlots,
            onDutyAgents: existingConfig.onDutyAgents || [] // Préserve la liste des onDutyAgents si elle existe
        };

        await fs.writeFile(filePath, JSON.stringify(configToSave, null, 2), 'utf8');
        console.log(`[INFO Serveur] Roster config saved for ${dateKey}.`);
        res.json({ message: 'Roster config saved.' });
    } catch (err) {
        console.error(`[ERREUR Serveur] Erreur de sauvegarde de la config de roster pour ${dateKey}:`, err);
        res.status(500).json({ message: 'Server error saving roster config.' });
    }
});

// --- Routes de la feuille de garde (Daily Roster - agents réellement d'astreinte) ---
// Gère la liste des agents désignés pour l'astreinte du jour.

app.get('/api/daily-roster/:dateKey', authenticateToken, async (req, res) => { // Pas forcément admin-only
    const dateKey = req.params.dateKey;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
        console.error(`[ERREUR Serveur] Format de date invalide pour daily-roster: ${dateKey}`);
        return res.status(400).json({ message: 'Invalid date format. ExpectedYYYY-MM-DD.' });
    }
    const filePath = path.join(DAILY_ROSTER_DIR, `${dateKey}.json`);
    try {
        const data = await fs.readFile(filePath, 'utf8');
        console.log(`[INFO Serveur] Daily roster found for ${dateKey}.`);
        res.json(JSON.parse(data));
    } catch (err) {
        if (err.code === 'ENOENT') {
            console.log(`[INFO Serveur] Daily roster file not found for ${dateKey}. Sending 200 OK with empty object.`);
            return res.status(200).json({});
        }
        console.error(`[ERREUR Serveur] Erreur inattendue de lecture du daily roster pour ${dateKey}:`, err);
        res.status(500).json({ message: 'Server error reading daily roster.' });
    }
});

app.post('/api/daily-roster/:dateKey', authenticateToken, authorizeAdmin, async (req, res) => {
    const dateKey = req.params.dateKey;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
        return res.status(400).json({ message: 'Invalid date format. ExpectedYYYY-MM-DD.' });
    }
    const { onDutyAgents } = req.body; // Liste des IDs des agents d'astreinte
    if (!Array.isArray(onDutyAgents)) { // Assurez-vous que c'est un tableau
        return res.status(400).json({ message: 'Missing or invalid onDutyAgents data. Expected an array.' });
    }
    const filePath = path.join(DAILY_ROSTER_DIR, `${dateKey}.json`);
    try {
        // >>> IMPORTANT : Remplacez la liste existante par la nouvelle liste fournie.
        // Assurez-vous que l'objet complet sauvegardé est { onDutyAgents: [...] }
        await fs.writeFile(filePath, JSON.stringify({ onDutyAgents }, null, 2), 'utf8');
        console.log(`[INFO Serveur] Daily roster saved for ${dateKey}.`);
        res.json({ message: 'Daily roster saved.' });
    } catch (err) {
        console.error(`[ERREUR Serveur] Erreur de sauvegarde du daily roster pour ${dateKey}:`, err);
        res.status(500).json({ message: 'Server error saving daily roster.' });
    }
});

// NOUVELLE ROUTE : Obtenir les disponibilités des agents et les agents d'astreinte pour une date
// C'est l'endpoint que le frontend '/admin.js' ou 'feuille_de_garde.js' appelle.
app.get('/api/agent-availability/:date', authenticateToken, async (req, res) => {
    const dateKey = req.params.date; // Date au formatYYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
        return res.status(400).json({ message: 'Format de date invalide. AttenduYYYY-MM-DD.' });
    }

    let onCallAgentIdsFromBackend = []; // IDs des agents d'astreinte tels que lus du backend

    try {
        // 1. Récupérer les agents d'astreinte pour cette date depuis daily_roster
        const dailyRosterFilePath = path.join(DAILY_ROSTER_DIR, `${dateKey}.json`);
        try {
            const dailyRosterData = await fs.readFile(dailyRosterFilePath, 'utf8');
            const dailyRoster = JSON.parse(dailyRosterData);
            if (dailyRoster && Array.isArray(dailyRoster.onDutyAgents)) {
                onCallAgentIdsFromBackend = dailyRoster.onDutyAgents.filter(id => id !== 'none');
            }
        } catch (err) {
            if (err.code === 'ENOENT') {
                console.log(`[INFO Serveur] Daily roster file not found for ${dateKey}. No agents on call.`);
            } else {
                console.error(`[ERREUR Serveur] Erreur de lecture du daily roster pour ${dateKey}:`, err);
            }
        }

        // 2. Récupérer les disponibilités détaillées pour tous les agents pour cette date
        const allUsersIds = Object.keys(USERS);
        const agentAvailabilitiesMap = {}; // { agentId: [{ start: index, end: index }] }

        for (const userId of allUsersIds) {
            const user = USERS[userId];
            if (user && (user.role === 'agent' || user.role === 'admin')) { // Inclure les admins si nécessaire
                const agentAvailabilityFilePath = path.join(AGENT_AVAILABILITY_DIR, dateKey, `${userId}.json`);
                try {
                    const agentAvailabilityData = await fs.readFile(agentAvailabilityFilePath, 'utf8');
                    agentAvailabilitiesMap[userId] = JSON.parse(agentAvailabilityData);
                } catch (err) {
                    if (err.code === 'ENOENT') {
                        agentAvailabilitiesMap[userId] = []; // Aucun fichier = aucune dispo pour ce jour
                    } else {
                        console.error(`[ERREUR Serveur] Erreur de lecture du fichier de dispo de l'agent ${userId} pour ${dateKey}:`, err);
                    }
                }
            }
        }
        
        // Construire la liste de TOUS les agents avec leurs détails de disponibilité et qualifications
        const allAgentsWithDetails = allUsersIds.filter(id => USERS[id] && (USERS[id].role === 'agent' || USERS[id].role === 'admin'))
            .map(id => {
                const user = USERS[id];
                return {
                    id: id,
                    username: `${user.prenom} ${user.nom}`, // Concatène prénom et nom pour l'affichage
                    qualifications: user.qualifications || [], // ** Assurez-vous que cette ligne est là **
                    availabilities: agentAvailabilitiesMap[id] || []
                };
            });

        // Filtrer les "disponibles" : ceux qui ont des disponibilités ET qui NE SONT PAS d'astreinte
        const finalAvailable = allAgentsWithDetails.filter(agent => {
            return agent.availabilities.length > 0 && !onCallAgentIdsFromBackend.includes(agent.id);
        });

        // Filtrer les "d'astreinte" : ceux dont l'ID est dans onCallAgentIdsFromBackend
        // Et s'assurer que leurs qualifications sont bien incluses
        const finalOnCall = allAgentsWithDetails.filter(agent =>
            onCallAgentIdsFromBackend.includes(agent.id)
        ).map(agent => ({
            id: agent.id,
            username: agent.username,
            qualifications: agent.qualifications // Les qualifications sont déjà dans allAgentsWithDetails
        }));

        res.json({ available: finalAvailable, onCall: finalOnCall });

    } catch (err) {
        console.error(`[ERREUR Serveur] Erreur lors de la récupération des disponibilités et astreintes pour ${dateKey}:`, err);
        res.status(500).json({ message: 'Erreur serveur lors de la récupération des données de feuille de garde.' });
    }
});


// Route pour sauvegarder le planning d'un agent spécifique pour UNE DATE
// C'est l'endpoint que la page de planning individuelle appelle
app.post('/api/agent-availability/:dateKey/:agentId', authenticateToken, async (req, res) => {
    const dateKey = req.params.dateKey; //YYYY-MM-DD
    const agentId = req.params.agentId.toLowerCase();
    const availabilities = req.body; // C'est un tableau d'objets {start, end}

    if (!Array.isArray(availabilities)) {
        console.error(`[ERREUR Serveur] Les disponibilités doivent être un tableau. Reçu type: ${typeof availabilities}, contenu:`, availabilities);
        return res.status(400).json({ message: 'Les disponibilités doivent être un tableau.' });
    }
    // Vérifier que l'utilisateur authentifié est l'agent concerné OU un admin
    if (req.user.id !== agentId && req.user.role !== 'admin') {
        console.warn(`[AUTH] Tentative de modification des dispo de ${agentId} par ${req.user.id} (rôle: ${req.user.role}). Accès refusé.`);
        return res.status(403).json({ message: 'Accès refusé. Vous ne pouvez modifier que vos propres disponibilités.' });
    }

    const dirPath = path.join(AGENT_AVAILABILITY_DIR, dateKey);
    const filePath = path.join(dirPath, `${agentId}.json`);

    try {
        await fs.mkdir(dirPath, { recursive: true }); // Crée le dossier de date si n'existe pas
        await fs.writeFile(filePath, JSON.stringify(availabilities, null, 2), 'utf8');
        console.log(`[INFO Serveur] Disponibilités de l'agent ${agentId} enregistrées pour la date ${dateKey}.`);
        res.status(200).json({ message: 'Disponibilités enregistrées avec succès.' });
    } catch (err) {
        console.error(`[ERREUR Serveur] Erreur lors de l'écriture du fichier de disponibilité pour ${agentId} sur ${dateKey}:`, err);
        res.status(500).json({ message: 'Erreur serveur lors de l\'enregistrement des disponibilités.' });
    }
});

// Route pour obtenir le planning d'un agent spécifique (STRUCTURÉ PAR SEMAINE/JOUR)
// Principalement pour l'affichage du planning individuel
async function loadAgentPlanningFromFiles(agentId) {
    const agentPlanning = {}; // { week-X: { day: [slots] } }
    const daysOfWeek = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

    try {
        const dateFolders = await fs.readdir(AGENT_AVAILABILITY_DIR); // Liste tous les dossiers de dates
        for (const dateFolder of dateFolders) {
            const datePath = path.join(AGENT_AVAILABILITY_DIR, dateFolder);
            const stats = await fs.stat(datePath);

            if (stats.isDirectory()) {
                const filePath = path.join(datePath, `${agentId}.json`);
                try {
                    const data = await fs.readFile(filePath, 'utf8');
                    const availabilitiesForDate = JSON.parse(data); // Tableau d'objets {start, end}

                    const dateParts = dateFolder.split('-');
                    if (dateParts.length === 3) {
                        const year = parseInt(dateParts[0]);
                        const month = parseInt(dateParts[1]) - 1; // Mois 0-indexé
                        const day = parseInt(dateParts[2]);
                        const dateObj = new Date(year, month, day);

                        const weekNum = getCurrentISOWeek(dateObj);
                        const dayIndex = dateObj.getDay(); // 0 pour Dimanche, 1 pour Lundi, etc.
                        const clientDayName = daysOfWeek[(dayIndex === 0 ? 6 : dayIndex - 1)]; // Convertit 0 (Dim) en 6 (Dim), 1 (Lun) en 0 (Lun)

                        const weekKey = `S ${weekNum}`; // Changed from 'week-X' to 'S X' to match frontend option textContent

                        if (!agentPlanning[weekKey]) {
                            agentPlanning[weekKey] = {
                                'lundi': [], 'mardi': [], 'mercredi': [],
                                'jeudi': [], 'vendredi': [], 'samedi': [], 'dimanche': []
                            }; // Initialiser tous les jours
                        }
                        
                        // Stocke les plages directement sous forme d'objets {start, end}
                        const existingSlots = agentPlanning[weekKey][clientDayName];
                        availabilitiesForDate.forEach(slot => {
                            // S'assurer que chaque slot est un objet {start, end} et n'est pas déjà présent pour éviter les doublons si appel multiple
                            if (typeof slot === 'object' && slot !== null &&
                                typeof slot.start === 'number' && typeof slot.start === 'number' && // Correction: doit être start et end pour les checks
                                !existingSlots.some(existingSlot => existingSlot.start === slot.start && existingSlot.end === slot.end)) {
                                existingSlots.push({ start: slot.start, end: slot.end });
                            }
                        });
                        existingSlots.sort((a,b) => a.start - b.start); // Trie les créneaux par index de début
                    }
                } catch (readErr) {
                    if (readErr.code === 'ENOENT') {
                        // Fichier non trouvé pour cet agent et cette date, ce n'est pas une erreur
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

app.get('/api/planning/:agentId', authenticateToken, async (req, res) => {
    const agentId = req.params.agentId.toLowerCase();
    // Vérifie que l'utilisateur authentifié est l'agent concerné OU un admin
    if (req.user.id !== agentId && req.user.role !== 'admin') {
        console.warn(`[AUTH] Accès planning de ${agentId} refusé pour ${req.user.id} (rôle: ${req.user.role}).`);
        return res.status(403).json({ message: 'Accès refusé. Vous ne pouvez voir que votre propre planning.' });
    }
    try {
        const planning = await loadAgentPlanningFromFiles(agentId);
        res.status(200).json(planning);
    } catch (err) {
        console.error(`[ERREUR Serveur] Erreur de récupération du planning de l'agent ${agentId}:`, err);
        res.status(500).json({ message: 'Erreur serveur lors de la récupération du planning.' });
    }
});


// Route pour obtenir tous les plannings (utilisé pour le planning global de l'admin)
app.get('/api/planning', authenticateToken, authorizeAdmin, async (req, res) => {
    try {
        const allAgentIds = Object.keys(USERS).filter(id => USERS[id].role === 'agent' || USERS[id].role === 'admin');
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

// Le serveur écoute sur le port défini
app.listen(port, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${port}`);
});