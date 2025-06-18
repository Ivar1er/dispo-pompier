// script.js

// Firebase CDN imports (they need to be at the top of the module script)
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Variables globales pour Firebase et l'état de l'application
let app;
let db;
let auth;
let userId = null;
let loading = true;
let disponibilities = {};
let currentWeek = new Date(); // Date pour la semaine actuelle

let isDragging = false;
let dragStartSlot = null;

// Fonction utilitaire pour formater les heures
const formatTime = (hours, minutes) => {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

// Fonction pour générer tous les créneaux horaires (de 07:00 à 06:30 le lendemain)
const generateTimeSlots = () => {
    const slots = [];
    let currentHour = 7;
    let currentMinute = 0;

    for (let i = 0; i < 48; i++) { // 24 heures * 2 créneaux de 30 min = 48 créneaux
        const startHour = currentHour;
        const startMinute = currentMinute;

        currentMinute += 30;
        if (currentMinute >= 60) {
            currentMinute -= 60;
            currentHour = (currentHour + 1) % 24;
        }

        const endHour = currentHour;
        const endMinute = currentMinute;

        const slotLabel = `${formatTime(startHour, startMinute)}-${formatTime(endHour, endMinute)}`;
        slots.push(slotLabel);
    }
    return slots;
};

const timeSlots = generateTimeSlots();
const daysOfWeek = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

// Fonction pour obtenir la date de début de la semaine (Lundi)
const getStartOfWeek = (date) => {
    const d = new Date(date);
    const day = d.getDay(); // 0 pour Dimanche, 1 pour Lundi, etc.
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Ajuster au Lundi
    return new Date(d.setDate(diff));
};

// Fonction pour obtenir la chaîne de caractères de la semaine (ex: 16/06 au 22/06)
const getWeekString = (date) => {
    const startOfWeek = getStartOfWeek(date);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    return `${startOfWeek.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} au ${endOfWeek.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}`;
};

// Fonction pour obtenir l'ID unique de la semaine (ex: 2025-06-16)
const getWeekId = (date) => {
    const startOfWeek = getStartOfWeek(date);
    return startOfWeek.toISOString().slice(0, 10); // Année-MM-JJ
};

// Fonction pour charger les disponibilités de Firestore
const loadDisponibilities = () => {
    if (!db || !userId) return;

    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    const weekId = getWeekId(currentWeek);
    const docRef = doc(db, `artifacts/${appId}/users/${userId}/disponibilities`, weekId);

    // Écouter les changements en temps réel
    onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            disponibilities = JSON.parse(data.slots || '{}'); // Parser la chaîne JSON
        } else {
            // Initialiser avec des slots non disponibles si le document n'existe pas
            const initialDispo = {};
            daysOfWeek.forEach(day => {
                initialDispo[day] = timeSlots.reduce((acc, slot) => ({ ...acc, [slot]: false }), {});
            });
            disponibilities = initialDispo;
        }
        renderApp(); // Mettre à jour l'interface après le chargement ou la mise à jour
    }, (error) => {
        console.error("Erreur de récupération des disponibilités:", error);
    });
};

// Fonction pour enregistrer les disponibilités dans Firestore
const saveDisponibilities = async () => {
    if (!db || !userId) {
        console.error("Firebase non initialisé ou utilisateur non connecté.");
        return;
    }

    const saveButton = document.getElementById('saveButton');
    if (saveButton) {
        saveButton.disabled = true;
        saveButton.textContent = 'Enregistrement...';
    }

    try {
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        const weekId = getWeekId(currentWeek);
        const docRef = doc(db, `artifacts/${appId}/users/${userId}/disponibilities`, weekId);

        // Convertir l'objet JS en chaîne JSON pour le stockage Firestore
        await setDoc(docRef, { slots: JSON.stringify(disponibilities) }, { merge: true });
        console.log("Disponibilités enregistrées avec succès!");
    } catch (e) {
        console.error("Erreur lors de l'enregistrement des disponibilités: ", e);
    } finally {
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.textContent = 'Enregistrer les Disponibilités';
        }
    }
};

// Fonction pour basculer la disponibilité d'un créneau (simple clic)
const toggleSlot = (day, slot) => {
    if (!disponibilities[day]) {
        disponibilities[day] = {};
    }
    disponibilities[day][slot] = !disponibilities[day][slot];
    renderApp(); // Mettre à jour l'interface
};

// Gérer le début du glisser-déposer
const handleMouseDown = (day, slot) => {
    isDragging = true;
    dragStartSlot = { day, slot };
    toggleSlot(day, slot); // Sélectionne le premier élément cliqué
};

