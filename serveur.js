
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const bodyParser = require('body-parser');
const User = require('./models_User');

const app = express();
const PORT = process.env.PORT || 3000;

// Connexion MongoDB
mongoose.connect('mongodb+srv://AdminBLR:<BLRAdmin45>@cluster0.7iykxpr.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('✅ Connexion à MongoDB réussie'))
  .catch(err => console.error('❌ Erreur MongoDB :', err));

app.use(bodyParser.json());

// Route de login
app.post('/login', async (req, res) => {
  const { nom, motDePasse } = req.body;
  const user = await User.findOne({ nom });

  if (!user) return res.status(404).json({ message: 'Utilisateur inconnu' });

  const isMatch = await bcrypt.compare(motDePasse, user.motDePasse);
  if (!isMatch) return res.status(401).json({ message: 'Mot de passe incorrect' });

  res.json({
    message: 'Connexion réussie',
    doitChanger: user.doitChangerMotDePasse
  });
});

// Route pour changer le mot de passe
app.post('/change-password', async (req, res) => {
  const { nom, nouveauMotDePasse } = req.body;
  const hashedPassword = await bcrypt.hash(nouveauMotDePasse, 10);

  await User.updateOne({ nom }, {
    motDePasse: hashedPassword,
    doitChangerMotDePasse: false
  });

  res.json({ message: 'Mot de passe mis à jour' });
});

// Route de demande de réinitialisation
app.post('/forgot-password', async (req, res) => {
  const { nom } = req.body;
  const user = await User.findOne({ nom });
  if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' });

  const token = uuidv4();
  const expire = new Date(Date.now() + 1000 * 60 * 30); // 30 minutes

  user.resetToken = token;
  user.resetTokenExpire = expire;
  await user.save();

  // À ce stade tu dois envoyer un email avec un lien contenant ce token
  res.json({ message: 'Lien de réinitialisation généré', token });
});

// Route de réinitialisation avec token
app.post('/reset-password', async (req, res) => {
  const { token, nouveauMotDePasse } = req.body;

  const user = await User.findOne({
    resetToken: token,
    resetTokenExpire: { $gt: new Date() }
  });

  if (!user) return res.status(400).json({ message: 'Token invalide ou expiré' });

  const hashed = await bcrypt.hash(nouveauMotDePasse, 10);
  user.motDePasse = hashed;
  user.doitChangerMotDePasse = false;
  user.resetToken = null;
  user.resetTokenExpire = null;

  await user.save();

  res.json({ message: 'Mot de passe réinitialisé avec succès' });
});

app.listen(PORT, () => console.log(`🟢 Serveur lancé sur le port ${PORT}`));
