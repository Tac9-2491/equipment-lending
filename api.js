/**
 * API（main.js の doGet / doPost）から呼ぶ処理。
 * 戻り値は { ok: true, ... } か { ok: false, message, conflict?, item?, status? }。
 */

function apiGetItem(id) {
  id = str_(id);
  const eq = getEquipmentList_().find((e) => e.id === id);
  if (!eq) return { ok: false, message: '機器ID「' + id + '」は登録されていません。' };
  if (!eq.enabled) return { ok: false, message: '「' + eq.name + '」は現在利用できません（無効に設定されています）。' };

  const status = readStatus_();
  const row = status.byId[id];
  return { ok: true, item: toItemView_(eq, getLocationMap_()), status: toStatusView_(row) };
}

function apiStartUse(id, name) {
  id = str_(id);
  name = str_(name);
  if (!name) return { ok: false, message: '氏名を入力してください。' };
  if (name.length > CONFIG.NAME_MAX_LENGTH) return { ok: false, message: '氏名は' + CONFIG.NAME_MAX_LENGTH + '文字以内で入力してください。' };

  return withLock_(() => {
    const eq = findEnabledEquipment_(id);
    const locations = getLocationMap_();
    const status = readStatus_();
    const row = ensureStatusRow_(status, id);

    if (str_(row['状態']) === STATE.IN_USE) {
      return {
        ok: false,
        conflict: true,
        message: '他の人が先に使用を開始しました。',
        item: toItemView_(eq, locations),
        status: toStatusView_(row),
      };
    }

    const now = new Date();
    const updated = {
      '機器ID': id,
      '状態': STATE.IN_USE,
      '使用者': safeText_(name),
      '使用開始日時': now,
      '返却日時': '',
      '返却者': '',
      '更新日時': now,
    };
    writeRow_(status.table, row._row, updated);
    appendLog_({
      '記録日時': now,
      '機器ID': id,
      '機器名': eq.name,
      '操作': ACTION.START,
      '使用者': safeText_(name),
      '操作者': safeText_(name),
      '使用開始日時': now,
    });
    return { ok: true, item: toItemView_(eq, locations), status: toStatusView_(updated) };
  });
}

function apiReturn(id, returner) {
  id = str_(id);
  returner = str_(returner).slice(0, CONFIG.NAME_MAX_LENGTH) || UNKNOWN_NAME;

  return withLock_(() => {
    const eq = findEnabledEquipment_(id);
    const locations = getLocationMap_();
    const status = readStatus_();
    const row = ensureStatusRow_(status, id);

    if (str_(row['状態']) !== STATE.IN_USE) {
      return {
        ok: false,
        conflict: true,
        message: 'この機器はすでに返却されています。',
        item: toItemView_(eq, locations),
        status: toStatusView_(row),
      };
    }

    const now = new Date();
    const user = str_(row['使用者']).replace(/^'/, '');
    const startAt = row['使用開始日時'] instanceof Date ? row['使用開始日時'] : '';
    let proxy = '';
    if (returner === UNKNOWN_NAME) proxy = '不明';
    else if (returner !== user) proxy = '○';

    const updated = {
      '機器ID': id,
      '状態': STATE.AVAILABLE,
      '使用者': safeText_(user),
      '使用開始日時': startAt,
      '返却日時': now,
      '返却者': safeText_(returner),
      '更新日時': now,
    };
    writeRow_(status.table, row._row, updated);
    appendLog_({
      '記録日時': now,
      '機器ID': id,
      '機器名': eq.name,
      '操作': ACTION.RETURN,
      '使用者': safeText_(user),
      '操作者': safeText_(returner),
      '使用開始日時': startAt,
      '返却日時': now,
      '利用時間(分)': startAt ? Math.round((now - startAt) / 60000) : '',
      '代理返却': proxy,
    });
    return { ok: true, item: toItemView_(eq, locations), status: toStatusView_(updated) };
  });
}

/** 設置場所IDを渡すとその場所の機器だけ、空なら全機器 */
function apiGetList(locationId) {
  locationId = str_(locationId);
  const locations = getLocationMap_();
  if (locationId && !locations[locationId]) {
    return { ok: false, message: '設置場所ID「' + locationId + '」は登録されていません。' };
  }
  const status = readStatus_();
  const rows = getEquipmentList_()
    .filter((e) => e.enabled && (!locationId || e.locationId === locationId))
    .map((e) => ({ item: toItemView_(e, locations), status: toStatusView_(status.byId[e.id]) }));

  return {
    ok: true,
    location: locationId ? locations[locationId] : null,
    rows,
    updatedAt: formatDate_(new Date()),
  };
}

function apiGetAdminData(key) {
  if (!isAdmin_(key)) return { ok: false, message: '管理キーが正しくありません。' };
  const base = getFrontUrl_();
  const locations = getLocationMap_();
  return {
    ok: true,
    accessKey: PropertiesService.getScriptProperties().getProperty('ACCESS_KEY') || '',
    locations: Object.keys(locations).map((id) => ({ id, name: locations[id].name, url: locationUrl_(base, id) })),
    equipment: getEquipmentList_().map((e) => ({
      id: e.id,
      name: e.name,
      locationName: (locations[e.locationId] || {}).name || e.locationId,
      enabled: e.enabled,
      url: itemUrl_(base, e.id),
    })),
  };
}

function apiWriteUrls(key) {
  if (!isAdmin_(key)) return { ok: false, message: '管理キーが正しくありません。' };
  return Object.assign({ ok: true }, writeUrls_());
}

// ---- 内部処理 ----

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(CONFIG.LOCK_TIMEOUT_MS)) {
    return { ok: false, message: '混み合っています。少し待ってからもう一度お試しください。' };
  }
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function findEnabledEquipment_(id) {
  const eq = getEquipmentList_().find((e) => e.id === id);
  if (!eq) throw new Error('機器ID「' + id + '」は登録されていません。');
  if (!eq.enabled) throw new Error('「' + eq.name + '」は現在利用できません。');
  return eq;
}

