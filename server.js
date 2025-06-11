const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcryptjs'); // Importation de bcryptjs
const jwt = require('jsonwebtoken'); // Importation de jsonwebtoken

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
// Pour le développement local, vous pouvez utiliser :
// const PERSISTENT_DIR = process.env.NODE_ENV === 'production' ? '/mnt/storage' : path.join(__dirname, 'data');

const DATA_DIR = path.join(PERSISTENT_DIR, 'plannings');
const USERS_FILE_PATH = path.join(PERSISTENT_DIR, 'users.json');
const QUALIFICATIONS_FILE_PATH = path.join(PERSISTENT_DIR, 'qualifications.json'); // Maintenu pour la structure du fichier, même si non utilisé par le frontend
const GRADES_FILE_PATH = path.join(PERSISTENT_DIR, 'grades.json'); // Nouveau chemin pour les grades
const FONCTIONS_FILE_PATH = path.join(PERSISTENT_DIR, 'fonctions.json'); // Chemin mis à jour pour les fonctions

// Nouveaux chemins pour la persistance de la feuille de garde
const ROSTER_CONFIG_FILE_PATH = path.join(PERSISTENT_DIR, 'rosterConfig.json');
const DAILY_ROSTER_DIR = path.join(PERSISTENT_DIR, 'dailyRosters');

// Variables globales pour stocker les données en mémoire (sera synchronisé avec les fichiers)
let users = [];
let qualifications = []; // Maintenu pour la structure du fichier, même si non utilisé par le frontend
let grades = [];
let fonctions = [];
let rosterConfig = {}; // Configuration de la feuille de garde
let dailyRosters = {}; // Données de la feuille de garde journalière

// --- Fonctions utilitaires de gestion de fichiers ---

async function loadUsers() {
    try {
        const data = await fs.readFile(USERS_FILE_PATH, 'utf8');
        users = JSON.parse(data);
        console.log('Utilisateurs chargés.');
    } catch (error) {
        if (error.code === 'ENOENT') {
            users = [];
            await saveUsers();
            console.log('Fichier utilisateurs non trouvé, un nouveau a été créé.');
        } else {
            console.error('Erreur lors du chargement des utilisateurs:', error);
        }
    }
}

async function saveUsers() {
    await fs.writeFile(USERS_FILE_PATH, JSON.stringify(users, null, 2), 'utf8');
    console.log('Utilisateurs sauvegardés.');
}

async function loadQualifications() {
    try {
        const data = await fs.readFile(QUALIFICATIONS_FILE_PATH, 'utf8');
        qualifications = JSON.parse(data);
        console.log('Qualifications chargées.');
    } catch (error) {
        if (error.code === 'ENOENT') {
            qualifications = []; // Initialise vide si le fichier n'existe pas
            await saveQualifications();
            console.log('Fichier qualifications non trouvé, un nouveau a été créé.');
        } else {
            console.error('Erreur lors du chargement des qualifications:', error);
        }
    }
}

async function saveQualifications() {
    await fs.writeFile(QUALIFICATIONS_FILE_PATH, JSON.stringify(qualifications, null, 2), 'utf8');
    console.log('Qualifications sauvegardées.');
}

async function loadGrades() {
    try {
        const data = await fs.readFile(GRADES_FILE_PATH, 'utf8');
        grades = JSON.parse(data);
        // Assurez-vous que 'order' existe pour chaque grade
        grades = grades.map(g => ({ ...g, order: g.order !== undefined ? g.order : 0 }));
        grades.sort((a, b) => a.order - b.order); // Trier par ordre par défaut
        console.log('Grades chargés.');
    } catch (error) {
        if (error.code === 'ENOENT') {
            grades = []; // Initialise vide si le fichier n'existe pas
            await saveGrades();
            console.log('Fichier grades non trouvé, un nouveau a été créé.');
        } else {
            console.error('Erreur lors du chargement des grades:', error);
        }
    }
}

async function saveGrades() {
    await fs.writeFile(GRADES_FILE_PATH, JSON.stringify(grades, null, 2), 'utf8');
    console.log('Grades sauvegardés.');
}

