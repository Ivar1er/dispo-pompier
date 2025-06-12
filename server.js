// server.js
require('dotenv').config(); // AJOUTÉ : Importation et configuration de dotenv au tout début

const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken'); // Assurez-vous que cette ligne est présente

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
// Utilisation d'une variable d'environnement pour la production (Render) et un chemin local pour le développement
const PERSISTENT_DIR = process.env.NODE_ENV === 'production' ? '/mnt/storage' : path.join(__dirname, 'data');

// Créer le dossier PERSISTENT_DIR s'il n'existe pas (utile pour le développement local)
if (process.env.NODE_ENV !== 'production') {
    fs.mkdir(PERSISTENT_DIR, { recursive: true }).catch(console.error);
}

const DATA_DIR = path.join(PERSISTENT_DIR, 'plannings');
const USERS_FILE_PATH = path.join(PERSISTENT_DIR, 'users.json');
const QUALIFICATIONS_FILE_PATH = path.join(PERSISTENT_DIR, 'qualifications.json');
const GRADES_FILE_PATH = path.join(PERSISTENT_DIR, 'grades.json'); // Nouveau chemin pour les grades
const FONCTIONS_FILE_PATH = path.join(PERSISTENT_DIR, 'fonctions.json'); // Chemin mis à jour pour les fonctions

// Nouveaux chemins pour la persistance de la feuille de garde (si utilisés ailleurs)
const ROSTER_CONFIG_DIR = path.join(PERSISTENT_DIR, 'roster_configs');
const DAILY_ROSTER_DIR = path.join(PERSISTENT_DIR, 'daily_rosters');


// Middleware pour vérifier le jeton JWT (à utiliser sur les routes protégées)
const verifyToken = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) {
        return res.status(403).json({ message: 'Aucun jeton fourni.' });
    }

    // Le token est généralement envoyé au format "Bearer VOTRE_TOKEN"
    const tokenParts = token.split(' ');
    if (tokenParts.length !== 2 || tokenParts[0] !== 'Bearer') {
        return res.status(401).json({ message: 'Format du jeton invalide.' });
    }
    const actualToken = tokenParts[1];

    jwt.verify(actualToken, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            console.error("Erreur de vérification du jeton:", err);
            return res.status(401).json({ message: 'Échec de l\'authentification du jeton.' });
        }
        req.user = decoded; // Stocke les informations de l'utilisateur décodées dans req.user
        next();
    });
};

// Route de connexion
app.post('/api/login', async (req, res) => {
    const { agent, mdp } = req.body;

    try {
        const usersData = await fs.readFile(USERS_FILE_PATH, 'utf8');
        const users = JSON.parse(usersData);

        const user = users[agent];

        if (!user) {
            return res.status(400).json({ message: 'Identifiant d\'agent non trouvé.' });
        }

        const isMatch = await bcrypt.compare(mdp, user.mdp);

        if (!isMatch) {
            return res.status(400).json({ message: 'Mot de passe incorrect.' });
        }

        // Si l'authentification réussit, générer un jeton JWT
        // Assurez-vous que process.env.JWT_SECRET est défini dans vos variables d'environnement Render ou .env local
        const token = jwt.sign(
            { id: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '1h' } // Le jeton expire dans 1 heure
        );

        res.status(200).json({
            message: 'Connexion réussie',
            prenom: user.prenom,
            nom: user.nom,
            role: user.role,
            token: token // Renvoyer le jeton
        });
    } catch (error) {
        console.error("Erreur de connexion :", error);
        res.status(500).json({ message: "Erreur serveur lors de la connexion." });
    }
});


