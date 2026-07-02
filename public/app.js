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
function fmtDateShort(iso) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function fmtK(n) {
  if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
  if (Math.abs(n) >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'k';
  return '$' + Math.round(n);
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

      <div class="chart-section">
        <div class="chart-header">
          <h3 class="txns-title">Balance Trend</h3>
          <div class="range-btns">
            <button class="range-btn active" data-days="30" onclick="switchChartRange(this)">30d</button>
            <button class="range-btn" data-days="60" onclick="switchChartRange(this)">60d</button>
            <button class="range-btn" data-days="90" onclick="switchChartRange(this)">90d</button>
            <button class="range-btn" data-days="120" onclick="switchChartRange(this)">120d</button>
            <button class="range-btn" data-days="360" onclick="switchChartRange(this)">360d</button>
          </div>
        </div>
        <div id="chart-container" class="chart-container"></div>
      </div>

      <div class="txns-section">
        <h3 class="txns-title">Transaction History</h3>
        <div class="txns-list">${txnsHtml}</div>
      </div>
    </div>`;

  loadAndRenderChart(a.id, 30);
}

// ─── Balance trend chart ──────────────────────────────────────
const C = { vw: 600, vh: 210, ml: 62, mr: 16, mt: 12, mb: 38 };

function renderChart(container, points) {
  if (points.length < 2) {
    container.innerHTML = '<div class="chart-empty">Not enough data to display</div>';
    return;
  }

  const balances = points.map(p => p.balance);
  const minB = Math.min(...balances);
  const maxB = Math.max(...balances);
  const spread = maxB - minB || Math.abs(maxB) * 0.1 || 100;
  const yLo = minB - spread * 0.15;
  const yHi = maxB + spread * 0.15;
  const yRange = yHi - yLo;
  const pw = C.vw - C.ml - C.mr;
  const ph = C.vh - C.mt - C.mb;

  const sx = i => C.ml + (i / (points.length - 1)) * pw;
  const sy = b => C.mt + ph - ((b - yLo) / yRange) * ph;

  const coords = points.map((p, i) => ({ x: sx(i), y: sy(p.balance), date: p.date, balance: p.balance }));

  let linePath = `M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)}`;
  for (let i = 1; i < coords.length; i++) {
    const p0 = coords[i - 1], p1 = coords[i];
    const cpx = ((p0.x + p1.x) / 2).toFixed(1);
    linePath += ` C ${cpx} ${p0.y.toFixed(1)}, ${cpx} ${p1.y.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
  }
  const areaPath = `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${(C.mt + ph).toFixed(1)} L ${coords[0].x.toFixed(1)} ${(C.mt + ph).toFixed(1)} Z`;

  const yTicks = [0, 1, 2, 3, 4].map(i => ({ b: yLo + yRange * i / 4, y: sy(yLo + yRange * i / 4) }));
  const xTicks = [0, 1, 2, 3, 4].map(i => {
    const idx = Math.round(i * (points.length - 1) / 4);
    return { date: points[idx].date, x: sx(idx) };
  });

  const uid = Math.random().toString(36).slice(2, 8);

  container.innerHTML = `
    <svg viewBox="0 0 ${C.vw} ${C.vh}" width="100%" height="210"
         preserveAspectRatio="none" class="chart-svg" id="chart-svg-${uid}">
      <defs>
        <linearGradient id="grad-${uid}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#22c55e" stop-opacity="0.2"/>
          <stop offset="100%" stop-color="#22c55e" stop-opacity="0"/>
        </linearGradient>
        <clipPath id="clip-${uid}">
          <rect x="${C.ml}" y="${C.mt}" width="${pw}" height="${ph}"/>
        </clipPath>
      </defs>
      ${yTicks.map(t => `<line x1="${C.ml}" y1="${t.y.toFixed(1)}" x2="${C.ml + pw}" y2="${t.y.toFixed(1)}" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>`).join('')}
      <path d="${areaPath}" fill="url(#grad-${uid})" clip-path="url(#clip-${uid})"/>
      <path d="${linePath}" fill="none" stroke="#22c55e" stroke-width="1.8" stroke-linecap="round" clip-path="url(#clip-${uid})"/>
      ${yTicks.map(t => `<text x="${(C.ml - 8).toFixed(1)}" y="${(t.y + 4).toFixed(1)}" text-anchor="end" fill="#71717a" font-size="10" font-family="system-ui,sans-serif">${fmtK(t.b)}</text>`).join('')}
      ${xTicks.map(t => `<text x="${t.x.toFixed(1)}" y="${(C.mt + ph + 26).toFixed(1)}" text-anchor="middle" fill="#71717a" font-size="10" font-family="system-ui,sans-serif">${fmtDateShort(t.date)}</text>`).join('')}
      <g id="chart-tip-${uid}" opacity="0" pointer-events="none">
        <line id="tt-vl-${uid}" x1="0" y1="${C.mt}" x2="0" y2="${C.mt + ph}" stroke="rgba(255,255,255,0.15)" stroke-width="1" stroke-dasharray="4 3"/>
        <circle id="tt-dot-${uid}" r="4" fill="#22c55e" stroke="#09090b" stroke-width="2"/>
        <rect id="tt-box-${uid}" rx="6" ry="6" fill="#1f1f23" stroke="rgba(255,255,255,0.12)" stroke-width="1" width="118" height="46"/>
        <text id="tt-amt-${uid}" fill="#f4f4f5" font-size="12" font-weight="600" font-family="system-ui,sans-serif"/>
        <text id="tt-dt-${uid}" fill="#a1a1aa" font-size="10" font-family="system-ui,sans-serif"/>
      </g>
      <rect x="${C.ml}" y="${C.mt}" width="${pw}" height="${ph}" fill="transparent" id="chart-ov-${uid}" style="cursor:crosshair"/>
    </svg>`;

  const svgEl = document.getElementById(`chart-svg-${uid}`);
  const tip    = document.getElementById(`chart-tip-${uid}`);
  const ttVl   = document.getElementById(`tt-vl-${uid}`);
  const ttDot  = document.getElementById(`tt-dot-${uid}`);
  const ttBox  = document.getElementById(`tt-box-${uid}`);
  const ttAmt  = document.getElementById(`tt-amt-${uid}`);
  const ttDt   = document.getElementById(`tt-dt-${uid}`);

  document.getElementById(`chart-ov-${uid}`).addEventListener('mousemove', e => {
    const rect = svgEl.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / rect.width * C.vw;
    const idx = Math.max(0, Math.min(coords.length - 1, Math.round((mx - C.ml) / pw * (coords.length - 1))));
    const pt = coords[idx];
    const bw = 118, bh = 46;
    let tx = pt.x + 10;
    if (tx + bw > C.vw - 4) tx = pt.x - bw - 10;
    let ty = Math.max(C.mt + 4, pt.y - bh / 2);
    if (ty + bh > C.mt + ph - 4) ty = C.mt + ph - bh - 4;

    ttVl.setAttribute('x1', pt.x); ttVl.setAttribute('x2', pt.x);
    ttDot.setAttribute('cx', pt.x); ttDot.setAttribute('cy', pt.y);
    ttBox.setAttribute('x', tx); ttBox.setAttribute('y', ty);
    ttAmt.setAttribute('x', tx + 10); ttAmt.setAttribute('y', ty + 18); ttAmt.textContent = fmt(pt.balance);
    ttDt.setAttribute('x', tx + 10); ttDt.setAttribute('y', ty + 33); ttDt.textContent = fmtDateShort(pt.date);
    tip.setAttribute('opacity', '1');
  });

  document.getElementById(`chart-ov-${uid}`).addEventListener('mouseleave', () => tip.setAttribute('opacity', '0'));
}

async function loadAndRenderChart(accountId, days) {
  const container = document.getElementById('chart-container');
  if (!container) return;
  container.innerHTML = '<div class="chart-loading">Loading…</div>';
  try {
    const points = await api.get(`/accounts/${accountId}/balance-history?days=${days}`);
    renderChart(container, points);
  } catch {
    container.innerHTML = '<div class="chart-empty">Could not load chart</div>';
  }
}

function switchChartRange(btn) {
  document.querySelectorAll('.range-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  loadAndRenderChart(selectedId, parseInt(btn.dataset.days, 10));
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
