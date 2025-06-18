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

  // Réinitialise les messages d'erreur
  if (errorElement) {
      errorElement.textContent = '';
  }

  if (!agent || !password) {
      if (errorElement) {
          errorElement.textContent = "Veuillez entrer le nom d'agent et le mot de passe.";
      }
      return;
  }

  try {
    showLoginSpinner(true);
    
    const response = await fetch(`${API_BASE_URL}/api/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username: agent, password: password })
    });

    const data = await response.json();

    if (response.ok) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('userRole', data.user.role);
      localStorage.setItem('userId', data.user.id);
      localStorage.setItem('userName', data.user.name);

      console.log("[LOGIN.JS Debug] Login réussi pour :", data.user.name, "Rôle :", data.user.role);
      console.log("[LOGIN.JS Debug] Token stocké dans localStorage:", localStorage.getItem('token') ? "Oui" : "Non");
      console.log("[LOGIN.JS Debug] Rôle stocké dans localStorage:", localStorage.getItem('userRole'));
      console.log("[LOGIN.JS Debug] ID utilisateur stocké dans localStorage:", localStorage.getItem('userId'));
      console.log("[LOGIN.JS Debug] Nom utilisateur stocké dans localStorage:", localStorage.getItem('userName'));


      if (data.user.role === 'admin') {
        window.location.href = 'admin.html';
      } else {
        window.location.href = 'agent.html';
      }
    } else {
      if (errorElement) {
          errorElement.textContent = data.message || 'Erreur de connexion.';
      }
      console.error("[LOGIN.JS Debug] Erreur de connexion :", data.message);
    }
  } catch (err) {
      if (errorElement) {
          errorElement.textContent = `Erreur de communication avec le serveur: ${err.message}`;
      }
      console.error("[LOGIN.JS Debug] Erreur réseau ou serveur :", err);
  } finally {
    showLoginSpinner(false);
  }
}

/**
 * Charge la liste des agents depuis le serveur et remplit le sélecteur.
 */
async function loadAgentsForSelector() {
    showLoginSpinner(true); // Affiche le spinner au début du chargement

    try {
        const response = await fetch(`${API_BASE_URL}/api/users/agents`);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Erreur serveur: ${response.status} - ${errorText}`);
        }
        const agents = await response.json();
        
        if (agentSelect) {
            // Effacer les options existantes sauf la première (disabled selected)
            while (agentSelect.options.length > 1) {
                agentSelect.remove(1);
            }

            agents.forEach(agent => {
                const option = document.createElement('option');
                option.value = agent.id;
                option.textContent = `${agent.prenom} ${agent.nom}`;
                agentSelect.appendChild(option);
            });
            agentSelect.disabled = false; // Réactiver le sélecteur
            console.log("DEBUG Login : Agents chargés pour le sélecteur:", agents);
        } else {
            console.error("Élément 'agentSelect' non trouvé. Impossible de charger les agents.");
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
    } finally {
        showLoginSpinner(false); // Masque le spinner après le chargement (réussi ou échoué)
    }
}


// Attendre que le DOM soit entièrement chargé avant d'initialiser
document.addEventListener('DOMContentLoaded', () => {
    // Charge la liste des agents au chargement de la page
    if (agentSelect) { // Vérifie si l'élément existe avant d'essayer de le manipuler
        loadAgentsForSelector();
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

    // Gérer la soumission du formulaire via la touche Entrée sur le champ du mot de passe
    if (passwordInput) {
        passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                login();
            }
        });
    } else {
        console.warn("Champ de mot de passe non trouvé. Assurez-vous qu'il y a un input avec l'ID 'password' dans votre HTML.");
    }
});
