export class AdminManager {
    constructor(auth) {
        this.auth = auth;
        this.db = auth.db;
        this.editingUser = null;
    }

    async loadUsers() {
        const ref = this.db.ref('users');
        const snapshot = await ref.once('value');
        const users = snapshot.val() || {};
        
        const usersList = document.getElementById('usersList');
        usersList.innerHTML = '';
        
        Object.keys(users).forEach(username => {
            const user = users[username];
            const userDiv = document.createElement('div');
            userDiv.className = 'user-item';
            userDiv.innerHTML = `
                <span><strong>${user.username}</strong> - ${user.profile}</span>
                <div>
                    <button class="btn-edit" data-username="${user.username}">Editar</button>
                    <button class="btn-delete" data-username="${user.username}">Excluir</button>
                </div>
            `;
            usersList.appendChild(userDiv);
        });
        
        // Add event listeners
        document.querySelectorAll('.btn-edit').forEach(btn => {
            btn.onclick = () => this.editUser(btn.dataset.username);
        });
        
        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.onclick = () => this.deleteUser(btn.dataset.username);
        });
    }

    async createUser(username, password, profile) {
        if (!username || !password) {
            throw new Error('Usuário e senha são obrigatórios');
        }
        
        const ref = this.db.ref(`users/${username}`);
        const snapshot = await ref.once('value');
        
        if (snapshot.exists()) {
            throw new Error('Usuário já existe');
        }
        
        await ref.set({
            username,
            password,
            profile
        });
        
        await this.loadUsers();
    }

    async editUser(username) {
        const ref = this.db.ref(`users/${username}`);
        const snapshot = await ref.once('value');
        const user = snapshot.val();
        
        if (!user) return;
        
        this.editingUser = username;
        document.getElementById('newUsername').value = user.username;
        document.getElementById('newPassword').value = user.password;
        document.getElementById('newProfile').value = user.profile;
        document.getElementById('newUsername').disabled = true;
        
        document.getElementById('btnCreateUser').style.display = 'none';
        document.getElementById('btnUpdateUser').style.display = 'inline-block';
        document.getElementById('btnCancelEdit').style.display = 'inline-block';
    }

    async updateUser(username, password, profile) {
        if (!password) {
            throw new Error('Senha é obrigatória');
        }
        
        const ref = this.db.ref(`users/${username}`);
        await ref.update({
            password,
            profile
        });
        
        this.cancelEdit();
        await this.loadUsers();
    }

    async deleteUser(username) {
        if (!confirm(`Excluir usuário ${username}?`)) return;
        
        if (username === 'sales') {
            alert('Não é possível excluir o usuário supervisor padrão');
            return;
        }
        
        const ref = this.db.ref(`users/${username}`);
        await ref.remove();
        await this.loadUsers();
    }

    cancelEdit() {
        this.editingUser = null;
        document.getElementById('newUsername').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('newProfile').value = 'operador';
        document.getElementById('newUsername').disabled = false;
        
        document.getElementById('btnCreateUser').style.display = 'inline-block';
        document.getElementById('btnUpdateUser').style.display = 'none';
        document.getElementById('btnCancelEdit').style.display = 'none';
    }

    async trackConnection(peerId, username) {
        const ref = this.db.ref(`connections/${peerId}`);
        await ref.set({
            peerId,
            username,
            timestamp: Date.now(),
            active: true
        });
    }

    async deactivateConnection(peerId) {
        const ref = this.db.ref(`connections/${peerId}`);
        await ref.update({
            active: false,
            disconnectedAt: Date.now()
        });
    }

    async loadConnections() {
        const ref = this.db.ref('connections');
        const snapshot = await ref.once('value');
        const connections = snapshot.val() || {};
        
        const connectionsList = document.getElementById('connectionsList');
        connectionsList.innerHTML = '';
        
        Object.keys(connections).forEach(peerId => {
            const conn = connections[peerId];
            if (conn.active) {
                const connDiv = document.createElement('div');
                connDiv.className = 'connection-item';
                const date = new Date(conn.timestamp).toLocaleString();
                connDiv.innerHTML = `
                    <span><strong>${conn.username}</strong> - ${date}</span>
                    <button class="btn-monitor" data-peerid="${conn.peerId}">Monitorar</button>
                `;
                connectionsList.appendChild(connDiv);
            }
        });
        
        document.querySelectorAll('.btn-monitor').forEach(btn => {
            btn.onclick = () => this.monitorConnection(btn.dataset.peerid);
        });
    }

    monitorConnection(peerId) {
        // Open monitoring in new window
        const monitorUrl = `${location.origin}${location.pathname}?monitor=${peerId}`;
        window.open(monitorUrl, '_blank');
    }
}