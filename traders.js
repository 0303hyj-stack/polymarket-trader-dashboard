// Trader configuration with wallet addresses and metadata
const TRADERS = [
    {
        id: 'kch123',
        name: 'kch123',
        displayName: 'Aggravating-Grin',
        wallet: '0x6a72f61820b26b1fe4d956e17b6dc2a1ea3033ee',
        profileUrl: 'https://polymarket.com/@kch123',
        joinDate: 'June 2025'
    },
    {
        id: 'sovereign2013',
        name: 'sovereign2013',
        displayName: 'Ultimate-Locality',
        wallet: '0xee613b3fc183ee44f9da9c05f53e2da107e3debf',
        profileUrl: 'https://polymarket.com/@sovereign2013',
        joinDate: 'July 2025'
    },
    {
        id: 'swisstony',
        name: 'swisstony',
        displayName: 'prada flip flops',
        wallet: '0x204f72f35326db932158cba6adff0b9a1da95e14',
        profileUrl: 'https://polymarket.com/@swisstony',
        joinDate: 'July 2025'
    },
    {
        id: 'RN1',
        name: 'RN1',
        displayName: 'Scary-Edible',
        wallet: '0x2005d16a84ceefa912d4e380cd32e7ff827875ea',
        profileUrl: 'https://polymarket.com/@RN1',
        joinDate: 'December 2024'
    },
    {
        id: 'SeriouslySirius',
        name: 'SeriouslySirius',
        displayName: 'Lumbering-Leisure',
        wallet: '0x16b29c50f2439faf627209b2ac0c7bbddaa8a881',
        profileUrl: 'https://polymarket.com/@SeriouslySirius',
        joinDate: 'October 2025'
    },
    {
        id: 'rwo',
        name: 'rwo',
        displayName: 'Smart-Compassion',
        wallet: '0xd189664c5308903476f9f079820431e4fd7d06f4',
        profileUrl: 'https://polymarket.com/@rwo',
        joinDate: 'October 2024'
    },
    {
        id: 'PurpleThunderBicycleMountain',
        name: 'PurpleThunderBicycleMountain',
        displayName: 'PurpleThunder',
        wallet: '0x589222a5124a96765443b97a3498d89ffd824ad2',
        profileUrl: 'https://polymarket.com/@PurpleThunderBicycleMountain',
        joinDate: 'December 2025'
    },
    {
        id: 'BoshBashBish',
        name: 'BoshBashBish',
        displayName: 'Made-Up-Minion',
        wallet: '0x29bc82f761749e67fa00d62896bc6855097b683c',
        profileUrl: 'https://polymarket.com/@BoshBashBish',
        joinDate: 'December 2025'
    },
    {
        id: '0x8dxd',
        name: '0x8dxd',
        displayName: 'Blushing-Fine',
        wallet: '0x63ce342161250d705dc0b16df89036c8e5f9ba9a',
        profileUrl: 'https://polymarket.com/@0x8dxd',
        joinDate: 'December 2025'
    },
    {
        id: 'absol',
        name: 'absol',
        displayName: 'Colorless-Fantasy',
        wallet: '0x22292decebf2e9146b27fe59404d162447ea6bf8',
        profileUrl: 'https://polymarket.com/@absol',
        joinDate: 'December 2025'
    },
    {
        id: 'securebet',
        name: 'securebet',
        displayName: 'Unaware-Scimitar',
        wallet: '0xaa7a74b8c754e8aacc1ac2dedb699af0a3224d23',
        profileUrl: 'https://polymarket.com/@securebet',
        joinDate: 'July 2024'
    },
    {
        id: '1234765',
        name: '1234765',
        displayName: 'Kosher-Goal',
        wallet: '0x1ef153afde69f29e7803cafef81a577b8b103713',
        profileUrl: 'https://polymarket.com/@1234765',
        joinDate: 'January 2026'
    },
    {
        id: '0x594edB9112f526Fa6A80b8F858A6379C8A2c1C11-1762688003124',
        name: '0x594e...3124',
        displayName: 'Fussy-Expedition',
        wallet: '0x594edB9112f526Fa6A80b8F858A6379C8A2c1C11',
        profileUrl: 'https://polymarket.com/@0x594edB9112f526Fa6A80b8F858A6379C8A2c1C11-1762688003124',
        joinDate: 'November 2025'
    },
    {
        id: 'TeemuTeemuTeemu',
        name: 'TeemuTeemuTeemu',
        displayName: 'Grubby-Segment',
        wallet: '0x5388bc8cb72eb19a3bec0e8f3db6a77f7cd54d5a',
        profileUrl: 'https://polymarket.com/@TeemuTeemuTeemu',
        joinDate: 'July 2025'
    },
    {
        id: 'Account88888',
        name: 'Account88888',
        displayName: 'Disguised-Duster',
        wallet: '0x7f69983eb28245bba0d5083502a78744a8f66162',
        profileUrl: 'https://polymarket.com/@Account88888',
        joinDate: 'December 2025'
    },
    {
        id: '0x3585558D59C5Ee4A53BB552C2dB9f5C518fE7c02-1768265321304',
        name: '0x3585...1304',
        displayName: 'Oblong-Salsa',
        wallet: '0x3585558d59c5ee4a53bb552c2db9f5c518fe7c02',
        profileUrl: 'https://polymarket.com/@0x3585558D59C5Ee4A53BB552C2dB9f5C518fE7c02-1768265321304',
        joinDate: 'January 2026'
    },
    {
        id: 'distinct-baguette',
        name: 'distinct-baguette',
        displayName: 'Frozen-Technician',
        wallet: '0xe00740bce98a594e26861838885ab310ec3b548c',
        profileUrl: 'https://polymarket.com/@distinct-baguette',
        joinDate: 'October 2025'
    },
    {
        id: 'BK9496',
        name: 'BK9496',
        displayName: 'BK9496',
        wallet: '0xb3dda8a76f79f132b6f1a4b3c89f47474ea4a7e0',
        profileUrl: 'https://polymarket.com/@BK9496',
        joinDate: 'August 2025'
    },
    {
        id: 'gmanas',
        name: 'gmanas',
        displayName: 'Wicked-Rap',
        wallet: '0xe90bec87d9ef430f27f9dcfe72c34b76967d5da2',
        profileUrl: 'https://polymarket.com/@gmanas',
        joinDate: 'November 2025'
    },
    {
        id: '0xf2e346ab',
        name: '0xf2e346ab',
        displayName: 'Firsthand-Advantage',
        wallet: '0x8278252ebbf354eca8ce316e680a0eaf02859464',
        profileUrl: 'https://polymarket.com/@0xf2e346ab',
        joinDate: 'April 2025'
    },
    {
        id: 'automatedAItradingbot',
        name: 'automatedAItradingbot',
        displayName: 'Smooth-Servitude',
        wallet: '0xd8f8c13644ea84d62e1ec88c5d1215e436eb0f11',
        profileUrl: 'https://polymarket.com/@automatedAItradingbot',
        joinDate: 'January 2025'
    },
    {
        id: 'archaic',
        name: 'archaic',
        displayName: 'Dull-Universe',
        wallet: '0x1f0a343513aa6060488fabe96960e6d1e177f7aa',
        profileUrl: 'https://polymarket.com/@archaic',
        joinDate: 'December 2021'
    },
    {
        id: 'gabagool22',
        name: 'gabagool22',
        displayName: 'Grown-Cantaloupe',
        wallet: '0x6031b6eed1c97e853c6e0f03ad3ce3529351f96d',
        profileUrl: 'https://polymarket.com/@gabagool22',
        joinDate: 'October 2025'
    }
];

