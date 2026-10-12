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

// ---- 通行証（正しい認証キーを入れた端末にサーバーが発行する）。有効期限つきで端末に保存する ----
const TokenStore = {
  KEY: 'equipmentLending.accessToken',
  OLD_KEY: 'equipmentLending.accessKey', // 以前は認証キーそのものを保存していた
  get() {
    try {
      const token = localStorage.getItem(this.KEY) || '';
      // 形式は「有効期限(ミリ秒).署名」
      if (token && Number(token.split('.')[0]) > Date.now()) return token;
      this.clear();
      return '';
    } catch (e) { return ''; }
  },
  set(token) {
    try { localStorage.setItem(this.KEY, token); return true; } catch (e) { return false; }
  },
  clear() {
    try { localStorage.removeItem(this.KEY); } catch (e) { /* 無視 */ }
  },
  // 以前の形式で保存した認証キーを取り出して消す（通行証への切り替え用）
  takeOldKey() {
    try {
      const saved = JSON.parse(localStorage.getItem(this.OLD_KEY) || 'null');
      localStorage.removeItem(this.OLD_KEY);
      return saved && saved.key && Date.now() < saved.expiresAt ? saved.key : '';
    } catch (e) { return ''; }
  },
};

// このページで使う通行証。端末に保存できなくても、ページを開いている間は使える
let sessionToken = '';

/** 通行証がなければ認証キーの入力画面を出し、正しいキーが入るまで待つ */
async function ensureAccessKey(app) {
  sessionToken = TokenStore.get();
  if (sessionToken) return;

  // 以前の形式で認証キーを保存していた端末は、入力なしで通行証に切り替える
  const oldKey = TokenStore.takeOldKey();
  if (oldKey) {
    try {
      const res = await apiGet({ action: 'verify' }, oldKey);
      if (res.ok && res.token) {
        sessionToken = res.token;
        TokenStore.set(res.token);
        return;
      }
    } catch (e) { /* 入力画面に進む */ }
  }

  await new Promise((resolve) => {
    app.innerHTML =
      '<div class="card">' +
        '<h1>認証キーの入力</h1>' +
        '<p class="muted">QRラベルに記載されている認証キーを入力してください。この端末で' + APP_CONFIG.ACCESS_KEY_DAYS + '日間、再入力なしで使えます。</p>' +
        '<div id="keyMsg"></div>' +
        '<label class="field" for="keyInput">認証キー</label>' +
        '<input type="text" id="keyInput" inputmode="numeric" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="数字6桁">' +
        '<button class="primary" id="keyBtn">確認</button>' +
      '</div>' +
      '<p class="notice">' + esc(LOGGING_NOTICE) + '</p>';
    const input = document.getElementById('keyInput');
    const msg = document.getElementById('keyMsg');
    const submit = async () => {
      const k = input.value.trim().toLowerCase();
      if (!k) return;
      let res;
      try {
        res = await withBusy('確認中…', () => apiGet({ action: 'verify' }, k));
      } catch (err) {
        msg.innerHTML = '<div class="msg error">通信エラー：' + esc(err.message) + '</div>';
        return;
      }
      if (!res.ok) {
        msg.innerHTML = '<div class="msg error">' + esc(res.message) + '</div>';
        input.select();
        return;
      }
      sessionToken = res.token;
      if (!TokenStore.set(res.token)) {
        await alertDialog('この端末（ブラウザ）には認証キーを保存できませんでした。次回もう一度入力してください。');
      }
      resolve();
    };
    document.getElementById('keyBtn').addEventListener('click', submit);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
    input.focus();
  });
}

// ---- 端末の識別（操作履歴用）。IDは端末ごとにランダムに作って保存する ----
const Device = {
  KEY: 'equipmentLending.deviceId',
  id() {
    try {
      let id = localStorage.getItem(this.KEY);
      if (!id) {
        id = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2)).slice(0, 36);
        localStorage.setItem(this.KEY, id);
      }
      return id;
    } catch (e) {
      return '（保存不可）';
    }
  },
  // 例：iPhone / Safari
  summary() {
    const ua = navigator.userAgent;
    const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android'
      : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'その他';
    const browser = /Line\//.test(ua) ? 'LINE' : /Edg/.test(ua) ? 'Edge' : /CriOS|Chrome\//.test(ua) ? 'Chrome'
      : /FxiOS|Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'その他';
    return os + ' / ' + browser;
  },
  params() {
    return { d: this.id(), dv: this.summary(), ua: navigator.userAgent.slice(0, 300) };
  },
};

const LOGGING_NOTICE = '操作履歴として、端末の種類と端末ごとのIDを記録しています。';

// ---- API呼び出し ----
// credentials: 'omit' で Google のログイン情報を送らない（複数アカウントログイン時のエラーを避ける）
// k（認証キー）を渡したときはキーで、省略したときは通行証で認証する
async function apiGet(params, k) {
  const auth = k ? { k } : { t: sessionToken };
  const query = new URLSearchParams(Object.assign(auth, Device.params(), params));
  const res = await fetch(APP_CONFIG.API_URL + '?' + query, { credentials: 'omit' });
  return parseResponse(res);
}

// Content-Type を text/plain にして CORS のプリフライトを発生させない
async function apiPost(body) {
  const res = await fetch(APP_CONFIG.API_URL, {
    method: 'POST',
    credentials: 'omit',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(Object.assign({ t: sessionToken }, Device.params(), body)),
  });
  return parseResponse(res);
}

async function parseResponse(res) {
  if (!res.ok) throw new Error('サーバーエラー（' + res.status + '）');
  let data;
  try {
    data = await res.json();
  } catch (e) {
    throw new Error('サーバーの応答を読み取れませんでした');
  }
  // 通行証が使えなくなっていたら（キーの変更・期限切れ）、認証キーを入力し直してもらう
  if (data.authError && sessionToken) {
    TokenStore.clear();
    sessionToken = '';
    await alertDialog(data.message);
    location.reload();
    return new Promise(() => {}); // 再読み込みまで待つ
  }
  return data;
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
