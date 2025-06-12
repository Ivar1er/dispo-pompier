const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcryptjs'); // Importation de bcryptjs
const jwt = require('jsonwebtoken'); // Importation de jsonwebtoken
const { v4: uuidv4 } = require('uuid'); // Importation de uuid pour générer des IDs uniques

const app = express();
const port = process.env.PORT || 3000;

// Configuration du secret JWT (doit être une variable d'environnement en production)
const JWT_SECRET = process.env.JWT_SECRET || 'votre_secret_jwt_tres_securise'; // À remplacer par une vraie variable d'environnement !

app.use(cors());
app.use(express.json());

// Répertoire public pour servir les fichiers statiques (HTML, CSS, JS frontend)
const PUBLIC_DIR = path.join(__dirname, 'public');
console.log('Dossier public:', PUBLIC_DIR);
app.use(express.static(PUBLIC_DIR));

// Répertoire persistant sur Render pour les données
// Assurez-vous que ce répertoire est configuré comme un volume persistant sur Render
const PERSISTENT_DIR = '/mnt/storage';

// Chemins des fichiers de données dans le répertoire persistant
const DATA_DIR = path.join(PERSISTENT_DIR, 'plannings');
const USERS_FILE_PATH = path.join(PERSISTENT_DIR, 'users.json');
const QUALIFICATIONS_FILE_PATH = path.join(PERSISTENT_DIR, 'qualifications.json');
const GRADES_FILE_PATH = path.join(PERSISTENT_DIR, 'grades.json');
const FONCTIONS_FILE_PATH = path.join(PERSISTENT_DIR, 'fonctions.json');
const ROSTER_CONFIG_DIR = path.join(PERSISTENT_DIR, 'roster_configs'); // Pour les configurations de la feuille de garde
const DAILY_ROSTER_DIR = path.join(PERSISTENT_DIR, 'daily_rosters'); // Pour les feuilles de garde quotidiennes

// --- Fonctions utilitaires ---

/**
 * Assure qu'un répertoire existe.
 * @param {string} directoryPath - Chemin du répertoire à créer.
 */
async function ensureDirectoryExists(directoryPath) {
    try {
        await fs.mkdir(directoryPath, { recursive: true });
        console.log(`Dossier "${directoryPath}" assuré.`);
    } catch (error) {
        console.error(`Erreur lors de la création du dossier "${directoryPath}":`, error);
        throw error; // Propager l'erreur pour que l'application puisse la gérer
    }
}

/**
 * Initialise un fichier JSON avec un contenu par défaut s'il n'existe pas.
 * @param {string} filePath - Chemin du fichier JSON.
 * @param {any} defaultContent - Contenu par défaut (ex: [], {}).
 */
async function initializeDataFile(filePath, defaultContent) {
    const dir = path.dirname(filePath);
    await ensureDirectoryExists(dir);
    try {
        await fs.access(filePath); // Vérifie si le fichier existe
        console.log(`Fichier "${filePath}" existe déjà.`);
    } catch (error) {
        if (error.code === 'ENOENT') { // Fichier non trouvé
            console.log(`Fichier "${filePath}" non trouvé, création avec contenu par défaut.`);
            await fs.writeFile(filePath, JSON.stringify(defaultContent, null, 2), 'utf8');
        } else {
            console.error(`Erreur lors de l'accès au fichier "${filePath}":`, error);
            throw error;
        }
    }
}

/**
 * Lit un fichier JSON.
 * @param {string} filePath - Chemin du fichier JSON.
 * @returns {Promise<Array|Object>} Le contenu parsé du fichier JSON.
 */
async function readJsonFile(filePath) {
    try {
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.warn(`Le fichier ${filePath} n'existe pas, renvoi d'un tableau/objet vide.`);
            return filePath.includes('users.json') || filePath.includes('roster_configs') || filePath.includes('daily_rosters') ? {} : []; // Retourne un objet vide pour users, roster_configs et daily_rosters, un tableau vide pour le reste
        }
        console.error(`Erreur de lecture du fichier ${filePath}:`, error);
        throw error;
    }
}

/**
 * Écrit des données dans un fichier JSON.
 * @param {string} filePath - Chemin du fichier JSON.
 * @param {Array|Object} data - Données à écrire.
 */
async function writeJsonFile(filePath, data) {
    await ensureDirectoryExists(path.dirname(filePath));
    try {
        await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
        console.error(`Erreur d'écriture dans le fichier ${filePath}:`, error);
        throw error;
    }
}

/**
 * Génère un ID unique.
 * @returns {string} Un identifiant unique.
 */
function generateUniqueId() {
    return uuidv4();
}

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

