// login.js

// URL de base de votre API, assurez-vous que cette URL est correcte
const API_BASE_URL = "https://dispo-pompier.onrender.com";

// Références DOM globales pour la page de connexion
const agentSelect = document.getElementById("agent");
const passwordInput = document.getElementById("password");
const errorElement = document.getElementById("error");
const loginButton = document.getElementById("login-button"); // Référence au bouton de connexion par son ID
const loadingSpinnerLogin = document.getElementById("loading-spinner-login"); // Référence au spinner spécifique à la page de connexion


/**
 * Affiche ou masque le spinner de chargement de la page de connexion.
 * @param {boolean} isLoading - True pour afficher, false pour masquer.
 */
function showLoginSpinner(isLoading) {
    if (loadingSpinnerLogin) {
        loadingSpinnerLogin.classList.toggle("hidden", !isLoading);
        // Désactiver/réactiver les éléments de formulaire et le bouton pendant le chargement
        if (agentSelect) agentSelect.disabled = isLoading;
        if (passwordInput) passwordInput.disabled = isLoading;
        if (loginButton) loginButton.disabled = isLoading;
    }
}


/**
 * Fonction principale de gestion de la connexion.
 * Gère la soumission du formulaire de connexion, l'appel à l'API et la redirection.
 */
async function login() {
  const agent = agentSelect.value.trim(); // L'ID de l'agent sélectionné
  const password = passwordInput.value.trim();

  // Réinitialise les messages d'erreur et désactive le bouton pour éviter les soumissions multiples
  errorElement.textContent = "";
  if (loginButton) {
      loginButton.disabled = true;
      loginButton.textContent = "Connexion en cours...";
  }

  // Validation de base des champs
  if (!agent || !password) {
    errorElement.textContent = "Veuillez sélectionner un agent et entrer un mot de passe.";
    if (loginButton) {
        loginButton.disabled = false;
        loginButton.textContent = "Se connecter";
    }
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

    // Vérifie si la connexion a réussi (statut 2xx, présence du token et des infos user)
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
        if (loginButton) {
            loginButton.disabled = false;
            loginButton.textContent = "Se connecter";
        }
      }
    } else {
      // Afficher le message d'erreur de l'API si la connexion a échoué
      errorElement.textContent = data.message || "Identifiant ou mot de passe incorrect.";
      console.warn("Connexion échouée:", data.message);
      if (loginButton) {
          loginButton.disabled = false;
          loginButton.textContent = "Se connecter";
      }
    }
  } catch (err) {
    // Gérer les erreurs réseau ou autres exceptions inattendues
    console.error("Erreur lors de la requête de connexion :", err);
    errorElement.textContent = "Impossible de se connecter au serveur. Veuillez vérifier votre connexion.";
    if (loginButton) {
        loginButton.disabled = false;
        loginButton.textContent = "Se connecter";
    }
  }
}

/**
 * Fonction appelée au chargement complet du DOM pour initialiser la page.
 */
document.addEventListener("DOMContentLoaded", async () => {
  // C'est ici que nous allons charger la liste des agents
  // Affiche le spinner pendant le chargement de la liste des agents
  showLoginSpinner(true);

  if (agentSelect) { // Vérifie si l'élément 'agent' existe bien
      try {
          // Cette route /api/agents/names est publique et ne nécessite pas de token JWT
          const response = await fetch(`${API_BASE_URL}/api/agents/names`);
          if (!response.ok) {
              const errorData = await response.json().catch(() => ({ message: "Réponse serveur invalide." }));
              throw new Error(`Erreur lors du chargement de la liste des agents: ${errorData.message || response.statusText}`);
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
          showLoginSpinner(false); // Masque le spinner après le chargement réussi
          if (loginButton) {
              loginButton.disabled = false; // Réactive le bouton de connexion
              loginButton.textContent = "Se connecter";
          }

      } catch (err) {
          console.error("Erreur lors du chargement de la liste des agents :", err);
          if (errorElement) {
              errorElement.textContent = `Impossible de charger la liste des agents. Vérifiez la connexion au serveur: ${err.message}`;
          }
          // Désactiver le bouton de connexion si la liste des agents ne peut pas être chargée
          if (loginButton) {
            loginButton.disabled = true;
            loginButton.textContent = "Connexion impossible";
          }
          showLoginSpinner(false); // Masque le spinner même en cas d'erreur
      }
  } else {
    // Si agentSelect n'est pas trouvé du tout (ce qui est l'erreur que vous avez)
    console.error("ERREUR CRITIQUE: Élément 'agentSelect' non trouvé dans le HTML. La page ne peut pas fonctionner correctement.");
    if (errorElement) {
        errorElement.textContent = "Erreur de chargement de la page : Élément de sélection d'agent manquant.";
    }
    if (loginButton) {
        loginButton.disabled = true;
        loginButton.textContent = "Page Invalide";
    }
    showLoginSpinner(false);
  }

  // Attache l'écouteur d'événement au bouton de connexion
  if (loginButton) {
      loginButton.addEventListener('click', login);
  } else {
      console.warn("Bouton de connexion non trouvé. Assurez-vous qu'il y a un bouton avec l'ID 'login-button' dans votre HTML.");
  }
});
