import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";

export const checkoutLayout = createTool({
  id: 'checkout-layout',
  description: 'レイアウトをチェックアウトします',
  inputSchema: z.object({
    layoutId: z.number().describe('チェックアウトするレイアウトのID')
  }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        throw new Error("CMSのURLが設定されていません");
      }

      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/layout/checkout/${context.layoutId}`;
      console.log(`[DEBUG] checkoutLayout: リクエストURL = ${url}`);

      const response = await fetch(url, {
        method: 'POST',
        headers
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error(`[DEBUG] checkoutLayout: HTTPエラーが発生しました: ${response.status}`, errorData);
        throw new Error(`HTTP error! status: ${response.status}${errorData ? `, message: ${JSON.stringify(errorData)}` : ''}`);
      }

      console.log("[DEBUG] checkoutLayout: レイアウトのチェックアウトが成功しました");
      return "レイアウトが正常にチェックアウトされました";
    } catch (error) {
      console.error("[DEBUG] checkoutLayout: エラーが発生しました", error);
      return `エラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`;
    }
  },
}); 