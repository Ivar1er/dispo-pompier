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
      errorElement.textContent = data.message || "Erreur lors de la connexion.";
      return; 
    }

    // Connexion réussie : stocker les informations de session
    sessionStorage.setItem("agent", agent); // Stocke l'identifiant (ex: 'bruneau', 'admin')
    sessionStorage.setItem("agentPrenom", data.prenom);
    sessionStorage.setItem("agentNom", data.nom);
    sessionStorage.setItem("userRole", data.role); // Stocke le rôle de l'utilisateur
    sessionStorage.setItem("token", data.token); // IMPORTANT : Stocke le token reçu du serveur

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


// --- Fonctions d'initialisation et d'écouteurs d'événements ---
document.addEventListener("DOMContentLoaded", async () => {
  const agentSelect = document.getElementById("agent");
  const errorElement = document.getElementById("error");
  const loginButton = document.getElementById("login-btn"); // Récupérer le bouton de connexion
  const passwordField = document.getElementById("password"); // Récupérer le champ de mot de passe

  // Désactiver temporairement le bouton de connexion tant que les agents ne sont pas chargés
  if (loginButton) {
    loginButton.disabled = true;
    loginButton.textContent = "Chargement des agents...";
  }

  // Vérifiez si l'élément agentSelect existe avant de tenter de le manipuler
  if (agentSelect) {
      try {
          // Appelle la bonne route dans server.js (maintenant accessible sans authentification)
          const response = await fetch(`${API_BASE_URL}/api/agents/display-info`);
          if (!response.ok) {
              throw new Error('Erreur lors du chargement de la liste des agents.');
          }
          const agents = await response.json();

          // Vider les options existantes et ajouter l'option par défaut
          agentSelect.innerHTML = '<option value="" disabled selected>-- Choisissez votre identifiant --</option>';

          agents.forEach(user => {
              const option = document.createElement("option");
              option.value = user.id; // L'identifiant est la clé de l'objet USERS (ex: 'bruneau', 'admin')
              option.textContent = `${user.prenom} ${user.nom} (${user.id})`; // Affiche Prénom Nom (identifiant)
              agentSelect.appendChild(option);
          });

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
    console.warn("Élément 'agentSelect' non trouvé. Assurez-vous que l'ID 'agent' est correct dans votre HTML.");
    if (loginButton) {
      loginButton.textContent = "Erreur (HTML manquant)";
    }
  }

  // Ajout de l'écouteur d'événement pour le bouton de connexion APRÈS que le DOM soit chargé
  if (loginButton) {
    loginButton.addEventListener("click", login);
  }
  
  // Permet aussi d'appuyer sur Entrée dans le champ mot de passe pour se connecter
  if (passwordField) {
    passwordField.addEventListener("keypress", function(event) {
      if (event.key === "Enter") {
        event.preventDefault(); // Empêche le comportement par défaut (soumission de formulaire)
        login(); // Appelle la fonction de connexion
      }
    });
  }
});
