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
const JWT_SECRET = process.env.JWT_SECRET || 'un_secret_tres_fort_et_aleatoire_pour_jwt_votre_app'; // **CORRIGÉ : Secret plus fort**

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
const GRADES_FILE_PATH = path.join(PERSISTENT_DIR, 'grades.json'); // Nouveau chemin pour les grades
const FONCTIONS_FILE_PATH = path.join(PERSISTENT_DIR, 'fonctions.json'); // Chemin mis à jour pour les fonctions

// Nouveaux chemins pour la persistance de la feuille de garde (si utilisés ailleurs)
const ROSTER_CONFIG_DIR = path.join(PERSISTENT_DIR, 'roster_configs');
const DAILY_ROSTER_DIR = path.join(PERSISTENT_DIR, 'daily_rosters');

// Assurez-vous que les répertoires persistants existent
async function ensureDirectoryExists(dir) {
    try {
        await fs.mkdir(dir, { recursive: true });
        console.log(`Directory ensured: ${dir}`);
    } catch (error) {
        console.error(`Error ensuring directory ${dir}:`, error);
        throw error; // Propagate the error if directory creation fails
    }
}

// Fonction pour lire un fichier JSON de manière sécurisée
async function readJsonFile(filePath, defaultContent = {}) {
    try {
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            // File not found, return default content
            return defaultContent;
        }
        console.error(`Error reading ${filePath}:`, error);
        throw error;
    }
}

// Fonction pour écrire dans un fichier JSON
async function writeJsonFile(filePath, data) {
    try {
        await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
        console.error(`Error writing to ${filePath}:`, error);
        throw error;
    }
}

// --- Middleware d'authentification JWT ---
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Format: Bearer TOKEN

    if (token == null) {
        console.log('No token provided.');
        return res.status(401).json({ message: 'Authentification requise.' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.log('Token verification failed:', err.message);
            // Si le token est expiré, renvoyer un statut 403 avec un message spécifique
            if (err.name === 'TokenExpiredError') {
                return res.status(403).json({ message: 'Votre session a expiré. Veuillez vous reconnecter.' });
            }
            return res.status(403).json({ message: 'Jeton invalide.' });
        }
        req.user = user; // Les informations de l'utilisateur (id, isAdmin) sont ajoutées à la requête
        next();
    });
}

// --- Routes d'authentification et d'accès aux agents (avant le middleware) ---

// Route de connexion
app.post('/api/login', async (req, res) => {
    const { agent, mdp } = req.body;
    console.log(`Tentative de connexion pour l'agent: ${agent}`);

    try {
        const users = await readJsonFile(USERS_FILE_PATH, {});
        const userRecord = users[agent];

        if (userRecord && await bcrypt.compare(mdp, userRecord.mdp)) {
            // Authentification réussie
            const user = { id: userRecord.id, isAdmin: userRecord.isAdmin };
            const token = jwt.sign(user, JWT_SECRET, { expiresIn: '1h' }); // Token expire en 1 heure
            console.log(`Connexion réussie pour ${agent}. isAdmin: ${userRecord.isAdmin}`);
            res.json({
                message: 'Connexion réussie',
                token,
                agentId: userRecord.id,
                isAdmin: userRecord.isAdmin,
                prenom: userRecord.prenom, // Inclure le prénom
                nom: userRecord.nom      // Inclure le nom
            });
        } else {
            console.log(`Échec de la connexion pour ${agent}: Identifiants invalides.`);
            res.status(401).json({ message: 'Identifiants invalides.' });
        }
    } catch (error) {
        console.error('Erreur lors de la connexion:', error);
        res.status(500).json({ message: 'Erreur interne du serveur lors de la connexion.' });
    }
});