// Fonction pour obtenir la date du jour d'une semaine et d'un jour donnés
function getDateFromWeekAndDay(weekNumber, year, dayName) {
    const jan1 = new Date(year, 0, 1);
    const days = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    const targetDayIndex = days.indexOf(dayName.toLowerCase());

    // Obtenir le jour de la semaine du 1er janvier (0 pour dimanche, 1 pour lundi...)
    const jan1Day = jan1.getDay();
    // Calculer le décalage pour le premier jeudi de l'année (qui est toujours en semaine 1)
    const firstThursdayOffset = (jan1Day <= 4) ? 4 - jan1Day : (4 - jan1Day) + 7;
    const firstThursday = new Date(year, 0, 1 + firstThursdayOffset);

    // Calculer le décalage en jours depuis le premier jeudi pour atteindre la semaine désirée
    // Chaque semaine a 7 jours, et nous nous basons sur le premier jeudi
    const daysOffset = (weekNumber - 1) * 7;

    // Calculer la date pour le jeudi de la semaine désirée
    const targetThursday = new Date(firstThursday.getTime() + daysOffset * 24 * 60 * 60 * 1000);

    // Calculer la date finale pour le jour de la semaine désiré
    const resultDate = new Date(targetThursday.getTime() - ((targetThursday.getDay() || 7) - (targetDayIndex || 7)) * 24 * 60 * 60 * 1000);

    // Si le jour cible est dimanche et jan1Day n'est pas dimanche, cela peut causer un décalage de 7 jours.
    // Ajustement si le jour résultant tombe dans la semaine précédente ou suivante de manière incorrecte.
    // Cette partie est plus complexe et peut nécessiter des tests approfondis.
    // Pour simplifier, nous pouvons nous assurer que le jour de la semaine est correct après le calcul.
    if (resultDate.getDay() !== targetDayIndex) {
        const diff = targetDayIndex - resultDate.getDay();
        resultDate.setDate(resultDate.getDate() + (diff > 0 ? diff : diff + 7));
    }

    return resultDate;
}

// --- Middleware d'authentification JWT ---
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Format: Bearer TOKEN

    if (token == null) {
        console.log('Authentification refusée: Token non fourni.');
        return res.status(401).json({ message: 'Authentification requise.' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.log('Authentification refusée: Token invalide ou expiré.', err);
            return res.status(403).json({ message: 'Token invalide ou expiré.' });
        }
        req.user = user; // Ajoute les informations de l'utilisateur décodées au corps de la requête
        next();
    });
}

// --- Initialisation des fichiers de données au démarrage ---
async function initializeServerData() {
    try {
        await ensureDirectoryExists(DATA_DIR);
        await ensureDirectoryExists(ROSTER_CONFIG_DIR);
        await ensureDirectoryExists(DAILY_ROSTER_DIR);

        // Initialise les fichiers JSON avec un tableau vide par défaut s'ils n'existent pas
        await initializeDataFile(USERS_FILE_PATH, {}); // Les utilisateurs seront stockés comme un objet
        await initializeDataFile(QUALIFICATIONS_FILE_PATH, []);
        await initializeDataFile(GRADES_FILE_PATH, []);
        await initializeDataFile(FONCTIONS_FILE_PATH, []);

        console.log('Tous les répertoires et fichiers de données ont été initialisés.');
    } catch (error) {
        console.error('Échec de l\'initialisation des données du serveur:', error);
        process.exit(1); // Arrête le processus si l'initialisation échoue
    }
}

// --- Routes de l'API ---

// Route de connexion (non authentifiée)
app.post('/api/login', async (req, res) => {
    const { agent: agentId, mdp: password } = req.body;
    console.log(`Tentative de connexion pour l'agent: ${agentId}`);

    try {
        const users = await readJsonFile(USERS_FILE_PATH);
        const user = users[agentId];

        if (!user) {
            console.log(`Agent ${agentId} non trouvé.`);
            return res.status(401).json({ message: 'Identifiant ou mot de passe incorrect.' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.mdp);

        if (!isPasswordValid) {
            console.log(`Mot de passe incorrect pour l'agent: ${agentId}`);
            return res.status(401).json({ message: 'Identifiant ou mot de passe incorrect.' });
        }

        // Si l'utilisateur est un administrateur, ajoutez le rôle 'admin' au token
        const userPayload = {
            id: user.id,
            prenom: user.prenom,
            nom: user.nom,
            isAdmin: user.isAdmin || false
        };
        const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '8h' }); // Token valide 8 heures

        console.log(`Connexion réussie pour l'agent: ${agentId}`);
        res.json({ message: 'Connexion réussie', token, user: userPayload });

    } catch (error) {
        console.error('Erreur serveur lors de la connexion:', error);
        res.status(500).json({ message: 'Erreur interne du serveur lors de la connexion.' });
    }
});

