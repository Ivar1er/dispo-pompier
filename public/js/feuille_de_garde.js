// Styles injectés dynamiquement pour la mise à jour visuelle
const inlineCss = `
/* General Loader Styles */
#loading-spinner {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255,255,255,0.8); /* Lighter overlay */
  z-index: 1000;
}
#loading-spinner.hidden {
  display: none;
}

#loading-spinner .spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #e0e0e0; /* Softer border */
  border-top-color: #4CAF50; /* Green primary color */
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Base Body Styles */
body {
  font-family: 'Inter', sans-serif;
  background-color: #f9f9f9; /* Lighter background */
  margin: 0;
  padding: 20px;
  color: #333;
  line-height: 1.6;
}

/* Roster Wrapper */
.roster-wrapper {
  max-width: 1400px;
  margin: 0 auto;
  background-color: #ffffff;
  border-radius: 8px; /* Consistent rounded corners */
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08); /* Softer shadow */
  padding: 25px;
}

/* Header */
.roster-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 25px;
  flex-wrap: wrap;
  gap: 15px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 15px;
  flex-wrap: wrap;
}

.roster-header h1 {
  font-size: 2em;
  color: #333;
  margin: 0;
}

/* Back Button */
.back-button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 15px;
  background-color: #f0f0f0; /* Neutral background */
  color: #555;
  border: 1px solid #dcdcdc;
  border-radius: 6px;
  text-decoration: none;
  font-size: 0.9em;
  transition: background-color 0.2s, color 0.2s, border-color 0.2s;
}

.back-button:hover {
  background-color: #e0e0e0;
  color: #333;
  border-color: #ccc;
}

/* Date Selector */
.date-selector label {
  display: none; /* Hide label, rely on input type date */
}

.date-selector input[type="date"] {
  padding: 8px 12px;
  border: 1px solid #dcdcdc;
  border-radius: 6px;
  font-size: 1em;
  color: #333;
  appearance: none; /* Remove default arrow */
  background-color: #ffffff;
  cursor: pointer;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.date-selector input[type="date"]:focus {
  border-color: #4CAF50; /* Primary color on focus */
  box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.2);
}

/* Navigation Buttons */
.date-navigation-buttons {
  display: flex;
  gap: 8px;
}

.date-navigation-buttons button {
  padding: 8px 12px;
  background-color: #f0f0f0;
  color: #555;
  border: 1px solid #dcdcdc;
  border-radius: 6px;
  cursor: pointer;
  font-size: 1em;
  transition: background-color 0.2s, color 0.2s, border-color 0.2s;
}

.date-navigation-buttons button:hover {
  background-color: #e0e0e0;
  color: #333;
  border-color: #ccc;
}

/* Refresh Button */
.refresh-button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 15px;
  background-color: #4CAF50; /* Primary green */
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.95em;
  font-weight: 500;
  transition: background-color 0.2s, transform 0.1s;
}

.refresh-button:hover {
  background-color: #43A047; /* Darker green on hover */
  transform: translateY(-1px);
}

.refresh-button svg {
  width: 18px;
  height: 18px;
  stroke: currentColor;
}

/* Roster Main Content */
.roster-main-content {
  display: flex;
  gap: 25px;
}

.roster-main-content > section {
  background-color: #ffffff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  padding: 20px;
}

.roster-main-content > section h2 {
  font-size: 1.5em;
  color: #333;
  margin-top: 0;
  margin-bottom: 20px;
  padding-bottom: 10px;
  border-bottom: 1px solid #eee;
}

/* Left Column - Available Personnel */
.available-personnel {
  flex: 1;
  min-width: 280px;
  max-width: 350px;
}

.available-personnel-list {
  display: flex;
  flex-direction: column;
  gap: 15px; /* Spacing between agent items */
  max-height: 70vh; /* Limit height for scrolling */
  overflow-y: auto;
  padding-right: 10px; /* For scrollbar */
}

.available-personnel-item {
  background-color: #f5f5f5; /* Lighter background for items */
  border: 1px solid #e0e0e0; /* Subtle border */
  border-radius: 8px;
  padding: 12px;
  cursor: grab;
  position: relative; /* For tooltip positioning */
  transition: background-color 0.2s, border-color 0.2s;
}

.available-personnel-item:hover {
  background-color: #eeeeee;
  border-color: #ccc;
}

.available-personnel-item.dragging {
    opacity: 0.6;
    border-style: dashed;
    border-color: #4CAF50;
    box-shadow: 0 0 10px rgba(76, 175, 80, 0.5);
}

.available-personnel-item .agent-info {
  margin-bottom: 8px;
  font-weight: 600;
  color: #333;
}

.no-available-personnel {
  color: #888;
  font-style: italic;
  text-align: center;
  padding: 10px;
}

/* Availability Bar Styles */
.availability-bar-wrapper {
  position: relative;
  width: 100%;
  height: 25px; /* Height of the bar */
  margin-top: 5px;
  background-color: #e0e0e0; /* Base color for unavailable parts */
  border-radius: 4px;
  overflow: hidden;
}

.availability-base-bar {
  position: relative;
  width: 100%;
  height: 100%;
}

.availability-highlight-segment {
  height: 100%;
  border-radius: 0; /* Segments are rectangular */
  opacity: 0.9;
  box-sizing: border-box; /* Ensure padding is included */
  font-size: 0.7em;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
}

.availability-highlight-segment.available {
  background-color: #4CAF50; /* Green for available */
}

.availability-highlight-segment.unavailable {
  background-color: #ef9a9a; /* Muted red for unavailable */
}

.availability-segment-text {
    color: white; /* Couleur du texte sur les segments de disponibilité */
    font-size: 0.7em; /* Taille de la police adaptée (de 0.6em à 0.7em) */
    white-space: nowrap; /* Empêcher le retour à la ligne du texte */
    text-overflow: ellipsis; /* Ajouter des points de suspension si le texte est trop long */
    padding: 0 4px; /* Plus de padding horizontal */
    line-height: 1; /* Resserre la hauteur du texte */
    pointer-events: none; /* Permet aux événements de souris de passer à l'élément parent (pour le tooltip) */
    box-sizing: border-box; /* Inclure padding dans la largeur/hauteur */
}

/* Time Legend for Availability Bar */
.time-legend {
  position: absolute;
  top: 100%; /* Below the bar */
  left: 0;
  width: 100%;
  display: flex;
  justify-content: space-between;
  font-size: 0.7em;
  color: #666;
  margin-top: 2px;
}
.time-legend span {
  flex: 1;
  text-align: center;
}
.time-legend span:first-child { text-align: left; }
.time-legend span:last-child { text-align: right; }


/* Tooltip for Availability Bar */
.availability-bar-tooltip {
    position: absolute;
    background-color: #424242; /* Darker grey for tooltip */
    color: white;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 0.8em;
    white-space: nowrap;
    z-index: 50;
    bottom: calc(100% + 5px); /* Position above with margin */
    left: 50%;
    transform: translateX(-50%);
    opacity: 0; /* Start hidden */
    visibility: hidden;
    transition: opacity 0.2s, visibility 0.2s;
    pointer-events: none; /* No interaction with tooltip */
}

.available-personnel-item:hover .availability-bar-tooltip,
.on-duty-slot:hover .availability-bar-tooltip {
    opacity: 1;
    visibility: visible;
}


.availability-bar-tooltip ul {
    list-style: none;
    margin: 0;
    padding: 0;
}

.availability-bar-tooltip li {
    margin-bottom: 2px;
    font-size: 0.9em;
}

.availability-bar-tooltip li:last-child {
    margin-bottom: 0;
}

/* Middle Column - On-Duty Agents Grid */
.on-duty-agents {
  flex: 1.2;
  min-width: 320px;
  max-width: 400px;
}

.on-duty-agents-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); /* Auto-fit for responsiveness */
  gap: 15px;
  max-height: 70vh;
  overflow-y: auto;
  padding-right: 10px;
}

.on-duty-slot {
  background-color: #f5f5f5; /* Lighter background */
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  min-height: 100px; /* Adjusted minimum height */
  color: #888;
  font-style: italic;
  position: relative; /* For the remove button */
  transition: background-color 0.2s, border-color 0.2s;
}

.on-duty-slot.filled {
  background-color: #e8f5e9; /* Light green if filled */
  border-color: #a5d6a7; /* Subtle green border */
  color: #333;
  font-style: normal;
  cursor: grab;
}

.on-duty-slot.filled:hover {
  background-color: #dcedc8; /* Slightly darker green */
  border-color: #8bc34a;
}

.on-duty-slot.drag-over {
    border: 2px dashed #4CAF50;
    background-color: rgba(76, 175, 80, 0.1);
}

.on-duty-slot .remove-agent-btn {
    position: absolute;
    top: 5px;
    right: 5px;
    background-color: #f44336; /* Red for remove */
    color: white;
    border: none;
    border-radius: 50%;
    width: 20px;
    height: 20px;
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 0.8em;
    cursor: pointer;
    line-height: 1;
    transition: background-color 0.2s;
}

.on-duty-slot .remove-agent-btn:hover {
    background-color: #d32f2f;
}

/* Right Column - Roster Grid */
.roster-grid-section {
  flex: 3;
  overflow-x: auto; /* Allow horizontal scrolling for large tables */
}

.roster-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 800px; /* Minimum width for the table */
}

.roster-table th, .roster-table td {
  border: 1px solid #e0e0e0; /* Light borders */
  padding: 10px;
  text-align: left;
  vertical-align: top;
}

.roster-table th {
  background-color: #f0f0f0; /* Lighter header background */
  font-weight: 600;
  color: #555;
  white-space: nowrap;
}

.roster-table td {
  background-color: #ffffff;
  min-width: 120px; /* Minimum width for engine cells */
}

.time-slot-cell {
  background-color: #e9e9e9;
  font-weight: 600;
  white-space: nowrap;
}

.roster-cell {
  position: relative; /* For INDISPO overlay */
}

.roster-cell.drag-over {
    border: 2px dashed #4CAF50;
    background-color: rgba(76, 175, 80, 0.1);
}

/* Engine Display in Roster Grid */
.engine-display {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.engine-name-mini {
  font-weight: bold;
  color: #333;
}

.assigned-personnel-mini {
  list-style: none;
  padding: 0;
  margin: 0;
  font-size: 0.8em;
  color: #666;
}

.assigned-personnel-mini li {
  margin-bottom: 2px;
}

.assigned-personnel-mini .role-abbr {
  font-weight: 600;
  color: #4CAF50; /* Green for role abbreviation */
}

.assigned-personnel-mini .unqualified-mini {
  color: #f44336; /* Red for unqualified */
}

.assigned-personnel-mini .missing-mini {
  color: #ff9800; /* Orange for missing required */
  font-weight: 500;
}

/* INDISPO Overlay */
.engine-indispo-overlay-mini {
    position: absolute;
    inset: 0;
    background-color: rgba(244, 67, 54, 0.7); /* Red overlay with transparency */
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1em;
    color: white;
    font-weight: bold;
    border-radius: 8px; /* Match parent */
}

/* Time Slot Buttons (Top of Roster Grid) */
.time-slot-buttons-container {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.time-slot-button, .add-time-slot-btn {
  padding: 8px 15px;
  background-color: #f0f0f0;
  color: #555;
  border: 1px solid #dcdcdc;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9em;
  transition: background-color 0.2s, border-color 0.2s, box-shadow 0.2s;
  position: relative;
  display: flex;
  align-items: center;
}

.time-slot-button:hover, .add-time-slot-btn:hover {
  background-color: #e0e0e0;
  border-color: #ccc;
}

.time-slot-button.active {
  background-color: #4CAF50; /* Green for active */
  color: white;
  border-color: #4CAF50;
  box-shadow: 0 2px 5px rgba(76, 175, 80, 0.3);
}

.time-slot-button.active:hover {
  background-color: #43A047;
  border-color: #43A047;
}

.delete-time-slot-btn {
  background-color: #ffcdd2; /* Lighter red for delete */
  color: #f44336;
  border: none;
  border-radius: 50%;
  width: 18px;
  height: 18px;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 0.7em;
  cursor: pointer;
  position: absolute;
  top: -5px;
  right: -5px;
  transition: background-color 0.2s, color 0.2s;
}

.delete-time-slot-btn:hover {
  background-color: #ef9a9a;
  color: white;
}

/* Engine Details Page */
.engine-details-page {
  display: none; /* Hidden by default */
  flex-direction: column;
  gap: 20px;
}

.engine-details-header {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-bottom: 20px;
}

.engine-details-header h2 {
  margin: 0;
  font-size: 1.8em;
  color: #333;
}

.engine-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
}

.engine-case {
  background-color: #ffffff;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  position: relative;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.engine-case:hover {
  border-color: #b0b0b0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.engine-case.drag-over {
    border: 2px dashed #4CAF50;
    background-color: rgba(76, 175, 80, 0.1);
}

.engine-case h3 {
  margin: 0 0 5px 0;
  font-size: 1.3em;
  color: #333;
}

.engine-case .places-count {
  font-size: 0.9em;
  color: #666;
  margin-bottom: 10px;
}

.personnel-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.personnel-list li {
  font-size: 1em;
  color: #555;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.personnel-list li strong {
  color: #333;
  min-width: 80px; /* Align roles */
}

.unqualified-agent {
  color: #f44336; /* Red for unqualified agent */
  font-weight: 500;
}

.missing-required-role {
  color: #ff9800; /* Orange for missing required role */
  font-weight: 500;
}

.assign-engine-personnel-btn {
  padding: 8px 15px;
  background-color: #007bff; /* Keep blue for this specific action */
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9em;
  align-self: flex-start; /* Align left */
  margin-top: auto; /* Push to bottom */
  transition: background-color 0.2s, transform 0.1s;
}

.assign-engine-personnel-btn:hover {
  background-color: #0056b3;
  transform: translateY(-1px);
}

/* INDISPO overlay for large engine cases */
.engine-indispo-overlay {
    position: absolute;
    inset: 0;
    background-color: rgba(244, 67, 54, 0.8); /* Red overlay with transparency */
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 2.5em;
    color: white;
    font-weight: bold;
    border-radius: 8px;
    z-index: 10;
}

/* Custom Modal General Styles */
.custom-modal {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.6);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
    font-family: 'Inter', sans-serif;
    animation: fadeIn 0.3s ease-out;
}

.custom-modal .modal-content {
    background-color: #ffffff;
    padding: 30px;
    border-radius: 12px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
    width: 90%;
    max-width: 700px; /* Wider for personnel assignment */
    display: flex;
    flex-direction: column;
    gap: 20px;
    position: relative;
}

.custom-modal h2 {
    margin: 0;
    font-size: 1.8em;
    color: #333;
    padding-bottom: 15px;
    border-bottom: 1px solid #eee;
    text-align: center;
}

.modal-body-assignment {
    display: flex;
    gap: 20px;
    flex-wrap: wrap; /* Allow wrapping on smaller screens */
}

.modal-section {
    flex: 1;
    min-width: 280px; /* Minimum width for each section */
    background-color: #f9f9f9;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    padding: 15px;
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.modal-section h3 {
    margin: 0 0 10px 0;
    font-size: 1.2em;
    color: #555;
    text-align: center;
}

.agent-list-drag-area, .roles-drop-area {
    min-height: 150px;
    border: 1px dashed #ccc;
    border-radius: 6px;
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    overflow-y: auto;
    background-color: #fdfdfd;
}

.agent-list-drag-area.drag-over, .roles-drop-area.drag-over {
    border: 2px dashed #4CAF50;
    background-color: rgba(76, 175, 80, 0.1);
}

.modal-available-agent-slot {
    background-color: #e8f5e9; /* Light green for available agents */
    border: 1px solid #a5d6a7;
    border-radius: 6px;
    padding: 8px 12px;
    cursor: grab;
    font-weight: 500;
    color: #333;
    transition: background-color 0.2s, border-color 0.2s;
}

.modal-available-agent-slot:hover {
    background-color: #dcedc8;
    border-color: #8bc34a;
}

.modal-available-agent-slot.dragging-modal {
    opacity: 0.6;
    border-style: dashed;
    border-color: #4CAF50;
    box-shadow: 0 0 8px rgba(76, 175, 80, 0.4);
}

.modal-role-slot {
    display: flex;
    flex-direction: column;
    gap: 5px;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    padding: 8px;
    background-color: #f5f5f5;
}

.modal-role-slot .role-name {
    font-weight: 600;
    color: #555;
    font-size: 0.9em;
}

.modal-role-slot .role-name.required-role {
    color: #dc3545; /* Red for required roles */
}

.assigned-agent-placeholder {
    background-color: #ffffff;
    border: 1px dashed #ccc;
    border-radius: 6px;
    min-height: 40px; /* Ensure drop target is visible */
    display: flex;
    justify-content: center;
    align-items: center;
    color: #888;
    font-style: italic;
    padding: 8px;
    position: relative; /* For remove button */
    transition: background-color 0.2s, border-color 0.2s;
}

.assigned-agent-placeholder.filled {
    border: 1px solid #a5d6a7; /* Green border if filled */
    background-color: #e8f5e9;
    color: #333;
    font-style: normal;
}

.assigned-agent-placeholder.drag-over {
    border: 2px dashed #4CAF50;
    background-color: rgba(76, 175, 80, 0.1);
}

.assigned-agent-name {
    font-weight: 500;
    cursor: grab;
    display: flex;
    align-items: center;
    gap: 5px;
}

.unqualified-agent-modal {
    color: #f44336; /* Red for unqualified in modal */
    font-weight: 600;
}

.remove-assigned-agent-btn {
    position: absolute;
    top: 3px;
    right: 3px;
    background-color: #f44336;
    color: white;
    border: none;
    border-radius: 50%;
    width: 18px;
    height: 18px;
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 0.7em;
    cursor: pointer;
    line-height: 1;
    transition: background-color 0.2s;
}

.remove-assigned-agent-btn:hover {
    background-color: #d32f2f;
}

.modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    padding-top: 15px;
    border-top: 1px solid #eee;
    margin-top: 15px;
}

.btn {
    padding: 10px 20px;
    border: none;
    border-radius: 6px; /* Slightly smaller border-radius for buttons */
    cursor: pointer;
    font-size: 0.95em;
    font-weight: 500;
    transition: background-color 0.2s ease, transform 0.1s ease;
}

.btn-primary {
    background-color: #4CAF50; /* Primary green */
    color: white;
}
.btn-primary:hover {
    background-color: #43A047;
    transform: translateY(-1px);
}
.btn-secondary {
    background-color: #9e9e9e; /* Muted grey for secondary */
    color: white;
}
.btn-secondary:hover {
    background-color: #757575;
    transform: translateY(-1px);
}

/* Modale de sélection de plage horaire */
.modal-form-group {
    margin-bottom: 15px;
    display: flex;
    flex-direction: column;
}

.modal-form-group label {
    font-weight: 600;
    margin-bottom: 5px;
    color: #555;
}

.modal-form-group select {
    padding: 8px 12px;
    border: 1px solid #dcdcdc;
    border-radius: 6px;
    font-size: 1em;
    color: #333;
    background-color: #ffffff;
    cursor: pointer;
    outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
}

.modal-form-group select:focus {
    border-color: #4CAF50;
    box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.2);
}

/* Responsive adjustments */
@media (max-width: 1024px) {
  .roster-main-content {
    flex-direction: column;
  }

  .available-personnel, .on-duty-agents, .roster-grid-section {
    max-width: 100%;
    min-width: unset;
  }
}

@media (max-width: 768px) {
  .roster-header {
    flex-direction: column;
    align-items: flex-start;
  }
  .header-left {
    flex-direction: column;
    align-items: flex-start;
    width: 100%;
  }
  .date-navigation-buttons, .refresh-button {
    width: 100%;
  }
  .refresh-button {
    justify-content: center;
  }
  .roster-wrapper {
    padding: 15px;
  }
  .roster-main-content > section {
    padding: 15px;
  }
  .modal-body-assignment {
      flex-direction: column;
  }
  .modal-section {
      min-width: unset;
      width: 100%;
  }
}

@media (max-width: 480px) {
  body {
    padding: 10px;
  }
  .roster-wrapper {
    padding: 10px;
  }
  .roster-header h1 {
    font-size: 1.5em;
  }
  .back-button, .date-selector input, .date-navigation-buttons button, .refresh-button,
  .time-slot-button, .add-time-slot-btn, .assign-engine-personnel-btn, .btn {
    font-size: 0.85em;
    padding: 6px 10px;
  }
  .on-duty-agents-grid {
      grid-template-columns: 1fr; /* Stack on mobile */
  }
  .roster-table {
      font-size: 0.85em;
  }
  .roster-table th, .roster-table td {
      padding: 8px;
  }
  .engine-indispo-overlay-mini {
      font-size: 0.8em;
  }
  .engine-case h3 {
      font-size: 1.1em;
  }
}
`;

