const express = require("express");
const cors = require("cors");
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

// Répertoire persistant Render pour les plannings et les utilisateurs
const PERSISTENT_DIR = '/mnt/storage'; // Assurez-vous que ce répertoire est persistant sur Render
// Pour le développement local, vous pouvez utiliser :
// const PERSISTENT_DIR = process.env.NODE_ENV === 'production' ? '/mnt/storage' : path.join(__dirname, 'data');

const DATA_DIR = path.join(PERSISTENT_DIR, 'plannings');
const USERS_FILE_PATH = path.join(PERSISTENT_DIR, 'users.json');

let USERS = {}; // L'objet USERS sera chargé depuis le fichier

// Mot de passe par défaut pour le premier administrateur si le fichier users.json n'existe pas
const DEFAULT_ADMIN_PASSWORD = 'supersecureadminpassword'; // À changer absolument en production !

// Fonction pour charger les utilisateurs depuis users.json
async function loadUsers() {
  try {
    const data = await fs.readFile(USERS_FILE_PATH, 'utf8');
    USERS = JSON.parse(data);
    console.log('Utilisateurs chargés depuis', USERS_FILE_PATH);
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.warn('Fichier users.json non trouvé. Création du fichier avec un administrateur par défaut.');
      // Créer un administrateur par défaut si le fichier n'existe pas
      const hashedDefaultPassword = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10);
      USERS = {
        admin: {
          prenom: "Admin",
          nom: "Admin",
          mdp: hashedDefaultPassword,
          role: "admin"
        }
      };
      await saveUsers(); // Sauvegarder l'administrateur par défaut
      console.log(`Administrateur par défaut créé (id: admin, mdp: ${DEFAULT_ADMIN_PASSWORD}).`);
    } else {
      console.error('Erreur lors du chargement des utilisateurs:', err);
    }
  }
}

// Fonction pour sauvegarder les utilisateurs vers users.json
async function saveUsers() {
  try {
    await fs.writeFile(USERS_FILE_PATH, JSON.stringify(USERS, null, 2), 'utf8');
    console.log('Utilisateurs sauvegardés vers', USERS_FILE_PATH);
  } catch (err) {
    console.error('Erreur lors de la sauvegarde des utilisateurs:', err);
  }
}

// Initialisation au démarrage du serveur
(async () => {
  await fs.mkdir(DATA_DIR, { recursive: true }).catch(console.error); // Crée le dossier des plannings
  await loadUsers(); // Charge les utilisateurs au démarrage du serveur
})();

// Middleware pour vérifier si l'utilisateur est administrateur
// ATTENTION: Cette implémentation est temporaire et simplifiée pour la démonstration.
// Dans une application de production, vous devriez utiliser un système de session (express-session)
// ou des JSON Web Tokens (JWT) pour une authentification et autorisation sécurisées.
// Pour l'instant, on suppose que le client envoie un en-tête 'X-User-Role: admin'
// après une connexion réussie d'un admin. Ce n'est PAS sécurisé en production.
const authorizeAdmin = (req, res, next) => {
    // Si vous implémentez express-session, ce serait:
    // if (req.session && req.session.user && req.session.user.role === 'admin') {
    //     next();
    // } else {
    //     res.status(403).json({ message: 'Accès interdit. Rôle administrateur requis.' });
    // }

    // Implémentation temporaire (NON SÉCURISÉE pour la production)
    const userRole = req.headers['x-user-role'];
    if (userRole === 'admin') {
        next();
    } else {
        return res.status(403).json({ message: 'Accès interdit. Rôle administrateur requis.' });
    }
};


// Connexion utilisateur
app.post("/api/login", async (req, res) => { // La fonction doit être async pour bcrypt.compare
  const { agent, mdp } = req.body; // 'agent' est l'identifiant (clé de l'objet USERS)
  if (!agent || !mdp) {
    return res.status(400).json({ message: "Agent et mot de passe requis" });
  }

  const user = USERS[agent.toLowerCase()];
  if (!user) {
    return res.status(401).json({ message: "Agent inconnu" });
  }

  // Comparaison du mot de passe haché
  const isMatch = await bcrypt.compare(mdp, user.mdp);
  if (!isMatch) {
    return res.status(401).json({ message: "Mot de passe incorrect" });
  }

  // Si tout est bon, renvoyer les informations de l'utilisateur, y compris son rôle
  res.json({ prenom: user.prenom, nom: user.nom, role: user.role });
});

