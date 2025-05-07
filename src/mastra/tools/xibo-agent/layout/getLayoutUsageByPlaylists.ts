import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";

const layoutUsageByPlaylistsSchema = z.object({
  layoutId: z.number(),
  layout: z.string(),
  count: z.number(),
  lastUsed: z.string().nullable(),
  usedIn: z.array(z.object({
    id: z.number(),
    name: z.string(),
    type: z.string()
  }))
});

export const getLayoutUsageByPlaylists = createTool({
  id: 'get-layout-usage-by-playlists',
  description: 'レイアウトの使用状況（プレイリスト別）を取得します',
  inputSchema: z.object({
    layoutId: z.number().describe('使用状況を取得するレイアウトのID')
  }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        throw new Error("CMSのURLが設定されていません");
      }

      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/layout/usage/playlists/${context.layoutId}`;
      console.log(`[DEBUG] getLayoutUsageByPlaylists: リクエストURL = ${url}`);

      const response = await fetch(url, {
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error(`[DEBUG] getLayoutUsageByPlaylists: HTTPエラーが発生しました: ${response.status}`, errorData);
        throw new Error(`HTTP error! status: ${response.status}${errorData ? `, message: ${JSON.stringify(errorData)}` : ''}`);
      }

      const data = await response.json();
      console.log("[DEBUG] getLayoutUsageByPlaylists: レスポンスデータを取得しました");

      const validatedData = layoutUsageByPlaylistsSchema.parse(data);
      console.log("[DEBUG] getLayoutUsageByPlaylists: データの検証が成功しました");

      return JSON.stringify(validatedData, null, 2);
    } catch (error) {
      console.error("[DEBUG] getLayoutUsageByPlaylists: エラーが発生しました", error);
      return `エラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`;
    }
  },
}); 