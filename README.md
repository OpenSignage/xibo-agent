# Xibo Agent

Xibo-CMSのためのエージェントツールです。

## 環境設定

### APIキーの設定

GoogleGenerativeAIを使用するには、APIキーを設定する必要があります。

#### 方法1: 環境変数の設定

```bash
# macOS/Linux
export GOOGLE_GENERATIVE_AI_API_KEY=your_api_key_here

# Windows
set GOOGLE_GENERATIVE_AI_API_KEY=your_api_key_here
```

#### 方法2: .envファイルの作成

プロジェクトのルートディレクトリに`.env.development`ファイルを作成し、以下の内容を追加：

```env
# Google Generative AI APIキー
GOOGLE_GENERATIVE_AI_API_KEY=your_api_key_here

# Xibo CMS設定
XIBO_CMS_URL=https://your-xibo-cms-url
XIBO_CMS_USERNAME=your_username
XIBO_CMS_PASSWORD=your_password
XIBO_DISPLAY_ID=your_display_id
XIBO_DISPLAY_KEY=your_display_key

# アプリケーション設定
APP_ROOT=/path/to/your/project
```

APIキーの取得方法：
1. Google Cloud Consoleにアクセス
2. プロジェクトを作成または選択
3. APIとサービス > 認証情報
4. 「認証情報を作成」> 「APIキー」
5. 生成されたAPIキーをコピー

## Mastra アップデートガイド

### アップデート方法

#### 1. 現在のバージョン確認
```bash
npm list mastra
```

#### 2. 最新バージョンへのアップデート
```bash
npm update mastra
```

#### 3. 特定のバージョンへのアップデート
```bash
npm install mastra@<version>
```

### バージョン管理について

- `package.json`でのバージョン指定方法：
  - `^0.6.0`: メジャーバージョンが変わらない範囲で自動アップデート
  - `~0.6.0`: パッチバージョンのみアップデート
  - `0.6.0`: 完全一致（アップデートなし）
  - `*`: 最新バージョン（非推奨）

### アップデート後の確認事項

1. バージョン確認
```bash
npm list mastra
```

2. 更新可能なパッケージの確認
```bash
npm outdated
```

3. アプリケーションの動作確認
- アップデート後は必ずアプリケーションの動作確認を行ってください
- 特に破壊的変更（Breaking Changes）がないか確認してください

### 注意事項

- メジャーバージョンの変更がある場合は、互換性の問題が発生する可能性があります
- アップデート前に必ず変更履歴を確認することをお勧めします
- 本番環境へのアップデートは、テスト環境で十分な検証を行ってから実施してください

### トラブルシューティング

アップデート後に問題が発生した場合：

1. 前のバージョンに戻す
```bash
npm install mastra@<previous_version>
```

2. 依存関係のクリーンアップ
```bash
npm cache clean --force
rm -rf node_modules
npm install
```

## ツール一覧

### Xibo Manual Tool

Xibo-CMSのマニュアルを参照して回答を提供するツールです。

#### 設定

`src/mastra/tools/xibo-manual/config.ts`で以下の設定を行うことができます：

```typescript
export const config = {
  // マニュアルのベースURL
  baseUrl: 'https://sigme.net/manual-r4/ja/',
  
  // パス設定
  paths: {
    // プロジェクトのルートディレクトリ
    // 環境変数APP_ROOTが設定されていない場合はデフォルト値を使用
    root: process.env.APP_ROOT || '/Users/miuramasataka/OpenSignage/xibo-agent',
    
    // マニュアルコンテンツのディレクトリ
    contents: 'src/mastra/tools/xibo-manual/contents'
  }
} as const;
```

#### 環境変数の設定

異なる環境で使用する場合は、環境変数`APP_ROOT`を設定してください：

```bash
# macOS/Linux
export APP_ROOT=/path/to/your/project

# Windows
set APP_ROOT=C:\path\to\your\project
```

または、`.env.development`ファイルを作成して設定することもできます：

```env
APP_ROOT=/path/to/your/project
```

#### 使用方法

1. マニュアルコンテンツを`contents`ディレクトリに配置
2. 必要に応じて`config.ts`の設定を変更
3. ツールを実行

#### 注意事項

- マニュアルコンテンツは`.md`形式で保存してください
- 各ファイルにはフロントマター（メタデータ）を含めてください
- 環境変数`APP_ROOT`が設定されていない場合は、デフォルトのパスが使用されます

## ログ出力

このプロジェクトでは、`@mastra/core`のロガーを使用してログを出力します。

### ログレベルの設定

`src/mastra/tools/xibo-manual/manual.ts`でロガーの設定を行います：

```typescript
const logger = createLogger({
  name: 'xibo-manual',
  level: 'info'  // debug, info, warn, error
});
```

### ログの出力方法

```typescript
// デバッグ情報
logger.debug('メッセージ', { データ });

// 情報
logger.info('メッセージ', { データ });

// 警告
logger.warn('メッセージ', { データ });

// エラー
logger.error('メッセージ', { データ });
```

## 開発環境のセットアップ

1. 依存関係のインストール:
```bash
npm install
```

2. 開発サーバーの起動:
```bash
npm run dev
```

3. ビルド:
```bash
npm run build
```

## ライセンス

Elastic License 2.0 (ELv2) 