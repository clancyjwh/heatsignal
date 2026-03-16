document.addEventListener('DOMContentLoaded', () => {
    // Supabase Configuration
    const supabaseUrl = 'https://bcvgjejxxkletazmxvsq.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjdmdqZWp4eGtsZXRhem14dnNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzODE0MzMsImV4cCI6MjA4MDk1NzQzM30.UJRMF8IGKIriSov_I1wfclyDwmCMZKgwTMVkc8ZBI3g';
    const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

    const navLinks = document.querySelectorAll('.nav-links li');
    const tabTitle = document.getElementById('tab-title');
    const tabContent = document.getElementById('tab-content');

    let rfqSubscription = null;

    const renderRFQTable = (rows) => {
        if (!rows || rows.length === 0) {
            return '<div class="welcome-card"><h3>No Live Data</h3><p>Ensure your Excel Add-in is streaming to the database.</p></div>';
        }

        const tableHeaders = [
            'Trade Date and Time', 'Position Amount', 'Currency pair', 
            'Value date', 'Account Number', 'Trader', 
            'Indicative price', 'Traded counter amount', 'Transaction Number'
        ];

        let html = `
            <div class="rfq-container fade-in">
                <div class="status-indicator">
                    <div class="pulse-dot"></div>
                    <span class="text-green">LIVE STREAM ACTIVE</span>
                </div>
                <table class="rfq-table">
                    <thead>
                        <tr>
                            ${tableHeaders.map(h => `<th>${h}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
        `;

        rows.forEach(row => {
            // Map table columns to schema: 
            // a:Trade Date, c:Position Amount, d:Currency Pair, e:Value Date, 
            // j:Account Number, h:Trader, f:Indicative Price, g:Counter Amount, b:Transaction Number
            html += `
                <tr>
                    <td class="text-dim">${row.a || '-'}</td>
                    <td class="text-mono">${row.c || '0'}</td>
                    <td class="text-cyan font-bold">${row.d || '-'}</td>
                    <td>${row.e || '-'}</td>
                    <td>${row.j || '-'}</td>
                    <td>${row.h || '-'}</td>
                    <td class="text-blue font-bold">${row.f || '0.0000'}</td>
                    <td class="text-primary font-bold">${row.g || '0'}</td>
                    <td class="text-dim text-mono">${row.b || '-'}</td>
                </tr>
            `;
        });

        html += `
                    </tbody>
                </table>
            </div>
        `;
        return html;
    };

    const fetchRFQData = async () => {
        const { data, error } = await supabase
            .from('live_sheet_rows')
            .select('*')
            .order('row_num', { ascending: true });

        if (error) {
            console.error('Error fetching RFQ data:', error);
            return;
        }

        if (tabTitle.textContent === 'RFQ Terminal') {
            tabContent.innerHTML = renderRFQTable(data);
        }
    };

    const setupRFQSubscription = () => {
        if (rfqSubscription) return;

        rfqSubscription = supabase
            .channel('public:live_sheet_rows')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'live_sheet_rows' }, () => {
                fetchRFQData();
            })
            .subscribe();
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
                <div class="tab-placeholder fade-in">
                    <div class="welcome-card">
                        <h3>Connecting to Live Feed...</h3>
                        <p>Subscribing to Supabase real-time stream.</p>
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
                    setupRFQSubscription();
                    fetchRFQData();
                }
            }
        });
    });
});

