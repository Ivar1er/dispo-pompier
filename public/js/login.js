const API_BASE_URL = "https://dispo-pompier.onrender.com"; // Assurez-vous que cette URL est correcte

async function login() {
  const agentSelect = document.getElementById("agent"); // Cet Ã©lÃ©ment est la liste dÃ©roulante d'agents
  const agent = agentSelect.value.trim(); // L'identifiant (clÃ© de l'objet USERS)
  const passwordInput = document.getElementById("password");
  const password = passwordInput.value.trim();
  const errorElement = document.getElementById("error");
  const loginButton = document.querySelector("button");

  // RÃ©initialiser les messages d'erreur et dÃ©sactiver le bouton
  errorElement.textContent = "";
  loginButton.disabled = true; // DÃ©sactiver le bouton pendant le chargement
  loginButton.textContent = "Connexion en cours..."; // Changer le texte du bouton

  if (!agent || !password) {
    errorElement.textContent = "Veuillez sÃ©lectionner un agent et entrer un mot de passe.";
    loginButton.disabled = false; // RÃ©activer le bouton
    loginButton.textContent = "Se connecter"; // RÃ©tablir le texte du bouton
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
      return; // Ne pas rÃ©activer le bouton ici car il sera rÃ©activÃ© dans le finally
    }

    // Connexion rÃ©ussie : stocker les informations de session
    sessionStorage.setItem("agent", agent); // Stocke l'identifiant (ex: 'bruneau', 'admin')
    sessionStorage.setItem("agentPrenom", data.prenom);
    sessionStorage.setItem("agentNom", data.nom);
    sessionStorage.setItem("userRole", data.role); // <<< NOUVEAU : Stocke le rÃ´le de l'utilisateur

    // Rediriger en fonction du rÃ´le
    if (data.role === "admin") {
      window.location.href = "admin.html";
    } else {
      window.location.href = "agent.html";
    }
  } catch (err) {
    console.error("Erreur lors de la connexion :", err);
    errorElement.textContent = "Impossible de se connecter au serveur. Veuillez vÃ©rifier votre connexion.";
  } finally {
    // S'assure que le bouton est toujours rÃ©activÃ© et son texte rÃ©tabli,
    // mÃªme en cas d'erreur ou de succÃ¨s.
    loginButton.disabled = false;
    loginButton.textContent = "Se connecter";
  }
}


// --- NOUVEAU : Fonction pour charger dynamiquement la liste des agents pour la liste dÃ©roulante ---
document.addEventListener("DOMContentLoaded", async () => {
  const agentSelect = document.getElementById("agent");
  const errorElement = document.getElementById("error");

  // VÃ©rifiez si l'Ã©lÃ©ment agentSelect existe avant de tenter de le manipuler
  if (agentSelect) {
      try {
          const response = await fetch(`${API_BASE_URL}/api/agents/names`);
          if (!response.ok) {
              throw new Error('Erreur lors du chargement de la liste des agents.');
          }
          const agents = await response.json();

          // Vider les options existantes (sauf peut-Ãªtre une option par dÃ©faut si vous en avez une)
          agentSelect.innerHTML = '<option value="">-- SÃ©lectionnez votre identifiant --</option>';

          agents.forEach(user => {
              const option = document.createElement("option");
              option.value = user.id; // L'identifiant est la clÃ© de l'objet USERS (ex: 'bruneau', 'admin')
              option.textContent = `${user.prenom} ${user.nom} (${user.id})`; // Affiche PrÃ©nom Nom (identifiant)
              agentSelect.appendChild(option);
          });
      } catch (err) {
          console.error("Erreur lors du chargement de la liste des agents :", err);
          if (errorElement) {
              errorElement.textContent = "Impossible de charger la liste des agents. VÃ©rifiez la connexion au serveur.";
          }
      }
  } else {
    console.warn("Ã‰lÃ©ment 'agentSelect' non trouvÃ©. Assurez-vous que l'ID 'agent' est correct dans votre HTML.");
  }
});