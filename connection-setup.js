// connection-setup.js - Handles sender and recipient mode initialization

export class ConnectionSetup {
    constructor(peerConnection, camera, chat, location, ui) {
        this.peerConnection = peerConnection;
        this.camera = camera;
        this.chat = chat;
        this.location = location;
        this.ui = ui;
    }

    async setupSenderMode() {
        // Restore sender video state from localStorage
        const senderVideoEnabled = localStorage.getItem("livecam_senderVideo") === "true";
        if (senderVideoEnabled) {
            try {
                await this.camera.restoreSenderVideo();
                this.ui.updateMyVideoButton(true);
            } catch (e) {
                console.error("Failed to restore sender video:", e);
                localStorage.removeItem("livecam_senderVideo");
            }
        }
        
        // Handle incoming calls
        this.peerConnection.onStream(async (call) => {
            const mediaStream = this.camera.senderStream || await this.camera.startSenderMedia();
            call.answer(mediaStream);
            this.peerConnection.currentCall = call;
            
            call.on("stream", remoteStream => {
                this.camera.addVideo(remoteStream, false, false, false);
                this.ui.setStatus("Visitante conectado");
                this.ui.btnMyVideo.disabled = false;
                this.ui.btnRecord.disabled = false;
            });
        });

        // Handle incoming data
        this.peerConnection.onData((data) => {
            if (data.type === 'location') {
                this.location.displayLocation(data.latitude, data.longitude, {
                    address: data.address,
                    via: data.via || '',
                    numero: data.numero || '',
                    bairro: data.bairro || '',
                    municipio: data.municipio || '',
                    cep: data.cep || ''
                });
            } else if (data.type === 'chat') {
                this.chat.receiveMessage(data.message);
            } else if (data.type === 'image') {
                this.chat.receiveImage(data.dataUrl);
            } else if (data.type === 'sender_video_stopped') {
                this.camera.removeSenderVideo();
            } else if (data.type === 'video_permission_request') {
                if (confirm('O remetente deseja compartilhar vídeo. Aceitar?')) {
                    this.peerConnection.sendData({ type: 'video_permission_granted' });
                } else {
                    this.peerConnection.sendData({ type: 'video_permission_denied' });
                }
            }
        });
    }

    async setupRecipientMode() {
        try {
            // Check if recipient had video enabled
            const recipientVideoEnabled = localStorage.getItem("livecam_recipientVideo") !== "false";
            
            if (recipientVideoEnabled) {
                await this.camera.startCamera();
            } else {
                await this.camera.startAudioOnly();
            }
            this.ui.setStatus("Conectando...");
            
            const params = new URLSearchParams(window.location.search);
            const room = params.get("r");
            const call = this.peerConnection.call(room, this.camera.localStream);
            this.peerConnection.currentCall = call;
            
            call.on("stream", remoteStream => {
                const hasVideo = remoteStream.getVideoTracks().length > 0;
                const hasAudio = remoteStream.getAudioTracks().length > 0;
                
                if (hasVideo) {
                    this.camera.addVideo(remoteStream, false, false, true);
                    this.ui.setStatus("Conectado");
                } else if (hasAudio) {
                    const audioElement = new Audio();
                    audioElement.srcObject = remoteStream;
                    audioElement.autoplay = true;
                    audioElement.play().catch(() => {});
                    this.ui.setStatus("Conectado (áudio)");
                }
            });
            
            this.peerConnection.connect(room);
            
            this.peerConnection.onConnectionReady(async () => {
                this.ui.setStatus("Chat conectado");
                
                try {
                    const position = await this.location.getCurrentLocation();
                    const { latitude, longitude } = position.coords;
                    const addressData = await this.location.getAddressFromCoords(latitude, longitude);
                    
                    this.peerConnection.sendData({ 
                        type: 'location', 
                        latitude, 
                        longitude, 
                        address: addressData.address,
                        via: addressData.via,
                        numero: addressData.numero,
                        bairro: addressData.bairro,
                        municipio: addressData.municipio,
                        cep: addressData.cep
                    });
                } catch (e) {
                    console.error("Erro ao obter localização:", e);
                }
            });
            
            this.peerConnection.onData((data) => {
                if (data.type === 'chat') {
                    this.chat.receiveMessage(data.message);
                } else if (data.type === 'image') {
                    this.chat.receiveImage(data.dataUrl);
                } else if (data.type === 'stop_camera') {
                    this.camera.stopLocalCamera();
                    this.ui.setStatus('Câmera encerrada pelo remetente.');
                } else if (data.type === 'sender_video_stopped') {
                    this.camera.removeSenderVideo();
                } else if (data.type === 'recipient_video_toggle') {
                    // Handle recipient video toggle notification
                    this.ui.setStatus(data.enabled ? 'Visitante ativou vídeo' : 'Visitante desativou vídeo');
                } else if (data.type === 'link_deleted') {
                    alert('O link foi excluído pelo remetente. A conexão será encerrada.');
                    this.camera.stopLocalCamera();
                    window.close();
                } else if (data.type === 'video_permission_request') {
                    if (confirm('O remetente deseja compartilhar vídeo. Aceitar?')) {
                        this.peerConnection.sendData({ type: 'video_permission_granted' });
                    } else {
                        this.peerConnection.sendData({ type: 'video_permission_denied' });
                    }
                }
            });
        } catch (error) {
            this.ui.setStatus("Erro ao conectar com câmera", "#ef4444");
            console.error(error);
        }
    }
}