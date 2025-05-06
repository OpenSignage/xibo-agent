import { MCPClient } from '@mastra/mcp';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import config from '@mcp/config.json';

// MCPクライアントの初期化
const mcp = new MCPClient({
  servers: Object.entries(config.mcpServers).reduce((acc, [id, server]) => ({
    ...acc,
    [id]: {
      command: server.command,
      args: server.args,
      // 接続の再試行設定を追加
      reconnect: {
        maxRetries: 3,
        retryDelay: 1000,
        // 接続タイムアウトを設定
        timeout: 5000
      },
      // 子プロセスの設定
      childProcess: {
        // 標準入出力のバッファリングを無効化
        stdio: ['pipe', 'pipe', 'pipe'],
        // 子プロセスの終了を待機
        waitOnExit: true
      }
    }
  }), {})
});

// ツールを格納するオブジェクト
const tools: Record<string, any> = {};

// 再接続の最大試行回数
const MAX_RETRIES = 3;
// 再接続の待機時間（ミリ秒）
const RETRY_DELAY = 1000;

// ツールの初期化を待つ
const initTools = async (retryCount = 0) => {
  try {
    const availableTools = await mcp.getTools();

    // 各ツールを個別に登録
    for (const [id, tool] of Object.entries(availableTools)) {
      const createdTool = createTool({
        id,
        description: tool.description,
        inputSchema: z.object({}).passthrough(),
        outputSchema: z.any(),
        execute: async ({ context }) => {
          try {
            return await tool.execute(context);
          } catch (error: unknown) {
            if (error instanceof Error) {
              throw error;
            }
            throw new Error('Unknown error occurred during tool execution');
          }
        }
      });
      tools[id] = createdTool;
    }
  } catch (error: unknown) {
    console.error(`MCPClient error (attempt ${retryCount + 1}/${MAX_RETRIES}):`, error);
    
    if (retryCount < MAX_RETRIES) {
      console.log(`Retrying in ${RETRY_DELAY}ms...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return initTools(retryCount + 1);
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to initialize MCP tools after ${MAX_RETRIES} attempts: ${errorMessage}`);
  }
};

// 初期化のPromise
export const initPromise = initTools();

// ツールを取得する関数 (Promiseが完了後に呼び出すことを想定)
export const getTools = async () => {
  await initPromise;
  return tools;
};

// パッケージ名を取得
const packageName = Object.keys(config.mcpServers)[0];

// パッケージ名をエクスポート
export const getPackageName = () => packageName; 