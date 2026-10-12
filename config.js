/**
 * 設定値。シート名・列名を変えるときはここだけ直す。
 */
const CONFIG = {
  SPREADSHEET_ID: '14ooLUZlIW29LYdwHNnbiLxlyfmVlUmbD6rWaqgOSBxk',
  // 画面（GitHub Pages）のURL。QRコードにはこのURLが入る
  FRONT_URL: 'https://tac9-2491.github.io/equipment-lending/',
  TIMEZONE: 'Asia/Tokyo',
  DATE_FORMAT: 'yyyy/MM/dd HH:mm',
  NAME_MAX_LENGTH: 50,
  LOCK_TIMEOUT_MS: 10000,
  ACCESS_KEY_LENGTH: 6,         // 認証キー（数字）の桁数
  AUTH_MAX_FAILURES: 20,        // 認証キーの入力ミスがこの回数続いたら（間隔が10分以内）
  AUTH_FAILURE_WINDOW_MIN: 10,
  AUTH_LOCK_MIN: 30,            // この分数、すべての認証を止める（総当たり対策）
  ACCESS_LOG_RETENTION_DAYS: 365, // アクセスログの保存日数。過ぎた行は毎日自動で削除
};

const SHEET = {
  EQUIPMENT: '備品マスタ',
  LOCATION: '設置場所マスタ',
  STATUS: '現在の状態',
  LOG: '履歴ログ',
  SETTINGS: '設定',
  ACCESS_LOG: 'アクセスログ',
};

const HEADERS = {
  [SHEET.EQUIPMENT]: ['機器ID', '機器名', '設置場所ID', '備考', '有効', 'QR用URL'],
  [SHEET.LOCATION]: ['設置場所ID', '設置場所名', '一覧URL'],
  [SHEET.STATUS]: ['機器ID', '状態', '使用者', '使用開始日時', '返却日時', '返却者', '更新日時'],
  [SHEET.LOG]: ['記録日時', '機器ID', '機器名', '操作', '使用者', '操作者', '使用開始日時', '返却日時', '利用時間(分)', '代理返却', '端末ID'],
  [SHEET.ACCESS_LOG]: ['日時', '種別', '結果', '対象', '氏名', '端末ID', '端末', 'UA', '詳細'],
};

// 日時の表示形式を設定する列
const DATE_COLUMNS = {
  [SHEET.STATUS]: ['使用開始日時', '返却日時', '更新日時'],
  [SHEET.LOG]: ['記録日時', '使用開始日時', '返却日時'],
  [SHEET.ACCESS_LOG]: ['日時'],
};

const STATE = {
  AVAILABLE: '空き',
  IN_USE: '使用中',
};

const ACTION = {
  START: '使用開始',
  RETURN: '返却',
};

const UNKNOWN_NAME = '（未入力）';
