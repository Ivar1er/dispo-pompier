async function login() {
  const agent = document.getElementById("agent").value.trim();
  const password = document.getElementById("password").value.trim();
  const error = document.getElementById("error");

  if (!agent || !password) {
    error.textContent = "Veuillez remplir tous les champs.";
    return;
  }

  try {
    const response = await fetch("http://localhost:3000/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent, mdp: password }),
    });

    const data = await response.json();

    if (!response.ok) {
      error.textContent = data.message || "Erreur lors de la connexion.";
      return;
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
    error.textContent = "Impossible de se connecter au serveur.";
  }
}

