// 管理画面（?page=admin）：QRコードの印刷とURLの書き出し
// 管理キーは URL（&key=...）か入力画面で受け取り、ブラウザ（タブ）を閉じるまで sessionStorage に保存する
const AdminKeyStore = {
  KEY: 'equipmentLending.adminKey',
  get() {
    try { return sessionStorage.getItem(this.KEY) || ''; } catch (e) { return ''; }
  },
  set(v) {
    try { sessionStorage.setItem(this.KEY, v); } catch (e) { /* 保存できなくてもこのページは使える */ }
  },
  clear() {
    try { sessionStorage.removeItem(this.KEY); } catch (e) { /* 無視 */ }
  },
};

async function initAdminPage(app, keyParam) {
  app.classList.add('wide');
  renderHeader();
  if (keyParam) {
    AdminKeyStore.set(keyParam);
    // アドレスバーとブラウザ履歴に管理キーを残さない
    history.replaceState(null, '', PAGE_BASE + '?page=admin');
  }
  const key = keyParam || AdminKeyStore.get();
  if (!key) {
    showAdminLogin(app);
    return;
  }
  await loadAdminPage(app, key);
}

async function loadAdminPage(app, key) {
  let data;
  try {
    data = await withBusy('読み込み中…', () => apiGet({ action: 'admin', key }));
  } catch (err) {
    app.innerHTML = errorCard('読み込みに失敗しました：' + err.message);
    return;
  }
  if (!data.ok) {
    AdminKeyStore.clear();
    showAdminLogin(app, data.message);
    return;
  }
  AdminKeyStore.set(key);
  renderAdminPage(app, key, data);
}

function showAdminLogin(app, message) {
  app.innerHTML =
    '<div class="card" style="max-width:480px;margin:0 auto">' +
      '<h1>管理者メニュー</h1>' +
      '<p class="muted">管理キーを入力してください。管理キーはスプレッドシートの「設定」シートにあります。</p>' +
      (message ? '<div class="msg error">' + esc(message) + '</div>' : '') +
      '<label class="field" for="adminKeyInput">管理キー</label>' +
      '<input type="password" id="adminKeyInput" autocomplete="off" autocapitalize="off" spellcheck="false">' +
      '<button class="primary" id="adminLoginBtn">開く</button>' +
    '</div>';
  const input = document.getElementById('adminKeyInput');
  const submit = () => {
    const k = input.value.trim();
    if (k) loadAdminPage(app, k);
  };
  document.getElementById('adminLoginBtn').addEventListener('click', submit);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  input.focus();
}

