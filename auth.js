export class AuthManager {
    constructor() {
        this.currentUser = null;
        this.db = null;
        this.initFirebase();
    }

    initFirebase() {
        const firebaseConfig = {
            apiKey: "AIzaSyAuuc4mIZypUas8APwhGHps-y6eL8f5uRY",
            authDomain: "live-93cb0.firebaseapp.com",
            databaseURL: "https://live-93cb0-default-rtdb.firebaseio.com",
            projectId: "live-93cb0",
            storageBucket: "live-93cb0.firebasestorage.app",
            messagingSenderId: "43532928616",
            appId: "1:43532928616:web:e467ac622df6e15f971ddd",
            measurementId: "G-G41JJ6219X"
        };

        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        this.db = firebase.database();
        
        // Create default supervisor if not exists
        this.createDefaultSupervisor();
    }

    async createDefaultSupervisor() {
        const ref = this.db.ref('users/sales');
        const snapshot = await ref.once('value');
        if (!snapshot.exists()) {
            await ref.set({
                username: 'sales',
                password: 'daqta',
                profile: 'supervisor'
            });
        }
    }

    async login(username, password, profile) {
        const ref = this.db.ref(`users/${username}`);
        const snapshot = await ref.once('value');
        const user = snapshot.val();
        
        if (!user) {
            throw new Error('Usuário não encontrado');
        }
        
        if (user.password !== password) {
            throw new Error('Senha incorreta');
        }
        
        if (user.profile !== profile) {
            throw new Error('Perfil incorreto');
        }
        
        this.currentUser = {
            username: user.username,
            profile: user.profile
        };
        
        localStorage.setItem('livecam_user', JSON.stringify(this.currentUser));
        return this.currentUser;
    }

    logout() {
        this.currentUser = null;
        localStorage.removeItem('livecam_user');
    }

    getCurrentUser() {
        if (this.currentUser) return this.currentUser;
        
        const stored = localStorage.getItem('livecam_user');
        if (stored) {
            this.currentUser = JSON.parse(stored);
        }
        return this.currentUser;
    }

    isSupervisor() {
        return this.currentUser && this.currentUser.profile === 'supervisor';
    }

    isOperator() {
        return this.currentUser && this.currentUser.profile === 'operador';
    }
}