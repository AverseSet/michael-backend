import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

// Define __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000; // Automatically adapts to Render/Cloud hosting ports
const SECRET_KEY = "yo-michael-averseset-100-161013";

// Middleware
app.use(cors());
app.use(express.json());

// Universal Hashed Key for "AA"
const UNIVERSAL_KEY_HASH = crypto.createHash('sha256').update("AA").digest('hex');

// 1. UNIVERSAL AUTHENTICATION ENDPOINT
app.post('/api/auth', (req, res) => {
  const { accessKey } = req.body;

  if (!accessKey) {
    return res.status(400).json({ error: "Access key is required." });
  }

  const hashedInputKey = crypto.createHash('sha256').update(accessKey).digest('hex');

  if (hashedInputKey !== UNIVERSAL_KEY_HASH) {
    console.log(`[AUTH FAILED] Incorrect access key attempted.`);
    return res.status(401).json({ error: "Invalid access key. Just type AA to enter!" });
  }

  const token = jwt.sign(
    { user: "MichaelUser" }, 
    SECRET_KEY, 
    { expiresIn: '30d' }
  );

  console.log(`[AUTH SUCCESS] User logged in successfully with universal key.`);
  res.json({ token, success: true });
});

// 2. PIPER TTS SPEECH BRIDGE ENDPOINT
app.post('/api/tts', (req, res) => {
  const { text } = req.body;
  if (!text) {
    return res.status(400).send("Text is required");
  }

  const outputPath = path.join(__dirname, `output_${Date.now()}.wav`);
  
  const piperProcess = spawn('piper', [
    '--model', 'en_US-lessac-medium.onnx',
    '--output_file', outputPath
  ]);

  piperProcess.stdin.write(text);
  piperProcess.stdin.end();

  piperProcess.on('close', (code) => {
    if (code !== 0) {
      console.error(`Piper process exited with code ${code}`);
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      return res.status(500).send("TTS generation failed");
    }

    res.sendFile(outputPath, (err) => {
      if (err) console.error(err);
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }
    });
  });
});

// 3. START SERVER
app.listen(PORT, '0.0.0.0', () => {
  console.log(`==================================================`);
  console.log(`⚔️ Michael Backend Server running on port ${PORT}`);
  console.log(`🌐 Ready for universal "AA" mobile connections`);
  console.log(`==================================================`);
});