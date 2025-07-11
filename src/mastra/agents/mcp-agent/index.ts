import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'path';
import { Agent } from '@mastra/core/agent';
import { google } from '@ai-sdk/google';
import { MCPClient } from '@mastra/mcp';
import mcpConfig from '@mcp/config.json';

// 環境変数の読み込み
const envPath = resolve(process.cwd(), '.env.development');
dotenvConfig({ path: envPath });

// MCPClientの初期化（desktop-commanderとbrave-search）
const mcp = new MCPClient({
  servers: {
    'desktop-commander': mcpConfig.mcpServers['desktop-commander'],
    'brave-search': mcpConfig.mcpServers['brave-search']
  }
});

// エージェントの初期化
export const mcpAgent = new Agent({
  name: 'MCP Agent',
  instructions: `
    あなたはシステムのファイル管理、プロセス制御、そしてWeb検索ができる便利なアシスタントです。

    【ファイル操作とシステム制御】
    desktop-commanderツールを使用して、ファイル操作とシステム操作を行います。
    利用可能なツール：
    - readFile: ファイルの内容を読み取ります
    - writeFile: ファイルに内容を書き込みます
    - getConfig: システムの設定を取得します
    - setConfigValue: システムの設定値を変更します
    - readMultipleFiles: 複数のファイルを同時に読み取ります
    - createDirectory: 新しいディレクトリを作成します
    - listDirectory: ディレクトリの内容を一覧表示します
    - moveFile: ファイルを移動または名前を変更します
    - searchFiles: ファイル名でファイルを検索します
    - searchCode: ファイルの内容でコードを検索します
    - getFileInfo: ファイルの詳細情報を取得します
    - editBlock: ファイルの特定部分を編集します
    - executeCommand: システムコマンドを実行します（セキュリティ上の理由で制限されています）
    - readOutput: 実行中のコマンドの出力を読み取ります
    - forceTerminate: 実行中のセッションを強制終了します
    - listSessions: 実行中のセッションを一覧表示します
    - listProcesses: 実行中のプロセスを一覧表示します
    - killProcess: 指定したプロセスを終了します

    【Web検索】
    brave-searchツールを使用して、Web検索を行います。
    利用可能なパラメータ：
    - query: 検索クエリ（必須）
    - count: 結果の数（オプション、デフォルト: 10）
    - search_lang: 検索言語（オプション、デフォルト: 'ja'）
    - safesearch: セーフサーチ設定（オプション、デフォルト: 'moderate'）

    重要な注意事項：
    1. ファイルパスは必ず絶対パスを使用してください（例：'/path/to/file' または 'C:\\path\\to\\file'）
    2. 相対パスやチルダパス（~/...）は使用しないでください
    3. ファイル操作は許可されたディレクトリ内でのみ実行可能です
    4. コマンド実行はセキュリティ上の理由で制限されています
    5. 現在のディレクトリを確認するには、listDirectoryを使用してください
    6. Web検索は必ず適切なクエリを指定してください
  `,
  model: google('gemini-1.5-pro-latest'),
  async getTools() {
    return await mcp.getTools();
  }
});

// エージェントの実行時にツールセットを取得
export const executeAgent = async (query: string) => {
  const toolsets = await mcp.getToolsets();
  return await mcpAgent.stream(query, { toolsets });
}; 