// Route pour afficher les informations des agents pour le formulaire de connexion (non authentifiée)
app.get('/api/agents/display-info', async (req, res) => {
    try {
        const users = await readJsonFile(USERS_FILE_PATH);
        // Filtrer les utilisateurs pour ne pas inclure les mots de passe et ne renvoyer que les infos nécessaires
        const agentsInfo = Object.values(users).map(user => ({
            id: user.id,
            prenom: user.prenom,
            nom: user.nom,
            isAdmin: user.isAdmin || false
        }));
        // Vous pouvez filtrer les admins ici si vous ne voulez pas qu'ils apparaissent dans la liste déroulante agent
        const nonAdminAgents = agentsInfo.filter(agent => !agent.isAdmin);
        res.json(nonAdminAgents);
    } catch (error) {
        console.error("Erreur lors de la récupération des informations des agents:", error);
        res.status(500).json({ message: "Erreur interne du serveur." });
    }
});


// --- Routes protégées par l'authentification JWT ---
app.use(authenticateToken); // Toutes les routes définies après cette ligne nécessiteront un token JWT valide

// --- Routes pour la gestion des utilisateurs (Admin) ---
app.get('/api/users', async (req, res) => {
    if (!req.user.isAdmin) {
        return res.status(403).json({ message: 'Accès non autorisé.' });
    }
    try {
        const users = await readJsonFile(USERS_FILE_PATH);
        // Ne pas envoyer les mots de passe hachés directement au frontend si ce n'est pas nécessaire
        const usersForDisplay = Object.values(users).map(({ mdp, ...rest }) => rest);
        res.json(usersForDisplay);
    } catch (error) {
        console.error("Erreur lors de la récupération des utilisateurs:", error);
        res.status(500).json({ message: "Erreur interne du serveur." });
    }
});

app.post('/api/users', async (req, res) => {
    if (!req.user.isAdmin) {
        return res.status(403).json({ message: 'Accès non autorisé.' });
    }
    const { id, prenom, nom, mdp, qualifications, grade, fonction, isAdmin } = req.body;

    if (!id || !prenom || !nom || !mdp) {
        return res.status(400).json({ message: 'Tous les champs obligatoires doivent être renseignés.' });
    }

    try {
        const users = await readJsonFile(USERS_FILE_PATH);
        if (users[id]) {
            return res.status(409).json({ message: 'Un utilisateur avec cet identifiant existe déjà.' });
        }

        const hashedPassword = await bcrypt.hash(mdp, 10);
        const newUser = {
            id,
            prenom,
            nom,
            mdp: hashedPassword,
            qualifications: qualifications || [],
            grade: grade || '',
            fonction: fonction || '',
            isAdmin: isAdmin || false
        };

        users[id] = newUser;
        await writeJsonFile(USERS_FILE_PATH, users);
        const { mdp: _, ...userWithoutPassword } = newUser; // Exclure le mot de passe du retour
        res.status(201).json({ message: 'Utilisateur ajouté avec succès.', user: userWithoutPassword });
    } catch (error) {
        console.error("Erreur lors de l'ajout de l'utilisateur:", error);
        res.status(500).json({ message: "Erreur interne du serveur." });
    }
});

app.put('/api/users/:id', async (req, res) => {
    if (!req.user.isAdmin) {
        return res.status(403).json({ message: 'Accès non autorisé.' });
    }
    const { id } = req.params;
    const { prenom, nom, mdp, qualifications, grade, fonction, isAdmin } = req.body;

    try {
        const users = await readJsonFile(USERS_FILE_PATH);
        if (!users[id]) {
            return res.status(404).json({ message: 'Utilisateur non trouvé.' });
        }

        const userToUpdate = users[id];
        userToUpdate.prenom = prenom !== undefined ? prenom : userToUpdate.prenom;
        userToUpdate.nom = nom !== undefined ? nom : userToUpdate.nom;
        userToUpdate.qualifications = qualifications !== undefined ? qualifications : userToUpdate.qualifications;
        userToUpdate.grade = grade !== undefined ? grade : userToUpdate.grade;
        userToUpdate.fonction = fonction !== undefined ? fonction : userToUpdate.fonction;
        userToUpdate.isAdmin = isAdmin !== undefined ? isAdmin : userToUpdate.isAdmin;

        if (mdp) {
            userToUpdate.mdp = await bcrypt.hash(mdp, 10);
        }

        await writeJsonFile(USERS_FILE_PATH, users);
        const { mdp: _, ...userWithoutPassword } = userToUpdate;
        res.json({ message: 'Utilisateur mis à jour avec succès.', user: userWithoutPassword });
    } catch (error) {
        console.error("Erreur lors de la mise à jour de l'utilisateur:", error);
        res.status(500).json({ message: "Erreur interne du serveur." });
    }
});