// Lire le planning d’un agent
app.get('/api/planning/:agent', async (req, res) => {
  const agent = req.params.agent.toLowerCase();
  const filePath = path.join(DATA_DIR, `${agent}.json`);

  try {
    const data = await fs.readFile(filePath, 'utf8');
    res.json(JSON.parse(data));
  } catch (err) {
    if (err.code === 'ENOENT') {
      res.json({}); // Retourne un objet vide si le planning n'existe pas encore
    } else {
      console.error('Erreur lors de la lecture du planning:', err);
      res.status(500).json({ message: 'Erreur serveur lors de la lecture du planning' });
    }
  }
});

// Sauvegarder le planning d’un agent
app.post('/api/planning/:agent', async (req, res) => {
  const agent = req.params.agent.toLowerCase();
  const newPlanningData = req.body;

  if (typeof newPlanningData !== 'object' || newPlanningData === null) {
    return res.status(400).json({ message: 'Données de planning invalides' });
  }

  const filePath = path.join(DATA_DIR, `${agent}.json`);

  try {
    let currentPlanning = {};
    try {
      const data = await fs.readFile(filePath, 'utf8');
      currentPlanning = JSON.parse(data);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err; // Lève l'erreur si ce n'est pas "fichier non trouvé"
    }

    const mergedPlanning = { ...currentPlanning, ...newPlanningData };
    await fs.writeFile(filePath, JSON.stringify(mergedPlanning, null, 2), 'utf8');

    res.json({ message: 'Planning enregistré avec succès' });
  } catch (err) {
    console.error('Erreur lors de la sauvegarde du planning:', err);
    res.status(500).json({ message: 'Erreur serveur lors de la sauvegarde du planning' });
  }
});

// Récupérer tous les plannings (admin)
app.get('/api/planning', async (req, res) => {
  // Cette route n'est pas protégée par authorizeAdmin.
  // Si elle est destinée uniquement à l'admin, elle devrait l'être.
  try {
    const files = await fs.readdir(DATA_DIR);
    const allPlannings = {};

    for (const file of files) {
      if (file.endsWith('.json')) {
        const agent = path.basename(file, '.json');
        const content = await fs.readFile(path.join(DATA_DIR, file), 'utf8');
        allPlannings[agent] = JSON.parse(content);
      }
    }

    res.json(allPlannings);
  } catch (err) {
    console.error('Erreur lors de la récupération de tous les plannings:', err);
    res.status(500).json({ message: 'Erreur lors de la récupération des plannings' });
  }
});

// --- Routes d'administration pour la gestion des agents ---
// Toutes ces routes sont protégées par le middleware authorizeAdmin

// GET /api/admin/agents - Récupérer tous les agents (sauf admin)
app.get('/api/admin/agents', authorizeAdmin, (req, res) => {
    const agentsList = Object.keys(USERS)
        .filter(key => USERS[key].role === 'agent') // Ne lister que les utilisateurs avec le rôle 'agent'
        .map(key => ({
            id: key, // Utiliser la clé de l'objet USERS comme identifiant unique
            nom: USERS[key].nom,
            prenom: USERS[key].prenom
        }));
    res.json(agentsList);
});

