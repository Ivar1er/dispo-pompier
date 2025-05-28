const express = require("express");
const cors = require("cors");
const fs = require('fs').promises;
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;


app.use(cors());
app.use(express.json());

// Répertoire public
const PUBLIC_DIR = path.join(__dirname, 'public');
console.log('Dossier public:', PUBLIC_DIR);
app.use(express.static(PUBLIC_DIR));

// Répertoire des fichiers de planning (avec "s")
const DATA_DIR = path.join(__dirname, 'plannings');
fs.mkdir(DATA_DIR, { recursive: true }).catch(console.error);

// Liste des utilisateurs
const USERS = {
  bruneau: { prenom: "Mathieu", nom: "Bruneau", mdp: "aaa" },
  vatinel: { prenom: "Sébastien", nom: "Vatinel", mdp: "aaa" },
  gesbert: { prenom: "Jonathan", nom: "Gesbert", mdp: "aaa" },
  tuleu: { prenom: "Kévin", nom: "Tuleu", mdp: "aaa" },
  lelann: { prenom: "Philippe", nom: "LeLann", mdp: "aaa" },
  cordel: { prenom: "Camilla", nom: "Cordel", mdp: "aaa" },
  boudet: { prenom: "Sébastien", nom: "Boudet", mdp: "aaa" },
  boulmé: { prenom: "Grégoire", nom: "Boulmé", mdp: "aaa" },
  maréchal: { prenom: "Nicolas", nom: "Maréchal", mdp: "aaa" },
  justice: { prenom: "Quentin", nom: "Justice", mdp: "aaa" },
  veniant: { prenom: "Mathis", nom: "Veniant", mdp: "aaa" },
  normand: { prenom: "Stéphane", nom: "Normand", mdp: "aaa" },
  schaeffer: { prenom: "Caroline", nom: "Schaeffer", mdp: "aaa" },
  boulet: { prenom: "Aurélie", nom: "Boulet", mdp: "aaa" },
  charenton: { prenom: "Marilou", nom: "Charenton", mdp: "aaa" },
  hérédia: { prenom: "Jules", nom: "Hérédia", mdp: "aaa" },
  loisel: { prenom: "Charlotte", nom: "Loisel", mdp: "aaa" },
  mailly: { prenom: "Lucile", nom: "Mailly", mdp: "aaa" },
  marlin: { prenom: "Lilian", nom: "Marlin", mdp: "aaa" },
  savigny: { prenom: "Victoria", nom: "Savigny", mdp: "aaa" },
  tinseau: { prenom: "Clément", nom: "Tinseau", mdp: "aaa" },
  admin: { prenom: "Admin", nom: "Admin", mdp: "aaa" }
};

// Connexion utilisateur
app.post("/api/login", (req, res) => {
  const { agent, mdp } = req.body;
  if (!agent || !mdp) {
    return res.status(400).json({ message: "Agent et mot de passe requis" });
  }
  const user = USERS[agent.toLowerCase()];
  if (!user) return res.status(401).json({ message: "Agent inconnu" });
  if (user.mdp !== mdp) return res.status(401).json({ message: "Mot de passe incorrect" });

  res.json({ prenom: user.prenom, nom: user.nom });
});

// Lire le planning d’un agent complet (toutes les semaines)
app.get('/api/planning/:agent', async (req, res) => {
  const agent = req.params.agent.toLowerCase();
  const filePath = path.join(DATA_DIR, `${agent}.json`);

  try {
    const data = await fs.readFile(filePath, 'utf8');
    res.json(JSON.parse(data));
  } catch (err) {
    if (err.code === 'ENOENT') {
      res.json({});  // Pas de planning existant
    } else {
      res.status(500).json({ message: 'Erreur serveur lors de la lecture du planning' });
    }
  }
});

// Sauvegarde complète du planning d’un agent (toutes les semaines) avec fusion des données existantes
app.post('/api/planning/:agent', async (req, res) => {
  const agent = req.params.agent.toLowerCase();
  const newPlanningData = req.body;

  if (typeof newPlanningData !== 'object' || newPlanningData === null) {
    return res.status(400).json({ message: 'Données de planning invalides' });
  }

  const filePath = path.join(DATA_DIR, `${agent}.json`);

  try {
    // Lire planning actuel (ou vide)
    let currentPlanning = {};
    try {
      const data = await fs.readFile(filePath, 'utf8');
      currentPlanning = JSON.parse(data);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }

    // Fusionner les données (nouveau planning remplace ou ajoute)
    const mergedPlanning = { ...currentPlanning, ...newPlanningData };

    // Écrire planning complet fusionné
    await fs.writeFile(filePath, JSON.stringify(mergedPlanning, null, 2), 'utf8');

    res.json({ message: 'Planning enregistré avec succès' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur lors de la sauvegarde du planning' });
  }
});

// Route ADMIN : récupérer tous les plannings
app.get('/api/planning', async (req, res) => {
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
    res.status(500).json({ message: 'Erreur lors de la récupération des plannings' });
  }
});

app.listen(port, () => {
  console.log(`Serveur lancé sur http://localhost:${port}`);
});
