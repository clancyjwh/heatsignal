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
        // Try to hit the API directly
        let response = await fetch('/api/update-analysis');

        // Ultimate fallback: GitHub Raw file
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
        el.textContent = (avg >= 0 ? '+' : '') + avg.toFixed(1);
        el.className = `sentiment-value ${avg >= 0 ? 'positive' : 'negative'}`;
    }
}

function renderAssets() {
    const grid = document.getElementById('asset-grid');
    if (!grid) return;
    
    const sortVal = document.getElementById('sort-control').value;
    const searchVal = document.getElementById('asset-search').value.toLowerCase();

    let sortedData = [...assetData];
    if (sortVal === 'score-desc') sortedData.sort((a, b) => (parseFloat(b.compositeScore) || 0) - (parseFloat(a.compositeScore) || 0));
    else if (sortVal === 'score-asc') sortedData.sort((a, b) => (parseFloat(a.compositeScore) || 0) - (parseFloat(b.compositeScore) || 0));
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
    
    // Normalize -10 to +10 into 0 to 100%
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
            <div class="asc-gauge-markers" style="display: flex; justify-content: space-between; font-size: 0.75rem; opacity: 0.8; font-weight: bold; margin-top: 0.5rem;">
                <span>-10</span>
                <span>0</span>
                <span>+10</span>
            </div>
        </div>
        <h3 class="technical-indicators-title" style="margin-top: 2rem; margin-bottom: 1.5rem;">Technical Indicators</h3>
        <div class="indicator-grid-detail" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem;">
            ${INDICATORS.map(ind => {
                const val = asset.inputs ? (parseFloat(asset.inputs[ind]) || 0) : 0;
                const indClass = getValueIntensityClass(val);
                return `
                    <div class="indicator-card ${indClass}" style="padding: 1.5rem; text-align: center; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05);">
                        <span class="ind-label-detail" style="font-size: 0.75rem; opacity: 0.7; text-transform: uppercase; display: block; margin-bottom: 0.5rem;">${ind}</span>
                        <div class="ind-value-detail" style="font-family: 'JetBrains Mono', monospace; font-size: 1.8rem; font-weight: 800;">
                            ${val >= 0 ? '+' : ''}${val.toFixed(1)}
                        </div>
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
    document.querySelector(`.main-nav li[data-section="${section}"]`)?.classList.add('active');

    // Hide all sections
    document.querySelectorAll('.dashboard-section').forEach(s => s.style.display = 'none');

    // Update Header Visibility & Content
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
    } else if (section === 'rfq') {
        document.getElementById('rfq-section').style.display = 'block';
        searchContainer.style.display = 'none';
        headerControls.style.display = 'none';
        globalSentiment.style.display = 'none';
        pageTitle.textContent = 'RFQ Trading Platform';
        
        // Signal rfq.js to re-render or init if needed
        window.dispatchEvent(new CustomEvent('rfq-tab-active'));
    } else if (section === 'pricing') {
        document.getElementById('pricing-section').style.display = 'block';
        searchContainer.style.display = 'none';
        headerControls.style.display = 'none';
        globalSentiment.style.display = 'none';
        pageTitle.textContent = 'Pricing Module';
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
            <button class="btn btn-primary" onclick="resetBalancing()">Try Again</button>
        `;
    }
}

function resetBalancing() {
    originalExcelData = null;
    document.getElementById('balancing-results-container').style.display = 'none';
    const uploadArea = document.getElementById('upload-area');
    uploadArea.style.display = 'block';
    uploadArea.innerHTML = `
        <div class="upload-icon">📁</div>
        <h3>Upload Excel for Balancing</h3>
        <p>Drag & drop or click to select Excel sheet</p>
        <input type="file" id="file-input" accept=".xlsx, .xls" style="display: none;">
        <button class="btn btn-primary" onclick="document.getElementById('file-input').click()">Select File</button>
    `;
    // Re-bind file input listener
    document.getElementById('file-input').addEventListener('change', (e) => {
        handleFiles(e.target.files);
    });
}


function renderBalancingResults(result) {
    document.getElementById('upload-area').style.display = 'none';
    document.getElementById('balancing-results-container').style.display = 'block';

    const formatList = (str) => {
        if (!str) return "No data available";
        return str.split(/,\s*/).map(item => item.trim()).join('\n');
    };

    // 1. Handle Lists
    const list1El = document.getElementById('list-1-content');
    const list2El = document.getElementById('list-2-content');
    if (list1El) list1El.textContent = formatList(result["List 1"]);
    if (list2El) list2El.textContent = formatList(result["List 2"]);

    // 2. Handle Spreadsheet Data
    const tbody = document.getElementById('balance-body');
    const tfoot = document.getElementById('balance-footer');
    if (!tbody || !tfoot) return;

    tbody.innerHTML = '';
    
    let spreadsheetData = [];
    try {
        const rawJson = result["Balance Spreadsheet"] || '[]';
        spreadsheetData = JSON.parse(rawJson);
    } catch (e) {
        console.error("Failed to parse spreadsheet JSON:", e);
    }

    let sum1 = 0, sum2 = 0, sumChange = 0;

    spreadsheetData.forEach(row => {
        const pair = row["Pair"] || "Unknown";
        const oldRatio = parseFloat(row["Old Ratio"]) || 0;
        const newRatio = parseFloat(row["New Ratio"]) || 0;
        const change = newRatio - oldRatio;

        sum1 += oldRatio;
        sum2 += newRatio;
        sumChange += change;

        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
        
        const changeClass = getValueIntensityClass(change);

        tr.innerHTML = `
            <td style="padding: 1rem; font-weight: 600;">${pair}</td>
            <td style="padding: 1rem;">${oldRatio.toFixed(2)}</td>
            <td style="padding: 1rem;">${newRatio.toFixed(2)}</td>
            <td style="padding: 0.8rem;">
                <span class="${changeClass}" style="display: inline-block; padding: 0.3rem 0.8rem; border-radius: 6px; min-width: 60px; text-align: center;">
                    ${change > 0 ? '+' : ''}${change.toFixed(2)}
                </span>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // 3. Render Totals
    const totalChangeClass = getValueIntensityClass(sumChange);
    tfoot.innerHTML = `
        <tr>
            <td style="padding: 1.2rem;">TOTAL</td>
            <td style="padding: 1.2rem;">${sum1.toFixed(2)}</td>
            <td style="padding: 1.2rem;">${sum2.toFixed(2)}</td>
            <td style="padding: 1.2rem;">
                <span class="${totalChangeClass}" style="display: inline-block; padding: 0.3rem 0.8rem; border-radius: 6px; min-width: 60px; text-align: center;">
                    ${sumChange > 0 ? '+' : ''}${sumChange.toFixed(2)}
                </span>
            </td>
        </tr>
    `;
}

document.addEventListener('DOMContentLoaded', init);
