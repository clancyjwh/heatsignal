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
            // Random performance values for indicators (-10 to 10)
            indicators[ind] = (Math.random() * 20 - 10).toFixed(1);
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

        // Color logic based on score
        let colorClass = 'card-neutral';
        if (asset.score >= 7) colorClass = 'card-high-pos';
        else if (asset.score >= 3) colorClass = 'card-mid-pos';
        else if (asset.score <= -7) colorClass = 'card-high-neg';
        else if (asset.score <= -3) colorClass = 'card-mid-neg';

        card.className = `asset-card ${colorClass}`;

        const displayScore = asset.score > 0 ? `+${asset.score}` : asset.score;

        card.innerHTML = `
            <span class="asset-rank">#${index + 1} FX Pair</span>
            <div class="asset-name">${asset.pair}</div>
            <span class="asset-score">${displayScore}</span>
        `;

        card.addEventListener('click', () => showDetail(asset));
        grid.appendChild(card);
    });
}

function showDetail(asset) {
    const modal = document.getElementById('detail-modal');
    const body = document.getElementById('modal-body');
    const displayScore = asset.score > 0 ? `+${asset.score}` : asset.score;

    body.innerHTML = `
        <div class="breakdown-header">
            <span class="asset-rank">Technical Breakdown</span>
            <h2>${asset.pair}</h2>
            <div class="breakdown-score">${displayScore}</div>
        </div>
        <div class="indicator-grid">
            ${INDICATORS.map(ind => `
                <div class="indicator-item">
                    <span class="ind-name">${ind}</span>
                    <span class="ind-val ${asset.indicators[ind] >= 0 ? 'val-pos' : 'val-neg'}">
                        ${asset.indicators[ind] >= 0 ? '+' : ''}${asset.indicators[ind]}
                    </span>
                </div>
            `).join('')}
        </div>
    `;

    modal.classList.add('active');
}

function setupEventListeners() {
    document.getElementById('sort-control').addEventListener('change', renderAssets);
    document.getElementById('asset-search').addEventListener('input', renderAssets);

    // Modal close
    document.querySelector('.close-modal').addEventListener('click', () => {
        document.getElementById('detail-modal').classList.remove('active');
    });

    window.addEventListener('click', (e) => {
        const modal = document.getElementById('detail-modal');
        if (e.target === modal) modal.classList.remove('active');
    });

    // Sidebar navigation simulation
    const navItems = document.querySelectorAll('.main-nav li');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(ni => ni.classList.remove('active'));
            item.classList.add('active');
        });
    });
}

// Initial Call
document.addEventListener('DOMContentLoaded', init);
