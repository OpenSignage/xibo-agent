import { Agent } from '@mastra/core/agent';
import { google } from '@ai-sdk/google';
import {
  initPromise,
  getTools
} from '../../tools/mcps/mcp';

// エージェントの初期化を待つ
const initAgent = async () => {
  // ツールの初期化を待つ
  await initPromise;
  const tools = await getTools();

  return new Agent({
    name: 'MCP Agent',
    instructions: `
      あなたはシステムのファイル管理とプロセス制御を行うエージェントです。
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

      重要な注意事項：
      1. ファイルパスは必ず絶対パスを使用してください（例：'/path/to/file' または 'C:\\path\\to\\file'）
      2. 相対パスやチルダパス（~/...）は使用しないでください
      3. ファイル操作は許可されたディレクトリ内でのみ実行可能です
      4. コマンド実行はセキュリティ上の理由で制限されています
      5. 現在のディレクトリを確認するには、listDirectoryを使用してください
    `,
    model: google('gemini-1.5-pro-latest'),
    tools: {
      'desktop-commander_read_file': tools['desktop-commander_read_file'],
      'desktop-commander_write_file': tools['desktop-commander_write_file'],
      'desktop-commander_get_config': tools['desktop-commander_get_config'],
      'desktop-commander_set_config_value': tools['desktop-commander_set_config_value'],
      'desktop-commander_read_multiple_files': tools['desktop-commander_read_multiple_files'],
      'desktop-commander_create_directory': tools['desktop-commander_create_directory'],
      'desktop-commander_list_directory': tools['desktop-commander_list_directory'],
      'desktop-commander_move_file': tools['desktop-commander_move_file'],
      'desktop-commander_search_files': tools['desktop-commander_search_files'],
      'desktop-commander_search_code': tools['desktop-commander_search_code'],
      'desktop-commander_get_file_info': tools['desktop-commander_get_file_info'],
      'desktop-commander_edit_block': tools['desktop-commander_edit_block'],
      'desktop-commander_execute_command': tools['desktop-commander_execute_command'],
      'desktop-commander_read_output': tools['desktop-commander_read_output'],
      'desktop-commander_force_terminate': tools['desktop-commander_force_terminate'],
      'desktop-commander_list_sessions': tools['desktop-commander_list_sessions'],
      'desktop-commander_list_processes': tools['desktop-commander_list_processes'],
      'desktop-commander_kill_process': tools['desktop-commander_kill_process']
    }
  });
};

export const mcpAgent = await initAgent();
export const createMCPAgent = initAgent; 