async function loadFonctions() {
    try {
        const data = await fs.readFile(FONCTIONS_FILE_PATH, 'utf8');
        fonctions = JSON.parse(data);
        fonctions = fonctions.map(f => ({ ...f, order: f.order !== undefined ? f.order : 0 }));
        fonctions.sort((a, b) => a.order - b.order); // Trier par ordre par défaut
        console.log('Fonctions chargées.');
    } catch (error) {
        if (error.code === 'ENOENT') {
            fonctions = []; // Initialise vide si le fichier n'existe pas
            await saveFonctions();
            console.log('Fichier fonctions non trouvé, un nouveau a été créé.');
        } else {
            console.error('Erreur lors du chargement des fonctions:', error);
        }
    }
}

async function saveFonctions() {
    await fs.writeFile(FONCTIONS_FILE_PATH, JSON.stringify(fonctions, null, 2), 'utf8');
    console.log('Fonctions sauvegardées.');
}

async function loadRosterConfig() {
    try {
        const data = await fs.readFile(ROSTER_CONFIG_FILE_PATH, 'utf8');
        rosterConfig = JSON.parse(data);
        console.log('Configuration de la feuille de garde chargée.');
    } catch (error) {
        if (error.code === 'ENOENT') {
            rosterConfig = { defaultAgentCount: 10 }; // Valeur par défaut
            await saveRosterConfig();
            console.log('Fichier de configuration de la feuille de garde non trouvé, un nouveau a été créé.');
        } else {
            console.error('Erreur lors du chargement de la configuration de la feuille de garde:', error);
        }
    }
}

async function saveRosterConfig() {
    await fs.writeFile(ROSTER_CONFIG_FILE_PATH, JSON.stringify(rosterConfig, null, 2), 'utf8');
    console.log('Configuration de la feuille de garde sauvegardée.');
}

async function loadDailyRoster(dateKey) {
    const filePath = path.join(DAILY_ROSTER_DIR, `${dateKey}.json`);
    try {
        const data = await fs.readFile(filePath, 'utf8');
        dailyRosters[dateKey] = JSON.parse(data);
        console.log(`Feuille de garde pour ${dateKey} chargée.`);
    } catch (error) {
        if (error.code === 'ENOENT') {
            dailyRosters[dateKey] = { roster: {} }; // Initialise vide si le fichier n'existe pas
            await saveDailyRoster(dateKey);
            console.log(`Fichier de feuille de garde pour ${dateKey} non trouvé, un nouveau a été créé.`);
        } else {
            console.error(`Erreur lors du chargement de la feuille de garde pour ${dateKey}:`, error);
        }
    }
    return dailyRosters[dateKey];
}

async function saveDailyRoster(dateKey) {
    const filePath = path.join(DAILY_ROSTER_DIR, `${dateKey}.json`);
    await fs.writeFile(filePath, JSON.stringify(dailyRosters[dateKey], null, 2), 'utf8');
    console.log(`Feuille de garde pour ${dateKey} sauvegardée.`);
}


// --- Middleware d'authentification et d'autorisation ---

// Middleware de vérification de token JWT
function verifyToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.sendStatus(401); // Unauthorized

    const token = authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401); // No token provided

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            console.error("JWT Verification Error:", err);
            return res.sendStatus(403); // Forbidden (e.g., invalid token, expired)
        }
        req.user = user; // Add user payload to request
        next();
    });
}

// Middleware pour vérifier le rôle admin
function verifyAdminRole(req, res, next) {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.sendStatus(403); // Forbidden
    }
}

// Routes nécessitant une authentification (pour tous les utilisateurs connectés)
app.use(['/agents', '/grades', '/fonctions', '/planning', '/roster-config', '/daily-roster'], verifyToken);

// Routes nécessitant le rôle admin (en plus de l'authentification)
app.use(['/agents', '/grades', '/fonctions', '/roster-config'], verifyAdminRole);


// --- Routes d'authentification ---

app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    const user = users.find(u => u.username === username);

    if (user && await bcrypt.compare(password, user.passwordHash)) {
        // Le paramètre `expiresIn` est ajouté ici
        jwt.sign({ id: user.id, username: user.username, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' }, (err, token) => {
            if (err) {
                console.error('Erreur lors de la création du token JWT:', err);
                return res.status(500).json({ message: 'Erreur interne du serveur.' });
            }
            res.json({ token, role: user.role });
        });
    } else {
        res.status(401).json({ message: 'Nom d\'utilisateur ou mot de passe incorrect.' });
    }
});

// Route pour vérifier si l'utilisateur est admin
app.get('/check-admin', verifyToken, (req, res) => {
    if (req.user && req.user.role === 'admin') {
        res.json({ isAdmin: true });
    } else {
        res.json({ isAdmin: false });
    }
});

