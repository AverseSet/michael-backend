// src/liveVision.js
import { analyzeScreen } from "./ai.js";

let stream = null;
let captureInterval = null;
let isProcessing = false;

/**
 * Starts continuous screen capture and live tactical updates
 * @param {Function} onUpdateCallback - Function to execute when a new tactical reading is ready
 * @param {number} intervalMs - Frequency of screen capture in milliseconds (default: 5000ms)
 */
export async function startLiveVision(onUpdateCallback, intervalMs = 5000) {
  if (stream) return; // Already running

  try {
    // Request permission to capture screen/game window once
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: { max: 15 } }
    });

    const video = document.createElement("video");
    video.srcObject = stream;
    await video.play();

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    // Handle user stopping screen share from browser UI
    stream.getVideoTracks()[0].onended = () => {
      stopLiveVision();
    };

    // Frame capture loop
    captureInterval = setInterval(async () => {
      if (isProcessing) return; // Skip frame if previous AI analysis is still running
      isProcessing = true;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const base64Image = canvas.toDataURL("image/jpeg", 0.6).split(",")[1]; // Compressed JPEG for speed

      const tacticalPrompt = 
        "Live Blox Fruits feed. Short tactical update (max 2 sentences). " +
        "Identify player health status, equipped fruit/weapon, active enemies, or immediate combat threats.";

      const update = await analyzeScreen(base64Image, tacticalPrompt);
      isProcessing = false;

      if (update && onUpdateCallback) {
        onUpdateCallback(update);
      }
    }, intervalMs);

  } catch (err) {
    console.error("Failed to initialize live vision stream:", err);
    stopLiveVision();
  }
}

/**
 * Stops the live vision capture stream
 */
export function stopLiveVision() {
  if (captureInterval) {
    clearInterval(captureInterval);
    captureInterval = null;
  }
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }
  isProcessing = false;
}