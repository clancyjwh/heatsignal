// RFQ Platform Core Logic
const SUPABASE_URL = 'https://bcvgjejxxkletazmxvsq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjdmdqZWp4eGtsZXRhem14dnNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzODE0MzMsImV4cCI6MjA4MDk1NzQzM30.UJRMF8IGKIriSov_I1wfclyDwmCMZKgwTMVkc8ZBI3g';

// Initialize Supabase Client
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// State management
let currentUser = null;
let traderInitials = null;
let sessionId = null;
let liveRows = new Map(); 
let isFrozen = false;
let realtimeChannel = null;

// DOM Elements (re-selected for unified dashboard)
const initialsModal = document.getElementById('initials-modal');
const initialsInput = document.getElementById('initials-input');
const saveInitialsBtn = document.getElementById('save-initials');
const traderIdDisplay = document.getElementById('trader-id-display');
const sessionIdDisplay = document.getElementById('session-id-display');
const setupView = document.getElementById('setup-view');
const mainWorkflow = document.getElementById('main-workflow');
const rfqBody = document.getElementById('rfq-body');
const rfqBadge = document.getElementById('rfq-live-badge');
const freezeBtn = document.getElementById('freeze-prices-btn');
const tradeBtn = document.getElementById('trade-best-prices-btn');
const finalActions = document.getElementById('final-actions');
const submitBtn = document.getElementById('submit-rfq-btn');
const warningModal = document.getElementById('warning-modal');
const warningMessage = document.getElementById('warning-message');
const confirmWarningBtn = document.getElementById('confirm-warning');
const successOverlay = document.getElementById('success-overlay');
const countdownSpan = document.getElementById('countdown');

// Initialize App
async function initRFQ() {
    console.log('📡 Initializing RFQ Module...');
    const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
    
    // If no session, RFQ cannot proceed (requires auth for profiles)
    if (sessionError || !session) {
        console.warn('RFQ requires session.');
        return;
    }
    
    currentUser = session.user;
    await checkTraderInitials();
    setupRecipientValidation();
}

async function checkTraderInitials() {
    const { data, error } = await supabaseClient
        .from('profiles')
        .select('trader_initials')
        .eq('user_id', currentUser.id)
        .single();

    if (error || !data || !data.trader_initials) {
        showInitialsModal();
    } else {
        traderInitials = data.trader_initials;
        updateUIWithInitials();
        if (!sessionId) startStreamingSession();
    }
}

function startStreamingSession() {
    sessionId = `session-${Math.random().toString(36).substring(2, 9)}-${Date.now()}`;
    if (sessionIdDisplay) sessionIdDisplay.innerText = sessionId;
    
    realtimeChannel = supabaseClient
        .channel(`rfq-${sessionId}`)
        .on('postgres_changes', { 
            event: '*', 
            schema: 'public', 
            table: 'live_sheet_rows',
            filter: `session_id=eq.${sessionId}` 
        }, handleRealtimePayload)
        .subscribe();
}

function handleRealtimePayload(payload) {
    if (isFrozen) return; 
    const { eventType, new: newRow, old: oldRow } = payload;
    if (eventType === 'INSERT' || eventType === 'UPDATE') {
        liveRows.set(newRow.id, newRow);
    } else if (eventType === 'DELETE') {
        liveRows.delete(oldRow.id);
    }
    renderTable();
}

