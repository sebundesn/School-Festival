焼き鳥注文・呼び出し管理システム (Yakitori Order System)
文化祭・イベントの模擬店向けに開発された、リアルタイム注文管理・呼び出しシステムです。

混雑時の「注文の重複」「呼び出しの声が聞こえない」「売上計算ミス」などの現場トラブルを解消し、オペレーションを円滑化します。

🌟 主な機能
呼び出しモニター画面 (/)

店頭のモニターやタブレットに常時表示。

「調理中」と「お渡し可能（呼び出し中）」の番号がリアルタイムで更新。

レジ・注文入力画面 (/register)

タッチ操作に最適化したUIでメニュー本数を入力・自動計算。

トランザクションによる番号被り防止と連打防止ロック機能を搭載。

厨房・ステータス管理画面 (/kitchen)

注文ごとの詳細（タレ・塩などの本数）を一覧表示。

「呼出中」および「お渡し完了」へのワンタップ遷移。

誤タップ救済用の Undo（取り消し）機能 を搭載。

売上・集計ダッシュボード (/admin)

総売上額、累計販売本数、商品別内訳を自動でリアルタイム集計。

🛠 技術スタック
Front-end: Next.js (App Router / TypeScript)

Styling: Tailwind CSS

Back-end / DB: Firebase (Firestore)

Hosting: Vercel

🚀 ローカル開発環境の構築手順
1. リポジトリのクローン & パッケージインストール
Bash
git clone https://github.com/your-username/yakitori-system.git
cd yakitori-system
npm install
2. 環境変数の設定
プロジェクトルート直下に .env.local ファイルを作成し、Firebaseのプロジェクト情報を記述します。

コード スニペット
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
3. 開発サーバーの起動
Bash
npm run dev
ブラウザで http://localhost:3000 にアクセスして動作を確認します。

📱 画面一覧（URLパス）
パス	画面名	設置場所・推奨端末	概要
/	呼び出しモニター	店頭（大型ディスプレイ / iPad）	お客様向け。「調理中」「呼び出し中」の番号を表示。
/register	レジ画面	レジカウンター（タブレット / PC）	注文・会計入力、整理券番号の発行。
/kitchen	厨房画面	調理・受渡エリア（タブレット / スマホ）	詳細注文内容の確認とステータス切り替え。
/admin	集計画面	幹部・会計担当	売上金額や各商品の売れた本数をリアルタイム確認。
⚠️ 当日運用の注意点（現場マニュアル）
オフライン耐性について

Firestoreのローカルキャッシュ（IndexedDB）を有効化しています。短時間の回線瞬断が発生しても画面操作は停止しません。

番号のリセット

Firestore上の counters/today ドキュメントを更新することで、番号（#001〜）のカウンターをリセットできます。

アナログなフォールバック