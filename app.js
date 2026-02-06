// app.js - Main orchestrator

import { PeerConnection } from './peer-connection.js';
import { CameraManager } from './camera.js';
import { ChatManager } from './chat.js';
import { LocationManager } from './location.js';
import { UIManager } from './ui.js';
import { ConnectionSetup } from './connection-setup.js';
import { EventHandlers } from './event-handlers.js';

// Initialize managers
const peerConnection = new PeerConnection();
const camera = new CameraManager();
const location = new LocationManager();
const ui = new UIManager();
const chat = new ChatManager(peerConnection);

// Initialize connection setup and event handlers
const connectionSetup = new ConnectionSetup(peerConnection, camera, chat, location, ui);
const eventHandlers = new EventHandlers(peerConnection, camera, chat, ui);

// Get URL parameters
const params = new URLSearchParams(window.location.search);
const room = params.get("r");

// Load stored link
ui.loadStoredLink();

// Initialize application
async function init() {
    const peerId = await peerConnection.initialize();

    if (!room) {
        // Sender mode
        ui.btnLink.disabled = false;
        ui.setStatus(ui.generatedLink ? "Link ativo. Aguardando visitante..." : "Conectado. Clique em 'Gerar Link'");
        connectionSetup.setupSenderMode();
    } else {
        // Recipient mode
        ui.hideControlsForRecipient();
        await connectionSetup.setupRecipientMode();
    }
}

// removed setupSenderMode() - moved to ConnectionSetup class
// removed setupRecipientMode() - moved to ConnectionSetup class
// removed button event handlers - moved to EventHandlers class

// Start application
init().catch(err => {
    console.error("Initialization error:", err);
    ui.setStatus("Erro ao inicializar. Recarregue a página.", "#ef4444");
});

// Global error handler for unhandled promise rejections
window.addEventListener('unhandledrejection', event => {
    console.error('Unhandled rejection:', event.reason);
    event.preventDefault();
});