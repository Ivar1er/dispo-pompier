const API_BASE_URL = "https://dispo-pompier.onrender.com"; // Assurez-vous que cette URL est correcte

async function login() {
  const agentSelect = document.getElementById("agent"); // Cet élément est la liste déroulante d'agents
  const agent = agentSelect.value.trim(); // L'identifiant (clé de l'objet USERS)
  const passwordInput = document.getElementById("password");
  const password = passwordInput.value.trim();
  const errorElement = document.getElementById("error");
  // Important : utilisez l'ID spécifique du bouton pour éviter de cibler n'importe quel bouton
  const loginButton = document.getElementById("login-btn"); 

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
      errorElement.textContent = data.message || "Erreur de connexion.";
      errorElement.style.color = "red";
      loginButton.disabled = false; // Réactiver le bouton
      loginButton.textContent = "Se connecter"; // Rétablir le texte du bouton
    } else {
      errorElement.textContent = data.message;
      errorElement.style.color = "green";

      // Stocker le jeton et les informations de l'utilisateur
      localStorage.setItem("jwtToken", data.token);
      localStorage.setItem("userRole", data.role);
      localStorage.setItem("userId", data.id);
      localStorage.setItem("userPrenom", data.prenom);
      localStorage.setItem("userNom", data.nom);

      // Rediriger vers la page d'administration après une connexion réussie
      // Pour l'instant, même les agents iront sur admin.html.
      // Vous pourrez ajouter une logique de redirection différente si vous avez une page agent.html.
      window.location.href = "admin.html";
    }
  } catch (err) {
    console.error("Erreur lors de la connexion :", err);
    errorElement.textContent = "Erreur réseau ou serveur. Veuillez réessayer.";
    errorElement.style.color = "red";
    loginButton.disabled = false; // Réactiver le bouton
    loginButton.textContent = "Se connecter"; // Rétablir le texte du bouton
  }
}

// Chargement des agents au démarrage de la page
document.addEventListener("DOMContentLoaded", async () => {
  const agentSelect = document.getElementById("agent");
  const errorElement = document.getElementById("error");
  const loginButton = document.getElementById("login-btn");

  if (agentSelect && loginButton) {
    loginButton.disabled = true; // Désactiver le bouton avant le chargement
    loginButton.textContent = "Chargement des agents...";

    try {
      // Récupérer la liste des agents pour la liste déroulante
      // Cette route n'est PAS protégée car elle est utilisée AVANT la connexion
      const response = await fetch(`${API_BASE_URL}/api/agents/display-info`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const agents = await response.json();

      // Ajouter les options à la liste déroulante
      agentSelect.innerHTML = '<option value="" disabled selected>-- Choisissez un agent --</option>'; // Réinitialiser pour éviter les doublons
      agents.forEach(agent => {
        const option = document.createElement('option');
        option.value = agent.id;
        option.textContent = `${agent.nom} ${agent.prenom}`;
        agentSelect.appendChild(option);
      });

      // Si "admin" est dans la liste, le placer en bas avec un libellé spécifique
      const adminOption = agentSelect.querySelector('option[value="admin"]');
      if (adminOption) {
          adminOption.textContent = '👨‍💼 Administrateur';
          agentSelect.appendChild(adminOption); // Le déplace à la fin
      }

      // Une fois les agents chargés, réactiver le bouton de connexion
      if (loginButton) {
        loginButton.disabled = false;
        loginButton.textContent = "Se connecter";
      }

    } catch (err) {
        console.error("Erreur lors du chargement de la liste des agents :", err);
        if (errorElement) {
            errorElement.textContent = "Impossible de charger la liste des agents. Vérifiez la connexion au serveur.";
        }
        // En cas d'erreur, le bouton reste désactivé ou affiche un message d'erreur approprié
        if (loginButton) {
          loginButton.textContent = "Erreur de chargement";
        }
    }
  } else {
    console.warn("Élément 'agentSelect' ou 'login-btn' non trouvé. Assurez-vous que les IDs sont corrects dans votre HTML.");
    if (loginButton) {
      loginButton.textContent = "Erreur (HTML manquant)";
    }
  }

  // Ajout de l'écouteur d'événement pour le bouton de connexion APRÈS que le DOM soit chargé
  if (loginButton) {
    loginButton.addEventListener("click", login);
  }
  
  // Permet aussi d'appuyer sur Entrée dans le champ mot de passe pour se connecter
  const passwordField = document.getElementById("password");
  if (passwordField) {
    passwordField.addEventListener("keypress", function(event) {
      if (event.key === "Enter") {
        event.preventDefault(); // Empêche le comportement par défaut (soumission de formulaire)
        login(); // Appelle la fonction de connexion
      }
    });
  }
});

// Fonction globale de déconnexion, appelée depuis n'importe quelle page si nécessaire
function logout() {
    localStorage.clear(); // Efface toutes les données de session (jeton, rôle, etc.)
    window.location.href = 'login.html'; // Redirige vers la page de connexion
}