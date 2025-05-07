import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";

export const convertPlaylist = createTool({
  id: 'convert-playlist',
  description: 'インラインエディタのプレイリストからグローバルプレイリストを作成します',
  inputSchema: z.object({
    playlistId: z.number().describe('変換するプレイリストのID'),
    name: z.string().optional().describe('新しいグローバルプレイリストの名前')
  }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        throw new Error("CMSのURLが設定されていません");
      }

      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/playlist/${context.playlistId}/convert`;
      console.log(`[DEBUG] convertPlaylist: リクエストURL = ${url}`);

      const formData = new FormData();
      if (context.name) formData.append('name', context.name);

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error(`[DEBUG] convertPlaylist: HTTPエラーが発生しました: ${response.status}`, errorData);
        throw new Error(`HTTP error! status: ${response.status}${errorData ? `, message: ${JSON.stringify(errorData)}` : ''}`);
      }

      console.log("[DEBUG] convertPlaylist: プレイリストの変換が成功しました");
      return "プレイリストが正常に変換されました";
    } catch (error) {
      console.error("[DEBUG] convertPlaylist: エラーが発生しました", error);
      return `エラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`;
    }
  },
}); 