# 共用備品 貸出管理

QRコードを読み取るだけで、共用備品の使用開始・返却を記録できるWebアプリです。
Googleアカウントがなくても使えます。データはスプレッドシートに保存します。

## 構成

| 部分 | 置き場所 | 役割 |
|---|---|---|
| 画面 | GitHub Pages（このリポジトリの `docs/`） | HTML/JS。QRコードはこのURLを指す |
| API | Google Apps Script Webアプリ（リポジトリ直下の `*.js`） | スプレッドシートの読み書きを行い、JSONを返す |
| データ | Googleスプレッドシート | マスタ・現在の状態・履歴 |

画面から API への通信では、Google のログイン情報を送りません（`credentials: 'omit'`）。
そのため、ブラウザで複数の Google アカウントにログインしていても開けます（GAS の画面を直接開くと「現在、ファイルを開くことができません」になる問題の回避）。

## 画面

画面のURL：https://tac9-2491.github.io/equipment-lending/

| URL | 画面 |
|---|---|
| `…/?id=機器ID` | 機器画面。空いていれば氏名を入れて使用開始、使用中なら返却（本人以外でも可） |
| `…/?loc=設置場所ID` | 設置場所ごとの状況一覧 |
| `…/` | 全機器の状況一覧 |
| `…/?page=admin&key=管理キー` | QRコード印刷・URL書き出し（管理者用） |

- 氏名は、初回に「名前を登録しますか？」で「はい」を選ぶとその端末に保存され、次回から自動で入力されます。
- 保存した名前は、画面右上の「名前設定」から変更・削除できます。
- 端末への保存にはブラウザの localStorage を使います。プライベートブラウズやブラウザのデータ削除で消えます。

## シート

| シート | 内容 | 編集 |
|---|---|---|
| 備品マスタ | 機器ID / 機器名 / 設置場所ID / 備考 / 有効 / QR用URL | 手入力（QR用URLは自動） |
| 設置場所マスタ | 設置場所ID / 設置場所名 / 一覧URL | 手入力（一覧URLは自動） |
| 現在の状態 | 機器ごとの最新状態 | 自動 |
| 履歴ログ | 使用開始・返却の全記録（代理返却の有無、利用時間つき） | 自動 |

- 「有効」は空欄なら有効です。`FALSE` を入れるとその機器は使えなくなり、一覧にも出ません。
- 機器IDはQRコードのURLに入るので、後から変えないでください（変えた場合はQRを貼り替えます）。
- 管理キーは GAS の「プロジェクトの設定」→「スクリプト プロパティ」の `ADMIN_KEY` にあります。

## セットアップ

1. スプレッドシートIDを [config.js](config.js) の `SPREADSHEET_ID` に設定する
2. `clasp push` でコードを反映し、GASエディタで `setup` を実行して権限を承認する
3. 備品マスタ・設置場所マスタにデータを入力する
4. GAS を Webアプリとしてデプロイする（実行ユーザー：自分、アクセス：全員）
5. デプロイの `…/exec` のURLを [docs/config.js](docs/config.js) の `API_URL` に設定する
6. GitHub のリポジトリ設定で Pages を有効にする（Settings → Pages → Branch: `main` / フォルダ: `/docs`）
7. 画面のURLを [config.js](config.js) の `FRONT_URL` に設定する（シートへのURL書き出しに使う）
8. 管理画面を開いてQRを印刷し、機器と設置場所に貼る

### 現在のデプロイ

- デプロイID：`AKfycbwZ8toQLrrxSsXolNB62qussM-yc6lOTyrCqlbnp7_qvOkBCRX3ujdFVWJi_4XrjXugwA`
- API更新手順（URLを変えずに反映）：

```
clasp push
clasp update-deployment AKfycbwZ8toQLrrxSsXolNB62qussM-yc6lOTyrCqlbnp7_qvOkBCRX3ujdFVWJi_4XrjXugwA --description "変更内容"
```

- 画面（`docs/`）は `git push` すれば GitHub Pages に反映されます（数十秒〜数分）。

## API

| 方式 | 内容 |
|---|---|
| `GET ?action=item&id=…` | 機器の情報と状態 |
| `GET ?action=list&loc=…` | 一覧（`loc` 省略で全機器） |
| `GET ?action=admin&key=…` | 管理画面用データ |
| `POST {"action":"start","id","name"}` | 使用開始 |
| `POST {"action":"return","id","returner"}` | 返却 |
| `POST {"action":"writeUrls","key"}` | マスタにURLを書き出す |

- POST は CORS のプリフライトを避けるため `Content-Type: text/plain` で送ります。
- GAS のURLを `action` なしで開くと、画面（GitHub Pages）への案内ページを返します。

## ファイル構成

| ファイル | 役割 |
|---|---|
| `config.js` | スプレッドシートID・画面URL・シート名・列名などの設定 |
| `main.js` | `doGet` / `doPost`（APIの入口） |
| `api.js` | 使用開始・返却・一覧・管理の処理 |
| `repo.js` | シートの読み書き、`setup` |
| `docs/index.html` | 画面の入口（URLパラメータで画面を切り替え） |
| `docs/config.js` | APIのURL |
| `docs/common.js` | API呼び出し・名前の保存・モーダルなど共通処理 |
| `docs/item.js` / `docs/list.js` / `docs/admin.js` | 各画面 |
| `docs/style.css` | スタイル |
