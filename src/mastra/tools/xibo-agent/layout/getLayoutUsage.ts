import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";

const layoutUsageSchema = z.object({
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

export const getLayoutUsage = createTool({
  id: 'get-layout-usage',
  description: 'レイアウトの使用状況を取得します',
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
      const url = `${config.cmsUrl}/api/layout/usage/${context.layoutId}`;
      console.log(`[DEBUG] getLayoutUsage: リクエストURL = ${url}`);

      const response = await fetch(url, {
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error(`[DEBUG] getLayoutUsage: HTTPエラーが発生しました: ${response.status}`, errorData);
        throw new Error(`HTTP error! status: ${response.status}${errorData ? `, message: ${JSON.stringify(errorData)}` : ''}`);
      }

      const data = await response.json();
      console.log("[DEBUG] getLayoutUsage: レスポンスデータを取得しました");

      const validatedData = layoutUsageSchema.parse(data);
      console.log("[DEBUG] getLayoutUsage: データの検証が成功しました");

      return JSON.stringify(validatedData, null, 2);
    } catch (error) {
      console.error("[DEBUG] getLayoutUsage: エラーが発生しました", error);
      return `エラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`;
    }
  },
}); 