// login.js

const API_BASE_URL = "https://dispo-pompier.onrender.com"; // Assurez-vous que cette URL est correcte

async function login() {
  const agentSelect = document.getElementById("agent"); // Cet élément est la liste déroulante d'agents
  const agent = agentSelect.value.trim(); // L'identifiant (clé de l'objet USERS)
  const passwordInput = document.getElementById("password");
  const password = passwordInput.value.trim();
  const errorElement = document.getElementById("error");
  const loginButton = document.querySelector("button");

  // Réinitialiser les messages d'erreur et désactiver le bouton
  errorElement.textContent = "";
  loginButton.disabled = true; // Désactiver le bouton pendant le chargement
  loginButton.textContent = "Connexion en cours..."; // Changer le texte du bouton

  if (!agent || !password) {
    errorElement.textContent = "Veuillez sélectionner un agent et entrer un mot de passe.";
    loginButton.disabled = false; // Réactiver le bouton
    loginButton.textContent = "Se connecter"; // Rétablir le texte du bouton
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: agent, password: password }),
    });

    const data = await response.json();
    console.log("DEBUG Login: Réponse API /api/login:", data); // Ajout d'un log pour voir la réponse complète

    if (!response.ok) {
      errorElement.textContent = data.message || "Erreur lors de la connexion.";
      return;
    }

    // --- MODIFICATION ICI : Utiliser data.user.id au lieu de data.user._id ---
    const userData = data.user || {}; // S'assurer que data.user existe, sinon utiliser un objet vide

    sessionStorage.setItem("agentId", userData.id || agent); // Utilise userData.id (qui vient du serveur)
    sessionStorage.setItem("agentPrenom", userData.prenom || ''); // Utilise userData.prenom
    sessionStorage.setItem("agentNom", userData.nom || '');     // Utilise userData.nom
    sessionStorage.setItem("userRole", userData.role || '');   // Utilise userData.role
    sessionStorage.setItem("token", data.token); // Le token est au niveau racine de la réponse

    // Rediriger en fonction du rôle
    if (userData.role === "admin") { // Redirection basée sur userData.role
      window.location.href = "admin.html";
    } else {
      window.location.href = "agent.html";
    }
  } catch (err) {
    console.error("Erreur lors de la connexion :", err);
    errorElement.textContent = "Impossible de se connecter au serveur. Veuillez vérifier votre connexion.";
  } finally {
    loginButton.disabled = false;
    loginButton.textContent = "Se connecter";
  }
}


// --- Fonction pour charger dynamiquement la liste des agents pour la liste déroulante ---
document.addEventListener("DOMContentLoaded", async () => {
  const agentSelect = document.getElementById("agent");
  const errorElement = document.getElementById("error");

  if (agentSelect) {
      try {
          const response = await fetch(`${API_BASE_URL}/api/agents/names`);
          if (!response.ok) {
              throw new Error('Erreur lors du chargement de la liste des agents.');
          }
          const agents = await response.json();
          console.log("DEBUG Login: Agents chargés pour le sélecteur:", agents); // Log pour voir la structure des agents

          agentSelect.innerHTML = '<option value="">-- Sélectionnez votre identifiant --</option>';

          agents.forEach(user => {
              const option = document.createElement("option");
              // Utilisation de user.id pour correspondre à l'ID retourné par le serveur
              option.value = user.id;
              option.textContent = `${user.prenom || ''} ${user.nom || ''} (${user.id})`; // Affiche Prénom Nom (identifiant)
              agentSelect.appendChild(option);
          });
      } catch (err) {
          console.error("Erreur lors du chargement de la liste des agents :", err);
          if (errorElement) {
              errorElement.textContent = "Impossible de charger la liste des agents. Vérifiez la connexion au serveur.";
          }
      }
  } else {
    console.warn("Élément 'agentSelect' non trouvé. Assurez-vous que l'ID 'agent' est correct dans votre HTML.");
  }
});