// NOUVELLE ROUTE : Pour récupérer les informations d'affichage des agents (pour la page de connexion)
// Cette route NE DOIT PAS être protégée par verifyToken car elle est nécessaire pour la connexion.
app.get('/api/agents/display-info', async (req, res) => {
    try {
        // Assurez-vous que USERS_FILE_PATH pointe vers votre fichier users.json
        const usersData = await fs.readFile(USERS_FILE_PATH, 'utf8');
        const users = JSON.parse(usersData);

        // Mapper les utilisateurs pour renvoyer seulement l'ID, le prénom et le nom
        // Exclure l'administrateur si vous ne voulez pas qu'il apparaisse dans la liste déroulante des agents réguliers
        // Ou incluez-le avec un libellé spécifique si nécessaire
        const agentsDisplayInfo = Object.keys(users)
            .filter(userId => users[userId].role !== 'admin') // Exclut l'admin de la liste des agents normaux
            .map(userId => ({
                id: userId,
                prenom: users[userId].prenom,
                nom: users[userId].nom
            }));
        
        // Optionnel : Ajouter l'administrateur séparément si nécessaire pour le select
        // Si votre 'admin' a un ID spécifique dans users.json et que vous voulez le lister
        if (users.admin && users.admin.role === 'admin') {
            agentsDisplayInfo.push({
                id: users.admin.id, // Assurez-vous que l'ID est bien 'admin'
                prenom: 'Administrateur',
                nom: '' // Le nom peut être vide ou 'Système'
            });
        }


        res.status(200).json(agentsDisplayInfo);
    } catch (error) {
        console.error("Erreur lors du chargement des agents pour l'affichage :", error);
        // Si le fichier n'existe pas encore ou est vide, renvoyer un tableau vide au lieu d'une erreur 500
        if (error.code === 'ENOENT' || error.name === 'SyntaxError') {
             return res.status(200).json([]); // Renvoyer un tableau vide si le fichier n'existe pas ou est mal formé
        }
        res.status(500).json({ message: "Erreur serveur lors de la récupération de la liste des agents." });
    }
});


// Exemple de route protégée (nécessite un jeton valide)
app.get('/api/protected-data', verifyToken, (req, res) => {
    res.json({ message: `Bienvenue, ${req.user.role} ${req.user.id}! Ceci est une donnée protégée.` });
});


// ----------------------------------------------------------------------------------------------------
// Routes de gestion des plannings (nécessitent d'être protégées par verifyToken)
// Ces routes devraient être placées APRÈS la définition de verifyToken et de la route de login
// ----------------------------------------------------------------------------------------------------

// Route pour obtenir le planning d'une semaine spécifique pour tous les agents
app.get('/api/planning/:weekNumber', verifyToken, async (req, res) => {
    const { weekNumber } = req.params;
    const filePath = path.join(DATA_DIR, `planning-${weekNumber}.json`);

    try {
        const data = await fs.readFile(filePath, 'utf8');
        res.status(200).json(JSON.parse(data));
    } catch (error) {
        // Si le fichier n'existe pas, renvoyer un objet vide
        if (error.code === 'ENOENT') {
            return res.status(200).json({});
        }
        console.error(`Erreur lors de la lecture du planning de la semaine ${weekNumber}:`, error);
        res.status(500).json({ message: "Erreur serveur lors de la récupération du planning." });
    }
});

// Route pour enregistrer le planning d'une semaine spécifique
app.post('/api/planning/:weekNumber', verifyToken, async (req, res) => {
    const { weekNumber } = req.params;
    const planning = req.body; // Le planning complet pour la semaine
    const filePath = path.join(DATA_DIR, `planning-${weekNumber}.json`);

    try {
        await fs.mkdir(DATA_DIR, { recursive: true }); // Crée le répertoire si n'existe pas
        await fs.writeFile(filePath, JSON.stringify(planning, null, 2), 'utf8');
        res.status(200).json({ message: `Planning semaine ${weekNumber} sauvegardé avec succès.` });
    } catch (error) {
        console.error(`Erreur lors de la sauvegarde du planning semaine ${weekNumber}:`, error);
        res.status(500).json({ message: "Erreur serveur lors de la sauvegarde du planning." });
    }
});


// ----------------------------------------------------------------------------------------------------
// Routes de gestion des agents (nécessitent d'être protégées par verifyToken)
// ----------------------------------------------------------------------------------------------------

