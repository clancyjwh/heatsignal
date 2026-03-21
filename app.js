document.addEventListener('DOMContentLoaded', () => {
    // Supabase Configuration
    const supabaseUrl = 'https://ussceuooawbprpmxcmxg.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVzc2NldW9vYXdicHJwbXhjbXhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMzA5NjQsImV4cCI6MjA4OTYwNjk2NH0.mpoWD_X6rc71X_9p3q8P00JUYXOC9XyUF4T7HfGeaWw';
    const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

    const navLinks = document.querySelectorAll('.nav-links li');
    const tabTitle = document.getElementById('tab-title');
    const tabContent = document.getElementById('tab-content');

    let rfqSubscription = null;
    let currentRFQData = [];
    let priceMap = {}; // Stores { pair: price }

    const renderTerminalTable = () => {
        const container = document.getElementById('rfq-table-container');
        if (!container) return;

        if (currentRFQData.length === 0) {
            container.innerHTML = '<div class="welcome-card"><h3>No Data</h3><p>Please upload an RFQ file.</p></div>';
            return;
        }

        const tableHeaders = [
            'Trade Date', 'Amount', 'Currency pair', 
            'Value date', 'Account', 'Trader', 
            'Indicative price', 'Counter amount', 'Transaction #'
        ];

        let html = `
            <div class="rfq-container">
                <table class="rfq-table">
                    <thead>
                        <tr>${tableHeaders.map(h => `<th>${h}</th>`).join('')}</tr>
                    </thead>
                    <tbody>
        `;

        currentRFQData.forEach((row, index) => {
            const pair = row.pair || row.CurrencyPair || row.d || '-';
            const amount = parseFloat(row.amount || row.PositionAmount || row.c || 0);
            const livePrice = priceMap[pair] || 0;
            const counterAmount = amount * livePrice;

            html += `
                <tr data-row-index="${index}">
                    <td class="text-dim">${row.date || row.TradeDate || row.a || '-'}</td>
                    <td class="text-mono" data-amount="${amount}">${amount.toLocaleString()}</td>
                    <td class="text-cyan font-bold">${pair}</td>
                    <td>${row.valueDate || row.ValueDate || row.e || '-'}</td>
                    <td>${row.account || row.AccountNumber || row.j || '-'}</td>
                    <td>${row.trader || row.Trader || row.h || '-'}</td>
                    <td class="text-blue font-bold price-cell" data-pair="${pair}">${livePrice.toFixed(4)}</td>
                    <td class="text-primary font-bold counter-cell">${counterAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                    <td class="text-dim text-mono">${row.tx || row.TransactionNumber || row.b || '-'}</td>
                </tr>
            `;
        });

        html += `</tbody></table></div>`;
        container.innerHTML = html;
    };

    const fetchInitialPrices = async () => {
        const { data, error } = await supabase
            .from('live_prices')
            .select('currency_pair, forward_price');

        if (error) {
            console.error('Error fetching initial prices:', error);
            return;
        }

        data.forEach(item => {
            priceMap[item.currency_pair] = item.forward_price;
        });
        
        if (currentRFQData.length > 0) renderTerminalTable();
    };

    const setupPriceSubscription = () => {
        if (rfqSubscription) return;

        rfqSubscription = supabase
            .channel('public:live_prices')
            .on('postgres_changes', { 
                event: 'UPDATE', 
                schema: 'public', 
                table: 'live_prices' 
            }, (payload) => {
                const { currency_pair, forward_price } = payload.new;
                updatePriceInUI(currency_pair, forward_price);
            })
            .subscribe();
    };

    const updatePriceInUI = (pair, newPrice) => {
        const oldPrice = priceMap[pair] || 0;
        priceMap[pair] = newPrice;

        const cells = document.querySelectorAll(`.price-cell[data-pair="${pair}"]`);
        cells.forEach(cell => {
            cell.textContent = newPrice.toFixed(4);
            
            // Highlight change
            cell.classList.remove('price-up', 'price-down');
            void cell.offsetWidth; // Trigger reflow
            cell.classList.add(newPrice >= oldPrice ? 'price-up' : 'price-down');

            // Update counter amount in the same row
            const row = cell.closest('tr');
            const amountCell = row.querySelector('[data-amount]');
            const counterCell = row.querySelector('.counter-cell');
            if (amountCell && counterCell) {
                const amount = parseFloat(amountCell.getAttribute('data-amount'));
                counterCell.textContent = (amount * newPrice).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
            }
        });
    };

    const handleFileUpload = (file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target.result;
            const rows = text.split('\n').map(row => row.split(','));
            const headers = rows[0].map(h => h.trim());
            
            currentRFQData = rows.slice(1).filter(r => r.length > 1).map(row => {
                const obj = {};
                headers.forEach((header, i) => {
                    obj[header] = row[i]?.trim();
                });
                return obj;
            });

            // Transition to Step 2
            document.getElementById('rfq-step-1').style.display = 'none';
            document.getElementById('rfq-step-2').style.display = 'block';
            
            renderTerminalTable();
            setupPriceSubscription();
            fetchInitialPrices();
        };
        reader.readAsText(file);
    };

    const tabData = {
        home: {
            title: 'Home',
            content: `
                <div class="welcome-card fade-in">
                    <h3>Welcome back, Clancy.</h3>
                    <p>HeatSignal is now reset and ready for the RFQ implementation. Everything has been cleared to ensure a focused, high-performance trading environment.</p>
                </div>
            `
        },
        balance: {
            title: 'Balance',
            content: `
                <div class="tab-placeholder fade-in">
                    <div class="stat-grid">
                        <div class="stat-card">
                            <span class="label">Total Equity</span>
                            <span class="value">$1,240,582.42</span>
                        </div>
                        <div class="stat-card">
                            <span class="label">Available Margin</span>
                            <span class="value">$842,100.00</span>
                        </div>
                        <div class="stat-card">
                            <span class="label">Daily P&L</span>
                            <span class="value" style="color: #00ff64;">+$12,450.12 (1.02%)</span>
                        </div>
                    </div>
                    <div class="welcome-card">
                        <h3>Balance Ledger</h3>
                        <p>Detailed balance breakdown and spreadsheet integration will be restored here.</p>
                    </div>
                </div>
            `
        },
        rfq: {
            title: 'RFQ Terminal',
            content: `
                <div class="rfq-step-container fade-in">
                    <div id="rfq-step-1" class="upload-zone">
                        <div class="upload-icon">📁</div>
                        <h3>Upload RFQ Spreadsheet</h3>
                        <p>Drag and drop your Excel or CSV file here to begin pricing.</p>
                        <button class="btn btn-primary" onclick="document.getElementById('rfq-upload-input').click()">Select File</button>
                        <input type="file" id="rfq-upload-input" style="display: none;" accept=".csv,.xlsx,.xls">
                    </div>
                    <div id="rfq-step-2" style="display: none;">
                        <div class="terminal-header">
                            <div class="status-indicator">
                                <div class="pulse-dot"></div>
                                <span class="text-green">LIVE PRICE FEED ACTIVE</span>
                            </div>
                            <button class="btn btn-outline" id="reset-rfq">New Upload</button>
                        </div>
                        <div id="rfq-table-container"></div>
                    </div>
                </div>
            `
        }
    };

    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            const tabId = link.getAttribute('data-tab');
            
            // Update active state
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            // Update content
            if (tabData[tabId]) {
                tabTitle.textContent = (tabId === 'rfq') ? 'RFQ Terminal' : tabData[tabId].title;
                tabContent.innerHTML = tabData[tabId].content;

                if (tabId === 'rfq') {
                    // Re-attach upload listeners
                    const uploadInput = document.getElementById('rfq-upload-input');
                    const uploadZone = document.getElementById('rfq-step-1');
                    
                    if (uploadInput) {
                        uploadInput.addEventListener('change', (e) => {
                            if (e.target.files.length > 0) handleFileUpload(e.target.files[0]);
                        });
                    }

                    if (uploadZone) {
                        uploadZone.addEventListener('dragover', (e) => {
                            e.preventDefault();
                            uploadZone.classList.add('drag-over');
                        });
                        uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
                        uploadZone.addEventListener('drop', (e) => {
                            e.preventDefault();
                            uploadZone.classList.remove('drag-over');
                            if (e.dataTransfer.files.length > 0) handleFileUpload(e.dataTransfer.files[0]);
                        });
                    }

                    // Reset button
                    const resetBtn = document.getElementById('reset-rfq');
                    if (resetBtn) {
                        resetBtn.addEventListener('click', () => {
                            currentRFQData = [];
                            tabContent.innerHTML = tabData.rfq.content;
                            // Re-trigger the logic above by clicking the tab again or calling a function
                            link.click();
                        });
                    }
                }
            }
        });
    });
});