app.delete('/api/users/:id', async (req, res) => {
    if (!req.user.isAdmin) {
        return res.status(403).json({ message: 'Accès non autorisé.' });
    }
    const { id } = req.params;

    try {
        const users = await readJsonFile(USERS_FILE_PATH);
        if (!users[id]) {
            return res.status(404).json({ message: 'Utilisateur non trouvé.' });
        }

        delete users[id];
        await writeJsonFile(USERS_FILE_PATH, users);
        res.json({ message: 'Utilisateur supprimé avec succès.' });
    } catch (error) {
        console.error("Erreur lors de la suppression de l'utilisateur:", error);
        res.status(500).json({ message: "Erreur interne du serveur." });
    }
});


// --- Routes pour la gestion des Qualifications (Admin) ---
app.get('/api/qualifications', async (req, res) => {
    if (!req.user.isAdmin) {
        return res.status(403).json({ message: 'Accès non autorisé.' });
    }
    try {
        const qualifications = await readJsonFile(QUALIFICATIONS_FILE_PATH);
        res.json(qualifications);
    } catch (error) {
        console.error("Erreur lors de la récupération des qualifications:", error);
        res.status(500).json({ message: "Erreur interne du serveur." });
    }
});

app.post('/api/qualifications', async (req, res) => {
    if (!req.user.isAdmin) {
        return res.status(403).json({ message: 'Accès non autorisé.' });
    }
    const { name } = req.body;
    if (!name) {
        return res.status(400).json({ message: 'Le nom de la qualification est requis.' });
    }
    try {
        const qualifications = await readJsonFile(QUALIFICATIONS_FILE_PATH);
        if (qualifications.some(q => q.name.toLowerCase() === name.toLowerCase())) {
            return res.status(409).json({ message: 'Cette qualification existe déjà.' });
        }
        const newQualification = { id: generateUniqueId(), name };
        qualifications.push(newQualification);
        await writeJsonFile(QUALIFICATIONS_FILE_PATH, qualifications);
        res.status(201).json({ message: 'Qualification ajoutée avec succès.', qualification: newQualification });
    } catch (error) {
        console.error("Erreur lors de l'ajout de la qualification:", error);
        res.status(500).json({ message: "Erreur interne du serveur." });
    }
});

app.put('/api/qualifications/:id', async (req, res) => {
    if (!req.user.isAdmin) {
        return res.status(403).json({ message: 'Accès non autorisé.' });
    }
    const { id } = req.params;
    const { name } = req.body;
    if (!name) {
        return res.status(400).json({ message: 'Le nom de la qualification est requis.' });
    }
    try {
        let qualifications = await readJsonFile(QUALIFICATIONS_FILE_PATH);
        const index = qualifications.findIndex(q => q.id === id);
        if (index === -1) {
            return res.status(404).json({ message: 'Qualification non trouvée.' });
        }
        if (qualifications.some(q => q.name.toLowerCase() === name.toLowerCase() && q.id !== id)) {
            return res.status(409).json({ message: 'Une qualification avec ce nom existe déjà.' });
        }
        qualifications[index].name = name;
        await writeJsonFile(QUALIFICATIONS_FILE_PATH, qualifications);
        res.json({ message: 'Qualification mise à jour avec succès.', qualification: qualifications[index] });
    } catch (error) {
        console.error("Erreur lors de la mise à jour de la qualification:", error);
        res.status(500).json({ message: "Erreur interne du serveur." });
    }
});

app.delete('/api/qualifications/:id', async (req, res) => {
    if (!req.user.isAdmin) {
        return res.status(403).json({ message: 'Accès non autorisé.' });
    }
    const { id } = req.params;
    try {
        let qualifications = await readJsonFile(QUALIFICATIONS_FILE_PATH);
        const initialLength = qualifications.length;
        qualifications = qualifications.filter(q => q.id !== id);
        if (qualifications.length === initialLength) {
            return res.status(404).json({ message: 'Qualification non trouvée.' });
        }
        await writeJsonFile(QUALIFICATIONS_FILE_PATH, qualifications);
        res.json({ message: 'Qualification supprimée avec succès.' });
    } catch (error) {
        console.error("Erreur lors de la suppression de la qualification:", error);
        res.status(500).json({ message: "Erreur interne du serveur." });
    }
});


