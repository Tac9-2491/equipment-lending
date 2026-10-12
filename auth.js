/**
 * 認証キーと通行証（トークン）。
 *
 * - 正しい認証キーを入力した端末には通行証を発行し、以後は通行証で認証する（有効期限つき）。
 *   通行証は「端末ID・有効期限・認証キー」の署名なので、キーを変えると全端末の通行証が無効になる。
 * - 認証キーの入力ミスは端末ごとに数え、続いたらその端末だけキー入力を止める。
 * - 端末IDは画面側の申告で、変えながら総当たりされうるため、全体のミスが多すぎるときは
 *   新しい端末からのキー入力も止める。通行証を持つ登録済みの端末はその間も使える。
 */

/** 通行証かキーを確認する。問題なければ null、だめならエラー応答を返す */
function checkAccess_(k, token) {
  const deviceId = REQUEST_CONTEXT.deviceId;
  if (token && isTokenValid_(token, deviceId)) return null;

  const cache = CacheService.getScriptCache();
  if (cache.get(deviceLockKey_(deviceId))) return lockedError_('device');
  if (cache.get('authLockAll')) return lockedError_('all');
  if (isAccessKeyValid_(k)) return null;
  if (str_(k)) {
    const locked = recordAuthFailure_(deviceId);
    if (locked) return lockedError_(locked);
  }
  return token ? tokenError_() : authError_();
}

/** 端末IDを申告しないリクエストは、まとめて1台として数える */
function deviceLockKey_(deviceId) {
  return 'authLock:' + (deviceId || '(なし)');
}

function deviceFailKey_(deviceId) {
  return 'authFail:' + (deviceId || '(なし)');
}

/**
 * 入力ミスを数える（前回のミスから一定時間たつと数え直し）。
 * ロックをかけたら 'device'（その端末）か 'all'（新しい端末すべて）、かけなければ null
 */
function recordAuthFailure_(deviceId) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(3000)) return null;
  try {
    const cache = CacheService.getScriptCache();
    const windowSec = CONFIG.AUTH_FAILURE_WINDOW_MIN * 60;
    const lockSec = CONFIG.AUTH_LOCK_MIN * 60;
    let result = null;

    const all = Number(cache.get('authFailAll') || 0) + 1;
    if (all >= CONFIG.AUTH_GLOBAL_MAX_FAILURES) {
      cache.put('authLockAll', '1', lockSec);
      cache.remove('authFailAll');
      console.warn('認証キーの入力ミスが全体で' + all + '回続いたため、新しい端末からの入力を' + CONFIG.AUTH_LOCK_MIN + '分間停止しました。');
      result = 'all';
    } else {
      cache.put('authFailAll', String(all), windowSec);
    }

    const failKey = deviceFailKey_(deviceId);
    const count = Number(cache.get(failKey) || 0) + 1;
    if (count >= CONFIG.AUTH_DEVICE_MAX_FAILURES) {
      cache.put(deviceLockKey_(deviceId), '1', lockSec);
      cache.remove(failKey);
      result = result || 'device';
    } else {
      cache.put(failKey, String(count), windowSec);
    }
    return result;
  } finally {
    lock.releaseLock();
  }
}

function lockedError_(scope) {
  const wait = CONFIG.AUTH_LOCK_MIN + '分ほど待ってからもう一度お試しください。';
  return {
    ok: false,
    locked: true,
    message: scope === 'all'
      ? '入力ミスが多数発生しているため、新しい端末からの認証キーの入力を一時的に止めています。' + wait
      : 'この端末で認証キーの入力ミスが続いたため、一時的に入力を止めています。' + wait,
  };
}

/** 認証キーは大文字小文字・前後の空白を区別しない */
function isAccessKeyValid_(k) {
  const expected = PropertiesService.getScriptProperties().getProperty('ACCESS_KEY');
  return !!expected && str_(k).toLowerCase() === expected.toLowerCase();
}

function authError_() {
  return { ok: false, authError: true, message: '認証キーが正しくありません。QRラベルに記載されている認証キーを入力してください。' };
}

/** 通行証が期限切れ・キー変更などで使えないとき */
function tokenError_() {
  return { ok: false, authError: true, message: '認証の有効期限が切れたか、認証キーが変更されました。認証キーを入力し直してください。' };
}

// ---- 通行証 ----

/** 通行証を発行する。形式は「有効期限(ミリ秒).署名」 */
function issueToken_(deviceId) {
  const expiresAt = Date.now() + CONFIG.ACCESS_TOKEN_DAYS * 24 * 60 * 60 * 1000;
  return expiresAt + '.' + signToken_(deviceId, expiresAt);
}

function isTokenValid_(token, deviceId) {
  const parts = str_(token).split('.');
  if (parts.length !== 2 || !deviceId) return false;
  const expiresAt = Number(parts[0]);
  if (!expiresAt || expiresAt < Date.now()) return false;
  return parts[1] === signToken_(deviceId, expiresAt);
}

function signToken_(deviceId, expiresAt) {
  const accessKey = PropertiesService.getScriptProperties().getProperty('ACCESS_KEY') || '';
  const bytes = Utilities.computeHmacSha256Signature(deviceId + ':' + expiresAt + ':' + accessKey, getTokenSecret_());
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, '');
}

/** 署名用の秘密の値。なければ作ってスクリプトプロパティに保存する */
function getTokenSecret_() {
  const props = PropertiesService.getScriptProperties();
  let secret = props.getProperty('TOKEN_SECRET');
  if (!secret) {
    secret = Utilities.getUuid() + Utilities.getUuid();
    props.setProperty('TOKEN_SECRET', secret);
  }
  return secret;
}
