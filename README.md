# 共用備品 貸出管理

QRコードを読み取るだけで、共用備品の使用開始・返却を記録できる Google Apps Script Webアプリです。
Googleアカウントがなくても使えます。データはスプレッドシートに保存します。

## 画面

| URL | 画面 |
|---|---|
| `…/exec?id=機器ID` | 機器画面。空いていれば氏名を入れて使用開始、使用中なら返却（本人以外でも可） |
| `…/exec?loc=設置場所ID` | 設置場所ごとの状況一覧 |
| `…/exec` | 全機器の状況一覧 |
| `…/exec?page=admin&key=管理キー` | QRコード印刷・URL書き出し（管理者用） |

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

## セットアップ

1. スプレッドシートIDを [config.js](config.js) の `SPREADSHEET_ID` に設定する
2. `clasp push` でコードを反映する
3. GASエディタで `setup` を実行し、権限を承認する。実行ログに管理キーが出る
   - 4つのシートが作られ、管理キーがスクリプトプロパティ `ADMIN_KEY` に保存される
4. 備品マスタ・設置場所マスタにデータを入力する
5. Webアプリとしてデプロイする（実行ユーザー：自分、アクセス：全員）
   - 初回：GASエディタの「デプロイ」→「新しいデプロイ」、または `clasp create-deployment`
   - 更新：`clasp push` のあと `clasp update-deployment <デプロイID>`（URLを変えないため）
6. 管理画面を開いてQRを印刷し、機器と設置場所に貼る。「URLをシートに書き出す」で各マスタにURLも残せる

### 現在のデプロイ

- デプロイID：`AKfycbwZ8toQLrrxSsXolNB62qussM-yc6lOTyrCqlbnp7_qvOkBCRX3ujdFVWJi_4XrjXugwA`
- URL：https://script.google.com/macros/s/AKfycbwZ8toQLrrxSsXolNB62qussM-yc6lOTyrCqlbnp7_qvOkBCRX3ujdFVWJi_4XrjXugwA/exec
- 更新手順（URLを変えずに反映）：

```
clasp push
clasp update-deployment AKfycbwZ8toQLrrxSsXolNB62qussM-yc6lOTyrCqlbnp7_qvOkBCRX3ujdFVWJi_4XrjXugwA --description "変更内容"
```

### WebアプリのURLがずれる場合

デプロイが複数あると、QRに入るURLが意図したものにならないことがあります。
その場合はスクリプトプロパティ `BASE_URL` に、使いたいデプロイの `…/exec` のURLを設定してください。

## ファイル構成

| ファイル | 役割 |
|---|---|
| `config.js` | スプレッドシートID・シート名・列名などの設定 |
| `main.js` | `doGet`（URLパラメータで画面を切り替える） |
| `api.js` | 画面から呼ぶ処理（使用開始・返却・一覧・管理） |
| `repo.js` | シートの読み書き、`setup` |
| `item.html` / `list.html` / `admin.html` | 各画面 |
| `css.html` / `common_js.html` | 共通スタイル・共通スクリプト |
