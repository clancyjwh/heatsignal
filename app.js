document.addEventListener('DOMContentLoaded', () => {
    const navLinks = document.querySelectorAll('.nav-links li');
    const tabTitle = document.getElementById('tab-title');
    const tabContent = document.getElementById('tab-content');

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
                    <div class="welcome-card" style="border-left: 4px solid var(--primary);">
                        <h3>RFQ Ready</h3>
                        <p>This is where we will build the Request For Quote system. It will feature real-time pricing and deep liquidity integration.</p>
                        <button class="btn-icon" style="width: auto; padding: 0 20px; margin-top: 20px; background: var(--primary); border: none;">Initialize RFQ</button>
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
                tabTitle.textContent = tabData[tabId].title;
                tabContent.innerHTML = tabData[tabId].content;
            }
        });
    });
});
