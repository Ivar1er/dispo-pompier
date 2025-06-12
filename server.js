// server.js
require('dotenv').config(); // AJOUTÉ : Importation et configuration de dotenv au tout début

const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Répertoire public où se trouvent vos fichiers HTML, CSS, JS frontend
const PUBLIC_DIR = path.join(__dirname, 'public');
console.log('Dossier public:', PUBLIC_DIR);

// *******************************************************************
// Gérer la requête pour la racine du site
// Sert login.html lorsque l'URL de base est demandée (par exemple, http://votresite.com/)
app.get('/', (req, res) => {
    // Assurez-vous que login.html se trouve bien dans le dossier 'public'
    res.sendFile(path.join(PUBLIC_DIR, 'login.html'));
});
// *******************************************************************

// Cette ligne doit rester APRÈS la route spécifique pour '/'
// Elle sert tous les autres fichiers statiques (CSS, JS, images, admin.html, etc.)
app.use(express.static(PUBLIC_DIR));

// Répertoire persistant Render pour les plannings, les utilisateurs, les qualifications, les grades et les fonctions
const PERSISTENT_DIR = process.env.NODE_ENV === 'production' ? '/mnt/storage' : path.join(__dirname, 'data'); // Conditionnel pour local/prod
console.log('Dossier persistant:', PERSISTENT_DIR);


const DATA_DIR = path.join(PERSISTENT_DIR, 'plannings');
const USERS_FILE_PATH = path.join(PERSISTENT_DIR, 'users.json');
const QUALIFICATIONS_FILE_PATH = path.join(PERSISTENT_DIR, 'qualifications.json');
const GRADES_FILE_PATH = path.join(PERSISTENT_DIR, 'grades.json');
const FONCTIONS_FILE_PATH = path.join(PERSISTENT_DIR, 'fonctions.json');

// Nouveaux chemins pour la persistance de la feuille de garde (si utilisés ailleurs)
const ROSTER_CONFIG_DIR = path.join(PERSISTENT_DIR, 'roster_configs');
const DAILY_ROSTER_DIR = path.join(PERSISTENT_DIR, 'daily_rosters');

// Fonction utilitaire pour lire un fichier JSON de manière sécurisée
const readJsonFile = async (filePath, defaultData = []) => {
    try {
        await fs.access(filePath); // Vérifier si le fichier existe
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            // Le fichier n'existe pas, créer le répertoire si nécessaire et le fichier vide
            await fs.mkdir(path.dirname(filePath), { recursive: true });
            await fs.writeFile(filePath, JSON.stringify(defaultData, null, 2), 'utf8');
            return defaultData;
        }
        console.error(`Erreur lors de la lecture ou de l'initialisation de ${filePath}:`, error);
        throw error; // Propager l'erreur pour une gestion ultérieure
    }
};

// Fonction utilitaire pour écrire dans un fichier JSON
const writeJsonFile = async (filePath, data) => {
    try {
        await fs.mkdir(path.dirname(filePath), { recursive: true }); // Crée les répertoires si non existants
        await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
        console.error(`Erreur lors de l'écriture dans ${filePath}:`, error);
        throw error;
    }
};

// Middleware pour l'authentification des tokens JWT
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Format: Bearer TOKEN

    if (token == null) return res.status(401).json({ message: 'Token manquant' });

    // La clé secrète doit être la même que celle utilisée pour signer le token
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => { // CHANGEMENT ICI: Supprimé le fallback 'your_jwt_secret' direct, car dotenv le gère.
        if (err) {
            console.error('Erreur de vérification du token:', err.message);
            // Différencier l'erreur si le token est expiré
            if (err.name === 'TokenExpiredError') {
                return res.status(403).json({ message: 'Token expiré' });
            }
            return res.status(403).json({ message: 'Token invalide' });
        }
        req.user = user; // Le payload du token est stocké dans req.user
        next();
    });
};

// Middleware pour vérifier le rôle admin
const authorizeAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ message: 'Accès interdit: rôle non autorisé' });
    }
};

// --------------------------- AUTHENTIFICATION ---------------------------

