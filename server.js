// server.js
require('dotenv').config(); // Importation et configuration de dotenv au tout début

const express = require('express');
const cors = require('cors');
const fs = require('fs').promises; // Utilisation des promesses pour fs
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const port = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'votre_secret_jwt_tres_long_et_complexe_a_changer_en_production'; // À changer absolument en production !

app.use(cors());
app.use(express.json());

// Répertoire public où se trouvent vos fichiers HTML, CSS, JS frontend
const PUBLIC_DIR = path.join(__dirname, 'public');
console.log('Dossier public:', PUBLIC_DIR);

// Gérer la requête pour la racine du site
// Sert login.html lorsque l'URL de base est demandée (par exemple, http://votresite.com/)
app.get('/', (req, res) => {
    // Assurez-vous que login.html se trouve bien dans le dossier 'public'
    res.sendFile(path.join(PUBLIC_DIR, 'login.html'));
});

// Cette ligne doit rester APRÈS la route spécifique pour '/'
// Elle sert tous les autres fichiers statiques (CSS, JS, images, admin.html, etc.)
app.use(express.static(PUBLIC_DIR));

// Répertoire persistant Render pour les plannings, les utilisateurs, les qualifications, les grades et les fonctions
// Utilisation d'une variable d'environnement pour la production (Render) et un chemin local pour le développement
const PERSISTENT_DIR = process.env.NODE_ENV === 'production' ? '/mnt/storage' : path.join(__dirname, 'data');

const USERS_FILE_PATH = path.join(PERSISTENT_DIR, 'users.json');
const GRADES_FILE_PATH = path.join(PERSISTENT_DIR, 'grades.json');
const FONCTIONS_FILE_PATH = path.join(PERSISTENT_DIR, 'fonctions.json');
const QUALIFICATIONS_FILE_PATH = path.join(PERSISTENT_DIR, 'qualifications.json');
const PLANNING_DATA_DIR = path.join(PERSISTENT_DIR, 'plannings'); // Renommé pour plus de clarté
const ROSTER_CONFIG_DIR = path.join(PERSISTENT_DIR, 'roster_configs');
const DAILY_ROSTER_DIR = path.join(PERSISTENT_DIR, 'daily_rosters');

// Fonctions utilitaires pour la lecture/écriture de fichiers JSON
async function ensureDirectoryExists(dirPath) {
    try {
        await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
        if (error.code !== 'EEXIST') {
            console.error(`Erreur lors de la création du dossier ${dirPath}:`, error);
            throw error; // Rendre l'erreur pour que l'appelant puisse la gérer
        }
    }
}

async function readJsonFile(filePath, defaultValue = {}) {
    try {
        await ensureDirectoryExists(path.dirname(filePath)); // Assure que le répertoire existe
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') { // Fichier non trouvé
            return defaultValue;
        }
        console.error(`Erreur lors de la lecture du fichier ${filePath}:`, error);
        throw error;
    }
}

async function writeJsonFile(filePath, data) {
    try {
        await ensureDirectoryExists(path.dirname(filePath)); // Assure que le répertoire existe
        await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
        console.error(`Erreur lors de l'écriture du fichier ${filePath}:`, error);
        throw error;
    }
}

// Middleware d'authentification JWT
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Format: Bearer TOKEN

    if (token == null) {
        console.warn('Tentative d\'accès non authentifiée à une route protégée.');
        return res.sendStatus(401); // Pas de token
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.warn('Token JWT invalide ou expiré:', err.message);
            return res.sendStatus(403); // Token invalide ou expiré
        }
        req.user = user; // Stocke les informations de l'utilisateur décodées
        next(); // Passe au middleware/route suivant
    });
}

// Middleware pour vérifier que l'utilisateur est admin
function authorizeAdmin(req, res, next) {
    if (!req.user || !req.user.isAdmin) {
        console.warn(`Tentative d'accès non autorisée par l'utilisateur ${req.user ? req.user.id : 'inconnu'} à une ressource admin.`);
        return res.sendStatus(403); // Interdit
    }
    next();
}

