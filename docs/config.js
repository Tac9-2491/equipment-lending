// GAS Webアプリ（API）のURL。デプロイIDが変わったらここを書き換える
const APP_CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbwZ8toQLrrxSsXolNB62qussM-yc6lOTyrCqlbnp7_qvOkBCRX3ujdFVWJi_4XrjXugwA/exec',
  APP_TITLE: '備品貸出管理',
  // 認証キーを入れた端末が再入力なしで使える日数（画面の表示用。実際の期限は GAS の config.js の ACCESS_TOKEN_DAYS）
  ACCESS_KEY_DAYS: 30,
};
