import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";

export const deletePlaylist = createTool({
  id: 'delete-playlist',
  description: 'プレイリストを削除します',
  inputSchema: z.object({
    playlistId: z.number().describe('削除するプレイリストのID')
  }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        throw new Error("CMSのURLが設定されていません");
      }

      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/playlist/${context.playlistId}`;
      console.log(`[DEBUG] deletePlaylist: リクエストURL = ${url}`);

      const response = await fetch(url, {
        method: 'DELETE',
        headers
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error(`[DEBUG] deletePlaylist: HTTPエラーが発生しました: ${response.status}`, errorData);
        throw new Error(`HTTP error! status: ${response.status}${errorData ? `, message: ${JSON.stringify(errorData)}` : ''}`);
      }

      console.log("[DEBUG] deletePlaylist: プレイリストの削除が成功しました");
      return "プレイリストが正常に削除されました";
    } catch (error) {
      console.error("[DEBUG] deletePlaylist: エラーが発生しました", error);
      return `エラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`;
    }
  },
}); 