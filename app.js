// Main application logic
let tradersData = [];
let watchlist = [...TRADERS]; // Start with predefined traders
let discoveredTraders = [];
let refreshInterval = null;
let isLoading = false;

// LocalStorage keys
const STORAGE_KEY = 'polymarket_watchlist';

// DOM Elements
const elements = {
    tradersGrid: document.getElementById('traders-grid'),
    totalTraders: document.getElementById('total-traders'),
    totalVolume: document.getElementById('total-volume'),
    lastUpdate: document.getElementById('last-update'),
    refreshBtn: document.getElementById('refresh-btn'),
    refreshIntervalSelect: document.getElementById('refresh-interval'),
    searchTraders: document.getElementById('search-traders'),
    sortBy: document.getElementById('sort-by'),
    sortOrder: document.getElementById('sort-order'),
    positionsTraderSelect: document.getElementById('positions-trader-select'),
    positionsList: document.getElementById('positions-list'),
    marketCategories: document.getElementById('market-categories'),
    breakdownList: document.getElementById('breakdown-list'),
    modal: document.getElementById('trader-modal'),
    modalBody: document.getElementById('modal-body')
};

// Utility functions
function formatCurrency(value) {
    const num = parseFloat(value) || 0;
    if (Math.abs(num) >= 1000000) {
        return '$' + (num / 1000000).toFixed(2) + 'M';
    } else if (Math.abs(num) >= 1000) {
        return '$' + (num / 1000).toFixed(2) + 'K';
    }
    return '$' + num.toFixed(2);
}

function formatNumber(value) {
    const num = parseFloat(value) || 0;
    return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function formatTimeAgo(date) {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
    if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
    return Math.floor(seconds / 86400) + 'd ago';
}

function truncateAddress(address) {
    if (!address) return '';
    return address.slice(0, 6) + '...' + address.slice(-4);
}

// Truncate long trader names/IDs
// e.g., "0x006cc834Cc092684F1B56626E23BEdB3835c16ea-1729683673397" -> "0x006c...c16ea"
// e.g., "0x594edB9112f526Fa6A80b8F858A6379C8A2c1C11" -> "0x594e...1C11"
function truncateTraderName(name) {
    if (!name) return '';
    // If name is short enough, return as-is
    if (name.length <= 20) return name;

    // Check if it's a wallet address (starts with 0x)
    if (name.startsWith('0x')) {
        // If it has a timestamp suffix (e.g., "0x...address-timestamp"), extract wallet part
        let walletPart = name;
        if (name.includes('-')) {
            walletPart = name.split('-')[0];
        }
        // Standard Ethereum address is 42 chars (0x + 40 hex chars)
        // Show first 6 chars and last 4 chars of the wallet address
        return walletPart.slice(0, 6) + '...' + walletPart.slice(-4);
    }

    // For other long names, truncate with ellipsis
    return name.slice(0, 6) + '...' + name.slice(-4);
}

function getPnLClass(value) {
    const num = parseFloat(value) || 0;
    return num >= 0 ? 'positive' : 'negative';
}

// Initialize tabs
function initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            // Update active tab button
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Show corresponding content
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            document.getElementById(btn.dataset.tab).classList.add('active');

            // Load Top Wins data when tab is first shown
            if (btn.dataset.tab === 'top-wins' && topWinsState.data.length === 0) {
                loadTopWins();
            }

            // Render Theme Compare charts when tab is shown
            if (btn.dataset.tab === 'theme-compare') {
                renderThemeCompareCharts();
            }
        });
    });
}

// Format large PnL for display
function formatPnLLarge(value) {
    const num = parseFloat(value) || 0;
    if (Math.abs(num) >= 1000000) {
        return '$' + (num / 1000000).toFixed(2) + 'M';
    } else if (Math.abs(num) >= 1000) {
        return '$' + (num / 1000).toFixed(1) + 'K';
    }
    return '$' + num.toFixed(2);
}

// Store chart instances to destroy them before re-rendering
const chartInstances = new Map();

// Sanitize ID for use as HTML element ID
function sanitizeId(id) {
    return id.replace(/[^a-zA-Z0-9]/g, '_');
}