function renderTable() {
    const sortedRows = Array.from(liveRows.values()).sort((a, b) => a.row_num - b.row_num);
    
    rfqBody.innerHTML = sortedRows.map(row => {
        const amount = parseFloat(row.col_c) || 0;
        const price = parseFloat(row.col_f) || 0;
        const counterAmount = (amount * (-price)).toFixed(2);
        
        return `
            <tr id="row-${row.id}" style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                <td style="padding: 1rem;">${row.col_a || '--'}</td>
                <td style="padding: 1rem;">${row.col_b || '--'}</td>
                <td class="editable" data-field="col_c" data-id="${row.id}" style="padding: 1rem;">${amount.toLocaleString()}</td>
                <td class="editable" data-field="col_d" data-id="${row.id}" style="padding: 1rem;">${row.col_d || '--'}</td>
                <td class="editable" data-field="col_e" data-id="${row.id}" style="padding: 1rem;">${row.col_e || '--'}</td>
                <td class="editable" data-field="col_f" data-id="${row.id}" style="padding: 1rem; color: #00bfff; font-weight: bold;">${price.toFixed(4)}</td>
                <td style="padding: 1rem; font-family: monospace;">${counterAmount}</td>
                <td style="padding: 1rem;">${row.col_h || '--'}</td>
                <td style="padding: 1rem;">${row.col_i || '--'}</td>
                <td class="editable" data-field="col_j" data-id="${row.id}" style="padding: 1rem;">${row.col_j || '--'}</td>
            </tr>
        `;
    }).join('');

    if (!isFrozen) {
        document.querySelectorAll('.editable').forEach(cell => {
            cell.addEventListener('click', () => startEditing(cell));
        });
    }
}

let activeEdit = null;

function startEditing(cell) {
    if (activeEdit) finishEditing(activeEdit.cell);
    const field = cell.dataset.field;
    const rowId = cell.dataset.id;
    const originalValue = cell.innerText;
    cell.innerHTML = `<input type="text" class="cell-input" value="${originalValue}">`;
    const input = cell.querySelector('input');
    input.focus();
    activeEdit = { cell, field, rowId, originalValue };
    input.addEventListener('blur', () => finishEditing(cell));
    input.addEventListener('keypress', (e) => { if (e.key === 'Enter') finishEditing(cell); });
}

function finishEditing(cell) {
    if (!activeEdit || activeEdit.cell !== cell) return;
    const input = cell.querySelector('input');
    if (!input) return;

    const newValue = input.value.trim();
    const { field, rowId, originalValue } = activeEdit;
    activeEdit = null;

    if (newValue === originalValue) { renderTable(); return; }

    if (field === 'col_c' || field === 'col_f') {
        const row = liveRows.get(rowId);
        const amount = field === 'col_c' ? parseFloat(newValue) : parseFloat(row.col_c);
        const price = field === 'col_f' ? parseFloat(newValue) : parseFloat(row.col_f);
        const newCounter = (amount * (-price)).toFixed(2);
        warningMessage.innerHTML = `This edit will change the Counter Amount to: <strong style="color: #00bfff;">${newCounter}</strong>. Do you want to proceed?`;
        warningModal.style.display = 'flex';
        confirmWarningBtn.onclick = () => { updateRowLocal(rowId, field, newValue); warningModal.style.display = 'none'; };
    } else { updateRowLocal(rowId, field, newValue); }
}

function updateRowLocal(rowId, field, value) {
    const row = liveRows.get(rowId);
    if (row) {
        row[field] = value;
        liveRows.set(rowId, row);
        renderTable();
    }
}

function setupRecipientValidation() {
    const checkRecipients = () => {
        const selected = document.querySelectorAll('.recipient-checkbox:checked').length;
        if (submitBtn) submitBtn.disabled = selected === 0;
    };
    document.querySelectorAll('.recipient-checkbox').forEach(cb => { cb.addEventListener('change', checkRecipients); });
    checkRecipients();
}

if (freezeBtn) {
    freezeBtn.addEventListener('click', () => {
        isFrozen = true;
        if (realtimeChannel) realtimeChannel.unsubscribe();
        if (rfqBadge) {
            rfqBadge.style.background = 'rgba(255, 69, 58, 0.2)';
            rfqBadge.style.color = '#ff453a';
            rfqBadge.style.borderColor = 'rgba(255, 69, 58, 0.3)';
            rfqBadge.innerHTML = '<i class="fas fa-lock"></i> Prices Frozen 🔒';
        }
        freezeBtn.classList.add('hidden');
        tradeBtn.classList.remove('hidden');
        renderTable(); 
    });
}

if (tradeBtn) {
    tradeBtn.addEventListener('click', () => {
        finalActions.classList.remove('hidden');
        tradeBtn.classList.add('hidden');
        finalActions.scrollIntoView({ behavior: 'smooth' });
    });
}

