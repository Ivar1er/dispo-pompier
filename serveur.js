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
const allowedOrigins = [
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'https://dispo-pompier.onrender.com'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true
}));

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
const ROSTER_CONFIG_DIR        = path.join(PERSISTENT_DIR, 'roster_configs');
const DAILY_ROSTER_DIR         = path.join(PERSISTENT_DIR, 'daily_rosters');
const AGENT_AVAILABILITY_DIR   = path.join(PERSISTENT_DIR, 'agent_availabilities'); // Dossier pour les dispo individuelles

// Variables globales pour stocker les données en mémoire (chargées au démarrage)
let USERS = {};
let AVAILABLE_QUALIFICATIONS = [];
let AVAILABLE_GRADES = [];
let AVAILABLE_FUNCTIONS = []; // Maintenu pour compatibilité

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
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}` + `-${String(dt.getDate()).padStart(2, '0')}`;
}

/**
 * Calcule les dates de début et de fin d'une semaine ISO (YYYY-Wnn).
 * @param {string} isoWeekString - L'identifiant de la semaine ISO (ex: "2023-W25").
 * @returns {{startOfWeek: Date, endOfWeek: Date}} Les objets Date pour le début et la fin de la semaine.
 */
function getStartAndEndOfWeek(isoWeekString) {
    const [yearStr, weekStr] = isoWeekString.split('-W');
    const year = parseInt(yearStr);
    const weekNum = parseInt(weekStr);

    // Début de l'année
    const jan1 = new Date(year, 0, 1);
    // Jour de la semaine du 1er janvier (0 = dimanche, 1 = lundi, etc.)
    const dayOfWeekJan1 = jan1.getDay(); // 0 for Sunday, 1 for Monday...

    // Date du premier lundi de l'année
    let firstMonday = new Date(jan1);
    if (dayOfWeekJan1 <= 4) { // Si Jan 1 est Lun, Mar, Mer, Jeu
        firstMonday.setDate(jan1.getDate() - dayOfWeekJan1 + 1);
    } else { // Si Jan 1 est Ven, Sam, Dim
        firstMonday.setDate(jan1.getDate() + (8 - dayOfWeekJan1));
    }
    // Si le 1er jeudi de l'année est après le 4 janvier, alors la semaine 1 commence plus tard.
    // L'ISO week 1 est la première semaine avec 4 jours ou plus dans la nouvelle année.
    // C'est équivalent au premier jeudi de l'année.
    const day = firstMonday.getDay();
    const diff = firstMonday.getDate() - day + (day === 0 ? -6 : 1); // adjust to Monday in week 1
    firstMonday = new Date(firstMonday.setDate(diff));

    // Calcul de la date de début de la semaine spécifiée
    const startOfWeek = new Date(firstMonday);
    startOfWeek.setDate(firstMonday.getDate() + (weekNum - 1) * 7);
    startOfWeek.setHours(0, 0, 0, 0);

    // Calcul de la date de fin de la semaine spécifiée (Dimanche)
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    return { startOfWeek, endOfWeek };
}


// --- Fonctions de chargement et de sauvegarde des données ---

async function loadData(filePath, defaultData = {}) {
    try {
        await fs.access(filePath); // Vérifie si le fichier existe
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            // Fichier non trouvé, créer le répertoire si nécessaire et le fichier avec les données par défaut
            await fs.mkdir(path.dirname(filePath), { recursive: true });
            await fs.writeFile(filePath, JSON.stringify(defaultData, null, 2), 'utf8');
            console.log(`Fichier créé : ${filePath}`);
            return defaultData;
        }
        console.error(`Erreur de lecture du fichier ${filePath}:`, error);
        throw error;
    }
}

async function saveData(filePath, data) {
    try {
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
        console.error(`Erreur d'écriture du fichier ${filePath}:`, error);
        throw error;
    }
}

async function loadAgentPlanningFromFiles(agentId) {
    const filePath = path.join(AGENT_AVAILABILITY_DIR, `planning-${agentId}.json`);
    return await loadData(filePath, {});
}

async function saveAgentPlanningToFile(agentId, planningData) {
    const filePath = path.join(AGENT_AVAILABILITY_DIR, `planning-${agentId}.json`);
    await saveData(filePath, planningData);
}

// Nouvelles fonctions pour sauvegarder les utilisateurs, qualifications et grades
async function saveUsersToFile() {
    await saveData(USERS_FILE_PATH, USERS);
}