// Initialisation des dossiers et des fichiers par défaut au démarrage du serveur
(async () => {
    try {
        await ensureDirectoryExists(PLANNING_DATA_DIR);
        await ensureDirectoryExists(path.dirname(USERS_FILE_PATH));
        await ensureDirectoryExists(path.dirname(GRADES_FILE_PATH));
        await ensureDirectoryExists(path.dirname(FONCTIONS_FILE_PATH));
        await ensureDirectoryExists(path.dirname(QUALIFICATIONS_FILE_PATH));
        await ensureDirectoryExists(ROSTER_CONFIG_DIR);
        await ensureDirectoryExists(DAILY_ROSTER_DIR);

        // Créer l'utilisateur admin par défaut si users.json n'existe pas
        try {
            await fs.access(USERS_FILE_PATH); // Vérifie si le fichier existe
        } catch (error) {
            if (error.code === 'ENOENT') {
                const defaultAdminPassword = process.env.ADMIN_DEFAULT_PASSWORD || 'adminpassword';
                const hashedPassword = await bcrypt.hash(defaultAdminPassword, 10);
                const defaultUsers = {
                    "admin": {
                        "id": "admin",
                        "nom": "Administrateur",
                        "prenom": "",
                        "password": hashedPassword,
                        "isAdmin": true,
                        "qualifications": [],
                        "grades": [],
                        "fonctions": []
                    }
                };
                await writeJsonFile(USERS_FILE_PATH, defaultUsers);
                console.log('Fichier users.json par défaut créé avec un utilisateur admin.');
                console.warn('ATTENTION: Le mot de passe de l\'admin par défaut est celui que vous avez configuré ou "adminpassword". Changez-le via l\'interface admin après la première connexion pour une meilleure sécurité !');
            } else {
                console.error("Erreur inattendue lors de la vérification de users.json :", error);
            }
        }

        // Créer les fichiers grades.json, fonctions.json, qualifications.json s'ils n'existent pas
        // avec des valeurs par défaut si vous en avez, sinon des objets vides.
        await readJsonFile(GRADES_FILE_PATH, {}); // Crée le fichier si absent
        await readJsonFile(FONCTIONS_FILE_PATH, {}); // Crée le fichier si absent
        await readJsonFile(QUALIFICATIONS_FILE_PATH, {}); // Crée le fichier si absent

    } catch (err) {
        console.error("Erreur critique au démarrage du serveur lors de l'initialisation des dossiers ou des utilisateurs :", err);
        process.exit(1); // Arrête le processus si l'initialisation échoue
    }
})();

// --- Routes d'authentification et d'accès non protégées ---

app.post('/api/login', async (req, res) => {
    const { agent, mdp } = req.body;
    try {
        const users = await readJsonFile(USERS_FILE_PATH);
        const user = users[agent];

        if (!user) {
            return res.status(400).json({ message: 'Agent non trouvé.' });
        }

        const isMatch = await bcrypt.compare(mdp, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Mot de passe incorrect.' });
        }

        const token = jwt.sign(
            { id: user.id, isAdmin: user.isAdmin, nom: user.nom, prenom: user.prenom },
            JWT_SECRET,
            { expiresIn: '1h' } // Le token expire après 1 heure
        );

        res.json({
            message: 'Connexion réussie',
            token,
            agentId: user.id,
            isAdmin: user.isAdmin,
            nom: user.nom,
            prenom: user.prenom
        });

    } catch (error) {
        console.error('Erreur de connexion:', error);
        res.status(500).json({ message: 'Erreur serveur lors de la connexion.' });
    }
});

