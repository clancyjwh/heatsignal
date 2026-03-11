// Configuration
const CONFIG = {
    repo: 'heatsignal',
    owner: 'clancyjwh',
    dataPath: 'public/data/latest_analysis.json',
    balancingWebhook: 'https://hook.us2.make.com/11xm2l8l6yfy8fh1m70hraxdldcgo4eq'
};

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

const INDICATORS = ["SMA", "RSI", "BOLL", "CCI", "MACD", "ROC"];
let assetData = [];

async function init() {
    // 1. Start with blank state
    assetData = CURRENCY_PAIRS.map(pair => ({
        pair,
        price: "0.00000",
        compositeScore: 0,
        inputs: { SMA: 0, RSI: 0, BOLL: 0, CCI: 0, MACD: 0, ROC: 0 }
    }));
    renderAssets();

    // 2. Hydrate from LocalStorage (fastest)
    const cached = localStorage.getItem('heatsignal_data');
    if (cached) {
        try {
            assetData = JSON.parse(cached);
            renderAssets();
            updateGlobalSentiment();
        } catch (e) { }
    }

    setupEventListeners();

    // 3. Sync from the LIVE API (most accurate)
    await syncData();

    // 4. Poll every 60s
    setInterval(syncData, 60000);
}

async function syncData() {
    try {
        // Try to hit the API directly (Vercel warm start memory)
        let response = await fetch('/api/update-analysis');

        // If API fails or is empty, try the GitHub Raw file as ultimate fallback
        if (!response.ok) {
            const url = `https://raw.githubusercontent.com/${CONFIG.owner}/${CONFIG.repo}/main/${CONFIG.dataPath}?t=${Date.now()}`;
            response = await fetch(url);
        }

        if (response.ok) {
            const result = await response.json();
            if (result.success && result.data) {
                assetData = result.data;
                localStorage.setItem('heatsignal_data', JSON.stringify(assetData));
                renderAssets();
                updateGlobalSentiment();
                console.log('✅ Sync Complete:', result.assetCount, 'pairs updated.');
                return;
            }
        }
        console.warn('Sync attempt returned no data.');
    } catch (err) {
        console.error('❌ Sync Failed:', err.message);
    }
}

function updateGlobalSentiment() {
    if (assetData.length === 0) return;
    const scores = assetData.map(a => parseFloat(a.compositeScore) || 0);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const el = document.querySelector('.sentiment-value');
    if (el) {
        el.textContent = (avg > 0 ? '+' : '') + avg.toFixed(1);
        el.className = `sentiment-value ${avg >= 0 ? 'positive' : 'negative'}`;
    }
}

function renderAssets() {
    const grid = document.getElementById('asset-grid');
    const sortVal = document.getElementById('sort-control').value;
    const searchVal = document.getElementById('asset-search').value.toLowerCase();

    let sortedData = [...assetData];
    if (sortVal === 'score-desc') sortedData.sort((a, b) => b.compositeScore - a.compositeScore);
    else if (sortVal === 'score-asc') sortedData.sort((a, b) => a.compositeScore - b.compositeScore);
    else if (sortVal === 'name') sortedData.sort((a, b) => a.pair.localeCompare(b.pair));

    if (searchVal) {
        sortedData = sortedData.filter(item => item.pair.toLowerCase().includes(searchVal));
    }

    grid.innerHTML = '';

    sortedData.forEach((asset, index) => {
        const card = document.createElement('div');
        const score = parseFloat(asset.compositeScore) || 0;
        const colorClass = getValueIntensityClass(score);

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
    const score = parseFloat(asset.compositeScore) || 0;
    const displayScore = score > 0 ? `+${score.toFixed(1)}` : score.toFixed(1);
    const gaugePercent = ((score + 10) / 20) * 100;
    const sentiment = score >= 0 ? "Positive" : "Negative";
    const intensityClass = getValueIntensityClass(score);

    body.innerHTML = `
        <div class="analytical-score-card ${intensityClass}">
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
        const val = asset.inputs ? (asset.inputs[ind] || 0) : 0;
        const indClass = getValueIntensityClass(val);
        return `
                    <div class="indicator-card ${indClass}">
                        <span class="ind-label-detail">${ind}</span>
                        <div class="ind-value-detail">${parseFloat(val) >= 0 ? '+' : ''}${parseFloat(val).toFixed(1)}</div>
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
    document.querySelector('.close-modal').addEventListener('click', () => {
        document.getElementById('detail-modal').classList.remove('active');
    });
    window.addEventListener('click', (e) => {
        const modal = document.getElementById('detail-modal');
        if (e.target === modal) modal.classList.remove('active');
    });

    // Tab Switching
    document.querySelectorAll('.main-nav li').forEach(item => {
        item.addEventListener('click', () => {
            const section = item.getAttribute('data-section');
            switchTab(section);
        });
    });

    // File Upload Logic
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('file-input');

    if (uploadArea && fileInput) {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            }, false);
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            uploadArea.addEventListener(eventName, () => uploadArea.classList.add('dragover'), false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, () => uploadArea.classList.remove('dragover'), false);
        });

        uploadArea.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            handleFiles(files);
        }, false);

        fileInput.addEventListener('change', (e) => {
            handleFiles(e.target.files);
        });
    }
}