async function saveQualificationsToFile() {
    await saveData(QUALIFICATIONS_FILE_PATH, AVAILABLE_QUALIFICATIONS);
}

async function saveGradesToFile() {
    await saveData(GRADES_FILE_PATH, AVAILABLE_GRADES);
}


// --- Initialisation de l'application ---
async function initializeApp() {
    try {
        USERS = await loadData(USERS_FILE_PATH, {});
        // Si aucun utilisateur n'existe, créer un administrateur par défaut
        if (Object.keys(USERS).length === 0) {
            console.log("Aucun utilisateur trouvé. Création d'un administrateur par défaut.");
            const adminId = 'admin';
            const hashedPassword = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10);
            USERS[adminId] = {
                id: adminId,
                username: adminId,
                password: hashedPassword,
                role: 'admin',
                firstName: 'Admin',
                lastName: 'Générique',
                qualifications: [], // L'admin n'a pas forcément de qualifications
                grades: []
            };
            await saveUsersToFile();
        }

        AVAILABLE_QUALIFICATIONS = await loadData(QUALIFICATIONS_FILE_PATH, []);
        AVAILABLE_GRADES = await loadData(GRADES_FILE_PATH, []);
        AVAILABLE_FUNCTIONS = await loadData(FUNCTIONS_FILE_PATH, []); // Si tu utilises des fonctions

        // Créer les répertoires si ils n'existent pas
        await fs.mkdir(AGENT_AVAILABILITY_DIR, { recursive: true });
        await fs.mkdir(ROSTER_CONFIG_DIR, { recursive: true });
        await fs.mkdir(DAILY_ROSTER_DIR, { recursive: true });


        console.log('Données chargées et répertoires vérifiés.');
    } catch (error) {
        console.error('Erreur lors de l\'initialisation de l\'application:', error);
        process.exit(1); // Arrête l'application si l'initialisation échoue
    }
}


// --- Middlewares d'authentification et d'autorisation ---

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        console.warn("[AUTH] Accès refusé: Aucun token fourni.");
        return res.status(401).json({ message: 'Accès refusé. Aucun token fourni.' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.warn("[AUTH] Token invalide ou expiré:", err.message);
            return res.status(403).json({ message: 'Token invalide ou expiré.' });
        }
        req.user = user;
        next();
    });
};

const authorizeAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        console.warn(`[AUTH] Accès admin refusé pour l'utilisateur ${req.user ? req.user.id : 'inconnu'} (rôle: ${req.user ? req.user.role : 'non défini'}).`);
        res.status(403).json({ message: 'Accès refusé. Nécessite un rôle administrateur.' });
    }
};


// --- Routes d'API ---

// Route de connexion
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    console.log(`Tentative de connexion pour l'utilisateur: ${username}`);

    const user = USERS[username];
    if (!user) {
        console.log(`Échec connexion: Utilisateur ${username} non trouvé.`);
        return res.status(400).json({ message: 'Identifiant ou mot de passe incorrect.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        console.log(`Échec connexion: Mot de passe incorrect pour ${username}.`);
        return res.status(400).json({ message: 'Identifiant ou mot de passe incorrect.' });
    }

    const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role, firstName: user.firstName, lastName: user.lastName },
        JWT_SECRET,
        { expiresIn: '8h' } // Token valide 8 heures
    );
    console.log(`Connexion réussie pour ${username}. Rôle: ${user.role}`);
    res.json({ token, role: user.role, agentId: user.id, prenom: user.firstName, nom: user.lastName });
});


// Route pour obtenir les informations de l'agent connecté
app.get('/api/agent-info', authenticateToken, (req, res) => {
    const agentId = req.user.id;
    const agentInfo = USERS[agentId];
    if (agentInfo) {
        // Ne renvoyez pas le mot de passe haché !
        const { password, ...safeInfo } = agentInfo;
        res.json(safeInfo);
    } else {
        res.status(404).json({ message: 'Informations de l\'agent non trouvées.' });
    }
});


// Route pour obtenir les noms et qualifications de tous les utilisateurs (pour select ou feuille de garde)
app.get('/api/users/names', authenticateToken, async (req, res) => {
    try {
        const usersInfo = Object.values(USERS).map(user => ({
            id: user.id,
            prenom: user.firstName,
            nom: user.lastName,
            role: user.role,
            qualifications: user.qualifications || [],
            grades: user.grades || []
        }));
        res.json(usersInfo);
    } catch (error) {
        console.error("Erreur lors de la récupération des noms d'utilisateurs :", error);
        res.status(500).json({ message: "Erreur serveur lors de la récupération des noms d'utilisateurs." });
    }
});


