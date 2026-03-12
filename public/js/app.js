// Configuration
const CONFIG = {
    repo: 'heatsignal',
    owner: 'clancyjwh',
    dataPath: 'public/data/latest_analysis.json',
    balancingWebhook: 'https://hook.us2.make.com/11xm2l8l6yfy8fh1m70hraxdldcgo4eq',
    supabaseUrl: 'https://bcvgjejxxkletazmxvsq.supabase.co',
    supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjdmdqZWp4eGtsZXRhem14dnNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzODE0MzMsImV4cCI6MjA4MDk1NzQzM30.UJRMF8IGKIriSov_I1wfclyDwmCMZKgwTMVkc8ZBI3g'
};

let supabase = null;
let userId = localStorage.getItem('heatsignal_user_id') || generateUUID();
localStorage.setItem('heatsignal_user_id', userId);

function generateUUID() {
    return 'xxxx-xxxx-4xxx-yxxx-xxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

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
                
                // Update Last Updated Timestamp
                const timeEl = document.getElementById('last-updated-time');
                if (timeEl) {
                    const now = new Date();
                    timeEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                }

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
    const searchVal = document.getElementById('asset-search').value.toLowerCase();

    let sortedData = [...assetData];
    // Default to score-desc sorting since selector is removed
    sortedData.sort((a, b) => b.compositeScore - a.compositeScore);

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
    document.getElementById('rfq-section').style.display = 'none';

    // Update Header Visibility
    const searchContainer = document.getElementById('search-container');
    const lastUpdatedContainer = document.getElementById('last-updated-container');
    const globalSentiment = document.getElementById('global-sentiment');
    const pageTitle = document.getElementById('page-title');

    if (section === 'analysis') {
        document.getElementById('analysis-section').style.display = 'block';
        if (searchContainer) searchContainer.style.display = 'flex';
        if (lastUpdatedContainer) lastUpdatedContainer.style.display = 'block';
        if (globalSentiment) globalSentiment.style.display = 'block';
        if (pageTitle) pageTitle.textContent = 'Market Analysis';
        renderAssets();
    } else if (section === 'balancing') {
        document.getElementById('balancing-section').style.display = 'block';
        if (searchContainer) searchContainer.style.display = 'none';
        if (lastUpdatedContainer) lastUpdatedContainer.style.display = 'none';
        if (globalSentiment) globalSentiment.style.display = 'none';
        if (pageTitle) pageTitle.textContent = 'Account Balancing';
    } else if (section === 'rfq') {
        document.getElementById('rfq-section').style.display = 'block';
        if (searchContainer) searchContainer.style.display = 'none';
        if (lastUpdatedContainer) lastUpdatedContainer.style.display = 'none';
        if (globalSentiment) globalSentiment.style.display = 'none';
        if (pageTitle) pageTitle.textContent = 'Request for Quote';
        
        // Display User ID in setup guide
        const userIdDisplay = document.getElementById('user-id-display');
        if (userIdDisplay) userIdDisplay.textContent = userId;

        initSupabase();
    }
}

async function initSupabase() {
    if (supabase) return;
    if (CONFIG.supabaseUrl === 'YOUR_SUPABASE_URL') {
        console.warn('Supabase URL not configured. Subscriptions disabled.');
        return;
    }
    
    try {
        supabase = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey);
        setupRealtimeSubscriptions();
    } catch (err) {
        console.error('Failed to initialize Supabase:', err);
    }
}

function setupRealtimeSubscriptions() {
    if (!supabase) return;
    
    console.log('Subscribing to live_sheet_rows for user:', userId);
    const channel = supabase
        .channel('live-prices')
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'live_sheet_rows', filter: `user_id=eq.${userId}` },
            (payload) => {
                console.log('Realtime Update Received:', payload);
                if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                    handleIncomingRow(payload.new);
                }
            }
        )
        .subscribe();
}

const RFQ_STATE = {
    SETUP: 'setup',
    LIVE: 'live',
    STAGING: 'staging',
    FROZEN: 'frozen'
};

