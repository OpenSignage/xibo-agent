# xibo-agent

# Google Gemini APIキーを取得する方法。

## Google AI StudioでAPIキーを取得する

- Google AI Studioへのアクセス:
-- GoogleアカウントでGoogle AI Studio（https://aistudio.google.com/）にアクセスします。
- APIキーの作成:
-- 画面上の「Get API key」をクリックします。
-- 表示される指示に従って、APIキーを作成します。
-- 作成されたAPIキーをコピーして安全な場所に保管します。

## Google Cloud Platform（GCP）でAPIキーを取得する

- GCPプロジェクトの作成:
-- Google Cloud Platformコンソール（https://console.cloud.google.com/）で新しいプロジェクトを作成または既存のプロジェクトを選択します。
- Gemini APIの有効化:
--「APIとサービス」から「APIライブラリ」を選択し、「Gemini API」を有効化します。
- 認証情報の作成:
--「APIとサービス」から「認証情報」を選択し、「認証情報を作成」から「APIキー」を選択します。

作成されたAPIキーをコピーして安全な場所に保管します。

>注意点:
>APIキーは機密情報ですので、安全に保管し、第三者に漏洩しないように注意してください。
>APIキーの使用には、Google Cloud Platformの利用規約および料金体系が適用される場合があります。
>APIキーの取り扱いには十分注意し安全に管理してください。

OpenSignage/xibo-agent/web/
├── index.php                  # メインエントリーポイント（最小化）
├── config.php                 # 設定ファイル
├── includes/                  # 共通ファイル
│   ├── functions.php          # 共通関数
│   ├── header.php             # ヘッダー部分
│   ├── footer.php             # フッター部分
│   └── api-client.php         # API接続クライアント
├── auth/                      # 認証関連
│   ├── login.php              # ログイン処理
│   ├── register.php           # ユーザー登録処理
│   ├── logout.php             # ログアウト処理
│   └── auth.js                # 認証用JavaScript
├── chat/                      # チャット関連
│   ├── chat_content.php       # チャットUI
│   └── chat.js                # チャット用JavaScript
├── settings/                  # 設定関連
│   ├── settings_content.php   # 設定UI
│   └── settings.js            # 設定用JavaScript
├── dashboard/                 # ダッシュボード関連
│   ├── dashboard_content.php  # ダッシュボードUI 
│   └── dashboard.js           # ダッシュボード用JavaScript
└── assets/                    # 静的ファイル
    ├── css/                   # CSSファイル
    │   └── style.css          # メインCSS
    └── js/                    # 共通JavaScript
        └── common.js          # 共通JS関数