// Route de connexion
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const users = await readJsonFile(USERS_FILE_PATH);
        const user = users.find(u => u.email === email);

        if (!user) {
            return res.status(400).json({ message: 'Email ou mot de passe incorrect.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Email ou mot de passe incorrect.' });
        }

        // Générer un token JWT
        // Assurez-vous que process.env.JWT_SECRET est défini sur votre serveur Render ou via .env en local
        const token = jwt.sign(
            { userId: user._id, username: user.username, role: user.role },
            process.env.JWT_SECRET, // UTILISEZ VOTRE CLÉ SECRÈTE DEPUIS process.env
            { expiresIn: '1h' } // Le token expire après 1 heure
        );

        res.json({ message: 'Connexion réussie!', token, username: user.username, role: user.role });
    } catch (error) {
        console.error('Erreur de connexion:', error);
        res.status(500).json({ message: 'Erreur du serveur.' });
    }
});

// Route pour vérifier la validité d'un token JWT (utilisée par le frontend)
app.post('/api/auth/verify-token', (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ isValid: false, message: 'Token manquant.' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => { // CHANGEMENT ICI
        if (err) {
            console.error('Token verification error:', err.message);
            return res.status(403).json({ isValid: false, message: 'Token invalide ou expiré.' });
        }
        // Le token est valide, renvoie les informations de l'utilisateur incluses dans le token
        res.json({ isValid: true, username: decoded.username, role: decoded.role, userId: decoded.userId });
    });
});


// --------------------------- GESTION DES AGENTS (CRUD) ---------------------------