// Route pour l'affichage des informations des agents (accessible sans authentification pour la liste de connexion)
app.get('/api/agents/display-info', async (req, res) => {
    try {
        const users = await readJsonFile(USERS_FILE_PATH, {});
        // Filtrer pour ne renvoyer que les informations nécessaires et éviter les mots de passe
        const agentDisplayInfos = Object.values(users).map(user => ({
            id: user.id,
            prenom: user.prenom,
            nom: user.nom,
            isAdmin: user.id === 'admin' // Assurer que 'admin' est toujours marqué comme tel si besoin
        }));
        res.json(agentDisplayInfos);
    } catch (error) {
        console.error('Erreur lors de la récupération des infos d\'affichage des agents:', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

// --- Application du middleware d'authentification à toutes les routes /api/ qui nécessitent une protection ---
// Toutes les routes définies APRÈS cette ligne nécessiteront un token valide.
app.use('/api', authenticateToken);


// --- Routes protégées (nécessitent une authentification) ---

// API pour les qualifications
app.get('/api/qualifications', async (req, res) => {
    try {
        const qualifications = await readJsonFile(QUALIFICATIONS_FILE_PATH, {});
        res.json(Object.values(qualifications));
    } catch (error) {
        console.error('Erreur lors de la récupération des qualifications:', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

app.post('/api/qualifications', async (req, res) => {
    const { name } = req.body;
    if (!name) {
        return res.status(400).json({ message: 'Le nom de la qualification est requis.' });
    }
    try {
        const qualifications = await readJsonFile(QUALIFICATIONS_FILE_PATH, {});
        const newId = uuidv4(); // Générer un ID unique
        qualifications[newId] = { id: newId, name };
        await writeJsonFile(QUALIFICATIONS_FILE_PATH, qualifications);
        res.status(201).json({ message: 'Qualification ajoutée avec succès.', qualification: qualifications[newId] });
    } catch (error) {
        console.error('Erreur lors de l\'ajout de la qualification:', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

app.put('/api/qualifications/:id', async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    if (!name) {
        return res.status(400).json({ message: 'Le nom de la qualification est requis.' });
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
        console.error('Erreur lors de la mise à jour de la qualification:', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

app.delete('/api/qualifications/:id', async (req, res) => {
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
        console.error('Erreur lors de la suppression de la qualification:', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});


// API pour les grades
app.get('/api/grades', async (req, res) => {
    try {
        const grades = await readJsonFile(GRADES_FILE_PATH, {});
        res.json(Object.values(grades));
    } catch (error) {
        console.error('Erreur lors de la récupération des grades:', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

app.post('/api/grades', async (req, res) => {
    const { name } = req.body;
    if (!name) {
        return res.status(400).json({ message: 'Le nom du grade est requis.' });
    }
    try {
        const grades = await readJsonFile(GRADES_FILE_PATH, {});
        const newId = uuidv4();
        grades[newId] = { id: newId, name };
        await writeJsonFile(GRADES_FILE_PATH, grades);
        res.status(201).json({ message: 'Grade ajouté avec succès.', grade: grades[newId] });
    } catch (error) {
        console.error('Erreur lors de l\'ajout du grade:', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

app.put('/api/grades/:id', async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    if (!name) {
        return res.status(400).json({ message: 'Le nom du grade est requis.' });
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
        console.error('Erreur lors de la mise à jour du grade:', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

app.delete('/api/grades/:id', async (req, res) => {
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
        console.error('Erreur lors de la suppression du grade:', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});


// API pour les fonctions
app.get('/api/fonctions', async (req, res) => {
    try {
        const fonctions = await readJsonFile(FONCTIONS_FILE_PATH, {});
        res.json(Object.values(fonctions));
    } catch (error) {
        console.error('Erreur lors de la récupération des fonctions:', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

app.post('/api/fonctions', async (req, res) => {
    const { name } = req.body;
    if (!name) {
        return res.status(400).json({ message: 'Le nom de la fonction est requis.' });
    }
    try {
        const fonctions = await readJsonFile(FONCTIONS_FILE_PATH, {});
        const newId = uuidv4();
        fonctions[newId] = { id: newId, name };
        await writeJsonFile(FONCTIONS_FILE_PATH, fonctions);
        res.status(201).json({ message: 'Fonction ajoutée avec succès.', fonction: fonctions[newId] });
    } catch (error) {
        console.error('Erreur lors de l\'ajout de la fonction:', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

app.put('/api/fonctions/:id', async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    if (!name) {
        return res.status(400).json({ message: 'Le nom de la fonction est requis.' });
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
        console.error('Erreur lors de la mise à jour de la fonction:', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

app.delete('/api/fonctions/:id', async (req, res) => {
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
        console.error('Erreur lors de la suppression de la fonction:', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

// API pour la gestion des agents
app.get('/api/agents', async (req, res) => {
    try {
        const users = await readJsonFile(USERS_FILE_PATH, {});
        // Retourne les utilisateurs sans leur mot de passe
        const safeUsers = Object.values(users).map(({ mdp, ...rest }) => rest);
        res.json(safeUsers);
    } catch (error) {
        console.error('Erreur lors de la récupération des agents:', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

app.post('/api/agents', async (req, res) => {
    const { id, prenom, nom, mdp, qualifications, grade, fonction, isAdmin } = req.body;

    if (!id || !prenom || !nom || !mdp) {
        return res.status(400).json({ message: 'ID, prénom, nom et mot de passe sont requis.' });
    }

    try {
        const users = await readJsonFile(USERS_FILE_PATH, {});
        if (users[id]) {
            return res.status(409).json({ message: 'Un agent avec cet identifiant existe déjà.' });
        }

        const hashedPassword = await bcrypt.hash(mdp, 10);
        users[id] = {
            id,
            prenom,
            nom,
            mdp: hashedPassword, // Stocke le mot de passe haché
            qualifications: qualifications || [],
            grade: grade || null,
            fonction: fonction || null,
            isAdmin: !!isAdmin // Convertit en booléen
        };
        await writeJsonFile(USERS_FILE_PATH, users);
        const { mdp: _, ...newUser } = users[id]; // Exclut le mot de passe haché de la réponse
        res.status(201).json({ message: 'Agent ajouté avec succès.', agent: newUser });
    } catch (error) {
        console.error('Erreur lors de l\'ajout de l\'agent:', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

app.put('/api/agents/:id', async (req, res) => {
    const { id } = req.params;
    const { prenom, nom, mdp, qualifications, grade, fonction, isAdmin } = req.body;

    if (!prenom || !nom) {
        return res.status(400).json({ message: 'Prénom et nom sont requis pour la mise à jour.' });
    }

    try {
        const users = await readJsonFile(USERS_FILE_PATH);
        if (!users[id]) {
            return res.status(404).json({ message: 'Agent non trouvé.' });
        }

        users[id].prenom = prenom;
        users[id].nom = nom;
        users[id].qualifications = qualifications || [];
        users[id].grade = grade || null;
        users[id].fonction = fonction || null;
        users[id].isAdmin = !!isAdmin;

        // Si un nouveau mot de passe est fourni, le hacher et le mettre à jour
        if (mdp) {
            users[id].mdp = await bcrypt.hash(mdp, 10);
        }

        await writeJsonFile(USERS_FILE_PATH, users);
        const { mdp: _, ...updatedUser } = users[id]; // Exclut le mot de passe haché
        res.json({ message: 'Agent mis à jour avec succès.', agent: updatedUser });
    } catch (error) {
        console.error('Erreur lors de la mise à jour de l\'agent:', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

app.delete('/api/agents/:id', async (req, res) => {
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
        console.error('Erreur lors de la suppression de l\'agent:', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

// API pour les plannings
app.get('/api/plannings/:weekNumber', async (req, res) => {
    const { weekNumber } = req.params;
    const filePath = path.join(DATA_DIR, `week-${weekNumber}.json`);
    try {
        const planning = await readJsonFile(filePath, {}); // Retourne un objet vide si non trouvé
        res.json(planning);
    } catch (error) {
        console.error(`Erreur lors de la récupération du planning de la semaine ${weekNumber}:`, error);
        // Si c'est un ENOENT (fichier non trouvé), renvoyer 200 avec un objet vide, sinon 500
        if (error.code === 'ENOENT') {
             res.json({});
        } else {
            res.status(500).json({ message: 'Erreur interne du serveur.' });
        }
    }
});

app.post('/api/plannings/:weekNumber', async (req, res) => {
    const { weekNumber } = req.params;
    const { agentId, planningData } = req.body; // planningData est un objet { day: [slots] }

    if (!agentId || !planningData) {
        return res.status(400).json({ message: 'ID de l\'agent et données de planning sont requis.' });
    }

    const filePath = path.join(DATA_DIR, `week-${weekNumber}.json`);
    try {
        const currentPlanning = await readJsonFile(filePath, {});
        currentPlanning[agentId] = { ...currentPlanning[agentId], ...planningData }; // Fusionne les données existantes avec les nouvelles
        await writeJsonFile(filePath, currentPlanning);
        res.json({ message: 'Planning enregistré avec succès.' });
    } catch (error) {
        console.error(`Erreur lors de l'enregistrement du planning de la semaine ${weekNumber} pour ${agentId}:`, error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

// Route pour récupérer le planning d'un agent spécifique pour une semaine donnée
app.get('/api/plannings/:weekNumber/:agentId', async (req, res) => {
    const { weekNumber, agentId } = req.params;
    const filePath = path.join(DATA_DIR, `week-${weekNumber}.json`);
    try {
        const fullPlanning = await readJsonFile(filePath, {});
        const agentPlanning = fullPlanning[agentId] || {}; // Retourne le planning de l'agent ou un objet vide
        res.json(agentPlanning);
    } catch (error) {
        console.error(`Erreur lors de la récupération du planning de l'agent ${agentId} pour la semaine ${weekNumber}:`, error);
        if (error.code === 'ENOENT') {
            res.json({}); // Si le fichier de la semaine n'existe pas, il n'y a pas de planning pour cet agent
        } else {
            res.status(500).json({ message: 'Erreur interne du serveur.' });
        }
    }
});


// Route pour récupérer la configuration de la feuille de garde quotidienne
app.get('/api/roster/daily/:date', async (req, res) => {
    const { date } = req.params;
    const filePath = path.join(DAILY_ROSTER_DIR, `${date}.json`);
    try {
        const rosterConfig = await readJsonFile(filePath, { date, onDutyAgents: [], vehicles: [] });
        res.json(rosterConfig);
    } catch (error) {
        console.error(`Erreur lors de la récupération de la feuille de garde quotidienne pour ${date}:`, error);
        if (error.code === 'ENOENT') {
            res.json({ date, onDutyAgents: [], vehicles: [] }); // Retourne une structure vide si le fichier n'existe pas
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
async function initializeServerData() {
    try {
        await ensureDirectoryExists(DATA_DIR);
        await ensureDirectoryExists(ROSTER_CONFIG_DIR);
        await ensureDirectoryExists(DAILY_ROSTER_DIR);

        // Initialisation du fichier users.json si nécessaire
        const usersExists = await fs.access(USERS_FILE_PATH).then(() => true).catch(() => false);
        if (!usersExists) {
            console.log('users.json non trouvé, création...');
            const defaultAdminPassword = process.env.ADMIN_PASSWORD || 'password123'; // Utilisez une variable d'env pour la prod!
            const hashedPassword = await bcrypt.hash(defaultAdminPassword, 10);
            await writeJsonFile(USERS_FILE_PATH, {
                admin: {
                    id: 'admin',
                    prenom: 'Administrateur',
                    nom: '',
                    mdp: hashedPassword,
                    qualifications: [],
                    grade: null,
                    fonction: null,
                    isAdmin: true
                },
                 // Ajoutez d'autres utilisateurs par défaut ici si besoin
                bruneau: { id: 'bruneau', prenom: 'Mathieu', nom: 'Bruneau', mdp: await bcrypt.hash('mdp_bruneau', 10), qualifications: [], grade: null, fonction: null, isAdmin: false },
                vatinel: { id: 'vatinel', prenom: 'Sébastien', nom: 'Vatinel', mdp: await bcrypt.hash('mdp_vatinel', 10), qualifications: [], grade: null, fonction: null, isAdmin: false },
                gesbert: { id: 'gesbert', prenom: 'Jonathan', nom: 'Gesbert', mdp: await bcrypt.hash('mdp_gesbert', 10), qualifications: [], grade: null, fonction: null, isAdmin: false },
                tuleu: { id: 'tuleu', prenom: 'Kévin', nom: 'Tuleu', mdp: await bcrypt.hash('mdp_tuleu', 10), qualifications: [], grade: null, fonction: null, isAdmin: false },
                lelann: { id: 'lelann', prenom: 'Philippe', nom: 'Le Lann', mdp: await bcrypt.hash('mdp_lelann', 10), qualifications: [], grade: null, fonction: null, isAdmin: false },
                cordel: { id: 'cordel', prenom: 'Camilla', nom: 'Cordel', mdp: await bcrypt.hash('mdp_cordel', 10), qualifications: [], grade: null, fonction: null, isAdmin: false },
                boudet: { id: 'boudet', prenom: 'Sébastien', nom: 'Boudet', mdp: await bcrypt.hash('mdp_boudet', 10), qualifications: [], grade: null, fonction: null, isAdmin: false },
                boulmé: { id: 'boulmé', prenom: 'Grégoire', nom: 'Boulmé', mdp: await bcrypt.hash('mdp_boulmé', 10), qualifications: [], grade: null, fonction: null, isAdmin: false },
                maréchal: { id: 'maréchal', prenom: 'Nicolas', nom: 'Maréchal', mdp: await bcrypt.hash('mdp_maréchal', 10), qualifications: [], grade: null, fonction: null, isAdmin: false },
                justice: { id: 'justice', prenom: 'Quentin', nom: 'Justice', mdp: await bcrypt.hash('mdp_justice', 10), qualifications: [], grade: null, fonction: null, isAdmin: false },
                veniant: { id: 'veniant', prenom: 'Mathis', nom: 'Veniant', mdp: await bcrypt.hash('mdp_veniant', 10), qualifications: [], grade: null, fonction: null, isAdmin: false },
                normand: { id: 'normand', prenom: 'Stéphane', nom: 'Normand', mdp: await bcrypt.hash('mdp_normand', 10), qualifications: [], grade: null, fonction: null, isAdmin: false },
                schaeffer: { id: 'schaeffer', prenom: 'Caroline', nom: 'Schaeffer', mdp: await bcrypt.hash('mdp_schaeffer', 10), qualifications: [], grade: null, fonction: null, isAdmin: false },
                boulet: { id: 'boulet', prenom: 'Aurélie', nom: 'Boulet', mdp: await bcrypt.hash('mdp_boulet', 10), qualifications: [], grade: null, fonction: null, isAdmin: false },
                charenton: { id: 'charenton', prenom: 'Marilou', nom: 'Charenton', mdp: await bcrypt.hash('mdp_charenton', 10), qualifications: [], grade: null, fonction: null, isAdmin: false },
                hérédia: { id: 'hérédia', prenom: 'Jules', nom: 'Hérédia', mdp: await bcrypt.hash('mdp_hérédia', 10), qualifications: [], grade: null, fonction: null, isAdmin: false },
                loisel: { id: 'loisel', prenom: 'Charlotte', nom: 'Loisel', mdp: await bcrypt.hash('mdp_loisel', 10), qualifications: [], grade: null, fonction: null, isAdmin: false },
                mailly: { id: 'mailly', prenom: 'Lucile', nom: 'Mailly', mdp: await bcrypt.hash('mdp_mailly', 10), qualifications: [], grade: null, fonction: null, isAdmin: false },
                marlin: { id: 'marlin', prenom: 'Lilian', nom: 'Marlin', mdp: await bcrypt.hash('mdp_marlin', 10), qualifications: [], grade: null, fonction: null, isAdmin: false },
                savigny: { id: 'savigny', prenom: 'Victoria', nom: 'Savigny', mdp: await bcrypt.hash('mdp_savigny', 10), qualifications: [], grade: null, fonction: null, isAdmin: false },
                tinseau: { id: 'tinseau', prenom: 'Clément', nom: 'Tinseau', mdp: await bcrypt.hash('mdp_tinseau', 10), qualifications: [], grade: null, fonction: null, isAdmin: false }
            });
            console.log('users.json créé avec un utilisateur admin par défaut.');
        }

        // Initialisation du fichier qualifications.json si nécessaire
        const qualificationsExists = await fs.access(QUALIFICATIONS_FILE_PATH).then(() => true).catch(() => false);
        if (!qualificationsExists) {
            console.log('qualifications.json non trouvé, création...');
            await writeJsonFile(QUALIFICATIONS_FILE_PATH, {}); // Initialisation vide
        }

        // Initialisation du fichier grades.json si nécessaire
        const gradesExists = await fs.access(GRADES_FILE_PATH).then(() => true).catch(() => false);
        if (!gradesExists) {
            console.log('grades.json non trouvé, création...');
            await writeJsonFile(GRADES_FILE_PATH, {}); // Initialisation vide
        }

        // Initialisation du fichier fonctions.json si nécessaire
        const fonctionsExists = await fs.access(FONCTIONS_FILE_PATH).then(() => true).catch(() => false);
        if (!fonctionsExists) {
            console.log('fonctions.json non trouvé, création...');
            await writeJsonFile(FONCTIONS_FILE_PATH, {}); // Initialisation vide
        }

    } catch (error) {
        console.error('Échec de l\'initialisation du serveur:', error);
        process.exit(1); // Arrêter l'application si l'initialisation échoue
    }
}

initializeServerData().then(() => {
    app.listen(port, () => {
        console.log(`Server launched on http://localhost:${port}`);
    });
}).catch(error => {
    console.error('Failed to start server after data initialization:', error);
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

// Fonction pour obtenir les noms complets des agents (utilisé par admin.js et d'autres)
app.get('/api/agent-names', authenticateToken, async (req, res) => {
    try {
        const users = await readJsonFile(USERS_FILE_PATH, {});
        const agentNames = Object.values(users).map(user => ({
            id: user.id,
            fullName: `${user.prenom} ${user.nom}`
        }));
        res.json(agentNames);
    } catch (error) {
        console.error('Erreur lors de la récupération des noms d\'agents:', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});