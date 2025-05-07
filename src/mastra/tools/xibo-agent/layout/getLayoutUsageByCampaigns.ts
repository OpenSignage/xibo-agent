import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";

const layoutUsageByCampaignsSchema = z.object({
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

export const getLayoutUsageByCampaigns = createTool({
  id: 'get-layout-usage-by-campaigns',
  description: 'レイアウトの使用状況（キャンペーン別）を取得します',
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
      const url = `${config.cmsUrl}/api/layout/usage/campaigns/${context.layoutId}`;
      console.log(`[DEBUG] getLayoutUsageByCampaigns: リクエストURL = ${url}`);

      const response = await fetch(url, {
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error(`[DEBUG] getLayoutUsageByCampaigns: HTTPエラーが発生しました: ${response.status}`, errorData);
        throw new Error(`HTTP error! status: ${response.status}${errorData ? `, message: ${JSON.stringify(errorData)}` : ''}`);
      }

      const data = await response.json();
      console.log("[DEBUG] getLayoutUsageByCampaigns: レスポンスデータを取得しました");

      const validatedData = layoutUsageByCampaignsSchema.parse(data);
      console.log("[DEBUG] getLayoutUsageByCampaigns: データの検証が成功しました");

      return JSON.stringify(validatedData, null, 2);
    } catch (error) {
      console.error("[DEBUG] getLayoutUsageByCampaigns: エラーが発生しました", error);
      return `エラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`;
    }
  },
}); 