// URLパラメータと、このページ自身のURL（QRコードやリンクに使う）
const PARAMS = Object.fromEntries(new URLSearchParams(location.search));
const PAGE_BASE = location.origin + location.pathname;

// ---- 端末に保存する氏名（localStorage が使えない環境では保存しない） ----
const NameStore = {
  KEY: 'equipmentLending.name',
  get() {
    try { return localStorage.getItem(this.KEY) || ''; } catch (e) { return ''; }
  },
  set(v) {
    try { localStorage.setItem(this.KEY, v); return true; } catch (e) { return false; }
  },
  clear() {
    try { localStorage.removeItem(this.KEY); } catch (e) { /* 無視 */ }
  },
};

// ---- API呼び出し ----
// credentials: 'omit' で Google のログイン情報を送らない（複数アカウントログイン時のエラーを避ける）
async function apiGet(params) {
  const res = await fetch(APP_CONFIG.API_URL + '?' + new URLSearchParams(params), { credentials: 'omit' });
  return parseResponse(res);
}

// Content-Type を text/plain にして CORS のプリフライトを発生させない
async function apiPost(body) {
  const res = await fetch(APP_CONFIG.API_URL, {
    method: 'POST',
    credentials: 'omit',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body),
  });
  return parseResponse(res);
}

async function parseResponse(res) {
  if (!res.ok) throw new Error('サーバーエラー（' + res.status + '）');
  try {
    return await res.json();
  } catch (e) {
    throw new Error('サーバーの応答を読み取れませんでした');
  }
}

async function withBusy(label, task) {
  const el = document.createElement('div');
  el.className = 'overlay-busy';
  el.textContent = label;
  document.body.appendChild(el);
  try {
    return await task();
  } finally {
    el.remove();
  }
}

// ---- 表示ヘルパー ----
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function itemUrl(id) { return PAGE_BASE + '?id=' + encodeURIComponent(id); }
function locationUrl(id) { return PAGE_BASE + '?loc=' + encodeURIComponent(id); }

function stateBadge(state, extraClass) {
  const cls = state === '使用中' ? 'busy' : 'ok';
  return '<span class="badge ' + cls + ' ' + (extraClass || '') + '">' + esc(state) + '</span>';
}

function errorCard(message, hint) {
  return '<div class="card"><div class="msg error">' + esc(message || 'エラーが発生しました。') + '</div>' +
    (hint ? '<p class="muted">' + esc(hint) + '</p>' : '') + '</div>';
}

// ---- モーダル ----
// buttons: [{ label, value, cls }]。押したボタンの value で resolve する
function showModal(bodyHtml, buttons) {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = '<div class="modal" role="dialog" aria-modal="true">' + bodyHtml +
      '<div class="actions"></div></div>';
    const actions = backdrop.querySelector('.actions');
    buttons.forEach((b) => {
      const btn = document.createElement('button');
      btn.textContent = b.label;
      if (b.cls) btn.className = b.cls;
      btn.addEventListener('click', () => {
        const value = typeof b.value === 'function' ? b.value(backdrop) : b.value;
        backdrop.remove();
        resolve(value);
      });
      actions.appendChild(btn);
    });
    document.body.appendChild(backdrop);
    const focusTarget = backdrop.querySelector('input') || actions.lastChild;
    if (focusTarget) focusTarget.focus();
  });
}

function confirmDialog(message, okLabel, cancelLabel) {
  return showModal('<p>' + esc(message) + '</p>', [
    { label: cancelLabel || 'キャンセル', value: false },
    { label: okLabel || 'OK', value: true, cls: 'ok' },
  ]);
}

function alertDialog(message) {
  return showModal('<p>' + esc(message) + '</p>', [{ label: 'OK', value: true, cls: 'ok' }]);
}

// ---- 名前設定（全画面共通） ----
async function openNameSettings(onChange) {
  const current = NameStore.get();
  const result = await showModal(
    '<h2>名前の設定</h2>' +
    '<p class="muted">この端末に保存して、次回から自動で入力します。</p>' +
    '<input type="text" id="nameSettingInput" maxlength="50" placeholder="氏名" value="' + esc(current) + '">',
    [
      { label: '削除', value: { action: 'clear' }, cls: 'warn' },
      { label: '閉じる', value: { action: 'cancel' } },
      { label: '保存', value: (el) => ({ action: 'save', name: el.querySelector('input').value.trim() }), cls: 'ok' },
    ]
  );
  if (result.action === 'save') {
    if (!result.name) {
      await alertDialog('名前を入力してください。');
      return openNameSettings(onChange);
    }
    if (!NameStore.set(result.name)) {
      await alertDialog('この端末（ブラウザ）では名前を保存できませんでした。プライベートブラウズを使っている場合は通常モードでお試しください。');
      return;
    }
    if (onChange) onChange(current, result.name);
  } else if (result.action === 'clear') {
    NameStore.clear();
    if (onChange) onChange(current, '');
  }
}

function renderHeader(onNameChange) {
  const header = document.querySelector('header.app');
  header.innerHTML =
    '<span class="title">' + esc(APP_CONFIG.APP_TITLE) + '</span>' +
    '<button class="small" id="nameSettingBtn">名前設定</button>';
  document.getElementById('nameSettingBtn').addEventListener('click', () => openNameSettings(onNameChange));
}
