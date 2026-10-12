/**
 * スプレッドシートの読み書き。
 */

/**
 * 初回セットアップ。GASエディタから一度だけ実行する（権限承認も兼ねる）。
 * 何度実行しても既存データは消さない。
 */
function setup() {
  const ss = getSpreadsheet_();
  Object.keys(HEADERS).forEach((name) => ensureSheet_(ss, name));
  removeEmptyDefaultSheet_(ss);

  const props = PropertiesService.getScriptProperties();
  let key = props.getProperty('ADMIN_KEY');
  if (!key) {
    key = Utilities.getUuid().replace(/-/g, '').slice(0, 16);
    props.setProperty('ADMIN_KEY', key);
  }
  let accessKey = props.getProperty('ACCESS_KEY');
  if (!accessKey) {
    accessKey = generateAccessKey_();
    props.setProperty('ACCESS_KEY', accessKey);
  }
  console.log('セットアップ完了: ' + ss.getUrl());
  console.log('管理キー(ADMIN_KEY): ' + key);
  console.log('認証キー(ACCESS_KEY・掲示用): ' + accessKey);
  console.log('管理画面: ' + adminUrl_(getFrontUrl_(), key));
}

/** 掲示用の認証キー。読み間違えやすい文字（0/o, 1/l/i）を除いた英小文字＋数字 */
function generateAccessKey_() {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let key = '';
  for (let i = 0; i < CONFIG.ACCESS_KEY_LENGTH; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
}

function getSpreadsheet_() {
  return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
}

function getSheet_(name) {
  const sheet = getSpreadsheet_().getSheetByName(name);
  if (!sheet) throw new Error('シート「' + name + '」がありません。setup() を実行してください。');
  return sheet;
}

/** シートがなければ作り、足りないヘッダー列を右端に追加する */
function ensureSheet_(ss, name) {
  const headers = HEADERS[name];
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);

  const lastCol = sheet.getLastColumn();
  const current = lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String) : [];
  const missing = headers.filter((h) => current.indexOf(h) === -1);
  if (missing.length) {
    sheet.getRange(1, current.length + 1, 1, missing.length).setValues([missing]);
  }
  const all = current.concat(missing);
  sheet.getRange(1, 1, 1, all.length).setFontWeight('bold').setBackground('#e8eef7');
  sheet.setFrozenRows(1);

  (DATE_COLUMNS[name] || []).forEach((h) => {
    const col = all.indexOf(h) + 1;
    sheet.getRange(2, col, sheet.getMaxRows() - 1, 1).setNumberFormat('yyyy/mm/dd hh:mm');
  });
  return sheet;
}

/** 新規スプレッドシートに最初からある空のシート（シート1 など）を消す */
function removeEmptyDefaultSheet_(ss) {
  const ours = Object.keys(HEADERS);
  ss.getSheets().forEach((sheet) => {
    if (ours.indexOf(sheet.getName()) !== -1) return;
    if (ss.getSheets().length <= 1) return;
    if (sheet.getLastRow() === 0 && sheet.getLastColumn() === 0 && /^(シート|Sheet)\d+$/.test(sheet.getName())) {
      ss.deleteSheet(sheet);
    }
  });
}

/**
 * シートを読み込み、ヘッダー名をキーにしたオブジェクトの配列にする。
 * 各行には書き戻し用に _row（シート上の行番号）を付ける。
 */
function readTable_(name) {
  const sheet = getSheet_(name);
  const values = sheet.getDataRange().getValues();
  const header = (values.shift() || []).map(String);
  const rows = values.map((r, i) => {
    const obj = { _row: i + 2 };
    header.forEach((h, j) => { obj[h] = r[j]; });
    return obj;
  });
  return { sheet, header, rows };
}

/** ヘッダー名→値のオブジェクトを、シートの列順に並べた配列にする */
function toRowValues_(header, obj) {
  return header.map((h) => (obj[h] === undefined ? '' : obj[h]));
}

function writeRow_(table, rowNum, obj) {
  table.sheet.getRange(rowNum, 1, 1, table.header.length).setValues([toRowValues_(table.header, obj)]);
}

function appendRow_(table, obj) {
  table.sheet.appendRow(toRowValues_(table.header, obj));
}

function str_(v) {
  return v === null || v === undefined ? '' : String(v).trim();
}

/** 有効列は空欄なら有効。FALSE / 無効 / 0 などで無効 */
function isEnabled_(v) {
  if (v === false) return false;
  const s = str_(v).toUpperCase();
  return ['FALSE', '0', 'NO', '無効', 'いいえ', '×'].indexOf(s) === -1;
}

function getEquipmentList_() {
  return readTable_(SHEET.EQUIPMENT).rows
    .map((r) => ({
      id: str_(r['機器ID']),
      name: str_(r['機器名']),
      locationId: str_(r['設置場所ID']),
      note: str_(r['備考']),
      enabled: isEnabled_(r['有効']),
    }))
    .filter((e) => e.id);
}

function getLocationMap_() {
  const map = {};
  readTable_(SHEET.LOCATION).rows.forEach((r) => {
    const id = str_(r['設置場所ID']);
    if (id) map[id] = { id, name: str_(r['設置場所名']) || id };
  });
  return map;
}

/** 状態シートを読み込み、機器ID→行オブジェクトのマップを返す */
function readStatus_() {
  const table = readTable_(SHEET.STATUS);
  const byId = {};
  table.rows.forEach((r) => {
    const id = str_(r['機器ID']);
    if (id && !byId[id]) byId[id] = r;
  });
  return { table, byId };
}

/** 状態行がない機器は「空き」として行を追加して返す */
function ensureStatusRow_(status, equipmentId) {
  if (status.byId[equipmentId]) return status.byId[equipmentId];
  const obj = { '機器ID': equipmentId, '状態': STATE.AVAILABLE, '更新日時': new Date() };
  appendRow_(status.table, obj);
  obj._row = status.table.sheet.getLastRow();
  status.byId[equipmentId] = obj;
  return obj;
}

/** 数式として解釈されないように、先頭が = + - @ の文字列はエスケープする */
function safeText_(s) {
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

/** URL列をシートに書き出す */
function writeUrls_() {
  const base = getFrontUrl_();
  const eq = readTable_(SHEET.EQUIPMENT);
  const eqCol = eq.header.indexOf('QR用URL') + 1;
  eq.rows.forEach((r) => {
    const id = str_(r['機器ID']);
    eq.sheet.getRange(r._row, eqCol).setValue(id ? itemUrl_(base, id) : '');
  });
  const loc = readTable_(SHEET.LOCATION);
  const locCol = loc.header.indexOf('一覧URL') + 1;
  loc.rows.forEach((r) => {
    const id = str_(r['設置場所ID']);
    loc.sheet.getRange(r._row, locCol).setValue(id ? locationUrl_(base, id) : '');
  });
  return { equipment: eq.rows.length, locations: loc.rows.length };
}