if (submitBtn) {
    submitBtn.addEventListener('click', async () => {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
        const sortedRows = Array.from(liveRows.values()).sort((a, b) => a.row_num - b.row_num);
        const transactionData = sortedRows.map(row => {
            const amount = parseFloat(row.col_c) || 0;
            const price = parseFloat(row.col_f) || 0;
            const [curr1, curr2] = (row.col_d || '/').split('/');
            return {
                CLIENT: row.col_i || 'UNKNOWN',
                CONTRACT_CURRENCY: curr1 || 'USD',
                COUNTER_CURRENCY: curr2 || 'USD',
                CLIENT_BUY_SELL: amount > 0 ? 'BUY' : 'SELL',
                CONTRACT_AMOUNT: Math.abs(amount),
                WHOLESALE_RATE: price,
                QUOTE_RATE: price,
                VALUE_DATE: row.col_e || ''
            };
        });
        const isChecked = (val) => document.querySelector(`.recipient-checkbox[value="${val}"]`)?.checked || false;
        const payload = {
            htmlContent: generateHtmlSummary(sortedRows),
            timestamp: new Date().toISOString(),
            totalRows: sortedRows.length,
            subject: `RFQ Submission - ${traderInitials} - ${new Date().toLocaleDateString()}`,
            transactionData: transactionData,
            recipientFlags: {
                Blackheath: isChecked('blackheath') ? 'yes' : 'no',
                Velocity: isChecked('velocity') ? 'yes' : 'no',
                Other: isChecked('me') ? currentUser.email : 'no',
                Onedrive: document.getElementById('onedrive-checkbox').checked ? 'yes' : 'no'
            }
        };
        try {
            const response = await fetch('https://hook.us2.make.com/sz98titlb1viukuk362e6p46mdekz0f0', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (response.ok) { showSuccess(); } else { throw new Error('Webhook failed'); }
        } catch (err) {
            console.error("Submission error:", err);
            alert("Submission failed. Please check your connection.");
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Request for Quote';
        }
    });
}

function generateHtmlSummary(rows) {
    let html = '<table border="1" cellpadding="5" style="border-collapse: collapse;">';
    html += '<thead><tr><th>Time</th><th>Trans #</th><th>Pair</th><th>Amount</th><th>Price</th><th>Counter Amt</th></tr></thead><tbody>';
    rows.forEach(row => {
        const amount = parseFloat(row.col_c) || 0;
        const price = parseFloat(row.col_f) || 0;
        html += `<tr><td>${row.col_a}</td><td>${row.col_b}</td><td>${row.col_d}</td><td>${amount.toLocaleString()}</td><td>${price.toFixed(4)}</td><td>${(amount * -price).toFixed(2)}</td></tr>`;
    });
    html += '</tbody></table>';
    return html;
}

function showSuccess() {
    successOverlay.style.display = 'flex';
    let count = 5;
    const interval = setInterval(() => {
        count--;
        countdownSpan.innerText = count;
        if (count <= 0) { 
            clearInterval(interval); 
            successOverlay.style.display = 'none';
            // Switch back to analysis tab instead of redirecting
            if (typeof switchTab === 'function') switchTab('analysis');
            else window.location.reload();
        }
    }, 1000);
}

function showInitialsModal() { initialsModal.style.display = 'flex'; }

function updateUIWithInitials() {
    if (traderIdDisplay) traderIdDisplay.innerText = traderInitials;
    if (initialsModal) initialsModal.style.display = 'none';
    if (setupView) setupView.classList.add('hidden');
    if (mainWorkflow) mainWorkflow.classList.remove('hidden');
}

if (saveInitialsBtn) {
    saveInitialsBtn.addEventListener('click', async () => {
        const initials = initialsInput.value.trim().toUpperCase();
        if (initials.length < 2 || initials.length > 3) { alert("Please enter 2 or 3 initials."); return; }
        const { error } = await supabaseClient.from('profiles').upsert({ user_id: currentUser.id, trader_initials: initials, email: currentUser.email });
        if (error) { alert("Failed to save initials."); } else {
            traderInitials = initials;
            updateUIWithInitials();
            startStreamingSession();
        }
    });
}

// Global hook for tab activation
window.addEventListener('rfq-tab-active', () => {
    initRFQ();
});