// Render trader card
function renderTraderCard(trader) {
    const topCategories = Object.entries(trader.marketCategories || {})
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 3)
        .map(([cat]) => cat);

    const pnlValue = parseFloat(trader.totalPnl) || 0;
    const pnlIsPositive = pnlValue >= 0;
    const pnlClass = pnlIsPositive ? 'pnl-positive' : 'pnl-negative';
    const pnlIcon = pnlIsPositive ? '▲' : '▼';
    const chartId = sanitizeId(trader.id);

    // Classify trader strategy
    const strategyInfo = window.classifyTraderStrategy ? window.classifyTraderStrategy(trader) : { primary: 'timing' };
    const primaryStrategy = TRADING_STRATEGIES[strategyInfo.primary] || TRADING_STRATEGIES.timing;
    const secondaryStrategy = strategyInfo.secondary ? TRADING_STRATEGIES[strategyInfo.secondary] : null;

    return `
        <div class="trader-card" data-trader-id="${trader.id}" data-strategy="${strategyInfo.primary}">
            <div class="trader-card-top" onclick="showTraderModal('${trader.id}')">
                <div class="trader-info-left">
                    <div class="trader-name" title="${trader.name}">${truncateTraderName(trader.name)}</div>
                    <div class="trader-meta">
                        ${trader.leaderboardRank ? `<span class="trader-rank">#${trader.leaderboardRank}</span>` : ''}
                        <span class="trader-wallet">${truncateAddress(trader.wallet)}</span>
                    </div>
                    <div class="trader-strategy">
                        <span class="strategy-badge" style="background-color: ${primaryStrategy.color}20; color: ${primaryStrategy.color}; border: 1px solid ${primaryStrategy.color}40;">
                            ${primaryStrategy.name}
                        </span>
                        ${secondaryStrategy ? `
                            <span class="strategy-badge secondary" style="background-color: ${secondaryStrategy.color}10; color: ${secondaryStrategy.color}; border: 1px solid ${secondaryStrategy.color}30;">
                                ${secondaryStrategy.name}
                            </span>
                        ` : ''}
                    </div>
                </div>
                <div class="pnl-display ${pnlClass}" id="pnl-display-${chartId}">
                    <div class="pnl-label">
                        <span class="pnl-icon">${pnlIcon}</span> Profit/Loss
                    </div>
                    <div class="pnl-value" id="pnl-value-${chartId}">${formatPnLLarge(trader.totalPnl)}</div>
                    <div class="pnl-period" id="pnl-period-${chartId}">All-Time</div>
                </div>
            </div>
            <div class="chart-section">
                <div class="timeframe-selector" id="timeframe-${chartId}">
                    <button type="button" class="timeframe-btn" data-timeframe="1D" data-chart="${chartId}">1D</button>
                    <button type="button" class="timeframe-btn" data-timeframe="1W" data-chart="${chartId}">1W</button>
                    <button type="button" class="timeframe-btn" data-timeframe="1M" data-chart="${chartId}">1M</button>
                    <button type="button" class="timeframe-btn active" data-timeframe="ALL" data-chart="${chartId}">ALL</button>
                </div>
                <div class="pnl-chart-container">
                    <canvas id="chart-${chartId}" class="pnl-chart"></canvas>
                </div>
            </div>
            <div class="trader-stats-row" onclick="showTraderModal('${trader.id}')">
                <div class="trader-stat-item">
                    <span class="stat-label">Positions Value</span>
                    <span class="stat-value">${formatCurrency(trader.currentValue)}</span>
                </div>
                <div class="trader-stat-item">
                    <span class="stat-label">Volume</span>
                    <span class="stat-value">${formatCurrency(trader.totalVolume)}</span>
                </div>
                <div class="trader-stat-item">
                    <span class="stat-label">Positions</span>
                    <span class="stat-value">${trader.positionCount || 0}</span>
                </div>
            </div>
            ${topCategories.length > 0 ? `
                <div class="trader-markets" onclick="showTraderModal('${trader.id}')">
                    <div class="market-tags">
                        ${topCategories.map(cat => `<span class="market-tag ${cat}">${MARKET_CATEGORIES[cat]?.name || cat}</span>`).join('')}
                    </div>
                </div>
            ` : ''}
        </div>
    `;
}

// Store trader data for chart updates
const traderChartData = new Map();

// Custom Chart.js plugin to draw vertical tracking line on hover
const verticalLinePlugin = {
    id: 'verticalLine',
    afterDatasetsDraw: function(chart, args, options) {
        const activeElements = chart.getActiveElements();

        if (activeElements.length > 0) {
            const activePoint = activeElements[0];
            const ctx = chart.ctx;
            const x = activePoint.element.x;
            const chartArea = chart.chartArea;
            const topY = chartArea.top;
            const bottomY = chartArea.bottom;

            // Draw vertical line (solid, thin)
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(x, topY);
            ctx.lineTo(x, bottomY);
            ctx.lineWidth = 0.5;
            ctx.strokeStyle = 'rgba(99, 102, 241, 0.3)';
            ctx.stroke();
            ctx.restore();

            // Draw small dot at the data point
            const y = activePoint.element.y;
            ctx.save();
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, 2 * Math.PI);
            ctx.fillStyle = chart.data.datasets[0].borderColor;
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.restore();
        }
    }
};

// Register the plugin globally
Chart.register(verticalLinePlugin);

// Render PnL sparkline chart for a trader
async function renderPnLChart(trader, timeframe = 'ALL') {
    const chartId = sanitizeId(trader.id);
    const canvas = document.getElementById(`chart-${chartId}`);
    if (!canvas) {
        console.warn(`Canvas not found for trader: ${trader.id} (chartId: ${chartId})`);
        return;
    }

    // Store trader data for later use
    traderChartData.set(chartId, trader);

    // Destroy existing chart instance if it exists
    if (chartInstances.has(chartId)) {
        chartInstances.get(chartId).destroy();
    }

    // Generate data based on timeframe using real data
    let historyData = generateTimeframeData(trader, timeframe);

    if (!historyData || historyData.length < 2) {
        const periodPnl = getPnLForTimeframe(trader, timeframe);
        historyData = [
            { timestamp: Date.now() - 30 * 24 * 60 * 60 * 1000, pnl: trader.totalPnl - periodPnl },
            { timestamp: Date.now(), pnl: trader.totalPnl || 0 }
        ];
    }

    const ctx = canvas.getContext('2d');
    const pnlValues = historyData.map(d => d.pnl);
    const finalPnl = pnlValues[pnlValues.length - 1];
    // Determine color based on the period's PnL change (end - start)
    const startPnl = pnlValues[0] || 0;
    const pnlChange = finalPnl - startPnl;
    const isPositive = pnlChange >= 0;
    // Use blue/purple for positive, red for negative (like Polymarket)
    const lineColor = isPositive ? '#6366f1' : '#ef4444';
    const gradientColor = isPositive ? 'rgba(99, 102, 241, 0.1)' : 'rgba(239, 68, 68, 0.1)';

    // Create gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, gradientColor);
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    const chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: historyData.map(d => {
                const date = new Date(d.timestamp);
                if (timeframe === '1D') {
                    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                }
                return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
            }),
            datasets: [{
                data: pnlValues,
                borderColor: lineColor,
                borderWidth: 2.5,
                fill: true,
                backgroundColor: gradient,
                tension: 0.3,
                pointRadius: 0,
                pointHoverRadius: 0,
                borderCapStyle: 'round',
                borderJoinStyle: 'round'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    enabled: false,
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                x: { display: false },
                y: { display: false }
            },
            interaction: {
                mode: 'index',
                intersect: false
            },
            elements: {
                line: { borderJoinStyle: 'round' }
            },
            onHover: function(event, elements, chart) {
                const pnlValueEl = document.getElementById(`pnl-value-${chartId}`);
                const pnlPeriodEl = document.getElementById(`pnl-period-${chartId}`);
                const pnlDisplayEl = document.getElementById(`pnl-display-${chartId}`);

                if (elements.length > 0) {
                    const index = elements[0].index;
                    const currentValue = historyData[index].pnl;
                    const date = new Date(historyData[index].timestamp);

                    // For 1D/1W/1M: show the CHANGE from period start to this point
                    // For ALL: show the cumulative PnL at this point
                    let displayValue;
                    if (timeframe === 'ALL') {
                        displayValue = currentValue;
                    } else {
                        // Calculate change from start of period to current hover point
                        const startValue = historyData[0].pnl;
                        displayValue = currentValue - startValue;
                    }

                    const isHoverPositive = displayValue >= 0;

                    if (pnlValueEl) {
                        pnlValueEl.textContent = formatPnLLarge(displayValue);
                    }
                    if (pnlPeriodEl) {
                        if (timeframe === '1D') {
                            pnlPeriodEl.textContent = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        } else {
                            pnlPeriodEl.textContent = date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
                        }
                    }
                    if (pnlDisplayEl) {
                        pnlDisplayEl.classList.remove('pnl-positive', 'pnl-negative');
                        pnlDisplayEl.classList.add(isHoverPositive ? 'pnl-positive' : 'pnl-negative');
                        const iconEl = pnlDisplayEl.querySelector('.pnl-icon');
                        if (iconEl) {
                            iconEl.textContent = isHoverPositive ? '▲' : '▼';
                        }
                    }
                }
            }
        }
    });

    // Reset PnL display when mouse leaves chart
    canvas.addEventListener('mouseleave', () => {
        const traderData = traderChartData.get(chartId);
        if (!traderData) return;

        const pnlValueEl = document.getElementById(`pnl-value-${chartId}`);
        const pnlPeriodEl = document.getElementById(`pnl-period-${chartId}`);
        const pnlDisplayEl = document.getElementById(`pnl-display-${chartId}`);
        const activeBtn = document.querySelector(`#timeframe-${chartId} .timeframe-btn.active`);
        const currentTimeframe = activeBtn ? activeBtn.dataset.timeframe : 'ALL';

        // Get the PnL for the current timeframe from real data
        const currentPnl = getPnLForTimeframe(traderData, currentTimeframe);
        const isPositive = currentPnl >= 0;

        if (pnlValueEl) {
            pnlValueEl.textContent = formatPnLLarge(currentPnl);
        }
        if (pnlPeriodEl) {
            const periodLabels = { '1D': '24 Hours', '1W': '7 Days', '1M': '30 Days', 'ALL': 'All-Time' };
            pnlPeriodEl.textContent = periodLabels[currentTimeframe] || 'All-Time';
        }
        if (pnlDisplayEl) {
            pnlDisplayEl.classList.remove('pnl-positive', 'pnl-negative');
            pnlDisplayEl.classList.add(isPositive ? 'pnl-positive' : 'pnl-negative');
            const iconEl = pnlDisplayEl.querySelector('.pnl-icon');
            if (iconEl) {
                iconEl.textContent = isPositive ? '▲' : '▼';
            }
        }
    });

    chartInstances.set(chartId, chart);
}

// Get PnL history data for chart - uses real data from Polymarket profile page
// Returns array of { timestamp, pnl } objects
function generateTimeframeData(trader, timeframe) {
    // Map timeframe to the pnlHistory key
    const historyKey = timeframe; // '1D', '1W', '1M', 'ALL'

    // Check if we have real PnL history data
    if (trader.pnlHistory && trader.pnlHistory[historyKey] && trader.pnlHistory[historyKey].length > 0) {
        // Return the real data from Polymarket
        return trader.pnlHistory[historyKey];
    }

    // Fallback to generated data if no real data available
    return generateFallbackTimeframeData(trader, timeframe);
}

// Fallback function to generate simulated data when real data is not available
function generateFallbackTimeframeData(trader, timeframe) {
    const now = Date.now();
    const hourMs = 60 * 60 * 1000;
    const dayMs = 24 * hourMs;

    // Get the real PnL for this timeframe from periodPnLs
    const periodMap = { '1D': 'DAY', '1W': 'WEEK', '1M': 'MONTH', 'ALL': 'ALL' };
    const periodKey = periodMap[timeframe] || 'ALL';
    const periodPnL = trader.periodPnLs?.[periodKey]?.pnl || 0;
    const allTimePnL = trader.totalPnl || trader.periodPnLs?.ALL?.pnl || 0;

    // For 1D, 1W, 1M: Show only the change within that period (start at 0)
    // For ALL: Show cumulative from 0 to total
    let startPnl, endPnl;
    if (timeframe === 'ALL') {
        startPnl = 0;
        endPnl = allTimePnL;
    } else {
        startPnl = 0;
        endPnl = periodPnL;
    }

    // Determine time range and data points
    // Use firstTradeDate for ALL timeframe if available
    let dataPoints, startTime;
    const firstTradeDate = trader.firstTradeDate;

    switch (timeframe) {
        case '1D':
            dataPoints = 96;
            startTime = now - dayMs;
            // If trader started less than 1 day ago, adjust start time
            if (firstTradeDate && firstTradeDate > startTime) {
                startTime = firstTradeDate;
                dataPoints = Math.max(24, Math.ceil((now - startTime) / (15 * 60 * 1000))); // 15-min intervals
            }
            break;
        case '1W':
            dataPoints = 168;
            startTime = now - 7 * dayMs;
            // If trader started less than 1 week ago, adjust start time
            if (firstTradeDate && firstTradeDate > startTime) {
                startTime = firstTradeDate;
                dataPoints = Math.max(24, Math.ceil((now - startTime) / hourMs)); // hourly intervals
            }
            break;
        case '1M':
            dataPoints = 120;
            startTime = now - 30 * dayMs;
            // If trader started less than 1 month ago, adjust start time
            if (firstTradeDate && firstTradeDate > startTime) {
                startTime = firstTradeDate;
                dataPoints = Math.max(30, Math.ceil((now - startTime) / (6 * hourMs))); // 6-hour intervals
            }
            break;
        case 'ALL':
        default:
            // For ALL timeframe, use the actual first trade date
            if (firstTradeDate && firstTradeDate > 0) {
                startTime = firstTradeDate;
                const tradingDays = Math.ceil((now - startTime) / dayMs);
                // Adjust data points based on actual trading duration
                dataPoints = Math.min(365, Math.max(30, tradingDays));
            } else {
                // Fallback to 180 days if no first trade date
                dataPoints = 180;
                startTime = now - 180 * dayMs;
            }
            break;
    }

    const intervalMs = (now - startTime) / (dataPoints - 1);
    const totalChange = endPnl - startPnl;

    // Create a unique seed based on trader wallet and timeframe
    const walletHash = (trader.wallet || 'default').split('').reduce((a, b) => {
        return ((a << 5) - a) + b.charCodeAt(0);
    }, 0);
    const seed = Math.abs(walletHash) + timeframe.charCodeAt(0) * 1000;

    // Seeded random function for consistent results per trader/timeframe
    const seededRandom = (s) => {
        const x = Math.sin(s) * 10000;
        return x - Math.floor(x);
    };

    // Generate a random walk that ends at the target value
    // This creates realistic ups and downs with significant peaks and valleys
    const history = [];

    // Higher volatility for more pronounced movements
    // Use at least a minimum volatility even for small changes
    const minVolatility = Math.abs(endPnl) * 0.15 || 10000;
    const volatility = Math.max(Math.abs(totalChange) * 0.8, minVolatility);

    // Generate random increments with trend reversals
    const increments = [];
    let sum = 0;
    let trendDirection = seededRandom(seed) > 0.5 ? 1 : -1;
    let trendStrength = 0;

    for (let i = 0; i < dataPoints - 1; i++) {
        // Random component
        const r1 = seededRandom(seed + i * 1.1) - 0.5;
        const r2 = seededRandom(seed + i * 2.3) - 0.5;
        const r3 = seededRandom(seed + i * 3.7) - 0.5;

        // Trend reversals - switch direction occasionally
        if (seededRandom(seed + i * 4.9) > 0.85) {
            trendDirection *= -1;
            trendStrength = seededRandom(seed + i * 6.1) * 0.3;
        }

        // Base random movement
        let increment = (r1 + r2 * 0.5 + r3 * 0.3) * volatility / Math.sqrt(dataPoints);

        // Add trend bias
        increment += trendDirection * trendStrength * volatility / dataPoints;

        // Add occasional larger moves (spikes/drops like real trading)
        const spikeChance = seededRandom(seed + i * 5.1);
        if (spikeChance > 0.92) {
            increment *= 3;
        } else if (spikeChance > 0.85) {
            increment *= 2;
        }

        // Occasional sharp reversals
        if (seededRandom(seed + i * 7.3) > 0.95) {
            increment *= -2;
        }

        increments.push(increment);
        sum += increment;
    }

    // Adjust increments so they sum to totalChange
    // This ensures we end exactly at the target PnL
    const adjustment = (totalChange - sum) / (dataPoints - 1);
    for (let i = 0; i < increments.length; i++) {
        increments[i] += adjustment;
    }

    // Build the path
    let currentPnl = startPnl;
    history.push({
        timestamp: startTime,
        pnl: startPnl
    });

    for (let i = 0; i < increments.length; i++) {
        currentPnl += increments[i];
        const timestamp = startTime + (i + 1) * intervalMs;

        history.push({
            timestamp: timestamp,
            pnl: currentPnl
        });
    }

    // Ensure exact end value
    if (history.length > 0) {
        history[history.length - 1].pnl = endPnl;
    }

    return history;
}

