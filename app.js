// app.js - Main orchestrator

import { PeerConnection } from './peer-connection.js';
import { CameraManager } from './camera.js';
import { ChatManager } from './chat.js';
import { LocationManager } from './location.js';
import { UIManager } from './ui.js';
import { ConnectionSetup } from './connection-setup.js';
import { EventHandlers } from './event-handlers.js';
import { AuthManager } from './auth.js';
import { AdminManager } from './admin.js';

// Initialize auth first
const auth = new AuthManager();
const admin = new AdminManager(auth);

// Check if user is logged in
const params = new URLSearchParams(window.location.search);
const isRecipient = params.get("r") || params.get("monitor");
const currentUser = auth.getCurrentUser();

if (!currentUser && !isRecipient) {
    // Show login screen
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('appScreen').style.display = 'none';
    
    // Login handler
    document.getElementById('btnLogin').onclick = async () => {
        const username = document.getElementById('loginUsername').value;
        const password = document.getElementById('loginPassword').value;
        const profile = document.getElementById('loginProfile').value;
        const errorDiv = document.getElementById('loginError');
        
        try {
            await auth.login(username, password, profile);
            location.reload();
        } catch (error) {
            errorDiv.textContent = error.message;
        }
    };
} else {
    // Show app screen
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('appScreen').style.display = 'block';
    
    // Display user info only if logged in
    if (currentUser) {
        document.getElementById('userInfo').textContent = `${currentUser.username} (${currentUser.profile})`;
    }
    
    // Show admin button for supervisors (only for logged in users)
    if (currentUser && auth.isSupervisor()) {
        document.getElementById('btnAdmin').style.display = 'inline-block';
        document.getElementById('connectionsTab').style.display = 'inline-block';
    }
    
    // Logout handler
    document.getElementById('btnLogout').onclick = () => {
        auth.logout();
        location.reload();
    };
    
    // Hide logout button for recipients
    if (isRecipient) {
        document.getElementById('btnLogout').style.display = 'none';
    }
    
    // Admin panel handlers
    document.getElementById('btnAdmin').onclick = () => {
        document.getElementById('adminPanel').style.display = 'flex';
        admin.loadUsers();
        if (auth.isSupervisor()) {
            admin.loadConnections();
        }
    };
    
    document.getElementById('btnCloseAdmin').onclick = () => {
        document.getElementById('adminPanel').style.display = 'none';
        admin.cancelEdit();
    };
    
    // Admin tabs
    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.onclick = () => {
            document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.admin-tab-content').forEach(c => c.style.display = 'none');
            
            tab.classList.add('active');
            document.getElementById(tab.dataset.tab + 'Tab').style.display = 'block';
            
            if (tab.dataset.tab === 'connections') {
                admin.loadConnections();
            }
        };
    });
    
    // User management handlers
    document.getElementById('btnCreateUser').onclick = async () => {
        const username = document.getElementById('newUsername').value;
        const password = document.getElementById('newPassword').value;
        const profile = document.getElementById('newProfile').value;
        
        try {
            await admin.createUser(username, password, profile);
            document.getElementById('newUsername').value = '';
            document.getElementById('newPassword').value = '';
            alert('Usuário criado com sucesso');
        } catch (error) {
            alert(error.message);
        }
    };
    
    document.getElementById('btnUpdateUser').onclick = async () => {
        const username = admin.editingUser;
        const password = document.getElementById('newPassword').value;
        const profile = document.getElementById('newProfile').value;
        
        try {
            await admin.updateUser(username, password, profile);
            alert('Usuário atualizado com sucesso');
        } catch (error) {
            alert(error.message);
        }
    };
    
    document.getElementById('btnCancelEdit').onclick = () => {
        admin.cancelEdit();
    };
    
    // Initialize managers
    const peerConnection = new PeerConnection();
    const camera = new CameraManager();
    const location = new LocationManager();
    const ui = new UIManager();
    const chat = new ChatManager(peerConnection);

    // Initialize connection setup and event handlers
    const connectionSetup = new ConnectionSetup(peerConnection, camera, chat, location, ui);
    const eventHandlers = new EventHandlers(peerConnection, camera, chat, ui);

    // Get URL parameters (already defined above for recipient check)
    const room = params.get("r");
    const monitor = params.get("monitor");

    // Load stored link
    ui.loadStoredLink();

    // Initialize application
    async function init() {
        const peerId = await peerConnection.initialize();
        
        // Track connection for operators (only if logged in)
        if (currentUser && auth.isOperator() && !room && !monitor) {
            await admin.trackConnection(peerId, currentUser.username);
        }

        if (monitor) {
            // Supervisor monitoring mode
            ui.hideControlsForRecipient();
            await connectionSetup.setupRecipientMode();
        } else if (!room) {
            // Sender mode (operator or supervisor creating link)
            ui.btnLink.disabled = false;
            ui.setStatus(ui.generatedLink ? "Link ativo. Aguardando visitante..." : "Conectado. Clique em 'Gerar Link'");
            connectionSetup.setupSenderMode();
        } else {
            // Recipient mode
            ui.hideControlsForRecipient();
            await connectionSetup.setupRecipientMode();
        }
    }

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
}