// NOUVELLE ROUTE : Obtenir la liste simplifiée des agents pour le formulaire de connexion
app.get('/api/agents-for-login', async (req, res) => {
    try {
        const users = await readJsonFile(USERS_FILE_PATH);
        const agentsForLogin = Object.keys(users).map(agentId => {
            const agent = users[agentId];
            return { id: agentId, nom: agent.nom, prenom: agent.prenom, isAdmin: agent.isAdmin };
        });
        res.json(agentsForLogin);
    } catch (error) {
        console.error('Erreur lors de la récupération des agents pour la page de connexion:', error);
        res.status(500).json({ message: 'Erreur serveur lors du chargement des agents.' });
    }
});

// --- Routes protégées par JWT (nécessitent authenticateToken) ---

// API Agents (ADMIN SEULEMENT)
app.get('/api/agents', authenticateToken, authorizeAdmin, async (req, res) => {
    try {
        const users = await readJsonFile(USERS_FILE_PATH);
        // Retourne tous les agents, mais sans les mots de passe hachés
        const agents = Object.values(users).map(user => {
            const { password, ...agentWithoutPassword } = user;
            return agentWithoutPassword;
        });
        res.json(agents);
    } catch (error) {
        console.error('Erreur lors de la récupération des agents:', error);
        res.status(500).json({ message: 'Erreur serveur lors de la récupération des agents.' });
    }
});

app.post('/api/agents', authenticateToken, authorizeAdmin, async (req, res) => {
    const { id, nom, prenom, password, isAdmin, qualifications, grades, fonctions } = req.body;
    if (!id || !nom || !prenom || !password) {
        return res.status(400).json({ message: 'Veuillez fournir un ID, nom, prénom et mot de passe pour l\'agent.' });
    }
    try {
        const users = await readJsonFile(USERS_FILE_PATH);
        if (users[id]) {
            return res.status(409).json({ message: 'Un agent avec cet ID existe déjà.' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        users[id] = {
            id,
            nom,
            prenom,
            password: hashedPassword,
            isAdmin: isAdmin || false,
            qualifications: qualifications || [],
            grades: grades || [],
            fonctions: fonctions || []
        };
        await writeJsonFile(USERS_FILE_PATH, users);
        res.status(201).json({ message: 'Agent ajouté avec succès.', agent: { id, nom, prenom, isAdmin } });
    } catch (error) {
        console.error('Erreur lors de l\'ajout d\'un agent:', error);
        res.status(500).json({ message: 'Erreur serveur lors de l\'ajout de l\'agent.' });
    }
});

app.put('/api/agents/:id', authenticateToken, authorizeAdmin, async (req, res) => {
    const { id } = req.params;
    const { nom, prenom, password, isAdmin, qualifications, grades, fonctions } = req.body;
    if (!nom || !prenom) {
        return res.status(400).json({ message: 'Veuillez fournir le nom et le prénom de l\'agent.' });
    }
    try {
        const users = await readJsonFile(USERS_FILE_PATH);
        if (!users[id]) {
            return res.status(404).json({ message: 'Agent non trouvé.' });
        }

        users[id].nom = nom;
        users[id].prenom = prenom;
        users[id].isAdmin = isAdmin;
        users[id].qualifications = qualifications || [];
        users[id].grades = grades || [];
        users[id].fonctions = fonctions || [];

        if (password) { // Permet de ne pas changer le mot de passe si non fourni
            users[id].password = await bcrypt.hash(password, 10);
        }

        await writeJsonFile(USERS_FILE_PATH, users);
        const { password: _, ...updatedAgent } = users[id]; // Ne pas renvoyer le mot de passe
        res.json({ message: 'Agent mis à jour avec succès.', agent: updatedAgent });
    } catch (error) {
        console.error(`Erreur lors de la mise à jour de l'agent ${id}:`, error);
        res.status(500).json({ message: 'Erreur serveur lors de la mise à jour de l\'agent.' });
    }
});

app.delete('/api/agents/:id', authenticateToken, authorizeAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const users = await readJsonFile(USERS_FILE_PATH);
        if (!users[id]) {
            return res.status(404).json({ message: 'Agent non trouvé.' });
        }
        delete users[id];
        await writeJsonFile(USERS_FILE_PATH, users);
        res.json({ message: 'Agent supprimé avec succès.' });
    } catch (error) {
        console.error(`Erreur lors de la suppression de l'agent ${id}:`, error);
        res.status(500).json({ message: 'Erreur serveur lors de la suppression de l\'agent.' });
    }
});

// API Grades (ADMIN SEULEMENT)
app.get('/api/grades', authenticateToken, authorizeAdmin, async (req, res) => {
    try {
        const grades = await readJsonFile(GRADES_FILE_PATH);
        res.json(Object.values(grades));
    } catch (error) {
        console.error('Erreur lors de la récupération des grades:', error);
        res.status(500).json({ message: 'Erreur serveur lors de la récupération des grades.' });
    }
});

app.post('/api/grades', authenticateToken, authorizeAdmin, async (req, res) => {
    const { id, name } = req.body;
    if (!id || !name) {
        return res.status(400).json({ message: 'Veuillez fournir un ID et un nom pour le grade.' });
    }
    try {
        const grades = await readJsonFile(GRADES_FILE_PATH);
        if (grades[id]) {
            return res.status(409).json({ message: 'Un grade avec cet ID existe déjà.' });
        }
        grades[id] = { id, name };
        await writeJsonFile(GRADES_FILE_PATH, grades);
        res.status(201).json({ message: 'Grade ajouté avec succès.', grade: { id, name } });
    } catch (error) {
        console.error('Erreur lors de l\'ajout d\'un grade:', error);
        res.status(500).json({ message: 'Erreur serveur lors de l\'ajout du grade.' });
    }
});

app.put('/api/grades/:id', authenticateToken, authorizeAdmin, async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    if (!name) {
        return res.status(400).json({ message: 'Veuillez fournir un nom pour le grade.' });
    }
    try {
        const grades = await readJsonFile(GRADES_FILE_PATH);
        if (!grades[id]) {
            return res.status(404).json({ message: 'Grade non trouvé.' });
        }
        grades[id].name = name;
        await writeJsonFile(GRADES_FILE_PATH, grades);
        res.json({ message: 'Grade mis à jour avec succès.', grade: grades[id] });
    } catch (error) {
        console.error(`Erreur lors de la mise à jour du grade ${id}:`, error);
        res.status(500).json({ message: 'Erreur serveur lors de la mise à jour du grade.' });
    }
});