// Route pour créer un nouvel agent
app.post('/api/agents', verifyToken, async (req, res) => {
    // Vérifier si l'utilisateur est un administrateur
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Accès non autorisé. Seuls les administrateurs peuvent ajouter des agents.' });
    }

    const { id, prenom, nom, mdp, qualifications = [], grades = [], fonctions = [] } = req.body;

    if (!id || !prenom || !nom || !mdp) {
        return res.status(400).json({ message: 'Tous les champs (id, prenom, nom, mdp) sont requis.' });
    }

    try {
        const usersData = await fs.readFile(USERS_FILE_PATH, 'utf8').catch(() => '{}'); // Si le fichier n'existe pas, retourne un objet vide
        const users = JSON.parse(usersData);

        if (users[id]) {
            return res.status(409).json({ message: 'Cet identifiant d\'agent existe déjà.' });
        }

        const hashedPassword = await bcrypt.hash(mdp, 10); // Hacher le mot de passe

        users[id] = {
            id,
            prenom,
            nom,
            mdp: hashedPassword,
            qualifications, // Assurez-vous que c'est un tableau
            grades,       // Nouveau: grades est un tableau d'IDs
            fonctions,    // Nouveau: fonctions est un tableau d'IDs
            role: 'agent' // Tous les nouveaux agents sont des 'agent'
        };

        await fs.writeFile(USERS_FILE_PATH, JSON.stringify(users, null, 2), 'utf8');
        res.status(201).json({ message: 'Agent ajouté avec succès.', agent: { id, prenom, nom, role: 'agent' } });

    } catch (error) {
        console.error("Erreur lors de l'ajout de l'agent :", error);
        res.status(500).json({ message: "Erreur serveur lors de l'ajout de l'agent." });
    }
});

// Route pour obtenir la liste de tous les agents (pour la gestion côté admin)
app.get('/api/agents', verifyToken, async (req, res) => {
    // Vérifier si l'utilisateur est un administrateur pour cette route aussi si nécessaire
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Accès non autorisé. Seuls les administrateurs peuvent voir la liste complète des agents.' });
    }

    try {
        const usersData = await fs.readFile(USERS_FILE_PATH, 'utf8').catch(() => '{}');
        const users = JSON.parse(usersData);

        // Exclure le mot de passe haché lors de l'envoi au client
        const agents = Object.values(users).map(user => {
            const { mdp, ...agentInfo } = user;
            return agentInfo;
        });

        res.status(200).json(agents);
    } catch (error) {
        console.error("Erreur lors de la récupération des agents :", error);
        if (error.code === 'ENOENT' || error.name === 'SyntaxError') {
             return res.status(200).json([]);
        }
        res.status(500).json({ message: "Erreur serveur lors de la récupération des agents." });
    }
});

// Route pour mettre à jour un agent
app.put('/api/agents/:id', verifyToken, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Accès non autorisé. Seuls les administrateurs peuvent modifier des agents.' });
    }

    const { id } = req.params;
    const { prenom, nom, qualifications, grades, fonctions, newPassword } = req.body; // newPassword est optionnel

    try {
        const usersData = await fs.readFile(USERS_FILE_PATH, 'utf8');
        const users = JSON.parse(usersData);

        if (!users[id]) {
            return res.status(404).json({ message: 'Agent non trouvé.' });
        }

        users[id].prenom = prenom || users[id].prenom;
        users[id].nom = nom || users[id].nom;
        users[id].qualifications = qualifications !== undefined ? qualifications : users[id].qualifications;
        users[id].grades = grades !== undefined ? grades : users[id].grades;
        users[id].fonctions = fonctions !== undefined ? fonctions : users[id].fonctions;

        if (newPassword) {
            users[id].mdp = await bcrypt.hash(newPassword, 10);
        }

        await fs.writeFile(USERS_FILE_PATH, JSON.stringify(users, null, 2), 'utf8');
        const { mdp: _, ...updatedAgentInfo } = users[id]; // Exclure le mot de passe pour la réponse
        res.status(200).json({ message: 'Agent mis à jour avec succès.', agent: updatedAgentInfo });

    } catch (error) {
        console.error(`Erreur lors de la mise à jour de l'agent ${id} :`, error);
        res.status(500).json({ message: "Erreur serveur lors de la mise à jour de l'agent." });
    }
});

