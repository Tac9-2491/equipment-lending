/**
 * アクセスログ（すべてのAPIリクエスト）と、端末の識別情報。
 * GAS ではアクセス元のIPアドレスを取得できないため、画面側が作る端末IDと端末の種類を記録する。
 * どちらも画面側の申告なので偽装は可能。社内での追跡の手がかりとして使う。
 */

// リクエストごとの端末情報。GAS は1リクエスト＝1実行なので、グローバル変数で受け渡す
let REQUEST_CONTEXT = { deviceId: '', device: '', ua: '' };

/** GET のパラメータ／POST の本文から端末情報を取り出す（d: 端末ID, dv: 端末の種類, ua: User-Agent） */
function setRequestContext_(p) {
  REQUEST_CONTEXT = {
    deviceId: str_(p.d).slice(0, 64),
    device: str_(p.dv).slice(0, 100),
    ua: str_(p.ua).slice(0, 300),
  };
}

const ACTION_LABEL = {
  verify: '認証キー入力',
  item: '閲覧（機器）',
  list: '閲覧（一覧）',
  start: '使用開始',
  return: '返却',
  admin: '管理者メニュー',
  writeUrls: 'URL書き出し',
};

function logRequest_(action, args, result) {
  try {
    let target = '';
    if (args.id) target = str_(args.id);
    else if (action === 'list') target = str_(args.loc) || '（全機器）';

    let status = '成功';
    if (result.locked) status = 'ロック中';
    else if (result.authError) status = '認証失敗';
    else if (result.conflict) status = '競合';
    else if (!result.ok) status = 'エラー';

    let name = '';
    if (action === 'start') name = str_(args.name);
    else if (action === 'return') name = str_(args.returner);

    appendRow_(readTable_(SHEET.ACCESS_LOG), {
      '日時': new Date(),
      '種別': ACTION_LABEL[action] || '不明な操作: ' + str_(action).slice(0, 30),
      '結果': status,
      '対象': safeText_(target.slice(0, 50)),
      '氏名': safeText_(name.slice(0, CONFIG.NAME_MAX_LENGTH)),
      '端末ID': safeText_(REQUEST_CONTEXT.deviceId),
      '端末': safeText_(REQUEST_CONTEXT.device),
      'UA': safeText_(REQUEST_CONTEXT.ua),
      '詳細': result.ok ? '' : safeText_(str_(result.message)),
    });
  } catch (err) {
    // ログの失敗で本来の処理を止めない
    console.error('アクセスログの記録に失敗: ' + err.message);
  }
}

/** 保存期間を過ぎたアクセスログを削除する。毎日のトリガーから呼ばれる */
function purgeOldAccessLogs() {
  const sheet = getSheet_(SHEET.ACCESS_LOG);
  const last = sheet.getLastRow();
  if (last < 2) return;
  const cutoff = new Date(Date.now() - CONFIG.ACCESS_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  // 行は古い順に並んでいるので、期限内の最初の行までをまとめて消す
  const dates = sheet.getRange(2, 1, last - 1, 1).getValues();
  let count = 0;
  while (count < dates.length && dates[count][0] instanceof Date && dates[count][0] < cutoff) count++;
  if (count > 0) {
    sheet.deleteRows(2, count);
    console.log('古いアクセスログを ' + count + ' 行削除しました。');
  }
}

/** purgeOldAccessLogs を毎日（午前3時台）実行するトリガーを、なければ作る */
function ensurePurgeTrigger_() {
  const exists = ScriptApp.getProjectTriggers().some((t) => t.getHandlerFunction() === 'purgeOldAccessLogs');
  if (!exists) {
    ScriptApp.newTrigger('purgeOldAccessLogs').timeBased().everyDays(1).atHour(3).create();
  }
}
