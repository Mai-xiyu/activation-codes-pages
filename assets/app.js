const DATA_URL = 'data/activation-codes.json';

const state = {
  codes: [],
  query: '',
  status: 'all',
};

const statusMeta = {
  active: { label: '可用', className: 'status-active' },
  used: { label: '已用', className: 'status-used' },
  expired: { label: '过期', className: 'status-expired' },
  revoked: { label: '停用', className: 'status-revoked' },
};

const elements = {
  updatedAt: document.querySelector('#updatedAt'),
  totalCount: document.querySelector('#totalCount'),
  activeCount: document.querySelector('#activeCount'),
  usedCount: document.querySelector('#usedCount'),
  closedCount: document.querySelector('#closedCount'),
  searchInput: document.querySelector('#searchInput'),
  segments: document.querySelectorAll('.segment'),
  codeList: document.querySelector('#codeList'),
  emptyState: document.querySelector('#emptyState'),
  rowTemplate: document.querySelector('#codeRowTemplate'),
};

function normalizeStatus(value) {
  const raw = String(value || 'active').trim().toLowerCase();
  if (['used', 'consumed', 'redeemed'].includes(raw)) return 'used';
  if (['expired', 'timeout'].includes(raw)) return 'expired';
  if (['revoked', 'disabled', 'blocked', 'cancelled', 'canceled'].includes(raw)) return 'revoked';
  return 'active';
}

function asText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function asNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function pickPublicCode(entry) {
  const code = asText(entry.code || entry.activationCode || entry.licenseCode || entry.key);
  if (!code) return null;
  return {
    code,
    status: normalizeStatus(entry.status),
    plan: asText(entry.plan || entry.tier || entry.product),
    label: asText(entry.label || entry.note || entry.remark),
    issuedAt: asText(entry.issuedAt || entry.createdAt || entry.issued_at),
    expiresAt: asText(entry.expiresAt || entry.expiredAt || entry.expires_at),
    maxUses: asNumber(entry.maxUses || entry.max_uses),
    remainingUses: asNumber(entry.remainingUses || entry.remaining_uses),
    usedCount: asNumber(entry.usedCount || entry.used_count),
  };
}

function formatDate(value) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatUsage(code) {
  if (code.usedCount !== null && code.maxUses !== null) return `${code.usedCount}/${code.maxUses}`;
  if (code.remainingUses !== null && code.maxUses !== null) return `${code.maxUses - code.remainingUses}/${code.maxUses}`;
  if (code.remainingUses !== null) return `剩余 ${code.remainingUses}`;
  return '--';
}

function getFilteredCodes() {
  const query = state.query.replace(/\s+/g, '').toLowerCase();
  return state.codes.filter((code) => {
    if (state.status !== 'all' && code.status !== state.status) return false;
    if (!query) return true;
    const text = `${code.code}${code.plan}${code.label}`.replace(/\s+/g, '').toLowerCase();
    return text.includes(query);
  });
}

function renderStats() {
  const total = state.codes.length;
  const active = state.codes.filter((code) => code.status === 'active').length;
  const used = state.codes.filter((code) => code.status === 'used').length;
  const closed = state.codes.filter((code) => code.status === 'expired' || code.status === 'revoked').length;
  elements.totalCount.textContent = total;
  elements.activeCount.textContent = active;
  elements.usedCount.textContent = used;
  elements.closedCount.textContent = closed;
}

function renderList() {
  const rows = getFilteredCodes();
  elements.codeList.replaceChildren();
  elements.emptyState.hidden = rows.length > 0;

  for (const code of rows) {
    const node = elements.rowTemplate.content.firstElementChild.cloneNode(true);
    const meta = statusMeta[code.status] || statusMeta.active;
    const copyButton = node.querySelector('.copy-button');

    copyButton.title = '复制';
    copyButton.addEventListener('click', () => copyCode(code.code, copyButton));
    node.querySelector('.code-text').textContent = code.code;
    node.querySelector('.code-label').textContent = code.label || '公开发放';

    const status = node.querySelector('.status-pill');
    status.textContent = meta.label;
    status.classList.add(meta.className);

    node.querySelector('.plan-text').textContent = code.plan || '--';
    node.querySelector('.issued-at').textContent = formatDate(code.issuedAt);
    node.querySelector('.expires-at').textContent = formatDate(code.expiresAt);
    node.querySelector('.usage-text').textContent = formatUsage(code);
    elements.codeList.append(node);
  }
}

async function copyCode(code, button) {
  try {
    await navigator.clipboard.writeText(code);
    button.classList.add('copied');
    window.setTimeout(() => button.classList.remove('copied'), 900);
  } catch (error) {
    const textarea = document.createElement('textarea');
    textarea.value = code;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.append(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  }
}

function render() {
  renderStats();
  renderList();
}

async function loadCodes() {
  try {
    const response = await fetch(`${DATA_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    const rawCodes = Array.isArray(payload) ? payload : (payload.codes || payload.data || []);
    state.codes = rawCodes.map(pickPublicCode).filter(Boolean);
    elements.updatedAt.textContent = formatDate(payload.updatedAt || payload.generatedAt || '');
  } catch (error) {
    elements.updatedAt.textContent = '读取失败';
    state.codes = [];
  }
  render();
}

elements.searchInput.addEventListener('input', (event) => {
  state.query = event.target.value;
  renderList();
});

elements.segments.forEach((button) => {
  button.addEventListener('click', () => {
    elements.segments.forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    state.status = button.dataset.status || 'all';
    renderList();
  });
});

loadCodes();
