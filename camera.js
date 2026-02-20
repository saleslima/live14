// camera.js - Handles camera and media stream logic

export class CameraManager {
    constructor() {
        this.localStream = null;
        this.senderStream = null;
        this.usingFrontCamera = true;
        this.localVideoElement = null;
        this.remoteVideoElement = null;
        this.localVideoAdded = false;
        this.remoteVideoAdded = false;
        this.videosContainer = document.getElementById("videos");
    }

    async startCamera() {
        if (this.localStream) return this.localStream;
        
        try {
            // Try with facingMode first (works on mobile)
            try {
                this.localStream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: this.usingFrontCamera ? "user" : "environment" },
                    audio: true
                });
            } catch (e) {
                // Fallback for desktop/devices without facingMode support
                console.log("FacingMode not supported, using default camera:", e);
                this.localStream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: true
                });
            }
            
            if (!this.localVideoAdded) {
                this.addVideo(this.localStream, true, true);
                this.localVideoAdded = true;
            }
            
            return this.localStream;
        } catch (error) {
            console.error("Camera error:", error);
            throw error;
        }
    }

    async startSenderMedia() {
        if (this.senderStream) return this.senderStream;
        
        try {
            this.senderStream = await navigator.mediaDevices.getUserMedia({ 
                video: true, 
                audio: true 
            });
            
            // Add sender's own video as PIP overlay
            const wrapper = document.createElement("div");
            wrapper.className = "sender-pip";
            wrapper.id = "senderPipWrapper";
            
            const video = document.createElement("video");
            video.srcObject = this.senderStream;
            video.autoplay = true;
            video.playsInline = true;
            video.muted = true;
            video.id = "senderPipVideo";
            
            wrapper.appendChild(video);
            this.videosContainer.appendChild(wrapper);
            
            return this.senderStream;
        } catch (error) {
            console.error("Erro ao acessar mídia do remetente:", error);
            throw error;
        }
    }

    async startAudioOnly() {
        if (this.localStream) return this.localStream;
        
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({
                video: false,
                audio: true
            });
            return this.localStream;
        } catch (error) {
            console.error("Audio error:", error);
            throw error;
        }
    }

    stopLocalCamera() {
        try {
            if (this.localStream) {
                this.localStream.getTracks().forEach(t => t.stop());
                this.localStream = null;
            }
            if (this.localVideoElement) {
                this.localVideoElement.srcObject = null;
                this.localVideoElement.style.display = 'none';
            }
        } catch (e) {
            console.error("Erro ao encerrar câmera local:", e);
        }
    }

    addVideo(stream, muted = false, isLocal = false) {
        if (isLocal && this.localVideoAdded) return;
        if (!isLocal && this.remoteVideoAdded) return;

        const wrapper = document.createElement("div");
        wrapper.className = "video-wrapper";

        const video = document.createElement("video");
        video.srcObject = stream;
        video.autoplay = true;
        video.playsInline = true;
        video.muted = muted;
        
        // Ensure video tracks are displayed
        const videoTracks = stream.getVideoTracks();
        if (videoTracks && videoTracks.length > 0) {
            video.style.display = 'block';
        } else {
            video.style.display = 'none';
        }

        wrapper.appendChild(video);
        
        this.videosContainer.appendChild(wrapper);

        if (isLocal) {
            this.localVideoAdded = true;
            this.localVideoElement = video;

            const params = new URLSearchParams(location.search);
            const room = params.get("r");
            if (room) {
                const btnSwitchCamera = document.getElementById("btnSwitchCamera");
                btnSwitchCamera.style.display = "block";
                wrapper.appendChild(btnSwitchCamera);
            }
        } else {
            this.remoteVideoAdded = true;
            this.remoteVideoElement = video;
        }

        // Force video to play on mobile
        video.play().catch(err => {
            console.log("Autoplay prevented, trying muted:", err);
            video.muted = true;
            video.play().catch(e => console.error("Video play failed:", e));
        });

        return video;
    }

    async switchCamera() {
        try {
            // Check if device has multiple cameras before attempting switch
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(device => device.kind === 'videoinput');
            
            if (videoDevices.length < 2) {
                throw new Error('Dispositivo possui apenas uma câmera');
            }

            this.usingFrontCamera = !this.usingFrontCamera;
            
            // Stop current video tracks first to release camera hardware (crucial for mobile)
            if (this.localStream) {
                this.localStream.getVideoTracks().forEach(t => t.stop());
            }

            const constraints = {
                video: {
                    facingMode: { exact: this.usingFrontCamera ? "user" : "environment" }
                },
                audio: true,
            };
            
            let newStream;
            try {
                newStream = await navigator.mediaDevices.getUserMedia(constraints);
            } catch (e) {
                console.log("Exact facingMode failed, trying ideal:", e);
                constraints.video = {
                    facingMode: { ideal: this.usingFrontCamera ? "user" : "environment" }
                };
                try {
                    newStream = await navigator.mediaDevices.getUserMedia(constraints);
                } catch (innerE) {
                    console.log("FacingMode not supported, trying deviceId method:", innerE);
                    // Fallback: cycle through available cameras by deviceId
                    const currentDeviceId = this.localStream?.getVideoTracks()[0]?.getSettings()?.deviceId;
                    const nextDevice = videoDevices.find(d => d.deviceId !== currentDeviceId) || videoDevices[0];
                    
                    try {
                        newStream = await navigator.mediaDevices.getUserMedia({
                            video: { deviceId: { exact: nextDevice.deviceId } },
                            audio: true
                        });
                    } catch (finalE) {
                        console.error("Failed to switch camera:", finalE);
                        this.usingFrontCamera = !this.usingFrontCamera;
                        throw new Error('Não foi possível trocar de câmera');
                    }
                }
            }

            // Stop any remaining tracks (like audio) from old stream
            if (this.localStream) {
                this.localStream.getTracks().forEach(t => {
                    if (t.readyState !== 'ended') t.stop();
                });
            }

            this.localStream = newStream;

            if (this.localVideoElement) {
                this.localVideoElement.srcObject = this.localStream;
            }

            return newStream;
        } catch (err) {
            console.error("Erro ao trocar câmera:", err);
            throw err;
        }
    }



    async toggleRecipientVideo(currentCall) {
        const hasVideo = this.localStream && this.localStream.getVideoTracks().length > 0;
        
        if (!hasVideo) {
            // Enable video
            const newStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: this.usingFrontCamera ? "user" : "environment" },
                audio: true
            });
            
            if (this.localStream) {
                this.localStream.getTracks().forEach(t => t.stop());
            }
            
            this.localStream = newStream;
            
            if (this.localVideoElement) {
                this.localVideoElement.srcObject = this.localStream;
                this.localVideoElement.style.display = 'block';
            } else {
                this.addVideo(this.localStream, true, true);
                this.localVideoAdded = true;
            }
            
            if (currentCall && currentCall.peerConnection) {
                const videoTrack = this.localStream.getVideoTracks()[0];
                const audioTrack = this.localStream.getAudioTracks()[0];
                
                const senders = currentCall.peerConnection.getSenders();
                senders.forEach(sender => {
                    if (sender.track && sender.track.kind === 'audio') {
                        if (audioTrack) sender.replaceTrack(audioTrack);
                    } else {
                        if (videoTrack) sender.replaceTrack(videoTrack);
                    }
                });
            }
            
            localStorage.setItem("livecam_recipientVideo", "true");
            return { enabled: true };
        } else {
            // Disable video
            const audioOnlyStream = await navigator.mediaDevices.getUserMedia({
                video: false,
                audio: true
            });
            
            if (this.localStream) {
                this.localStream.getTracks().forEach(t => t.stop());
            }
            
            this.localStream = audioOnlyStream;
            
            if (this.localVideoElement) {
                this.localVideoElement.style.display = 'none';
            }
            
            if (currentCall && currentCall.peerConnection) {
                const audioTrack = this.localStream.getAudioTracks()[0];
                
                const senders = currentCall.peerConnection.getSenders();
                senders.forEach(sender => {
                    if (sender.track) {
                        if (sender.track.kind === "video") {
                            sender.replaceTrack(null);
                        } else if (sender.track.kind === "audio") {
                            sender.replaceTrack(audioTrack);
                        }
                    }
                });
            }
            
            return { enabled: false };
        }
    }
}