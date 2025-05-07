import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";

export const setPlaylistEnableStat = createTool({
  id: 'set-playlist-enable-stat',
  description: 'プレイリストの統計収集を有効化します',
  inputSchema: z.object({
    playlistId: z.number().describe('統計収集を設定するプレイリストのID'),
    enableStat: z.string().describe('統計収集の設定（On, Off, Inherit）')
  }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        throw new Error("CMSのURLが設定されていません");
      }

      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/playlist/setenablestat/${context.playlistId}`;
      console.log(`[DEBUG] setPlaylistEnableStat: リクエストURL = ${url}`);

      const formData = new FormData();
      formData.append('enableStat', context.enableStat);

      const response = await fetch(url, {
        method: 'PUT',
        headers,
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error(`[DEBUG] setPlaylistEnableStat: HTTPエラーが発生しました: ${response.status}`, errorData);
        throw new Error(`HTTP error! status: ${response.status}${errorData ? `, message: ${JSON.stringify(errorData)}` : ''}`);
      }

      console.log("[DEBUG] setPlaylistEnableStat: プレイリストの統計収集設定が成功しました");
      return "プレイリストの統計収集設定が正常に更新されました";
    } catch (error) {
      console.error("[DEBUG] setPlaylistEnableStat: エラーが発生しました", error);
      return `エラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`;
    }
  },
}); 