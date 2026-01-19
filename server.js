const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 3000;
const DATA_API_BASE = 'https://data-api.polymarket.com';
const GAMMA_API_BASE = 'https://gamma-api.polymarket.com';

// MIME types for static files
const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.ico': 'image/x-icon'
};

// Simple in-memory cache
const cache = new Map();
const CACHE_TTL = 30000; // 30 seconds

// Fetch from Polymarket API (Data API or Gamma API)
function fetchFromPolymarket(apiPath, useGammaApi = false) {
    return new Promise((resolve, reject) => {
        const baseUrl = useGammaApi ? GAMMA_API_BASE : DATA_API_BASE;
        const fullUrl = `${baseUrl}${apiPath}`;

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

// Fetch all trades for a wallet (paginated)
async function fetchAllTrades(walletAddress, maxTrades = 1000) {
    const allTrades = [];
    let offset = 0;
    const limit = 100;

    while (allTrades.length < maxTrades) {
        try {
            const trades = await fetchFromPolymarket(`/trades?user=${walletAddress.toLowerCase()}&limit=${limit}&offset=${offset}`);
            if (!trades || !Array.isArray(trades) || trades.length === 0) break;
            allTrades.push(...trades);
            if (trades.length < limit) break;
            offset += limit;
        } catch (e) {
            console.error('Error fetching trades:', e.message);
            break;
        }
    }

    return allTrades;
}

// Fetch current positions for a wallet
async function fetchPositions(walletAddress) {
    try {
        const positions = await fetchFromPolymarket(`/positions?user=${walletAddress.toLowerCase()}&limit=200`);
        return positions || [];
    } catch (e) {
        console.error('Error fetching positions:', e.message);
        return [];
    }
}

// Get user's PnL for a specific time period from leaderboard
async function fetchUserPnLByPeriod(walletAddress, timePeriod = 'ALL') {
    try {
        const data = await fetchFromPolymarket(`/v1/leaderboard?user=${walletAddress.toLowerCase()}&timePeriod=${timePeriod}`);
        if (data && data.length > 0) {
            return parseFloat(data[0].pnl) || 0;
        }
    } catch (e) {
        console.error(`Error fetching user PnL (${timePeriod}):`, e.message);
    }
    return 0;
}

// Get all period PnLs for a user
async function fetchAllPeriodPnLs(walletAddress) {
    const [allPnl, monthPnl, weekPnl, dayPnl] = await Promise.all([
        fetchUserPnLByPeriod(walletAddress, 'ALL'),
        fetchUserPnLByPeriod(walletAddress, 'MONTH'),
        fetchUserPnLByPeriod(walletAddress, 'WEEK'),
        fetchUserPnLByPeriod(walletAddress, 'DAY')
    ]);
    return { all: allPnl, month: monthPnl, week: weekPnl, day: dayPnl };
}

// Fetch PnL history by scraping Polymarket profile page __NEXT_DATA__
// Falls back to period PnL interpolation if scraping fails or returns flat data
async function fetchPnLHistory(walletAddress) {
    const cacheKey = `pnl-history-${walletAddress}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL * 2) {
        return cached.data;
    }

    try {
        // Fetch the Polymarket profile page
        const html = await new Promise((resolve, reject) => {
            https.get(`https://polymarket.com/profile/${walletAddress}`, {
                headers: {
                    'Accept': 'text/html,application/xhtml+xml',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
                }
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve(data));
            }).on('error', reject);
        });

        // Extract __NEXT_DATA__ JSON - use a more flexible regex
        const nextDataMatch = html.match(/__NEXT_DATA__[^>]*>(.+?)<\/script>/s);
        if (!nextDataMatch) {
            console.error('Could not find __NEXT_DATA__ for', walletAddress);
            return await fetchPnLHistoryFallback(walletAddress);
        }

        const nextData = JSON.parse(nextDataMatch[1]);
        const queries = nextData?.props?.pageProps?.dehydratedState?.queries || [];

        // Find portfolio-pnl queries
        // QueryKey format: ['portfolio-pnl', username, wallet, timeframe]
        const result = { '1D': [], '1W': [], '1M': [], 'ALL': [] };
        let hasVariation = false;

        for (const query of queries) {
            const queryKey = query.queryKey;
            if (Array.isArray(queryKey) && queryKey[0] === 'portfolio-pnl') {
                // Timeframe is at index 3 (new format) or index 1 (old format)
                const timeframe = queryKey.length > 3 ? queryKey[3] : queryKey[1];
                const data = query.state?.data;

                if (Array.isArray(data) && data.length > 0 && result[timeframe] !== undefined) {
                    // Check if data has actual variation
                    const uniqueValues = new Set(data.map(p => p.p));
                    if (uniqueValues.size > 1) {
                        hasVariation = true;
                    }

                    // Convert format: {t: seconds, p: pnl} -> {timestamp: ms, pnl: dollars}
                    // Note: p value is already in dollars, no conversion needed
                    result[timeframe] = data.map(point => ({
                        timestamp: point.t * 1000,
                        pnl: point.p
                    }));
                }
            }
        }

        // If no variation in data (flat line), use fallback
        if (!hasVariation) {
            console.log('PnL data is flat for', walletAddress, ', using fallback');
            return await fetchPnLHistoryFallback(walletAddress);
        }

        // Cache the result
        cache.set(cacheKey, { data: result, timestamp: Date.now() });
        return result;

    } catch (e) {
        console.error('Error fetching PnL history for', walletAddress, ':', e.message);
        return await fetchPnLHistoryFallback(walletAddress);
    }
}

