const CURRENCY_PAIRS = [
    "AUD/CAD", "AUD/CHF", "AUD/DKK", "AUD/HKD", "AUD/JPY", "AUD/MXN", "AUD/NOK", "AUD/NZD", "AUD/SEK", "AUD/SGD", "AUD/USD",
    "CAD/CHF", "CAD/DKK", "CAD/HKD", "CAD/JPY", "CAD/MXN", "CAD/NOK", "CAD/NZD", "CAD/SEK", "CAD/SGD",
    "CHF/DKK", "CHF/HKD", "CHF/JPY", "CHF/MXN", "CHF/NOK", "CHF/NZD", "CHF/SEK", "CHF/SGD",
    "DKK/HKD", "DKK/JPY", "DKK/MXN", "DKK/NOK", "DKK/NZD", "DKK/SEK", "DKK/SGD",
    "EUR/AUD", "EUR/CAD", "EUR/CHF", "EUR/DKK", "EUR/GBP", "EUR/HKD", "EUR/JPY", "EUR/MXN", "EUR/NOK", "EUR/NZD", "EUR/SEK", "EUR/SGD", "EUR/USD",
    "GBP/AUD", "GBP/CAD", "GBP/CHF", "GBP/DKK", "GBP/HKD", "GBP/JPY", "GBP/MXN", "GBP/NOK", "GBP/NZD", "GBP/SEK", "GBP/SGD",
    "NOK/NZD", "NOK/SEK", "NOK/SGD", "NZD/SEK", "NZD/SGD", "SEK/SGD",
    "USD/AUD", "USD/CAD", "USD/CHF", "USD/DKK", "USD/HKD", "USD/JPY", "USD/MXN", "USD/NOK", "USD/NZD", "USD/SEK", "USD/SGD",
    "XAU/AUD", "XAU/CAD", "XAU/CHF", "XAU/DKK", "XAU/EUR", "XAU/GBP", "XAU/HKD", "XAU/JPY", "XAU/MXN", "XAU/NOK", "XAU/NZD", "XAU/SEK", "XAU/SGD", "XAU/USD"
];

const INDICATORS = ["MACD", "RSI", "SMA", "ROC", "BOLL", "CCI"];

let assetData = [];

function init() {
    // Generate initial random data
    assetData = CURRENCY_PAIRS.map(pair => {
        const score = (Math.random() * 20 - 10).toFixed(1);
        const indicators = {};
        INDICATORS.forEach(ind => {
            indicators[ind] = Math.random() > 0.5 ? 1 : -1; // Simplified for initial visualization
        });
        return { pair, score: parseFloat(score), indicators };
    });

    renderAssets();
    setupEventListeners();
}

function renderAssets() {
    const grid = document.getElementById('asset-grid');
    const sortVal = document.getElementById('sort-control').value;
    const searchVal = document.getElementById('asset-search').value.toLowerCase();

    // Sort data
    let sortedData = [...assetData];
    if (sortVal === 'score-desc') sortedData.sort((a, b) => b.score - a.score);
    else if (sortVal === 'score-asc') sortedData.sort((a, b) => a.score - b.score);
    else if (sortVal === 'name') sortedData.sort((a, b) => a.pair.localeCompare(b.pair));

    // Filter data
    if (searchVal) {
        sortedData = sortedData.filter(item => item.pair.toLowerCase().includes(searchVal));
    }

    grid.innerHTML = '';

    sortedData.forEach((asset, index) => {
        const card = document.createElement('div');
        card.className = 'asset-card';

        let scoreClass = 'score-mid';
        if (asset.score > 3) scoreClass = 'score-high';
        if (asset.score < -3) scoreClass = 'score-low';

        const displayScore = asset.score > 0 ? `+${asset.score}` : asset.score;

        card.innerHTML = `
            <span class="asset-rank">#${index + 1} Foreign Exchange</span>
            <div class="asset-name">${asset.pair}</div>
            <span class="asset-score ${scoreClass}">${displayScore}</span>
            <div class="indicator-dots">
                ${INDICATORS.map(ind => `
                    <div class="indicator-dot ${asset.indicators[ind] > 0 ? 'active-green' : 'active-red'}" title="${ind}"></div>
                `).join('')}
            </div>
        `;
        grid.appendChild(card);
    });
}

function setupEventListeners() {
    document.getElementById('sort-control').addEventListener('change', renderAssets);
    document.getElementById('asset-search').addEventListener('input', renderAssets);

    // Sidebar navigation simulation
    const navItems = document.querySelectorAll('.main-nav li');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(ni => ni.classList.remove('active'));
            item.classList.add('active');
            // Section switching logic could go here
        });
    });
}

// Initial Call
document.addEventListener('DOMContentLoaded', init);