// POST /api/admin/agents - Ajouter un nouvel agent
app.post('/api/admin/agents', authorizeAdmin, async (req, res) => {
    const { id, nom, prenom, password } = req.body; // 'id' sera l'identifiant unique (ex: nom d'utilisateur)
    if (!id || !nom || !prenom || !password) {
        return res.status(400).json({ message: 'Identifiant, nom, prénom et mot de passe sont requis.' });
    }
    const agentId = id.toLowerCase(); // Convertir l'identifiant en minuscules pour la cohérence

    if (USERS[agentId]) {
        return res.status(409).json({ message: 'Cet identifiant d\'agent existe déjà.' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10); // Hacher le mot de passe
        USERS[agentId] = {
            prenom: prenom,
            nom: nom,
            mdp: hashedPassword,
            role: 'agent' // Définir le rôle par défaut comme 'agent'
        };
        await saveUsers(); // Sauvegarder les modifications dans le fichier users.json
        res.status(201).json({ message: 'Agent ajouté avec succès', agent: { id: agentId, nom, prenom } });
    } catch (error) {
        console.error("Erreur lors de l'ajout de l'agent:", error);
        res.status(500).json({ message: 'Erreur serveur lors de l\'ajout de l\'agent.' });
    }
});

// PUT /api/admin/agents/:id - Modifier un agent existant
app.put('/api/admin/agents/:id', authorizeAdmin, async (req, res) => {
    const agentId = req.params.id.toLowerCase();
    const { nom, prenom, newPassword } = req.body;

    // Vérifier si l'agent existe et n'est pas un administrateur (pour éviter de modifier l'admin par cette route)
    if (!USERS[agentId] || USERS[agentId].role !== 'agent') {
        return res.status(404).json({ message: 'Agent non trouvé ou non modifiable via cette route.' });
    }

    // Mettre à jour les champs si fournis
    USERS[agentId].nom = nom || USERS[agentId].nom;
    USERS[agentId].prenom = prenom || USERS[agentId].prenom;

    // Mettre à jour le mot de passe si un nouveau est fourni
    if (newPassword) {
        try {
            USERS[agentId].mdp = await bcrypt.hash(newPassword, 10);
        } catch (error) {
            console.error("Erreur de hachage du mot de passe lors de la mise à jour:", error);
            return res.status(500).json({ message: 'Erreur lors du hachage du nouveau mot de passe.' });
        }
    }

    try {
        await saveUsers(); // Sauvegarder les modifications
        res.json({ message: 'Agent mis à jour avec succès', agent: { id: agentId, nom: USERS[agentId].nom, prenom: USERS[agentId].prenom } });
    } catch (error) {
        console.error("Erreur lors de la mise à jour de l'agent:", error);
        res.status(500).json({ message: 'Erreur serveur lors de la mise à jour de l\'agent.' });
    }
});

// DELETE /api/admin/agents/:id - Supprimer un agent
app.delete('/api/admin/agents/:id', authorizeAdmin, async (req, res) => {
    const agentId = req.params.id.toLowerCase();

    // Vérifier si l'agent existe et n'est pas un administrateur (pour éviter de supprimer l'admin)
    if (!USERS[agentId] || USERS[agentId].role !== 'agent') {
        return res.status(404).json({ message: 'Agent non trouvé ou non supprimable via cette route.' });
    }

    try {
        delete USERS[agentId]; // Supprimer l'agent de l'objet USERS
        await saveUsers(); // Sauvegarder les modifications

        // Supprimer également le fichier de planning de l'agent si existant
        const planningFilePath = path.join(DATA_DIR, `${agentId}.json`);
        try {
            await fs.unlink(planningFilePath);
            console.log(`Fichier de planning ${agentId}.json supprimé.`);
        } catch (err) {
            if (err.code === 'ENOENT') {
                console.warn(`Le fichier de planning ${agentId}.json n'existait pas.`);
            } else {
                console.error(`Erreur lors de la suppression du fichier de planning ${agentId}.json:`, err);
            }
        }

        res.json({ message: 'Agent et son planning (si existant) supprimés avec succès.' });
    } catch (error) {
        console.error("Erreur lors de la suppression de l'agent:", error);
        res.status(500).json({ message: 'Erreur serveur lors de la suppression de l\'agent.' });
    }
});

// GET /api/agents/names - Récupérer les noms et prénoms des agents pour la liste déroulante de connexion
// Cette route ne nécessite pas d'authentification car elle est utilisée avant la connexion
app.get('/api/agents/names', (req, res) => {
    const agentsForDropdown = Object.keys(USERS)
        .filter(key => USERS[key].role === 'agent' || USERS[key].role === 'admin') // Inclure admin pour la liste déroulante si nécessaire
        .map(key => ({
            id: key, // L'identifiant est la clé (ex: 'bruneau', 'admin')
            nom: USERS[key].nom,
            prenom: USERS[key].prenom
        }));
    res.json(agentsForDropdown);
});


// 🔧 ROUTE DE TEST DISK RENDER (à conserver pour la vérification de persistance sur Render)
const diskTestPath = path.join(PERSISTENT_DIR, 'test.txt');

app.get('/test-disk', async (req, res) => {
  try {
    await fs.writeFile(diskTestPath, 'Test depuis la route /test-disk');
    const contenu = await fs.readFile(diskTestPath, 'utf8');
    res.send(`Contenu du disque : ${contenu}`);
  } catch (err) {
    res.status(500).send(`Erreur disque : ${err.message}`);
  }
});

app.listen(port, () => {
  console.log(`Serveur lancé sur http://localhost:${port}`);
});