// Route pour ajouter un nouvel agent
app.post('/api/agents', authenticateToken, authorizeAdmin, async (req, res) => {
    const { nom, prenom, tel, email, password, role, grades, fonctions } = req.body;
    try {
        let users = await readJsonFile(USERS_FILE_PATH);
        if (users.find(u => u.email === email)) {
            return res.status(409).json({ message: 'Un agent avec cet email existe déjà.' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const newAgent = {
            _id: Date.now().toString(), // ID simple basé sur le timestamp
            nom,
            prenom,
            tel,
            email,
            password: hashedPassword,
            role: role || 'agent', // Rôle par défaut
            grades: grades || [], // Assure que c'est un tableau
            fonctions: fonctions || [] // Assure que c'est un tableau
        };
        users.push(newAgent);
        await writeJsonFile(USERS_FILE_PATH, users);
        res.status(201).json({ message: 'Agent ajouté avec succès!', agent: newAgent });
    } catch (error) {
        console.error('Erreur lors de l\'ajout de l\'agent:', error);
        res.status(500).json({ message: 'Erreur du serveur lors de l\'ajout de l\'agent.' });
    }
});

// Route pour récupérer tous les agents (avec grades et fonctions)
app.get('/api/agents', authenticateToken, authorizeAdmin, async (req, res) => {
    try {
        const users = await readJsonFile(USERS_FILE_PATH);
        const agents = users.filter(user => user.role !== 'admin'); // N'inclut pas les admins si vous voulez

        // Récupérer les grades et fonctions pour les "joindre"
        const grades = await readJsonFile(GRADES_FILE_PATH);
        const fonctions = await readJsonFile(FONCTIONS_FILE_PATH);

        const agentsWithDetails = agents.map(agent => ({
            ...agent,
            grades: agent.grades ? agent.grades.map(gradeId => grades.find(g => g._id === gradeId) || { _id: gradeId, name: 'Grade inconnu' }) : [],
            fonctions: agent.fonctions ? agent.fonctions.map(fonctionId => fonctions.find(f => f._id === fonctionId) || { _id: fonctionId, name: 'Fonction inconnue' }) : []
        }));

        res.json(agentsWithDetails);
    } catch (error) {
        console.error('Erreur lors de la récupération des agents:', error);
        res.status(500).json({ message: 'Erreur du serveur lors de la récupération des agents.' });
    }
});

// Route pour récupérer les infos d'affichage des agents (ID, nom, prénom)
app.get('/api/agents/display-info', authenticateToken, async (req, res) => {
    try {
        const users = await readJsonFile(USERS_FILE_PATH);
        const agentDisplayInfos = users.map(user => ({
            _id: user._id,
            nom: user.nom,
            prenom: user.prenom,
        }));
        res.json(agentDisplayInfos);
    } catch (error) {
        console.error('Erreur lors de la récupération des infos d\'affichage des agents:', error);
        res.status(500).json({ message: 'Erreur du serveur.' });
    }
});

// Route pour récupérer un agent par ID
app.get('/api/agents/:id', authenticateToken, authorizeAdmin, async (req, res) => {
    try {
        const users = await readJsonFile(USERS_FILE_PATH);
        const agent = users.find(u => u._id === req.params.id);
        if (!agent) {
            return res.status(404).json({ message: 'Agent non trouvé.' });
        }
        // Ne pas renvoyer le mot de passe hashé
        const { password, ...agentWithoutPassword } = agent;
        res.json(agentWithoutPassword);
    } catch (error) {
        console.error('Erreur lors de la récupération de l\'agent:', error);
        res.status(500).json({ message: 'Erreur du serveur.' });
    }
});

// Route pour mettre à jour un agent
app.put('/api/agents/:id', authenticateToken, authorizeAdmin, async (req, res) => {
    const { nom, prenom, tel, email, password, role, grades, fonctions } = req.body;
    try {
        let users = await readJsonFile(USERS_FILE_PATH);
        const agentIndex = users.findIndex(u => u._id === req.params.id);

        if (agentIndex === -1) {
            return res.status(404).json({ message: 'Agent non trouvé.' });
        }

        // Vérifier si l'email modifié existe déjà pour un autre utilisateur
        if (email && users.some((u, i) => u.email === email && i !== agentIndex)) {
            return res.status(409).json({ message: 'Cet email est déjà utilisé par un autre agent.' });
        }

        const updatedAgent = { ...users[agentIndex] };
        if (nom) updatedAgent.nom = nom;
        if (prenom) updatedAgent.prenom = prenom;
        if (tel) updatedAgent.tel = tel;
        if (email) updatedAgent.email = email;
        if (role) updatedAgent.role = role;
        if (grades) updatedAgent.grades = grades;
        if (fonctions) updatedAgent.fonctions = fonctions;

        if (password) {
            updatedAgent.password = await bcrypt.hash(password, 10);
        }

        users[agentIndex] = updatedAgent;
        await writeJsonFile(USERS_FILE_PATH, users);
        res.json({ message: 'Agent mis à jour avec succès!', agent: updatedAgent });
    } catch (error) {
        console.error('Erreur lors de la mise à jour de l\'agent:', error);
        res.status(500).json({ message: 'Erreur du serveur lors de la mise à jour de l\'agent.' });
    }
});

// Route pour supprimer un agent
app.delete('/api/agents/:id', authenticateToken, authorizeAdmin, async (req, res) => {
    try {
        let users = await readJsonFile(USERS_FILE_PATH);
        const initialLength = users.length;
        users = users.filter(u => u._id !== req.params.id);

        if (users.length === initialLength) {
            return res.status(404).json({ message: 'Agent non trouvé.' });
        }
        await writeJsonFile(USERS_FILE_PATH, users);
        res.json({ message: 'Agent supprimé avec succès!' });
    } catch (error) {
        console.error('Erreur lors de la suppression de l\'agent:', error);
        res.status(500).json({ message: 'Erreur du serveur lors de la suppression de l\'agent.' });
    }
});

// --------------------------- GESTION DES GRADES (CRUD) ---------------------------

// Route pour ajouter un grade
app.post('/api/grades', authenticateToken, authorizeAdmin, async (req, res) => {
    const { name } = req.body;
    try {
        let grades = await readJsonFile(GRADES_FILE_PATH);
        if (grades.find(g => g.name === name)) {
            return res.status(409).json({ message: 'Un grade avec ce nom existe déjà.' });
        }
        const newGrade = {
            _id: Date.now().toString(),
            name
        };
        grades.push(newGrade);
        await writeJsonFile(GRADES_FILE_PATH, grades);
        res.status(201).json({ message: 'Grade ajouté avec succès!', grade: newGrade });
    } catch (error) {
        console.error('Erreur lors de l\'ajout du grade:', error);
        res.status(500).json({ message: 'Erreur du serveur lors de l\'ajout du grade.' });
    }
});

// Route pour récupérer tous les grades
app.get('/api/grades', authenticateToken, async (req, res) => {
    try {
        const grades = await readJsonFile(GRADES_FILE_PATH);
        res.json(grades);
    } catch (error) {
        console.error('Erreur lors de la récupération des grades:', error);
        res.status(500).json({ message: 'Erreur du serveur lors de la récupération des grades.' });
    }
});

// Route pour mettre à jour un grade
app.put('/api/grades/:id', authenticateToken, authorizeAdmin, async (req, res) => {
    const { name } = req.body;
    try {
        let grades = await readJsonFile(GRADES_FILE_PATH);
        const gradeIndex = grades.findIndex(g => g._id === req.params.id);

        if (gradeIndex === -1) {
            return res.status(404).json({ message: 'Grade non trouvé.' });
        }
        if (grades.some((g, i) => g.name === name && i !== gradeIndex)) {
            return res.status(409).json({ message: 'Un autre grade avec ce nom existe déjà.' });
        }

        grades[gradeIndex].name = name;
        await writeJsonFile(GRADES_FILE_PATH, grades);
        res.json({ message: 'Grade mis à jour avec succès!', grade: grades[gradeIndex] });
    } catch (error) {
        console.error('Erreur lors de la mise à jour du grade:', error);
        res.status(500).json({ message: 'Erreur du serveur lors de la mise à jour du grade.' });
    }
});

// Route pour supprimer un grade
app.delete('/api/grades/:id', authenticateToken, authorizeAdmin, async (req, res) => {
    try {
        let grades = await readJsonFile(GRADES_FILE_PATH);
        const initialLength = grades.length;
        grades = grades.filter(g => g._id !== req.params.id);

        if (grades.length === initialLength) {
            return res.status(404).json({ message: 'Grade non trouvé.' });
        }
        await writeJsonFile(GRADES_FILE_PATH, grades);
        res.json({ message: 'Grade supprimé avec succès!' });
    } catch (error) {
        console.error('Erreur lors de la suppression du grade:', error);
        res.status(500).json({ message: 'Erreur du serveur lors de la suppression du grade.' });
    }
});


// --------------------------- GESTION DES FONCTIONS (CRUD) ---------------------------

// Route pour ajouter une fonction
app.post('/api/fonctions', authenticateToken, authorizeAdmin, async (req, res) => {
    const { name } = req.body;
    try {
        let fonctions = await readJsonFile(FONCTIONS_FILE_PATH);
        if (fonctions.find(f => f.name === name)) {
            return res.status(409).json({ message: 'Une fonction avec ce nom existe déjà.' });
        }
        const newFonction = {
            _id: Date.now().toString(),
            name
        };
        fonctions.push(newFonction);
        await writeJsonFile(FONCTIONS_FILE_PATH, fonctions);
        res.status(201).json({ message: 'Fonction ajoutée avec succès!', fonction: newFonction });
    } catch (error) {
        console.error('Erreur lors de l\'ajout de la fonction:', error);
        res.status(500).json({ message: 'Erreur du serveur lors de l\'ajout de la fonction.' });
    }
});

// Route pour récupérer toutes les fonctions
app.get('/api/fonctions', authenticateToken, async (req, res) => {
    try {
        const fonctions = await readJsonFile(FONCTIONS_FILE_PATH);
        res.json(fonctions);
    } catch (error) {
        console.error('Erreur lors de la récupération des fonctions:', error);
        res.status(500).json({ message: 'Erreur du serveur lors de la récupération des fonctions.' });
    }
});

// Route pour mettre à jour une fonction
app.put('/api/fonctions/:id', authenticateToken, authorizeAdmin, async (req, res) => {
    const { name } = req.body;
    try {
        let fonctions = await readJsonFile(FONCTIONS_FILE_PATH);
        const fonctionIndex = fonctions.findIndex(f => f._id === req.params.id);

        if (fonctionIndex === -1) {
            return res.status(404).json({ message: 'Fonction non trouvée.' });
        }
        if (fonctions.some((f, i) => f.name === name && i !== fonctionIndex)) {
            return res.status(409).json({ message: 'Une autre fonction avec ce nom existe déjà.' });
        }

        fonctions[fonctionIndex].name = name;
        await writeJsonFile(FONCTIONS_FILE_PATH, fonctions);
        res.json({ message: 'Fonction mise à jour avec succès!', fonction: fonctions[fonctionIndex] });
    } catch (error) {
        console.error('Erreur lors de la mise à jour de la fonction:', error);
        res.status(500).json({ message: 'Erreur du serveur lors de la mise à jour de la fonction.' });
    }
});

// Route pour supprimer une fonction
app.delete('/api/fonctions/:id', authenticateToken, authorizeAdmin, async (req, res) => {
    try {
        let fonctions = await readJsonFile(FONCTIONS_FILE_PATH);
        const initialLength = fonctions.length;
        fonctions = fonctions.filter(f => f._id !== req.params.id);

        if (fonctions.length === initialLength) {
            return res.status(404).json({ message: 'Fonction non trouvée.' });
        }
        await writeJsonFile(FONCTIONS_FILE_PATH, fonctions);
        res.json({ message: 'Fonction supprimée avec succès!' });
    } catch (error) {
        console.error('Erreur lors de la suppression de la fonction:', error);
        res.status(500).json({ message: 'Erreur du serveur lors de la suppression de la fonction.' });
    }
});


// --------------------------- GESTION DU PLANNING (CRUD) ---------------------------

// Fonction utilitaire pour obtenir le chemin du fichier de planning pour une semaine et un jour donnés
const getPlanningFilePath = (weekNumber, dayName) => {
    return path.join(DATA_DIR, `week-${weekNumber}`, `${dayName}.json`);
};

// Route pour récupérer le planning d'une semaine et d'un jour spécifiques
app.get('/api/planning/week/:weekNumber/day/:dayName', authenticateToken, async (req, res) => {
    const { weekNumber, dayName } = req.params;
    try {
        const filePath = getPlanningFilePath(weekNumber, dayName);
        const planningData = await readJsonFile(filePath, []);
        res.json(planningData);
    } catch (error) {
        console.error(`Erreur lors de la récupération du planning (Semaine ${weekNumber}, Jour ${dayName}):`, error);
        res.status(500).json({ message: 'Erreur du serveur lors de la récupération du planning.' });
    }
});

// Route pour mettre à jour un créneau spécifique dans le planning
app.put('/api/planning/:agentId/:weekNumber/:dayName/:slotIndex', authenticateToken, authorizeAdmin, async (req, res) => {
    const { agentId, weekNumber, dayName, slotIndex } = req.params;
    const { isOccupied } = req.body; // isOccupied doit être 0 ou 1

    try {
        const filePath = getPlanningFilePath(weekNumber, dayName);
        let planningData = await readJsonFile(filePath, []); // Récupère le planning du jour

        let agentPlanning = planningData.find(p => p.agentId === agentId);

        if (!agentPlanning) {
            // Si l'agent n'a pas encore de planning pour ce jour, le créer
            agentPlanning = { agentId, slots: Array(24).fill(0) };
            planningData.push(agentPlanning);
        }

        // Met à jour le créneau spécifique
        agentPlanning.slots[parseInt(slotIndex)] = isOccupied;

        await writeJsonFile(filePath, planningData);
        res.json({ message: 'Créneau de planning mis à jour avec succès!' });
    } catch (error) {
        console.error('Erreur lors de la mise à jour du créneau de planning:', error);
        res.status(500).json({ message: 'Erreur du serveur lors de la mise à jour du créneau de planning.' });
    }
});

// --------------------------- GESTION DE LA FEUILLE DE GARDE (ROSTER) ---------------------------

// Route pour lire la configuration de la feuille de garde
app.get('/api/roster-config', authenticateToken, async (req, res) => {
    try {
        const config = await readJsonFile(path.join(ROSTER_CONFIG_DIR, 'config.json'), { agents_per_slot: {} });
        res.json(config);
    } catch (error) {
        console.error('Erreur lors de la lecture de la config de la feuille de garde:', error);
        res.status(500).json({ message: 'Erreur serveur.' });
    }
});

// Route pour mettre à jour la configuration de la feuille de garde
app.put('/api/roster-config', authenticateToken, authorizeAdmin, async (req, res) => {
    const { agents_per_slot } = req.body;
    try {
        await writeJsonFile(path.join(ROSTER_CONFIG_DIR, 'config.json'), { agents_per_slot });
        res.json({ message: 'Configuration de la feuille de garde mise à jour.' });
    } catch (error) {
        console.error('Erreur lors de la mise à jour de la config de la feuille de garde:', error);
        res.status(500).json({ message: 'Erreur serveur.' });
    }
});

// Route pour générer la feuille de garde pour un jour donné
app.post('/api/generate-daily-roster/:weekNumber/:dayName', authenticateToken, authorizeAdmin, async (req, res) => {
    const { weekNumber, dayName } = req.params;
    try {
        const planningFilePath = getPlanningFilePath(weekNumber, dayName);
        const planningData = await readJsonFile(planningFilePath, []);
        const config = await readJsonFile(path.join(ROSTER_CONFIG_DIR, 'config.json'), { agents_per_slot: {} });
        const agents = await readJsonFile(USERS_FILE_PATH);

        const roster = {};
        const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0') + ':00');

        for (const hour of hours) {
            roster[hour] = [];
            const requiredAgents = config.agents_per_slot[hour] || 0; // Nombre d'agents requis pour ce créneau

            const availableAgents = planningData.filter(agent => agent.slots[hours.indexOf(hour)] === 1)
                .map(agent => agents.find(u => u._id === agent.agentId));

            // Filtrer les agents non trouvés (supprimés)
            const validAvailableAgents = availableAgents.filter(Boolean);

            // Si plus d'agents disponibles que nécessaire, prenez les premiers
            if (validAvailableAgents.length >= requiredAgents) {
                roster[hour] = validAvailableAgents.slice(0, requiredAgents).map(a => `${a.prenom} ${a.nom}`);
            } else {
                // Sinon, prenez tous les agents disponibles et indiquez un manque
                roster[hour] = validAvailableAgents.map(a => `${a.prenom} ${a.nom}`);
                if (requiredAgents > 0) { // N'ajouter le message de manque que si des agents étaient requis
                    roster[hour].push(`(Manque ${requiredAgents - validAvailableAgents.length} agent(s))`);
                }
            }
        }

        // Sauvegarder la feuille de garde générée
        const rosterFilePath = path.join(DAILY_ROSTER_DIR, `roster_week_${weekNumber}_day_${dayName}.json`);
        await writeJsonFile(rosterFilePath, roster);

        res.json({ message: 'Feuille de garde générée et sauvegardée.', roster });
    } catch (error) {
        console.error('Erreur lors de la génération de la feuille de garde:', error);
        res.status(500).json({ message: 'Erreur serveur lors de la génération de la feuille de garde.' });
    }
});

// Route pour lire une feuille de garde générée
app.get('/api/daily-roster/:weekNumber/:dayName', authenticateToken, async (req, res) => {
    const { weekNumber, dayName } = req.params;
    try {
        const rosterFilePath = path.join(DAILY_ROSTER_DIR, `roster_week_${weekNumber}_day_${dayName}.json`);
        const roster = await readJsonFile(rosterFilePath, {});
        res.json(roster);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return res.status(404).json({ message: 'Feuille de garde non générée pour ce jour.' });
        }
        console.error('Erreur lors de la lecture de la feuille de garde:', error);
        res.status(500).json({ message: 'Erreur serveur.' });
    }
});


app.listen(port, () => {
    console.log(`Server launched on http://localhost:${port}`);
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

// Fonction pour formater la date en-MM-DD
function formatDateToYYYYMMDD(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Route de test pour écrire dans un fichier persistant Render
app.get('/api/test-disk-write', async (req, res) => {
  try {
    const testFilePath = path.join(PERSISTENT_DIR, 'test.txt');
    const contenu = `Test de l'écriture sur disque persistant à ${new Date().toISOString()}`;
    await fs.writeFile(testFilePath, contenu, 'utf8');
    const contenuLu = await fs.readFile(testFilePath, 'utf8');
    res.status(200).send(`Écriture et lecture réussies sur le disque persistant. Contenu: ${contenuLu}`);
  } catch (err) {
    res.status(500).send(`Disk error: ${err.message}`);
  }
});