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

# Brave Search APIキー
BRAVE_API_KEY=your_brave_api_key_here
```

### MCPサーバーの設定

MCP（Model Context Protocol）サーバーの設定は`.mcp/config.json`で行います。

#### 設定ファイルの作成

プロジェクトのルートディレクトリに`.mcp/config.json`を作成し、以下の内容を追加：

```json
{
  "mcpServers": {
    "desktop-commander": {
      "type": "local",
      "command": "npx",
      "args": [
        "-y",
        "@smithery/cli@1.1.84",
        "run",
        "@wonderwhy-er/desktop-commander",
        "--key",
        "your_desktop_commander_key_here"
      ],
      "provider": "@wonderwhy-er/desktop-commander",
      "version": "latest",
      "description": "Execute terminal commands and manage files with diff editing capabilities",
      "capabilities": {
        "coding": true,
        "shell": true,
        "terminal": true,
        "task_automation": true
      }
    },
    "brave-search": {
      "type": "local",
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-brave-search"
      ],
      "env": {
        "BRAVE_API_KEY": "your_brave_api_key_here"
      },
      "provider": "@modelcontextprotocol/server-brave-search",
      "version": "latest",
      "description": "Search the web using Brave Search API",
      "capabilities": {
        "search": true,
        "web": true
      }
    }
  }
}
```

#### 注意事項

- `.mcp`ディレクトリは`.gitignore`に追加されており、GitHubには公開されません
- APIキーなどの機密情報は環境変数から読み込むことを推奨します
- 各開発者は自分の環境に合わせて設定を管理してください

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

## プレゼンテンプレートとガント表示のカスタマイズ

プレゼン（PowerPoint）生成時の見た目はテンプレート `persistent_data/presentations/templates/default.json` で制御できます。

### ガント（gantt）のスタイル指定

`visualStyles.gantt` で開始日ラベルやグリッド線のスタイルを調整できます。

```json
{
  "visualStyles": {
    "gantt": {
      "shadow": "none",
      "labelFontSize": 12,
      "gridColor": "#9AA3AF",
      "gridWidth": 1.2
    }
  }
}
```

- `labelFontSize`: 各タスクの開始日ラベルのフォントサイズ（pt）。
- `gridColor`: ガントの縦グリッド線の色。
- `gridWidth`: ガントの縦グリッド線の太さ。

実装上の挙動:
- 開始日ラベルは各バーの開始X座標に揃え、帯の上（上側）に左寄せで表示します。
- グリッド線は期間に応じて自動で単位を切替（約60日以上: 月、14日以上: 週、2日以上: 日、それ未満: 時間）。

サンプル:
- `persistent_data/presentations/recipes/sample-recipe.json` の「ガント予定（日付付き）」スライド。

### ブレットチャート（bullet）のスタイル指定

`visualStyles.bullet` でラベルの配置や数値表示の体裁を調整できます。

```json
{
  "visualStyles": {
    "bullet": {
      "labelFontSize": 14,
      "labelAlign": "right",        // "left" or "right"
      "valueFontSize": 12,
      "targetFontSize": 11,
      "valueBoxWidth": 0.8,         // 値テキストの幅（in）
      "valueOutsidePad": 0.05,      // バー外に出す際の左パディング（in）
      "targetOffsetY": 0.18         // 目標値テキストの縦方向オフセット（in）
    }
  }
}
```

実装上の挙動:
- ラベルは `labelAlign` と `labelFontSize` を使用
- value はバーの内側終端に右寄せ（短いときは外側に左寄せ）+ `valueFontSize`/`valueBoxWidth`/`valueOutsidePad`
- target は目標ライン上に表示（上部）+ `targetFontSize`/`targetOffsetY`

### ウォーターフォール（waterfall）のスタイル指定

`visualStyles.waterfall` で基準線（ベースライン）やグリッド表示を制御できます。

```json
{
  "visualStyles": {
    "waterfall": {
      "baselineRatio": 0.55,   // ベースラインを領域高さに対する比率で指定（0.05〜0.95）
      "grid": true,            // グリッド線の表示有無
      "gridColor": "#DDE3EA", // グリッド線の色
      "gridWidth": 1.0,        // グリッド線の太さ
      "gridLevels": 4          // グリッド線の本数（2〜6）
    }
  }
}
```

実装上の挙動:
- ベースラインは `baselineRatio` に基づいて領域内Y位置を決定（既定 0.55）。
- `grid` が有効な場合、等間隔の水平グリッドを描画し、ベースラインはやや太めで強調します。


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