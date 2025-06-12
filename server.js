const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcryptjs'); // Importation de bcryptjs

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Répertoire public
const PUBLIC_DIR = path.join(__dirname, 'public');
console.log('Dossier public:', PUBLIC_DIR);
app.use(express.static(PUBLIC_DIR));

// --- NOUVEAU : Route pour servir login.html à la racine "/" ---
// Ceci est essentiel car vous avez renommé votre index.html en login.html.
// Cette route doit venir APRÈS `express.static` et AVANT vos routes API.
app.get('/', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'login.html'));
});
// -------------------------------------------------------------

// Répertoire persistant Render pour les plannings, les utilisateurs, les qualifications, les grades et les fonctions
const PERSISTENT_DIR = '/mnt/storage'; // Assurez-vous que ce répertoire est persistant sur Render

const DATA_DIR = path.join(PERSISTENT_DIR, 'plannings');
const USERS_FILE_PATH = path.join(PERSISTENT_DIR, 'users.json');
const QUALIFICATIONS_FILE_PATH = path.join(PERSISTENT_DIR, 'qualifications.json');
const GRADES_FILE_PATH = path.join(PERSISTENT_DIR, 'grades.json'); // Nouveau chemin pour les grades
const FONCTIONS_FILE_PATH = path.join(PERSISTENT_DIR, 'fonctions.json'); // Chemin mis à jour pour les fonctions

// Nouveaux chemins pour la persistance de la feuille de garde (si utilisés ailleurs)
const ROSTER_CONFIG_DIR = path.join(PERSISTENT_DIR, 'roster_configs');
const DAILY_ROSTER_DIR = path.join(PERSISTENT_DIR, 'daily_rosters');


// Initialisation des fichiers de données persistants
async function initializePersistentFiles() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.mkdir(ROSTER_CONFIG_DIR, { recursive: true });
    await fs.mkdir(DAILY_ROSTER_DIR, { recursive: true });

    await ensureFileExists(USERS_FILE_PATH, '[]');
    await ensureFileExists(QUALIFICATIONS_FILE_PATH, '[]');
    await ensureFileExists(GRADES_FILE_PATH, '[]'); // Initialiser le fichier des grades
    await ensureFileExists(FONCTIONS_FILE_PATH, '[]'); // Initialiser le fichier des fonctions

    console.log('Fichiers persistants vérifiés et initialisés.');
  } catch (error) {
    console.error('Erreur lors de l\'initialisation des fichiers persistants:', error);
    process.exit(1); // Arrêter l'application si les fichiers critiques ne peuvent pas être créés
  }
}

async function ensureFileExists(filePath, defaultContent) {
  try {
    await fs.access(filePath);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log(`Création du fichier manquant: ${filePath}`);
      await fs.writeFile(filePath, defaultContent);
    } else {
      throw error; // Rejeter d'autres erreurs d'accès
    }
  }
}

// Fonction utilitaire pour lire le contenu d'un fichier JSON
async function readJsonFile(filePath, defaultValue = []) {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.warn(`Fichier non trouvé: ${filePath}. Retourne la valeur par défaut.`);
      return defaultValue;
    }
    console.error(`Erreur de lecture ou de parsing JSON pour ${filePath}:`, error);
    return defaultValue;
  }
}

// Fonction utilitaire pour écrire dans un fichier JSON
async function writeJsonFile(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}


// --- API Routes pour la gestion des utilisateurs (agents) ---

