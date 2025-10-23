// src/mastra/tools/long-running-tool.ts
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const longRunningTool = createTool({
  id: 'longRunningTool',
  description: '長時間かかる処理の進捗をストリーミングするツール',
  inputSchema: z.object({
    task: z.string().describe('実行するタスク名'),
  }),
  outputSchema: z.object({
    result: z.string(),
  }),
  async execute(context) {
    const writer = (context as any).writer;
    const task: string = (context as any).task;

    await writer?.custom({ type: 'data-tool-progress', data: { status: 'pending' } });
    await writer?.write('タスクを開始します... (10%)');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 任意の中間通知が必要なら追加
    await writer?.custom({ type: 'data-tool-progress', data: { status: 'processing' } });
    await writer?.write('中間処理を実行中... (50%)');
    await new Promise(resolve => setTimeout(resolve, 1000));

    await writer?.custom({ type: 'data-tool-progress', data: { status: 'success' } });
    await writer?.write('処理が完了しました');

    return { result: `タスク「${task}」が完了しました。` };
  },
});