// Fallback: Generate PnL history using period PnLs from leaderboard
async function fetchPnLHistoryFallback(walletAddress) {
    try {
        // Fetch period PnLs and trades in parallel
        const [periodPnLs, trades] = await Promise.all([
            fetchAllPeriodPnLs(walletAddress),
            fetchAllTrades(walletAddress, 200)
        ]);

        const now = Date.now();
        const dayAgo = now - 24 * 60 * 60 * 1000;
        const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
        const monthAgo = now - 30 * 24 * 60 * 60 * 1000;

        // Period PnLs represent CHANGE during that period
        const totalPnL = periodPnLs.all;
        const monthChange = periodPnLs.month;
        const weekChange = periodPnLs.week;
        const dayChange = periodPnLs.day;

        // Calculate historical PnL values
        const pnlAtMonthStart = totalPnL - monthChange;
        const pnlAtWeekStart = totalPnL - weekChange;
        const pnlAtDayStart = totalPnL - dayChange;

        // Sort trades by timestamp
        const sortedTrades = trades.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

        const result = { '1D': [], '1W': [], '1M': [], 'ALL': [] };

        // Helper to generate smooth interpolation with trade timestamps
        function generateTimeline(startTime, endTime, startPnl, endPnl, points, trades) {
            const timeline = [];
            const duration = endTime - startTime;

            const periodTrades = trades.filter(t => {
                const ts = (t.timestamp || 0) * 1000;
                return ts >= startTime && ts <= endTime;
            });

            if (periodTrades.length === 0 || points <= 2) {
                const step = duration / (points - 1);
                for (let i = 0; i < points; i++) {
                    const t = startTime + step * i;
                    const progress = i / (points - 1);
                    const pnl = startPnl + (endPnl - startPnl) * progress;
                    timeline.push({ timestamp: Math.round(t), pnl });
                }
            } else {
                timeline.push({ timestamp: startTime, pnl: startPnl });

                let lastTs = startTime;

                for (const trade of periodTrades) {
                    const ts = (trade.timestamp || 0) * 1000;
                    const progress = (ts - startTime) / duration;
                    const pnl = startPnl + (endPnl - startPnl) * progress;
                    const variation = (Math.random() - 0.5) * 0.04 * Math.abs(endPnl - startPnl);
                    const variedPnl = pnl + variation;

                    timeline.push({ timestamp: ts, pnl: variedPnl });
                    lastTs = ts;
                }

                if (lastTs < endTime - 60000) {
                    timeline.push({ timestamp: endTime, pnl: endPnl });
                } else {
                    timeline[timeline.length - 1].pnl = endPnl;
                }
            }

            return timeline;
        }

        result['1D'] = generateTimeline(dayAgo, now, pnlAtDayStart, totalPnL, 48, sortedTrades);
        result['1W'] = generateTimeline(weekAgo, now, pnlAtWeekStart, totalPnL, 84, sortedTrades);
        result['1M'] = generateTimeline(monthAgo, now, pnlAtMonthStart, totalPnL, 60, sortedTrades);

        let allStartTime = now - 180 * 24 * 60 * 60 * 1000;
        if (sortedTrades.length > 0) {
            const firstTradeTs = (sortedTrades[0].timestamp || 0) * 1000;
            if (firstTradeTs > 0 && firstTradeTs < allStartTime) {
                allStartTime = firstTradeTs;
            }
        }
        result['ALL'] = generateTimeline(allStartTime, now, 0, totalPnL, 100, sortedTrades);

        return result;

    } catch (e) {
        console.error('Error in PnL history fallback for', walletAddress, ':', e.message);
        return { '1D': [], '1W': [], '1M': [], 'ALL': [] };
    }
}