app.delete('/api/grades/:id', authenticateToken, authorizeAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const grades = await readJsonFile(GRADES_FILE_PATH);
        if (!grades[id]) {
            return res.status(404).json({ message: 'Grade non trouvé.' });
        }
        delete grades[id];
        await writeJsonFile(GRADES_FILE_PATH, grades);
        res.json({ message: 'Grade supprimé avec succès.' });
    } catch (error) {
        console.error(`Erreur lors de la suppression du grade ${id}:`, error);
        res.status(500).json({ message: 'Erreur serveur lors de la suppression du grade.' });
    }
});

// API Fonctions (ADMIN SEULEMENT)
app.get('/api/fonctions', authenticateToken, authorizeAdmin, async (req, res) => {
    try {
        const fonctions = await readJsonFile(FONCTIONS_FILE_PATH);
        res.json(Object.values(fonctions));
    } catch (error) {
        console.error('Erreur lors de la récupération des fonctions:', error);
        res.status(500).json({ message: 'Erreur serveur lors de la récupération des fonctions.' });
    }
});

app.post('/api/fonctions', authenticateToken, authorizeAdmin, async (req, res) => {
    const { id, name } = req.body;
    if (!id || !name) {
        return res.status(400).json({ message: 'Veuillez fournir un ID et un nom pour la fonction.' });
    }
    try {
        const fonctions = await readJsonFile(FONCTIONS_FILE_PATH);
        if (fonctions[id]) {
            return res.status(409).json({ message: 'Une fonction avec cet ID existe déjà.' });
        }
        fonctions[id] = { id, name };
        await writeJsonFile(FONCTIONS_FILE_PATH, fonctions);
        res.status(201).json({ message: 'Fonction ajoutée avec succès.', fonction: { id, name } });
    } catch (error) {
        console.error('Erreur lors de l\'ajout d\'une fonction:', error);
        res.status(500).json({ message: 'Erreur serveur lors de l\'ajout de la fonction.' });
    }
});

