import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";

const layoutStatusSchema = z.object({
  status: z.number(),
  message: z.string().nullable(),
  publishedStatusId: z.number(),
  publishedStatus: z.string().nullable(),
  publishedDate: z.string().nullable(),
  isLocked: z.boolean(),
  lockedBy: z.string().nullable(),
  lockedAt: z.string().nullable()
});

export const getLayoutStatus = createTool({
  id: 'get-layout-status',
  description: 'レイアウトのステータスを取得します',
  inputSchema: z.object({
    layoutId: z.number().describe('ステータスを取得するレイアウトのID')
  }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        throw new Error("CMSのURLが設定されていません");
      }

      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/layout/status/${context.layoutId}`;
      console.log(`[DEBUG] getLayoutStatus: リクエストURL = ${url}`);

      const response = await fetch(url, {
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error(`[DEBUG] getLayoutStatus: HTTPエラーが発生しました: ${response.status}`, errorData);
        throw new Error(`HTTP error! status: ${response.status}${errorData ? `, message: ${JSON.stringify(errorData)}` : ''}`);
      }

      const data = await response.json();
      console.log("[DEBUG] getLayoutStatus: レスポンスデータを取得しました");

      const validatedData = layoutStatusSchema.parse(data);
      console.log("[DEBUG] getLayoutStatus: データの検証が成功しました");

      return JSON.stringify(validatedData, null, 2);
    } catch (error) {
      console.error("[DEBUG] getLayoutStatus: エラーが発生しました", error);
      return `エラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`;
    }
  },
}); 