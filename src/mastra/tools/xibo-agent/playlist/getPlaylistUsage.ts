import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";

export const getPlaylistUsage = createTool({
  id: 'get-playlist-usage',
  description: 'プレイリストの使用状況レポートを取得します',
  inputSchema: z.object({
    playlistId: z.number().describe('使用状況を取得するプレイリストのID')
  }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        throw new Error("CMSのURLが設定されていません");
      }

      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/playlist/usage/${context.playlistId}`;
      console.log(`[DEBUG] getPlaylistUsage: リクエストURL = ${url}`);

      const response = await fetch(url, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error(`[DEBUG] getPlaylistUsage: HTTPエラーが発生しました: ${response.status}`, errorData);
        throw new Error(`HTTP error! status: ${response.status}${errorData ? `, message: ${JSON.stringify(errorData)}` : ''}`);
      }

      const data = await response.json();
      console.log("[DEBUG] getPlaylistUsage: プレイリストの使用状況の取得が成功しました");
      return JSON.stringify(data);
    } catch (error) {
      console.error("[DEBUG] getPlaylistUsage: エラーが発生しました", error);
      return `エラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`;
    }
  },
}); 