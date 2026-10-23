import express from 'express';
import profiles from './routes/profiles.js';
import posts from './routes/posts.js';

const app = express();

// Connect each URL to its route file.
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/profiles', profiles);
app.use('/api/posts', posts);

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running at http://localhost:${port}`));