// Trading strategy definitions with refined criteria
const TRADING_STRATEGIES = {
    arbitrage: {
        name: 'Arbitrage',
        description: 'Exploits price inefficiencies - High volume-to-PnL ratio (>30x), many positions (>40), profits from small price differences',
        icon: '⚖️',
        color: '#8b5cf6'
    },
    liquidity: {
        name: 'Liquidity',
        description: 'Market maker providing liquidity - Extremely high volume (>$10M), very high volume-to-PnL ratio (>50x), consistent small gains',
        icon: '💧',
        color: '#14b8a6'
    },
    quant: {
        name: 'Quant',
        description: 'Algorithmic/systematic trading - Bot-like name OR (high volume >$5M + high position count >30 + consistent patterns)',
        icon: '🤖',
        color: '#3b82f6'
    },
    meta: {
        name: 'Meta',
        description: 'Diversified strategic trading - 5+ market categories, balanced exposure, strategic portfolio allocation',
        icon: '🎯',
        color: '#a855f7'
    },
    eventDriven: {
        name: 'Event-Driven',
        description: 'Trades around catalysts - >70% exposure in politics/sports/entertainment, concentrated bets on scheduled events',
        icon: '📅',
        color: '#f59e0b'
    },
    conviction: {
        name: 'Conviction',
        description: 'High-conviction focused bets - Few positions (<15) with large PnL (>$50K), concentrated risk-taking',
        icon: '🎲',
        color: '#ec4899'
    },
    momentum: {
        name: 'Momentum',
        description: 'Trend-following trading - Moderate positions (10-40), good returns relative to volume, rides price movements',
        icon: '📈',
        color: '#06b6d4'
    },
    conservative: {
        name: 'Conservative',
        description: 'Risk-averse trading - Low daily volatility (<1% of total PnL), steady returns, hedged positions',
        icon: '🛡️',
        color: '#64748b'
    }
};