// Route de connexion
app.post('/api/login', async (req, res) => {
  const { agent, mdp } = req.body;
  if (!agent || !mdp) {
    return res.status(400).json({ message: 'Nom d\'agent et mot de passe requis.' });
  }

  try {
    const users = await readJsonFile(USERS_FILE_PATH);
    const user = users.find(u => u.username === agent);

    if (!user) {
      console.warn(`Tentative de connexion échouée pour l'agent: ${agent} (non trouvé)`);
      return res.status(401).json({ message: 'Agent non trouvé ou mot de passe incorrect.' });
    }

    // Comparaison du mot de passe haché
    const isMatch = await bcrypt.compare(mdp, user.password);

    if (isMatch) {
      console.log(`Connexion réussie pour l'agent: ${agent}`);
      // En production, vous utiliseriez des jetons JWT ici pour la sécurité
      res.json({ message: 'Connexion réussie', user: { username: user.username, role: user.role, qualifications: user.qualifications || [] } });
    } else {
      console.warn(`Tentative de connexion échouée pour l'agent: ${agent} (mot de passe incorrect)`);
      res.status(401).json({ message: 'Agent non trouvé ou mot de passe incorrect.' });
    }
  } catch (error) {
    console.error('Erreur lors de la connexion:', error);
    res.status(500).json({ message: 'Erreur interne du serveur lors de la connexion.' });
  }
});

// Route pour obtenir tous les utilisateurs (agents) - Utilisé pour le menu déroulant de connexion
app.get('/api/users', async (req, res) => {
  try {
    const users = await readJsonFile(USERS_FILE_PATH);
    // Retourner uniquement les noms d'utilisateur et leurs rôles (sans les mots de passe)
    res.json(users.map(u => ({ username: u.username, role: u.role, qualifications: u.qualifications || [], grade: u.grade, fonction: u.fonction })));
  } catch (error) {
    console.error('Erreur lors de la récupération des utilisateurs:', error);
    res.status(500).json({ message: 'Erreur interne du serveur lors de la récupération des utilisateurs.' });
  }
});

