const API_BASE_URL = ""; // Ancien: "https://dispo-pompier.onrender.com"

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
      body: JSON.stringify({ agent, mdp: password }),
    });

    const data = await response.json();

    if (!response.ok) {
      errorElement.textContent = data.message || "Erreur lors de la connexion.";
      return;
    }

    // Connexion réussie
    sessionStorage.setItem("jwtToken", data.token); // Stocker le token JWT
    sessionStorage.setItem("agent", data.agentId); // Stocker l'identifiant de l'agent
    sessionStorage.setItem("isAdmin", data.isAdmin); // Stocker le statut admin

    if (data.isAdmin) {
      window.location.href = "admin.html"; // Rediriger vers la page admin
    } else {
      window.location.href = "agent.html"; // Rediriger vers la page agent
    }
  } catch (err) {
    console.error("Erreur de connexion :", err);
    errorElement.textContent = "Erreur de connexion. Veuillez réessayer plus tard.";
  } finally {
    loginButton.disabled = false; // Réactiver le bouton
    loginButton.textContent = "Se connecter"; // Rétablir le texte du bouton
  }
}

// Chargement de la liste des agents au chargement de la page
document.addEventListener("DOMContentLoaded", async () => {
  const agentSelect = document.getElementById("agent");
  const errorElement = document.getElementById("error");

  // Vérifiez si l'élément agentSelect existe avant de tenter de le manipuler
  if (agentSelect) {
      try {
          // MODIFICATION : Appelle la bonne route dans server.js (maintenant accessible sans authentification)
          const response = await fetch(`${API_BASE_URL}/api/agents/display-info`);
          if (!response.ok) {
              throw new Error('Erreur lors du chargement de la liste des agents.');
          }
          const agents = await response.json();

          // Vider les options existantes (sauf l'option par défaut)
          // Laisser l'option "-- Choisissez un agent --" si elle est présente
          agentSelect.innerHTML = '<option value="" disabled selected>-- Choisissez un agent --</option>';

          // Ajouter les agents récupérés de l'API
          agents.forEach(user => {
              const option = document.createElement("option");
              option.value = user.id; // L'identifiant est la clé de l'objet USERS (ex: 'bruneau', 'admin')
              option.textContent = `${user.prenom} ${user.nom} (${user.id})`; // Affiche Prénom Nom (identifiant)
              agentSelect.appendChild(option);
          });
          
          // Note: Si l'admin n'est pas inclus dans /api/agents/display-info par défaut, vous pouvez l'ajouter ici:
          // Exemple: (Décommenter si nécessaire et si l'admin n'est pas renvoyé par display-info)
          /*
          const adminOption = document.createElement("option");
          adminOption.value = "admin";
          adminOption.textContent = "👨‍💼 Administrateur (admin)"; // Texte explicite pour l'admin
          agentSelect.appendChild(adminOption);
          */

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