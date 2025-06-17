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
      // MODIFICATION ICI : Envoyer 'username' et 'password' au lieu de 'agent' et 'mdp'
      body: JSON.stringify({ username: agent, password: password }),
    });

    const data = await response.json();

    if (!response.ok) {
      errorElement.textContent = data.message || "Erreur lors de la connexion.";
      return; // Ne pas réactiver le bouton ici car il sera réactivé dans le finally
    }

    // Connexion réussie : stocker les informations de session
    sessionStorage.setItem("agent", agent); // Stocke l'identifiant (ex: 'bruneau', 'admin')
    sessionStorage.setItem("agentPrenom", data.prenom);
    sessionStorage.setItem("agentNom", data.nom);
    sessionStorage.setItem("userRole", data.role); // <<< NOUVEAU : Stocke le rôle de l'utilisateur
    sessionStorage.setItem("token", data.token); // Store the JWT token

    // Rediriger en fonction du rôle
    if (data.role === "admin") {
      window.location.href = "admin.html";
    } else {
      window.location.href = "agent.html";
    }
  } catch (err) {
    console.error("Erreur lors de la connexion :", err);
    errorElement.textContent = "Impossible de se connecter au serveur. Veuillez vérifier votre connexion.";
  } finally {
    // S'assure que le bouton est toujours réactivé et son texte rétabli,
    // même en cas d'erreur ou de succès.
    loginButton.disabled = false;
    loginButton.textContent = "Se connecter";
  }
}


// --- NOUVEAU : Fonction pour charger dynamiquement la liste des agents pour la liste déroulante ---
document.addEventListener("DOMContentLoaded", async () => {
  const agentSelect = document.getElementById("agent");
  const errorElement = document.getElementById("error");

  // Vérifiez si l'élément agentSelect existe avant de tenter de le manipuler
  if (agentSelect) {
      try {
          const response = await fetch(`${API_BASE_URL}/api/agents/names`);
          if (!response.ok) {
              throw new Error('Erreur lors du chargement de la liste des agents.');
          }
          const agents = await response.json();

          // Vider les options existantes (sauf peut-être une option par défaut si vous en avez une)
          agentSelect.innerHTML = '<option value="">-- Sélectionnez votre identifiant --</option>';

          agents.forEach(user => {
              const option = document.createElement("option");
              option.value = user.id; // L'identifiant est la clé de l'objet USERS (ex: 'bruneau', 'admin')
              option.textContent = `${user.prenom} ${user.nom} (${user.id})`; // Affiche Prénom Nom (identifiant)
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
