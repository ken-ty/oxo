# 再開の手順

2026-09-28 に Firebase プロジェクト `bglab-oxo`（プロジェクト番号 580276432455）を削除し、このリポジトリをアーカイブした。
再開するには Firebase プロジェクトを新しく作り、リポジトリ内のプロジェクト ID と接続設定を差し替える。

## 削除したときの状態

| 項目 | 内容 |
| --- | --- |
| プラン | Spark（無料） |
| Hosting | デフォルトサイト `bglab-oxo.web.app` のみ。独自ドメインなし |
| Realtime Database | `bglab-oxo-default-rtdb`（us-central1）。中身は対戦ルームの一時データ `games` だけ |
| Authentication | 未使用 |
| その他 | Firestore / Storage / Functions は未使用 |

移すべきデータは無い。新しいプロジェクトは空のまま始めてよい。

## 1. リポジトリのアーカイブを解除する

```
gh repo unarchive ken-ty/oxo
```

## 2. Firebase プロジェクトを作る

https://console.firebase.google.com/

- プロジェクト ID は `bglab-oxo` を再利用できない（削除した Google Cloud のプロジェクト ID は再利用できない）。別の ID にする。以下では `<new-id>` と書く
- Google アナリティクスは不要
- **Realtime Database** を作る。ロケーションは以前と同じ us-central1 でよい。ルールは手順 5 で上書きするので、作成時はロックモードでよい
- **Hosting** を有効にする
- 「プロジェクトの設定」→「全般」→「マイアプリ」で **ウェブアプリ** を登録し、表示される `firebaseConfig` を控える

## 3. リポジトリ内のプロジェクト ID と接続設定を差し替える

`bglab-oxo` が書かれている場所は次のとおり。

| ファイル | 変えるもの |
| --- | --- |
| [.firebaserc](../.firebaserc) | `default` を `<new-id>` に |
| [hosting/public/firebase-connect.js](../hosting/public/firebase-connect.js) | `firebaseConfig` を手順 2 で控えた値に丸ごと置き換える |
| [.github/workflows/firebase-hosting-merge.yml](../.github/workflows/firebase-hosting-merge.yml) | `projectId` と、secret 名 `FIREBASE_SERVICE_ACCOUNT_BGLAB_OXO` |
| [.github/workflows/firebase-hosting-pull-request.yml](../.github/workflows/firebase-hosting-pull-request.yml) | 同上 |
| [README.md](../README.md) | 公開 URL |

`firebase-connect.js` の `firebaseConfig` は、削除する前から `apiKey`・`appId`・`messagingSenderId` が別プロジェクトの値だった（API キーは無効）。対戦機能は `databaseURL` だけで動いていたので、見た目には問題が出ていなかった。値は部分的に直さず、コンソールの値で丸ごと置き換える。

```
grep -rn "bglab-oxo\|BGLAB_OXO" --exclude-dir=node_modules --exclude-dir=out --exclude-dir=.next --exclude-dir=docs .
```

これで README の公開終了の告知しか出なくなれば、差し替えは完了している。告知は再開したら消す。

## 4. GitHub Actions からデプロイできるようにする

ワークフローは、GitHub の secret に置いたサービスアカウント鍵でデプロイする。旧プロジェクトの secret `FIREBASE_SERVICE_ACCOUNT_BGLAB_OXO` は使えなくなっている。

```
cd hosting && npx firebase login
npx firebase init hosting:github --project <new-id>
```

`init hosting:github` がサービスアカウントを作り、secret `FIREBASE_SERVICE_ACCOUNT_<NEW_ID>` をリポジトリに登録する。ワークフローの上書きを聞かれたら断り、既存の 2 本の secret 名だけを手で書き換える（既存のワークフローには `npm ci` / `npm run build` と `working-directory: hosting` が入っている）。

旧 secret `FIREBASE_SERVICE_ACCOUNT_BGLAB_OXO` は削除する。

## 5. Realtime Database のルールを反映する

ルールは自動デプロイに含まれないので、手で反映する。

```
cd hosting && npx firebase deploy --only database --project <new-id>
```

## 6. デプロイして確かめる

main にマージすると Hosting へデプロイされる。確認するのは次の 2 点。

- `https://<new-id>.web.app/` が開く
- 2 つのブラウザで同じルームに入り、対戦できる（Realtime Database に繋がっている）

最後に、リポジトリの Homepage を新しい URL に変える。

```
gh repo edit ken-ty/oxo --homepage https://<new-id>.web.app/
```