app.put('/api/fonctions/:id', authenticateToken, authorizeAdmin, async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    if (!name) {
        return res.status(400).json({ message: 'Veuillez fournir un nom pour la fonction.' });
    }
    try {
        const fonctions = await readJsonFile(FONCTIONS_FILE_PATH);
        if (!fonctions[id]) {
            return res.status(404).json({ message: 'Fonction non trouvée.' });
        }
        fonctions[id].name = name;
        await writeJsonFile(FONCTIONS_FILE_PATH, fonctions);
        res.json({ message: 'Fonction mise à jour avec succès.', fonction: fonctions[id] });
    } catch (error) {
        console.error(`Erreur lors de la mise à jour de la fonction ${id}:`, error);
        res.status(500).json({ message: 'Erreur serveur lors de la mise à jour de la fonction.' });
    }
});

app.delete('/api/fonctions/:id', authenticateToken, authorizeAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const fonctions = await readJsonFile(FONCTIONS_FILE_PATH);
        if (!fonctions[id]) {
            return res.status(404).json({ message: 'Fonction non trouvée.' });
        }
        delete fonctions[id];
        await writeJsonFile(FONCTIONS_FILE_PATH, fonctions);
        res.json({ message: 'Fonction supprimée avec succès.' });
    } catch (error) {
        console.error(`Erreur lors de la suppression de la fonction ${id}:`, error);
        res.status(500).json({ message: 'Erreur serveur lors de la suppression de la fonction.' });
    }
});

// API Qualifications (ADMIN SEULEMENT)
app.get('/api/qualifications', authenticateToken, authorizeAdmin, async (req, res) => {
    try {
        const qualifications = await readJsonFile(QUALIFICATIONS_FILE_PATH);
        res.json(Object.values(qualifications));
    } catch (error) {
        console.error('Erreur lors de la récupération des qualifications:', error);
        res.status(500).json({ message: 'Erreur serveur lors de la récupération des qualifications.' });
    }
});

app.post('/api/qualifications', authenticateToken, authorizeAdmin, async (req, res) => {
    const { id, name } = req.body;
    if (!id || !name) {
        return res.status(400).json({ message: 'Veuillez fournir un ID et un nom pour la qualification.' });
    }
    try {
        const qualifications = await readJsonFile(QUALIFICATIONS_FILE_PATH);
        if (qualifications[id]) {
            return res.status(409).json({ message: 'Une qualification avec cet ID existe déjà.' });
        }
        qualifications[id] = { id, name };
        await writeJsonFile(QUALIFICATIONS_FILE_PATH, qualifications);
        res.status(201).json({ message: 'Qualification ajoutée avec succès.', qualification: { id, name } });
    } catch (error) {
        console.error('Erreur lors de l\'ajout d\'une qualification:', error);
        res.status(500).json({ message: 'Erreur serveur lors de l\'ajout de la qualification.' });
    }
});

app.put('/api/qualifications/:id', authenticateToken, authorizeAdmin, async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    if (!name) {
        return res.status(400).json({ message: 'Veuillez fournir un nom pour la qualification.' });
    }
    try {
        const qualifications = await readJsonFile(QUALIFICATIONS_FILE_PATH);
        if (!qualifications[id]) {
            return res.status(404).json({ message: 'Qualification non trouvée.' });
        }
        qualifications[id].name = name;
        await writeJsonFile(QUALIFICATIONS_FILE_PATH, qualifications);
        res.json({ message: 'Qualification mise à jour avec succès.', qualification: qualifications[id] });
    } catch (error) {
        console.error(`Erreur lors de la mise à jour de la qualification ${id}:`, error);
        res.status(500).json({ message: 'Erreur serveur lors de la mise à jour de la qualification.' });
    }
});

