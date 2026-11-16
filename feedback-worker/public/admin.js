const TOKEN_KEY = 'feedbackAdminToken';
const STATUSES = ['new', 'filed', 'rejected'];
const PAGE_SIZE = 50;

const $ = (id) => document.getElementById(id);

const storage = {
  get() {
    try {
      return sessionStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token) {
    try {
      sessionStorage.setItem(TOKEN_KEY, token);
    } catch {
      // Without storage the token lasts until the page closes.
    }
  },
  clear() {
    try {
      sessionStorage.removeItem(TOKEN_KEY);
    } catch {
      // Nothing stored.
    }
  },
};

let token = storage.get();
let reports = [];
let next = null;
let selectedId = null;
let captureUrl = null;

class Unauthorized extends Error {}

async function api(path, init = {}) {
  const res = await fetch(path, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    signOut('That token was not accepted.');
    throw new Unauthorized();
  }
  return res;
}

async function apiJson(path, init) {
  const res = await api(path, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `The server answered ${res.status}.`);
  return body;
}

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  for (const child of children) {
    if (child !== null && child !== undefined) node.append(child);
  }
  return node;
}

const formatTime = (value) => (value ? new Date(value).toLocaleString() : '—');

function showError(error) {
  if (error instanceof Unauthorized) return;
  $('error').textContent = error instanceof Error ? error.message : String(error);
}

function signOut(message = '') {
  token = null;
  storage.clear();
  reports = [];
  next = null;
  selectedId = null;
  clearCapture();
  $('reports').replaceChildren();
  $('detail').replaceChildren();
  $('admin').hidden = true;
  $('login').hidden = false;
  $('login-error').textContent = message;
  $('token').value = '';
  $('token').focus();
}

function signIn() {
  $('login').hidden = true;
  $('admin').hidden = false;
  loadReports();
}

async function loadReports({ more = false } = {}) {
  $('error').textContent = '';
  const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
  const status = $('status-filter').value;
  if (status) params.set('status', status);
  if (more && next) params.set('cursor', next);
  try {
    const body = await apiJson(`/admin/reports?${params}`);
    reports = more ? [...reports, ...body.reports] : body.reports;
    next = body.next;
    renderList();
    const fromHash = decodeURIComponent(location.hash.slice(1));
    if (!more && fromHash && fromHash !== selectedId) openReport(fromHash);
  } catch (error) {
    showError(error);
  }
}

function renderList() {
  $('reports').replaceChildren(
    ...reports.map((report) => {
      const button = el(
        'button',
        { type: 'button', className: 'report' },
        el('span', { className: `status status-${report.status}`, textContent: report.status }),
        el('span', { className: 'time', textContent: formatTime(report.receivedAt) }),
        el('span', { className: 'target', textContent: report.target?.contentId ?? '' }),
        el('span', { className: 'comment', textContent: report.comment ?? '' }),
      );
      button.setAttribute('aria-current', String(report.id === selectedId));
      button.addEventListener('click', () => openReport(report.id));
      return el('li', {}, button);
    }),
  );
  $('empty').hidden = reports.length > 0;
  $('more').hidden = !next;
}

function clearCapture() {
  if (captureUrl) URL.revokeObjectURL(captureUrl);
  captureUrl = null;
}

async function openReport(id) {
  selectedId = id;
  history.replaceState(null, '', `#${encodeURIComponent(id)}`);
  renderList();
  const detail = $('detail');
  detail.hidden = false;
  detail.replaceChildren(el('p', { textContent: 'Loading…' }));
  try {
    const report = await apiJson(`/admin/reports/${encodeURIComponent(id)}`);
    if (selectedId !== id) return;
    renderDetail(report);
    loadCapture(report);
  } catch (error) {
    if (selectedId !== id) return;
    detail.replaceChildren();
    showError(error);
  }
}

async function loadCapture(report) {
  clearCapture();
  const box = $('capture');
  const none = () => box.replaceChildren(el('p', { textContent: 'No capture for this report.' }));
  if (!report.hasCapture) return none();
  try {
    const res = await api(`/admin/captures/${encodeURIComponent(report.id)}`);
    if (selectedId !== report.id) return;
    if (res.status === 404) return none();
    if (!res.ok) throw new Error(`The capture failed to load (${res.status}).`);
    captureUrl = URL.createObjectURL(await res.blob());
    box.replaceChildren(el('img', { src: captureUrl, alt: 'What the tester saw' }));
  } catch (error) {
    if (error instanceof Unauthorized || selectedId !== report.id) return;
    box.replaceChildren(el('p', { className: 'error', textContent: error.message }));
  }
}

function field(dl, label, value) {
  const text =
    value === null || value === undefined
      ? '—'
      : typeof value === 'object'
        ? JSON.stringify(value, null, 2)
        : String(value);
  dl.append(
    el('dt', { textContent: label }),
    el('dd', {}, el(typeof value === 'object' && value ? 'pre' : 'span', { textContent: text })),
  );
}

function renderDetail(report) {
  const statusButtons = STATUSES.map((status) => {
    const button = el('button', { type: 'button', textContent: status });
    button.setAttribute('aria-pressed', String(report.status === status));
    button.addEventListener('click', () => setStatus(report, status));
    return button;
  });

  const repro = el('dl');
  field(repro, 'Report id', report.id);
  field(repro, 'Created', formatTime(report.createdAt));
  field(repro, 'Received', formatTime(report.receivedAt));
  field(repro, 'Group', report.groupKey);
  field(repro, 'Issue', report.issueNumber);
  field(repro, 'Issue closed', report.issueClosedAt && formatTime(report.issueClosedAt));
  field(repro, 'Skill', report.skillId);
  field(repro, 'Phase', report.phase);
  field(repro, 'Target', report.target);
  field(repro, 'Content', report.content);
  field(repro, 'App', report.app);
  field(repro, 'Device', report.device);
  field(repro, 'Screen', report.screen);
  field(repro, 'Settings', report.settings);
  field(repro, 'Item', report.item);

  $('detail').replaceChildren(
    el('h2', { textContent: 'Report' }),
    el('div', { className: 'statuses', role: 'group', ariaLabel: 'Status' }, ...statusButtons),
    el('h3', { textContent: 'Comment' }),
    el('p', { className: 'comment-full', textContent: report.comment || '(no comment)' }),
    el('h3', { textContent: 'Capture' }),
    el('div', { id: 'capture' }, el('p', { textContent: 'Loading…' })),
    el('h3', { textContent: 'Details' }),
    repro,
  );
}

async function setStatus(report, status) {
  $('error').textContent = '';
  try {
    await apiJson(`/admin/reports/${encodeURIComponent(report.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const filter = $('status-filter').value;
    reports = reports
      .map((r) => (r.id === report.id ? { ...r, status } : r))
      .filter((r) => !filter || r.status === filter);
    renderList();
    if (selectedId === report.id) {
      report.status = status;
      for (const button of $('detail').querySelectorAll('.statuses button')) {
        button.setAttribute('aria-pressed', String(button.textContent === status));
      }
    }
  } catch (error) {
    showError(error);
  }
}

$('login').addEventListener('submit', (event) => {
  event.preventDefault();
  const value = $('token').value.trim();
  if (!value) return;
  token = value;
  storage.set(value);
  $('login-error').textContent = '';
  signIn();
});
$('status-filter').addEventListener('change', () => loadReports());
$('reload').addEventListener('click', () => loadReports());
$('more').addEventListener('click', () => loadReports({ more: true }));
$('logout').addEventListener('click', () => signOut());

if (token) signIn();
else signOut();