function renderAdminPage(app, key, data) {

  // QRコードには、このページ自身のURLを使う
  app.innerHTML =
    '<div class="card no-print">' +
      '<h1>QRコード印刷</h1>' +
      '<p class="muted">機器と設置場所のQRコードです（認証キーを添えて印刷できます）。ブラウザの印刷機能（Ctrl+P）で印刷し、切り取って貼ってください。無効の機器は印刷されません。</p>' +
      '<p class="muted">認証キーを変えるときは、GASの「プロジェクトの設定」→「スクリプト プロパティ」の ACCESS_KEY を書き換えて、QRラベル（と掲示）を貼り替えてください。全端末で再入力になります。</p>' +
      '<div class="options">' +
        '<label><input type="checkbox" id="optKeyOnLabel" checked> QRに認証キーを添える</label>' +
        '<label><input type="checkbox" id="optKey"> 認証キーの掲示用カード</label>' +
        '<label><input type="checkbox" id="optLoc" checked> 設置場所</label>' +
        '<label><input type="checkbox" id="optEq" checked> 機器</label>' +
        '<label><input type="checkbox" id="optUrl"> URLも印刷する</label>' +
      '</div>' +
      '<div class="row" style="margin-top:12px">' +
        '<button class="small" id="printBtn">印刷する</button>' +
        '<button class="small" id="writeBtn">URLをシートに書き出す</button>' +
        '<span class="spacer"></span>' +
        '<button class="small" id="logoutBtn">ログアウト</button>' +
      '</div>' +
    '</div>' +
    '<section id="secKey" hidden><h2>認証キー（掲示用）</h2><div class="labels">' +
      (data.accessKey
        ? '<div class="label keysign"><div class="sub">' + esc(APP_CONFIG.APP_TITLE) + '</div><div class="sub">認証キー</div>' +
          '<div class="key">' + esc(data.accessKey) + '</div>' +
          '<div class="sub">QRコードを開いたときに入力してください</div></div>'
        : '<p class="muted">認証キーが未設定です。GASエディタで setup を実行してください。</p>') +
    '</div></section>' +
    '<section id="secLoc"><h2>設置場所（状況一覧）</h2><div class="labels">' +
      (data.locations.length
        ? data.locations.map((l) => label(locationUrl(l.id), l.name, '設置場所 ' + l.id + '｜状況一覧', true)).join('')
        : '<p class="muted">設置場所マスタが空です。</p>') +
    '</div></section>' +
    '<section id="secEq"><h2>機器</h2><div class="labels">' +
      (data.equipment.length
        ? data.equipment.map((e) => label(itemUrl(e.id), e.name, e.id + (e.locationName ? '｜' + e.locationName : '') + (e.enabled ? '' : '｜無効'), e.enabled)).join('')
        : '<p class="muted">備品マスタが空です。</p>') +
    '</div></section>';

  document.querySelectorAll('.qr[data-url]').forEach((el) => { el.innerHTML = qrSvg(el.dataset.url); });
  const optKeyOnLabel = document.getElementById('optKeyOnLabel');
  const syncKeyOnLabel = () => document.body.classList.toggle('hide-label-key', !optKeyOnLabel.checked);
  optKeyOnLabel.addEventListener('change', syncKeyOnLabel);
  syncKeyOnLabel();
  document.getElementById('optKey').addEventListener('change', (e) => { document.getElementById('secKey').hidden = !e.target.checked; });
  document.getElementById('optLoc').addEventListener('change', (e) => { document.getElementById('secLoc').hidden = !e.target.checked; });
  document.getElementById('optEq').addEventListener('change', (e) => { document.getElementById('secEq').hidden = !e.target.checked; });
  const optUrl = document.getElementById('optUrl');
  const syncUrl = () => document.body.classList.toggle('hide-url', !optUrl.checked);
  optUrl.addEventListener('change', syncUrl);
  syncUrl();
  document.getElementById('printBtn').addEventListener('click', () => window.print());
  document.getElementById('writeBtn').addEventListener('click', writeUrls);
  document.getElementById('logoutBtn').addEventListener('click', () => {
    AdminKeyStore.clear();
    showAdminLogin(app);
  });

  function label(url, name, sub, enabled) {
    return '<div class="label' + (enabled ? '' : ' disabled') + '">' +
      '<div class="qr" data-url="' + esc(url) + '"></div>' +
      '<div class="name">' + esc(name) + '</div>' +
      '<div class="sub">' + esc(sub) + '</div>' +
      (data.accessKey ? '<div class="label-key">認証キー <strong>' + esc(data.accessKey) + '</strong></div>' : '') +
      '<div class="url">' + esc(url) + '</div>' +
    '</div>';
  }

  function qrSvg(url) {
    if (typeof qrcode !== 'function') return '<div class="muted">QRライブラリを読み込めませんでした</div>';
    const qr = qrcode(0, 'M');
    qr.addData(url);
    qr.make();
    return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  }

  async function writeUrls() {
    try {
      const res = await withBusy('書き出し中…', () => apiPost({ action: 'writeUrls', key }));
      alertDialog(res.ok ? 'シートにURLを書き出しました（機器 ' + res.equipment + ' 件、設置場所 ' + res.locations + ' 件、「設定」シートも更新）。' : res.message);
    } catch (err) {
      alertDialog('通信エラー：' + err.message);
    }
  }
}