// --- Routes pour la gestion des Grades (Admin) ---
app.get('/api/grades', async (req, res) => {
    if (!req.user.isAdmin) {
        return res.status(403).json({ message: 'Accès non autorisé.' });
    }
    try {
        const grades = await readJsonFile(GRADES_FILE_PATH);
        res.json(grades);
    } catch (error) {
        console.error("Erreur lors de la récupération des grades:", error);
        res.status(500).json({ message: "Erreur interne du serveur." });
    }
});

app.post('/api/grades', async (req, res) => {
    if (!req.user.isAdmin) {
        return res.status(403).json({ message: 'Accès non autorisé.' });
    }
    const { name } = req.body;
    if (!name) {
        return res.status(400).json({ message: 'Le nom du grade est requis.' });
    }
    try {
        const grades = await readJsonFile(GRADES_FILE_PATH);
        if (grades.some(g => g.name.toLowerCase() === name.toLowerCase())) {
            return res.status(409).json({ message: 'Ce grade existe déjà.' });
        }
        const newGrade = { id: generateUniqueId(), name };
        grades.push(newGrade);
        await writeJsonFile(GRADES_FILE_PATH, grades);
        res.status(201).json({ message: 'Grade ajouté avec succès.', grade: newGrade });
    } catch (error) {
        console.error("Erreur lors de l'ajout du grade:", error);
        res.status(500).json({ message: "Erreur interne du serveur." });
    }
});

app.put('/api/grades/:id', async (req, res) => {
    if (!req.user.isAdmin) {
        return res.status(403).json({ message: 'Accès non autorisé.' });
    }
    const { id } = req.params;
    const { name } = req.body;
    if (!name) {
        return res.status(400).json({ message: 'Le nom du grade est requis.' });
    }
    try {
        let grades = await readJsonFile(GRADES_FILE_PATH);
        const index = grades.findIndex(g => g.id === id);
        if (index === -1) {
            return res.status(404).json({ message: 'Grade non trouvé.' });
        }
        if (grades.some(g => g.name.toLowerCase() === name.toLowerCase() && g.id !== id)) {
            return res.status(409).json({ message: 'Un grade avec ce nom existe déjà.' });
        }
        grades[index].name = name;
        await writeJsonFile(GRADES_FILE_PATH, grades);
        res.json({ message: 'Grade mis à jour avec succès.', grade: grades[index] });
    } catch (error) {
        console.error("Erreur lors de la mise à jour du grade:", error);
        res.status(500).json({ message: "Erreur interne du serveur." });
    }
});

app.delete('/api/grades/:id', async (req, res) => {
    if (!req.user.isAdmin) {
        return res.status(403).json({ message: 'Accès non autorisé.' });
    }
    const { id } = req.params;
    try {
        let grades = await readJsonFile(GRADES_FILE_PATH);
        const initialLength = grades.length;
        grades = grades.filter(g => g.id !== id);
        if (grades.length === initialLength) {
            return res.status(404).json({ message: 'Grade non trouvé.' });
        }
        await writeJsonFile(GRADES_FILE_PATH, grades);
        res.json({ message: 'Grade supprimé avec succès.' });
    } catch (error) {
        console.error("Erreur lors de la suppression du grade:", error);
        res.status(500).json({ message: "Erreur interne du serveur." });
    }
});


// --- Routes pour la gestion des Fonctions (Admin) ---
app.get('/api/fonctions', async (req, res) => {
    if (!req.user.isAdmin) {
        return res.status(403).json({ message: 'Accès non autorisé.' });
    }
    try {
        const fonctions = await readJsonFile(FONCTIONS_FILE_PATH);
        res.json(fonctions);
    } catch (error) {
        console.error("Erreur lors de la récupération des fonctions:", error);
        res.status(500).json({ message: "Erreur interne du serveur." });
    }
});

app.post('/api/fonctions', async (req, res) => {
    if (!req.user.isAdmin) {
        return res.status(403).json({ message: 'Accès non autorisé.' });
    }
    const { name } = req.body;
    if (!name) {
        return res.status(400).json({ message: 'Le nom de la fonction est requis.' });
    }
    try {
        const fonctions = await readJsonFile(FONCTIONS_FILE_PATH);
        if (fonctions.some(f => f.name.toLowerCase() === name.toLowerCase())) {
            return res.status(409).json({ message: 'Cette fonction existe déjà.' });
        }
        const newFonction = { id: generateUniqueId(), name };
        fonctions.push(newFonction);
        await writeJsonFile(FONCTIONS_FILE_PATH, fonctions);
        res.status(201).json({ message: 'Fonction ajoutée avec succès.', fonction: newFonction });
    } catch (error) {
        console.error("Erreur lors de l'ajout de la fonction:", error);
        res.status(500).json({ message: "Erreur interne du serveur." });
    }
});

