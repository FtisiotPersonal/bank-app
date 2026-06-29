'use strict';

// ─── State ────────────────────────────────────────────────────
let accounts = [];
let selectedId = null;

// ─── SVG icon strings ─────────────────────────────────────────
const icon = {
  arrowDown: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>`,
  arrowUp:   `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>`,
  transfer:  `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>`,
  check:     `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`,
  xmark:     `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  info:      `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><circle cx="12" cy="8" r="0.5" fill="currentColor"/></svg>`,
};

// ─── API helpers ──────────────────────────────────────────────
const api = {
  async get(path) {
    const r = await fetch(path);
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || `HTTP ${r.status}`); }
    return r.json();
  },
  async post(path, body) {
    const r = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
    return data;
  },
};

// ─── Format helpers ───────────────────────────────────────────
function fmt(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}
function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function initial(name) { return name.trim().charAt(0).toUpperCase(); }

// ─── Accounts list ────────────────────────────────────────────
async function loadAccounts() {
  try {
    accounts = await api.get('/accounts');
    renderSidebar();
  } catch {
    toast('Could not load accounts', 'error');
  }
}

function renderSidebar() {
  const total = accounts.reduce((s, a) => s + parseFloat(a.balance), 0);
  document.getElementById('total-balance').textContent = fmt(total);

  const el = document.getElementById('accounts-list');
  if (!accounts.length) {
    el.innerHTML = `<div class="empty-sidebar"><p>No accounts yet</p><p>Create your first account to get started</p></div>`;
    return;
  }

  el.innerHTML = accounts.map(a => `
    <button class="account-item${selectedId === a.id ? ' active' : ''}"
            data-id="${a.id}" onclick="selectAccount(${a.id})">
      <div class="account-avatar">${initial(a.owner_name)}</div>
      <div class="account-info">
        <span class="account-name">${esc(a.owner_name)}</span>
        <span class="account-email">${esc(a.email)}</span>
      </div>
      <span class="account-balance-sidebar">${fmt(a.balance)}</span>
    </button>
  `).join('');
}

