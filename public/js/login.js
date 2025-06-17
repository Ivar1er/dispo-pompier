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

    // Connexion réussie : stocker les informations de session
    // Utilisation de data._id au lieu de data.id pour correspondre aux conventions MongoDB
    // Assurez-vous que votre backend renvoie bien "_id"
    sessionStorage.setItem("agent", data._id || agent); // Stocke l'identifiant (data._id si présent, sinon l'agent sélectionné)
    sessionStorage.setItem("agentPrenom", data.prenom || ''); // Utilise data.prenom, avec un fallback vide
    sessionStorage.setItem("agentNom", data.nom || '');     // Utilise data.nom, avec un fallback vide
    sessionStorage.setItem("userRole", data.role || '');   // Utilise data.role, avec un fallback vide
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
              // Utilisation de user._id pour correspondre à l'ID retourné par MongoDB si votre backend utilise _id
              option.value = user._id || user.id; // Tente _id d'abord, puis id comme fallback
              option.textContent = `${user.prenom || ''} ${user.nom || ''} (${user._id || user.id})`; // Affiche Prénom Nom (identifiant)
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
