// Polymarket API integration via serverless functions (works on both local and Vercel)
const API_BASE = '/api/proxy'; // Proxied through serverless function (data-api.polymarket.com)
const GAMMA_API_BASE = '/api/gamma-api'; // Proxied through serverless function (gamma-api.polymarket.com)

// Cache for API responses
const cache = new Map();
const CACHE_TTL = 30000; // 30 seconds

// Rate limiting - minimal delay for speed
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 5; // ms between requests (minimal for speed)

async function fetchAPI(endpoint, useGammaApi = false) {
    const now = Date.now();
    if (now - lastRequestTime < MIN_REQUEST_INTERVAL) {
        await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - (now - lastRequestTime)));
    }
    lastRequestTime = Date.now();

    const baseUrl = useGammaApi ? GAMMA_API_BASE : API_BASE;
    const cacheKey = `${baseUrl}${endpoint}`;

    // Check cache first
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }

    const response = await fetch(`${baseUrl}${endpoint}`, {
        headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // Cache successful response
    cache.set(cacheKey, { data, timestamp: Date.now() });

    return data;
}

// Search profiles using Gamma API
async function searchProfiles(query) {
    if (!query || query.trim().length < 2) {
        return [];
    }

    try {
        // The Gamma API search endpoint
        const params = new URLSearchParams({
            _q: query.trim(),
            _limit: 50
        });

        const data = await fetchAPI(`/profiles?${params}`, true);
        return data || [];
    } catch (error) {
        console.error('Error searching profiles:', error);
        return [];
    }
}

// Get positions for a user
async function getPositions(walletAddress, options = {}) {
    const params = new URLSearchParams({
        user: walletAddress.toLowerCase(),
        limit: options.limit || 100,
        offset: options.offset || 0,
        sortBy: options.sortBy || 'CURRENT',
        sortDirection: options.sortDirection || 'DESC',
        sizeThreshold: options.sizeThreshold || 0.01
    });

    if (options.market) {
        params.append('market', options.market);
    }

    try {
        const data = await fetchAPI(`/positions?${params}`);
        return data || [];
    } catch (error) {
        console.error(`Error fetching positions for ${walletAddress}:`, error);
        return [];
    }
}

// Get all positions (paginated)
async function getAllPositions(walletAddress) {
    const allPositions = [];
    let offset = 0;
    const limit = 100;

    while (true) {
        const positions = await getPositions(walletAddress, { limit, offset });
        if (!positions || positions.length === 0) break;

        allPositions.push(...positions);

        if (positions.length < limit) break;
        offset += limit;

        // Safety limit
        if (allPositions.length >= 500) break;
    }

    return allPositions;
}

// Get portfolio value for a user
async function getPortfolioValue(walletAddress) {
    try {
        const data = await fetchAPI(`/value?user=${walletAddress.toLowerCase()}`);
        return data?.value || 0;
    } catch (error) {
        console.error(`Error fetching portfolio value for ${walletAddress}:`, error);
        return 0;
    }
}

// Get activity/trades for a user
async function getActivity(walletAddress, options = {}) {
    const params = new URLSearchParams({
        user: walletAddress.toLowerCase(),
        limit: options.limit || 50,
        offset: options.offset || 0,
        sortBy: 'TIMESTAMP'
    });

    if (options.type) {
        params.append('type', options.type);
    }

    try {
        const data = await fetchAPI(`/activity?${params}`);
        return data || [];
    } catch (error) {
        console.error(`Error fetching activity for ${walletAddress}:`, error);
        return [];
    }
}

// Get trades for a user
async function getTrades(walletAddress, options = {}) {
    const params = new URLSearchParams({
        user: walletAddress.toLowerCase(),
        limit: options.limit || 50,
        offset: options.offset || 0
    });

    if (options.side) {
        params.append('side', options.side);
    }

    try {
        const data = await fetchAPI(`/trades?${params}`);
        return data || [];
    } catch (error) {
        console.error(`Error fetching trades for ${walletAddress}:`, error);
        return [];
    }
}

// Get the earliest trade timestamp for a trader (for chart date range)
async function getFirstTradeDate(walletAddress) {
    try {
        // Fetch a batch of older trades using the 'after' parameter
        // The trades endpoint returns most recent first, so we use a very old timestamp
        const params = new URLSearchParams({
            user: walletAddress.toLowerCase(),
            limit: 500,
            after: 1600000000 // Sept 2020, before Polymarket existed
        });

        const data = await fetchAPI(`/trades?${params}`);
        if (data && data.length > 0) {
            // Find the earliest timestamp
            let minTimestamp = Infinity;
            for (const trade of data) {
                const ts = trade.timestamp || 0;
                if (ts > 0 && ts < minTimestamp) {
                    minTimestamp = ts;
                }
            }
            if (minTimestamp !== Infinity) {
                return minTimestamp * 1000; // Convert to milliseconds
            }
        }
    } catch (error) {
        console.error(`Error fetching first trade date for ${walletAddress}:`, error);
    }
    return null;
}

// Calculate PnL from positions
function calculatePnL(positions) {
    let totalCashPnl = 0;
    let totalCurrentValue = 0;
    let totalInitialValue = 0;
    let realizedPnl = 0;

    for (const position of positions) {
        totalCashPnl += parseFloat(position.cashPnl || 0);
        totalCurrentValue += parseFloat(position.currentValue || 0);
        totalInitialValue += parseFloat(position.initialValue || 0);
        realizedPnl += parseFloat(position.realizedPnl || 0);
    }

    return {
        cashPnl: totalCashPnl,
        currentValue: totalCurrentValue,
        initialValue: totalInitialValue,
        realizedPnl,
        unrealizedPnl: totalCashPnl - realizedPnl,
        totalPnl: totalCashPnl + realizedPnl
    };
}

// Get user's true PnL and volume from leaderboard API
async function getUserStats(wallet) {
    const params = new URLSearchParams({
        user: wallet.toLowerCase(),
        timePeriod: 'ALL'
    });

    try {
        const data = await fetchAPI(`/v1/leaderboard?${params}`);
        if (data && data.length > 0) {
            return {
                totalPnl: parseFloat(data[0].pnl) || 0,
                totalVolume: parseFloat(data[0].vol) || 0,
                rank: data[0].rank,
                userName: data[0].userName
            };
        }
    } catch (error) {
        console.error(`Error fetching user stats for ${wallet}:`, error);
    }
    return { totalPnl: 0, totalVolume: 0, rank: null, userName: null };
}

// Get user's PnL for a specific time period (DAY, WEEK, MONTH, ALL)
async function getUserPnLByPeriod(wallet, timePeriod = 'ALL') {
    const params = new URLSearchParams({
        user: wallet.toLowerCase(),
        timePeriod: timePeriod
    });

    try {
        const data = await fetchAPI(`/v1/leaderboard?${params}`);
        if (data && data.length > 0) {
            return {
                pnl: parseFloat(data[0].pnl) || 0,
                volume: parseFloat(data[0].vol) || 0,
                rank: data[0].rank
            };
        }
    } catch (error) {
        console.error(`Error fetching PnL for ${wallet} (${timePeriod}):`, error);
    }
    return { pnl: 0, volume: 0, rank: null };
}

// Get PnL history for chart (fetches real data from Polymarket profile page)
async function getPnLHistory(wallet) {
    try {
        const response = await fetch(`/api/pnl-history?wallet=${wallet.toLowerCase()}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        return data; // Returns { '1D': [...], '1W': [...], '1M': [...], 'ALL': [...] }
    } catch (error) {
        console.error(`Error fetching PnL history for ${wallet}:`, error);
        return { '1D': [], '1W': [], '1M': [], 'ALL': [] };
    }
}

// Get all time period PnLs for a user
async function getAllPeriodPnLs(wallet) {
    const periods = ['DAY', 'WEEK', 'MONTH', 'ALL'];
    const results = {};

    // Fetch all periods in parallel
    const promises = periods.map(async (period) => {
        const data = await getUserPnLByPeriod(wallet, period);
        return { period, data };
    });

    const periodData = await Promise.all(promises);
    for (const { period, data } of periodData) {
        results[period] = data;
    }

    return results;
}

// Get profit history for a user (for PnL chart)
async function getProfitHistory(wallet, interval = 'day') {
    const params = new URLSearchParams({
        user: wallet.toLowerCase(),
        interval: interval // 'day', 'week', 'month'
    });

    try {
        const data = await fetchAPI(`/profitHistory?${params}`);
        if (data && Array.isArray(data)) {
            return data.map(item => ({
                timestamp: item.t || item.timestamp,
                pnl: parseFloat(item.p || item.pnl || 0)
            }));
        }
    } catch (error) {
        // If the endpoint doesn't exist, generate from trades
        console.warn(`Profit history not available for ${wallet}, generating from trades`);
        return await generatePnLHistoryFromTrades(wallet);
    }
    return [];
}

// Generate PnL history from trades if profitHistory endpoint is not available
async function generatePnLHistoryFromTrades(wallet) {
    try {
        const trades = await getTrades(wallet, { limit: 100 });
        if (!trades || trades.length === 0) return [];

        // Group trades by day and calculate cumulative PnL
        const dailyPnL = new Map();
        let cumulativePnL = 0;

        // Sort trades by timestamp (oldest first)
        const sortedTrades = [...trades].sort((a, b) =>
            new Date(a.timestamp || a.createdAt) - new Date(b.timestamp || b.createdAt)
        );

        for (const trade of sortedTrades) {
            const date = new Date(trade.timestamp || trade.createdAt);
            const dayKey = date.toISOString().split('T')[0];

            // Calculate trade PnL (simplified: profit from price movement)
            const tradePnL = parseFloat(trade.realizedPnl || trade.pnl || 0);
            cumulativePnL += tradePnL;

            dailyPnL.set(dayKey, {
                timestamp: date.getTime(),
                pnl: cumulativePnL
            });
        }

        return Array.from(dailyPnL.values());
    } catch (error) {
        console.error(`Error generating PnL history for ${wallet}:`, error);
        return [];
    }
}

// Get summary stats for a trader
// quickRefresh: skip period PnLs and activity data for much faster refresh
async function getTraderSummary(wallet, quickRefresh = false) {
    // For quick refresh: only fetch positions and user stats (2 API calls instead of 6+)
    if (quickRefresh) {
        const [positions, userStats] = await Promise.all([
            getPositions(wallet, { limit: 100 }), // Single page only for speed
            getUserStats(wallet)
        ]);

        const pnlData = calculatePnL(positions);
        const marketCategories = new Map();
        for (const position of positions) {
            const categories = window.categorizeMarket ? window.categorizeMarket(position.title || '') : ['other'];
            for (const cat of categories) {
                if (!marketCategories.has(cat)) {
                    marketCategories.set(cat, { count: 0, value: 0 });
                }
                const catData = marketCategories.get(cat);
                catData.count++;
                catData.value += parseFloat(position.currentValue || 0);
            }
        }

        return {
            positions,
            positionCount: positions.length,
            ...pnlData,
            totalPnl: userStats.totalPnl,
            totalVolume: userStats.totalVolume,
            leaderboardRank: userStats.rank,
            marketCategories: Object.fromEntries(marketCategories),
            periodPnLs: null, // Skip period PnLs on quick refresh
            recentActivity: []
        };
    }

    // Full load: fetch everything including first trade date and PnL history for charts
    const [positions, userStats, periodPnLs, activity, firstTradeDate, pnlHistory] = await Promise.all([
        getAllPositions(wallet),
        getUserStats(wallet),
        getAllPeriodPnLs(wallet),
        getActivity(wallet, { limit: 100 }), // Reduced from 200
        getFirstTradeDate(wallet),
        getPnLHistory(wallet)
    ]);

    const pnlData = calculatePnL(positions);
    const marketCategories = new Map();
    for (const position of positions) {
        const categories = window.categorizeMarket ? window.categorizeMarket(position.title || '') : ['other'];
        for (const cat of categories) {
            if (!marketCategories.has(cat)) {
                marketCategories.set(cat, { count: 0, value: 0 });
            }
            const catData = marketCategories.get(cat);
            catData.count++;
            catData.value += parseFloat(position.currentValue || 0);
        }
    }

    return {
        positions,
        positionCount: positions.length,
        ...pnlData,
        totalPnl: userStats.totalPnl,
        totalVolume: userStats.totalVolume,
        leaderboardRank: userStats.rank,
        marketCategories: Object.fromEntries(marketCategories),
        periodPnLs: periodPnLs,
        recentActivity: activity,
        firstTradeDate: firstTradeDate,
        pnlHistory: pnlHistory
    };
}

// Fetch data for all traders with concurrency control
// quickRefresh: use higher concurrency and skip activity data
// existingData: existing trader data to preserve values like firstTradeDate during quick refresh
async function fetchAllTradersData(traders, progressCallback, options = {}) {
    const quickRefresh = options.quickRefresh || false;
    const existingData = options.existingData || [];
    const concurrency = quickRefresh ? 10 : 6; // Much higher concurrency for speed

    // Create a lookup map for existing data
    const existingDataMap = new Map();
    for (const trader of existingData) {
        if (trader.wallet) {
            existingDataMap.set(trader.wallet.toLowerCase(), trader);
        }
    }

    const results = new Array(traders.length);
    let completed = 0;

    async function processTrader(index) {
        const trader = traders[index];
        const existingTrader = existingDataMap.get(trader.wallet?.toLowerCase());

        try {
            const summary = await getTraderSummary(trader.wallet, quickRefresh);

            // On quick refresh, preserve data from existing trader if available
            if (quickRefresh && existingTrader) {
                if (existingTrader.firstTradeDate && !summary.firstTradeDate) {
                    summary.firstTradeDate = existingTrader.firstTradeDate;
                }
                if (existingTrader.periodPnLs && !summary.periodPnLs) {
                    summary.periodPnLs = existingTrader.periodPnLs;
                }
                if (existingTrader.pnlHistory && !summary.pnlHistory) {
                    summary.pnlHistory = existingTrader.pnlHistory;
                }
            }

            results[index] = {
                ...trader,
                ...summary,
                lastUpdated: new Date()
            };
        } catch (error) {
            console.error(`Error fetching data for ${trader.name}:`, error);
            results[index] = {
                ...trader,
                error: error.message,
                positions: [],
                positionCount: 0,
                cashPnl: 0,
                currentValue: 0,
                marketCategories: {},
                // Preserve existing data on error
                firstTradeDate: existingTrader?.firstTradeDate,
                periodPnLs: existingTrader?.periodPnLs,
                pnlHistory: existingTrader?.pnlHistory,
                lastUpdated: new Date()
            };
        }

        completed++;
        if (progressCallback) {
            progressCallback(completed, traders.length, trader.name);
        }
    }

    // Process in batches for controlled concurrency
    for (let i = 0; i < traders.length; i += concurrency) {
        const batch = [];
        for (let j = i; j < Math.min(i + concurrency, traders.length); j++) {
            batch.push(processTrader(j));
        }
        await Promise.all(batch);
    }

    return results;
}

// Get leaderboard data
async function getLeaderboard(options = {}) {
    const params = new URLSearchParams({
        timePeriod: options.timePeriod || 'WEEK',
        category: options.category || 'OVERALL',
        orderBy: options.orderBy || 'PNL',
        limit: options.limit || 50,
        offset: options.offset || 0
    });

    try {
        const data = await fetchAPI(`/v1/leaderboard?${params}`);
        return data || [];
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        return [];
    }
}

// Filter leaderboard by thresholds
function filterByThresholds(traders, thresholds) {
    return traders.filter(trader => {
        const pnl = parseFloat(trader.pnl) || 0;
        const vol = parseFloat(trader.vol) || 0;
        const rank = parseInt(trader.rank) || 999;

        return (
            pnl >= (thresholds.minPnl || 0) &&
            vol >= (thresholds.minVolume || 0) &&
            rank <= (thresholds.maxRank || 100)
        );
    });
}

// Search for traders by username or wallet address
// Searches through leaderboard data with pagination for username search
async function searchTraders(query, options = {}) {
    if (!query || query.trim().length < 2) {
        return [];
    }

    const searchQuery = query.trim();
    const searchQueryLower = searchQuery.toLowerCase();
    const results = [];
    const seenWallets = new Set();

    // If it looks like a wallet address, try to get data directly
    if (searchQueryLower.startsWith('0x') && searchQuery.length >= 10) {
        try {
            // Try leaderboard stats first
            const userStats = await getUserStats(searchQuery);
            if (userStats && (userStats.totalPnl !== 0 || userStats.totalVolume !== 0 || userStats.userName)) {
                results.push({
                    user: searchQuery,
                    userName: userStats.userName || searchQuery.slice(0, 6) + '...' + searchQuery.slice(-4),
                    pnl: userStats.totalPnl,
                    vol: userStats.totalVolume,
                    rank: userStats.rank,
                    source: 'direct'
                });
                seenWallets.add(searchQueryLower);
            } else {
                // If not on leaderboard, try to fetch positions to verify it's a valid trader
                const positions = await getPositions(searchQuery, { limit: 10 });
                if (positions && positions.length > 0) {
                    // Calculate basic stats from positions
                    const pnlData = calculatePnL(positions);
                    results.push({
                        user: searchQuery,
                        userName: searchQuery.slice(0, 6) + '...' + searchQuery.slice(-4),
                        pnl: pnlData.cashPnl || 0,
                        vol: 0,
                        rank: null,
                        positionCount: positions.length,
                        source: 'positions',
                        notOnLeaderboard: true
                    });
                    seenWallets.add(searchQueryLower);
                }
            }
        } catch (error) {
            console.error('Error fetching wallet directly:', error);
        }
    } else {
        // For username search, search through leaderboard with pagination
        // We search in parallel across multiple pages and time periods
        const searchPromises = [];
        const pageSize = 100;
        const maxPages = 5; // Search up to 500 traders per time period

        // Search multiple time periods to find the user
        for (const timePeriod of ['ALL', 'MONTH', 'WEEK']) {
            for (let page = 0; page < maxPages; page++) {
                searchPromises.push(
                    getLeaderboard({
                        timePeriod,
                        category: 'OVERALL',
                        limit: pageSize,
                        offset: page * pageSize,
                        orderBy: 'PNL'
                    }).catch(() => [])
                );
            }
        }

        try {
            const allLeaderboards = await Promise.all(searchPromises);

            for (const leaderboard of allLeaderboards) {
                if (!leaderboard || !Array.isArray(leaderboard)) continue;

                for (const trader of leaderboard) {
                    const userName = (trader.userName || '').toLowerCase();
                    // Use proxyWallet if available, fallback to user
                    const walletAddress = (trader.proxyWallet || trader.user || '').toLowerCase();

                    if (!walletAddress || seenWallets.has(walletAddress)) continue;

                    // Check if username matches
                    if (userName.includes(searchQueryLower) || walletAddress.includes(searchQueryLower)) {
                        seenWallets.add(walletAddress);
                        results.push({
                            user: trader.proxyWallet || trader.user,
                            userName: trader.userName || walletAddress.slice(0, 6) + '...' + walletAddress.slice(-4),
                            pnl: parseFloat(trader.pnl) || 0,
                            vol: parseFloat(trader.vol) || 0,
                            rank: trader.rank ? parseInt(trader.rank) : null,
                            profileImage: trader.profileImage || '',
                            source: 'leaderboard'
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Error searching leaderboards:', error);
        }
    }

    // Sort results by PnL descending
    results.sort((a, b) => (b.pnl || 0) - (a.pnl || 0));

    return results;
}

// Export API functions
window.PolymarketAPI = {
    getPositions,
    getAllPositions,
    getPortfolioValue,
    getActivity,
    getTrades,
    getFirstTradeDate,
    calculatePnL,
    getTraderSummary,
    fetchAllTradersData,
    getLeaderboard,
    filterByThresholds,
    searchTraders,
    searchProfiles,
    getProfitHistory,
    getPnLHistory,
    getUserPnLByPeriod,
    getAllPeriodPnLs,
    clearCache: () => cache.clear()
};