// --------------------------------------------------
// 1️⃣ Constantes & Helpers
// --------------------------------------------------

// URL de l’API
const API_BASE_URL = "https://dispo-pompier.onrender.com";

// Créneaux de 07:00→07:00 sur 24h (30 min)
const horaires = [];
const startHourDisplay = 7;
for (let i = 0; i < 48; i++) {
  const h1 = (startHourDisplay + Math.floor(i/2)) % 24;
  const m1 = (i % 2) * 30;
  const h2 = (startHourDisplay + Math.floor((i+1)/2)) % 24;
  const m2 = ((i+1) % 2) * 30;
  horaires.push(
    `${String(h1).padStart(2,'0')}:${String(m1).padStart(2,'0')} - ` +
    `${String(h2).padStart(2,'0')}:${String(m2).padStart(2,'0')}`
  );
}

// Mappage des rôles d'engin vers les qualifications réelles des agents
// IMPORTANT: Les clés (ID de rôle) doivent correspondre aux 'id' dans engineDetails.
// Les valeurs (tableau de chaînes) doivent correspondre exactement aux qualifications (IDs)
// que les agents possèdent dans votre base de données et que votre API retourne.
// Un agent est qualifié si il possède AU MOINS UNE des qualifications du tableau.
const roleToQualificationMap = {
    // VSAV
    'ca_vsav': ['ca_vsav'], // Le rôle 'ca_vsav' requiert la qualification 'ca_vsav'
    'cod_0': ['cod_0'],     // Le rôle 'cod_0' requiert la qualification 'cod_0' (CD VSAV / VTU / VPMA)
    'eq_vsav': ['eq_vsav'], // Le rôle 'eq_vsav' requiert la qualification 'eq_vsav'
    'eq_vsav_2': ['eq_vsav'], // Le rôle 'eq_vsav_2' requiert la qualification 'eq_vsav' (même qualif que equipier 1)

    // FPT
    'ca_fpt': ['ca_fpt'],
    'cod_1': ['cod_1'],
    'eq1_fpt': ['eq1_fpt'],
    'eq2_fpt': ['eq2_fpt'],

    // CCF
    'ca_ccf': ['ca_ccf'],
    'cod_2': ['cod_2'],
    'eq1_ccf': ['eq1_ccf'],
    'eq2_ccf': ['eq2_ccf'],

    // VTU
    'ca_vtu': ['ca_vtu'],
    // 'cod_0' est géré ci-dessus si c'est le même Chef
    'eq_vtu': ['eq_vtu'],

    // VPMA
    'ca_vpma': ['ca_vpma'],
    'cod_0': ['cod_0'], // CD VPMA, peut être le même que COD VSAV/VTU
    'eq_vpma': ['eq_vpma']
};

