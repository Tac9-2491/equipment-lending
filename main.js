/**
 * Webアプリの入口。画面は GitHub Pages（docs/）にあり、ここは JSON を返す API だけを担う。
 * 画面からの通信には Google のログイン情報が付かないため、複数アカウントでログインしていても使える。
 *
 * 読み取り（GET）  ?action=item&id=EQ001 / ?action=list&loc=L01 / ?action=admin&key=...
 * 書き込み（POST） 本文 {"action":"start"|"return"|"writeUrls", ...}
 *   POST は CORS のプリフライトを避けるため Content-Type: text/plain で送る。
 */
function doGet(e) {
  const p = (e && e.parameter) || {};
  if (!p.action) return movedPage_(p);

  return respond_(() => {
    switch (p.action) {
      case 'item': return apiGetItem(p.id);
      case 'list': return apiGetList(p.loc || '');
      case 'admin': return apiGetAdminData(p.key);
      default: return { ok: false, message: '不明な操作です: ' + p.action };
    }
  });
}

function doPost(e) {
  return respond_(() => {
    let body;
    try {
      body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    } catch (err) {
      return { ok: false, message: 'リクエストの形式が正しくありません。' };
    }
    switch (body.action) {
      case 'start': return apiStartUse(body.id, body.name);
      case 'return': return apiReturn(body.id, body.returner);
      case 'writeUrls': return apiWriteUrls(body.key);
      default: return { ok: false, message: '不明な操作です: ' + body.action };
    }
  });
}

function respond_(fn) {
  let result;
  try {
    result = fn();
  } catch (err) {
    console.error(err);
    result = { ok: false, message: err.message };
  }
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

/** 旧URL（GASのURLを直接開いた場合）は新しい画面へ案内する */
function movedPage_(p) {
  const query = Object.keys(p).map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(p[k])).join('&');
  const url = getFrontUrl_() + (query ? '?' + query : '');
  const safe = url.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  return HtmlService.createHtmlOutput(
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<p style="font-family:sans-serif;padding:16px">このページは移動しました。<br>' +
    '<a href="' + safe + '" target="_top">新しいページを開く</a></p>'
  ).setTitle('備品貸出管理');
}

/** 画面のURL。スクリプトプロパティ FRONT_URL があればそれを優先する */
function getFrontUrl_() {
  const fixed = PropertiesService.getScriptProperties().getProperty('FRONT_URL');
  return fixed || CONFIG.FRONT_URL;
}

function itemUrl_(base, id) {
  return base + '?id=' + encodeURIComponent(id);
}

function locationUrl_(base, id) {
  return base + '?loc=' + encodeURIComponent(id);
}

function adminUrl_(base, key) {
  return base + '?page=admin&key=' + encodeURIComponent(key);
}