// Route pour supprimer un agent
app.delete('/api/agents/:id', verifyToken, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Accès non autorisé. Seuls les administrateurs peuvent supprimer des agents.' });
    }

    const { id } = req.params;

    try {
        const usersData = await fs.readFile(USERS_FILE_PATH, 'utf8');
        const users = JSON.parse(usersData);

        if (!users[id]) {
            return res.status(404).json({ message: 'Agent non trouvé.' });
        }
        if (id === 'admin') { // Empêcher la suppression de l'administrateur
            return res.status(403).json({ message: 'La suppression du compte administrateur n\'est pas autorisée.' });
        }

        delete users[id];

        await fs.writeFile(USERS_FILE_PATH, JSON.stringify(users, null, 2), 'utf8');
        res.status(200).json({ message: 'Agent supprimé avec succès.' });

    } catch (error) {
        console.error(`Erreur lors de la suppression de l'agent ${id} :`, error);
        res.status(500).json({ message: "Erreur serveur lors de la suppression de l'agent." });
    }
});

// ----------------------------------------------------------------------------------------------------
// Routes de gestion des grades (nécessitent d'être protégées par verifyToken)
// ----------------------------------------------------------------------------------------------------

// Route pour obtenir tous les grades
app.get('/api/grades', verifyToken, async (req, res) => {
    try {
        const gradesData = await fs.readFile(GRADES_FILE_PATH, 'utf8').catch(() => '[]');
        const grades = JSON.parse(gradesData);
        res.status(200).json(grades);
    } catch (error) {
        console.error("Erreur lors de la récupération des grades :", error);
        res.status(500).json({ message: "Erreur serveur lors de la récupération des grades." });
    }
});

// Route pour ajouter un grade
app.post('/api/grades', verifyToken, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Accès non autorisé. Seuls les administrateurs peuvent gérer les grades.' });
    }
    const { id, name } = req.body;
    if (!id || !name) {
        return res.status(400).json({ message: 'L\'ID et le nom du grade sont requis.' });
    }
    try {
        const gradesData = await fs.readFile(GRADES_FILE_PATH, 'utf8').catch(() => '[]');
        const grades = JSON.parse(gradesData);
        if (grades.some(g => g.id === id)) {
            return res.status(409).json({ message: 'Un grade avec cet ID existe déjà.' });
        }
        grades.push({ id, name });
        await fs.writeFile(GRADES_FILE_PATH, JSON.stringify(grades, null, 2), 'utf8');
        res.status(201).json({ message: 'Grade ajouté avec succès.', grade: { id, name } });
    } catch (error) {
        console.error("Erreur lors de l'ajout du grade :", error);
        res.status(500).json({ message: "Erreur serveur lors de l'ajout du grade." });
    }
});

// Route pour mettre à jour un grade
app.put('/api/grades/:id', verifyToken, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Accès non autorisé. Seuls les administrateurs peuvent gérer les grades.' });
    }
    const { id } = req.params;
    const { name } = req.body;
    if (!name) {
        return res.status(400).json({ message: 'Le nom du grade est requis.' });
    }
    try {
        const gradesData = await fs.readFile(GRADES_FILE_PATH, 'utf8');
        let grades = JSON.parse(gradesData);
        const index = grades.findIndex(g => g.id === id);
        if (index === -1) {
            return res.status(404).json({ message: 'Grade non trouvé.' });
        }
        grades[index].name = name;
        await fs.writeFile(GRADES_FILE_PATH, JSON.stringify(grades, null, 2), 'utf8');
        res.status(200).json({ message: 'Grade mis à jour avec succès.', grade: grades[index] });
    } catch (error) {
        console.error("Erreur lors de la mise à jour du grade :", error);
        res.status(500).json({ message: "Erreur serveur lors de la mise à jour du grade." });
    }
});