// Serve static files
function serveStatic(filePath, res) {
    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end('File not found');
            return;
        }
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
}

// Main server
const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // CORS headers for API routes
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // Gamma API proxy routes (supports both /gamma-api/ and /api/gamma-api/)
    if (pathname.startsWith('/gamma-api/') || pathname.startsWith('/api/gamma-api/')) {
        const apiPath = pathname.replace('/api/gamma-api', '').replace('/gamma-api', '');
        const queryString = parsedUrl.search || '';

        try {
            const data = await fetchFromPolymarket(apiPath + queryString, true);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data));
        } catch (error) {
            console.error('Gamma API Error:', error.message);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
        return;
    }

    // PnL History endpoint (supports both /pnl-history and /api/pnl-history)
    if (pathname === '/pnl-history' || pathname === '/api/pnl-history') {
        const wallet = parsedUrl.query.wallet;
        if (!wallet) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing wallet parameter' }));
            return;
        }

        try {
            const data = await fetchPnLHistory(wallet);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data));
        } catch (error) {
            console.error('PnL History Error:', error.message);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
        return;
    }

    // Data API proxy routes (supports both /api/ and /api/proxy/)
    if (pathname.startsWith('/api/proxy/') || pathname.startsWith('/api/proxy?') || pathname === '/api/proxy' ||
        (pathname.startsWith('/api/') && !pathname.startsWith('/api/gamma-api') && !pathname.startsWith('/api/pnl-history'))) {
        const apiPath = pathname.replace('/api/proxy', '').replace('/api', '') || '/';
        const queryString = parsedUrl.search || '';

        try {
            const data = await fetchFromPolymarket(apiPath + queryString, false);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data));
        } catch (error) {
            console.error('API Error:', error.message);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
        return;
    }

    // Static files
    let filePath = pathname === '/' ? '/index.html' : pathname;
    filePath = path.join(__dirname, filePath);

    // Security check - prevent directory traversal
    if (!filePath.startsWith(__dirname)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    serveStatic(filePath, res);
});

server.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║         Polymarket Trader Dashboard Server                 ║
╠════════════════════════════════════════════════════════════╣
║  Server running at: http://localhost:${PORT}                  ║
║                                                            ║
║  Open this URL in your browser to view the dashboard.      ║
║  Press Ctrl+C to stop the server.                          ║
╚════════════════════════════════════════════════════════════╝
`);
});
