// login.js

// URL de base de votre API, assurez-vous que cette URL est correcte
const API_BASE_URL = "https://dispo-pompier.onrender.com"; 

/**
 * Fonction principale de gestion de la connexion.
 * Gère la soumission du formulaire de connexion, l'appel à l'API et la redirection.
 */
async function login() {
  const agentSelect = document.getElementById("agent"); // Le sélecteur d'agents (liste déroulante)
  const agent = agentSelect.value.trim(); // L'ID de l'agent sélectionné
  const passwordInput = document.getElementById("password");
  const password = passwordInput.value.trim();
  const errorElement = document.getElementById("error");
  const loginButton = document.querySelector("button");

  // Réinitialise les messages d'erreur et désactive le bouton pour éviter les soumissions multiples
  errorElement.textContent = "";
  loginButton.disabled = true; 
  loginButton.textContent = "Connexion en cours..."; 

  // Validation de base des champs
  if (!agent || !password) {
    errorElement.textContent = "Veuillez sélectionner un agent et entrer un mot de passe.";
    loginButton.disabled = false; 
    loginButton.textContent = "Se connecter"; 
    return;
  }

  try {
    // Envoi de la requête de connexion à l'API
    console.log("Tentative de connexion pour l'agent:", agent);
    const response = await fetch(`${API_BASE_URL}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: agent, password: password }),
    });

    const data = await response.json();
    console.log("DEBUG Login: Réponse API /api/login:", data); 

    // Vérifie si la connexion a réussi (présence du token et des infos utilisateur)
    if (response.ok && data.token && data.user) {
      console.log("Connexion réussie. Stockage des informations de session...");
      try {
        sessionStorage.setItem("jwtToken", data.token); // Stocke le token JWT
        sessionStorage.setItem("agent", data.user.id); // Stocke l'ID de l'agent
        sessionStorage.setItem("agentPrenomNom", `${data.user.prenom} ${data.user.nom}`); // Stocke le nom complet
        sessionStorage.setItem("agentRole", data.user.role); // Stocke le rôle de l'agent
        console.log("Informations de session stockées.");

        // Redirection en fonction du rôle de l'utilisateur
        if (data.user.role === 'admin') {
          console.log("Redirection vers admin.html");
          window.location.href = 'admin.html';
        } else {
          console.log("Redirection vers agent.html");
          window.location.href = 'agent.html';
        }
      } catch (sessionStorageError) {
        console.error("Erreur lors du stockage dans sessionStorage:", sessionStorageError);
        errorElement.textContent = "Erreur interne: Impossible de sauvegarder les informations de session.";
        loginButton.disabled = false;
        loginButton.textContent = "Se connecter";
      }
    } else {
      // Afficher le message d'erreur de l'API si la connexion a échoué
      errorElement.textContent = data.message || "Erreur de connexion. Veuillez réessayer.";
      console.warn("Connexion échouée:", data.message);
      loginButton.disabled = false; 
      loginButton.textContent = "Se connecter"; 
    }
  } catch (err) {
    // Gérer les erreurs réseau ou autres exceptions inattendues
    console.error("Erreur lors de la requête de connexion :", err);
    errorElement.textContent = "Impossible de se connecter au serveur. Veuillez vérifier votre connexion.";
    loginButton.disabled = false; 
    loginButton.textContent = "Se connecter"; 
  }
}

/**
 * Charge la liste des agents depuis l'API pour remplir le sélecteur de connexion.
 * Cette fonction est appelée au chargement initial de la page.
 */
document.addEventListener("DOMContentLoaded", async () => {
  const agentSelect = document.getElementById("agent");
  const errorElement = document.getElementById("error");

  if (agentSelect) {
      try {
          // Cette route /api/agents/names est publique et ne nécessite pas de token JWT
          const response = await fetch(`${API_BASE_URL}/api/agents/names`);
          if (!response.ok) {
              throw new Error('Erreur lors du chargement de la liste des agents.');
          }
          const agents = await response.json();
          console.log("DEBUG Login: Agents chargés pour le sélecteur:", agents); 

          // Ajout de l'option par défaut
          agentSelect.innerHTML = '<option value="">-- Sélectionnez votre identifiant --</option>';

          // Remplissage du sélecteur avec les agents récupérés
          agents.forEach(user => {
              const option = document.createElement("option");
              option.value = user.id; // Utilise l'ID pour la valeur de l'option
              option.textContent = `${user.prenom || ''} ${user.nom || ''} (${user.id})`; // Affiche Prénom Nom (identifiant)
              agentSelect.appendChild(option);
          });
      } catch (err) {
          console.error("Erreur lors du chargement de la liste des agents :", err);
          if (errorElement) {
              errorElement.textContent = "Impossible de charger la liste des agents. Vérifiez la connexion au serveur.";
          }
          // Désactiver le bouton de connexion si la liste des agents ne peut pas être chargée
          const loginButton = document.querySelector("button");
          if (loginButton) {
            loginButton.disabled = true;
            loginButton.textContent = "Connexion impossible";
          }
      }
  } else {
    console.warn("Élément 'agentSelect' non trouvé. Assurez-vous que l'ID 'agent' est correct dans votre HTML.");
  }
});