// Get PnL for a specific timeframe from trader data
// Returns the PnL CHANGE for the period (end - start), matching Polymarket's display
function getPnLForTimeframe(trader, timeframe) {
    // For pnlHistory, the values are cumulative PnL at each timestamp
    // The period change is: last value - first value
    if (trader.pnlHistory && trader.pnlHistory[timeframe] && trader.pnlHistory[timeframe].length > 0) {
        const history = trader.pnlHistory[timeframe];
        const startPnl = history[0].pnl;
        const endPnl = history[history.length - 1].pnl;

        // For ALL timeframe, return the final cumulative PnL (total profit)
        if (timeframe === 'ALL') {
            return endPnl;
        }

        // For 1D, 1W, 1M - return the CHANGE during that period
        return endPnl - startPnl;
    }

    // Fallback to periodPnLs
    const periodMap = { '1D': 'DAY', '1W': 'WEEK', '1M': 'MONTH', 'ALL': 'ALL' };
    const periodKey = periodMap[timeframe] || 'ALL';

    // For ALL, return total PnL
    if (timeframe === 'ALL') {
        return trader.totalPnl || trader.periodPnLs?.ALL?.pnl || 0;
    }

    // Return the period PnL (this is the change within that period)
    const periodPnl = trader.periodPnLs?.[periodKey]?.pnl;
    if (periodPnl !== undefined && periodPnl !== null) {
        return periodPnl;
    }

    // Fallback: return 0 if no period data available
    return 0;
}

// Global function to switch timeframe
function switchTimeframe(chartId, timeframe, btnElement) {
    // Update active button
    const container = btnElement.parentElement;
    container.querySelectorAll('.timeframe-btn').forEach(b => b.classList.remove('active'));
    btnElement.classList.add('active');

    // Get trader data and re-render chart
    const trader = traderChartData.get(chartId);
    if (trader) {
        renderPnLChart(trader, timeframe);

        // Update the PnL value display with the correct period PnL
        const periodPnl = getPnLForTimeframe(trader, timeframe);
        const pnlValueEl = document.getElementById(`pnl-value-${chartId}`);
        const pnlDisplayEl = document.getElementById(`pnl-display-${chartId}`);

        if (pnlValueEl) {
            pnlValueEl.textContent = formatPnLLarge(periodPnl);
        }

        // Update positive/negative styling
        if (pnlDisplayEl) {
            const isPositive = periodPnl >= 0;
            pnlDisplayEl.classList.remove('pnl-positive', 'pnl-negative');
            pnlDisplayEl.classList.add(isPositive ? 'pnl-positive' : 'pnl-negative');
            const iconEl = pnlDisplayEl.querySelector('.pnl-icon');
            if (iconEl) {
                iconEl.textContent = isPositive ? '▲' : '▼';
            }
        }

        // Update the period label
        const pnlPeriodEl = document.getElementById(`pnl-period-${chartId}`);
        if (pnlPeriodEl) {
            const periodLabels = { '1D': '24 Hours', '1W': '7 Days', '1M': '30 Days', 'ALL': 'All-Time' };
            pnlPeriodEl.textContent = periodLabels[timeframe] || 'All-Time';
        }
    }
}

// Expose to window
window.switchTimeframe = switchTimeframe;

// Event delegation for timeframe buttons (more reliable than inline onclick)
document.addEventListener('click', function(e) {
    const btn = e.target.closest('.timeframe-btn');
    if (btn) {
        e.preventDefault();
        e.stopPropagation();

        const chartId = btn.dataset.chart;
        const timeframe = btn.dataset.timeframe;

        if (chartId && timeframe) {
            switchTimeframe(chartId, timeframe, btn);
        }
    }
});

// Load PnL charts for all visible traders
async function loadAllPnLCharts() {
    for (const trader of tradersData) {
        await renderPnLChart(trader);
    }
}

// Current filters
let currentStrategyFilter = 'all';
let currentMarketFilter = 'all';

// Helper function to get trader's primary market category
function getTraderPrimaryMarket(trader) {
    const categories = trader.marketCategories || {};
    if (Object.keys(categories).length === 0) return 'other';

    // Find the category with highest value
    let maxValue = 0;
    let primaryMarket = 'other';

    for (const [cat, data] of Object.entries(categories)) {
        const value = data.value || data.count || 0;
        if (value > maxValue) {
            maxValue = value;
            primaryMarket = cat;
        }
    }

    return primaryMarket;
}

// Check if trader has exposure to a specific market
function traderHasMarketExposure(trader, market) {
    const categories = trader.marketCategories || {};
    return categories[market] && (categories[market].count > 0 || categories[market].value > 0);
}

// Render traders grid
function renderTradersGrid() {
    const searchTerm = elements.searchTraders.value.toLowerCase();
    const sortBy = elements.sortBy.value;
    const sortOrder = elements.sortOrder.value;

    let filtered = tradersData.filter(t =>
        t.name.toLowerCase().includes(searchTerm) ||
        t.wallet.toLowerCase().includes(searchTerm)
    );

    // Apply strategy filter
    if (currentStrategyFilter !== 'all') {
        filtered = filtered.filter(t => {
            const strategyInfo = window.classifyTraderStrategy ? window.classifyTraderStrategy(t) : { primary: 'timing' };
            return strategyInfo.primary === currentStrategyFilter || strategyInfo.secondary === currentStrategyFilter;
        });
    }

    // Apply market filter
    if (currentMarketFilter !== 'all') {
        filtered = filtered.filter(t => traderHasMarketExposure(t, currentMarketFilter));
    }

    // Sort
    filtered.sort((a, b) => {
        let valA, valB;
        switch (sortBy) {
            case 'pnl':
                valA = parseFloat(a.totalPnl) || 0;
                valB = parseFloat(b.totalPnl) || 0;
                break;
            case 'portfolio':
                valA = parseFloat(a.currentValue) || 0;
                valB = parseFloat(b.currentValue) || 0;
                break;
            case 'volume':
                valA = parseFloat(a.totalVolume) || 0;
                valB = parseFloat(b.totalVolume) || 0;
                break;
            case 'name':
                return sortOrder === 'asc'
                    ? a.name.localeCompare(b.name)
                    : b.name.localeCompare(a.name);
            case 'strategy':
                const stratA = window.classifyTraderStrategy ? window.classifyTraderStrategy(a).primary : 'timing';
                const stratB = window.classifyTraderStrategy ? window.classifyTraderStrategy(b).primary : 'timing';
                return sortOrder === 'asc'
                    ? stratA.localeCompare(stratB)
                    : stratB.localeCompare(stratA);
            default:
                valA = 0;
                valB = 0;
        }
        return sortOrder === 'asc' ? valA - valB : valB - valA;
    });

    elements.tradersGrid.innerHTML = filtered.map(renderTraderCard).join('');

    // Load charts and attach timeframe listeners after DOM is updated
    setTimeout(() => {
        filtered.forEach(trader => {
            try {
                renderPnLChart(trader);
            } catch (err) {
                console.error(`Error rendering chart for ${trader.name}:`, err);
            }
        });

    }, 100);
}