// Function to classify trader strategy based on their trading patterns
// Uses refined criteria for more accurate classification
function classifyTraderStrategy(trader) {
    const scores = {};

    // Initialize scores
    for (const strategy of Object.keys(TRADING_STRATEGIES)) {
        scores[strategy] = 0;
    }

    // Extract metrics
    const positionCount = trader.positionCount || 0;
    const totalVolume = parseFloat(trader.totalVolume) || 0;
    const totalPnl = parseFloat(trader.totalPnl) || 0;
    const absPnl = Math.abs(totalPnl);
    const currentValue = parseFloat(trader.currentValue) || 0;
    const categories = trader.marketCategories || {};
    const categoryCount = Object.keys(categories).filter(k => categories[k]?.count > 0).length;

    // Calculate key ratios
    const volumeToPnlRatio = absPnl > 0 ? totalVolume / absPnl : 0;
    const pnlPerPosition = positionCount > 0 ? absPnl / positionCount : 0;
    const volumePerPosition = positionCount > 0 ? totalVolume / positionCount : 0;

    // Get PnL history data for volatility calculation
    let dayChange = 0;
    let weekChange = 0;
    if (trader.pnlHistory) {
        if (trader.pnlHistory['1D'] && trader.pnlHistory['1D'].length > 1) {
            const h = trader.pnlHistory['1D'];
            dayChange = h[h.length - 1].pnl - h[0].pnl;
        }
        if (trader.pnlHistory['1W'] && trader.pnlHistory['1W'].length > 1) {
            const h = trader.pnlHistory['1W'];
            weekChange = h[h.length - 1].pnl - h[0].pnl;
        }
    }
    const dailyVolatility = absPnl > 0 ? Math.abs(dayChange) / absPnl : 0;

    // Calculate category concentration
    const totalCategoryValue = Object.values(categories).reduce((sum, c) => sum + (c.value || 0), 0);
    const eventCategories = ['politics', 'sports', 'entertainment'];
    let eventCategoryValue = 0;
    for (const cat of eventCategories) {
        if (categories[cat]) {
            eventCategoryValue += categories[cat].value || 0;
        }
    }
    const eventConcentration = totalCategoryValue > 0 ? eventCategoryValue / totalCategoryValue : 0;

    // ===== STRATEGY SCORING =====

    // 1. QUANT - Algorithmic/Bot trading
    // Strong indicator: bot-like name
    const nameLower = (trader.name || '').toLowerCase();
    if (nameLower.includes('bot') || nameLower.includes('automated') ||
        nameLower.includes('algo') || nameLower.includes('ai trading')) {
        scores.quant += 60;
    }
    // High volume + many positions + systematic patterns
    if (totalVolume > 5000000 && positionCount > 30) {
        scores.quant += 25;
    }
    if (totalVolume > 10000000 && positionCount > 50) {
        scores.quant += 20;
    }
    // Very consistent volume per position suggests automation
    if (positionCount > 20 && volumePerPosition > 50000 && volumePerPosition < 500000) {
        scores.quant += 15;
    }

    // 2. LIQUIDITY - Market maker providing liquidity
    // Extremely high volume relative to PnL (taking small spreads many times)
    if (totalVolume > 10000000 && volumeToPnlRatio > 50) {
        scores.liquidity += 40;
    }
    if (totalVolume > 50000000 && volumeToPnlRatio > 30) {
        scores.liquidity += 30;
    }
    // Many positions with high volume suggests market making
    if (positionCount > 50 && totalVolume > 5000000) {
        scores.liquidity += 20;
    }
    // Very high volume to PnL ratio is key indicator
    if (volumeToPnlRatio > 100) {
        scores.liquidity += 25;
    }

    // 3. ARBITRAGE - Exploiting price inefficiencies
    // High volume-to-PnL ratio (30-80x) with many positions
    if (volumeToPnlRatio > 30 && volumeToPnlRatio < 100 && positionCount > 40) {
        scores.arbitrage += 35;
    }
    // Many positions (needs to spread risk across many small bets)
    if (positionCount > 40 && positionCount < 150) {
        scores.arbitrage += 25;
    }
    // Moderate volume relative to positions
    if (volumeToPnlRatio > 20 && volumeToPnlRatio < 60 && positionCount > 25) {
        scores.arbitrage += 20;
    }

    // 4. META - Diversified strategic trading
    // Must have exposure to 5+ categories
    if (categoryCount >= 5) {
        scores.meta += 35;
    }
    if (categoryCount >= 7) {
        scores.meta += 20;
    }
    // Balanced exposure (no single category dominates)
    const maxCategoryPct = totalCategoryValue > 0
        ? Math.max(...Object.values(categories).map(c => (c.value || 0) / totalCategoryValue))
        : 1;
    if (maxCategoryPct < 0.4 && categoryCount >= 4) {
        scores.meta += 20;
    }
    // Moderate position count with diversification
    if (positionCount >= 15 && positionCount <= 60 && categoryCount >= 4) {
        scores.meta += 15;
    }

    // 5. EVENT-DRIVEN - Trades around catalysts
    // High concentration in event-based categories (politics, sports, entertainment)
    if (eventConcentration > 0.7) {
        scores.eventDriven += 40;
    }
    if (eventConcentration > 0.5 && eventConcentration <= 0.7) {
        scores.eventDriven += 25;
    }
    // Focused positions in event categories
    if (eventConcentration > 0.6 && positionCount >= 5 && positionCount <= 40) {
        scores.eventDriven += 20;
    }
    // Politics or sports heavy
    const politicsConc = totalCategoryValue > 0 && categories.politics
        ? (categories.politics.value || 0) / totalCategoryValue : 0;
    const sportsConc = totalCategoryValue > 0 && categories.sports
        ? (categories.sports.value || 0) / totalCategoryValue : 0;
    if (politicsConc > 0.5 || sportsConc > 0.5) {
        scores.eventDriven += 15;
    }

    // 6. CONVICTION - High-conviction focused bets
    // Few positions with significant PnL
    if (positionCount < 15 && absPnl > 50000) {
        scores.conviction += 35;
    }
    if (positionCount < 10 && absPnl > 100000) {
        scores.conviction += 25;
    }
    // High PnL per position
    if (pnlPerPosition > 10000 && positionCount < 20) {
        scores.conviction += 20;
    }
    // Concentrated bets (few positions, high value)
    if (positionCount < 12 && currentValue > 10000) {
        scores.conviction += 15;
    }

    // 7. MOMENTUM - Trend-following
    // Moderate positions with good returns
    if (positionCount >= 10 && positionCount <= 40 && totalPnl > 0) {
        scores.momentum += 25;
    }
    // Reasonable volume-to-PnL (not too high like arb/liquidity)
    if (volumeToPnlRatio > 5 && volumeToPnlRatio < 25 && totalPnl > 0) {
        scores.momentum += 20;
    }
    // Good PnL with moderate activity
    if (totalPnl > 50000 && positionCount >= 10 && positionCount <= 50) {
        scores.momentum += 20;
    }
    // Not dominated by events
    if (eventConcentration < 0.5 && positionCount >= 10) {
        scores.momentum += 10;
    }

    // 8. CONSERVATIVE - Risk-averse trading
    // Low daily volatility
    if (dailyVolatility < 0.01 && absPnl > 10000) {
        scores.conservative += 30;
    }
    if (dailyVolatility < 0.005 && absPnl > 5000) {
        scores.conservative += 25;
    }
    // Steady small gains
    if (totalPnl > 0 && dailyVolatility < 0.02 && weekChange > 0) {
        scores.conservative += 20;
    }
    // Low volume relative to PnL (not churning)
    if (volumeToPnlRatio < 15 && totalPnl > 0) {
        scores.conservative += 15;
    }

    // ===== DETERMINE PRIMARY AND SECONDARY STRATEGIES =====

    // Find the highest scoring strategy
    let maxScore = 0;
    let primaryStrategy = 'momentum'; // default

    for (const [strategy, score] of Object.entries(scores)) {
        if (score > maxScore) {
            maxScore = score;
            primaryStrategy = strategy;
        }
    }

    // Get secondary strategy (second highest, must have meaningful score)
    let secondaryStrategy = null;
    let secondMaxScore = 0;
    for (const [strategy, score] of Object.entries(scores)) {
        if (strategy !== primaryStrategy && score > secondMaxScore && score >= 20) {
            secondMaxScore = score;
            secondaryStrategy = strategy;
        }
    }

    // If no clear winner, default based on basic metrics
    if (maxScore < 20) {
        if (positionCount < 10) {
            primaryStrategy = 'conviction';
        } else if (categoryCount >= 4) {
            primaryStrategy = 'meta';
        } else {
            primaryStrategy = 'momentum';
        }
    }

    return {
        primary: primaryStrategy,
        secondary: secondaryStrategy,
        scores: scores,
        confidence: maxScore
    };
}

