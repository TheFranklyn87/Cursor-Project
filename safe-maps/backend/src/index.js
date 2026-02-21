/**
 * Safe Maps API server
 */

import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { handleRouteRequest, handleGeocodeRequest } from './routes.js';
import cors from 'cors';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/api/route', handleRouteRequest);
app.get('/api/geocode', handleGeocodeRequest);

app.get('/', (req, res) => {
    res.json({
        message: 'Safe Maps API is running',
        frontend: 'http://localhost:80',
        health: '/api/health'
    });
});

app.get('/api/health', (req, res) => {
    res.json({ ok: true });
});

app.listen(PORT, () => {
    console.log(`Safe Maps API running at http://localhost:${PORT}`);
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Kill the process with: lsof -ti:${PORT} | xargs kill -9`);
    } else {
        console.error('Server error:', err);
    }
    process.exit(1);
});
