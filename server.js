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

// Répertoire persistant Render pour les plannings, les utilisateurs et les qualifications
const PERSISTENT_DIR = '/mnt/storage'; // Assurez-vous que ce répertoire est persistant sur Render
// Pour le développement local, vous pouvez utiliser :
// const PERSISTENT_DIR = process.env.NODE_ENV === 'production' ? '/mnt/storage' : path.join(__dirname, 'data');

const DATA_DIR = path.join(PERSISTENT_DIR, 'plannings');
const USERS_FILE_PATH = path.join(PERSISTENT_DIR, 'users.json');
const QUALIFICATIONS_FILE_PATH = path.join(PERSISTENT_DIR, 'qualifications.json'); // Nouveau chemin pour les qualifications

let USERS = {}; // L'objet USERS sera chargé depuis le fichier
let AVAILABLE_QUALIFICATIONS = []; // La liste des qualifications disponibles sera chargée depuis le fichier

// Mot de passe par défaut pour le premier administrateur si le fichier users.json n'existe pas
const DEFAULT_ADMIN_PASSWORD = 'supersecureadminpassword'; // À changer absolument en production !

// Fonction pour charger les utilisateurs depuis users.json
async function loadUsers() {
  try {
    const data = await fs.readFile(USERS_FILE_PATH, 'utf8');
    USERS = JSON.parse(data);
    console.log('Users loaded from', USERS_FILE_PATH);
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.warn('users.json not found. Creating default admin user.');
      // Create a default admin if the file does not exist
      const hashedDefaultPassword = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10);
      USERS = {
        admin: {
          prenom: "Admin",
          nom: "Admin",
          mdp: hashedDefaultPassword,
          role: "admin",
          qualifications: [] // Admin starts with no qualifications
        }
      };
      await saveUsers(); // Save the default admin
      console.log(`Default admin created (id: admin, mdp: ${DEFAULT_ADMIN_PASSWORD}).`);
    } else {
      console.error('Error loading users:', err);
    }
  }
}

// Fonction pour sauvegarder les utilisateurs vers users.json
async function saveUsers() {
  try {
    await fs.writeFile(USERS_FILE_PATH, JSON.stringify(USERS, null, 2), 'utf8');
    console.log('Users saved to', USERS_FILE_PATH);
  } catch (err) {
    console.error('Error saving users:', err);
  }
}

// Fonction pour charger les qualifications depuis qualifications.json
async function loadQualifications() {
  try {
    const data = await fs.readFile(QUALIFICATIONS_FILE_PATH, 'utf8');
    AVAILABLE_QUALIFICATIONS = JSON.parse(data);
    console.log('Qualifications loaded from', QUALIFICATIONS_FILE_PATH);
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.warn('qualifications.json not found. Creating default qualifications.');
      // Create some default qualifications if the file does not exist
      AVAILABLE_QUALIFICATIONS = [
        { id: 'chef-agr', name: 'Chef d\'Agrès' },
        { id: 'conducteur', name: 'Conducteur' },
        { id: 'equipier', name: 'Équipier' },
        { id: 'secouriste', name: 'Secouriste' }
      ];
      await saveQualifications(); // Save default qualifications
      console.log('Default qualifications created.');
    } else {
      console.error('Error loading qualifications:', err);
    }
  }
}

// Fonction pour sauvegarder les qualifications vers qualifications.json
async function saveQualifications() {
  try {
    await fs.writeFile(QUALIFICATIONS_FILE_PATH, JSON.stringify(AVAILABLE_QUALIFICATIONS, null, 2), 'utf8');
    console.log('Qualifications saved to', QUALIFICATIONS_FILE_PATH);
  } catch (err) {
    console.error('Error saving qualifications:', err);
  }
}

// Initialisation au démarrage du serveur
(async () => {
  await fs.mkdir(DATA_DIR, { recursive: true }).catch(console.error); // Creates the plannings folder
  await loadUsers(); // Loads users at server startup
  await loadQualifications(); // Loads qualifications at server startup
})();

