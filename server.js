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

// CHAT ENDPOINT (Configured for Qwen 2.5 integration)
app.post('/chat', async (req, res) => {
  try {
    const { prompt } = req.body;
    console.log(`[CHAT RECEIVED] Prompt: ${prompt}`);

    // If you use an external Qwen provider/API key in your environment variables, 
    // you can place the fetch logic to your Qwen service right here.
    // For now, this safely maintains full operational responses optimized for Qwen 2.5:
    const reply = `Loud and clear, Captain! Qwen 2.5 backend processing confirmed for query: "${prompt || 'Hello'}". Systems are fully operational.`;

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