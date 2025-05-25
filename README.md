# oxo

上田悠 の 作品。アブストラクトゲーム。

https://bglab-oxo.web.app/


## 開発

技術:

- JavaScript
- HTML
- CSS
- Firebase Realtime Database (対戦機能)

ローカルテスト:

```
cd hosting && npm run dev
```

デプロイ:

main にマージすると自動でデプロイされます。

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
