# Google Apps Script 同期サーバー

論証集アプリの Google Drive 同期を完全に自動化するためのバックエンドです。

## 概要

- 初回だけ Google 権限を許可
- 更新トークンを GAS 側で安全に保管
- 以降は自動でアクセストークンを更新し、同期を処理
- アプリからは GAS の Web アプリ URL を呼び出すだけ

## 手順

### 1. スクリプトのデプロイ

1. https://script.google.com/ で「新しいプロジェクト」
2. 以下のコードを `Code.gs` へ貼り付け
3. 「デプロイ」→「新しいデプロイ」→「ウェブアプリ」
4. 説明：`ronsho-app-sync`
5. 実行時の権限：「自分」
6. アクセス権：「自分」
7. デプロイ後、表示される URL を控える

### 2. 初回接続

1. デプロイした URL をブラウザで開く
2. Google 権限を許可する
3. 同期用ファイル `ronsho-app-sync-v1.json` が Drive に作成される

### 3. アプリ側設定

`index.html` の同期エンドポイントを GAS の Web アプリ URL へ変更する（今後実装予定）。

## セキュリティ

- 更新トークンは GAS の `PropertiesService.getUserProperties()` で保管
- アプリからはトークンを扱わず、同期データのみをやり取り
- アクセス権は「自分」のみ

## 利用 API

- `GET /?action=get`：Drive から最新データ取得
- `POST /?action=push`：Drive へデータ保存
