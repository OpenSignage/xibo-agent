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
=======
Xibo Agentは、Mastraフレームワークを使用したAIエージェントアプリケーションです。

## サポートされているLLMモデル

### Google Gemini
- `gemini-1.5-pro-latest` - 最新のGemini Proモデル
- `gemini-1.5-pro` - Gemini Proモデル
- `gemini-1.5-flash` - 高速なGemini Flashモデル

特徴：
- マルチモーダル対応
- 高速な応答速度
- 日本語の理解力が高い

### OpenAI
- `gpt-4-turbo` - GPT-4 Turbo
- `gpt-4` - GPT-4
- `gpt-3.5-turbo` - GPT-3.5 Turbo

特徴：
- 広範な知識ベース
- 高い創造性
- 安定した性能

### Anthropic Claude
- `claude-3-opus` - Claude 3 Opus
- `claude-3-sonnet` - Claude 3 Sonnet
- `claude-3-haiku` - Claude 3 Haiku

特徴：
- 長文の理解力が高い
- 論理的な推論能力
- 高い安全性

## モデルの選択基準

モデルを選択する際は、以下の要素を考慮してください：

1. **応答速度**
   - 高速な応答が必要な場合: `gemini-1.5-flash` または `gpt-3.5-turbo`
   - より高度な処理が必要な場合: `gemini-1.5-pro` または `gpt-4-turbo`

2. **タスクの複雑さ**
   - 単純なタスク: `gpt-3.5-turbo` または `claude-3-haiku`
   - 複雑なタスク: `gemini-1.5-pro` または `claude-3-opus`

3. **コスト**
   - コスト効率: `gpt-3.5-turbo` または `claude-3-haiku`
   - 高性能: `gemini-1.5-pro` または `claude-3-opus`

4. **言語対応**
   - 日本語対応: すべてのモデルが対応
   - 高度な日本語理解: `gemini-1.5-pro` が推奨

5. **機能要件**
   - マルチモーダル対応: Geminiモデル
   - 長文処理: Claudeモデル
   - 汎用的な用途: GPTモデル

## 使用方法

モデルは以下のように設定できます：

```typescript
import { google } from '@ai-sdk/google';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';

// Google Gemini
model: google('gemini-1.5-pro-latest')

// OpenAI
model: openai('gpt-4-turbo')

// Anthropic Claude
model: anthropic('claude-3-opus')
```

## 注意事項

- 各モデルには利用制限やコストが異なります
- APIキーの設定が必要です
- モデルの性能は定期的に更新される可能性があります
- 最新の情報は各プロバイダーのドキュメントを参照してくださ

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

## AgentのInstructionsの管理

Agentのinstructionsは、別ファイルに分離して管理することを推奨します。これにより、以下のメリットがあります：

- コードの可読性が向上
- インストラクションの管理が容易
- 複数のAgentで同じインストラクションを共有可能
- バージョン管理が容易

### 基本的な構成

```typescript
// agents/weather/instructions.ts
export const weatherAgentInstructions = `
あなたは、正確な気象情報を提供する便利な気象アシスタントです。

あなたの主な役割は、ユーザーが特定の場所の天気の詳細を得るのを助けることです。応答するとき
- 場所が提供されていない場合は、常に場所を尋ねる
- 場所名が英語でない場合は翻訳してください。
- 複数の部分からなる場所（例:「New York, NY」）を指定する場合は、最も関連性の高い部分（例:「New York」）を使用してください。
- 湿度、風の状態、降水量など、関連する詳細を含める。
- 回答は簡潔に、しかし有益なものにする
- 可能な限り日本語で返答してください。
- 現在の天気と、週間予報を返答します。
`;

// agents/activity/instructions.ts
export const activityAgentInstructions = `
あなたは、天気に基づいて適切なアクティビティを提案するエキスパートです。

応答するとき
- 天気の状態に応じて適切なアクティビティを提案する
- 屋内・屋外のアクティビティをバランスよく提案する
- 安全性を考慮した提案を行う
- 具体的な場所や時間帯を含める
- 可能な限り日本語で返答してください。
`;
```

### Agentでの使用方法

```typescript
// agents/weather/index.ts
import { Agent } from '@mastra/core/agent';
import { google } from '@ai-sdk/google';
import { weatherAgentInstructions } from './instructions';

export const weatherAgent = new Agent({
  name: 'Weather Agent',
  model: google('gemini-1.5-pro-latest'),
  instructions: weatherAgentInstructions,
  tools: { /* ツールの定義 */ }
});

// agents/activity/index.ts
import { Agent } from '@mastra/core/agent';
import { google } from '@ai-sdk/google';
import { activityAgentInstructions } from './instructions';

export const activityAgent = new Agent({
  name: 'Activity Agent',
  model: google('gemini-1.5-pro-latest'),
  instructions: activityAgentInstructions,
  tools: { /* ツールの定義 */ }
});
```

### インストラクションの共有

複数のAgentで同じインストラクションを使用する場合：

```typescript
// agents/common/instructions.ts
export const commonInstructions = `
基本的な応答ルール：
- 常に丁寧で親切な対応を心がける
- 可能な限り日本語で返答する
- 不明な点は質問する
- 安全な提案を行う
`;

// agents/weather/instructions.ts
import { commonInstructions } from '../common/instructions';

export const weatherAgentInstructions = `
${commonInstructions}

あなたは、正確な気象情報を提供する便利な気象アシスタントです。
...
`;
```

### ベストプラクティス

1. ファイル構成
   - 各Agentディレクトリに`instructions.ts`を作成
   - 共通のインストラクションは`common`ディレクトリに配置

2. インストラクションの管理
   - 明確な構造を持つ
   - 定期的に見直しと更新を行う
   - バージョン管理を適切に行う

3. 命名規則
   - ファイル名: `instructions.ts`
   - 変数名: `{agentName}Instructions`

4. ドキュメント化
   - インストラクションの目的をコメントで説明
   - 更新履歴を記録 