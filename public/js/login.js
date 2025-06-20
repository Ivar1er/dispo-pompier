// js/login.js

document.addEventListener('DOMContentLoaded', async () => {
    const loginForm = document.getElementById('login-form');
    const agentSelect = document.getElementById('agent-select');
    const passwordInput = document.getElementById('password');
    const messageContainer = document.getElementById('message-container');

    const API_BASE_URL = "https://dispo-pompier.onrender.com";

    // Modale de message (copiée pour être autonome)
    function displayMessageModal(title, message, type = "info") {
        let modal = document.getElementById('message-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'message-modal';
            modal.classList.add('modal');
            document.body.appendChild(modal);
        }

        modal.innerHTML = `
        <div class="modal-content ${type}">
            <span class="close-button">&times;</span>
            <h3 class="modal-title">${title}</h3>
            <p class="modal-message">${message}</p>
        </div>
        `;
        modal.style.display = 'block';

        const closeButton = modal.querySelector('.close-button');
        if (closeButton) {
            closeButton.onclick = () => {
                modal.style.display = 'none';
            };
        }
        window.onclick = (event) => {
            if (event.target == modal) {
                modal.style.display = 'none';
            }
        };
    }

    // Charger la liste des agents pour le sélecteur
    async function loadAgentsForSelect() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/agents/names`);
            if (!response.ok) {
                throw new Error('Failed to load agents list');
            }
            const agents = await response.json();
            
            // Clear existing options except the first one (placeholder)
            agentSelect.innerHTML = '<option value="">Sélectionnez votre nom d\'utilisateur</option>';

            agents.forEach(agent => {
                const option = document.createElement('option');
                option.value = agent.id;
                option.textContent = `${agent.prenom} ${agent.nom}`;
                agentSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Error loading agents:', error);
            displayMessageModal('Erreur de chargement', 'Impossible de charger la liste des utilisateurs. Veuillez réessayer plus tard.', 'error');
        }
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        messageContainer.textContent = ''; // Clear previous messages

        const username = agentSelect.value;
        const password = passwordInput.value;

        if (!username || !password) {
            messageContainer.textContent = 'Veuillez saisir votre nom d\'utilisateur et votre mot de passe.';
            messageContainer.style.color = 'red';
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (response.ok) {
                sessionStorage.setItem('jwtToken', data.token);
                // Stocker l'objet utilisateur complet (y compris id, firstName, lastName, role, qualifications...)
                sessionStorage.setItem('agent', JSON.stringify(data.user)); 
                
                messageContainer.textContent = 'Connexion réussie ! Redirection...';
                messageContainer.style.color = 'green';

                // Rediriger en fonction du rôle
                if (data.user.role === 'admin') {
                    window.location.href = 'admin.html';
                } else {
                    window.location.href = 'agent.html';
                }
            } else {
                messageContainer.textContent = data.message || 'Échec de la connexion.';
                messageContainer.style.color = 'red';
            }
        } catch (error) {
            console.error('Erreur lors de la connexion:', error);
            messageContainer.textContent = 'Erreur serveur. Veuillez réessayer plus tard.';
            messageContainer.style.color = 'red';
        }
    });

    // Charger les agents au démarrage de la page
    loadAgentsForSelect();
});