function switchTab(section) {
    // Update active state in nav
    document.querySelectorAll('.main-nav li').forEach(li => li.classList.remove('active'));
    document.querySelector(`.main-nav li[data-section="${section}"]`).classList.add('active');

    // Hide all sections
    document.getElementById('analysis-section').style.display = 'none';
    document.getElementById('balancing-section').style.display = 'none';

    // Update Header Visibility
    const searchContainer = document.getElementById('search-container');
    const headerControls = document.getElementById('header-controls');
    const globalSentiment = document.getElementById('global-sentiment');
    const pageTitle = document.getElementById('page-title');

    if (section === 'analysis') {
        document.getElementById('analysis-section').style.display = 'block';
        searchContainer.style.display = 'flex';
        headerControls.style.display = 'flex';
        globalSentiment.style.display = 'block';
        pageTitle.textContent = 'Market Analysis';
    } else if (section === 'balancing') {
        document.getElementById('balancing-section').style.display = 'block';
        searchContainer.style.display = 'none';
        headerControls.style.display = 'none';
        globalSentiment.style.display = 'none';
        pageTitle.textContent = 'Balancing Tool';
    }
}

let originalExcelData = null;

function getValueIntensityClass(val) {
    const num = parseFloat(val);
    if (isNaN(num) || num === 0) return 'val-zero';
    
    const abs = Math.abs(num);
    // Map 0.1-10 to 1-10
    let level = Math.min(10, Math.max(1, Math.ceil(abs)));

    return num > 0 ? `val-p${level}` : `val-n${level}`;
}

async function handleFiles(files) {
    if (files.length === 0) return;
    const file = files[0];
    const reader = new FileReader();

    reader.onload = async (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // Store original data for "Change" calculation
        originalExcelData = XLSX.utils.sheet_to_json(worksheet);
        
        // Convert to CSV
        const csv = XLSX.utils.sheet_to_csv(worksheet);
        
        await submitToWebhook(csv);
    };

    reader.readAsArrayBuffer(file);
}

async function submitToWebhook(csv) {
    const uploadArea = document.getElementById('upload-area');
    uploadArea.innerHTML = `
        <div class="upload-icon">⚡</div>
        <h3>Processing balancing...</h3>
        <p>Sending data to high-performance engine</p>
        <div class="loading-spinner"></div>
    `;

    try {
        const response = await fetch(CONFIG.balancingWebhook, {
            method: 'POST',
            headers: { 'Content-Type': 'text/csv' },
            body: csv
        });

        if (!response.ok) throw new Error('Webhook error');

        const result = await response.json();
        renderBalancingResults(result);
    } catch (err) {
        console.error('Webhook failed:', err);
        uploadArea.innerHTML = `
            <div class="upload-icon">❌</div>
            <h3>Submission Failed</h3>
            <p>${err.message}</p>
            <button class="btn btn-primary" onclick="location.reload()">Try Again</button>
        `;
    }
}

function parseConcatenatedJson(str) {
    if (!str) return [];
    try {
        // Handle format: {"A":"B"}{"C":"D"} -> [{"A":"B"},{"C":"D"}]
        const formatted = '[' + str.replace(/\}\s*\{/g, '},{') + ']';
        return JSON.parse(formatted);
    } catch (e) {
        console.error('JSON Parse Error:', e);
        return [];
    }
}

function renderBalancingResults(result) {
    document.getElementById('upload-area').style.display = 'none';
    document.getElementById('balancing-results-container').style.display = 'block';

    // 1. Handle Lists
    const list1El = document.getElementById('list-1-content');
    const list2El = document.getElementById('list-2-content');
    
    if (list1El) list1El.textContent = result["List 1"] || "No data available";
    if (list2El) list2El.textContent = result["List 2"] || "No data available";

    // 2. Parse Balance Data
    const balanceData = parseConcatenatedJson(result["Balance"]);
    if (balanceData.length === 0) return;

    const thead = document.getElementById('balancing-thead');
    const tbody = document.getElementById('balancing-tbody');
    const tfoot = document.getElementById('balancing-tfoot');

    // Expected columns: Pair, Old Ratio, New Ratio, Ratio Change
    const columns = ['Pair', 'Old Ratio', 'New Ratio', 'Ratio Change'];
    thead.innerHTML = `<tr>${columns.map(c => `<th>${c}</th>`).join('')}</tr>`;

    let html = '';
    const columnSums = { 'Old Ratio': 0, 'New Ratio': 0, 'Ratio Change': 0 };

    balanceData.forEach(row => {
        html += '<tr>';
        columns.forEach(col => {
            const val = row[col];
            const isNumeric = col !== 'Pair';
            const numVal = parseFloat(val) || 0;
            
            let displayVal = val;
            let intensityClass = '';
            
            if (isNumeric) {
                intensityClass = getValueIntensityClass(numVal);
                displayVal = numVal.toFixed(2);
                columnSums[col] += numVal;
            }

            html += `<td class="${isNumeric ? 'numeric' : ''} ${intensityClass}">${displayVal}</td>`;
        });
        html += '</tr>';
    });

    tbody.innerHTML = html;

    // 3. Render Sum Row
    let footHtml = '<tr>';
    columns.forEach(col => {
        if (col === 'Pair') {
            footHtml += '<td class="val-zero">TOTAL</td>';
        } else {
            const sum = columnSums[col];
            const intensityClass = getValueIntensityClass(sum);
            footHtml += `<td class="numeric ${intensityClass}">${sum.toFixed(2)}</td>`;
        }
    });
    footHtml += '</tr>';
    tfoot.innerHTML = footHtml;
}

document.addEventListener('DOMContentLoaded', init);