app.delete('/api/qualifications/:id', authenticateToken, authorizeAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const qualifications = await readJsonFile(QUALIFICATIONS_FILE_PATH);
        if (!qualifications[id]) {
            return res.status(404).json({ message: 'Qualification non trouvée.' });
        }
        delete qualifications[id];
        await writeJsonFile(QUALIFICATIONS_FILE_PATH, qualifications);
        res.json({ message: 'Qualification supprimée avec succès.' });
    } catch (error) {
        console.error(`Erreur lors de la suppression de la qualification ${id}:`, error);
        res.status(500).json({ message: 'Erreur serveur lors de la suppression de la qualification.' });
    }
});

// API Planning (ADMIN SEULEMENT)
// Récupérer le planning pour une semaine donnée
app.get('/api/planning/:year/:week', authenticateToken, async (req, res) => {
    const { year, week } = req.params;
    const filePath = path.join(PLANNING_DATA_DIR, `${year}-S${week}.json`);
    try {
        const planning = await readJsonFile(filePath, {});
        res.json(planning);
    } catch (error) {
        console.error(`Erreur lors de la récupération du planning ${year}-S${week}:`, error);
        res.status(500).json({ message: 'Erreur serveur lors de la récupération du planning.' });
    }
});

// Mettre à jour un créneau spécifique dans le planning
app.post('/api/planning/:year/:week', authenticateToken, authorizeAdmin, async (req, res) => {
    const { year, week } = req.params;
    const { agentId, day, slotIndex, value } = req.body;
    const filePath = path.join(PLANNING_DATA_DIR, `${year}-S${week}.json`);

    if (!agentId || !day || slotIndex === undefined || value === undefined) {
        return res.status(400).json({ message: 'Données de planning incomplètes.' });
    }

    try {
        const planning = await readJsonFile(filePath, {});

        if (!planning[agentId]) {
            planning[agentId] = {};
        }
        if (!planning[agentId][day]) {
            planning[agentId][day] = Array(48).fill(0); // 48 créneaux par jour
        }
        planning[agentId][day][slotIndex] = value; // 0 ou 1

        await writeJsonFile(filePath, planning);
        res.json({ message: 'Créneau mis à jour avec succès.', planning: planning });
    } catch (error) {
        console.error(`Erreur lors de la mise à jour du planning ${year}-S${week}:`, error);
        res.status(500).json({ message: 'Erreur serveur lors de la mise à jour du planning.' });
    }
});

// API Roster Configs (ADMIN SEULEMENT)
// Récupérer toutes les configurations de feuille de garde
app.get('/api/roster-configs', authenticateToken, authorizeAdmin, async (req, res) => {
    try {
        const files = await fs.readdir(ROSTER_CONFIG_DIR);
        const configs = {};
        for (const file of files) {
            if (file.endsWith('.json')) {
                const configName = path.basename(file, '.json');
                configs[configName] = await readJsonFile(path.join(ROSTER_CONFIG_DIR, file));
            }
        }
        res.json(configs);
    } catch (error) {
        console.error('Erreur lors de la récupération des configurations de feuille de garde:', error);
        res.status(500).json({ message: 'Erreur serveur lors de la récupération des configurations.' });
    }
});

// Récupérer une configuration spécifique
app.get('/api/roster-configs/:name', authenticateToken, authorizeAdmin, async (req, res) => {
    const { name } = req.params;
    const filePath = path.join(ROSTER_CONFIG_DIR, `${name}.json`);
    try {
        const config = await readJsonFile(filePath);
        res.json(config);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return res.status(404).json({ message: 'Configuration de feuille de garde non trouvée.' });
        }
        console.error(`Erreur lors de la récupération de la configuration ${name}:`, error);
        res.status(500).json({ message: 'Erreur serveur lors de la récupération de la configuration.' });
    }
});

