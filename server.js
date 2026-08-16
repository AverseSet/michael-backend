import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// TEST / HEALTH CHECK ROUTE (Works for cron-job.org and browser checks)
app.get('/', (req, res) => {
  res.json({ status: 'online', message: 'Michael Backend Server is live and running!' });
});

// AUTHENTICATION ROUTES (Covers all possible frontend endpoint variations)
const handleAuth = (req, res) => {
  const { accessKey } = req.body;
  if (accessKey === 'AA') {
    res.json({ token: 'michael_secure_token_123' });
  } else {
    res.status(401).json({ error: 'Invalid access key. Type "AA" to access.' });
  }
};

app.post('/auth', handleAuth);
app.post('/login', handleAuth);
app.post('/api/auth', handleAuth);

// CHAT ENDPOINT (Live Qwen 2.5 Integration)
app.post('/chat', async (req, res) => {
  try {
    const { prompt } = req.body;
    console.log(`[CHAT RECEIVED] Prompt: ${prompt}`);

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "qwen/qwen-2.5-7b-instruct",
        messages: [
          { role: "system", content: "You are Michael, a helpful AI assistant and companion." },
          { role: "user", content: prompt }
        ]
      })
    });

    const data = await response.json();
    
    if (data.choices && data.choices.length > 0) {
      const reply = data.choices[0].message.content;
      res.json({ response: reply });
    } else {
      res.status(500).json({ error: "Failed to get response from Qwen API", details: data });
    }

  } catch (err) {
    console.error("[CHAT ERROR]:", err);
    res.status(500).json({ error: err.message });
  }
});

// TTS ENDPOINT
app.post('/api/tts', async (req, res) => {
  try {
    const { text } = req.body;
    // Add your TTS synthesis logic or external service integration here
    res.status(200).json({ status: 'success', message: 'TTS endpoint reached' });
  } catch (err) {
    console.error('[TTS ERROR]:', err);
    res.status(500).json({ error: err.message });
  }
});

// CATCH-ALL 404 HANDLER (Ensures missing routes return clean JSON instead of HTML)
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// GLOBAL ERROR HANDLER (Prevents HTML stack traces on server crash)
app.use((err, req, res, next) => {
  console.error('[SERVER CRASH ERROR]:', err);
  res.status(500).json({ error: 'Internal server error', details: err.message });
});

// START SERVER
app.listen(PORT, '0.0.0.0', () => {
  console.log('--------------------------------------------------');
  console.log(`✖ Michael Backend Server running on port ${PORT}`);
  console.log(`🌐 Ready for universal mobile connections`);
  console.log('--------------------------------------------------');
});