// Strategy filter event handler
document.addEventListener('click', function(e) {
    const strategyBtn = e.target.closest('.strategy-filter-btn');
    if (strategyBtn) {
        // Update active state
        document.querySelectorAll('.strategy-filter-btn').forEach(btn => btn.classList.remove('active'));
        strategyBtn.classList.add('active');

        // Update filter and re-render
        currentStrategyFilter = strategyBtn.dataset.strategy;
        renderTradersGrid();
    }

    // Market filter event handler
    const marketBtn = e.target.closest('.market-filter-btn');
    if (marketBtn) {
        // Update active state
        document.querySelectorAll('.market-filter-btn').forEach(btn => btn.classList.remove('active'));
        marketBtn.classList.add('active');

        // Update filter and re-render
        currentMarketFilter = marketBtn.dataset.market;
        renderTradersGrid();
    }
});

// Update overview stats
function updateOverviewStats() {
    const totalValue = tradersData.reduce((sum, t) => sum + (parseFloat(t.currentValue) || 0), 0);
    const totalVolume = tradersData.reduce((sum, t) => sum + (parseFloat(t.totalVolume) || 0), 0);

    // Use watchlist.length as the source of truth for total traders count
    // since tradersData might be loading
    elements.totalTraders.textContent = watchlist.length;

    // Update total volume
    if (elements.totalVolume) {
        elements.totalVolume.textContent = formatCurrency(totalVolume);
    }

    // Update filter button counts
    updateFilterCounts();
}

// Update strategy and market filter button counts
function updateFilterCounts() {
    const strategyCounts = {};
    const marketCounts = {};

    // Count traders by strategy and market
    tradersData.forEach(trader => {
        // Strategy counts
        const strategyInfo = window.classifyTraderStrategy ? window.classifyTraderStrategy(trader) : { primary: 'timing' };
        if (!strategyCounts[strategyInfo.primary]) {
            strategyCounts[strategyInfo.primary] = 0;
        }
        strategyCounts[strategyInfo.primary]++;

        // Market counts - count each market the trader has exposure to
        const categories = trader.marketCategories || {};
        for (const cat of Object.keys(categories)) {
            if (categories[cat].count > 0 || categories[cat].value > 0) {
                if (!marketCounts[cat]) {
                    marketCounts[cat] = 0;
                }
                marketCounts[cat]++;
            }
        }
    });

    // Update strategy button labels with counts (no emojis)
    document.querySelectorAll('.strategy-filter-btn').forEach(btn => {
        const strategy = btn.dataset.strategy;
        if (strategy === 'all') {
            btn.textContent = `All (${tradersData.length})`;
        } else if (strategyCounts[strategy]) {
            const strategyDef = TRADING_STRATEGIES[strategy];
            btn.textContent = `${strategyDef?.name || strategy} (${strategyCounts[strategy]})`;
        } else {
            const strategyDef = TRADING_STRATEGIES[strategy];
            btn.textContent = `${strategyDef?.name || strategy} (0)`;
        }
    });

    // Update market button labels with counts
    document.querySelectorAll('.market-filter-btn').forEach(btn => {
        const market = btn.dataset.market;
        if (market === 'all') {
            btn.textContent = `All (${tradersData.length})`;
        } else {
            const count = marketCounts[market] || 0;
            const marketDef = MARKET_CATEGORIES[market];
            btn.textContent = `${marketDef?.name || market} (${count})`;
        }
    });
}

// Populate trader selects
function populateTraderSelects() {
    const options = tradersData
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(t => `<option value="${t.id}">${t.name}</option>`)
        .join('');

    elements.positionsTraderSelect.innerHTML = '<option value="">Select a trader...</option>' + options;
}

// Render positions for a trader
async function renderPositions(traderId) {
    const trader = tradersData.find(t => t.id === traderId);
    if (!trader) {
        elements.positionsList.innerHTML = '<p class="placeholder">Select a trader to view their positions</p>';
        return;
    }

    if (!trader.positions || trader.positions.length === 0) {
        elements.positionsList.innerHTML = '<p class="placeholder">No positions found for this trader</p>';
        return;
    }

    const activeFilter = document.querySelector('.position-filters .filter-btn.active')?.dataset.filter || 'all';

    let positions = trader.positions;
    if (activeFilter === 'active') {
        positions = positions.filter(p => !p.redeemable);
    } else if (activeFilter === 'resolved') {
        positions = positions.filter(p => p.redeemable);
    }

    elements.positionsList.innerHTML = positions.map(p => `
        <div class="position-item">
            <div class="position-market">
                <div class="position-market-title">${p.title || 'Unknown Market'}</div>
                <div class="position-market-outcome ${p.outcome === 'Yes' ? 'position-outcome-yes' : 'position-outcome-no'}">
                    ${p.outcome || 'N/A'}
                </div>
            </div>
            <div class="position-col">
                <span class="position-col-label">Size</span>
                <span class="position-col-value">${formatNumber(p.size)}</span>
            </div>
            <div class="position-col">
                <span class="position-col-label">Avg Price</span>
                <span class="position-col-value">${(parseFloat(p.avgPrice) * 100).toFixed(1)}¢</span>
            </div>
            <div class="position-col">
                <span class="position-col-label">Current Value</span>
                <span class="position-col-value">${formatCurrency(p.currentValue)}</span>
            </div>
            <div class="position-col">
                <span class="position-col-label">PnL</span>
                <span class="position-col-value ${getPnLClass(p.cashPnl)}">${formatCurrency(p.cashPnl)}</span>
            </div>
        </div>
    `).join('');
}

// Render market categories
function renderMarketCategories() {
    // Aggregate categories across all traders
    const categoryTotals = {};
    const categoryTraders = {};

    for (const trader of tradersData) {
        for (const [cat, data] of Object.entries(trader.marketCategories || {})) {
            if (!categoryTotals[cat]) {
                categoryTotals[cat] = { count: 0, value: 0 };
                categoryTraders[cat] = [];
            }
            categoryTotals[cat].count += data.count;
            categoryTotals[cat].value += data.value;
            if (data.count > 0) {
                categoryTraders[cat].push({ id: trader.id, name: trader.name, count: data.count });
            }
        }
    }

    // Render category cards
    const sortedCategories = Object.entries(categoryTotals)
        .sort((a, b) => b[1].value - a[1].value);

    elements.marketCategories.innerHTML = sortedCategories.map(([cat, data]) => {
        const catInfo = MARKET_CATEGORIES[cat] || { name: cat, color: 'other' };
        const traders = categoryTraders[cat]
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        return `
            <div class="market-category-card">
                <div class="market-category-header">
                    <span class="market-category-name">${catInfo.name}</span>
                    <span class="market-category-count">${data.count} positions</span>
                </div>
                <div>Value: ${formatCurrency(data.value)}</div>
                <div class="market-category-traders" style="margin-top: 10px;">
                    ${traders.map(t => `
                        <span class="category-trader-chip clickable" title="${t.name}" onclick="showTraderModal('${t.id}')">${truncateTraderName(t.name)} (${t.count})</span>
                    `).join('')}
                </div>
            </div>
        `;
    }).join('');

    // Render trader breakdown
    elements.breakdownList.innerHTML = tradersData
        .filter(t => Object.keys(t.marketCategories || {}).length > 0)
        .sort((a, b) => (parseFloat(b.currentValue) || 0) - (parseFloat(a.currentValue) || 0))
        .slice(0, 10)
        .map(trader => {
            const topCats = Object.entries(trader.marketCategories || {})
                .sort((a, b) => b[1].count - a[1].count)
                .slice(0, 4);

            return `
                <div class="breakdown-item">
                    <span class="breakdown-trader" title="${trader.name}">${truncateTraderName(trader.name)}</span>
                    <div class="breakdown-markets">
                        ${topCats.map(([cat, data]) => `
                            <span class="market-tag ${cat}">${MARKET_CATEGORIES[cat]?.name || cat} (${data.count})</span>
                        `).join('')}
                    </div>
                </div>
            `;
        }).join('');
}

