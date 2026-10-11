/**
 * Webアプリの入口。URLパラメータで画面を切り替える。
 *   ?id=EQ001            機器画面（使用開始／返却）
 *   ?loc=L01             設置場所ごとの一覧
 *   ?view=list / なし    全機器の一覧
 *   ?page=admin&key=...  QR印刷用の管理画面
 */
function doGet(e) {
  const p = (e && e.parameter) || {};
  let page;
  let data;

  if (p.page === 'admin') {
    page = 'admin';
    data = safeCall_(() => apiGetAdminData(p.key));
  } else if (p.id) {
    page = 'item';
    data = safeCall_(() => apiGetItem(p.id));
  } else {
    page = 'list';
    data = safeCall_(() => apiGetList(p.loc || ''));
  }

  const tpl = HtmlService.createTemplateFromFile(page);
  tpl.bootJson = jsonForScript_({ params: p, data, baseUrl: getBaseUrl_(), appTitle: CONFIG.APP_TITLE });
  return tpl.evaluate()
    .setTitle(CONFIG.APP_TITLE)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** テンプレートから共通部品を読み込む */
function include(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

function safeCall_(fn) {
  try {
    return fn();
  } catch (err) {
    console.error(err);
    return { ok: false, message: err.message };
  }
}

/** <script type="application/json"> 内に埋め込んでも閉じタグで壊れないJSON */
function jsonForScript_(obj) {
  return JSON.stringify(obj)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e');
}

/**
 * WebアプリのURL。スクリプトプロパティ BASE_URL があればそれを優先する
 * （デプロイが複数あって getUrl() が意図しないURLを返す場合の保険）。
 */
function getBaseUrl_() {
  const fixed = PropertiesService.getScriptProperties().getProperty('BASE_URL');
  return fixed || ScriptApp.getService().getUrl();
}

function itemUrl_(base, id) {
  return base + '?id=' + encodeURIComponent(id);
}

function locationUrl_(base, id) {
  return base + '?loc=' + encodeURIComponent(id);
}
