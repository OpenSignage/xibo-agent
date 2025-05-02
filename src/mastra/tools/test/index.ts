import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const testTool = createTool({
  id: 'test-tool',
  description: 'テスト用のツールです',
  inputSchema: z.object({
    message: z.string().describe('テストメッセージ'),
  }),
  outputSchema: z.object({
    result: z.string().describe('テスト結果'),
  }),
  execute: async ({ context }) => {
    return {
      result: `${context.message} - テスト成功`,
    };
  },
}); 