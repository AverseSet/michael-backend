import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Basic health check route
app.get('/', (req, res) => {
  res.json({ status: 'Michael AI Backend is running successfully!' });
});

// Add your API endpoints here as you build them out
// Example:
// app.post('/api/chat', (req, res) => { ... });

// Start server
app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});