import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";

export const getPlaylistUsageByLayouts = createTool({
  id: 'get-playlist-usage-by-layouts',
  description: 'レイアウト別のプレイリスト使用状況レポートを取得します',
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
      const url = `${config.cmsUrl}/api/playlist/usage/layouts/${context.playlistId}`;
      console.log(`[DEBUG] getPlaylistUsageByLayouts: リクエストURL = ${url}`);

      const response = await fetch(url, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error(`[DEBUG] getPlaylistUsageByLayouts: HTTPエラーが発生しました: ${response.status}`, errorData);
        throw new Error(`HTTP error! status: ${response.status}${errorData ? `, message: ${JSON.stringify(errorData)}` : ''}`);
      }

      const data = await response.json();
      console.log("[DEBUG] getPlaylistUsageByLayouts: レイアウト別のプレイリスト使用状況の取得が成功しました");
      return JSON.stringify(data);
    } catch (error) {
      console.error("[DEBUG] getPlaylistUsageByLayouts: エラーが発生しました", error);
      return `エラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`;
    }
  },
}); 