// Show trader modal
window.showTraderModal = function(traderId) {
    const trader = tradersData.find(t => t.id === traderId);
    if (!trader) return;

    const topPositions = (trader.positions || [])
        .sort((a, b) => (parseFloat(b.currentValue) || 0) - (parseFloat(a.currentValue) || 0))
        .slice(0, 10);

    // Ensure profileUrl is always available (fallback to wallet-based URL)
    const profileUrl = trader.profileUrl || `https://polymarket.com/profile/${trader.wallet}`;

    elements.modalBody.innerHTML = `
        <div class="modal-header">
            <div class="modal-trader-info">
                <h2 title="${trader.name}">${truncateTraderName(trader.name)}</h2>
                <div class="modal-wallet">${trader.wallet}</div>
            </div>
            <div class="modal-header-buttons">
                <button style="background: #3b82f6; color: white; padding: 10px 20px; border: none; border-radius: 8px; font-size: 0.9rem; font-weight: 500; cursor: pointer; min-width: 160px;" onclick="window.open('${profileUrl}', '_blank')">View on Polymarket</button>
            </div>
        </div>

        <div class="modal-stats">
            <div class="modal-stat">
                <div class="modal-stat-label">Portfolio Value</div>
                <div class="modal-stat-value">${formatCurrency(trader.currentValue)}</div>
            </div>
            <div class="modal-stat">
                <div class="modal-stat-label">Total PnL</div>
                <div class="modal-stat-value ${getPnLClass(trader.totalPnl)}">${formatCurrency(trader.totalPnl)}</div>
            </div>
            <div class="modal-stat">
                <div class="modal-stat-label">Total Volume</div>
                <div class="modal-stat-value">${formatCurrency(trader.totalVolume)}</div>
            </div>
            <div class="modal-stat">
                <div class="modal-stat-label">Positions</div>
                <div class="modal-stat-value">${trader.positionCount || 0}</div>
            </div>
            <div class="modal-stat">
                <div class="modal-stat-label">Rank</div>
                <div class="modal-stat-value">${trader.leaderboardRank ? '#' + trader.leaderboardRank : 'N/A'}</div>
            </div>
        </div>

        <div class="modal-section">
            <h3>Top Positions by Value</h3>
            <div class="modal-positions-list">
                ${topPositions.length > 0 ? topPositions.map(p => `
                    <div class="modal-position">
                        <span class="modal-position-title">${p.title || 'Unknown'}</span>
                        <span class="modal-position-outcome ${p.outcome === 'Yes' ? 'position-outcome-yes' : 'position-outcome-no'}">${p.outcome}</span>
                        <span class="modal-position-value">${formatCurrency(p.currentValue)}</span>
                    </div>
                `).join('') : '<p class="placeholder">No positions</p>'}
            </div>
        </div>

        <div class="modal-section">
            <h3>Market Focus</h3>
            <div class="market-tags">
                ${Object.entries(trader.marketCategories || {})
                    .sort((a, b) => b[1].count - a[1].count)
                    .map(([cat, data]) => `
                        <span class="market-tag ${cat}">${MARKET_CATEGORIES[cat]?.name || cat}: ${data.count} positions (${formatCurrency(data.value)})</span>
                    `).join('') || '<span class="placeholder">No market data</span>'}
            </div>
        </div>

        <div class="modal-footer">
            <button class="btn-remove-trader" onclick="removeTraderFromDashboard('${trader.wallet}')">Remove from Watchlist</button>
        </div>
    `;

    elements.modal.classList.add('active');
};

// Close modal
function closeModal() {
    elements.modal.classList.remove('active');
}

// Remove trader from dashboard (from modal)
window.removeTraderFromDashboard = function(walletAddress) {
    const traderIndex = watchlist.findIndex(t => t.wallet.toLowerCase() === walletAddress.toLowerCase());

    if (traderIndex !== -1) {
        const traderName = watchlist[traderIndex].name;
        watchlist.splice(traderIndex, 1);
        localStorage.setItem('polymarket_watchlist', JSON.stringify(watchlist));

        // Also remove from tradersData
        const dataIndex = tradersData.findIndex(t => t.wallet.toLowerCase() === walletAddress.toLowerCase());
        if (dataIndex !== -1) {
            tradersData.splice(dataIndex, 1);
        }

        // Close modal and refresh views
        closeModal();
        renderTradersGrid();
        updateOverviewStats();
        populateTraderSelects();
        renderMarketCategories();
        updateWatchlistDisplay();

        console.log(`Removed trader: ${traderName}`);
    }
};

// Load all data
// quickRefresh: faster refresh mode that skips activity data
async function loadData(quickRefresh = false) {
    if (isLoading) return;
    isLoading = true;

    // Show loading indicator (less intrusive on quick refresh)
    if (quickRefresh) {
        // Keep existing data visible, just show small indicator
        elements.lastUpdate.textContent = 'Refreshing...';
    } else {
        elements.tradersGrid.innerHTML = `
            <div class="loading" style="grid-column: 1/-1; padding: 60px;">
                <div class="spinner"></div>
                <p style="margin-top: 20px; color: var(--text-secondary);">Loading trader data...</p>
            </div>
        `;
    }

    try {
        // Use watchlist (which defaults to TRADERS if nothing saved)
        const tradersToLoad = watchlist.length > 0 ? watchlist : TRADERS;

        tradersData = await PolymarketAPI.fetchAllTradersData(tradersToLoad, (completed, total, name) => {
            if (quickRefresh) {
                elements.lastUpdate.textContent = `Refreshing... ${completed}/${total}`;
            } else {
                const pct = Math.round((completed / total) * 100);
                elements.tradersGrid.innerHTML = `
                    <div class="loading" style="grid-column: 1/-1; padding: 60px; text-align: center;">
                        <div class="spinner"></div>
                        <p style="margin-top: 20px; color: var(--text-secondary);">
                            Loading: ${name}<br>
                            ${completed}/${total} traders (${pct}%)
                        </p>
                    </div>
                `;
            }
        }, { quickRefresh, existingData: tradersData });

        // Update all views
        renderTradersGrid();
        updateOverviewStats();
        populateTraderSelects();
        renderMarketCategories();

        // Update timestamp
        elements.lastUpdate.textContent = `Last update: ${new Date().toLocaleTimeString()}`;

    } catch (error) {
        console.error('Error loading data:', error);
        elements.tradersGrid.innerHTML = `
            <div class="error-message" style="grid-column: 1/-1;">
                Error loading data: ${error.message}.
                <button onclick="loadData()" class="btn-primary" style="margin-left: 10px;">Retry</button>
            </div>
        `;
    } finally {
        isLoading = false;
    }
}

// Setup auto-refresh
function setupAutoRefresh() {
    const interval = parseInt(elements.refreshIntervalSelect.value);

    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
    }

    if (interval > 0) {
        refreshInterval = setInterval(() => {
            PolymarketAPI.clearCache();
            loadData(true); // Use quick refresh for auto-refresh
        }, interval);
    }
}

// Event listeners
function initEventListeners() {
    // Refresh button
    elements.refreshBtn.addEventListener('click', () => {
        PolymarketAPI.clearCache();
        loadData();
    });

    // Auto-refresh interval change
    elements.refreshIntervalSelect.addEventListener('change', setupAutoRefresh);

    // Search and sort
    elements.searchTraders.addEventListener('input', renderTradersGrid);
    elements.sortBy.addEventListener('change', renderTradersGrid);
    elements.sortOrder.addEventListener('change', renderTradersGrid);

    // Clear search button
    const clearSearchBtn = document.getElementById('clear-search-btn');
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', () => {
            elements.searchTraders.value = '';
            elements.searchTraders.focus();
            renderTradersGrid();
        });
    }

    // Positions tab
    elements.positionsTraderSelect.addEventListener('change', (e) => {
        renderPositions(e.target.value);
    });

    document.querySelectorAll('.position-filters .filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.position-filters .filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderPositions(elements.positionsTraderSelect.value);
        });
    });

    // Modal
    document.querySelector('.close-modal').addEventListener('click', closeModal);
    elements.modal.addEventListener('click', (e) => {
        if (e.target === elements.modal) closeModal();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
        if (e.key === 'r' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            PolymarketAPI.clearCache();
            loadData();
        }
    });

    // Discover tab event listeners
    initDiscoverListeners();
}

// =====================
// DISCOVER TAB FUNCTIONS
// =====================

// Leaderboard state
let leaderboardState = {
    timePeriod: 'MONTH',
    category: 'OVERALL',
    orderBy: 'PNL',
    page: 1,
    pageSize: 25,
    data: [],
    loading: false
};

function initDiscoverListeners() {
    const addAllBtn = document.getElementById('add-all-btn');
    const replaceAllBtn = document.getElementById('replace-all-btn');
    const traderSearchBtn = document.getElementById('trader-search-btn');
    const traderSearchInput = document.getElementById('trader-search-input');

    if (addAllBtn) {
        addAllBtn.addEventListener('click', addAllToWatchlist);
    }
    if (replaceAllBtn) {
        replaceAllBtn.addEventListener('click', replaceWatchlist);
    }

    // Export watchlist button
    const exportWatchlistBtn = document.getElementById('export-watchlist-btn');
    if (exportWatchlistBtn) {
        exportWatchlistBtn.addEventListener('click', exportWatchlist);
    }

    // Search traders functionality
    if (traderSearchBtn) {
        traderSearchBtn.addEventListener('click', searchTraders);
    }
    if (traderSearchInput) {
        traderSearchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                searchTraders();
            }
        });
    }

    // Clear trader search button
    const clearTraderSearchBtn = document.getElementById('clear-trader-search-btn');
    if (clearTraderSearchBtn && traderSearchInput) {
        clearTraderSearchBtn.addEventListener('click', () => {
            traderSearchInput.value = '';
            traderSearchInput.focus();
            // Reset search results to placeholder
            const searchResultsDiv = document.getElementById('search-results');
            if (searchResultsDiv) {
                searchResultsDiv.innerHTML = '<p class="placeholder">Enter a username or wallet address to search</p>';
            }
        });
    }

    // Leaderboard time period tabs
    document.querySelectorAll('.leaderboard-time-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.leaderboard-time-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            leaderboardState.timePeriod = btn.dataset.period;
            leaderboardState.page = 1;
            loadLeaderboard();
        });
    });

    // Leaderboard category pills
    document.querySelectorAll('.leaderboard-category-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.leaderboard-category-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            leaderboardState.category = btn.dataset.category;
            leaderboardState.page = 1;
            loadLeaderboard();
        });
    });

    // Leaderboard sort toggle
    document.querySelectorAll('.leaderboard-sort-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.leaderboard-sort-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            leaderboardState.orderBy = btn.dataset.sort;
            leaderboardState.page = 1;
            loadLeaderboard();
        });
    });

    // Pagination
    const prevBtn = document.getElementById('lb-prev-btn');
    const nextBtn = document.getElementById('lb-next-btn');

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (leaderboardState.page > 1) {
                leaderboardState.page--;
                renderLeaderboardTable();
                updatePaginationUI();
            }
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            const maxPages = Math.ceil(leaderboardState.data.length / leaderboardState.pageSize);
            if (leaderboardState.page < maxPages) {
                leaderboardState.page++;
                renderLeaderboardTable();
                updatePaginationUI();
            }
        });
    }

    // Load initial leaderboard when Discover tab is shown
    loadLeaderboard();
}