app.put('/api/fonctions/:id', async (req, res) => {
    if (!req.user.isAdmin) {
        return res.status(403).json({ message: 'Accès non autorisé.' });
    }
    const { id } = req.params;
    const { name } = req.body;
    if (!name) {
        return res.status(400).json({ message: 'Le nom de la fonction est requis.' });
    }
    try {
        let fonctions = await readJsonFile(FONCTIONS_FILE_PATH);
        const index = fonctions.findIndex(f => f.id === id);
        if (index === -1) {
            return res.status(404).json({ message: 'Fonction non trouvée.' });
        }
        if (fonctions.some(f => f.name.toLowerCase() === name.toLowerCase() && f.id !== id)) {
            return res.status(409).json({ message: 'Une fonction avec ce nom existe déjà.' });
        }
        fonctions[index].name = name;
        await writeJsonFile(FONCTIONS_FILE_PATH, fonctions);
        res.json({ message: 'Fonction mise à jour avec succès.', fonction: fonctions[index] });
    } catch (error) {
        console.error("Erreur lors de la mise à jour de la fonction:", error);
        res.status(500).json({ message: "Erreur interne du serveur." });
    }
});

app.delete('/api/fonctions/:id', async (req, res) => {
    if (!req.user.isAdmin) {
        return res.status(403).json({ message: 'Accès non autorisé.' });
    }
    const { id } = req.params;
    try {
        let fonctions = await readJsonFile(FONCTIONS_FILE_PATH);
        const initialLength = fonctions.length;
        fonctions = fonctions.filter(f => f.id !== id);
        if (fonctions.length === initialLength) {
            return res.status(404).json({ message: 'Fonction non trouvée.' });
        }
        await writeJsonFile(FONCTIONS_FILE_PATH, fonctions);
        res.json({ message: 'Fonction supprimée avec succès.' });
    } catch (error) {
        console.error("Erreur lors de la suppression de la fonction:", error);
        res.status(500).json({ message: "Erreur interne du serveur." });
    }
});


