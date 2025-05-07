import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";

export const retireLayout = createTool({
  id: 'retire-layout',
  description: 'レイアウトを廃止します',
  inputSchema: z.object({
    layoutId: z.number().describe('廃止するレイアウトのID')
  }),

  outputSchema: z.string(),
  execute: async ({ context }) => {
    try {
      console.log("[DEBUG] retireLayout: 開始");
      console.log("[DEBUG] retireLayout: config =", config);
      
      if (!config.cmsUrl) {
        console.error("[DEBUG] retireLayout: CMSのURLが設定されていません");
        throw new Error("CMSのURLが設定されていません");
      }
      console.log(`[DEBUG] retireLayout: CMS URL = ${config.cmsUrl}`);

      const headers = await getAuthHeaders();
      console.log("[DEBUG] retireLayout: 認証ヘッダーを取得しました");
      console.log("[DEBUG] retireLayout: 認証ヘッダー =", headers);

      console.log("[DEBUG] retireLayout: リクエストデータ =", context);

      const url = `${config.cmsUrl}/api/layout/${context.layoutId}/retire`;
      console.log(`[DEBUG] retireLayout: リクエストURL = ${url}`);

      const response = await fetch(url, {
        method: 'POST',
        headers,
      });

      console.log(`[DEBUG] retireLayout: レスポンスステータス = ${response.status}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error(`[DEBUG] retireLayout: HTTPエラーが発生しました: ${response.status}`, errorData);
        throw new Error(`HTTP error! status: ${response.status}${errorData ? `, message: ${JSON.stringify(errorData)}` : ''}`);
      }

      console.log("[DEBUG] retireLayout: レイアウトの廃止が成功しました");
      return "レイアウトが正常に廃止されました";
    } catch (error) {
      console.error("[DEBUG] retireLayout: エラーが発生しました", error);
      return `エラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`;
    }
  },
}); 