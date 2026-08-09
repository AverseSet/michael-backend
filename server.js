import express from 'express';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 10000;
const SECRET_KEY = process.env.SECRET_KEY || 'your_secret_key_here';

// AUTHENTICATION ENDPOINT (Access Key Only)
app.post('/api/auth', (req, res) => {
  const { accessKey } = req.body;

  // Strict check for "AA"
  if (accessKey !== 'AA') {
    return res.status(401).json({ error: "Invalid access key. Just type AA" });
  }

  // Generate JWT token valid until 2030 (approx 5 years)
  const token = jwt.sign(
    { user: 'MichaelUser' },
    SECRET_KEY,
    { expiresIn: '1825d' }
  );

  console.log(`[AUTH SUCCESS] Access granted via key 'AA' (valid until 2030).`);
  res.json({ token, success: true });
});

// CHAT ENDPOINT (Dynamic Qwen 2.5 Echo & Response)
app.post('/chat', async (req, res) => {
  try {
    const { prompt } = req.body;
    console.log(`[CHAT RECEIVED] Prompt: ${prompt}`);

    let reply = "";
    const lowerPrompt = (prompt || "").trim().toLowerCase();

    if (lowerPrompt === "hi" || lowerPrompt === "hello") {
      reply = "Hello, Captain! How can I assist you today?";
    } else {
      reply = `Qwen 2.5 processed your query: "${prompt}". Systems are fully operational.`;
    }

    res.json({ response: reply });
  } catch (err) {
    console.error("[CHAT ERROR]:", err);
    res.status(500).json({ error: err.message });
  }
});

// START SERVER
app.listen(PORT, '0.0.0.0', () => {
  console.log(`----------------------------------------`);
  console.log(`✖ Michael Backend Server running on port ${PORT}`);
  console.log(`🌐 Ready for universal "AA" mobile connections`);
  console.log(`----------------------------------------`);
});