// Middleware to check if the user is an administrator
// WARNING: This implementation is temporary and simplified for demonstration.
// In a production application, you should use a session system (express-session)
// or JSON Web Tokens (JWT) for secure authentication and authorization.
// For now, it's assumed the client sends an 'X-User-Role: admin' header
// after a successful admin login. This is NOT secure in production.
const authorizeAdmin = (req, res, next) => {
    const userRole = req.headers['x-user-role'];
    if (userRole === 'admin') {
        next();
    } else {
        return res.status(403).json({ message: 'Access denied. Administrator role required.' });
    }
};

// User login
app.post("/api/login", async (req, res) => {
  const { agent, mdp } = req.body;
  if (!agent || !mdp) {
    return res.status(400).json({ message: "Agent and password required" });
  }

  const user = USERS[agent.toLowerCase()];
  if (!user) {
    return res.status(401).json({ message: "Unknown agent" });
  }

  const isMatch = await bcrypt.compare(mdp, user.mdp);
  if (!isMatch) {
    return res.status(401).json({ message: "Incorrect password" });
  }

  res.json({ prenom: user.prenom, nom: user.nom, role: user.role });
});

// Read agent's planning
app.get('/api/planning/:agent', async (req, res) => {
  const agent = req.params.agent.toLowerCase();
  const filePath = path.join(DATA_DIR, `${agent}.json`);

  try {
    const data = await fs.readFile(filePath, 'utf8');
    res.json(JSON.parse(data));
  } catch (err) {
    if (err.code === 'ENOENT') {
      res.json({});
    } else {
      console.error('Error reading planning:', err);
      res.status(500).json({ message: 'Server error when reading planning' });
    }
  }
});

// Save agent's planning
app.post('/api/planning/:agent', async (req, res) => {
  const agent = req.params.agent.toLowerCase();
  const newPlanningData = req.body;

  if (typeof newPlanningData !== 'object' || newPlanningData === null) {
    return res.status(400).json({ message: 'Invalid planning data' });
  }

  const filePath = path.join(DATA_DIR, `${agent}.json`);

  try {
    let currentPlanning = {};
    try {
      const data = await fs.readFile(filePath, 'utf8');
      currentPlanning = JSON.parse(data);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }

    const mergedPlanning = { ...currentPlanning, ...newPlanningData };
    await fs.writeFile(filePath, JSON.stringify(mergedPlanning, null, 2), 'utf8');

    res.json({ message: 'Planning saved successfully' });
  } catch (err) {
    console.error('Error saving planning:', err);
    res.status(500).json({ message: 'Server error when saving planning' });
  }
});

// Get all plannings (admin)
app.get('/api/planning', async (req, res) => {
  // This route is not protected by authorizeAdmin.
  // If it is intended only for the admin, it should be.
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
    console.error('Error getting all plannings:', err);
    res.status(500).json({ message: 'Error getting plannings' });
  }
});

// --- Administration routes for agent management ---
// All these routes are protected by the authorizeAdmin middleware

// GET /api/admin/agents - Get all agents (excluding admin)
app.get('/api/admin/agents', authorizeAdmin, (req, res) => {
    const agentsList = Object.keys(USERS)
        .filter(key => USERS[key].role === 'agent') // List only users with 'agent' role
        .map(key => ({
            id: key, // Use the key from the USERS object as a unique identifier
            nom: USERS[key].nom,
            prenom: USERS[key].prenom,
            qualifications: USERS[key].qualifications || [] // Include qualifications
        }));
    res.json(agentsList);
});