// Sauvegarder/Mettre à jour une configuration
app.post('/api/roster-configs/:name', authenticateToken, authorizeAdmin, async (req, res) => {
    const { name } = req.params;
    const configData = req.body;
    const filePath = path.join(ROSTER_CONFIG_DIR, `${name}.json`);
    try {
        await writeJsonFile(filePath, configData);
        res.json({ message: 'Configuration de feuille de garde sauvegardée avec succès.', config: configData });
    } catch (error) {
        console.error(`Erreur lors de la sauvegarde de la configuration ${name}:`, error);
        res.status(500).json({ message: 'Erreur serveur lors de la sauvegarde de la configuration.' });
    }
});

// Supprimer une configuration
app.delete('/api/roster-configs/:name', authenticateToken, authorizeAdmin, async (req, res) => {
    const { name } = req.params;
    const filePath = path.join(ROSTER_CONFIG_DIR, `${name}.json`);
    try {
        await fs.unlink(filePath);
        res.json({ message: 'Configuration de feuille de garde supprimée avec succès.' });
    } catch (error) {
        if (error.code === 'ENOENT') {
            return res.status(404).json({ message: 'Configuration de feuille de garde non trouvée.' });
        }
        console.error(`Erreur lors de la suppression de la configuration ${name}:`, error);
        res.status(500).json({ message: 'Erreur serveur lors de la suppression de la configuration.' });
    }
});

// API Daily Roster (ADMIN SEULEMENT)
// Récupérer une feuille de garde quotidienne pour une date spécifique
app.get('/api/daily-roster/:date', authenticateToken, authorizeAdmin, async (req, res) => {
    const { date } = req.params; // Format: YYYY-MM-DD
    const filePath = path.join(DAILY_ROSTER_DIR, `${date}.json`);
    try {
        const roster = await readJsonFile(filePath, { date, agents: [] }); // Retourne un objet vide si non trouvé
        res.json(roster);
    } catch (error) {
        console.error(`Erreur lors de la récupération de la feuille de garde quotidienne pour le ${date}:`, error);
        res.status(500).json({ message: 'Erreur serveur lors de la récupération de la feuille de garde quotidienne.' });
    }
});

// Sauvegarder/Mettre à jour une feuille de garde quotidienne
app.post('/api/daily-roster/:date', authenticateToken, authorizeAdmin, async (req, res) => {
    const { date } = req.params;
    const rosterData = req.body; // Doit inclure l'array `agents`
    const filePath = path.join(DAILY_ROSTER_DIR, `${date}.json`);
    try {
        await writeJsonFile(filePath, rosterData);
        res.json({ message: 'Feuille de garde quotidienne sauvegardée avec succès.', roster: rosterData });
    } catch (error) {
        console.error(`Erreur lors de la sauvegarde de la feuille de garde quotidienne pour le ${date}:`, error);
        res.status(500).json({ message: 'Erreur serveur lors de la sauvegarde de la feuille de garde quotidienne.' });
    }
});


// Route de test pour écrire dans un fichier persistant Render
app.get('/api/test-disk-write', async (req, res) => {
  try {
    const testFilePath = path.join(PERSISTENT_DIR, 'test.txt');
    const contenu = `Test de l'écriture sur disque persistant à ${new Date().toISOString()}`;
    await fs.writeFile(testFilePath, contenu, 'utf8');
    res.status(200).send(`Fichier test.txt créé/mis à jour avec succès dans ${PERSISTENT_DIR} avec le contenu: ${contenu}`);
  } catch (err) {
    res.status(500).send(`Erreur disque: ${err.message}`);
  }
});

app.listen(port, () => {
  console.log(`Server launched on http://localhost:${port}`);
  console.log(`Persistent directory: ${PERSISTENT_DIR}`);
});

// --- Fonctions utilitaires (à inclure si elles ne sont pas déjà définies ailleurs) ---
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