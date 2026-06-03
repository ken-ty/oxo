# oxo

上田悠 の 作品。アブストラクトゲーム。

https://bglab-oxo.web.app/


## 開発

技術:

- JavaScript
- HTML
- CSS
- Firebase Realtime Database (対戦機能)

### ローカル開発

依存をインストールします（Node は `.tool-versions` のバージョンを利用）。

```
cd hosting && npm install
```

ローカルでは本番DBを汚さないよう、`localhost` アクセス時は自動で Realtime Database emulator に接続します。対戦機能を試すには emulator とアプリの**両方**を起動してください（別々のターミナルで）。

```
# ターミナル1: emulator（127.0.0.1:9000 / UI は http://127.0.0.1:4000）
cd hosting && npm run emulators

# ターミナル2: アプリ（http://localhost:3000）
cd hosting && npm run dev
```

ブラウザのコンソールに `[OXO] Realtime Database emulator に接続しました` が出れば emulator に繋がっています。emulator を起動せずに `npm run dev` すると、対戦機能は接続先が無くエラーになります。

> 接続先まとめ: `localhost`（`npm run dev`）→ ローカル emulator / 本番（bglab-oxo.web.app）→ 本番 RTDB

### デプロイ

main にマージすると Hosting が自動でデプロイされます。

Realtime Database のセキュリティルール（[database.rules.json](database.rules.json)）は自動デプロイに含まれないため、変更時は手動で反映してください。

```
npx firebase deploy --only database
```

## ルール

- 先手は黒、交互に2つずつコマを置きます。
- 1つ目のコマを置いた後、縦・横・斜めの軸に線対称となる位置に2つ目を置きます。
- 中央には白いコマが初めから置かれています。
- 以下の形を作ると勝ちです：
  - 2×2の正方形
  - 十字形（縦横 or 斜め）

## テスト

```
cd hosting && npm run test
```
