// ui.js - Handles UI controls and button interactions

export class UIManager {
    constructor() {
        this.linkDiv = document.getElementById("link");
        this.statusEl = document.getElementById("status");
        this.btnLink = document.getElementById("btnLink");
        this.btnCopy = document.getElementById("btnCopy");
        this.btnDeleteLink = document.getElementById("btnDeleteLink");
        this.btnSendWhatsApp = document.getElementById("btnSendWhatsApp");
        this.btnSendSMS = document.getElementById("btnSendSMS");
        this.btnRecord = document.getElementById("btnRecord");
        this.recipientPhone = document.getElementById("recipientPhone");
        this.generatedLink = "";
        this.whatsappWindow = null;
        this.isRecording = false;
        this.mediaRecorder = null;
        this.recordedChunks = [];

        this.setupPhoneInput();
    }

    setupPhoneInput() {
        this.recipientPhone.addEventListener("input", () => {
            let digits = this.recipientPhone.value.replace(/\D/g, "");
            if (!digits.startsWith("55")) {
                digits = "55" + digits;
            }
            digits = digits.slice(0, 13);

            const country = "+55";
            const ddd = digits.slice(2, 4);
            const firstDigit = digits.slice(4, 5);
            const middle = digits.slice(5, 9);
            const last = digits.slice(9, 13);

            let formatted = country;
            if (ddd) {
                formatted += ` (${ddd}`;
                if (ddd.length === 2) {
                    formatted += ") ";
                }
            }
            if (firstDigit) formatted += firstDigit;
            if (middle) formatted += middle;
            if (last) formatted += `-${last}`;

            this.recipientPhone.value = formatted;
        });
    }

    loadStoredLink() {
        const storedLink = localStorage.getItem("livecam_link");
        const params = new URLSearchParams(location.search);
        const room = params.get("r");
        
        if (storedLink && !room) {
            this.generatedLink = storedLink;
            this.linkDiv.innerText = storedLink;
            this.btnCopy.disabled = false;
            this.btnSendWhatsApp.disabled = false;
            this.btnSendSMS.disabled = false;
            this.btnDeleteLink.disabled = false;
        }
    }

    hideControlsForRecipient() {
        this.btnLink.style.display = 'none';
        this.btnCopy.style.display = 'none';
        this.btnDeleteLink.style.display = 'none';
        this.btnRecord.style.display = 'none';
        this.btnSendWhatsApp.style.display = 'none';
        this.btnSendSMS.style.display = 'none';
        this.recipientPhone.style.display = 'none';
        this.linkDiv.style.display = 'none';
        
        const btnToggleChat = document.getElementById("btnToggleChat");
        if (btnToggleChat) btnToggleChat.style.display = 'none';
        
        const btnReload = document.getElementById("btnReload");
        if (btnReload) btnReload.style.display = 'inline-block';
    }

    setStatus(message, color = null) {
        this.statusEl.innerText = message;
        if (color) {
            this.statusEl.style.color = color;
        }
    }

    generateLink(peerId) {
        this.generatedLink = `${location.origin}${location.pathname}?r=${peerId}`;
        this.linkDiv.innerText = this.generatedLink;
        this.setStatus("Link gerado. Aguardando acesso...");
        this.btnCopy.disabled = false;
        this.btnSendWhatsApp.disabled = false;
        this.btnSendSMS.disabled = false;
        this.btnDeleteLink.disabled = false;
        localStorage.setItem("livecam_link", this.generatedLink);
    }

    copyLink() {
        if (!this.generatedLink) return;
        navigator.clipboard.writeText(this.generatedLink);
        this.setStatus("Link copiado!");
    }

    sendWhatsApp() {
        const phone = this.recipientPhone.value.replace(/\D/g, '');
        if (!phone || phone.length !== 13) {
            alert("Digite o telefone completo no formato +55 (DDD) 9XXXX-XXXX");
            return;
        }
        const message = encodeURIComponent(`Acesse este link: ${this.generatedLink}`);
        const url = `https://wa.me/${phone}?text=${message}`;

        this.whatsappWindow = window.open(url, 'whatsappWindow');
        if (this.whatsappWindow) {
            this.whatsappWindow.focus();
        }
    }

    sendSMS() {
        const phone = this.recipientPhone.value.replace(/\D/g, '');
        if (!phone || phone.length !== 13) {
            alert("Digite o telefone completo no formato +55 (DDD) 9XXXX-XXXX");
            return;
        }
        const message = encodeURIComponent(`Acesse este link: ${this.generatedLink}`);
        window.open(`sms:${phone}?body=${message}`);
    }

    startRecording(stream) {
        if (!stream) return;
        
        this.recordedChunks = [];
        this.mediaRecorder = new MediaRecorder(stream);
        
        this.mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                this.recordedChunks.push(event.data);
            }
        };
        
        this.mediaRecorder.onstop = () => {
            const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            
            // Get phone number and format date
            const phone = this.recipientPhone.value.replace(/\D/g, '') || 'sem-numero';
            const now = new Date();
            const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
            const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '-'); // HH-MM-SS
            
            a.download = `${phone}_${dateStr}_${timeStr}.webm`;
            a.click();
            this.setStatus('Gravação salva!');
        };
        
        this.mediaRecorder.start();
        this.isRecording = true;
        this.btnRecord.textContent = '⏹️ Parar Gravação';
        this.btnRecord.style.background = '#ef4444';
        this.setStatus('Gravando...');
    }

    stopRecording() {
        if (this.mediaRecorder) {
            this.mediaRecorder.stop();
            this.isRecording = false;
            this.btnRecord.textContent = '⏺️ Gravar Vídeo';
            this.btnRecord.style.background = '#0b5cff';
        }
    }

}