// Route pour enregistrer ou mettre à jour les créneaux de disponibilité d'un agent
app.post('/api/agent-availability', authenticateToken, async (req, res) => {
    const { agentId, week, selections } = req.body; // selections = { dateKey: { dayIndex, creneaux, plages } }

    // L'agent ne peut modifier que son propre planning, l'admin peut modifier n'importe qui
    if (req.user.id !== agentId && req.user.role !== 'admin') {
        console.warn(`[AUTH] Tentative de modification planning de ${agentId} refusée pour ${req.user.id} (rôle: ${req.user.role}).`);
        return res.status(403).json({ message: 'Accès refusé. Vous ne pouvez modifier que votre propre planning.' });
    }

    try {
        const agentPlanning = await loadAgentPlanningFromFiles(agentId);

        if (!agentPlanning[week]) {
            agentPlanning[week] = {};
        }

        for (const dateKey in selections) {
            agentPlanning[week][dateKey] = selections[dateKey];
        }

        await saveAgentPlanningToFile(agentId, agentPlanning);
        console.log(`Disponibilités de l'agent ${agentId} pour la semaine ${week} sauvegardées.`);
        res.status(200).json({ message: 'Disponibilités enregistrées avec succès.' });
    } catch (err) {
        console.error(`[ERREUR Serveur] Erreur de sauvegarde des disponibilités de l'agent ${agentId}:`, err);
        res.status(500).json({ message: 'Erreur serveur lors de la sauvegarde des disponibilités.' });
    }
});