// --- Routes pour le planning de l'agent ---
app.get('/api/agent/planning/:id/:weekKey', async (req, res) => {
    const { id, weekKey } = req.params;
    // Vérifiez que l'agent accédant à la ressource est bien le sien ou un admin
    if (req.user.id !== id && !req.user.isAdmin) {
        return res.status(403).json({ message: 'Accès non autorisé à ce planning.' });
    }
    try {
        const filePath = path.join(DATA_DIR, `${id}.json`);
        const agentPlanning = await readJsonFile(filePath);
        // Le planning d'un agent est un objet où les clés sont les weekKeys
        res.json(agentPlanning[weekKey] || {}); // Retourne le planning de la semaine ou un objet vide
    } catch (error) {
        console.error(`Erreur lors de la récupération du planning pour l'agent ${id}, semaine ${weekKey}:`, error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

app.post('/api/agent/planning/:id/:weekKey', async (req, res) => {
    const { id, weekKey } = req.params;
    const planningData = req.body;
    // Vérifiez que l'agent modifiant la ressource est bien le sien ou un admin
    if (req.user.id !== id && !req.user.isAdmin) {
        return res.status(403).json({ message: 'Accès non autorisé pour modifier ce planning.' });
    }
    try {
        const filePath = path.join(DATA_DIR, `${id}.json`);
        let agentPlanning = await readJsonFile(filePath); // Lit le fichier complet de l'agent
        if (Array.isArray(agentPlanning)) { // Si c'est un ancien format de tableau, convertissez-le en objet
            const newAgentPlanning = {};
            agentPlanning.forEach(item => {
                if (item.weekKey) {
                    newAgentPlanning[item.weekKey] = item.planning;
                }
            });
            agentPlanning = newAgentPlanning;
            console.log(`Conversion de l'ancien format de planning pour l'agent ${id}.`);
        }

        agentPlanning[weekKey] = planningData; // Met à jour ou ajoute le planning pour la semaine spécifique
        await writeJsonFile(filePath, agentPlanning);
        res.json({ message: 'Planning enregistré avec succès.' });
    } catch (error) {
        console.error(`Erreur lors de l'enregistrement du planning pour l'agent ${id}, semaine ${weekKey}:`, error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

// Route pour récupérer les qualifications d'un agent spécifique
app.get('/api/agent/qualifications/:id', async (req, res) => {
    const { id } = req.params;
    if (req.user.id !== id && !req.user.isAdmin) {
        return res.status(403).json({ message: 'Accès non autorisé.' });
    }
    try {
        const users = await readJsonFile(USERS_FILE_PATH);
        const user = users[id];
        if (!user) {
            return res.status(404).json({ message: 'Agent non trouvé.' });
        }
        res.json(user.qualifications || []); // Retourne un tableau vide si aucune qualification
    } catch (error) {
        console.error(`Erreur lors de la récupération des qualifications pour l'agent ${id}:`, error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});


// --- Routes pour le planning global de l'admin ---
app.get('/api/admin/global-planning/:weekKey', async (req, res) => {
    if (!req.user.isAdmin) {
        return res.status(403).json({ message: 'Accès non autorisé.' });
    }
    const { weekKey } = req.params;
    try {
        const users = await readJsonFile(USERS_FILE_PATH);
        const allAgents = Object.values(users).filter(user => !user.isAdmin); // Exclure l'admin du planning global

        const globalPlanning = {};

        for (const agent of allAgents) {
            const agentId = agent.id;
            const filePath = path.join(DATA_DIR, `${agentId}.json`);
            let agentPlanning = await readJsonFile(filePath);

            // Gérer l'ancien format si nécessaire (tableau d'objets avec weekKey)
            if (Array.isArray(agentPlanning)) {
                const newAgentPlanning = {};
                agentPlanning.forEach(item => {
                    if (item.weekKey) {
                        newAgentPlanning[item.weekKey] = item.planning;
                    }
                });
                agentPlanning = newAgentPlanning;
                // Optionnel: sauvegarder le fichier converti pour les prochaines lectures
                // await writeJsonFile(filePath, agentPlanning);
            }
            globalPlanning[agentId] = agentPlanning[weekKey] || {};
        }
        res.json(globalPlanning);
    } catch (error) {
        console.error("Erreur lors de la récupération du planning global:", error);
        res.status(500).json({ message: "Erreur interne du serveur." });
    }
});

app.post('/api/admin/save-global-planning', async (req, res) => {
    if (!req.user.isAdmin) {
        return res.status(403).json({ message: 'Accès non autorisé.' });
    }
    const { weekKey, updatedPlanning } = req.body; // updatedPlanning est un objet { agentId: { day: { slot: status } } }

    if (!weekKey || !updatedPlanning) {
        return res.status(400).json({ message: 'Données de planning manquantes.' });
    }

    try {
        for (const agentId in updatedPlanning) {
            const filePath = path.join(DATA_DIR, `${agentId}.json`);
            let agentSpecificPlanning = await readJsonFile(filePath);

            // Gérer l'ancien format si nécessaire
            if (Array.isArray(agentSpecificPlanning)) {
                const newAgentPlanning = {};
                agentSpecificPlanning.forEach(item => {
                    if (item.weekKey) {
                        newAgentPlanning[item.weekKey] = item.planning;
                    }
                });
                agentSpecificPlanning = newAgentPlanning;
            }

            agentSpecificPlanning[weekKey] = updatedPlanning[agentId];
            await writeJsonFile(filePath, agentSpecificPlanning);
        }
        res.json({ message: 'Planning global mis à jour avec succès.' });
    } catch (error) {
        console.error("Erreur lors de la sauvegarde du planning global:", error);
        res.status(500).json({ message: "Erreur interne du serveur." });
    }
});


// --- Routes pour la Feuille de Garde ---

// Récupérer tous les agents avec leurs qualifications, grades et fonctions
app.get('/api/roster/agents', async (req, res) => {
    try {
        const users = await readJsonFile(USERS_FILE_PATH);
        const qualifications = await readJsonFile(QUALIFICATIONS_FILE_PATH);
        const grades = await readJsonFile(GRADES_FILE_PATH);
        const fonctions = await readJsonFile(FONCTIONS_FILE_PATH);

        const agentsWithDetails = Object.values(users).filter(user => !user.isAdmin).map(user => {
            const agentQualifications = user.qualifications ? user.qualifications.map(qId => {
                const qual = qualifications.find(q => q.id === qId);
                return qual ? qual.name : 'Inconnue';
            }) : [];
            const agentGrade = grades.find(g => g.id === user.grade);
            const agentFonction = fonctions.find(f => f.id === user.fonction);

            return {
                id: user.id,
                prenom: user.prenom,
                nom: user.nom,
                qualifications: agentQualifications,
                grade: agentGrade ? agentGrade.name : 'Inconnu',
                fonction: agentFonction ? agentFonction.name : 'Aucune'
            };
        });
        res.json(agentsWithDetails);
    } catch (error) {
        console.error("Erreur lors de la récupération des agents pour la feuille de garde:", error);
        res.status(500).json({ message: "Erreur interne du serveur." });
    }
});


// Route pour récupérer les agents disponibles pour une date spécifique
app.get('/api/roster/available-agents/:date', async (req, res) => {
    const { date } = req.params; // format YYYY-MM-DD
    try {
        const parsedDate = new Date(date + 'T12:00:00Z'); // Assurez-vous que le fuseau horaire ne pose pas de problème
        if (isNaN(parsedDate)) {
            return res.status(400).json({ message: 'Format de date invalide.' });
        }

        const weekNumber = getWeekNumber(parsedDate);
        const year = parsedDate.getFullYear();
        const weekKey = `week-${weekNumber}-${year}`;
        const dayName = getDayName(parsedDate); // ex: 'lundi'

        const users = await readJsonFile(USERS_FILE_PATH);
        const qualifications = await readJsonFile(QUALIFICATIONS_FILE_PATH);
        const grades = await readJsonFile(GRADES_FILE_PATH);
        const fonctions = await readJsonFile(FONCTIONS_FILE_PATH);

        const allAgents = Object.values(users).filter(user => !user.isAdmin); // Exclure l'admin

        const availableAgents = [];

        for (const agent of allAgents) {
            const agentId = agent.id;
            const filePath = path.join(DATA_DIR, `${agentId}.json`);
            let agentPlanning = await readJsonFile(filePath);

            // Gérer l'ancien format si nécessaire
            if (Array.isArray(agentPlanning)) {
                const newAgentPlanning = {};
                agentPlanning.forEach(item => {
                    if (item.weekKey) {
                        newAgentPlanning[item.weekKey] = item.planning;
                    }
                });
                agentPlanning = newAgentPlanning;
            }

            const currentWeekPlanning = agentPlanning[weekKey] || {};
            const dayPlanning = currentWeekPlanning[dayName] || {};

            // Vérifier si l'agent a au moins un créneau marqué comme "available"
            const isAvailable = Object.values(dayPlanning).some(status => status === 'available');

            if (isAvailable) {
                const agentQualifications = agent.qualifications ? agent.qualifications.map(qId => {
                    const qual = qualifications.find(q => q.id === qId);
                    return qual ? qual.name : 'Inconnue';
                }) : [];
                const agentGrade = grades.find(g => g.id === agent.grade);
                const agentFonction = fonctions.find(f => f.id === agent.fonction);

                availableAgents.push({
                    id: agent.id,
                    prenom: agent.prenom,
                    nom: agent.nom,
                    qualifications: agentQualifications,
                    grade: agentGrade ? agentGrade.name : 'Inconnu',
                    fonction: agentFonction ? agentFonction.name : 'Aucune'
                });
            }
        }
        res.json(availableAgents);
    } catch (error) {
        console.error(`Erreur lors de la récupération des agents disponibles pour la date ${date}:`, error);
        res.status(500).json({ message: "Erreur interne du serveur." });
    }
});

// Route pour récupérer la configuration de la feuille de garde quotidienne (agents d'astreinte, véhicules, etc.)
app.get('/api/roster/daily/:date', async (req, res) => {
    const { date } = req.params; // format YYYY-MM-DD
    const filePath = path.join(DAILY_ROSTER_DIR, `${date}.json`);
    try {
        const dailyRoster = await readJsonFile(filePath);
        res.json(dailyRoster);
    } catch (error) {
        console.error(`Erreur lors de la récupération de la feuille de garde quotidienne pour ${date}:`, error);
        if (error.code === 'ENOENT') {
            res.json({ onDutyAgents: [], vehicles: {} }); // Retourne une structure vide si le fichier n'existe pas
        } else {
            res.status(500).json({ message: "Erreur interne du serveur." });
        }
    }
});

// Route pour sauvegarder la configuration de la feuille de garde quotidienne
app.post('/api/roster/daily', async (req, res) => {
    const { date, onDutyAgents, vehicles } = req.body;
    if (!date) {
        return res.status(400).json({ message: 'La date est requise pour la sauvegarde de la feuille de garde.' });
    }
    const filePath = path.join(DAILY_ROSTER_DIR, `${date}.json`);
    try {
        await writeJsonFile(filePath, { date, onDutyAgents, vehicles });
        res.json({ message: 'Feuille de garde quotidienne sauvegardée avec succès.' });
    } catch (error) {
        console.error(`Erreur lors de la sauvegarde de la feuille de garde quotidienne pour ${date}:`, error);
        res.status(500).json({ message: "Erreur interne du serveur." });
    }
});


// Route pour servir index.html par défaut (généralement la page de connexion)
app.get('/', (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'login.html'));
});

// Gestion des routes non trouvées
app.use((req, res) => {
    res.status(404).send('Page non trouvée.');
});

// Initialiser les données et démarrer le serveur
initializeServerData().then(() => {
    app.listen(port, () => {
        console.log(`Server launched on http://localhost:${port}`);
    });
}).catch(err => {
    console.error('Échec critique au démarrage du serveur:', err);
});