// Nouvelle structure pour définir les détails de chaque engin, ses rôles et ses rôles critiques.
// C'est ici que tu définis les rôles clés pour l'affichage "INDISPO".
const engineDetails = {
    'VSAV': { // Le type doit correspondre à celui dans appData.timeSlots[id].engines
        name: "VSAV",
        roles: [
            { id: 'ca_vsav', name: 'CA VSAV', required: true },
            { id: 'cod_0', name: 'CD VSAV', required: true },
            { id: 'eq_vsav', name: 'EQ VSAV', required: true },
        ],
        criticalRoles: ['cod_0', 'ca_vsav'] // CD et CA sont critiques pour VSAV
    },
    'FPT': {
        name: "FPT",
        roles: [
            { id: 'ca_fpt', name: 'CA FPT', required: true },
            { id: 'cod_1', name: 'CD FPT', required: true },
            { id: 'eq1_fpt', name: 'EQ1 FPT', required: true },
            { id: 'eq2_fpt', name: 'EQ2 FPT', required: false }
        ],
        criticalRoles: ['cod_1', 'ca_fpt'] // CD et CA sont critiques pour FPT
    },
    'CCF': {
        name: "CCF",
        roles: [
            { id: 'ca_ccf', name: 'CA CCF', required: true },
            { id: 'cod_2', name: 'CD CCF', required: true },
            { id: 'eq1_ccf', name: 'EQ1 CCF', required: true },
            { id: 'eq2_ccf', name: 'EQ2 CCF', required: false }
        ],
        criticalRoles: ['cod_2', 'ca_ccf']
    },
    'VTU': {
        name: "VTU",
        roles: [
            { id: 'ca_vtu', name: 'CA VTU', required: true },
            { id: 'cod_0', name: 'CD VTU', required: true }, // Peut-être le même COD que VSAV
            { id: 'eq_vtu', name: 'EQ VTU', required: false }
        ],
        criticalRoles: ['cod_0',]
    },
     'VPMA': {
        name: "VPMA",
        roles: [
            { id: 'ca_vpma', name: 'CA VPMA', required: true },
            { id: 'cod_0', name: 'CD VPMA', required: true },
            { id: 'eq_vpma', name: 'EQ VPMA', required: false }
        ],
        criticalRoles: ['none', 'none'] // A revoir si des rôles critiques sont pertinents ici
    }
};

// Références DOM
const rosterDateInput        = document.getElementById('roster-date');
const prevDayButton          = document.getElementById('prev-day-button');
const nextDayButton          = document.getElementById('next-day-button');
const generateAutoBtn        = document.getElementById('generate-auto-btn');
const availablePersonnelList = document.getElementById('available-personnel-list');
const onDutyAgentsGrid       = document.getElementById('on-duty-agents-grid');
const rosterGridContainer    = document.getElementById('roster-grid');
const engineDetailsPage      = document.getElementById('engine-details-page');
const backToRosterBtn        = document.getElementById('back-to-roster-btn');
const loadingSpinner         = document.getElementById('loading-spinner');

// NOUVEAU: Références DOM pour la modale d'affectation
const personnelAssignmentModal        = document.getElementById('personnel-assignment-modal');
const closePersonnelAssignmentModalBtn = document.getElementById('close-personnel-assignment-modal-btn');
const personnelAssignmentModalTitle   = document.getElementById('personnel-assignment-modal-title');
const availableAgentsInModalList      = document.getElementById('available-agents-in-modal-list');
const engineRolesContainer            = document.getElementById('engine-roles-container');

// États globaux
let currentRosterDate = new Date();
let allAgents         = [];
// appData contiendra maintenant la configuration du roster par date, et personnelAvailabilities par agent
let appData           = { 
    personnelAvailabilities: {} 
};

