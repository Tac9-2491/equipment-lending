// 管理画面（?page=admin&key=...）：QRコードの印刷とURLの書き出し
async function initAdminPage(app, key) {
  app.classList.add('wide');
  renderHeader();

  let data;
  try {
    data = await apiGet({ action: 'admin', key });
  } catch (err) {
    app.innerHTML = errorCard('読み込みに失敗しました：' + err.message);
    return;
  }
  if (!data.ok) {
    app.innerHTML = errorCard(data.message);
    return;
  }

  // QRコードには、このページ自身のURLを使う
  app.innerHTML =
    '<div class="card no-print">' +
      '<h1>QRコード印刷</h1>' +
      '<p class="muted">機器と設置場所のQRコード、認証キーの掲示用カードです。ブラウザの印刷機能（Ctrl+P）で印刷し、切り取って貼ってください。無効の機器は印刷されません。</p>' +
      '<p class="muted">認証キーを変えるときは、GASの「プロジェクトの設定」→「スクリプト プロパティ」の ACCESS_KEY を書き換えて、掲示を貼り替えてください。全端末で再入力になります。</p>' +
      '<div class="options">' +
        '<label><input type="checkbox" id="optKey" checked> 認証キー</label>' +
        '<label><input type="checkbox" id="optLoc" checked> 設置場所</label>' +
        '<label><input type="checkbox" id="optEq" checked> 機器</label>' +
        '<label><input type="checkbox" id="optUrl"> URLも印刷する</label>' +
      '</div>' +
      '<div class="row" style="margin-top:12px">' +
        '<button class="small" id="printBtn">印刷する</button>' +
        '<button class="small" id="writeBtn">URLをシートに書き出す</button>' +
      '</div>' +
    '</div>' +
    '<section id="secKey"><h2>認証キー（掲示用）</h2><div class="labels">' +
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
  document.getElementById('optKey').addEventListener('change', (e) => { document.getElementById('secKey').hidden = !e.target.checked; });
  document.getElementById('optLoc').addEventListener('change', (e) => { document.getElementById('secLoc').hidden = !e.target.checked; });
  document.getElementById('optEq').addEventListener('change', (e) => { document.getElementById('secEq').hidden = !e.target.checked; });
  const optUrl = document.getElementById('optUrl');
  const syncUrl = () => document.body.classList.toggle('hide-url', !optUrl.checked);
  optUrl.addEventListener('change', syncUrl);
  syncUrl();
  document.getElementById('printBtn').addEventListener('click', () => window.print());
  document.getElementById('writeBtn').addEventListener('click', writeUrls);

  function label(url, name, sub, enabled) {
    return '<div class="label' + (enabled ? '' : ' disabled') + '">' +
      '<div class="qr" data-url="' + esc(url) + '"></div>' +
      '<div class="name">' + esc(name) + '</div>' +
      '<div class="sub">' + esc(sub) + '</div>' +
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
      alertDialog(res.ok ? 'シートにURLを書き出しました（機器 ' + res.equipment + ' 件、設置場所 ' + res.locations + ' 件）。' : res.message);
    } catch (err) {
      alertDialog('通信エラー：' + err.message);
    }
  }
}