async function loadLeaderboard() {
    if (leaderboardState.loading) return;
    leaderboardState.loading = true;

    const tableBody = document.getElementById('leaderboard-table-body');
    const addAllBtn = document.getElementById('add-all-btn');
    const replaceAllBtn = document.getElementById('replace-all-btn');

    tableBody.innerHTML = `
        <div class="leaderboard-loading">
            <div class="spinner"></div>
            <span>Loading leaderboard...</span>
        </div>
    `;

    try {
        const leaderboard = await PolymarketAPI.getLeaderboard({
            timePeriod: leaderboardState.timePeriod,
            category: leaderboardState.category,
            orderBy: leaderboardState.orderBy,
            limit: 100 // Fetch more for pagination
        });

        leaderboardState.data = leaderboard || [];
        discoveredTraders = leaderboardState.data; // Keep for add all functionality

        if (leaderboardState.data.length === 0) {
            tableBody.innerHTML = '<p class="placeholder">No traders found for this category and time period.</p>';
            addAllBtn.disabled = true;
            replaceAllBtn.disabled = true;
        } else {
            renderLeaderboardTable();
            updatePaginationUI();
            addAllBtn.disabled = false;
            replaceAllBtn.disabled = false;
        }

    } catch (error) {
        console.error('Error loading leaderboard:', error);
        tableBody.innerHTML = `<p class="placeholder" style="color: var(--danger);">Error loading leaderboard: ${error.message}</p>`;
    } finally {
        leaderboardState.loading = false;
    }
}

function renderLeaderboardTable() {
    const tableBody = document.getElementById('leaderboard-table-body');
    const { data, page, pageSize } = leaderboardState;

    const startIndex = (page - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, data.length);
    const pageData = data.slice(startIndex, endIndex);

    if (pageData.length === 0) {
        tableBody.innerHTML = '<p class="placeholder">No traders to display.</p>';
        return;
    }

    tableBody.innerHTML = pageData.map(trader => {
        const wallet = trader.proxyWallet || trader.user;
        const isInWatchlist = watchlist.some(w =>
            w.wallet.toLowerCase() === wallet.toLowerCase()
        );
        const pnl = parseFloat(trader.pnl) || 0;
        const volume = parseFloat(trader.vol) || 0;
        const rank = trader.rank || 0;

        // Rank styling
        let rankClass = 'lb-rank';
        if (rank === 1) rankClass += ' lb-rank-1';
        else if (rank === 2) rankClass += ' lb-rank-2';
        else if (rank === 3) rankClass += ' lb-rank-3';
        else if (rank <= 10) rankClass += ' top-3';

        return `
            <div class="leaderboard-row ${isInWatchlist ? 'in-watchlist' : ''}" data-wallet="${wallet}">
                <div class="lb-col-rank">
                    <span class="${rankClass}">${rank}</span>
                </div>
                <div class="lb-col-trader">
                    <span class="lb-trader-name" onclick="window.open('https://polymarket.com/profile/${wallet}', '_blank')" title="${trader.userName || wallet}">
                        ${truncateTraderName(trader.userName || 'Anonymous')}
                    </span>
                    <span class="lb-trader-wallet">${truncateAddress(wallet)}</span>
                </div>
                <div class="lb-col-pnl ${pnl >= 0 ? 'lb-pnl-positive' : 'lb-pnl-negative'}">
                    ${pnl >= 0 ? '+' : ''}${formatCurrency(pnl)}
                </div>
                <div class="lb-col-volume">${formatCurrency(volume)}</div>
                <div class="lb-col-actions">
                    ${isInWatchlist
                        ? `<button class="lb-remove-btn" onclick="removeFromWatchlistAndRefreshLeaderboard('${wallet}')">Remove</button>`
                        : `<button class="lb-add-btn" onclick="addToWatchlistFromLeaderboard('${wallet}', '${(trader.userName || '').replace(/'/g, "\\'")}')">Add</button>`
                    }
                </div>
            </div>
        `;
    }).join('');
}

function updatePaginationUI() {
    const prevBtn = document.getElementById('lb-prev-btn');
    const nextBtn = document.getElementById('lb-next-btn');
    const pageInfo = document.getElementById('lb-page-info');

    const { data, page, pageSize } = leaderboardState;
    const maxPages = Math.ceil(data.length / pageSize);

    if (prevBtn) prevBtn.disabled = page <= 1;
    if (nextBtn) nextBtn.disabled = page >= maxPages;
    if (pageInfo) {
        const startItem = (page - 1) * pageSize + 1;
        const endItem = Math.min(page * pageSize, data.length);
        pageInfo.textContent = `${startItem}-${endItem} of ${data.length}`;
    }
}

window.addToWatchlistFromLeaderboard = async function(wallet, userName) {
    await addToWatchlist(wallet, userName);
    renderLeaderboardTable(); // Refresh to update button states
};

window.removeFromWatchlistAndRefreshLeaderboard = function(wallet) {
    removeFromWatchlist(wallet);
    renderLeaderboardTable(); // Refresh to update button states
};

window.addToWatchlist = async function(wallet, userName) {
    // Check if already in watchlist
    if (watchlist.some(w => w.wallet.toLowerCase() === wallet.toLowerCase())) {
        return;
    }

    const newTrader = {
        id: wallet,
        name: userName || truncateAddress(wallet),
        displayName: userName || 'Unknown',
        wallet: wallet,
        profileUrl: `https://polymarket.com/profile/${wallet}`,
        joinDate: 'Unknown'
    };

    watchlist.push(newTrader);
    saveWatchlist();
    updateWatchlistDisplay();

    // Update total traders count immediately
    elements.totalTraders.textContent = watchlist.length;

    // Immediately fetch data for the new trader and add to tradersData
    // Use full refresh (not quick) to get PnL history for accurate charts
    try {
        const summary = await PolymarketAPI.getTraderSummary(wallet, false); // Full refresh to get pnlHistory
        const traderWithData = {
            ...newTrader,
            ...summary,
            lastUpdated: new Date()
        };
        tradersData.push(traderWithData);

        // Update all views immediately
        renderTradersGrid();
        updateOverviewStats();
        populateTraderSelects();
        renderMarketCategories();
    } catch (error) {
        console.error(`Error fetching data for new trader ${userName || wallet}:`, error);
        // Still add to tradersData with minimal info so it shows up
        tradersData.push({
            ...newTrader,
            positions: [],
            positionCount: 0,
            totalPnl: 0,
            totalVolume: 0,
            currentValue: 0,
            marketCategories: {},
            lastUpdated: new Date()
        });
        renderTradersGrid();
        updateOverviewStats();
    }
};

window.removeFromWatchlist = function(wallet) {
    watchlist = watchlist.filter(w => w.wallet.toLowerCase() !== wallet.toLowerCase());
    saveWatchlist();

    // Also remove from tradersData to keep in sync
    const dataIndex = tradersData.findIndex(t => t.wallet.toLowerCase() === wallet.toLowerCase());
    if (dataIndex !== -1) {
        tradersData.splice(dataIndex, 1);
    }

    // Update all views immediately
    updateWatchlistDisplay();
    renderTradersGrid();
    updateOverviewStats();
    populateTraderSelects();
    renderMarketCategories();

    // Re-render leaderboard to update button states
    if (discoveredTraders.length > 0) {
        renderLeaderboardTable();
    }
};

async function addAllToWatchlist() {
    const newTraders = [];
    for (const trader of discoveredTraders) {
        const wallet = trader.proxyWallet || trader.user;
        if (!watchlist.some(w => w.wallet.toLowerCase() === wallet.toLowerCase())) {
            const newTrader = {
                id: wallet,
                name: trader.userName || truncateAddress(wallet),
                displayName: trader.userName || 'Unknown',
                wallet: wallet,
                profileUrl: `https://polymarket.com/profile/${wallet}`,
                joinDate: 'Unknown'
            };
            watchlist.push(newTrader);
            newTraders.push(newTrader);
        }
    }
    saveWatchlist();
    updateWatchlistDisplay();
    updateOverviewStats(); // Update stats immediately
    renderLeaderboardTable();

    // Fetch data for all new traders in background
    if (newTraders.length > 0) {
        loadData(true); // Quick refresh to load new trader data
    }
}

function replaceWatchlist() {
    if (!confirm('This will replace your entire watchlist with the discovered traders. Continue?')) {
        return;
    }

    watchlist = discoveredTraders.map(trader => {
        const wallet = trader.proxyWallet || trader.user;
        return {
            id: wallet,
            name: trader.userName || truncateAddress(wallet),
            displayName: trader.userName || 'Unknown',
            wallet: wallet,
            profileUrl: `https://polymarket.com/profile/${wallet}`,
            joinDate: 'Unknown'
        };
    });

    saveWatchlist();
    updateWatchlistDisplay();
    updateOverviewStats(); // Update stats immediately
    renderLeaderboardTable();

    // Reload main dashboard with new watchlist
    loadData();
}

// Search traders functionality
let searchResults = [];