// Market categories for classification
const MARKET_CATEGORIES = {
    politics: {
        name: 'Politics',
        keywords: ['trump', 'biden', 'election', 'president', 'congress', 'senate', 'governor', 'vote', 'democrat', 'republican', 'political', 'cabinet', 'administration', 'executive order', 'impeach', 'poll'],
        color: 'politics'
    },
    crypto: {
        name: 'Crypto',
        keywords: ['bitcoin', 'btc', 'ethereum', 'eth', 'crypto', 'token', 'solana', 'sol', 'doge', 'memecoin', 'blockchain', 'defi', 'nft', 'altcoin', 'binance'],
        color: 'crypto'
    },
    sports: {
        name: 'Sports',
        keywords: ['nfl', 'nba', 'mlb', 'nhl', 'ufc', 'soccer', 'football', 'basketball', 'baseball', 'hockey', 'tennis', 'golf', 'championship', 'super bowl', 'world series', 'playoffs', 'mvp', 'f1', 'formula'],
        color: 'sports'
    },
    science: {
        name: 'Science & Tech',
        keywords: ['ai', 'artificial intelligence', 'spacex', 'nasa', 'climate', 'covid', 'vaccine', 'fda', 'study', 'research', 'tech', 'apple', 'google', 'microsoft', 'openai', 'chatgpt', 'agi'],
        color: 'science'
    },
    entertainment: {
        name: 'Entertainment',
        keywords: ['movie', 'film', 'oscar', 'grammy', 'emmy', 'celebrity', 'album', 'music', 'taylor swift', 'kanye', 'netflix', 'disney', 'streaming', 'box office', 'award'],
        color: 'entertainment'
    },
    business: {
        name: 'Business & Finance',
        keywords: ['stock', 'market', 's&p', 'nasdaq', 'fed', 'interest rate', 'inflation', 'gdp', 'unemployment', 'earnings', 'ipo', 'merger', 'acquisition', 'recession', 'economy'],
        color: 'business'
    },
    world: {
        name: 'Geopolitics/War',
        keywords: ['war', 'ukraine', 'russia', 'china', 'israel', 'gaza', 'iran', 'north korea', 'nato', 'un', 'treaty', 'sanctions', 'military', 'conflict'],
        color: 'world'
    },
    weather: {
        name: 'Weather',
        keywords: ['weather', 'temperature', 'hurricane', 'storm', 'tropical', 'rainfall', 'snow', 'celsius', 'fahrenheit', 'forecast', 'tornado', 'flood', 'drought', 'heatwave', 'cold', 'winter', 'monsoon', 'cyclone', 'climate change', 'el nino', 'la nina'],
        color: 'weather'
    }
};

// Helper function to categorize a market based on title
function categorizeMarket(title) {
    const lowerTitle = title.toLowerCase();
    const categories = [];

    for (const [key, category] of Object.entries(MARKET_CATEGORIES)) {
        for (const keyword of category.keywords) {
            if (lowerTitle.includes(keyword)) {
                categories.push(key);
                break;
            }
        }
    }

    return categories.length > 0 ? categories : ['other'];
}

// Export for use in other files
window.TRADERS = TRADERS;
window.MARKET_CATEGORIES = MARKET_CATEGORIES;
window.TRADING_STRATEGIES = TRADING_STRATEGIES;
window.categorizeMarket = categorizeMarket;
window.classifyTraderStrategy = classifyTraderStrategy;