function appendLog_(obj) {
  appendRow_(readTable_(SHEET.LOG), obj);
}

/**
 * 認証キーを確認する。問題なければ null、だめならエラー応答を返す。
 * 数字だけのキーは総当たりに弱いので、入力ミスが続いたら一定時間すべての認証を止める。
 */
function checkAccessKey_(k) {
  if (CacheService.getScriptCache().get('authLocked')) {
    return {
      ok: false,
      locked: true,
      message: '認証キーの入力ミスが続いたため、一時的に受け付けを止めています。' + CONFIG.AUTH_LOCK_MIN + '分ほど待ってからもう一度お試しください。',
    };
  }
  if (isAccessKeyValid_(k)) return null;
  if (str_(k)) recordAuthFailure_();
  return authError_();
}

/** 入力ミスを数える。前回のミスから一定時間たつと数え直しになる */
function recordAuthFailure_() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(3000)) return;
  try {
    const cache = CacheService.getScriptCache();
    const count = Number(cache.get('authFailures') || 0) + 1;
    if (count >= CONFIG.AUTH_MAX_FAILURES) {
      cache.put('authLocked', '1', CONFIG.AUTH_LOCK_MIN * 60);
      cache.remove('authFailures');
      console.warn('認証キーの入力ミスが' + count + '回続いたため、' + CONFIG.AUTH_LOCK_MIN + '分間認証を停止しました。');
    } else {
      cache.put('authFailures', String(count), CONFIG.AUTH_FAILURE_WINDOW_MIN * 60);
    }
  } finally {
    lock.releaseLock();
  }
}

/** 認証キーは大文字小文字・前後の空白を区別しない */
function isAccessKeyValid_(k) {
  const expected = PropertiesService.getScriptProperties().getProperty('ACCESS_KEY');
  return !!expected && str_(k).toLowerCase() === expected.toLowerCase();
}

function authError_() {
  return { ok: false, authError: true, message: '認証キーが正しくありません。設置場所に掲示されている認証キーを入力してください。' };
}

function isAdmin_(key) {
  const expected = PropertiesService.getScriptProperties().getProperty('ADMIN_KEY');
  return !!expected && str_(key) === expected;
}

function toItemView_(eq, locations) {
  const loc = locations[eq.locationId];
  return {
    id: eq.id,
    name: eq.name || eq.id,
    locationId: eq.locationId,
    locationName: loc ? loc.name : eq.locationId,
    note: eq.note,
  };
}

function toStatusView_(row) {
  if (!row) return { state: STATE.AVAILABLE, user: '', startAt: '', returnAt: '', returner: '', elapsed: '' };
  const inUse = str_(row['状態']) === STATE.IN_USE;
  const start = row['使用開始日時'];
  return {
    state: inUse ? STATE.IN_USE : STATE.AVAILABLE,
    user: str_(row['使用者']).replace(/^'/, ''),
    startAt: formatDate_(start),
    returnAt: formatDate_(row['返却日時']),
    returner: str_(row['返却者']).replace(/^'/, ''),
    elapsed: inUse && start instanceof Date ? formatDuration_(new Date() - start) : '',
  };
}

function formatDate_(d) {
  return d instanceof Date ? Utilities.formatDate(d, CONFIG.TIMEZONE, CONFIG.DATE_FORMAT) : '';
}

function formatDuration_(ms) {
  const min = Math.max(0, Math.floor(ms / 60000));
  if (min < 60) return min + '分';
  const h = Math.floor(min / 60);
  if (h < 24) return h + '時間' + (min % 60) + '分';
  return Math.floor(h / 24) + '日' + (h % 24) + '時間';
}
