/**
 * 設定値。シート名・列名を変えるときはここだけ直す。
 */
const CONFIG = {
  SPREADSHEET_ID: '14ooLUZlIW29LYdwHNnbiLxlyfmVlUmbD6rWaqgOSBxk',
  TIMEZONE: 'Asia/Tokyo',
  DATE_FORMAT: 'yyyy/MM/dd HH:mm',
  APP_TITLE: '備品貸出管理',
  NAME_MAX_LENGTH: 50,
  LOCK_TIMEOUT_MS: 10000,
};

const SHEET = {
  EQUIPMENT: '備品マスタ',
  LOCATION: '設置場所マスタ',
  STATUS: '現在の状態',
  LOG: '履歴ログ',
};

const HEADERS = {
  [SHEET.EQUIPMENT]: ['機器ID', '機器名', '設置場所ID', '備考', '有効', 'QR用URL'],
  [SHEET.LOCATION]: ['設置場所ID', '設置場所名', '一覧URL'],
  [SHEET.STATUS]: ['機器ID', '状態', '使用者', '使用開始日時', '返却日時', '返却者', '更新日時'],
  [SHEET.LOG]: ['記録日時', '機器ID', '機器名', '操作', '使用者', '操作者', '使用開始日時', '返却日時', '利用時間(分)', '代理返却'],
};

// 日時の表示形式を設定する列
const DATE_COLUMNS = {
  [SHEET.STATUS]: ['使用開始日時', '返却日時', '更新日時'],
  [SHEET.LOG]: ['記録日時', '使用開始日時', '返却日時'],
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