// Route pour supprimer un grade
app.delete('/api/grades/:id', verifyToken, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Accès non autorisé. Seuls les administrateurs peuvent gérer les grades.' });
    }
    const { id } = req.params;
    try {
        const gradesData = await fs.readFile(GRADES_FILE_PATH, 'utf8');
        let grades = JSON.parse(gradesData);
        const initialLength = grades.length;
        grades = grades.filter(g => g.id !== id);
        if (grades.length === initialLength) {
            return res.status(404).json({ message: 'Grade non trouvé.' });
        }
        await fs.writeFile(GRADES_FILE_PATH, JSON.stringify(grades, null, 2), 'utf8');
        res.status(200).json({ message: 'Grade supprimé avec succès.' });
    } catch (error) {
        console.error("Erreur lors de la suppression du grade :", error);
        res.status(500).json({ message: "Erreur serveur lors de la suppression du grade." });
    }
});

// ----------------------------------------------------------------------------------------------------
// Routes de gestion des fonctions (nécessitent d'être protégées par verifyToken)
// ----------------------------------------------------------------------------------------------------

// Route pour obtenir toutes les fonctions
app.get('/api/fonctions', verifyToken, async (req, res) => {
    try {
        const fonctionsData = await fs.readFile(FONCTIONS_FILE_PATH, 'utf8').catch(() => '[]');
        const fonctions = JSON.parse(fonctionsData);
        res.status(200).json(fonctions);
    } catch (error) {
        console.error("Erreur lors de la récupération des fonctions :", error);
        res.status(500).json({ message: "Erreur serveur lors de la récupération des fonctions." });
    }
});

// Route pour ajouter une fonction
app.post('/api/fonctions', verifyToken, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Accès non autorisé. Seuls les administrateurs peuvent gérer les fonctions.' });
    }
    const { id, name } = req.body;
    if (!id || !name) {
        return res.status(400).json({ message: 'L\'ID et le nom de la fonction sont requis.' });
    }
    try {
        const fonctionsData = await fs.readFile(FONCTIONS_FILE_PATH, 'utf8').catch(() => '[]');
        const fonctions = JSON.parse(fonctionsData);
        if (fonctions.some(f => f.id === id)) {
            return res.status(409).json({ message: 'Une fonction avec cet ID existe déjà.' });
        }
        fonctions.push({ id, name });
        await fs.writeFile(FONCTIONS_FILE_PATH, JSON.stringify(fonctions, null, 2), 'utf8');
        res.status(201).json({ message: 'Fonction ajoutée avec succès.', fonction: { id, name } });
    } catch (error) {
        console.error("Erreur lors de l'ajout de la fonction :", error);
        res.status(500).json({ message: "Erreur serveur lors de l'ajout de la fonction." });
    }
});

// Route pour mettre à jour une fonction
app.put('/api/fonctions/:id', verifyToken, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Accès non autorisé. Seuls les administrateurs peuvent gérer les fonctions.' });
    }
    const { id } = req.params;
    const { name } = req.body;
    if (!name) {
        return res.status(400).json({ message: 'Le nom de la fonction est requis.' });
    }
    try {
        const fonctionsData = await fs.readFile(FONCTIONS_FILE_PATH, 'utf8');
        let fonctions = JSON.parse(fonctionsData);
        const index = fonctions.findIndex(f => f.id === id);
        if (index === -1) {
            return res.status(404).json({ message: 'Fonction non trouvée.' });
        }
        fonctions[index].name = name;
        await fs.writeFile(FONCTIONS_FILE_PATH, JSON.stringify(fonctions, null, 2), 'utf8');
        res.status(200).json({ message: 'Fonction mise à jour avec succès.', fonction: fonctions[index] });
    } catch (error) {
        console.error("Erreur lors de la mise à jour de la fonction :", error);
        res.status(500).json({ message: "Erreur serveur lors de la mise à jour de la fonction." });
    }
});

