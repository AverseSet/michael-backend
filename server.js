import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import { randomUUID } from 'node:crypto';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/', (req, res) => {
  res.json({ status: 'online', message: 'Michael Backend Server is live and running!' });
});

const handleAuth = (req, res) => {
  const { accessKey } = req.body;
  const permanentKey = process.env.MICHAEL_PERMANENT_ACCESS_KEY;
  if (typeof accessKey === 'string' && permanentKey && accessKey === permanentKey) {
    res.json({ token: randomUUID(), permanent: true });
    return;
  }

  if (accessKey === 'AA') {
    res.json({
      token: randomUUID(),
      permanent: false,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000
    });
    return;
  }

  res.status(401).json({ error: 'Invalid access key. Type "AA" to access.' });
};

app.post('/auth', handleAuth);
app.post('/login', handleAuth);
app.post('/api/auth', handleAuth);

function getGeminiKey(body) {
  return (body.apiKey || body.geminiApiKey || process.env.GEMINI_API_KEY || '').trim();
}

function getGeminiText(data) {
  return data?.candidates?.[0]?.content?.parts
    ?.map((part) => part?.text || '')
    .join('')
    .trim() || '';
}

async function callGemini(key, parts) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts }] })
    }
  );

  const data = await response.json();
  return { response, data };
}

app.post('/chat', async (req, res) => {
  try {
    const key = getGeminiKey(req.body);
    const prompt = req.body.prompt || req.body.message || '';

    if (!prompt) {
      res.status(400).json({ error: 'Missing prompt text.' });
      return;
    }
    if (!key) {
      res.status(401).json({ error: 'Missing Gemini API key.' });
      return;
    }

    const { response, data } = await callGemini(key, [{
      text: `You are Michael, a tactical AI co-pilot for Roblox games.\n\nUser: ${prompt}`
    }]);

    if (!response.ok) {
      res.status(response.status).json({
        error: data?.error?.message || 'Gemini chat request failed.',
        details: data
      });
      return;
    }

    const reply = getGeminiText(data);
    if (!reply) {
      res.status(502).json({ error: 'Gemini returned no text content.' });
      return;
    }

    res.json({ response: reply });
  } catch (error) {
    console.error('[CHAT ERROR]:', error);
    res.status(500).json({ error: error.message });
  }
});

app.all('/vision', async (req, res) => {
  if (req.method === 'GET') {
    res.json({ status: 'online', message: 'Vision endpoint is active. Send a POST request with image data.' });
    return;
  }

  try {
    const { image, prompt } = req.body;
    const key = getGeminiKey(req.body);

    if (!image) {
      res.status(400).json({ error: 'Missing image data' });
      return;
    }
    if (!key) {
      res.status(401).json({ error: 'Missing Gemini API key.' });
      return;
    }

    const { response, data } = await callGemini(key, [
      { text: prompt || 'Analyze this game screen:' },
      {
        inline_data: {
          mime_type: 'image/jpeg',
          data: image
        }
      }
    ]);

    if (!response.ok) {
      res.status(response.status).json({
        error: data?.error?.message || 'Gemini vision request failed.',
        details: data
      });
      return;
    }

    res.json({ response: getGeminiText(data) || 'No analysis returned.' });
  } catch (error) {
    console.error('[VISION ERROR]:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/tts', (req, res) => {
  const { text } = req.body;
  if (!text) {
    res.status(400).json({ error: 'Text is required' });
    return;
  }

  res.status(501).json({ error: 'Server TTS is not configured. Use native device speech.' });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

app.use((error, req, res, next) => {
  console.error('[SERVER ERROR]:', error);
  res.status(500).json({ error: 'Internal server error', details: error.message });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Michael Backend Server running on port ${PORT}`);
});
