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
GOOGLE_GENERATIVE_AI_API_KEY=your_api_key_here
```

APIキーの取得方法：
1. Google Cloud Consoleにアクセス
2. プロジェクトを作成または選択
3. APIとサービス > 認証情報
4. 「認証情報を作成」> 「APIキー」
5. 生成されたAPIキーをコピー

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

または、`.env`ファイルを作成して設定することもできます：

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

## プロジェクト概要

このプロジェクトは、天気情報を取得し、それに基づいてアクティビティを提案するエージェントを提供します。

### 主な機能

- 天気情報の取得（現在の天気と週間予報）
- 天気に基づくアクティビティの提案
- 日本語での応答サポート

## 複数のAgentの定義方法

Mastraでは、複数のAgentを定義して使用することができます。以下にその方法を示します：

### 基本的なAgentの定義

```typescript
// agents/weather/index.ts
import { Agent } from '@mastra/core/agent';
import { google } from '@ai-sdk/google';

export const weatherAgent = new Agent({
  name: 'Weather Agent',
  model: google('gemini-1.5-pro-latest'),
  instructions: '天気情報を提供するエージェント',
  tools: { /* ツールの定義 */ }
});

// agents/activity/index.ts
export const activityAgent = new Agent({
  name: 'Activity Agent',
  model: google('gemini-1.5-pro-latest'),
  instructions: 'アクティビティを提案するエージェント',
  tools: { /* ツールの定義 */ }
});
```

### Agentの統合

```typescript
// src/mastra/index.ts
import { Mastra } from '@mastra/core/mastra';
import { createLogger } from '@mastra/core/logger';
import { weatherAgent } from './agents/weather';
import { activityAgent } from './agents/activity';

export const mastra = new Mastra({
  agents: {
    weather: weatherAgent,
    activity: activityAgent
  },
  logger: createLogger({
    name: 'Mastra',
    level: 'info',
  }),
});
```

### Agent間の連携

Agent間で連携するには、以下のような方法があります：

1. ワークフロー内での連携:
```typescript
const workflow = new Workflow({
  name: 'weather-activity-workflow',
  execute: async ({ context, mastra }) => {
    // 天気エージェントを使用
    const weather = await mastra.agents.weather.execute({
      input: '東京の天気を教えて'
    });

    // アクティビティエージェントを使用
    const activities = await mastra.agents.activity.execute({
      input: `天気: ${weather}, アクティビティを提案して`
    });

    return activities;
  }
});
```

2. エージェント間の直接的な連携:
```typescript
const weatherActivityAgent = new Agent({
  name: 'Weather Activity Agent',
  model: google('gemini-1.5-pro-latest'),
  instructions: '天気情報を取得し、それに基づいてアクティビティを提案する',
  tools: {
    weather: weatherAgent,
    activity: activityAgent
  }
});
```

### 注意点

- 各Agentは独立した役割を持つように設計する
- Agent間の依存関係を最小限に抑える
- 必要に応じてAgent間でデータを共有する方法を設計する
- 各Agentのログを適切に管理する

## ログ出力の方法

このプロジェクトでは、`@mastra/core`のロガーを使用してログを出力します。

### 基本的な使用方法

```typescript
// 情報レベルのログ
mastra.logger.info('情報メッセージ');

// デバッグレベルのログ
mastra.logger.debug('デバッグメッセージ');

// 警告レベルのログ
mastra.logger.warn('警告メッセージ');

// エラーレベルのログ
mastra.logger.error('エラーメッセージ');
```

### オブジェクトと一緒にログを出力

```typescript
mastra.logger.info('処理が完了しました', { 
  userId: '12345',
  action: 'update',
  timestamp: new Date()
});
```

### エラー情報を含めてログを出力

```typescript
try {
  // 何らかの処理
} catch (error) {
  mastra.logger.error('エラーが発生しました', {
    error: error.message,
    stack: error.stack
  });
}
```

### ログレベル

- `debug`: デバッグ情報
- `info`: 一般的な情報
- `warn`: 警告
- `error`: エラー

デフォルトでは、`info`レベル以上のログが出力されます。

### ログレベルの変更

ログレベルを変更するには、`createLogger`のオプションで`level`を指定します：

```typescript
const mastra = new Mastra({
  logger: createLogger({
    name: 'Mastra',
    level: 'debug', // デバッグレベルも出力
  }),
});
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