// Route pour supprimer une fonction
app.delete('/api/fonctions/:id', verifyToken, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Accès non autorisé. Seuls les administrateurs peuvent gérer les fonctions.' });
    }
    const { id } = req.params;
    try {
        const fonctionsData = await fs.readFile(FONCTIONS_FILE_PATH, 'utf8');
        let fonctions = JSON.parse(fonctionsData);
        const initialLength = fonctions.length;
        fonctions = fonctions.filter(f => f.id !== id);
        if (fonctions.length === initialLength) {
            return res.status(404).json({ message: 'Fonction non trouvée.' });
        }
        await fs.writeFile(FONCTIONS_FILE_PATH, JSON.stringify(fonctions, null, 2), 'utf8');
        res.status(200).json({ message: 'Fonction supprimée avec succès.' });
    } catch (error) {
        console.error("Erreur lors de la suppression de la fonction :", error);
        res.status(500).json({ message: "Erreur serveur lors de la suppression de la fonction." });
    }
});

// ----------------------------------------------------------------------------------------------------
// Routes pour les qualifications
// ----------------------------------------------------------------------------------------------------
// Route pour obtenir toutes les qualifications
app.get('/api/qualifications', verifyToken, async (req, res) => {
    try {
        const qualificationsData = await fs.readFile(QUALIFICATIONS_FILE_PATH, 'utf8').catch(() => '[]');
        const qualifications = JSON.parse(qualificationsData);
        res.status(200).json(qualifications);
    } catch (error) {
        console.error("Erreur lors de la récupération des qualifications :", error);
        res.status(500).json({ message: "Erreur serveur lors de la récupération des qualifications." });
    }
});

// Route pour ajouter une qualification
app.post('/api/qualifications', verifyToken, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Accès non autorisé. Seuls les administrateurs peuvent gérer les qualifications.' });
    }
    const { id, name } = req.body;
    if (!id || !name) {
        return res.status(400).json({ message: 'L\'ID et le nom de la qualification sont requis.' });
    }
    try {
        const qualificationsData = await fs.readFile(QUALIFICATIONS_FILE_PATH, 'utf8').catch(() => '[]');
        const qualifications = JSON.parse(qualificationsData);
        if (qualifications.some(q => q.id === id)) {
            return res.status(409).json({ message: 'Une qualification avec cet ID existe déjà.' });
        }
        qualifications.push({ id, name });
        await fs.writeFile(QUALIFICATIONS_FILE_PATH, JSON.stringify(qualifications, null, 2), 'utf8');
        res.status(201).json({ message: 'Qualification ajoutée avec succès.', qualification: { id, name } });
    } catch (error) {
        console.error("Erreur lors de l'ajout de la qualification :", error);
        res.status(500).json({ message: "Erreur serveur lors de l'ajout de la qualification." });
    }
});

// Route pour mettre à jour une qualification
app.put('/api/qualifications/:id', verifyToken, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Accès non autorisé. Seuls les administrateurs peuvent gérer les qualifications.' });
    }
    const { id } = req.params;
    const { name } = req.body;
    if (!name) {
        return res.status(400).json({ message: 'Le nom de la qualification est requis.' });
    }
    try {
        const qualificationsData = await fs.readFile(QUALIFICATIONS_FILE_PATH, 'utf8');
        let qualifications = JSON.parse(qualificationsData);
        const index = qualifications.findIndex(q => q.id === id);
        if (index === -1) {
            return res.status(404).json({ message: 'Qualification non trouvée.' });
        }
        qualifications[index].name = name;
        await fs.writeFile(QUALIFICATIONS_FILE_PATH, JSON.stringify(qualifications, null, 2), 'utf8');
        res.status(200).json({ message: 'Qualification mise à jour avec succès.', qualification: qualifications[index] });
    } catch (error) {
        console.error("Erreur lors de la mise à jour de la qualification :", error);
        res.status(500).json({ message: "Erreur serveur lors de la mise à jour de la qualification." });
    }
});

