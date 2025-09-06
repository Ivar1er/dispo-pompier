// serveur.js

const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcryptjs'); // Pour le hachage des mots de passe
const jwt = require('jsonwebtoken'); // Pour la gestion des tokens JWT
const multer = require('multer');

const app = express();
const port = process.env.PORT || 3000;

// Configuration de multer pour la gestion des uploads
const upload = multer({ dest: 'uploads/' });

// Liste des utilisateurs temporaire, remplacée par une base de données dans une version future
const USERS = require('./data/users.json');
const AGENT_AVAILABILITY_DIR = path.join(__dirname, 'data', 'agent_availability');

// Middleware pour l'authentification avec JWT
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (token == null) return res.sendStatus(401); // Pas de token, accès non autorisé

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET || 'votre_cle_secrete_jwt', (err, user) => {
        if (err) {
            console.error('Erreur de vérification du token:', err.message);
            return res.status(403).json({ message: 'Token invalide ou expiré.' });
        }
        req.user = user;
        next();
    });
}

// Middleware pour l'autorisation des administrateurs
function authorizeAdmin(req, res, next) {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Accès refusé. Réservé aux administrateurs.' });
    }
    next();
}

// CORS: autorise localhost, 127.0.0.1, IPs LAN, et le domaine Render (HTTPS)
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

// Servir les fichiers statiques (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));


// --- Fonctions utilitaires ---
const getUserRole = (username) => {
  const user = Object.values(USERS).find(u => u.username === username);
  return user ? user.role : 'guest';
};

const getAgentIdFromUsername = (username) => {
    const user = Object.values(USERS).find(u => u.username === username);
    return user ? user.id : null;
};

// Fonction pour charger les plannings d'un agent
const loadAgentPlanningFromFiles = async (agentId) => {
    try {
        const planningFilePath = path.join(AGENT_AVAILABILITY_DIR, `${agentId}.json`);
        const data = await fs.readFile(planningFilePath, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        if (err.code === 'ENOENT') {
            console.warn(`Planning inexistant pour l'agent ${agentId}.`);
            return {};
        }
        throw err;
    }
};


// --- Routes API ---

// Route de connexion
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const user = Object.values(USERS).find(u => u.username === username);

  if (!user) {
    return res.status(400).json({ message: 'Nom d\'utilisateur ou mot de passe incorrect.' });
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    return res.status(400).json({ message: 'Nom d\'utilisateur ou mot de passe incorrect.' });
  }

  const token = jwt.sign({ 
    id: user.id, 
    username: user.username, 
    role: user.role 
  }, process.env.ACCESS_TOKEN_SECRET || 'votre_cle_secrete_jwt', { expiresIn: '1h' });

  res.status(200).json({ token, role: user.role, id: user.id });
});

// Route de déconnexion (côté client, gérée par la suppression du token)

// Route pour l'agent (pour obtenir ses infos)
app.get('/api/agent-info', authenticateToken, (req, res) => {
    const agent = USERS[req.user.id];
    if (!agent) {
        return res.status(404).json({ message: 'Agent non trouvé.' });
    }
    res.json({ 
        id: agent.id, 
        firstName: agent.firstName, 
        lastName: agent.lastName 
    });
});

// Route pour l'admin (pour obtenir ses infos)
app.get('/api/admin-info', authenticateToken, authorizeAdmin, (req, res) => {
    const admin = USERS[req.user.id];
    if (!admin) {
        return res.status(404).json({ message: 'Admin non trouvé.' });
    }
    res.json({ 
        id: admin.id, 
        firstName: admin.firstName, 
        lastName: admin.lastName 
    });
});

// Route pour obtenir le planning d'un agent
app.get('/api/planning/:agentId', authenticateToken, async (req, res) => {
    const { agentId } = req.params;
    const { week } = req.query; 
    
    // L'agent peut voir son propre planning, l'admin peut voir tout le monde
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
        res.status(500).json({ message: 'Erreur serveur lors de la récupération de tous les plannings.' });
        
    }
});


// Route de sauvegarde (création/mise à jour) du planning
app.post('/api/agent-availability/:agentId/:dateKey', authenticateToken, async (req, res) => {
    const { agentId, dateKey } = req.params;
    const { slots } = req.body;
    
    if (req.user.id !== agentId && req.user.role !== 'admin') {
        console.warn(`[AUTH] Accès écriture planning de ${agentId} refusé pour ${req.user.id} (rôle: ${req.user.role}).`);
        return res.status(403).json({ message: 'Accès refusé. Vous ne pouvez modifier que votre propre planning.' });
    }

    if (!slots || !Array.isArray(slots)) {
        return res.status(400).json({ message: 'Données de créneaux invalides.' });
    }

    try {
        const planningFilePath = path.join(AGENT_AVAILABILITY_DIR, `${agentId}.json`);
        let planning = await loadAgentPlanningFromFiles(agentId);
        
        planning[dateKey] = slots;
        
        // S'assurer que le répertoire de destination existe
        await fs.mkdir(AGENT_AVAILABILITY_DIR, { recursive: true });

        // Écrire les données mises à jour
        await fs.writeFile(planningFilePath, JSON.stringify(planning, null, 2), 'utf8');
        
        res.status(200).json({ message: 'Planning mis à jour avec succès.' });
    } catch (err) {
        console.error(`[ERREUR Serveur] Erreur de sauvegarde du planning de l'agent ${agentId}:`, err);
        res.status(500).json({ message: 'Erreur serveur lors de la sauvegarde du planning.' });
    }
});


// Route pour l'upload d'images de profil (à développer)
app.post('/api/upload-profile-image/:agentId', authenticateToken, upload.single('profileImage'), (req, res) => {
    res.status(501).json({ message: 'Endpoint non implémenté. Fonctionnalité en développement.' });
});

// Démarrer le serveur
app.listen(port, () => {
    console.log(`Serveur démarré sur http://localhost:${port}`);
});