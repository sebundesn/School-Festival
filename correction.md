# 焼き鳥 注文・会計システム(AWS)

## 構成

```
 [各端末のブラウザ]  /  /register  /kitchin  /admin
        │  ▲
        │  │ ① 画面: CloudFront ──► S3(非公開・ビルド済みSPA)
        │  │
        │  │ ② 書き込み・取得: HTTPS
        ▼  │
  API Gateway (HTTP API) ──► Lambda: api ──► DynamoDB
                                              ├ orders(注文)  ── Streams ──┐
                                              ├ meta(採番・集計)            │
                                              └ connections(WS接続)         │
        ▲                                                                   │
        │ ③ 即時反映: WebSocket                                            ▼
  API Gateway (WebSocket) ◄── Lambda: broadcast ◄──────────────────────────┘
        └──► Lambda: ws($connect / $disconnect)
```

- **書き込みは HTTP API、受信は WebSocket** に分けています。どの端末が注文やステータスを変えても、
  DynamoDB Streams 経由で broadcast 関数が全端末に `{"type":"order","order":{...}}` を送ります。
- **価格と合計はサーバー側で計算**(`menu` 変数)。端末側で金額をいじられても影響しません。
- **集計値は会計時に加算**するので、/admin は1件読むだけで総本数・総売上が出ます。
- **double transaction measurement** AとBが会計処理をしても、不整合が起きないように、注文IDを注文入力した時点で占有して入れないようにするといった対策を講じる。
- **ヒューマンエラーで会計処理をした際に、キャンセルする処理を追加する。**
- **paidって必要ある？**

## API

全リクエストにヘッダー `x-staff-token: <staff_token>` が必要です。

| メソッド | パス | 内容 |
|---|---|---|
| GET | `/menu` | `{"もも":150,...}` |
| POST | `/orders` | `{"items":[{"name":"もも","qty":2}], "paid": false}` → 作成した注文 |
| GET | `/orders?status=paid` | そのステータスの注文(古い順) |
| PATCH | `/orders/{orderId}` | `{"status":"ready"}` |
| GET | `/stats` | `{"orders","sales","skewers","byItem"}`(会計済みのみ集計) |
| GET | `/export.csv` | 1品目1行のCSV(注文ID・整理券番号・品物・本数・単価・小計・ステータス・注文時刻・会計時刻、JST) |

WebSocket は `wss://.../prod?token=<staff_token>&role=kitchen` で接続します(ブラウザの WebSocket はヘッダーを付けられないため)。

## デプロイ

前提: AWS CLI でログイン済み(`aws configure` または `aws sso login`)、Terraform 1.6 以上。

```bash
cd infra
cp terraform.tfvars.example terraform.tfvars   # staff_token と alert_email を編集
terraform init
terraform apply
```

+予算アラート
```

CSV は `fetch` で取得して Blob にしてダウンロードさせてください(トークンをヘッダーで送るため、`<a href>` 直リンクは使えません)。

## 当日の注意

- **WebSocket は最大2時間で切断されます**(API Gateway の仕様)。上の `subscribe` のように自動再接続＋一覧の取り直しを必ず入れてください。
- 回線が落ちたときに備えて、紙の伝票とテザリング用スマホを用意。
- 終わったら `terraform.tfvars` に `protect_data = false` を追加して `apply`、CSV を保存してから `terraform destroy`。
