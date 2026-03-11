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

const INDICATORS = ["CCI", "RSI", "SMA", "BOLL", "MACD", "ROC"];

let assetData = [];

function init() {
    // Generate initial random data simulating the ResultCollection structure
    assetData = CURRENCY_PAIRS.map(pair => {
        const compositeScore = (Math.random() * 20 - 10).toFixed(2);
        const inputs = {};
        INDICATORS.forEach(ind => {
            inputs[ind] = (Math.random() * 20 - 10).toFixed(1);
        });
        return {
            pair,
            price: (Math.random() * 2).toFixed(5),
            compositeScore: parseFloat(compositeScore),
            inputs
        };
    });

    renderAssets();
    setupEventListeners();
}

/**
 * Handle incoming webhook data in ResultCollection format
 * @param {Object} payload 
 */
function updateFromWebhook(payload) {
    if (!payload.success || !payload.payloadCollection.assetsArray) return;

    const incomingAssets = payload.payloadCollection.assetsArray;

    assetData = incomingAssets.map(asset => {
        return {
            pair: asset.pair,
            price: asset.price,
            compositeScore: asset.cumulativeSignalCollection.compositeScore,
            inputs: asset.inputsCollection
        };
    });

    renderAssets();
}

function renderAssets() {
    const grid = document.getElementById('asset-grid');
    const sortVal = document.getElementById('sort-control').value;
    const searchVal = document.getElementById('asset-search').value.toLowerCase();

    // Sort data
    let sortedData = [...assetData];
    if (sortVal === 'score-desc') sortedData.sort((a, b) => b.compositeScore - a.compositeScore);
    else if (sortVal === 'score-asc') sortedData.sort((a, b) => a.compositeScore - b.compositeScore);
    else if (sortVal === 'name') sortedData.sort((a, b) => a.pair.localeCompare(b.pair));

    // Filter data
    if (searchVal) {
        sortedData = sortedData.filter(item => item.pair.toLowerCase().includes(searchVal));
    }

    grid.innerHTML = '';

    sortedData.forEach((asset, index) => {
        const card = document.createElement('div');

        // Color logic based on compositeScore
        let colorClass = 'card-neutral';
        const score = asset.compositeScore;
        if (score >= 7) colorClass = 'card-high-pos';
        else if (score >= 3) colorClass = 'card-mid-pos';
        else if (score <= -7) colorClass = 'card-high-neg';
        else if (score <= -3) colorClass = 'card-mid-neg';

        card.className = `asset-card ${colorClass}`;

        const displayScore = score > 0 ? `+${score.toFixed(1)}` : score.toFixed(1);

        card.innerHTML = `
            <span class="asset-rank">#${index + 1} FX</span>
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
    const score = asset.compositeScore;
    const displayScore = score > 0 ? `+${score.toFixed(1)}` : score.toFixed(1);

    // Gauge percentage logic (-10 to 10 mapped to 0-100)
    const gaugePercent = ((score + 10) / 20) * 100;
    const sentiment = score >= 0 ? "Positive" : "Negative";
    const sentimentClass = score < 0 ? "neg" : "";

    body.innerHTML = `
        <div class="analytical-score-card ${sentimentClass}">
            <span class="asc-title">Analytical Score</span>
            <div class="asc-value">${displayScore}</div>
            <span class="asc-label">${sentiment}</span>
            <div class="asc-gauge">
                <div class="asc-gauge-fill" style="width: ${gaugePercent}%"></div>
            </div>
            <div class="asc-gauge-markers">
                <span>-10</span>
                <span>0</span>
                <span>+10</span>
            </div>
        </div>

        <h3 class="technical-indicators-title">Technical Indicators</h3>
        <div class="indicator-grid-detail">
            ${INDICATORS.map(ind => {
        const val = asset.inputs[ind];
        let indClass = 'ind-neutral';
        if (val >= 3) indClass = 'ind-green';
        else if (val <= -3) indClass = 'ind-red';

        return `
                    <div class="indicator-card ${indClass}">
                        <span class="ind-label-detail">${ind}</span>
                        <div class="ind-value-detail">${val >= 0 ? '+' : ''}${val}</div>
                    </div>
                `;
    }).join('')}
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

// Global exposure for debugging or manual webhook simulation
window.simulateWebhook = updateFromWebhook;

// Initial Call
document.addEventListener('DOMContentLoaded', init);
