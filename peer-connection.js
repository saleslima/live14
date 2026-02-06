// peer-connection.js - Handles all PeerJS connection logic

export class PeerConnection {
    constructor() {
        this.peer = null;
        this.peerId = null;
        this.currentCall = null;
        this.dataConnection = null;
        this.onStreamCallback = null;
        this.onDataCallback = null;
        this.onConnectionReadyCallback = null;
    }

    async initialize() {
        const storedPeerId = localStorage.getItem("livecam_peerId");
        
        return new Promise((resolve) => {
            const initPeer = (idToUse) => {
                const peer = new Peer(idToUse);

                peer.on("open", (id) => {
                    this.peer = peer;
                    this.peerId = id;
                    const params = new URLSearchParams(location.search);
                    const room = params.get("r");
                    
                    if (!room) {
                        localStorage.setItem("livecam_peerId", this.peerId);
                    }
                    resolve(id);
                });

                peer.on("error", (err) => {
                    console.error("PeerJS Error:", err);
                    if (err.type === 'unavailable-id' || err.type === 'invalid-id') {
                        localStorage.removeItem("livecam_peerId");
                        peer.destroy();
                        initPeer(undefined);
                    }
                });

                peer.on("call", async (call) => {
                    if (this.onStreamCallback) {
                        await this.onStreamCallback(call);
                    }
                });

                peer.on('connection', (conn) => {
                    this.dataConnection = conn;
                    conn.on('data', (data) => {
                        if (this.onDataCallback) {
                            this.onDataCallback(data);
                        }
                    });
                });
            };

            initPeer(storedPeerId || undefined);
        });
    }

    call(targetId, stream) {
        this.currentCall = this.peer.call(targetId, stream);
        
        this.currentCall.on("stream", (remoteStream) => {
            if (this.onStreamCallback) {
                this.onStreamCallback(remoteStream, true);
            }
        });

        this.currentCall.on("error", (err) => {
            console.error("Call error:", err);
            if (this.onErrorCallback) {
                this.onErrorCallback(err);
            }
        });

        return this.currentCall;
    }

    connect(targetId) {
        this.dataConnection = this.peer.connect(targetId);
        
        this.dataConnection.on('open', () => {
            if (this.onConnectionReadyCallback) {
                this.onConnectionReadyCallback();
            }
        });

        this.dataConnection.on('data', (data) => {
            if (this.onDataCallback) {
                this.onDataCallback(data);
            }
        });

        this.dataConnection.on('error', (err) => {
            console.error("Data connection error:", err);
            if (this.onErrorCallback) {
                this.onErrorCallback(err);
            }
        });

        return this.dataConnection;
    }

    sendData(data) {
        if (this.dataConnection && this.dataConnection.open) {
            this.dataConnection.send(data);
        }
    }

    destroy() {
        if (this.peer) {
            this.peer.destroy();
        }
    }

    onStream(callback) {
        this.onStreamCallback = callback;
    }

    onData(callback) {
        this.onDataCallback = callback;
    }

    onConnectionReady(callback) {
        this.onConnectionReadyCallback = callback;
    }

    onError(callback) {
        this.onErrorCallback = callback;
    }
}