// --- Routes de gestion des agents ---

app.get('/agents', async (req, res) => {
    // Les grades, qualifications et fonctions sont déjà chargés en mémoire
    const agentsWithDetails = users.map(user => {
        const userGrades = (user.grades || []).map(gradeId => grades.find(g => g.id === gradeId)).filter(Boolean);
        const userFonctions = (user.fonctions || []).map(fonctionId => fonctions.find(f => f.id === fonctionId)).filter(Boolean);
        // Les qualifications sont retirées du frontend mais sont toujours dans la structure des utilisateurs
        // si vous ne les avez pas nettoyées manuellement dans users.json
        const userQualifications = (user.qualifications || []).map(qualId => qualifications.find(q => q.id === qualId)).filter(Boolean);

        return {
            id: user.id,
            username: user.username, // Ne pas envoyer le mot de passe hashé
            nom: user.nom,
            prenom: user.prenom,
            role: user.role,
            grades: userGrades.length > 0 ? userGrades.map(g => g.id) : [],
            fonctions: userFonctions.length > 0 ? userFonctions.map(f => f.id) : [],
            qualifications: userQualifications.length > 0 ? userQualifications.map(q => q.id) : [] // Garder pour la compatibilité backend si nécessaire
        };
    });
    res.json(agentsWithDetails);
});