// NOUVEAU: Variable globale pour stocker les qualifications de l'agent en cours de drag
// Cette variable n'est plus utilisée directement avec le nouveau D&D, conservée pour référence si besoin
let draggedAgentQualifications = []; 

// Helpers
function formatDateToYYYYMMDD(d) {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}` +
         `-${String(dt.getDate()).padStart(2,'0')}`;
}
function parseTimeToMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Vérifie si deux plages horaires se chevauchent, en tenant compte d'une journée conceptuelle
 * commençant à `startHourOffset` (par exemple 07:00).
 * @param {{start: string, end: string}} r1 - Première plage horaire { "HH:MM", "HH:MM" }
 * @param {{start: string, end: string}} r2 - Deuxième plage horaire { "HH:MM", "HH:MM" }
 * @returns {boolean} True si les plages se chevauchent, False sinon.
 */
function doTimeRangesOverlap(r1, r2) {
    const startHourOffset = 7 * 60; // 7h en minutes, la nouvelle origine de la journée 0%
    const totalDayMinutes = 24 * 60;

    let s1 = (parseTimeToMinutes(r1.start) - startHourOffset + totalDayMinutes) % totalDayMinutes;
    let e1 = (parseTimeToMinutes(r1.end) - startHourOffset + totalDayMinutes) % totalDayMinutes;
    let s2 = (parseTimeToMinutes(r2.start) - startHourOffset + totalDayMinutes) % totalDayMinutes;
    let e2 = (parseTimeToMinutes(r2.end) - startHourOffset + totalDayMinutes) % totalDayMinutes;

    // Si une plage traverse la "nouvelle minuit" (07:00 décalée), l'étendre sur 48h.
    // Ex: 04:00-09:00 (heure réelle) devient 21:00-02:00 (heures décalées). Ici endMinutes < startMinutes.
    // On ajoute totalDayMinutes pour que la fin soit après le début sur une ligne temporelle continue.
    if (e1 <= s1) e1 += totalDayMinutes;
    if (e2 <= s2) e2 += totalDayMinutes;

    // Un chevauchement existe si : (start1 < end2) ET (end1 > start2)
    return s1 < e2 && e1 > s2;
}


/**
 * Calcule la largeur et la position d'un segment de disponibilité sur une barre de 24h,
 * avec une journée qui commence à 07:00 et se termine à 07:00 le lendemain.
 * @param {string} startTime - Heure de début (HH:MM).
 * @param {string} endTime - Heure de fin (HH:MM).
 * @returns {Array<Object>} Un tableau d'objets { left: %, width: % } pour gérer les plages qui passent minuit.
 */
function getAvailabilitySegments(startTime, endTime) {
    const startHourOffset = 7 * 60; // 7h en minutes (la nouvelle origine de la journée 0%)
    const totalDayMinutes = 24 * 60; // 1440 minutes pour une journée complète

    let startMinutes = parseTimeToMinutes(startTime);
    let endMinutes = parseTimeToMinutes(endTime);

    // Normaliser les minutes pour la journée de 07:00 à 07:00
    // On décale toutes les heures de 7 heures en arrière pour que 07:00 soit 0 minutes, 08:00 soit 60 minutes, etc.
    startMinutes = (startMinutes - startHourOffset + totalDayMinutes) % totalDayMinutes;
    endMinutes = (endMinutes - startHourOffset + totalDayMinutes) % totalDayMinutes;

    const segments = [];

    // Si la plage de temps est de durée nulle (ex: 07:00 - 07:00, qui est la nouvelle "minuit")
    // Cela indique une disponibilité sur 24h sur ce fuseau visuel.
    if (startMinutes === endMinutes) {
        segments.push({ left: 0, width: 100 });
        return segments;
    }

    // Cas simple: la plage ne traverse pas la "nouvelle minuit" (07:00)
    // Ex: 08:00-17:00 (heure réelle) => 01:00-10:00 (heures décalées). Ici endMinutes > startMinutes
    if (endMinutes > startMinutes) {
        const left = (startMinutes / totalDayMinutes) * 100;
        const width = ((endMinutes - startMinutes) / totalDayMinutes) * 100;
        segments.push({ left, width });
    }
    // Cas complexe: la plage traverse la "nouvelle minuit" (07:00)
    // Ex: 04:00-09:00 (heure réelle) => 21:00-02:00 (heures décalées). Ici endMinutes < startMinutes
    else {
        // Segment de la "nouvelle origine" (07:00, ou 0 minutes décalées) jusqu'à la fin de la journée décalée (06:59 le lendemain, ou 1439 minutes décalées)
        const left1 = (startMinutes / totalDayMinutes) * 100;
        const width1 = ((totalDayMinutes - startMinutes) / totalDayMinutes) * 100;
        segments.push({ left: left1, width: width1 });

        // Segment du début de la journée décalée (07:00 du lendemain) jusqu'à la fin de la plage
        const left2 = 0; // Commence à la nouvelle origine
        const width2 = (endMinutes / totalDayMinutes) * 100;
        segments.push({ left: left2, width: width2 });
    }
    return segments;
}


function createEmptyEngineAssignment(type) {
  const pers = {};
  // Utilise engineDetails pour obtenir les rôles d'un type d'engin spécifique
  // Assure-toi que engineDetails[type] existe et a une propriété 'roles'.
  (engineDetails[type]?.roles || []).forEach(role => pers[role.id] = 'none'); // Utilise role.id
  return pers; // Renvoie l'objet personnel directement, comme attendu par le backend
}

/**
 * Vérifie si un agent est qualifié pour un rôle donné en fonction de ses qualifications et de la map.
 * @param {Object} agent - L'objet agent avec sa liste de qualifications (agent.qualifications).
 * @param {string} roleId - L'ID du rôle à vérifier (ex: 'ca_fpt', 'cod_0', 'eq_vsav').
 * @returns {boolean} True si l'agent est qualifié, False sinon.
 */
function isAgentQualifiedForRole(agent, roleId) {
    if (!agent || !Array.isArray(agent.qualifications)) {
        // console.warn(`isAgentQualifiedForRole: Agent ou qualifications non valides pour le rôle '${roleId}'.`, agent);
        return false;
    }

    const requiredQualifications = roleToQualificationMap[roleId];
    
    // Si aucune qualification n'est définie dans roleToQualificationMap pour ce rôle,
    // on considère l'agent qualifié par défaut pour ce rôle (pas de restriction).
    if (!requiredQualifications || requiredQualifications.length === 0) {
        return true;
    }

    // L'agent est qualifié si il possède au moins une des qualifications requises.
    return requiredQualifications.some(q => agent.qualifications.includes(q));
}


/**
 * Affiche le spinner de chargement.
 */
function showSpinner() {
  loadingSpinner.classList.remove('hidden');
}

/**
 * Cache le spinner de chargage.
 */
function hideSpinner() {
  loadingSpinner.classList.add('hidden');
}

// --------------------------------------------------
// 2️⃣ Chargement des données
// --------------------------------------------------

async function fetchAllAgents() {
  try {
    // IMPORTANT: Utiliser sessionStorage pour récupérer le token
    const token = sessionStorage.getItem('token'); 
    if (!token) {
        console.warn('fetchAllAgents: Aucun token trouvé. Authentification requise.');
        // Potentiellement rediriger ou afficher un message d'erreur à l'utilisateur
        return; 
    }

    const resp = await fetch(`${API_BASE_URL}/api/admin/agents`, {
      headers: {
        'Authorization': `Bearer ${token}`, // Envoyer le token
        'X-User-Role':'admin' // Garder l'en-tête de rôle
      }
    });
    if (!resp.ok) {
        if (resp.status === 401 || resp.status === 403) {
            displayMessageModal("Accès Refusé", "Votre session a expiré ou vous n'êtes pas autorisé. Veuillez vous reconnecter.", "error", () => {
                sessionStorage.clear();
                window.location.href = "/index.html";
            });
            return;
        }
        throw new Error(`HTTP error! status: ${resp.status}`);
    }
    allAgents = await resp.json();
  } catch (error) {
    console.error("Erreur lors du chargement des agents:", error);
    allAgents = []; // Assurez-vous que c'est un tableau vide en cas d'échec
  }
}

async function loadRosterConfig(dateKey) {
  try {
    // IMPORTANT: Utiliser sessionStorage pour récupérer le token
    const token = sessionStorage.getItem('token');
    if (!token) {
        console.warn('loadRosterConfig: Aucun token trouvé. Authentification requise.');
        return;
    }

    const resp = await fetch(`${API_BASE_URL}/api/roster-config/${dateKey}`, {
      headers: {
        'Authorization': `Bearer ${token}`, // Envoyer le token
        'X-User-Role':'admin'
      }
    });
    if (!resp.ok) {
        if (resp.status === 401 || resp.status === 403) {
            // Pas de redirection ici car loadInitialData gérera l'erreur globale si elle se propage.
            // On jette l'erreur pour que le catch de loadInitialData puisse la gérer.
            throw new Error(`HTTP error! status: ${resp.status}`);
        }
        throw new Error(`HTTP error! status: ${resp.status}`); // Gérer les autres types d'erreurs HTTP
    }
    appData[dateKey] = await resp.json();
    if (Object.keys(appData[dateKey]).length === 0) {
        appData[dateKey] = {
            timeSlots: {},
            onDutyAgents: Array(10).fill('none')
        };
        initializeDefaultTimeSlotsForDate(dateKey, true); // Force la création si le fichier était vide
    } else {
        if (appData[dateKey].timeSlots) {
            for (const slotId in appData[dateKey].timeSlots) {
                const timeSlot = appData[dateKey].timeSlots[slotId];
                if (timeSlot.engines) {
                    for (const engineType in timeSlot.engines) {
                                if (typeof timeSlot.engines[engineType].personnel === 'undefined') {
                                    timeSlot.engines[engineType] = { personnel: timeSlot.engines[engineType] };
                                }
                                const definedRoles = engineDetails[engineType]?.roles || [];
                                definedRoles.forEach(role => {
                                    if (typeof timeSlot.engines[engineType].personnel[role.id] === 'undefined') {
                                        timeSlot.engines[engineType].personnel[role.id] = 'none';
                                    }
                                });
                            }
                        }
                    }
                }
            }
          } catch (error) {
            console.error("Erreur lors du chargement de la configuration du roster:", error);
            appData[dateKey] = {
              timeSlots: {},
              onDutyAgents: Array(10).fill('none')
            };
            // Si l'erreur est une 401/403, elle a déjà été gérée par fetchAllAgents
            // ou sera gérée par loadInitialData. Ne pas initializeDefaultTimeSlotsForDate ici si l'erreur vient du token.
            if (!error.message.includes('401') && !error.message.includes('403')) {
                initializeDefaultTimeSlotsForDate(dateKey, true);
            }
          }
        }


        async function saveRosterConfig(dateKey) {
          try {
            // IMPORTANT: Utiliser sessionStorage pour récupérer le token
            const token = sessionStorage.getItem('token');
            if (!token) {
                console.warn('saveRosterConfig: Aucun token trouvé. Authentification requise.');
                return;
            }

            const resp = await fetch(`${API_BASE_URL}/api/roster-config/${dateKey}`, {
              method: 'POST',
              headers: {
                'Content-Type':'application/json',
                'Authorization': `Bearer ${token}`, // Envoyer le token
                'X-User-Role':'admin'
              },
              body: JSON.stringify(appData[dateKey])
            });
            if (!resp.ok) {
                const errorText = await resp.text();
                if (resp.status === 401 || resp.status === 403) {
                    displayMessageModal("Accès Refusé", "Votre session a expiré ou vous n'êtes pas autorisé. Veuillez vous reconnecter.", "error", () => {
                        sessionStorage.clear();
                        window.location.href = "/index.html";
                    });
                    return;
                }
                throw new Error(`HTTP error! status: ${resp.status}, message: ${errorText}`);
            }
          } catch (error) {
            console.error("Erreur lors de la sauvegarde de la configuration du roster:", error);
            displayMessageModal("Erreur de Sauvegarde", `Impossible de sauvegarder la configuration du roster : ${error.message}`, "error");
          }
        }

        async function loadDailyRoster(dateKey) {
          try {
            // IMPORTANT: Utiliser sessionStorage pour récupérer le token
            const token = sessionStorage.getItem('token');
            if (!token) {
                console.warn('loadDailyRoster: Aucun token trouvé. Authentification requise.');
                return;
            }

            const resp = await fetch(`${API_BASE_URL}/api/daily-roster/${dateKey}`, {
              headers: {
                'Authorization': `Bearer ${token}`, // Envoyer le token
                'X-User-Role':'admin'
              },
              credentials: 'include'
            });
            if (!resp.ok) {
                if (resp.status === 401 || resp.status === 403) {
                    throw new Error(`HTTP error! status: ${resp.status}`);
                }
                throw new Error(`HTTP error! status: ${resp.status}`);
            }
            const dr = await resp.json();
            if (dr && dr.onDutyAgents) {
                appData[dateKey].onDutyAgents = dr.onDutyAgents;
            } else {
                appData[dateKey].onDutyAgents = Array(10).fill('none');
            }
          } catch (error) {
            console.error('loadDailyRoster échoué', error);
            appData[dateKey].onDutyAgents = Array(10).fill('none');
             if (!error.message.includes('401') && !error.message.includes('403')) {
                displayMessageModal("Erreur de Chargement", `Impossible de charger le roster quotidien : ${error.message}`, "error");
            }
          }
        }

        async function saveDailyRoster(dateKey) {
          try {
            // IMPORTANT: Utiliser sessionStorage pour récupérer le token
            const token = sessionStorage.getItem('token');
            if (!token) {
                console.warn('saveDailyRoster: Aucun token trouvé. Authentification requise.');
                return;
            }

            const resp = await fetch(`${API_BASE_URL}/api/daily-roster/${dateKey}`, {
              method: 'POST',
              headers: {
                'Content-Type':'application/json',
                'Authorization': `Bearer ${token}`, // Envoyer le token
                'X-User-Role':'admin'
              },
              credentials: 'include',
              body: JSON.stringify({ onDutyAgents: appData[dateKey].onDutyAgents })
            });
            if (!resp.ok) {
              const errorText = await resp.text();
                if (resp.status === 401 || resp.status === 403) {
                    displayMessageModal("Accès Refusé", "Votre session a expiré ou vous n'êtes pas autorisé. Veuillez vous reconnecter.", "error", () => {
                        sessionStorage.clear();
                        window.location.href = "/index.html";
                    });
                    return;
                }
              throw new Error(`HTTP error! status: ${resp.status}, message: ${errorText}`);
            }
          } catch (error) {
            console.error('saveDailyRoster échoué:', error);
            displayMessageModal("Erreur de Sauvegarde", `Impossible de sauvegarder le roster quotidien : ${error.message}`, "error");
          }
        }

        // Variable globale pour stocker les noms des jours en français
        const DAYS_OF_WEEK_FR = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

        function getWeekAndDayFromDate(dateString) {
            const date = new Date(dateString + 'T12:00:00');
            date.setHours(0, 0, 0, 0);

            const dayNr = (date.getDay() + 6) % 7;
            date.setDate(date.getDate() - dayNr + 3);
            const firstThursday = date.valueOf();
            date.setMonth(0, 1);
            if (date.getDay() !== 4) {
                date.setMonth(0, 1 + ((4 - date.getDay()) + 7) % 7);
            }
            const weekNo = 1 + Math.ceil((firstThursday - date) / 604800000);

            const dayName = DAYS_OF_WEEK_FR[new Date(dateString + 'T12:00:00').getDay()];

            return { weekNo: `week-${weekNo}`, dayName: dayName };
        }

        async function loadAllPersonnelAvailabilities() {
          try {
            const dateKey = formatDateToYYYYMMDD(currentRosterDate);
            const token = sessionStorage.getItem('token'); 
            if (!token) {
                console.warn('loadAllPersonnelAvailabilities: Aucun token trouvé. Authentification requise.');
                displayMessageModal("Session expirée", "Votre session a expiré ou n'est pas valide. Veuillez vous reconnecter.", "error", () => {
                    sessionStorage.clear();
                    window.location.href = "/index.html";
                });
                return; 
            }

            // D'abord, initialiser les disponibilités de TOUS les agents connus à vide pour la date actuelle.
            // Cela assure que tout agent non explicitement disponible par l'API sera traité comme indisponible.
            appData.personnelAvailabilities = {}; // Réinitialise les disponibilités pour la date actuelle
            allAgents.forEach(agent => {
                appData.personnelAvailabilities[agent._id] = {
                    [dateKey]: [] // Par défaut, l'agent est considéré comme indisponible (tableau vide)
                };
            });

            const resp = await fetch(`${API_BASE_URL}/api/agent-availability/${dateKey}`, {
              headers: {
                'Authorization': `Bearer ${token}`, // Utilise le token pour l'authentification
                'X-User-Role':'admin' // Garde l'en-tête de rôle si nécessaire pour le backend
              }
            });
            if (!resp.ok) {
                if (resp.status === 401 || resp.status === 403) {
                     displayMessageModal("Accès Refusé", "Votre session a expiré ou vous n'êtes pas autorisé à charger les disponibilités. Veuillez vous reconnecter.", "error", () => {
                        sessionStorage.clear();
                        window.location.href = "/index.html";
                    });
                    return;
                }
                console.error(`[ERREUR Client] Erreur HTTP lors du chargement des disponibilités: ${resp.status}`);
                throw new Error(`HTTP error! status: ${resp.status}`);
            }
            
            const data = await resp.json(); // data contient { available: [...], onCall: [...] }
            
            // Combiner les agents disponibles et d'astreinte renvoyés par l'API
            const allPersonnelWithAPIResponse = [...(data.available || []), ...(data.onCall || [])];
            
            // Mettre à jour les disponibilités des agents explicitement renvoyés par l'API.
            // Si 'availabilities' est absent ou null/undefined, l'agent sera considéré indisponible (tableau vide).
            allPersonnelWithAPIResponse.forEach(agent => {
                const availabilitiesForAgent = agent.availabilities || []; 
                appData.personnelAvailabilities[agent._id][dateKey] = availabilitiesForAgent;
            });

          } catch (error) {
            console.error("Erreur lors du chargement des disponibilités du personnel (API /api/agent-availability):", error);
            // Pas besoin de réinitialiser appData.personnelAvailabilities ici, il a déjà été initialisé avec les valeurs par défaut.
            // N'afficher la modale que si ce n'est pas un problème de token déjà géré.
            if (!error.message.includes('401') && !error.message.includes('403') && !error.message.includes('Session expirée')) {
                displayMessageModal("Erreur de Chargement", `Impossible de charger les disponibilités du personnel : ${error.message}`, "error");
            }
          }
        }

        async function updateDateDisplay() {
            showSpinner();
            try {
                const dateKey = formatDateToYYYYMMDD(currentRosterDate);
                await fetchAllAgents(); 
                await loadRosterConfig(dateKey);
                await loadDailyRoster(dateKey); 
                await loadAllPersonnelAvailabilities(); // Ceci doit charger les dispo pour TOUS les agents
                initializeDefaultTimeSlotsForDate(dateKey); // S'assure qu'au moins un créneau par défaut existe

                rosterDateInput.valueAsDate = currentRosterDate;
                renderTimeSlotButtons(dateKey);
                renderPersonnelLists(); // Appel pour rafraîchir la liste des agents disponibles
                renderOnDutyAgentsGrid(); // Appel pour rafraîchir la grille des agents d'astreinte
                renderRosterGrid();
            } catch (error) {
                console.error("Erreur lors de la mise à jour et du rendu de l'affichage:", error);
                // Si l'erreur n'a pas déjà été gérée par une modale de session expirée,
                // afficher une alerte plus générique.
                if (!error.message.includes('Session expirée')) {
                    displayMessageModal("Erreur d'Affichage", `Une erreur est survenue lors du chargement ou de l'affichage des données : ${error.message}`, "error");
                }
            } finally {
                hideSpinner();
            }
        }

        // --------------------------------------------------
        // 3️⃣ Rendu & mise à jour de l’affichage
        // --------------------------------------------------

        function initializeDefaultTimeSlotsForDate(dateKey, force = false) {
          if (!appData[dateKey]) {
            appData[dateKey] = {
              timeSlots: {},
              onDutyAgents: Array(10).fill('none')
            };
          }
          if (Object.keys(appData[dateKey].timeSlots).length === 0 || force) {
            const id = `slot_0700_0700_${Date.now()}`;
            appData[dateKey].timeSlots[id] = {
              range: '07:00 - 07:00',
              engines: {}
            };
            Object.keys(engineDetails).forEach(et => {
              appData[dateKey].timeSlots[id].engines[et] =
                createEmptyEngineAssignment(et);
            });
          }
        }


        function renderTimeSlotButtons(dateKey) {
          const c = document.getElementById('time-slot-buttons-container');
          c.innerHTML = '';

          let clickTimeout = null;
          const DBLCLICK_DELAY = 300;

          // bouton “+”
          const add = document.createElement('button');
          add.textContent = '+';
          add.classList.add('add-time-slot-btn');
          add.addEventListener('click', () => {
            showTimeRangeSelectionModal('07:00', '07:00', async (ns, ne) => {
              const id = `slot_${ns.replace(':','')}_${ne.replace(':','')}_${Date.now()}`;
              appData[dateKey].timeSlots[id] = {
                range: `${ns} - ${ne}`,
                engines: {}
              };
              Object.keys(engineDetails).forEach(et => {
                appData[dateKey].timeSlots[id].engines[et] =
                  createEmptyEngineAssignment(et);
              });
              await saveRosterConfig(dateKey);
              renderTimeSlotButtons(dateKey);
              renderRosterGrid();
              showMainRosterGrid();
            });
          });
          c.appendChild(add);

          // boutons existants
          Object.entries(appData[dateKey].timeSlots)
            .sort((a,b)=> {
              const sA = parseTimeToMinutes(a[1].range.split(' - ')[0]);
              const sB = parseTimeToMinutes(b[1].range.split(' - ')[0]);
              return sA - sB;
            })
            .forEach(([slotId, slot]) => {
              const btn = document.createElement('button');
              btn.textContent = slot.range;
              btn.classList.add('time-slot-button');
              btn.dataset.slotId = slotId;

              btn.addEventListener('click', () => {
                clearTimeout(clickTimeout);

                clickTimeout = setTimeout(() => {
                  document.querySelectorAll('.time-slot-button').forEach(b => b.classList.remove('active'));
                  btn.classList.add('active');
                  displayEnginesForSlot(dateKey, slotId);
                }, DBLCLICK_DELAY);
              });

              btn.addEventListener('dblclick', async (event) => {
                event.stopPropagation();
                clearTimeout(clickTimeout);
                
                const [cs, ce] = slot.range.split(' - ');
                showTimeRangeSelectionModal(cs, ce, async (ns, ne) => {
                  slot.range = `${ns} - ${ne}`;
                  await saveRosterConfig(dateKey);

                  let sMin = parseTimeToMinutes(ns),
                      eMin = parseTimeToMinutes(ne);
                  if (eMin <= sMin) eMin += 24*60;
                  const dayEndMinutes = parseTimeToMinutes('07:00') + 24*60;

                  if (eMin < dayEndMinutes && ns !== ne) {
                    const newSlotStartTime = ne;
                    const newSlotEndTime = '07:00';

                    const newSlotId = `slot_${newSlotStartTime.replace(':','')}_${newSlotEndTime.replace(':','')}_${Date.now()}`;
                    
                    const slotExists = Object.values(appData[dateKey].timeSlots).some(s => {
                        const [existingStart, existingEnd] = s.range.split(' - ');
                        return existingStart === newSlotStartTime && existingEnd === newSlotEndTime;
                    });

                    if (!slotExists) {
                        appData[dateKey].timeSlots[newSlotId] = {
                            range: `${newSlotStartTime} - ${newSlotEndTime}`,
                            engines: {}
                        };
                        Object.keys(engineDetails).forEach(et => {
                            appData[dateKey].timeSlots[newSlotId].engines[et] = createEmptyEngineAssignment(et);
                        });
                        await saveRosterConfig(dateKey);
                    }
                  }
                  renderTimeSlotButtons(dateKey);
                  renderRosterGrid();
                  showMainRosterGrid();
                });
              });

              const deleteBtn = document.createElement('button');
              deleteBtn.textContent = 'x';
              deleteBtn.classList.add('delete-time-slot-btn');
              deleteBtn.addEventListener('click', async (event) => {
                event.stopPropagation();
                if (await confirm("Voulez-vous vraiment supprimer le créneau " + slot.range + " ?")) { // Utilisation de await confirm()
                  delete appData[dateKey].timeSlots[slotId];
                  await saveRosterConfig(dateKey);
                  renderTimeSlotButtons(dateKey);
                  renderRosterGrid();
                  showMainRosterGrid();
                }
              });
              btn.appendChild(deleteBtn);
              c.appendChild(btn);
            });
        }

        function renderRosterGrid() {
          rosterGridContainer.innerHTML = '';
          const table = document.createElement('table');
          table.classList.add('roster-table');

          const thead = document.createElement('thead');
          const headerRow = document.createElement('tr');
          const emptyTh = document.createElement('th');
          headerRow.appendChild(emptyTh);

          Object.keys(engineDetails).forEach(engineType => {
            const th = document.createElement('th');
            th.textContent = engineDetails[engineType].name;
            headerRow.appendChild(th);
          });
          thead.appendChild(headerRow);
          table.appendChild(thead);

          const tbody = document.createElement('tbody');
          const dateKey = formatDateToYYYYMMDD(currentRosterDate);

          const sortedTimeSlots = Object.entries(appData[dateKey].timeSlots || {}).sort((a, b) => {
            const sA = parseTimeToMinutes(a[1].range.split(' - ')[0]);
            const sB = parseTimeToMinutes(b[1].range.split(' - ')[0]);
            return sA - sB;
          });

          sortedTimeSlots.forEach(([slotId, slot]) => {
            const row = document.createElement('tr');
            const timeCell = document.createElement('td');
            timeCell.classList.add('time-slot-cell');
            timeCell.textContent = slot.range;
            row.appendChild(timeCell);

            Object.keys(engineDetails).forEach(engineType => {
              const engineCell = document.createElement('td');
              engineCell.classList.add('roster-cell');
              engineCell.dataset.slotId = slotId;
              engineCell.dataset.engineType = engineType;

              const assignment = slot.engines[engineType] || {}; 
              if (!assignment.personnel || typeof assignment.personnel !== 'object') {
                  assignment.personnel = createEmptyEngineAssignment(engineType);
              }

              const engConfig = engineDetails[engineType];
              if (!engConfig) {
                  console.warn(`Configuration d'engin introuvable pour le type : ${engineType}.`);
                  engineCell.textContent = "Erreur config";
                  row.appendChild(engineCell);
                  return; 
              }

              let isEngineIndispo = false;
              if (engConfig.criticalRoles) {
                  for (const criticalRoleId of engConfig.criticalRoles) {
                      const assignedAgentId = (assignment && assignment.personnel ? assignment.personnel[criticalRoleId] : undefined);
                      const assignedAgent = allAgents.find(a => a._id === assignedAgentId);

                      if (!assignedAgentId || assignedAgentId === 'none' || assignedAgentId === null ||
                          (assignedAgent && !isAgentQualifiedForRole(assignedAgent, criticalRoleId))) {
                          isEngineIndispo = true;
                          break;
                      }
                  }
              }

              engineCell.innerHTML = `
                  <div class="engine-display">
                      <span class="engine-name-mini">${engConfig.name}</span>
                      <ul class="assigned-personnel-mini">
                          ${engConfig.roles.map(roleDef => {
                              const agentId = (assignment && assignment.personnel ? assignment.personnel[roleDef.id] : undefined);
                              const agent = allAgents.find(a => a._id === agentId);
                              const agentDisplay = agent && agentId !== 'none' ? `${agent.prenom.charAt(0)}. ${agent.nom}` : '';
                              const isQualified = agent && isAgentQualifiedForRole(agent, roleDef.id);
                              
                              let agentClass = '';
                              let agentTitle = '';
                              if (agentId !== 'none' && !isQualified) {
                                  agentClass = 'unqualified-mini';
                                  agentTitle = `Non qualifié pour ${roleDef.name}`;
                              } else if (roleDef.required && (!agentId || agentId === 'none')) {
                                  agentClass = 'missing-mini';
                                  agentTitle = `Manquant (Rôle obligatoire ${roleDef.name})`;
                              }

                              return `<li class="${agentClass}" title="${agentTitle}">
                                        <span class="role-abbr">${roleDef.name.substring(0,2)}:</span> ${agentDisplay}
                                     </li>`;
                          }).join('')}
                      </ul>
                  </div>
                  ${isEngineIndispo ? '<div class="engine-indispo-overlay-mini">INDISPO</div>' : ''}
              `;

              engineCell.addEventListener('dragover', handleDragOver);
              engineCell.addEventListener('dragleave', handleDragLeave);
              engineCell.addEventListener('drop', handleDropOnEngine);

              row.appendChild(engineCell);
            });
            tbody.appendChild(row);
          });
          table.appendChild(tbody);

          rosterGridContainer.appendChild(table);
          document.querySelector('.loading-message')?.remove();
        }

        function renderPersonnelLists() {
            availablePersonnelList.innerHTML = '';
            const dateKey = formatDateToYYYYMMDD(currentRosterDate);
            const onDutyAgents = appData[dateKey]?.onDutyAgents || Array(10).fill('none');

            const filteredAvailableAgents = allAgents.filter(agent => {
                const isAlreadyOnDuty = onDutyAgents.includes(agent._id);
                // Récupère les disponibilités de l'agent pour la date sélectionnée
                const agentAvailabilities = appData.personnelAvailabilities[agent._id] || {};
                const dailyAvailabilities = agentAvailabilities[dateKey] || [];
                
                // N'inclut que les agents qui ne sont PAS d'astreinte ET qui ont au moins une disponibilité renseignée.
                return !isAlreadyOnDuty && dailyAvailabilities.length > 0;
            });

            if (filteredAvailableAgents.length === 0) {
                availablePersonnelList.innerHTML = '<p class="no-available-personnel">Aucun agent disponible avec des disponibilités renseignées pour cette journée.</p>';
            }


            filteredAvailableAgents.forEach(agent => {
                const item = document.createElement('div');
                item.classList.add('available-personnel-item');
                item.style.marginBottom = '10px';
                
                const agentInfoDiv = document.createElement('div');
                agentInfoDiv.classList.add('agent-info');
                agentInfoDiv.innerHTML = `<span class="agent-name">${agent.prenom} ${agent.nom || 'Agent Inconnu'}</span>`;
                item.appendChild(agentInfoDiv);

                const availabilityBarWrapper = document.createElement('div');
                availabilityBarWrapper.classList.add('availability-bar-wrapper');
                item.appendChild(availabilityBarWrapper);

                const availabilityBar = document.createElement('div');
                availabilityBar.classList.add('availability-bar');
                availabilityBarWrapper.appendChild(availabilityBar);

                const availabilityBarBase = document.createElement('div');
                availabilityBarBase.classList.add('availability-base-bar');
                availabilityBar.appendChild(availabilityBarBase);

                const timeLegend = document.createElement('div');
                timeLegend.classList.add('time-legend');
                timeLegend.innerHTML = `
                    <span>07:00</span>
                    <span>13:00</span>
                    <span>19:00</span>
                    <span>01:00</span>
                    <span>07:00</span>
                `;
                availabilityBarWrapper.appendChild(timeLegend);

                item.dataset.agentId = agent._id;
                item.setAttribute('draggable', true);
                item.addEventListener('dragstart', handleDragStart);

                const agentAvailabilities = appData.personnelAvailabilities[agent._id] || {};
                // Utilise appData.personnelAvailabilities[agent._id][dateKey] qui est déjà initialisé
                const dailyAvailabilities = agentAvailabilities[dateKey] || []; 

                const fullDayMinutes = 24 * 60; 
                const thirtyMinInterval = 30;
                const dayStartOffsetMinutes = 7 * 60; 

                // Si aucune disponibilité n'est définie pour l'agent (dailyAvailabilities est vide),
                // on génère une seule plage pour toute la journée 07:00-07:00 pour la barre visuelle.
                // NOTE: Avec le nouveau filtre, dailyAvailabilities ne sera jamais vide ici si l'agent est affiché.
                const visualAvailabilities = dailyAvailabilities.length > 0 
                    ? dailyAvailabilities 
                    : [{ start: "07:00", end: "07:00" }]; // Représente une indisponibilité totale si pas de plages

                // Boucle pour couvrir l'ensemble de la journée de 07:00 à 07:00 le lendemain (48 créneaux de 30min)
                // Afin de déterminer l'état de chaque segment visuel.
                for (let k = 0; k < (fullDayMinutes / thirtyMinInterval); k++) {
                    let intervalStartMin = (dayStartOffsetMinutes + k * thirtyMinInterval) % fullDayMinutes;
                    let intervalEndMin = (dayStartOffsetMinutes + (k + 1) * thirtyMinInterval) % fullDayMinutes;

                    const currentInterval = {
                        start: `${String(Math.floor(intervalStartMin / 60)).padStart(2, '0')}:${String(intervalStartMin % 60).padStart(2, '0')}`,
                        end: `${String(Math.floor(intervalEndMin / 60)).padStart(2, '0')}:${String(intervalEndMin % 60).padStart(2, '0')}`
                    };

                    let isAvailable = false;
                    let originalRange = null; 

                    for (const range of visualAvailabilities) { // Utilise visualAvailabilities ici
                        // Utilise la fonction doTimeRangesOverlap modifiée
                        if (doTimeRangesOverlap(currentInterval, range)) {
                            isAvailable = true;
                            originalRange = range;
                            break;
                        }
                    }

                    // On utilise getAvailabilitySegments pour calculer la position et la largeur
                    // du segment *dans la barre de 24h virtuelle* (décalée à 07:00).
                    const segmentsToRender = getAvailabilitySegments(currentInterval.start, currentInterval.end);

                    segmentsToRender.forEach(segment => {
                        const highlightSegment = document.createElement('div');
                        highlightSegment.classList.add('availability-highlight-segment');
                        
                        const segmentText = document.createElement('span'); // Élément pour le texte
                        segmentText.classList.add('availability-segment-text');

                        if (isAvailable && dailyAvailabilities.length > 0) { // S'assurer que c'est vraiment disponible si des plages existent
                            highlightSegment.classList.add('available');
                            highlightSegment.title = `Disponible: ${originalRange.start} - ${originalRange.end}`;
                            segmentText.textContent = `${originalRange.start} - ${originalRange.end}`; // Texte pour les segments disponibles
                        } else {
                            highlightSegment.classList.add('unavailable');
                            highlightSegment.title = `Indisponible: ${currentInterval.start} - ${currentInterval.end}`;
                            segmentText.textContent = `${currentInterval.start} - ${currentInterval.end}`; // Texte pour les segments indisponibles (intervalle de 30 min)
                        }
                        highlightSegment.style.left = `${segment.left}%`;
                        highlightSegment.style.width = `${segment.width}%`;
                        
                        highlightSegment.appendChild(segmentText); // Ajouter le texte au segment
                        availabilityBarBase.appendChild(highlightSegment);
                    });
                }
                
                item.appendChild(createTooltipForAvailabilityBar(dailyAvailabilities, dailyAvailabilities.length === 0)); // Passer true si pas de dispo
                availablePersonnelList.appendChild(item);
            });
        }

            function renderOnDutyAgentsGrid() {
                onDutyAgentsGrid.innerHTML = '';
                const dateKey = formatDateToYYYYMMDD(currentRosterDate);
                const onDutyAgents = appData[dateKey]?.onDutyAgents || Array(10).fill('none');

                for (let i = 0; i < 10; i++) {
                    const slot = document.createElement('div');
                    slot.classList.add('on-duty-slot');
                    slot.dataset.slotIndex = i;
                    slot.addEventListener('dragover',  handleDragOver);
                    slot.addEventListener('dragleave', handleDragLeave);
                    slot.addEventListener('drop',      handleDropOnDuty);

                    const agentId = onDutyAgents[i];
                    if (agentId && agentId !== 'none') {
                        const agent = allAgents.find(a => a._id === agentId);
                        if (agent) {
                            slot.classList.add('filled');
                            slot.dataset.agentId = agent._id;
                            slot.setAttribute('draggable', true);
                            slot.addEventListener('dragstart', handleDragStart);

                            slot.innerHTML = `
                                <div class="agent-info">
                                    <span class="agent-name">${agent.prenom} ${agent.nom || 'Agent Inconnu'}</span>
                                </div>
                                <div class="availability-bar-wrapper">
                                    <div class="availability-bar">
                                        <div class="availability-base-bar"></div>
                                    </div>
                                    <div class="time-legend">
                                        <span>07:00</span>
                                        <span>13:00</span>
                                        <span>19:00</span>
                                        <span>01:00</span>
                                        <span>07:00</span>
                                    </div>
                                </div>
                                <button class="remove-agent-btn">x</button>
                            `;

                            const availabilityBarBase = slot.querySelector('.availability-base-bar');
                            const agentAvailabilities = appData.personnelAvailabilities[agent._id] || {};
                            const dailyAvailabilities = agentAvailabilities[dateKey] || [];

                            const fullDayMinutes = 24 * 60;
                            const thirtyMinInterval = 30;
                            const dayStartOffsetMinutes = 7 * 60;

                            const visualAvailabilities = dailyAvailabilities.length > 0 
                                ? dailyAvailabilities 
                                : [{ start: "07:00", end: "07:00" }]; // Représente une indisponibilité totale si pas de plages

                            for (let k = 0; k < (fullDayMinutes / thirtyMinInterval); k++) {
                                let intervalStartMin = (dayStartOffsetMinutes + k * thirtyMinInterval) % fullDayMinutes;
                                let intervalEndMin = (dayStartOffsetMinutes + (k + 1) * thirtyMinInterval) % fullDayMinutes;

                                let comparisonIntervalEndMin = intervalEndMin;
                                if (comparisonIntervalEndMin < intervalStartMin) {
                                    comparisonIntervalEndMin += fullDayMinutes;
                                }

                                const currentInterval = {
                                    start: `${String(Math.floor(intervalStartMin / 60)).padStart(2, '0')}:${String(intervalStartMin % 60).padStart(2, '0')}`,
                                    end: `${String(Math.floor(intervalEndMin / 60)).padStart(2, '0')}:${String(intervalEndMin % 60).padStart(2, '0')}`
                                };
                                if (currentInterval.end === "00:00" && intervalEndMin !== 0) {
                                    currentInterval.end = "24:00";
                                }


                                let isAvailable = false;
                                let originalRange = null;

                                for (const range of visualAvailabilities) {
                                    if (doTimeRangesOverlap(currentInterval, range)) {
                                        isAvailable = true;
                                        originalRange = range;
                                        break;
                                    }
                                }

                                const segmentsToRender = getAvailabilitySegments(currentInterval.start, currentInterval.end);

                                segmentsToRender.forEach(segment => {
                                    const highlightSegment = document.createElement('div');
                                    highlightSegment.classList.add('availability-highlight-segment');

                                    const segmentText = document.createElement('span'); // Élément pour le texte
                                    segmentText.classList.add('availability-segment-text');

                                    if (isAvailable && dailyAvailabilities.length > 0) {
                                        highlightSegment.classList.add('available');
                                        highlightSegment.title = `Disponible: ${originalRange.start} - ${originalRange.end}`;
                                        segmentText.textContent = `${originalRange.start} - ${originalRange.end}`; // Texte pour les segments disponibles
                                    } else {
                                        highlightSegment.classList.add('unavailable');
                                        highlightSegment.title = `Indisponible: ${currentInterval.start} - ${currentInterval.end}`;
                                        segmentText.textContent = `${currentInterval.start} - ${currentInterval.end}`; // Texte pour les segments indisponibles (intervalle de 30 min)
                                    }
                                    highlightSegment.style.left = `${segment.left}%`;
                                    highlightSegment.style.width = `${segment.width}%`;
                                    highlightSegment.appendChild(segmentText); // Ajouter le texte au segment
                                    availabilityBarBase.appendChild(highlightSegment);
                                });
                            }

                            slot.appendChild(createTooltipForAvailabilityBar(dailyAvailabilities, dailyAvailabilities.length === 0)); // Passer true si pas de dispo
                            
                            const removeBtn = slot.querySelector('.remove-agent-btn');
                            removeBtn.addEventListener('click', async (e) => {
                            e.stopPropagation();
                            appData[dateKey].onDutyAgents[i] = 'none';
                            await saveDailyRoster(dateKey);
                            renderPersonnelLists();
                            renderOnDutyAgentsGrid();
                            renderRosterGrid();
                            });

                        } else {
                            slot.textContent = `Astreinte ${i+1}`;
                        }
                    } else {
                        slot.textContent = `Astreinte ${i+1}`;
                    }
                    onDutyAgentsGrid.appendChild(slot);
                }
            }

            // Nouvelle fonction pour créer le tooltip d'affichage des plages complètes
            function createTooltipForAvailabilityBar(dailyAvailabilities, showUnavailable = false) {
                const tooltip = document.createElement('div');
                tooltip.classList.add('availability-bar-tooltip');
                tooltip.style.display = 'none';

                if (dailyAvailabilities.length > 0) {
                    const ul = document.createElement('ul');
                    ul.innerHTML += '<li><strong>Disponibilités:</strong></li>';
                    dailyAvailabilities.forEach(range => {
                        const li = document.createElement('li');
                        li.textContent = `${range.start} - ${range.end}`;
                        ul.appendChild(li);
                    });
                    tooltip.appendChild(ul);
                } else if (showUnavailable) {
                    const p = document.createElement('p');
                    p.textContent = 'Agent indisponible toute la journée.';
                    tooltip.appendChild(p);
                } else {
                    const p = document.createElement('p');
                    p.textContent = 'Aucune disponibilité renseignée.';
                    tooltip.appendChild(p);
                }

                const parentItem = tooltip.closest('.available-personnel-item') || tooltip.closest('.on-duty-slot');
                if (parentItem) {
                    parentItem.addEventListener('mouseenter', () => {
                        tooltip.style.display = 'block';
                    });
                    parentItem.addEventListener('mouseleave', () => {
                        tooltip.style.display = 'none';
                    });
                }

                return tooltip;
            }


            async function updateDateDisplay() {
            showSpinner();
            const dateKey = formatDateToYYYYMMDD(currentRosterDate);
            await fetchAllAgents(); 
            await loadRosterConfig(dateKey);
            await loadDailyRoster(dateKey); 
            await loadAllPersonnelAvailabilities(); // Ceci doit charger les dispo pour TOUS les agents
            initializeDefaultTimeSlotsForDate(dateKey); // S'assure qu'au moins un créneau par défaut existe

            rosterDateInput.valueAsDate = currentRosterDate;
            renderTimeSlotButtons(dateKey);
            renderPersonnelLists(); // Appel pour rafraîchir la liste des agents disponibles
            renderOnDutyAgentsGrid(); // Appel pour rafraîchir la grille des agents d'astreinte
            renderRosterGrid();
            hideSpinner();
            }

            // --------------------------------------------------
            // 4️⃣ Handlers & Bootstrap
            // --------------------------------------------------

            /**
             * Affiche une modale pour sélectionner une plage horaire.
             * @param {string} currentStart - Heure de début par défaut (HH:MM).
             * @param {string} currentEnd - Heure de fin par défaut (HH:MM).
             * @param {function(string, string)} callback - Fonction appelée avec les nouvelles heures (start, end) si l'utilisateur valide.
             */
            function showTimeRangeSelectionModal(currentStart, currentEnd, callback) {
            let modal = document.getElementById('time-range-modal');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'time-range-modal';
                modal.classList.add('custom-modal');
                modal.innerHTML = `
                <div class="modal-content">
                    <h2>Définir la Plage Horaire</h2>
                    <div class="modal-form-group">
                    <label for="start-time">Heure de début:</label>
                    <select id="start-time"></select>
                    </div>
                    <div class="modal-form-group">
                    <label for="end-time">Heure de fin:</label>
                    <select id="end-time"></select>
                    </div>
                    <div class="modal-actions">
                    <button id="cancel-time-range" class="btn btn-secondary">Annuler</button>
                    <button id="save-time-range" class="btn btn-primary">Enregistrer</button>
                    </div>
                </div>
                `;
                document.body.appendChild(modal);
            }

            const startTimeSelect = modal.querySelector('#start-time');
            const endTimeSelect = modal.querySelector('#end-time');
            const saveButton = modal.querySelector('#save-time-range');
            const cancelButton = modal.querySelector('#cancel-time-range');

            startTimeSelect.innerHTML = '';
            endTimeSelect.innerHTML = '';

            const times = [];
            for (let h = 0; h < 24; h++) {
                for (let m = 0; m < 60; m += 30) {
                const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                times.push(timeStr);
                }
            }

            times.forEach(time => {
                const startOption = document.createElement('option');
                startOption.value = time;
                startOption.textContent = time;
                startTimeSelect.appendChild(startOption);

                const endOption = document.createElement('option');
                endOption.value = time;
                endOption.textContent = time;
                endTimeSelect.appendChild(endOption);
            });

            startTimeSelect.value = currentStart;
            endTimeSelect.value = currentEnd;

            modal.style.display = 'flex';

            saveButton.onclick = n