async function searchTraders() {
    const searchInput = document.getElementById('trader-search-input');
    const searchResultsDiv = document.getElementById('search-results');
    const query = searchInput.value.trim();

    if (!query || query.length < 2) {
        searchResultsDiv.innerHTML = '<p class="placeholder">Please enter at least 2 characters to search</p>';
        return;
    }

    searchResultsDiv.innerHTML = '<p class="placeholder">Searching...</p>';

    try {
        searchResults = await PolymarketAPI.searchTraders(query);

        if (searchResults.length === 0) {
            searchResultsDiv.innerHTML = '<p class="placeholder">No traders found matching your search</p>';
            return;
        }

        renderSearchResults();
    } catch (error) {
        console.error('Search error:', error);
        searchResultsDiv.innerHTML = '<p class="placeholder">Error searching traders. Please try again.</p>';
    }
}

function renderSearchResults() {
    const searchResultsDiv = document.getElementById('search-results');

    if (searchResults.length === 0) {
        searchResultsDiv.innerHTML = '<p class="placeholder">No results found</p>';
        return;
    }

    searchResultsDiv.innerHTML = searchResults.map(trader => {
        const inWatchlist = watchlist.some(w => w.wallet.toLowerCase() === trader.user.toLowerCase());
        const pnlClass = parseFloat(trader.pnl) >= 0 ? 'pnl-positive' : 'pnl-negative';
        const isNotOnLeaderboard = trader.notOnLeaderboard;

        return `
            <div class="search-result-item ${isNotOnLeaderboard ? 'not-on-leaderboard' : ''}">
                <div class="search-result-info">
                    <div class="search-result-name">
                        ${trader.userName || 'Unknown'}
                        ${isNotOnLeaderboard ? '<span class="search-result-badge">Not on Leaderboard</span>' : ''}
                    </div>
                    <div class="search-result-wallet">${trader.user}</div>
                </div>
                <div class="search-result-stats">
                    ${isNotOnLeaderboard ? `
                    <div class="search-result-stat">
                        <div class="search-result-stat-label">Positions</div>
                        <div class="search-result-stat-value">${trader.positionCount || 0}</div>
                    </div>
                    ` : ''}
                    <div class="search-result-stat">
                        <div class="search-result-stat-label">${isNotOnLeaderboard ? 'Position PnL' : 'PnL'}</div>
                        <div class="search-result-stat-value ${pnlClass}">${formatCurrency(trader.pnl)}</div>
                    </div>
                    ${!isNotOnLeaderboard ? `
                    <div class="search-result-stat">
                        <div class="search-result-stat-label">Volume</div>
                        <div class="search-result-stat-value">${formatCurrency(trader.vol)}</div>
                    </div>
                    ` : ''}
                    ${trader.rank ? `
                    <div class="search-result-stat">
                        <div class="search-result-stat-label">Rank</div>
                        <div class="search-result-stat-value">#${trader.rank}</div>
                    </div>
                    ` : ''}
                </div>
                <div class="search-result-actions">
                    ${inWatchlist
                        ? `<button class="btn-remove" onclick="removeFromWatchlistAndRefreshSearch('${trader.user}')">Remove</button>`
                        : `<button class="btn-add" onclick="addFromSearchResult('${trader.user}', '${(trader.userName || '').replace(/'/g, "\\'")}')">Add</button>`
                    }
                </div>
            </div>
        `;
    }).join('');
}

window.addFromSearchResult = async function(wallet, userName) {
    await addToWatchlist(wallet, userName);
    renderSearchResults(); // Refresh search results to update button states
};

window.removeFromWatchlistAndRefreshSearch = function(wallet) {
    removeFromWatchlist(wallet);
    renderSearchResults(); // Refresh search results to update button states
};

// =====================
// TOP WINS TAB FUNCTIONS
// =====================

let topWinsState = {
    timePeriod: 'MONTH',
    data: [],
    loading: false
};

function initTopWinsListeners() {
    // Time period toggle buttons
    document.querySelectorAll('.top-wins-time-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.top-wins-time-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            topWinsState.timePeriod = btn.dataset.period;
            loadTopWins();
        });
    });
}

async function loadTopWins() {
    if (topWinsState.loading) return;
    topWinsState.loading = true;

    const listBody = document.getElementById('top-wins-list-body');

    // Show loading state
    listBody.innerHTML = `
        <div class="top-wins-loading">
            <div class="spinner"></div>
            <span>Loading top winners...</span>
        </div>
    `;

    try {
        const leaderboard = await PolymarketAPI.getLeaderboard({
            timePeriod: topWinsState.timePeriod,
            category: 'OVERALL',
            orderBy: 'PNL',
            limit: 25
        });

        topWinsState.data = leaderboard || [];

        if (topWinsState.data.length === 0) {
            listBody.innerHTML = '<p class="placeholder">No winners found for this time period.</p>';
        } else {
            renderTopWins();
        }

    } catch (error) {
        console.error('Error loading top wins:', error);
        listBody.innerHTML = `<p class="placeholder" style="color: var(--danger);">Error loading data: ${error.message}</p>`;
    } finally {
        topWinsState.loading = false;
    }
}

function renderTopWins() {
    const { data } = topWinsState;
    const listBody = document.getElementById('top-wins-list-body');

    if (data.length === 0) {
        listBody.innerHTML = '<p class="placeholder">No traders to display.</p>';
        return;
    }

    listBody.innerHTML = data.map((trader, index) => {
        const rank = index + 1;
        const wallet = trader.proxyWallet || trader.user;
        const pnl = parseFloat(trader.pnl) || 0;
        const volume = parseFloat(trader.vol) || 0;
        const userName = trader.userName || 'Anonymous';
        const initial = userName.charAt(0).toUpperCase();

        const isInWatchlist = watchlist.some(w =>
            w.wallet.toLowerCase() === wallet.toLowerCase()
        );

        const avatarContent = trader.profileImage
            ? `<img src="${trader.profileImage}" alt="${userName}" onerror="this.parentElement.textContent='${initial}'">`
            : initial;

        return `
            <div class="top-wins-row" data-wallet="${wallet}">
                <div class="tw-col-rank">#${rank}</div>
                <div class="tw-col-trader">
                    <div class="tw-trader-avatar">${avatarContent}</div>
                    <div class="tw-trader-info">
                        <span class="tw-trader-name" onclick="window.open('https://polymarket.com/profile/${wallet}', '_blank')" title="${userName}">
                            ${truncateTraderName(userName)}
                        </span>
                        <span class="tw-trader-wallet">${truncateAddress(wallet)}</span>
                    </div>
                </div>
                <div class="tw-col-pnl">${formatCurrency(pnl)}</div>
                <div class="tw-col-volume">${formatCurrency(volume)}</div>
                <div class="tw-col-actions">
                    ${isInWatchlist
                        ? `<button class="tw-add-btn added" disabled>Added</button>`
                        : `<button class="tw-add-btn" onclick="addFromTopWins('${wallet}', '${userName.replace(/'/g, "\\'")}')">Add</button>`
                    }
                </div>
            </div>
        `;
    }).join('');
}

window.addFromTopWins = async function(wallet, userName) {
    await addToWatchlist(wallet, userName);
    renderTopWins(); // Refresh to update button states
};

function updateWatchlistDisplay() {
    const watchlistCount = document.getElementById('watchlist-count');
    const watchlistGrid = document.getElementById('watchlist-grid');

    if (watchlistCount) {
        watchlistCount.textContent = watchlist.length;
    }

    if (watchlistGrid) {
        if (watchlist.length === 0) {
            watchlistGrid.innerHTML = '<p class="placeholder">No traders in watchlist</p>';
            return;
        }

        watchlistGrid.innerHTML = watchlist.map(trader => `
            <div class="watchlist-item">
                <div class="watchlist-item-info">
                    <span class="watchlist-item-name" title="${trader.name}">${truncateTraderName(trader.name)}</span>
                    <span class="watchlist-item-wallet">${truncateAddress(trader.wallet)}</span>
                </div>
                <button class="btn-remove" onclick="removeFromWatchlist('${trader.wallet}')">Remove</button>
            </div>
        `).join('');
    }
}

function saveWatchlist() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(watchlist));
    } catch (e) {
        console.warn('Failed to save watchlist to localStorage:', e);
    }
}

function exportWatchlist() {
    // Generate traders.js format
    const tradersCode = watchlist.map(t => `    {
        id: '${t.id || t.name}',
        name: '${t.name}',
        displayName: '${t.displayName || t.name}',
        wallet: '${t.wallet}',
        profileUrl: '${t.profileUrl || `https://polymarket.com/@${t.name}`}',
        joinDate: '${t.joinDate || 'Unknown'}'
    }`).join(',\n');

    const fullCode = `const TRADERS = [\n${tradersCode}\n];`;

    // Create a modal to show the export
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'block';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 800px;">
            <span class="close-modal" onclick="this.closest('.modal').remove()">&times;</span>
            <h2>Export Watchlist (${watchlist.length} traders)</h2>
            <p>Copy the code below and replace the TRADERS array in traders.js:</p>
            <textarea id="export-code" style="width: 100%; height: 400px; font-family: monospace; font-size: 12px; padding: 10px;">${fullCode}</textarea>
            <button onclick="document.getElementById('export-code').select(); document.execCommand('copy'); alert('Copied to clipboard!');" class="btn-primary" style="margin-top: 10px;">Copy to Clipboard</button>
        </div>
    `;
    document.body.appendChild(modal);

    // Close on outside click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
}

function loadWatchlist() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            watchlist = JSON.parse(saved);
        }
    } catch (e) {
        console.warn('Failed to load watchlist from localStorage:', e);
    }
}