app.post('/agents', async (req, res) => {
    const { id, nom, prenom, password, grades = [], fonctions = [] /*, qualifications = []*/ } = req.body; // Qualifications commentées ici aussi

    if (!id || !nom || !prenom || !password) {
        return res.status(400).json({ message: 'Tous les champs sont requis.' });
    }
    if (users.some(user => user.id === id || user.username === id)) { // Supposons que l'ID est aussi le nom d'utilisateur
        return res.status(409).json({ message: 'Un agent avec cet identifiant existe déjà.' });
    }

    try {
        const passwordHash = await bcrypt.hash(password, 10);
        const newAgent = {
            id,
            username: id, // L'identifiant est aussi le nom d'utilisateur pour la connexion
            nom,
            prenom,
            passwordHash,
            role: 'agent', // Rôle par défaut pour les nouveaux agents
            grades,
            fonctions,
            qualifications: [] // Qualifications explicitement vides
        };
        users.push(newAgent);
        await saveUsers();
        res.status(201).json({ message: 'Agent ajouté avec succès.' });
    } catch (error) {
        console.error('Erreur lors de l\'ajout de l\'agent:', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

app.put('/agents/:id', async (req, res) => {
    const agentId = req.params.id;
    const { nom, prenom, newPassword, grades = [], fonctions = [] /*, qualifications = []*/ } = req.body; // Qualifications commentées

    const agentIndex = users.findIndex(u => u.id === agentId);
    if (agentIndex === -1) {
        return res.status(404).json({ message: 'Agent non trouvé.' });
    }

    try {
        const agent = users[agentIndex];
        agent.nom = nom;
        agent.prenom = prenom;
        agent.grades = grades;
        agent.fonctions = fonctions;
        // agent.qualifications = qualifications; // Commenté ou retiré

        if (newPassword) {
            agent.passwordHash = await bcrypt.hash(newPassword, 10);
        }

        await saveUsers();
        res.json({ message: 'Agent mis à jour avec succès.' });
    } catch (error) {
        console.error('Erreur lors de la mise à jour de l\'agent:', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

app.delete('/agents/:id', async (req, res) => {
    const agentId = req.params.id;
    const initialLength = users.length;
    users = users.filter(user => user.id !== agentId);

    if (users.length === initialLength) {
        return res.status(404).json({ message: 'Agent non trouvé.' });
    }

    try {
        await saveUsers();
        res.json({ message: 'Agent supprimé avec succès.' });
    } catch (error) {
        console.error('Erreur lors de la suppression de l\'agent:', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

// --- Routes de gestion des qualifications (maintenues côté serveur pour la gestion des fichiers) ---
// Note: Le frontend n'interagit plus directement avec ces routes.
// Elles sont maintenues si vous avez besoin de manipuler les qualifications côté backend.

app.get('/qualifications', async (req, res) => {
    res.json(qualifications);
});

app.post('/qualifications', async (req, res) => {
    const { id, name } = req.body;
    if (!id || !name) {
        return res.status(400).json({ message: 'Identifiant et nom sont requis.' });
    }
    if (qualifications.some(q => q.id === id)) {
        return res.status(409).json({ message: 'Une qualification avec cet identifiant existe déjà.' });
    }
    const newQual = { id, name };
    qualifications.push(newQual);
    try {
        await saveQualifications();
        res.status(201).json({ message: 'Qualification ajoutée avec succès.', qualification: newQual });
    } catch (error) {
        console.error('Erreur lors de l\'ajout de la qualification:', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

app.put('/qualifications/:id', async (req, res) => {
    const qualId = req.params.id;
    const { name } = req.body;
    if (!name) {
        return res.status(400).json({ message: 'Le nom est requis.' });
    }
    const qualIndex = qualifications.findIndex(q => q.id === qualId);
    if (qualIndex === -1) {
        return res.status(404).json({ message: 'Qualification non trouvée.' });
    }
    qualifications[qualIndex].name = name;
    try {
        await saveQualifications();
        res.json({ message: 'Qualification mise à jour avec succès.', qualification: qualifications[qualIndex] });
    } catch (error) {
        console.error('Erreur lors de la mise à jour de la qualification:', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

app.delete('/qualifications/:id', async (req, res) => {
    const qualId = req.params.id;
    const initialLength = qualifications.length;
    qualifications = qualifications.filter(q => q.id !== qualId);
    if (qualifications.length === initialLength) {
        return res.status(404).json({ message: 'Qualification non trouvée.' });
    }
    // Optionnel: Supprimer cette qualification des agents qui la possèdent
    users.forEach(user => {
        if (user.qualifications) {
            user.qualifications = user.qualifications.filter(q => q !== qualId);
        }
    });
    try {
        await saveQualifications();
        await saveUsers(); // Sauvegarder les utilisateurs après modification des qualifications
        res.json({ message: 'Qualification supprimée avec succès.' });
    } catch (error) {
        console.error('Erreur lors de la suppression de la qualification:', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});


// --- Routes de gestion des grades ---

app.get('/grades', async (req, res) => {
    // Trier les grades par ordre avant de les envoyer
    res.json(grades.sort((a, b) => (a.order || 0) - (b.order || 0)));
});

app.post('/grades', async (req, res) => {
    const { id, name, order } = req.body; // 'order' est un nouvel attribut facultatif
    if (!id || !name) {
        return res.status(400).json({ message: 'Identifiant et nom sont requis.' });
    }
    if (grades.some(g => g.id === id)) {
        return res.status(409).json({ message: 'Un grade avec cet identifiant existe déjà.' });
    }
    const newGrade = { id, name, order: order !== undefined ? order : grades.length }; // Assigne un ordre par défaut
    grades.push(newGrade);
    grades.sort((a, b) => (a.order || 0) - (b.order || 0)); // Re-trier après ajout
    try {
        await saveGrades();
        res.status(201).json({ message: 'Grade ajouté avec succès.', grade: newGrade });
    } catch (error) {
        console.error('Erreur lors de l\'ajout du grade:', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

app.put('/grades/:id', async (req, res) => {
    const gradeId = req.params.id;
    const { name, order } = req.body;
    if (!name) {
        return res.status(400).json({ message: 'Le nom est requis.' });
    }
    const gradeIndex = grades.findIndex(g => g.id === gradeId);
    if (gradeIndex === -1) {
        return res.status(404).json({ message: 'Grade non trouvé.' });
    }
    grades[gradeIndex].name = name;
    if (order !== undefined) {
        grades[gradeIndex].order = order;
    }
    grades.sort((a, b) => (a.order || 0) - (b.order || 0)); // Re-trier après modification
    try {
        await saveGrades();
        res.json({ message: 'Grade mis à jour avec succès.', grade: grades[gradeIndex] });
    } catch (error) {
        console.error('Erreur lors de la mise à jour du grade:', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

app.delete('/grades/:id', async (req, res) => {
    const gradeId = req.params.id;
    const initialLength = grades.length;
    grades = grades.filter(g => g.id !== gradeId);
    if (grades.length === initialLength) {
        return res.status(404).json({ message: 'Grade non trouvé.' });
    }
    // Supprimer ce grade des agents qui le possèdent
    users.forEach(user => {
        if (user.grades) {
            user.grades = user.grades.filter(g => g !== gradeId);
        }
    });
    try {
        await saveGrades();
        await saveUsers(); // Sauvegarder les utilisateurs après modification des grades
        res.json({ message: 'Grade supprimé avec succès.' });
    } catch (error) {
        console.error('Erreur lors de la suppression du grade:', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

// --- Routes de gestion des fonctions ---

app.get('/fonctions', async (req, res) => {
    // Trier les fonctions par ordre avant de les envoyer
    res.json(fonctions.sort((a, b) => (a.order || 0) - (b.order || 0)));
});

app.post('/fonctions', async (req, res) => {
    const { id, name, order } = req.body; // 'order' est un nouvel attribut facultatif
    if (!id || !name) {
        return res.status(400).json({ message: 'Identifiant et nom sont requis.' });
    }
    if (fonctions.some(f => f.id === id)) {
        return res.status(409).json({ message: 'Une fonction avec cet identifiant existe déjà.' });
    }
    const newFonction = { id, name, order: order !== undefined ? order : fonctions.length }; // Assigne un ordre par défaut
    fonctions.push(newFonction);
    fonctions.sort((a, b) => (a.order || 0) - (b.order || 0)); // Re-trier après ajout
    try {
        await saveFonctions();
        res.status(201).json({ message: 'Fonction ajoutée avec succès.', fonction: newFonction });
    } catch (error) {
        console.error('Erreur lors de l\'ajout de la fonction:', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

app.put('/fonctions/:id', async (req, res) => {
    const fonctionId = req.params.id;
    const { name, order } = req.body;
    if (!name) {
        return res.status(400).json({ message: 'Le nom est requis.' });
    }
    const fonctionIndex = fonctions.findIndex(f => f.id === fonctionId);
    if (fonctionIndex === -1) {
        return res.status(404).json({ message: 'Fonction non trouvée.' });
    }
    fonctions[fonctionIndex].name = name;
    if (order !== undefined) {
        fonctions[fonctionIndex].order = order;
    }
    fonctions.sort((a, b) => (a.order || 0) - (b.order || 0)); // Re-trier après modification
    try {
        await saveFonctions();
        res.json({ message: 'Fonction mise à jour avec succès.', fonction: fonctions[fonctionIndex] });
    } catch (error) {
        console.error('Erreur lors de la mise à jour de la fonction:', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

app.delete('/fonctions/:id', async (req, res) => {
    const fonctionId = req.params.id;
    const initialLength = fonctions.length;
    fonctions = fonctions.filter(f => f.id !== fonctionId);
    if (fonctions.length === initialLength) {
        return res.status(404).json({ message: 'Fonction non trouvée.' });
    }
    // Supprimer cette fonction des agents qui la possèdent
    users.forEach(user => {
        if (user.fonctions) {
            user.fonctions = user.fonctions.filter(f => f !== fonctionId);
        }
    });
    try {
        await saveFonctions();
        await saveUsers(); // Sauvegarder les utilisateurs après modification des fonctions
        res.json({ message: 'Fonction supprimée avec succès.' });
    } catch (error) {
        console.error('Erreur lors de la suppression de la fonction:', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

// --- Routes de gestion du planning ---

// Fonction pour récupérer le planning d'une semaine spécifique
// Cette fonction lit les données d'un fichier pour une semaine et un jour donnés
async function getPlanningForWeek(week, year) {
    const weekData = {};
    const agentsDetails = {}; // Pour stocker nom, prénom, grades, etc.

    // Obtenir la liste de tous les agents pour leurs détails
    const allAgents = users.filter(user => user.role === 'agent' || user.role === 'admin');

    // Charger les détails des agents
    for (const agent of allAgents) {
        const userGrades = (agent.grades || []).map(gradeId => grades.find(g => g.id === gradeId)).filter(Boolean);
        const userFonctions = (agent.fonctions || []).map(fonctionId => fonctions.find(f => f.id === fonctionId)).filter(Boolean);
        // Les qualifications sont retirées du frontend
        // const userQualifications = (agent.qualifications || []).map(qualId => qualifications.find(q => q.id === qualId)).filter(Boolean);

        agentsDetails[agent.id] = {
            id: agent.id,
            nom: agent.nom,
            prenom: agent.prenom,
            grades: userGrades.map(g => g.id),
            fonctions: userFonctions.map(f => f.id),
            // qualifications: userQualifications.map(q => q.id) // Garder pour la compatibilité si besoin
        };
    }

    const days = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
    for (const day of days) {
        const filePath = path.join(DATA_DIR, `${year}-week-${week}-${day}.json`);
        try {
            const data = await fs.readFile(filePath, 'utf8');
            weekData[day] = JSON.parse(data);
        } catch (error) {
            if (error.code === 'ENOENT') {
                weekData[day] = {}; // Le fichier n'existe pas, initialiser vide
            } else {
                console.error(`Erreur lors du chargement du planning pour ${day}:`, error);
                // Gérer l'erreur, peut-être renvoyer une erreur 500
            }
        }
    }
    return { planning: weekData, agentDisplayInfos: agentsDetails, availableGrades: grades, availableFonctions: fonctions, availableQualifications: qualifications };
}

// Fonction pour sauvegarder le planning d'une semaine spécifique
async function savePlanningForWeek(week, year, day, agentId, absences) {
    const filePath = path.join(DATA_DIR, `${year}-week-${week}-${day}.json`);
    let dayPlanning = {};
    try {
        const data = await fs.readFile(filePath, 'utf8');
        dayPlanning = JSON.parse(data);
    } catch (error) {
        if (error.code !== 'ENOENT') {
            console.error(`Erreur lors de la lecture du fichier de planning pour ${day}:`, error);
            throw error; // Propager l'erreur pour qu'elle soit gérée par l'appelant
        }
        // Si 'ENOENT', dayPlanning reste vide, ce qui est correct pour un nouveau fichier
    }

    if (absences && absences.length > 0) {
        dayPlanning[agentId] = absences;
    } else {
        delete dayPlanning[agentId]; // Supprimer l'agent s'il n'a pas d'absences
    }

    await fs.writeFile(filePath, JSON.stringify(dayPlanning, null, 2), 'utf8');
    console.log(`Planning pour ${day} de la semaine ${week} mis à jour et sauvegardé.`);
}

app.get('/planning', async (req, res) => {
    const week = parseInt(req.query.week);
    const year = new Date().getFullYear(); // Ou récupérer l'année depuis la requête si nécessaire

    if (isNaN(week)) {
        return res.status(400).json({ message: 'Le numéro de semaine est requis.' });
    }

    try {
        const planningData = await getPlanningForWeek(week, year);
        res.json(planningData);
    } catch (error) {
        console.error('Erreur lors de la récupération du planning:', error);
        res.status(500).json({ message: 'Erreur interne du serveur lors de la récupération du planning.' });
    }
});

app.post('/planning/update-absence', async (req, res) => {
    const { week, day, agentId, absences } = req.body;
    const year = new Date().getFullYear(); // Ou récupérer l'année

    if (isNaN(week) || !day || !agentId || !Array.isArray(absences)) {
        return res.status(400).json({ message: 'Données de mise à jour du planning invalides.' });
    }

    try {
        await savePlanningForWeek(week, year, day, agentId, absences);
        res.json({ message: 'Absences de l\'agent mises à jour avec succès.' });
    } catch (error) {
        console.error('Erreur lors de la mise à jour des absences:', error);
        res.status(500).json({ message: 'Erreur interne du serveur lors de la mise à jour des absences.' });
    }
});

// --- Routes pour la feuille de garde (roster) ---

// Route pour obtenir la configuration de la feuille de garde
app.get('/roster-config', async (req, res) => {
    res.json(rosterConfig);
});

// Route pour mettre à jour la configuration de la feuille de garde
app.put('/roster-config', async (req, res) => {
    const { defaultAgentCount } = req.body;
    if (typeof defaultAgentCount !== 'number' || defaultAgentCount < 0) {
        return res.status(400).json({ message: 'Nombre d\'agents par défaut invalide.' });
    }
    rosterConfig.defaultAgentCount = defaultAgentCount;
    try {
        await saveRosterConfig();
        res.json({ message: 'Configuration de la feuille de garde mise à jour.' });
    } catch (error) {
        console.error('Erreur lors de la mise à jour de la configuration de la feuille de garde:', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

// Route pour obtenir la feuille de garde journalière
app.get('/daily-roster/:date', async (req, res) => {
    const dateKey = req.params.date; // Format YYYY-MM-DD
    try {
        const roster = await loadDailyRoster(dateKey);
        res.json(roster);
    } catch (error) {
        console.error(`Erreur lors de la récupération de la feuille de garde pour ${dateKey}:`, error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

// Route pour mettre à jour la feuille de garde journalière
app.put('/daily-roster/:date', async (req, res) => {
    const dateKey = req.params.date;
    const { roster } = req.body; // Le corps de la requête doit être l'objet 'roster' complet

    if (!roster || typeof roster !== 'object') {
        return res.status(400).json({ message: 'Données de feuille de garde invalides.' });
    }

    dailyRosters[dateKey] = { roster }; // Remplace la feuille de garde pour ce jour
    try {
        await saveDailyRoster(dateKey);
        res.json({ message: `Feuille de garde pour ${dateKey} mise à jour.` });
    } catch (error) {
        console.error(`Erreur lors de la mise à jour de la feuille de garde pour ${dateKey}:`, error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});


// --- Initialisation du serveur et des données ---

async function initializeRosterFolders() {
    try {
        await fs.mkdir(DAILY_ROSTER_DIR, { recursive: true });
        console.log('Dossier DAILY_ROSTER_DIR vérifié/créé.');
    } catch (error) {
        console.error('Erreur lors de la création de DAILY_ROSTER_DIR:', error);
    }
}

async function initializeSampleRosterDataForTesting() {
    // Crée un utilisateur admin par défaut si aucun utilisateur n'existe
    if (users.length === 0) {
        const adminPasswordHash = await bcrypt.hash('adminpassword', 10); // Mot de passe par défaut 'adminpassword'
        users.push({
            id: 'admin',
            username: 'admin',
            nom: 'Admin',
            prenom: 'Général',
            passwordHash: adminPasswordHash,
            role: 'admin',
            grades: [],
            fonctions: [],
            qualifications: []
        });
        await saveUsers();
        console.log('Utilisateur admin par défaut créé.');
    }

    // Crée quelques exemples de grades si aucun grade n'existe
    if (grades.length === 0) {
        grades.push({ id: 'sp', name: 'Sapeur', order: 0 });
        grades.push({ id: 'caporal', name: 'Caporal', order: 1 });
        grades.push({ id: 'sgt', name: 'Sergent', order: 2 });
        grades.push({ id: 'lt', name: 'Lieutenant', order: 3 });
        await saveGrades();
        console.log('Exemples de grades créés.');
    }

    // Crée quelques exemples de fonctions si aucune fonction n'existe
    if (fonctions.length === 0) {
        fonctions.push({ id: 'eq', name: 'Équipier', order: 0 });
        fonctions.push({ id: 'ca', name: 'Chef d\'Agrès', order: 1 });
        fonctions.push({ id: 'chef-srv', name: 'Chef de Service', order: 2 });
        await saveFonctions();
        console.log('Exemples de fonctions créés.');
    }

    // Initialise un fichier de configuration de feuille de garde si inexistant
    await loadRosterConfig(); // Cela va créer le fichier s'il n'existe pas

    // Exemple de données de planning pour une semaine et un jour donnés si les fichiers n'existent pas
    const sampleDateKey = "2024-week-24-lundi"; // Exemple: semaine 24 de 2024, Lundi
    const sampleFilePath = path.join(DATA_DIR, `${sampleDateKey}.json`);

    try {
        await fs.access(sampleFilePath); // Vérifie si le fichier existe
        console.log(`Planning file for ${sampleDateKey} already exists. Skipping sample data initialization.`);
    } catch (err) {
        if (err.code === 'ENOENT') {
            console.log(`Initializing empty planning for ${sampleDateKey}.`);
            await fs.writeFile(sampleFilePath, JSON.stringify({}, null, 2), 'utf8');
        } else {
            console.error(`Error checking/initializing planning file:`, err);
        }
    }

    // Vérifie et initialise le fichier rosterConfig.json
    const rosterConfigFile = ROSTER_CONFIG_FILE_PATH;
    try {
        await fs.access(rosterConfigFile);
        console.log(`Roster config file already exists. Skipping initialization.`);
    } catch (err) {
        if (err.code === 'ENOENT') {
            console.log(`Initializing default roster config file.`);
            const defaultRosterConfig = { defaultAgentCount: 10 };
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
    await loadQualifications(); // Chargé mais non utilisé par le frontend admin
    await loadGrades(); // Charger les grades au démarrage
    await loadFonctions(); // Charger les fonctions au démarrage
    await initializeSampleRosterDataForTesting(); // Appel de la fonction d'initialisation des données de test
})();

// Démarrer le serveur
app.listen(port, () => {
    console.log(`Serveur démarré sur le port ${port}`);
});