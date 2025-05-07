import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";

export const selectPlaylistFolder = createTool({
  id: 'select-playlist-folder',
  description: 'プレイリストのフォルダを選択します',
  inputSchema: z.object({
    playlistId: z.number().describe('フォルダを選択するプレイリストのID'),
    folderId: z.number().optional().describe('割り当てるフォルダID')
  }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        throw new Error("CMSのURLが設定されていません");
      }

      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/playlist/${context.playlistId}/selectfolder`;
      console.log(`[DEBUG] selectPlaylistFolder: リクエストURL = ${url}`);

      const formData = new FormData();
      if (context.folderId) formData.append('folderId', context.folderId.toString());

      const response = await fetch(url, {
        method: 'PUT',
        headers,
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error(`[DEBUG] selectPlaylistFolder: HTTPエラーが発生しました: ${response.status}`, errorData);
        throw new Error(`HTTP error! status: ${response.status}${errorData ? `, message: ${JSON.stringify(errorData)}` : ''}`);
      }

      console.log("[DEBUG] selectPlaylistFolder: プレイリストのフォルダ選択が成功しました");
      return "プレイリストのフォルダが正常に選択されました";
    } catch (error) {
      console.error("[DEBUG] selectPlaylistFolder: エラーが発生しました", error);
      return `エラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`;
    }
  },
}); 