// Route pour supprimer une qualification
app.delete('/api/qualifications/:id', verifyToken, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Accès non autorisé. Seuls les administrateurs peuvent gérer les qualifications.' });
    }
    const { id } = req.params;
    try {
        const qualificationsData = await fs.readFile(QUALIFICATIONS_FILE_PATH, 'utf8');
        let qualifications = JSON.parse(qualificationsData);
        const initialLength = qualifications.length;
        qualifications = qualifications.filter(q => q.id !== id);
        if (qualifications.length === initialLength) {
            return res.status(404).json({ message: 'Qualification non trouvée.' });
        }
        await fs.writeFile(QUALIFICATIONS_FILE_PATH, JSON.stringify(qualifications, null, 2), 'utf8');
        res.status(200).json({ message: 'Qualification supprimée avec succès.' });
    } catch (error) {
        console.error("Erreur lors de la suppression de la qualification :", error);
        res.status(500).json({ message: "Erreur serveur lors de la suppression de la qualification." });
    }
});


// ----------------------------------------------------------------------------------------------------
// Routes pour la feuille de garde
// ----------------------------------------------------------------------------------------------------

// Route pour obtenir la configuration de la feuille de garde
app.get('/api/roster-config', verifyToken, async (req, res) => {
    const configPath = path.join(ROSTER_CONFIG_DIR, 'config.json');
    try {
        const data = await fs.readFile(configPath, 'utf8');
        res.status(200).json(JSON.parse(data));
    } catch (error) {
        if (error.code === 'ENOENT') {
            return res.status(200).json({}); // Si pas de config, renvoyer vide
        }
        console.error("Erreur lors de la récupération de la configuration de la feuille de garde :", error);
        res.status(500).json({ message: "Erreur serveur lors de la récupération de la configuration de la feuille de garde." });
    }
});

// Route pour sauvegarder la configuration de la feuille de garde
app.post('/api/roster-config', verifyToken, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Accès non autorisé. Seuls les administrateurs peuvent configurer la feuille de garde.' });
    }
    const config = req.body;
    const configPath = path.join(ROSTER_CONFIG_DIR, 'config.json');
    try {
        await fs.mkdir(ROSTER_CONFIG_DIR, { recursive: true });
        await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');
        res.status(200).json({ message: 'Configuration de la feuille de garde sauvegardée.' });
    } catch (error) {
        console.error("Erreur lors de la sauvegarde de la configuration de la feuille de garde :", error);
        res.status(500).json({ message: "Erreur serveur lors de la sauvegarde de la configuration de la feuille de garde." });
    }
});


// Route pour obtenir une feuille de garde quotidienne (peut être par date ou par weekNumber/day)
app.get('/api/daily-roster/:date', verifyToken, async (req, res) => {
    const { date } = req.params; // Format YYYY-MM-DD
    const filePath = path.join(DAILY_ROSTER_DIR, `roster-${date}.json`);
    try {
        const data = await fs.readFile(filePath, 'utf8');
        res.status(200).json(JSON.parse(data));
    } catch (error) {
        if (error.code === 'ENOENT') {
            return res.status(200).json({}); // Si pas de feuille, renvoyer vide
        }
        console.error(`Erreur lors de la récupération de la feuille de garde pour ${date} :`, error);
        res.status(500).json({ message: "Erreur serveur lors de la récupération de la feuille de garde quotidienne." });
    }
});

// Route pour sauvegarder une feuille de garde quotidienne
app.post('/api/daily-roster/:date', verifyToken, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Accès non autorisé. Seuls les administrateurs peuvent enregistrer les feuilles de garde.' });
    }
    const { date } = req.params;
    const roster = req.body;
    const filePath = path.join(DAILY_ROSTER_DIR, `roster-${date}.json`);
    try {
        await fs.mkdir(DAILY_ROSTER_DIR, { recursive: true });
        await fs.writeFile(filePath, JSON.stringify(roster, null, 2), 'utf8');
        res.status(200).json({ message: `Feuille de garde pour ${date} sauvegardée.` });
    } catch (error) {
        console.error(`Erreur lors de la sauvegarde de la feuille de garde pour ${date} :`, error);
        res.status(500).json({ message: "Erreur serveur lors de la sauvegarde de la feuille de garde quotidienne." });
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
    res.status(500).send(`Disk error: ${err.message}`);
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