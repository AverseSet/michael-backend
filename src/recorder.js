// --- MICHAEL AI VIDEO & TACTICAL RECORDER ENGINE ---
let mediaRecorder = null;
let recordedChunks = [];
let isRecordingSession = false;

function initTacticalRecorder(stream) {
    if (!stream) {
        console.warn("[Recorder] No active stream provided for recording.");
        return false;
    }

    recordedChunks = [];
    try {
        const options = { mimeType: 'video/webm; codecs=vp9' };
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
            options.mimeType = 'video/webm';
        }

        mediaRecorder = new MediaRecorder(stream, options);

        mediaRecorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
                recordedChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = () => {
            const blob = new Blob(recordedChunks, { type: 'video/webm' });
            const videoUrl = URL.createObjectURL(blob);
            
            // Auto-generate download anchor for tactical debriefing
            const downloadLink = document.createElement('a');
            downloadLink.href = videoUrl;
            downloadLink.download = `Michael-Tactical-Debrief-${Date.now()}.webm`;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);

            console.log("[Recorder] Tactical session video exported successfully.");
        };

        mediaRecorder.start();
        isRecordingSession = true;
        return true;
    } catch (err) {
        console.error("[Recorder] Failed to initialize MediaRecorder:", err);
        return false;
    }
}

function stopTacticalRecorder() {
    if (mediaRecorder && isRecordingSession) {
        mediaRecorder.stop();
        isRecordingSession = false;
        return true;
    }
    return false;
}

export { initTacticalRecorder, stopTacticalRecorder, isRecordingSession };