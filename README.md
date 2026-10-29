# 焼き鳥注文・呼び出し管理システム

文化祭の模擬店向けの、注文管理と呼び出しのシステムです。レジ・厨房・呼び出しモニター・集計の画面を複数の端末で同時に使え、どの端末で操作しても他の端末に 1 秒ほどで反映されます。

混雑時の「整理券番号の重複」「呼び出しが聞こえない」「売上の計算ミス」を防ぎます。

## 画面

| パス | 画面 | 置き場所 | 内容 |
|---|---|---|---|
| `/` | 呼び出しモニター | 店頭のモニター / タブレット | 「調理中」「お渡し可能」の番号を表示 |
| `/register` | レジ | レジカウンター | 本数の入力と会計（半額会計あり）、整理券番号の発行、会計ミスの取消、受け渡し完了 |
| `/kitchen` | 厨房 | 調理場 | 注文内容（タレ・塩の本数）の確認と「呼出中」への切り替え。押し間違えたら戻せる |
| `/admin` | 集計 | 会計担当 | 総売上・品目別本数・受け渡し履歴、整理券番号のリセット |

## 構成

```
 [各端末のブラウザ]
   │  ① 画面: CloudFront ──► S3（ビルド済みの静的ファイル）
   │  ② 書き込み・取得: HTTPS
   ▼
 API Gateway (HTTP) ──► Lambda: api ──► DynamoDB ── Streams ──► Lambda: broadcast
                                         ├ orders（注文）                │
                                         ├ meta（採番・集計）            │ ③ 全端末へ即時通知
                                         └ connections（WS 接続）        ▼
 [各端末のブラウザ] ◄──────────── WebSocket ◄──── API Gateway (WebSocket)
```

- フロント: Next.js（App Router / TypeScript、静的エクスポート）、Tailwind CSS
- バックエンド: AWS（API Gateway・Lambda・DynamoDB・S3・CloudFront）、Terraform で構築
- 整理券番号はアトミックカウンタで採番するので、レジ 2 台で同時に会計しても番号は重なりません。
- 同じ注文を 2 台で同時に操作したときは、後の操作をサーバーが止めます（二重処理しない）。
- 単価・合計はサーバー側で計算します。
- 接続が切れても自動でつなぎ直し、その間の変更を取り直します。

API の詳細は [`correction.md`](correction.md) を参照してください。

## ローカルで動かす

```bash
npm install
npm run dev   # http://localhost:3000
```

`.env.local` が無いときは、ブラウザの localStorage だけで動く**ローカル版**になります。同じブラウザのタブ間では同期しますが、別の端末とは共有されません。画面の確認用です。

## 公開（AWS）

前提: AWS CLI でログイン済み（`aws sts get-caller-identity` が通る）、Terraform 1.6 以上。

### 1. バックエンドを作る（最初の 1 回）

```bash
cd infra
cp terraform.tfvars.example terraform.tfvars   # staff_token（長いランダム文字列）と alert_email を書く
terraform init
terraform apply
```

### 2. 画面をビルドしてアップロード

```bash
cd ..
cat > .env.local <<ENV
NEXT_PUBLIC_API_URL=$(terraform -chdir=infra output -raw http_api_url)
NEXT_PUBLIC_WS_URL=$(terraform -chdir=infra output -raw ws_url)
ENV
npm run build
aws s3 sync out/ s3://$(terraform -chdir=infra output -raw site_bucket) --delete
aws cloudfront create-invalidation --distribution-id $(terraform -chdir=infra output -raw distribution_id) --paths "/*"
terraform -chdir=infra output site_url        # これが公開 URL
```

画面だけを直したときは手順 2 だけ、`infra/` を変えたときは手順 1 からやり直します。

**自動デプロイ**: main にプッシュすると GitHub Actions（`.github/workflows/deploy.yml`）が手順 2 を自動で行います（`infra/` と `.md` だけの変更では動きません。Actions タブの「Run workflow」で手動実行もできます）。AWS には OIDC で入るので、GitHub に鍵は置きません。`infra/` の変更は自動では反映されないので、手順 1 の `terraform apply` は手元で行います。infra を作り直して URL やバケット名が変わったときは、ワークフロー内の値を `terraform -chdir=infra output` の値に書き換えてください。

### 3. 端末の準備

各端末で最初に開いたときに、スタッフ用トークン（`staff_token`）の入力を求められます。`https://<site_url>/kitchen?token=<staff_token>` のようにトークンを付けた URL を開けば入力しなくて済みます（QR コードで配ると便利です）。トークンはその端末に保存されます。

URL を知っていれば誰でも画面は開けますが、トークンが無いと注文の表示も操作もできません。QR コードはお客さんの目に触れない場所で扱ってください。

## 当日の運用

- **番号のリセット**: `/admin` の「整理券番号のリセット」で、次の番号が #001 に戻ります（注文と売上は消えません）。日をまたぐときに使います。
- **回線が落ちたとき**: 復旧すれば自動でつなぎ直します。念のため紙の伝票とテザリング用のスマホを用意してください。
- **費用**: 使った分だけの課金で、文化祭の数日なら数十〜数百円程度の見込みです。`budget_usd`（既定 10 ドル）の 8 割を超えると `alert_email` にメールが届きます。
- **片付け**: CSV（`GET /export.csv`）を保存してから、`terraform.tfvars` に `protect_data = false` を書いて `terraform apply` し、最後に `terraform destroy` を実行します。
