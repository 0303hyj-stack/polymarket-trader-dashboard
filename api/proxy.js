const https = require('https');

const DATA_API_BASE = 'https://data-api.polymarket.com';

// Simple in-memory cache
const cache = new Map();
const CACHE_TTL = 30000; // 30 seconds

function fetchFromPolymarket(apiPath) {
    return new Promise((resolve, reject) => {
        const fullUrl = `${DATA_API_BASE}${apiPath}`;

        // Check cache
        const cached = cache.get(fullUrl);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            return resolve(cached.data);
        }

        https.get(fullUrl, {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'PolymarketDashboard/1.0'
            }
        }, (res) => {
            let data = '';

            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    // Cache the response
                    cache.set(fullUrl, { data: parsed, timestamp: Date.now() });
                    resolve(parsed);
                } catch (e) {
                    reject(new Error(`Failed to parse response: ${e.message}`));
                }
            });
        }).on('error', reject);
    });
}

module.exports = async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
    }

    // Get the path after /api/proxy
    const url = new URL(req.url, `http://${req.headers.host}`);
    const apiPath = url.pathname.replace('/api/proxy', '') || '/';
    const queryString = url.search || '';

    try {
        const data = await fetchFromPolymarket(apiPath + queryString);
        res.status(200).json(data);
    } catch (error) {
        console.error('API Error:', error.message);
        res.status(500).json({ error: error.message });
    }
};