// Route pour l'enregistrement d'un nouvel utilisateur (administrateur seulement)
// ATTENTION: Implémentez un middleware d'authentification/autorisation pour sécuriser cette route en production
app.post('/api/register', async (req, res) => {
  const { username, password, role, qualifications = [], grade, fonction } = req.body;
  if (!username || !password || !role) {
    return res.status(400).json({ message: 'Nom d\'utilisateur, mot de passe et rôle requis.' });
  }

  try {
    let users = await readJsonFile(USERS_FILE_PATH);
    if (users.some(u => u.username === username)) {
      return res.status(409).json({ message: 'Cet agent existe déjà.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = { username, password: hashedPassword, role, qualifications, grade, fonction };
    users.push(newUser);
    await writeJsonFile(USERS_FILE_PATH, users);
    res.status(201).json({ message: 'Agent enregistré avec succès.' });
  } catch (error) {
    console.error('Erreur lors de l\'enregistrement de l\'utilisateur:', error);
    res.status(500).json({ message: 'Erreur interne du serveur lors de l\'enregistrement.' });
  }
});

// Route pour mettre à jour un utilisateur existant
app.put('/api/users/:username', async (req, res) => {
  const { username: targetUsername } = req.params;
  const { password, role, qualifications, grade, fonction } = req.body;

  try {
    let users = await readJsonFile(USERS_FILE_PATH);
    const userIndex = users.findIndex(u => u.username === targetUsername);

    if (userIndex === -1) {
      return res.status(404).json({ message: 'Agent non trouvé.' });
    }

    // Mettre à jour les champs fournis
    if (role) users[userIndex].role = role;
    if (qualifications) users[userIndex].qualifications = qualifications;
    if (grade) users[userIndex].grade = grade;
    if (fonction) users[userIndex].fonction = fonction;
    if (password) {
      users[userIndex].password = await bcrypt.hash(password, 10); // Hacher le nouveau mot de passe
    }

    await writeJsonFile(USERS_FILE_PATH, users);
    res.json({ message: 'Agent mis à jour avec succès.' });
  } catch (error) {
    console.error('Erreur lors de la mise à jour de l\'utilisateur:', error);
    res.status(500).json({ message: 'Erreur interne du serveur lors de la mise à jour.' });
  }
});


// Route pour supprimer un utilisateur
app.delete('/api/users/:username', async (req, res) => {
  const { username } = req.params;
  try {
    let users = await readJsonFile(USERS_FILE_PATH);
    const initialLength = users.length;
    users = users.filter(u => u.username !== username);
    if (users.length === initialLength) {
      return res.status(404).json({ message: 'Agent non trouvé.' });
    }
    await writeJsonFile(USERS_FILE_PATH, users);
    res.json({ message: 'Agent supprimé avec succès.' });
  } catch (error) {
    console.error('Erreur lors de la suppression de l\'utilisateur:', error);
    res.status(500).json({ message: 'Erreur interne du serveur lors de la suppression.' });
  }
});


// --- API Routes pour la gestion des Qualifications ---

// Obtenir toutes les qualifications
app.get('/api/qualifications', async (req, res) => {
  try {
    const qualifications = await readJsonFile(QUALIFICATIONS_FILE_PATH);
    res.json(qualifications);
  } catch (error) {
    console.error('Erreur lors de la récupération des qualifications:', error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

// Ajouter une qualification
app.post('/api/qualifications', async (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ message: 'Nom de qualification requis.' });
  }
  try {
    let qualifications = await readJsonFile(QUALIFICATIONS_FILE_PATH);
    if (qualifications.some(q => q.name === name)) {
      return res.status(409).json({ message: 'Cette qualification existe déjà.' });
    }
    qualifications.push({ id: Date.now(), name }); // Utiliser un ID simple pour l'exemple
    await writeJsonFile(QUALIFICATIONS_FILE_PATH, qualifications);
    res.status(201).json({ message: 'Qualification ajoutée avec succès.', qualification: { id: Date.now(), name } });
  } catch (error) {
    console.error('Erreur lors de l\'ajout de qualification:', error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

// Mettre à jour une qualification
app.put('/api/qualifications/:id', async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ message: 'Nom de qualification requis.' });
  }
  try {
    let qualifications = await readJsonFile(QUALIFICATIONS_FILE_PATH);
    const index = qualifications.findIndex(q => q.id == id); // Utiliser == pour les types différents (string/number)
    if (index === -1) {
      return res.status(404).json({ message: 'Qualification non trouvée.' });
    }
    // Vérifier si le nouveau nom existe déjà pour une autre qualification
    if (qualifications.some(q => q.name === name && q.id != id)) {
      return res.status(409).json({ message: 'Ce nom de qualification est déjà utilisé.' });
    }
    qualifications[index].name = name;
    await writeJsonFile(QUALIFICATIONS_FILE_PATH, qualifications);
    res.json({ message: 'Qualification mise à jour avec succès.', qualification: qualifications[index] });
  } catch (error) {
    console.error('Erreur lors de la mise à jour de qualification:', error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

// Supprimer une qualification
app.delete('/api/qualifications/:id', async (req, res) => {
  const { id } = req.params;
  try {
    let qualifications = await readJsonFile(QUALIFICATIONS_FILE_PATH);
    const initialLength = qualifications.length;
    qualifications = qualifications.filter(q => q.id != id);
    if (qualifications.length === initialLength) {
      return res.status(404).json({ message: 'Qualification non trouvée.' });
    }
    await writeJsonFile(QUALIFICATIONS_FILE_PATH, qualifications);
    res.json({ message: 'Qualification supprimée avec succès.' });
  } catch (error) {
    console.error('Erreur lors de la suppression de qualification:', error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});


// --- API Routes pour la gestion des Grades ---

// Obtenir tous les grades
app.get('/api/grades', async (req, res) => {
  try {
    const grades = await readJsonFile(GRADES_FILE_PATH);
    res.json(grades);
  } catch (error) {
    console.error('Erreur lors de la récupération des grades:', error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

// Ajouter un grade
app.post('/api/grades', async (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ message: 'Nom de grade requis.' });
  }
  try {
    let grades = await readJsonFile(GRADES_FILE_PATH);
    if (grades.some(g => g.name === name)) {
      return res.status(409).json({ message: 'Ce grade existe déjà.' });
    }
    grades.push({ id: Date.now(), name });
    await writeJsonFile(GRADES_FILE_PATH, grades);
    res.status(201).json({ message: 'Grade ajouté avec succès.', grade: { id: Date.now(), name } });
  } catch (error) {
    console.error('Erreur lors de l\'ajout de grade:', error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

// Mettre à jour un grade
app.put('/api/grades/:id', async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ message: 'Nom de grade requis.' });
  }
  try {
    let grades = await readJsonFile(GRADES_FILE_PATH);
    const index = grades.findIndex(g => g.id == id);
    if (index === -1) {
      return res.status(404).json({ message: 'Grade non trouvé.' });
    }
    if (grades.some(g => g.name === name && g.id != id)) {
      return res.status(409).json({ message: 'Ce nom de grade est déjà utilisé.' });
    }
    grades[index].name = name;
    await writeJsonFile(GRADES_FILE_PATH, grades);
    res.json({ message: 'Grade mis à jour avec succès.', grade: grades[index] });
  } catch (error) {
    console.error('Erreur lors de la mise à jour de grade:', error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

// Supprimer un grade
app.delete('/api/grades/:id', async (req, res) => {
  const { id } = req.params;
  try {
    let grades = await readJsonFile(GRADES_FILE_PATH);
    const initialLength = grades.length;
    grades = grades.filter(g => g.id != id);
    if (grades.length === initialLength) {
      return res.status(404).json({ message: 'Grade non trouvé.' });
    }
    await writeJsonFile(GRADES_FILE_PATH, grades);
    res.json({ message: 'Grade supprimé avec succès.' });
  } catch (error) {
    console.error('Erreur lors de la suppression de grade:', error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

// --- API Routes pour la gestion des Fonctions ---

// Obtenir toutes les fonctions
app.get('/api/fonctions', async (req, res) => {
  try {
    const fonctions = await readJsonFile(FONCTIONS_FILE_PATH);
    res.json(fonctions);
  } catch (error) {
    console.error('Erreur lors de la récupération des fonctions:', error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

// Ajouter une fonction
app.post('/api/fonctions', async (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ message: 'Nom de fonction requis.' });
  }
  try {
    let fonctions = await readJsonFile(FONCTIONS_FILE_PATH);
    if (fonctions.some(f => f.name === name)) {
      return res.status(409).json({ message: 'Cette fonction existe déjà.' });
    }
    fonctions.push({ id: Date.now(), name });
    await writeJsonFile(FONCTIONS_FILE_PATH, fonctions);
    res.status(201).json({ message: 'Fonction ajoutée avec succès.', fonction: { id: Date.now(), name } });
  } catch (error) {
    console.error('Erreur lors de l\'ajout de fonction:', error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

// Mettre à jour une fonction
app.put('/api/fonctions/:id', async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ message: 'Nom de fonction requis.' });
  }
  try {
    let fonctions = await readJsonFile(FONCTIONS_FILE_PATH);
    const index = fonctions.findIndex(f => f.id == id);
    if (index === -1) {
      return res.status(404).json({ message: 'Fonction non trouvée.' });
    }
    if (fonctions.some(f => f.name === name && f.id != id)) {
      return res.status(409).json({ message: 'Ce nom de fonction est déjà utilisé.' });
    }
    fonctions[index].name = name;
    await writeJsonFile(FONCTIONS_FILE_PATH, fonctions);
    res.json({ message: 'Fonction mise à jour avec succès.', fonction: fonctions[index] });
  } catch (error) {
    console.error('Erreur lors de la mise à jour de fonction:', error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

// Supprimer une fonction
app.delete('/api/fonctions/:id', async (req, res) => {
  const { id } = req.params;
  try {
    let fonctions = await readJsonFile(FONCTIONS_FILE_PATH);
    const initialLength = fonctions.length;
    fonctions = fonctions.filter(f => f.id != id);
    if (fonctions.length === initialLength) {
      return res.status(404).json({ message: 'Fonction non trouvée.' });
    }
    await writeJsonFile(FONCTIONS_FILE_PATH, fonctions);
    res.json({ message: 'Fonction supprimée avec succès.' });
  } catch (error) {
    console.error('Erreur lors de la suppression de fonction:', error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});


// --- API Routes pour la gestion des plannings ---

// Obtenir le planning d'une semaine spécifique pour tous les agents
app.get('/api/planning/:weekNumber/:year', async (req, res) => {
  const { weekNumber, year } = req.params;
  const fileName = `planning-${year}-W${weekNumber}.json`;
  const filePath = path.join(DATA_DIR, fileName);

  try {
    const planning = await readJsonFile(filePath, {}); // Retourne un objet vide si non trouvé
    res.json(planning);
  } catch (error) {
    console.error(`Erreur lors de la récupération du planning ${fileName}:`, error);
    res.status(500).json({ message: 'Erreur interne du serveur lors de la récupération du planning.' });
  }
});

// Enregistrer/mettre à jour le planning d'une semaine
app.post('/api/planning/:weekNumber/:year', async (req, res) => {
  const { weekNumber, year } = req.params;
  const planningData = req.body; // C'est le planning complet pour la semaine/année
  const fileName = `planning-${year}-W${weekNumber}.json`;
  const filePath = path.join(DATA_DIR, fileName);

  try {
    await writeJsonFile(filePath, planningData);
    res.status(200).json({ message: `Planning pour la semaine ${weekNumber} de ${year} enregistré avec succès.` });
  } catch (error) {
    console.error(`Erreur lors de l'enregistrement du planning ${fileName}:`, error);
    res.status(500).json({ message: 'Erreur interne du serveur lors de l\'enregistrement du planning.' });
  }
});

// Obtenir le planning d'un agent pour une semaine spécifique
app.get('/api/planning/agent/:username/:weekNumber/:year', async (req, res) => {
  const { username, weekNumber, year } = req.params;
  const fileName = `planning-${year}-W${weekNumber}.json`;
  const filePath = path.join(DATA_DIR, fileName);

  try {
    const fullPlanning = await readJsonFile(filePath, {});
    const agentPlanning = fullPlanning[username] || {}; // Obtenir le planning spécifique de l'agent
    res.json(agentPlanning);
  } catch (error) {
    console.error(`Erreur lors de la récupération du planning de l'agent ${username} pour ${fileName}:`, error);
    res.status(500).json({ message: 'Erreur interne du serveur lors de la récupération du planning de l\'agent.' });
  }
});

// Mettre à jour un slot de planning pour un agent
app.post('/api/planning/agent/:username/:weekNumber/:year/slot', async (req, res) => {
  const { username, weekNumber, year } = req.params;
  const { day, slot, value } = req.body;
  const fileName = `planning-${year}-W${weekNumber}.json`;
  const filePath = path.join(DATA_DIR, fileName);

  if (!day || slot === undefined || value === undefined) {
    return res.status(400).json({ message: 'Jour, slot et valeur sont requis.' });
  }

  try {
    let fullPlanning = await readJsonFile(filePath, {});
    if (!fullPlanning[username]) {
      fullPlanning[username] = {}; // Initialiser le planning de l'agent si inexistant
    }
    if (!fullPlanning[username][day]) {
      fullPlanning[username][day] = new Array(48).fill(0); // Initialiser les slots du jour
    }

    // Assurez-vous que le slot est un nombre valide
    const slotIndex = parseInt(slot, 10);
    if (isNaN(slotIndex) || slotIndex < 0 || slotIndex >= 48) {
      return res.status(400).json({ message: 'Numéro de slot invalide.' });
    }

    fullPlanning[username][day][slotIndex] = value;

    await writeJsonFile(filePath, fullPlanning);
    res.json({ message: 'Slot mis à jour avec succès.', newPlanning: fullPlanning[username][day] });
  } catch (error) {
    console.error(`Erreur lors de la mise à jour du slot de l'agent ${username} pour ${fileName}:`, error);
    res.status(500).json({ message: 'Erreur interne du serveur lors de la mise à jour du slot.' });
  }
});

// Route pour vider la disponibilité d'un agent pour un jour donné dans une semaine spécifique
app.post('/api/planning/agent/:username/:weekNumber/:year/clear-day', async (req, res) => {
    const { username, weekNumber, year } = req.params;
    const { day } = req.body; // Le jour à effacer (ex: 'lundi', 'mardi')

    if (!day) {
        return res.status(400).json({ message: 'Jour requis pour effacer la disponibilité.' });
    }

    const fileName = `planning-${year}-W${weekNumber}.json`;
    const filePath = path.join(DATA_DIR, fileName);

    try {
        let fullPlanning = await readJsonFile(filePath, {});

        if (fullPlanning[username] && fullPlanning[username][day]) {
            fullPlanning[username][day] = new Array(48).fill(0); // Remplir avec des 0 pour effacer
            await writeJsonFile(filePath, fullPlanning);
            res.json({ message: `Disponibilité de ${username} effacée pour ${day}.`, clearedPlanning: fullPlanning[username][day] });
        } else {
            // Si l'agent ou le jour n'existent pas, considérer comme déjà effacé
            res.status(200).json({ message: `Disponibilité de ${username} pour ${day} déjà vide ou inexistante.` });
        }
    } catch (error) {
        console.error(`Erreur lors de l'effacement de la disponibilité de l'agent ${username} pour ${day} dans ${fileName}:`, error);
        res.status(500).json({ message: 'Erreur interne du serveur lors de l\'effacement de la disponibilité.' });
    }
});


// Endpoint pour la feuille de garde

// Sauvegarder la configuration de la feuille de garde pour une semaine
app.post('/api/roster-config/:weekNumber/:year', async (req, res) => {
    const { weekNumber, year } = req.params;
    const config = req.body;
    const fileName = `roster-config-${year}-W${weekNumber}.json`;
    const filePath = path.join(ROSTER_CONFIG_DIR, fileName);
    try {
        await writeJsonFile(filePath, config);
        res.status(200).json({ message: 'Configuration de la feuille de garde sauvegardée.' });
    } catch (error) {
        console.error('Erreur lors de la sauvegarde de la configuration de la feuille de garde:', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

// Obtenir la configuration de la feuille de garde pour une semaine
app.get('/api/roster-config/:weekNumber/:year', async (req, res) => {
    const { weekNumber, year } = req.params;
    const fileName = `roster-config-${year}-W${weekNumber}.json`;
    const filePath = path.join(ROSTER_CONFIG_DIR, fileName);
    try {
        const config = await readJsonFile(filePath, {});
        res.json(config);
    } catch (error) {
        console.error('Erreur lors de la récupération de la configuration de la feuille de garde:', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

// Endpoint pour les rosters journaliers

// Sauvegarder le roster journalier
app.post('/api/daily-roster/:date', async (req, res) => {
    const { date } = req.params; // Format YYYY-MM-DD
    const roster = req.body;
    const fileName = `daily-roster-${date}.json`;
    const filePath = path.join(DAILY_ROSTER_DIR, fileName);
    try {
        await writeJsonFile(filePath, roster);
        res.status(200).json({ message: 'Roster journalier sauvegardé.' });
    } catch (error) {
        console.error('Erreur lors de la sauvegarde du roster journalier:', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

// Obtenir le roster journalier
app.get('/api/daily-roster/:date', async (req, res) => {
    const { date } = req.params; // Format YYYY-MM-DD
    const fileName = `daily-roster-${date}.json`;
    const filePath = path.join(DAILY_ROSTER_DIR, fileName);
    try {
        const roster = await readJsonFile(filePath, {});
        res.json(roster);
    } catch (error) {
        console.error('Erreur lors de la récupération du roster journalier:', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});


// Initialisation et démarrage du serveur
initializePersistentFiles().then(() => {
  app.listen(port, () => {
    console.log(`Server launched on http://localhost:${port}`);
  });
}).catch(err => {
  console.error('Failed to initialize persistent files, server not started:', err);
  process.exit(1);
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