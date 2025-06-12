const API_BASE_URL = "https://dispo-pompier.onrender.com"; // <-- CORRIGÉ : L'URL de base de votre API sur Render

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
      loginButton.disabled = false; // Réactiver le bouton si la connexion échoue
      loginButton.textContent = "Se connecter"; // Rétablir le texte du bouton
      return;
    }

    // Connexion réussie
    sessionStorage.setItem('token', data.token);
    sessionStorage.setItem('agent', data.agentId);
    sessionStorage.setItem('isAdmin', data.isAdmin);
    sessionStorage.setItem('agentPrenom', data.prenom); // Stocker le prénom
    sessionStorage.setItem('agentNom', data.nom);     // Stocker le nom

    // Redirection en fonction du rôle
    if (data.isAdmin) {
      window.location.href = 'admin.html';
    } else {
      window.location.href = 'agent.html';
    }

  } catch (err) {
    console.error("Erreur lors de la connexion :", err);
    errorElement.textContent = "Une erreur est survenue lors de la connexion. Veuillez réessayer.";
  } finally {
    loginButton.disabled = false; // Réactiver le bouton même en cas d'erreur inattendue
    loginButton.textContent = "Se connecter"; // Rétablir le texte du bouton
  }
}

// Fonction pour récupérer la liste des agents au chargement de la page de connexion
document.addEventListener('DOMContentLoaded', async () => {
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

          // Vider les options existantes (sauf peut-être une option par défaut si vous en avez une)
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