// Gérer le survol pendant le glisser-déposer
const handleMouseEnter = (day, slot) => {
    if (isDragging && dragStartSlot) {
        const startDayIndex = daysOfWeek.indexOf(dragStartSlot.day);
        const endDayIndex = daysOfWeek.indexOf(day);
        const startTimeIndex = timeSlots.indexOf(dragStartSlot.slot);
        const endTimeIndex = timeSlots.indexOf(slot);

        // Crée une copie profonde pour éviter les mutations directes pendant le glisser
        const newDisponibilities = JSON.parse(JSON.stringify(disponibilities));

        // Normaliser les indices de début et de fin pour les jours
        const minDayIndex = Math.min(startDayIndex, endDayIndex);
        const maxDayIndex = Math.max(startDayIndex, endDayIndex);

        // Normaliser les indices de début et de fin pour les créneaux
        const minTimeIndex = Math.min(startTimeIndex, endTimeIndex);
        const maxTimeIndex = Math.max(startTimeIndex, endTimeIndex);

        // Appliquer l'état à tous les créneaux dans la plage de sélection
        daysOfWeek.forEach((d, dIndex) => {
            if (dIndex >= minDayIndex && dIndex <= maxDayIndex) {
                timeSlots.forEach((s, sIndex) => {
                    if (
                        (dIndex > minDayIndex || sIndex >= minTimeIndex) &&
                        (dIndex < maxDayIndex || sIndex <= maxTimeIndex)
                    ) {
                        // Appliquer l'état du slot de départ à tous les créneaux survolés
                        // Nous inversons l'état initial car le premier clic l'a déjà basculé
                        newDisponibilities[d] = {
                            ...newDisponibilities[d],
                            [s]: !disponibilities[dragStartSlot.day][dragStartSlot.slot],
                        };
                    }
                });
            }
        });
        disponibilities = newDisponibilities;
        renderApp(); // Mettre à jour l'interface
    }
};

// Gérer la fin du glisser-déposer (sur document pour attraper tout relâchement de souris)
document.addEventListener('mouseup', () => {
    isDragging = false;
    dragStartSlot = null;
});

// Fonction pour passer à la semaine précédente/suivante
const changeWeek = (offset) => {
    const newDate = new Date(currentWeek);
    newDate.setDate(currentWeek.getDate() + offset * 7);
    currentWeek = newDate;
    loadDisponibilities(); // Recharger les disponibilités pour la nouvelle semaine
};

// Fonction pour effacer toute la sélection de la semaine actuelle
const clearSelection = () => {
    const clearedDispo = {};
    daysOfWeek.forEach(day => {
        clearedDispo[day] = timeSlots.reduce((acc, slot) => ({ ...acc, [slot]: false }), {});
    });
    disponibilities = clearedDispo;
    renderApp(); // Mettre à jour l'interface
};

