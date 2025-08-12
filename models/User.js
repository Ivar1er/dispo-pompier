
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  nom: { type: String, required: true, unique: true },
  motDePasse: { type: String, required: true },
  doitChangerMotDePasse: { type: Boolean, default: true },
  resetToken: { type: String, default: null },
  resetTokenExpire: { type: Date, default: null }
});

module.exports = mongoose.model('User', userSchema);
