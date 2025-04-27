# Xibo Agent

Xibo Agentは、Mastraフレームワークを使用して構築されたAIエージェントプロジェクトです。

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