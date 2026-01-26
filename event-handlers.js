// event-handlers.js - All button and input event handlers

export class EventHandlers {
    constructor(peerConnection, camera, chat, ui) {
        this.peerConnection = peerConnection;
        this.camera = camera;
        this.chat = chat;
        this.ui = ui;
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Link management buttons
        this.ui.btnLink.onclick = () => this.handleGenerateLink();
        this.ui.btnCopy.onclick = () => this.handleCopyLink();
        this.ui.btnDeleteLink.onclick = () => this.handleDeleteLink();
        
        // Communication buttons
        this.ui.btnSendWhatsApp.onclick = () => this.ui.sendWhatsApp();
        this.ui.btnSendSMS.onclick = () => this.ui.sendSMS();
        
        // Video controls
        this.ui.btnRecord.onclick = () => this.handleRecord();
        this.ui.btnMyVideo.onclick = () => this.handleMyVideo();
        
        const btnSwitchCamera = document.getElementById("btnSwitchCamera");
        btnSwitchCamera.onclick = () => this.handleSwitchCamera();
        
        const btnReload = document.getElementById("btnReload");
        btnReload.onclick = () => location.reload();
        
        // Delegate event for sender camera switch button
        document.addEventListener('click', (e) => {
            if (e.target.id === 'btnSwitchSenderCamera') {
                this.handleSwitchSenderCamera();
            }
        });
        
        // Chat controls
        const btnSend = document.getElementById("btnSend");
        const messageInput = document.getElementById("messageInput");
        const btnToggleChat = document.getElementById("btnToggleChat");
        const btnImage = document.getElementById("btnImage");
        const imageInput = document.getElementById("imageInput");
        
        btnSend.onclick = () => this.chat.sendMessage(messageInput.value);
        
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.chat.sendMessage(messageInput.value);
            }
        });
        
        btnToggleChat.onclick = () => this.chat.toggleChat();
        
        btnImage.onclick = () => imageInput.click();
        
        imageInput.addEventListener('change', () => {
            const file = imageInput.files[0];
            if (file) {
                const type = file.type.toLowerCase();
                if (type === 'image/jpeg' || type === 'image/jpg' || type === 'image/gif') {
                    this.chat.sendImage(file);
                } else {
                    alert('Formato de imagem não suportado. Use JPEG, JPG ou GIF.');
                }
            }
            imageInput.value = '';
        });
    }

    handleGenerateLink() {
        this.ui.generateLink(this.peerConnection.peerId);
    }

    handleCopyLink() {
        this.ui.copyLink();
    }

    handleDeleteLink() {
        if (!this.ui.generatedLink) return;

        try {
            this.peerConnection.sendData({ type: 'link_deleted' });
            this.peerConnection.sendData({ type: 'stop_camera' });
        } catch (e) {
            console.error("Erro ao enviar comandos:", e);
        }

        localStorage.removeItem("livecam_link");
        localStorage.removeItem("livecam_peerId");
        this.ui.generatedLink = "";
        this.ui.linkDiv.innerText = "";
        this.ui.btnCopy.disabled = true;
        this.ui.btnSendWhatsApp.disabled = true;
        this.ui.btnSendSMS.disabled = true;
        this.ui.btnDeleteLink.disabled = true;
        this.ui.setStatus("Link excluído. Recarregando para gerar um novo...");
        
        setTimeout(() => {
            try {
                this.peerConnection.destroy();
            } catch (e) {}
            location.reload();
        }, 500);
    }

    handleRecord() {
        if (!this.ui.isRecording && this.camera.remoteVideoElement && this.camera.remoteVideoElement.srcObject) {
            this.ui.startRecording(this.camera.remoteVideoElement.srcObject);
        } else if (this.ui.isRecording) {
            this.ui.stopRecording();
            try {
                this.peerConnection.sendData({ type: 'stop_camera' });
            } catch (e) {
                console.error("Erro ao enviar comando de stop_camera ao parar gravação:", e);
            }
        }
    }

    async handleMyVideo() {
        const params = new URLSearchParams(location.search);
        const room = params.get("r");
        
        try {
            if (room) {
                // Recipient mode - toggle their own video
                const result = await this.camera.toggleRecipientVideo(this.peerConnection.currentCall);
                this.peerConnection.sendData({ 
                    type: 'recipient_video_toggle', 
                    enabled: result.enabled 
                });
                this.ui.updateMyVideoButton(result.enabled);
            } else {
                // Sender mode - request permission first
                const hasVideo = this.camera.senderStream && this.camera.senderStream.getVideoTracks().length > 0;
                
                if (!hasVideo) {
                    // Requesting to enable video - ask for permission
                    this.ui.setStatus("Solicitando permissão...");
                    this.peerConnection.sendData({ type: 'video_permission_request' });
                    
                    // Set up listener for permission response
                    const originalOnData = this.peerConnection.onDataCallback;
                    this.peerConnection.onData((data) => {
                        if (data.type === 'video_permission_granted') {
                            this.enableSenderVideo();
                        } else if (data.type === 'video_permission_denied') {
                            this.ui.setStatus("Permissão negada pelo visitante");
                            setTimeout(() => this.ui.setStatus("Link ativo. Aguardando visitante..."), 2000);
                        }
                        if (originalOnData) originalOnData(data);
                    });
                } else {
                    // Disabling video
                    const result = await this.camera.toggleSenderVideo(this.peerConnection.currentCall);
                    this.peerConnection.sendData({ type: 'sender_video_stopped' });
                    this.ui.updateMyVideoButton(result.enabled);
                }
            }
        } catch (err) {
            console.error("Erro ao alternar vídeo:", err);
            this.ui.setStatus("Erro ao alternar vídeo", "#ef4444");
        }
    }

    async enableSenderVideo() {
        try {
            this.ui.setStatus("Ativando câmera...");
            const result = await this.camera.toggleSenderVideo(this.peerConnection.currentCall);
            this.ui.updateMyVideoButton(result.enabled);
            this.ui.setStatus("Câmera ativada - Compartilhando vídeo");
        } catch (err) {
            console.error("Erro ao ativar vídeo:", err);
            this.ui.setStatus("Erro ao ativar vídeo", "#ef4444");
        }
    }

    async handleSwitchCamera() {
        const params = new URLSearchParams(location.search);
        const room = params.get("r");
        if (!room) return;
        
        try {
            const newStream = await this.camera.switchCamera();
            
            if (this.peerConnection.currentCall && this.peerConnection.currentCall.peerConnection) {
                const videoTrack = newStream.getVideoTracks()[0];
                const audioTrack = newStream.getAudioTracks()[0];
                
                const senders = this.peerConnection.currentCall.peerConnection.getSenders();
                for (const sender of senders) {
                    if (sender.track) {
                        if (sender.track.kind === "video" && videoTrack) {
                            await sender.replaceTrack(videoTrack);
                        } else if (sender.track.kind === "audio" && audioTrack) {
                            await sender.replaceTrack(audioTrack);
                        }
                    }
                }
                
                this.ui.setStatus("Câmera trocada");
            }
        } catch (err) {
            console.error("Erro ao trocar câmera:", err);
            this.ui.setStatus("Erro ao trocar câmera", "#ef4444");
        }
    }

    async handleSwitchSenderCamera() {
        const params = new URLSearchParams(location.search);
        const room = params.get("r");
        if (room) return;
        
        try {
            await this.camera.switchSenderCamera(this.peerConnection.currentCall);
        } catch (err) {
            this.ui.setStatus("Erro ao trocar câmera", "#ef4444");
        }
    }
}