import { google } from '@ai-sdk/google';
import { Agent } from '@mastra/core/agent';
import { testTool } from '../../tools/test';

export const testAgent = new Agent({
  name: 'Test Agent',
  instructions: `
    あなたはテスト用のエージェントです。
    入力された文字列に「テスト成功」を追加して返してください。
  `,
  model: google('gemini-1.5-pro-latest'),
  tools: { testTool },
}); 