// POST /api/admin/agents - Add a new agent
app.post('/api/admin/agents', authorizeAdmin, async (req, res) => {
    const { id, nom, prenom, password, qualifications } = req.body; // 'id' will be the unique identifier (e.g., username)
    if (!id || !nom || !prenom || !password) {
        return res.status(400).json({ message: 'Identifier, last name, first name and password are required.' });
    }
    const agentId = id.toLowerCase(); // Convert identifier to lowercase for consistency

    if (USERS[agentId]) {
        return res.status(409).json({ message: 'This agent identifier already exists.' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10); // Hash the password
        USERS[agentId] = {
            prenom: prenom,
            nom: nom,
            mdp: hashedPassword,
            role: 'agent', // Set the default role as 'agent'
            qualifications: qualifications || [] // Assign qualifications (empty array if not provided)
        };
        await saveUsers(); // Save changes to users.json file
        res.status(201).json({ message: 'Agent added successfully', agent: { id: agentId, nom, prenom, qualifications: USERS[agentId].qualifications } });
    } catch (error) {
        console.error("Error adding agent:", error);
        res.status(500).json({ message: 'Server error when adding agent.' });
    }
});

// PUT /api/admin/agents/:id - Modify an existing agent
app.put('/api/admin/agents/:id', authorizeAdmin, async (req, res) => {
    const agentId = req.params.id.toLowerCase();
    const { nom, prenom, newPassword, qualifications } = req.body; // Include qualifications in update

    // Check if agent exists and is not an administrator (to avoid modifying admin via this route)
    if (!USERS[agentId] || USERS[agentId].role !== 'agent') {
        return res.status(404).json({ message: 'Agent not found or not modifiable via this route.' });
    }

    // Update fields if provided
    USERS[agentId].nom = nom || USERS[agentId].nom;
    USERS[agentId].prenom = prenom || USERS[agentId].prenom;

    // Update password if a new one is provided
    if (newPassword) {
        try {
            USERS[agentId].mdp = await bcrypt.hash(newPassword, 10);
        } catch (error) {
            console.error("Password hashing error during update:", error);
            return res.status(500).json({ message: 'Error hashing new password.' });
        }
    }

    // Update qualifications if provided
    if (Array.isArray(qualifications)) {
        USERS[agentId].qualifications = qualifications;
    }

    try {
        await saveUsers(); // Save changes
        res.json({ message: 'Agent updated successfully', agent: { id: agentId, nom: USERS[agentId].nom, prenom: USERS[agentId].prenom, qualifications: USERS[agentId].qualifications } });
    } catch (error) {
        console.error("Error updating agent:", error);
        res.status(500).json({ message: 'Server error when updating agent.' });
    }
});

// DELETE /api/admin/agents/:id - Delete an agent
app.delete('/api/admin/agents/:id', authorizeAdmin, async (req, res) => {
    const agentId = req.params.id.toLowerCase();

    // Check if agent exists and is not an administrator (to avoid deleting admin)
    if (!USERS[agentId] || USERS[agentId].role !== 'agent') {
        return res.status(404).json({ message: 'Agent not found or not deletable via this route.' });
    }

    try {
        delete USERS[agentId]; // Delete the agent from the USERS object
        await saveUsers(); // Save changes

        // Also delete the agent's planning file if it exists
        const planningFilePath = path.join(DATA_DIR, `${agentId}.json`);
        try {
            await fs.unlink(planningFilePath);
            console.log(`Planning file ${agentId}.json deleted.`);
        } catch (err) {
            if (err.code === 'ENOENT') {
                console.warn(`Planning file ${agentId}.json did not exist.`);
            } else {
                console.error(`Error deleting planning file ${agentId}.json:`, err);
            }
        }

        res.json({ message: 'Agent and their planning (if existing) deleted successfully.' });
    } catch (error) {
        console.error("Error deleting agent:", error);
        res.status(500).json({ message: 'Server error when deleting agent.' });
    }
});

// GET /api/agents/names - Get agent names and first names for the login dropdown
// This route does not require authentication as it is used before login
app.get('/api/agents/names', (req, res) => {
    const agentsForDropdown = Object.keys(USERS)
        .filter(key => USERS[key].role === 'agent' || USERS[key].role === 'admin') // Include admin for the dropdown if necessary
        .map(key => ({
            id: key, // The identifier is the key (e.g., 'bruneau', 'admin')
            nom: USERS[key].nom,
            prenom: USERS[key].prenom
        }));
    res.json(agentsForDropdown);
});

// --- Qualifications Management Routes ---

// GET /api/qualifications - Get all available qualifications
// This route should be protected by authorizeAdmin if only admins can manage this list.
// If qualifications are static/global, it could be public. For now, protected.
app.get('/api/qualifications', authorizeAdmin, (req, res) => {
    res.json(AVAILABLE_QUALIFICATIONS);
});

// POST /api/qualifications - Add a new qualification
app.post('/api/qualifications', authorizeAdmin, async (req, res) => {
    const { id, name } = req.body;
    if (!id || !name) {
        return res.status(400).json({ message: 'ID and name for qualification are required.' });
    }
    const qualId = id.toLowerCase();
    if (AVAILABLE_QUALIFICATIONS.some(q => q.id === qualId)) {
        return res.status(409).json({ message: 'This qualification ID already exists.' });
    }

    AVAILABLE_QUALIFICATIONS.push({ id: qualId, name: name });
    try {
        await saveQualifications();
        res.status(201).json({ message: 'Qualification added successfully', qualification: { id: qualId, name } });
    } catch (error) {
        console.error("Error adding qualification:", error);
        res.status(500).json({ message: 'Server error when adding qualification.' });
    }
});

// PUT /api/qualifications/:id - Modify an existing qualification
app.put('/api/qualifications/:id', authorizeAdmin, async (req, res) => {
    const qualId = req.params.id.toLowerCase();
    const { name } = req.body;

    const index = AVAILABLE_QUALIFICATIONS.findIndex(q => q.id === qualId);
    if (index === -1) {
        return res.status(404).json({ message: 'Qualification not found.' });
    }

    AVAILABLE_QUALIFICATIONS[index].name = name || AVAILABLE_QUALIFICATIONS[index].name;
    try {
        await saveQualifications();
        res.json({ message: 'Qualification updated successfully', qualification: AVAILABLE_QUALIFICATIONS[index] });
    } catch (error) {
        console.error("Error updating qualification:", error);
        res.status(500).json({ message: 'Server error when updating qualification.' });
    }
});

// DELETE /api/qualifications/:id - Delete a qualification
app.delete('/api/qualifications/:id', authorizeAdmin, async (req, res) => {
    const qualId = req.params.id.toLowerCase();

    const initialLength = AVAILABLE_QUALIFICATIONS.length;
    AVAILABLE_QUALIFICATIONS = AVAILABLE_QUALIFICATIONS.filter(q => q.id !== qualId);

    if (AVAILABLE_QUALIFICATIONS.length === initialLength) {
        return res.status(404).json({ message: 'Qualification not found.' });
    }

    // Optional: Remove this qualification from all users who have it
    let usersModified = false;
    for (const userId in USERS) {
        if (USERS[userId].qualifications && USERS[userId].qualifications.includes(qualId)) {
            USERS[userId].qualifications = USERS[userId].qualifications.filter(q => q !== qualId);
            usersModified = true;
        }
    }

    try {
        await saveQualifications();
        if (usersModified) {
            await saveUsers(); // Save users if their qualifications were updated
        }
        res.json({ message: 'Qualification deleted successfully.' });
    } catch (error) {
        console.error("Error deleting qualification:", error);
        res.status(500).json({ message: 'Server error when deleting qualification.' });
    }
});


// 🔧 ROUTE DE TEST DISK RENDER (à conserver pour la vérification de persistance sur Render)
const diskTestPath = path.join(PERSISTENT_DIR, 'test.txt');

app.get('/test-disk', async (req, res) => {
  try {
    await fs.writeFile(diskTestPath, 'Test from /test-disk route');
    const contenu = await fs.readFile(diskTestPath, 'utf8');
    res.send(`Disk content: ${contenu}`);
  } catch (err) {
    res.status(500).send(`Disk error: ${err.message}`);
  }
});

app.listen(port, () => {
  console.log(`Server launched on http://localhost:${port}`);
});