// ─── Account detail ───────────────────────────────────────────
async function selectAccount(id) {
  selectedId = id;
  renderSidebar();

  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="account-detail">
      <div class="shimmer-card">
        <div class="shimmer-line wide"></div>
        <div class="shimmer-line tall"></div>
        <div class="shimmer-line short"></div>
      </div>
      <div class="shimmer-card">
        <div class="shimmer-line wide"></div>
        <div class="shimmer-line" style="width:90%;margin-top:6px"></div>
        <div class="shimmer-line" style="width:75%;margin-top:6px"></div>
      </div>
    </div>`;

  try {
    const [account, transactions, { delta }] = await Promise.all([
      api.get(`/accounts/${id}`),
      api.get(`/accounts/${id}/transactions`),
      api.get(`/accounts/${id}/balance-delta`),
    ]);
    renderDetail(account, transactions, delta);
  } catch {
    toast('Could not load account details', 'error');
    content.innerHTML = `<div class="welcome"><p style="color:var(--red)">Failed to load account.</p></div>`;
  }
}

function renderDetail(account, transactions, delta) {
  const a = account;

  const txnsHtml = transactions.length === 0
    ? `<div class="empty-txns">No transactions yet. Use Deposit to add funds.</div>`
    : transactions.map(t => {
        const isIn = t.to_account_id === a.id;
        const sign = isIn ? '+' : '-';
        const cls  = isIn ? 'in' : 'out';
        const label = t.type === 'transfer'
          ? (isIn ? 'Transfer In' : 'Transfer Out')
          : t.type.charAt(0).toUpperCase() + t.type.slice(1);
        return `
          <div class="txn-row">
            <div class="txn-icon ${cls}">${isIn ? icon.arrowDown : icon.arrowUp}</div>
            <div class="txn-info">
              <span class="txn-type">${label}</span>
              ${t.description ? `<span class="txn-desc">${esc(t.description)}</span>` : ''}
            </div>
            <div class="txn-right">
              <span class="txn-amount ${cls}">${sign}${fmt(t.amount)}</span>
              <span class="txn-date">${fmtDate(t.created_at)}</span>
            </div>
          </div>`;
      }).join('');

  document.getElementById('content').innerHTML = `
    <div class="account-detail">
      <div class="detail-head">
        <div class="detail-avatar">${initial(a.owner_name)}</div>
        <div>
          <h2 class="detail-name">${esc(a.owner_name)}</h2>
          <p class="detail-email">${esc(a.email)}</p>
          <p class="detail-id">Account #${a.id}</p>
        </div>
      </div>

      <div class="balance-card">
        <span class="balance-label">Current Balance</span>
        <span class="balance-amount">${fmt(a.balance)}</span>
        <div class="balance-delta ${delta >= 0 ? 'positive' : 'negative'}">
          ${delta >= 0 ? icon.arrowUp : icon.arrowDown}
          <span>${delta >= 0 ? '+' : ''}${fmt(delta)} past 30 days</span>
        </div>
        <span class="balance-since">Member since ${new Date(a.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
      </div>

      <div class="actions">
        <button class="btn-action deposit" onclick="openModal('deposit',${a.id})">
          ${icon.arrowDown} Deposit
        </button>
        <button class="btn-action withdraw" onclick="openModal('withdraw',${a.id})">
          ${icon.arrowUp} Withdraw
        </button>
        <button class="btn-action transfer" onclick="openModal('transfer',${a.id})">
          ${icon.transfer} Transfer
        </button>
      </div>

      <div class="txns-section">
        <h3 class="txns-title">Transaction History</h3>
        <div class="txns-list">${txnsHtml}</div>
      </div>
    </div>`;
}

// ─── Modal ────────────────────────────────────────────────────
function openModal(type, accountId) {
  const titles = { deposit: 'Deposit Funds', withdraw: 'Withdraw Funds', transfer: 'Transfer Funds', create: 'New Account' };
  document.getElementById('modal-title').textContent = titles[type];

  let html = '';

  if (type === 'deposit' || type === 'withdraw') {
    html = `
      <form id="mform">
        <div class="form-group">
          <label>Amount</label>
          <input type="number" name="amount" min="0.01" step="0.01" placeholder="0.00" required autofocus>
        </div>
        <div class="form-group">
          <label>Description <span class="optional">(optional)</span></label>
          <input type="text" name="description" placeholder="What is this for?">
        </div>
        <button type="submit" class="btn btn-primary btn-full">Confirm ${titles[type]}</button>
      </form>`;
  } else if (type === 'transfer') {
    const others = accounts.filter(a => a.id !== accountId);
    if (!others.length) {
      toast('No other accounts to transfer to', 'info');
      return;
    }
    const opts = others.map(a => `<option value="${a.id}">${esc(a.owner_name)} - ${fmt(a.balance)}</option>`).join('');
    html = `
      <form id="mform">
        <div class="form-group">
          <label>Destination Account</label>
          <select name="to_account_id" required>
            <option value="">Choose account...</option>
            ${opts}
          </select>
        </div>
        <div class="form-group">
          <label>Amount</label>
          <input type="number" name="amount" min="0.01" step="0.01" placeholder="0.00" required>
        </div>
        <div class="form-group">
          <label>Description <span class="optional">(optional)</span></label>
          <input type="text" name="description" placeholder="What is this for?">
        </div>
        <button type="submit" class="btn btn-primary btn-full">Transfer Funds</button>
      </form>`;
  } else if (type === 'create') {
    html = `
      <form id="mform">
        <div class="form-group">
          <label>Full Name</label>
          <input type="text" name="owner_name" placeholder="Jane Smith" required autofocus>
        </div>
        <div class="form-group">
          <label>Email</label>
          <input type="email" name="email" placeholder="jane@example.com" required>
        </div>
        <div class="form-group">
          <label>Opening Balance <span class="optional">(optional)</span></label>
          <input type="number" name="initial_balance" min="0" step="0.01" placeholder="0.00">
        </div>
        <button type="submit" class="btn btn-primary btn-full">Create Account</button>
      </form>`;
  }

  document.getElementById('modal-body').innerHTML = html;
  document.getElementById('mform').addEventListener('submit', (e) => handleSubmit(e, type, accountId));
  showModal();
  setTimeout(() => document.querySelector('#mform input, #mform select')?.focus(), 50);
}

function showModal() { document.getElementById('modal-bg').classList.add('open'); }
function closeModal() { document.getElementById('modal-bg').classList.remove('open'); }

async function handleSubmit(e, type, accountId) {
  e.preventDefault();
  const form = e.target;
  const raw = Object.fromEntries(new FormData(form));
  const data = { ...raw };
  if (data.amount)          data.amount          = parseFloat(data.amount);
  if (data.initial_balance) data.initial_balance = parseFloat(data.initial_balance) || 0;
  if (data.to_account_id)   data.to_account_id   = parseInt(data.to_account_id, 10);
  if (!data.description)    delete data.description;

  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = 'Processing...';

  try {
    let result;
    if      (type === 'deposit')  result = await api.post(`/accounts/${accountId}/deposit`,  data);
    else if (type === 'withdraw') result = await api.post(`/accounts/${accountId}/withdraw`, data);
    else if (type === 'transfer') result = await api.post(`/accounts/${accountId}/transfer`, data);
    else if (type === 'create')   result = await api.post('/accounts', data);

    closeModal();

    if (type === 'create') {
      toast(`Account created for ${result.owner_name}`, 'success');
      await loadAccounts();
      selectAccount(result.id);
    } else {
      toast('Transaction completed', 'success');
      await loadAccounts();
      selectAccount(selectedId);
    }
  } catch (err) {
    toast(err.message, 'error');
    btn.disabled = false;
    btn.textContent = form.querySelector('button[type="submit"]').dataset.label || 'Confirm';
  }
}

// ─── Toasts ───────────────────────────────────────────────────
function toast(message, type = 'info') {
  const icons = { success: icon.check, error: icon.xmark, info: icon.info };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="toast-icon">${icons[type] ?? icon.info}</span><span>${esc(message)}</span>`;
  document.getElementById('toasts').appendChild(el);
  requestAnimationFrame(() => { requestAnimationFrame(() => el.classList.add('show')); });
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 350);
  }, 3500);
}

// ─── Init ─────────────────────────────────────────────────────
document.getElementById('btn-new').addEventListener('click', () => openModal('create'));
document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-bg').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

loadAccounts();