// Route pour récupérer le planning d'un agent spécifique
app.get('/api/agent-planning/:agentId', authenticateToken, async (req, res) => {
    const agentId = req.params.agentId;
    // Un agent peut voir son propre planning OU un admin
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


// Route pour obtenir tous les plannings (utilisé pour le planning global de l'admin et feuille de garde)
app.get('/api/planning', authenticateToken, authorizeAdmin, async (req, res) => {
    try {
        // On récupère tous les IDs des agents (et admins, s'ils ont des plannings)
        const allAgentIds = Object.keys(USERS).filter(id => USERS[id].role === 'agent' || USERS[id].role === 'admin');
        const allPlannings = {};
        for (const agentId of allAgentIds) {
            allPlannings[agentId] = await loadAgentPlanningFromFiles(agentId);
        }
        res.json(allPlannings);
    } catch (err) {
        console.error(`[ERREUR Serveur] Erreur de récupération de tous les plannings (admin):`, err);
        res.status(500).json({ message: 'Erreur serveur lors de la récupération de tous les plannings.' });
    }
});


// --- Routes de gestion par l'administrateur ---

// AGENTS / UTILISATEURS
app.get('/api/admin/users', authenticateToken, authorizeAdmin, (req, res) => {
    const usersList = Object.values(USERS).map(({ password, ...rest }) => rest); // Exclure les mots de passe
    res.json(usersList);
});

app.post('/api/admin/users', authenticateToken, authorizeAdmin, async (req, res) => {
    const { id, firstName, lastName, password, role, qualifications, grades } = req.body;
    if (!id || !password || !firstName || !lastName) {
        return res.status(400).json({ message: 'ID, prénom, nom et mot de passe sont requis.' });
    }
    if (USERS[id]) {
        return res.status(409).json({ message: 'Cet identifiant existe déjà.' });
    }
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        USERS[id] = {
            id,
            username: id, // Le username est le même que l'ID pour la connexion
            password: hashedPassword,
            firstName,
            lastName,
            role: role || 'agent', // Par défaut 'agent'
            qualifications: qualifications || [],
            grades: grades || []
        };
        await saveUsersToFile();
        const { password: _, ...newUser } = USERS[id]; // Exclure le mot de passe pour la réponse
        res.status(201).json({ message: 'Agent ajouté avec succès.', user: newUser });
    } catch (error) {
        console.error('Erreur lors de l\'ajout de l\'agent :', error);
        res.status(500).json({ message: 'Erreur serveur lors de l\'ajout de l\'agent.' });
    }
});

app.put('/api/admin/users/:id', authenticateToken, authorizeAdmin, async (req, res) => {
    const userId = req.params.id;
    const { firstName, lastName, password, role, qualifications, grades } = req.body;
    if (!USERS[userId]) {
        return res.status(404).json({ message: 'Agent non trouvé.' });
    }
    try {
        if (firstName) USERS[userId].firstName = firstName;
        if (lastName) USERS[userId].lastName = lastName;
        if (password) {
            USERS[userId].password = await bcrypt.hash(password, 10);
        }
        if (role) USERS[userId].role = role;
        // Mettre à jour les qualifications et les grades
        USERS[userId].qualifications = qualifications || [];
        USERS[userId].grades = grades || [];

        await saveUsersToFile();
        const { password: _, ...updatedUser } = USERS[userId];
        res.status(200).json({ message: 'Agent mis à jour avec succès.', user: updatedUser });
    } catch (error) {
        console.error('Erreur lors de la mise à jour de l\'agent :', error);
        res.status(500).json({ message: 'Erreur serveur lors de la mise à jour de l\'agent.' });
    }
});

app.delete('/api/admin/users/:id', authenticateToken, authorizeAdmin, async (req, res) => {
    const userId = req.params.id;
    if (!USERS[userId]) {
        return res.status(404).json({ message: 'Agent non trouvé.' });
    }
    // Empêcher la suppression du dernier admin
    const adminCount = Object.values(USERS).filter(u => u.role === 'admin').length;
    if (USERS[userId].role === 'admin' && adminCount <= 1) {
        return res.status(400).json({ message: 'Impossible de supprimer le dernier administrateur.' });
    }

    try {
        delete USERS[userId];
        await saveUsersToFile();
        // Optionnel: Supprimer aussi le fichier de planning de l'agent
        const planningFilePath = path.join(AGENT_AVAILABILITY_DIR, `planning-${userId}.json`);
        try {
            await fs.unlink(planningFilePath);
            console.log(`Fichier de planning de l'agent ${userId} supprimé.`);
        } catch (unlinkErr) {
            if (unlinkErr.code !== 'ENOENT') { // Ignorer si le fichier n'existe pas
                console.warn(`Impossible de supprimer le fichier de planning de l'agent ${userId}:`, unlinkErr);
            }
        }

        res.status(200).json({ message: 'Agent supprimé avec succès.' });
    } catch (error) {
        console.error('Erreur lors de la suppression de l\'agent :', error);
        res.status(500).json({ message: 'Erreur serveur lors de la suppression de l\'agent.' });
    }
});


// QUALIFICATIONS
app.get('/api/users/qualifications', authenticateToken, (req, res) => {
    res.json(AVAILABLE_QUALIFICATIONS);
});

app.post('/api/admin/qualifications', authenticateToken, authorizeAdmin, async (req, res) => {
    const { id, name } = req.body;
    if (!id || !name) {
        return res.status(400).json({ message: 'ID et nom de qualification sont requis.' });
    }
    if (AVAILABLE_QUALIFICATIONS.some(q => q.id === id)) {
        return res.status(409).json({ message: 'Une qualification avec cet ID existe déjà.' });
    }
    const newQual = { id, name };
    AVAILABLE_QUALIFICATIONS.push(newQual);
    try {
        await saveQualificationsToFile();
        res.status(201).json({ message: 'Qualification ajoutée avec succès.', qualification: newQual });
    } catch (error) {
        console.error('Erreur lors de l\'ajout de la qualification :', error);
        res.status(500).json({ message: 'Erreur serveur lors de l\'ajout de la qualification.' });
    }
});

app.put('/api/admin/qualifications/:id', authenticateToken, authorizeAdmin, async (req, res) => {
    const qualId = req.params.id;
    const { name } = req.body;
    const qualIndex = AVAILABLE_QUALIFICATIONS.findIndex(q => q.id === qualId);
    if (qualIndex === -1) {
        return res.status(404).json({ message: 'Qualification non trouvée.' });
    }
    if (!name) {
        return res.status(400).json({ message: 'Le nom de la qualification est requis.' });
    }
    AVAILABLE_QUALIFICATIONS[qualIndex].name = name;
    try {
        await saveQualificationsToFile();
        res.status(200).json({ message: 'Qualification mise à jour avec succès.', qualification: AVAILABLE_QUALIFICATIONS[qualIndex] });
    } catch (error) {
        console.error('Erreur lors de la mise à jour de la qualification :', error);
        res.status(500).json({ message: 'Erreur serveur lors de la mise à jour de la qualification.' });
    }
});

app.delete('/api/admin/qualifications/:id', authenticateToken, authorizeAdmin, async (req, res) => {
    const qualId = req.params.id;
    const initialLength = AVAILABLE_QUALIFICATIONS.length;
    AVAILABLE_QUALIFICATIONS = AVAILABLE_QUALIFICATIONS.filter(q => q.id !== qualId);
    if (AVAILABLE_QUALIFICATIONS.length === initialLength) {
        return res.status(404).json({ message: 'Qualification non trouvée.' });
    }
    try {
        await saveQualificationsToFile();
        // OPTIONNEL: Mettre à jour tous les utilisateurs qui pourraient avoir cette qualification
        // Pour l'instant, on laisse la qualification si l'utilisateur l'avait.
        // Une logique plus robuste consisterait à parcourir USERS et la supprimer de 'qualifications' de chaque utilisateur.
        for (const userId in USERS) {
            USERS[userId].qualifications = USERS[userId].qualifications.filter(q => q !== qualId);
        }
        await saveUsersToFile(); // Sauvegarder les utilisateurs après nettoyage
        res.status(200).json({ message: 'Qualification supprimée avec succès.' });
    } catch (error) {
        console.error('Erreur lors de la suppression de la qualification :', error);
        res.status(500).json({ message: 'Erreur serveur lors de la suppression de la qualification.' });
    }
});


// GRADES
app.get('/api/users/grades', authenticateToken, (req, res) => {
    res.json(AVAILABLE_GRADES);
});

app.post('/api/admin/grades', authenticateToken, authorizeAdmin, async (req, res) => {
    const { id, name } = req.body;
    if (!id || !name) {
        return res.status(400).json({ message: 'ID et nom de grade sont requis.' });
    }
    if (AVAILABLE_GRADES.some(g => g.id === id)) {
        return res.status(409).json({ message: 'Un grade avec cet ID existe déjà.' });
    }
    const newGrade = { id, name };
    AVAILABLE_GRADES.push(newGrade);
    try {
        await saveGradesToFile();
        res.status(201).json({ message: 'Grade ajouté avec succès.', grade: newGrade });
    } catch (error) {
        console.error('Erreur lors de l\'ajout du grade :', error);
        res.status(500).json({ message: 'Erreur serveur lors de l\'ajout du grade.' });
    }
});

app.put('/api/admin/grades/:id', authenticateToken, authorizeAdmin, async (req, res) => {
    const gradeId = req.params.id;
    const { name } = req.body;
    const gradeIndex = AVAILABLE_GRADES.findIndex(g => g.id === gradeId);
    if (gradeIndex === -1) {
        return res.status(404).json({ message: 'Grade non trouvé.' });
    }
    if (!name) {
        return res.status(400).json({ message: 'Le nom du grade est requis.' });
    }
    AVAILABLE_GRADES[gradeIndex].name = name;
    try {
        await saveGradesToFile();
        res.status(200).json({ message: 'Grade mis à jour avec succès.', grade: AVAILABLE_GRADES[gradeIndex] });
    } catch (error) {
        console.error('Erreur lors de la mise à jour du grade :', error);
        res.status(500).json({ message: 'Erreur serveur lors de la mise à jour du grade.' });
    }
});

app.delete('/api/admin/grades/:id', authenticateToken, authorizeAdmin, async (req, res) => {
    const gradeId = req.params.id;
    const initialLength = AVAILABLE_GRADES.length;
    AVAILABLE_GRADES = AVAILABLE_GRADES.filter(g => g.id !== gradeId);
    if (AVAILABLE_GRADES.length === initialLength) {
        return res.status(404).json({ message: 'Grade non trouvé.' });
    }
    try {
        await saveGradesToFile();
        // OPTIONNEL: Mettre à jour tous les utilisateurs qui pourraient avoir ce grade
        for (const userId in USERS) {
            USERS[userId].grades = USERS[userId].grades.filter(g => g !== gradeId);
        }
        await saveUsersToFile(); // Sauvegarder les utilisateurs après nettoyage
        res.status(200).json({ message: 'Grade supprimé avec succès.' });
    } catch (error) {
        console.error('Erreur lors de la suppression du grade :', error);
        res.status(500).json({ message: 'Erreur serveur lors de la suppression du grade.' });
    }
});


// Démarrer le serveur après avoir chargé les données
initializeApp().then(() => {
    app.listen(port, () => {
        console.log(`Serveur démarré sur http://localhost:${port}`);
    });
});