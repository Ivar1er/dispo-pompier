const API_BASE_URL = "https://dispo-pompier.onrender.com";

async function login() {
  const agentSelect = document.getElementById("agent");
  const agent = agentSelect.value.trim();
  const passwordInput = document.getElementById("password");
  const password = passwordInput.value.trim();
  const errorElement = document.getElementById("error");
  const loginButton = document.querySelector("button");

  // Réinitialiser les messages d'erreur et désactiver le bouton
  errorElement.textContent = "";
  loginButton.disabled = true; // Désactiver le bouton pendant le chargement
  loginButton.textContent = "Connexion en cours..."; // Changer le texte du bouton

  if (!agent || !password) {
    errorElement.textContent = "Veuillez remplir tous les champs.";
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
      return; // Ne pas réactiver le bouton ici car il sera réactivé dans le finally
    }

    sessionStorage.setItem("agent", agent);
    sessionStorage.setItem("agentPrenom", data.prenom);
    sessionStorage.setItem("agentNom", data.nom);

    if (agent === "admin") {
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