let currentRfqState = RFQ_STATE.SETUP;
let liveRows = new Map();
let stagingData = [];

function moveToStaging() {
    currentRfqState = RFQ_STATE.STAGING;
    stagingData = Array.from(liveRows.values()).map(row => ({
        ...row,
        col_c: row.col_c, // Pos Amount
        col_d: row.col_d, // Pair
        col_e: row.col_e, // Value Date
        col_f: row.col_f, // Indicative Price
        col_j: row.col_j  // Account #
    }));
    renderStagingTable();
}

function handleIncomingRow(row) {
    if (currentRfqState !== RFQ_STATE.LIVE && currentRfqState !== RFQ_STATE.SETUP) return;
    
    if (currentRfqState === RFQ_STATE.SETUP) {
        currentRfqState = RFQ_STATE.LIVE;
    }

    liveRows.set(row.row_num, row);
    renderLivePricingTable();
}

function renderLivePricingTable() {
    const container = document.querySelector('.rfq-container');
    const stage = document.getElementById('rfq-setup-instructions');
    if (stage) stage.style.display = 'none';

    // Check if table already exists, if so update rows, otherwise create it
    let table = document.getElementById('live-pricing-table');
    if (!table) {
        container.innerHTML = `
            <div class="rfq-stage">
                <div class="stage-header">
                    <h2>Live Pricing</h2>
                    <div class="live-indicator">
                        <span class="pulse"></span> Live Prices Active
                    </div>
                </div>
                <div class="rfq-actions-bar">
                    <button class="btn btn-primary" onclick="moveToStaging()">Stage RFQs for Editing</button>
                </div>
                <div class="rfq-table-wrapper">
                    <table class="rfq-table" id="live-pricing-table">
                        <thead>
                            <tr>
                                <th>Trade Date/Time</th>
                                <th>Transaction #</th>
                                <th>Pos Amount</th>
                                <th>Pair</th>
                                <th>Value Date</th>
                                <th>Indicative Price</th>
                                <th>Counter Amount</th>
                                <th>Trader</th>
                                <th>Counterparty</th>
                                <th>Account #</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            </div>
        `;
        table = document.getElementById('live-pricing-table');
    }

    const tbody = table.querySelector('tbody');
    const sortedRows = Array.from(liveRows.values()).sort((a, b) => a.row_num - b.row_num);

    tbody.innerHTML = sortedRows.map(row => {
        const posAmount = parseFloat(row.col_c) || 0;
        const indicPrice = parseFloat(row.col_f) || 0;
        const counterAmount = (posAmount * -indicPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        return `
            <tr data-row-num="${row.row_num}">
                <td>${row.col_a || ''}</td>
                <td><span class="tx-badge">Generating...</span></td>
                <td>${posAmount.toLocaleString()}</td>
                <td>${row.col_d || ''}</td>
                <td>${row.col_e || ''}</td>
                <td class="live-price">${indicPrice.toFixed(5)}</td>
                <td class="recalc-field">${counterAmount}</td>
                <td>${row.col_h || ''}</td>
                <td>${row.col_i || ''}</td>
                <td>${row.col_j || ''}</td>
            </tr>
        `;
    }).join('');
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
        // Split by comma+space or comma, then join with newlines
        return str.split(/,\s*/).map(item => item.trim()).join('\n');
    };

    // 1. Handle Lists
    const list1El = document.getElementById('list-1-content');
    const list2El = document.getElementById('list-2-content');
    
    if (list1El) list1El.textContent = formatList(result["List 1"]);
    if (list2El) list2El.textContent = formatList(result["List 2"]);
}

