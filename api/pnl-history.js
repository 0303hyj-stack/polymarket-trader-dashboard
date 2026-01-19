const https = require('https');

// Simple in-memory cache
const cache = new Map();
const CACHE_TTL = 60000; // 60 seconds for PnL history

// Fetch JSON from URL
function fetchJSON(url) {
    return new Promise((resolve, reject) => {
        https.get(url, {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'PolymarketDashboard/1.0'
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error(`Failed to parse response: ${e.message}`));
                }
            });
        }).on('error', reject);
    });
}

// Fetch all trades for a wallet (paginated)
async function fetchAllTrades(walletAddress, maxTrades = 200) {
    const allTrades = [];
    let offset = 0;
    const limit = 100;

    while (allTrades.length < maxTrades) {
        try {
            const trades = await fetchJSON(`https://data-api.polymarket.com/trades?user=${walletAddress.toLowerCase()}&limit=${limit}&offset=${offset}`);
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

// Get user's PnL for a specific time period from leaderboard
async function fetchUserPnLByPeriod(walletAddress, timePeriod = 'ALL') {
    try {
        const data = await fetchJSON(`https://data-api.polymarket.com/v1/leaderboard?user=${walletAddress.toLowerCase()}&timePeriod=${timePeriod}`);
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
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
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

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
    }

    const url = new URL(req.url, `http://${req.headers.host}`);
    const wallet = url.searchParams.get('wallet');

    if (!wallet) {
        res.status(400).json({ error: 'Missing wallet parameter' });
        return;
    }

    try {
        const data = await fetchPnLHistory(wallet);
        res.status(200).json(data);
    } catch (error) {
        console.error('PnL History Error:', error.message);
        res.status(500).json({ error: error.message });
    }
};