// Fonction principale pour rendre l'application HTML dans le DOM
const renderApp = () => {
    const appRoot = document.getElementById('app-root');
    if (!appRoot) return;

    if (loading) {
        appRoot.innerHTML = `
            <div class="flex items-center justify-center min-h-screen bg-gray-100 font-sans p-4">
                <p class="text-gray-700 text-lg">Chargement de l'application...</p>
            </div>
        `;
        return;
    }

    const weekString = getWeekString(currentWeek);
    const agentIdDisplay = userId ? `<span class="text-lg font-medium text-gray-600">ID Agent: ${userId}</span>` : '';

    let slotsHtml = '';
    timeSlots.forEach((slot, slotIndex) => {
        slotsHtml += `
            <div class="p-2 border-b border-r border-gray-200 bg-gray-50 font-medium text-gray-700">
                ${slot.split('-')[0]} <!-- Affiche seulement l'heure de début -->
            </div>
        `;
        daysOfWeek.forEach(day => {
            const isAvailable = disponibilities[day]?.[slot] || false;
            slotsHtml += `
                <div
                    data-day="${day}"
                    data-slot="${slot}"
                    class="p-1 border-b border-l border-gray-200 cursor-pointer
                        flex items-center justify-center text-xs font-semibold rounded-md m-0.5
                        transition-all duration-150 ease-in-out transform
                        ${isAvailable ? 'bg-green-200 text-green-800 hover:bg-green-300 shadow-inner' : 'bg-red-100 text-red-600 hover:bg-red-200'}
                    "
                    onmousedown="window.handleMouseDownWrapper(event, '${day}', '${slot}')"
                    onmouseenter="window.handleMouseEnterWrapper(event, '${day}', '${slot}')"
                >
                    ${isAvailable ? 'Disponible' : 'Indispo'}
                </div>
            `;
        });
    });

    // Injecter l'HTML de l'application dans le div #app-root
    appRoot.innerHTML = `
        <div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6 font-sans text-gray-800">
            <div class="max-w-7xl mx-auto bg-white shadow-2xl rounded-2xl p-8 transform transition-all duration-300 hover:scale-[1.005]">
                <!-- En-tête -->
                <div class="flex justify-between items-center mb-8 pb-4 border-b border-gray-200">
                    <h1 class="text-4xl font-extrabold text-indigo-800">Bienvenue, Nicolas Maréchal !</h1>
                    ${agentIdDisplay}
                </div>

                <!-- Navigation des semaines -->
                <div class="flex justify-center items-center space-x-4 mb-10">
                    <button
                        id="prevWeekBtn"
                        class="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-md transition-all duration-200 ease-in-out transform hover:scale-105"
                    >
                        Semaine Précédente
                    </button>
                    <span class="text-2xl font-bold text-gray-800 px-6 py-3 bg-blue-100 rounded-xl shadow-inner">
                        Semaine (${weekString})
                    </span>
                    <button
                        id="nextWeekBtn"
                        class="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-md transition-all duration-200 ease-in-out transform hover:scale-105"
                    >
                        Semaine Suivante
                    </button>
                </div>

                <h2 class="text-3xl font-bold text-center text-indigo-700 mb-8">Mes Disponibilités</h2>

                <!-- Grille des disponibilités -->
                <div
                    class="overflow-x-auto rounded-xl shadow-lg border border-gray-200"
                >
                    <div class="grid grid-cols-8 bg-indigo-600 text-white font-bold text-lg rounded-t-xl sticky top-0 z-10">
                        <div class="p-4 border-r border-indigo-700">Heure</div>
                        ${daysOfWeek.map(day => `<div class="p-4 text-center border-l border-indigo-700">${day}</div>`).join('')}
                    </div>

                    <div class="grid grid-cols-8 text-sm bg-white">
                        ${slotsHtml}
                    </div>
                </div>

                <!-- Boutons d'action -->
                <div class="flex justify-center space-x-6 mt-10">
                    <button
                        id="saveButton"
                        class="px-8 py-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl shadow-lg transition-all duration-200 ease-in-out transform hover:scale-105"
                    >
                        Enregistrer les Disponibilités
                    </button>
                    <button
                        id="clearButton"
                        class="px-8 py-4 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl shadow-lg transition-all duration-200 ease-in-out transform hover:scale-105"
                    >
                        Effacer la Sélection
                    </button>
                    <button
                        id="summaryButton"
                        class="px-8 py-4 bg-gray-700 hover:bg-gray-800 text-white font-semibold rounded-xl shadow-lg transition-all duration-200 ease-in-out transform hover:scale-105"
                    >
                        Synthèse
                    </button>
                    <button
                        id="logoutButton"
                        class="px-8 py-4 bg-red-700 hover:bg-red-800 text-white font-semibold rounded-xl shadow-lg transition-all duration-200 ease-in-out transform hover:scale-105"
                    >
                        Déconnexion
                    </button>
                </div>

                <p class="text-center text-gray-500 text-sm mt-8">
                    Cliquez sur un créneau pour basculer sa disponibilité.
                    Cliquez et faites glisser pour sélectionner une plage continue.
                </p>
            </div>
        </div>
    `;
    // Attacher les gestionnaires d'événements après le rendu de l'HTML
    document.getElementById('prevWeekBtn')?.addEventListener('click', () => changeWeek(-1));
    document.getElementById('nextWeekBtn')?.addEventListener('click', () => changeWeek(1));
    document.getElementById('saveButton')?.addEventListener('click', saveDisponibilities);
    document.getElementById('clearButton')?.addEventListener('click', clearSelection);
};

// Initialisation de Firebase et authentification au chargement de la fenêtre
window.onload = async () => {
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
    const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);

    renderApp(); // Afficher l'état de chargement initial

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            userId = user.uid;
        } else {
            try {
                if (initialAuthToken) {
                    await signInWithCustomToken(auth, initialAuthToken);
                } else {
                    await signInAnonymously(auth);
                }
            } catch (error) {
                console.error("Erreur d'authentification:", error);
                // Fallback si la connexion anonyme échoue
                userId = crypto.randomUUID();
            }
        }
        loading = false;
        loadDisponibilities(); // Charger les disponibilités une fois authentifié
    });
};

// Exposer les fonctions de gestion des événements au niveau global
// C'est nécessaire pour que les attributs `onmousedown` et `onmouseenter` dans l'HTML généré puissent les appeler.
window.handleMouseDownWrapper = (event, day, slot) => handleMouseDown(day, slot);
window.handleMouseEnterWrapper = (event, day, slot) => handleMouseEnter(day, slot);