// =====================
// THEME COMPARE TAB FUNCTIONS
// =====================

// Store theme chart instances
const themeChartInstances = new Map();

// Current theme comparison timeframe
let themeCompareTimeframe = '1M';

// Distinct colors for multi-line charts
const THEME_CHART_COLORS = [
    '#6366f1', // Indigo
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#ef4444', // Red
    '#8b5cf6', // Violet
    '#ec4899', // Pink
    '#14b8a6', // Teal
    '#f97316', // Orange
    '#06b6d4', // Cyan
    '#84cc16', // Lime
];

// Group traders by their primary market category
function groupTradersByTheme() {
    const themeGroups = {};

    for (const trader of tradersData) {
        const categories = trader.marketCategories || {};
        if (Object.keys(categories).length === 0) continue;

        // Add trader to ALL categories they have exposure to (not just primary)
        for (const [cat, data] of Object.entries(categories)) {
            if (data.count > 0 || data.value > 0) {
                if (!themeGroups[cat]) {
                    themeGroups[cat] = [];
                }
                themeGroups[cat].push(trader);
            }
        }
    }

    // Sort traders within each group by total PnL (descending)
    for (const theme of Object.keys(themeGroups)) {
        themeGroups[theme].sort((a, b) => {
            const pnlA = parseFloat(a.totalPnl) || 0;
            const pnlB = parseFloat(b.totalPnl) || 0;
            return pnlB - pnlA;
        });
    }

    return themeGroups;
}

// Render theme comparison charts
function renderThemeCompareCharts() {
    const grid = document.getElementById('theme-charts-grid');
    if (!grid) return;

    const themeGroups = groupTradersByTheme();
    const themes = Object.keys(themeGroups).sort((a, b) => {
        // Sort by number of traders in each theme (descending)
        return themeGroups[b].length - themeGroups[a].length;
    });

    if (themes.length === 0) {
        grid.innerHTML = `
            <div class="theme-chart-empty">
                <div class="theme-chart-empty-icon">📊</div>
                <p>No traders with market data available.</p>
                <p>Add traders from the Discover tab to see theme comparisons.</p>
            </div>
        `;
        return;
    }

    // Destroy existing chart instances
    for (const [key, chart] of themeChartInstances) {
        chart.destroy();
    }
    themeChartInstances.clear();

    // Render chart cards for each theme
    grid.innerHTML = themes.map(theme => {
        const traders = themeGroups[theme];
        const catInfo = MARKET_CATEGORIES[theme] || { name: theme };
        const chartId = `theme-chart-${theme}`;

        return `
            <div class="theme-chart-card" data-theme="${theme}">
                <div class="theme-chart-header">
                    <div class="theme-chart-title">
                        <h3>${catInfo.name}</h3>
                        <span class="theme-chart-badge ${theme}">${traders.length} trader${traders.length > 1 ? 's' : ''}</span>
                    </div>
                </div>
                <div class="theme-chart-container">
                    <canvas id="${chartId}"></canvas>
                </div>
                <div class="theme-chart-legend" id="legend-${theme}">
                    ${traders.slice(0, 10).map((trader, idx) => {
                        const pnl = getPnLForTimeframe(trader, themeCompareTimeframe);
                        const pnlClass = pnl >= 0 ? 'positive' : 'negative';
                        const color = THEME_CHART_COLORS[idx % THEME_CHART_COLORS.length];
                        return `
                            <div class="legend-item" data-trader-id="${trader.id}" data-theme="${theme}" title="${trader.name}">
                                <span class="legend-color" style="background: ${color}"></span>
                                <span class="legend-name">${truncateTraderName(trader.name)}</span>
                                <span class="legend-pnl ${pnlClass}">${formatPnLLarge(pnl)}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }).join('');

    // Render charts after DOM is updated
    setTimeout(() => {
        themes.forEach(theme => {
            renderThemeChart(theme, themeGroups[theme], themeCompareTimeframe);
        });
    }, 100);
}

// Render a multi-line chart for a single theme
function renderThemeChart(theme, traders, timeframe) {
    const chartId = `theme-chart-${theme}`;
    const canvas = document.getElementById(chartId);
    if (!canvas) return;

    // Limit to top 10 traders
    const chartTraders = traders.slice(0, 10);

    // Collect all timestamps from all traders and normalize data
    const allTimestamps = new Set();
    const traderDatasets = [];

    chartTraders.forEach((trader, idx) => {
        const history = generateTimeframeData(trader, timeframe);
        if (history && history.length > 0) {
            history.forEach(point => {
                allTimestamps.add(point.timestamp);
            });
        }
    });

    // Sort timestamps
    const sortedTimestamps = Array.from(allTimestamps).sort((a, b) => a - b);

    // If not enough data points, create a minimal dataset
    if (sortedTimestamps.length < 2) {
        // Create simple start-end dataset
        const now = Date.now();
        const timeRanges = {
            '1D': 24 * 60 * 60 * 1000,
            '1W': 7 * 24 * 60 * 60 * 1000,
            '1M': 30 * 24 * 60 * 60 * 1000,
            'ALL': 180 * 24 * 60 * 60 * 1000
        };
        const startTime = now - (timeRanges[timeframe] || timeRanges['1M']);
        sortedTimestamps.length = 0;
        sortedTimestamps.push(startTime, now);
    }

    // Build datasets for each trader
    chartTraders.forEach((trader, idx) => {
        const history = generateTimeframeData(trader, timeframe) || [];
        const color = THEME_CHART_COLORS[idx % THEME_CHART_COLORS.length];

        // Map data to common timestamps using interpolation
        const dataPoints = sortedTimestamps.map(ts => {
            // Find the closest points in trader's history
            if (history.length === 0) return null;

            // Find bracketing points
            let before = null;
            let after = null;

            for (const point of history) {
                if (point.timestamp <= ts) {
                    before = point;
                } else if (point.timestamp > ts && after === null) {
                    after = point;
                    break;
                }
            }

            // Interpolate or use closest value
            if (before && after) {
                const ratio = (ts - before.timestamp) / (after.timestamp - before.timestamp);
                return before.pnl + (after.pnl - before.pnl) * ratio;
            } else if (before) {
                return before.pnl;
            } else if (after) {
                return after.pnl;
            }
            return null;
        });

        traderDatasets.push({
            label: truncateTraderName(trader.name),
            data: dataPoints,
            borderColor: color,
            backgroundColor: 'transparent',
            borderWidth: 2,
            tension: 0.3,
            pointRadius: 0,
            pointHoverRadius: 4,
            pointHoverBackgroundColor: color,
            pointHoverBorderColor: '#fff',
            pointHoverBorderWidth: 2
        });
    });

    // Create chart labels
    const labels = sortedTimestamps.map(ts => {
        const date = new Date(ts);
        if (timeframe === '1D') {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    });

    // Destroy existing chart if any
    if (themeChartInstances.has(chartId)) {
        themeChartInstances.get(chartId).destroy();
    }

    const ctx = canvas.getContext('2d');
    const chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: traderDatasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    display: false // We use custom legend
                },
                tooltip: {
                    enabled: true,
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: true,
                    callbacks: {
                        title: function(context) {
                            return context[0].label;
                        },
                        label: function(context) {
                            const value = context.parsed.y;
                            if (value === null) return null;
                            const formatted = formatPnLLarge(value);
                            return `${context.dataset.label}: ${formatted}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    display: true,
                    grid: {
                        display: false
                    },
                    ticks: {
                        maxTicksLimit: 6,
                        color: '#9ca3af',
                        font: {
                            size: 10
                        }
                    }
                },
                y: {
                    display: true,
                    position: 'right',
                    grid: {
                        color: 'rgba(229, 231, 235, 0.5)'
                    },
                    ticks: {
                        color: '#9ca3af',
                        font: {
                            size: 10
                        },
                        callback: function(value) {
                            return formatPnLLarge(value);
                        }
                    }
                }
            }
        }
    });

    themeChartInstances.set(chartId, chart);
}

// Initialize theme compare tab listeners
function initThemeCompareListeners() {
    // Timeframe toggle buttons
    document.querySelectorAll('.theme-timeframe-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.theme-timeframe-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            themeCompareTimeframe = btn.dataset.timeframe;
            renderThemeCompareCharts();
        });
    });

    // Legend item click to toggle trader visibility
    document.addEventListener('click', function(e) {
        const legendItem = e.target.closest('.legend-item');
        if (legendItem) {
            const traderId = legendItem.dataset.traderId;
            const theme = legendItem.dataset.theme;
            const chartId = `theme-chart-${theme}`;
            const chart = themeChartInstances.get(chartId);

            if (chart) {
                // Find the dataset index
                const trader = tradersData.find(t => t.id === traderId);
                if (trader) {
                    const datasetIndex = chart.data.datasets.findIndex(
                        ds => ds.label === truncateTraderName(trader.name)
                    );

                    if (datasetIndex >= 0) {
                        const meta = chart.getDatasetMeta(datasetIndex);
                        meta.hidden = !meta.hidden;
                        legendItem.classList.toggle('disabled', meta.hidden);
                        chart.update();
                    }
                }
            }
        }
    });
}

// Initialize app
async function init() {
    loadWatchlist(); // Load saved watchlist first
    initTabs();
    initEventListeners();
    initTopWinsListeners();
    initThemeCompareListeners();
    setupAutoRefresh();
    updateWatchlistDisplay();
    await loadData();
}

// Start the app
document.addEventListener('DOMContentLoaded', init);