function renderStagingTable() {
    const container = document.querySelector('.rfq-container');
    container.innerHTML = `
        <div class="rfq-stage">
            <div class="stage-header">
                <h2>Stage 3: Review & Edit</h2>
                <div class="status-badge staging">📝 Staging Mode</div>
            </div>
            <div class="rfq-actions-bar">
                <button class="btn btn-orange" onclick="freezePrices()">❄️ Trade Best Prices</button>
                <button class="btn btn-secondary btn-sm" onclick="resetToLive()">Reset to Live</button>
            </div>
            <div class="rfq-table-wrapper">
                <table class="rfq-table" id="staging-table">
                    <thead>
                        <tr>
                            <th>Trade Date/Time</th>
                            <th>Transaction #</th>
                            <th>Pos Amount</th>
                            <th>Pair</th>
                            <th>Value Date</th>
                            <th>Indicative Price</th>
                            <th>Counter Amount</th>
                            <th>Trader</th>
                            <th>Counterparty</th>
                            <th>Account #</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${stagingData.map((row, idx) => {
                            const posAmount = parseFloat(row.col_c) || 0;
                            const indicPrice = parseFloat(row.col_f) || 0;
                            const counterAmount = (posAmount * -indicPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                            
                            return `
                                <tr data-row-num="${row.row_num}">
                                    <td>${row.col_a || ''}</td>
                                    <td><span class="tx-badge">Generating...</span></td>
                                    <td><input type="number" class="table-input" value="${posAmount}" oninput="updateStagingField(${idx}, 'col_c', this.value)"></td>
                                    <td><input type="text" class="table-input" value="${row.col_d || ''}" oninput="updateStagingField(${idx}, 'col_d', this.value)"></td>
                                    <td><input type="text" class="table-input" value="${row.col_e || ''}" oninput="updateStagingField(${idx}, 'col_e', this.value)"></td>
                                    <td class="live-price"><input type="number" step="0.00001" class="table-input" value="${indicPrice}" oninput="updateStagingField(${idx}, 'col_f', this.value)"></td>
                                    <td class="recalc-field">${counterAmount}</td>
                                    <td>${row.col_h || ''}</td>
                                    <td>${row.col_i || ''}</td>
                                    <td><input type="text" class="table-input" value="${row.col_j || ''}" oninput="updateStagingField(${idx}, 'col_j', this.value)"></td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function updateStagingField(index, field, value) {
    stagingData[index][field] = value;
    // Re-render only counter amount for this row to minimize flicker
    const table = document.getElementById('staging-table');
    const row = table.querySelectorAll('tbody tr')[index];
    const posAmount = parseFloat(stagingData[index].col_c) || 0;
    const indicPrice = parseFloat(stagingData[index].col_f) || 0;
    const counterAmount = (posAmount * -indicPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    row.querySelector('.recalc-field').textContent = counterAmount;
}

function resetToLive() {
    currentRfqState = RFQ_STATE.LIVE;
    renderLivePricingTable();
}

function freezePrices() {
    currentRfqState = RFQ_STATE.FROZEN;
    renderFrozenFinalStage();
}

let selectedRecipients = {
    blackheath: true,
    velocity: true,
    me: true
};

function toggleRecipient(id) {
    selectedRecipients[id] = !selectedRecipients[id];
}

function renderFrozenFinalStage() {
    const container = document.querySelector('.rfq-container');
    
    // Calculate final totals for summary
    const totalTrades = stagingData.length;
    const totalVolume = stagingData.reduce((sum, row) => sum + (parseFloat(row.col_c) || 0), 0);
    
    container.innerHTML = `
        <div class="rfq-stage">
            <div class="stage-header">
                <h2>Stage 4: Final Review</h2>
                <div class="status-badge frozen">❄️ Prices Frozen</div>
            </div>
            
            <div class="final-summary-grid">
                <div class="summary-card">
                    <span class="label">Total Trades</span>
                    <span class="value">${totalTrades}</span>
                </div>
                <div class="summary-card">
                    <span class="label">Net Exposure</span>
                    <span class="value">${totalVolume.toLocaleString()}</span>
                </div>
            </div>

            <div class="rfq-table-wrapper">
                <table class="rfq-table compact">
                    <thead>
                        <tr>
                            <th>Transaction #</th>
                            <th>Pair</th>
                            <th>Amount</th>
                            <th>Value Date</th>
                            <th>Freeze Price</th>
                            <th>Counter Amount</th>
                            <th>Account #</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${stagingData.map(row => {
                            const posAmount = parseFloat(row.col_c) || 0;
                            const indicPrice = parseFloat(row.col_f) || 0;
                            const counterAmount = (posAmount * -indicPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                            return `
                                <tr>
                                    <td><span class="tx-badge">Pending...</span></td>
                                    <td><strong>${row.col_d || ''}</strong></td>
                                    <td>${posAmount.toLocaleString()}</td>
                                    <td>${row.col_e || ''}</td>
                                    <td class="live-price">${indicPrice.toFixed(5)}</td>
                                    <td class="recalc-field">${counterAmount}</td>
                                    <td>${row.col_j || ''}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>

            <div class="final-actions-section">
                <div class="recipient-selection">
                    <h3>Distribution Recipients</h3>
                    <div class="checkbox-group">
                        <label class="checkbox-container">
                            <input type="checkbox" checked onchange="toggleRecipient('blackheath')">
                            <span class="checkmark"></span> Blackheath
                        </label>
                        <label class="checkbox-container">
                            <input type="checkbox" checked onchange="toggleRecipient('velocity')">
                            <span class="checkmark"></span> Velocity
                        </label>
                        <label class="checkbox-container">
                            <input type="checkbox" checked onchange="toggleRecipient('me')">
                            <span class="checkmark"></span> Send to Me
                        </label>
                    </div>
                </div>
                
                <div class="submission-area">
                    <button class="btn btn-primary btn-lg" id="submit-rfq-btn" onclick="submitRFQ()">🚀 Submit RFQ to Webhook</button>
                    <button class="btn btn-secondary" onclick="resetToLive()">Cancel & Start Over</button>
                </div>
            </div>
        </div>
    `;
}

async function submitRFQ() {
    const btn = document.getElementById('submit-rfq-btn');
    btn.disabled = true;
    btn.innerHTML = `<span class="loading-spinner-xs"></span> Submitting...`;

    const payload = {
        htmlContent: document.querySelector('.rfq-table-wrapper').innerHTML,
        transactionData: stagingData,
        recipients: selectedRecipients,
        timestamp: new Date().toISOString(),
        userId: userId
    };

    try {
        const response = await fetch('https://hook.us2.make.com/sz98titlb1viukuk362e6p46mdekz0f0', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            renderSuccessScreen();
        } else {
            throw new Error('Submission failed');
        }
    } catch (err) {
        console.error('Submission error:', err);
        btn.disabled = false;
        btn.innerHTML = `🚀 Retry Submission`;
        alert('Failed to submit RFQ. Please check your connection and try again.');
    }
}

function renderSuccessScreen() {
    const container = document.querySelector('.rfq-container');
    container.innerHTML = `
        <div class="success-screen">
            <div class="success-icon">✅</div>
            <h2>RFQ Submitted Successfully</h2>
            <p>Your trade distribution is being processed. You will receive a confirmation email shortly.</p>
            <div class="redirect-info">Redirecting to Live Feed in <span id="timer">5</span>s...</div>
            <button class="btn btn-primary" onclick="resetToSetup()">Return Now</button>
        </div>
    `;

    let timeLeft = 5;
    const interval = setInterval(() => {
        timeLeft--;
        const timerEl = document.getElementById('timer');
        if (timerEl) timerEl.textContent = timeLeft;
        if (timeLeft <= 0) {
            clearInterval(interval);
            resetToSetup();
        }
    }, 1000);
}

function resetToSetup() {
    currentRfqState = RFQ_STATE.SETUP;
    liveRows.clear();
    stagingData = [];
    switchTab('rfq'); // Trigger UI refresh
}

async function copyUserId() {
    const el = document.getElementById('user-id-display');
    if (!el) return;
    try {
        await navigator.clipboard.writeText(el.textContent);
        const btn = event.target;
        const originalText = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => btn.textContent = originalText, 2000);
    } catch (err) {
        console.error('Failed to copy User ID:', err);
    }
}

document.addEventListener('DOMContentLoaded', init);
