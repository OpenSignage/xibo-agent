import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";

export const deleteLayout = createTool({
  id: 'delete-layout',
  description: 'レイアウトを削除します',
  inputSchema: z.object({
    layoutId: z.number().describe('削除するレイアウトID')
  }),

  outputSchema: z.string(),
  execute: async ({ context }) => {
    try {
      console.log("[DEBUG] deleteLayout: 開始");
      console.log("[DEBUG] deleteLayout: config =", config);
      
      if (!config.cmsUrl) {
        console.error("[DEBUG] deleteLayout: CMSのURLが設定されていません");
        throw new Error("CMSのURLが設定されていません");
      }
      console.log(`[DEBUG] deleteLayout: CMS URL = ${config.cmsUrl}`);

      const headers = await getAuthHeaders();
      console.log("[DEBUG] deleteLayout: 認証ヘッダーを取得しました");
      console.log("[DEBUG] deleteLayout: 認証ヘッダー =", headers);

      console.log("[DEBUG] deleteLayout: リクエストデータ =", context);

      const url = `${config.cmsUrl}/api/layout/${context.layoutId}`;
      console.log(`[DEBUG] deleteLayout: リクエストURL = ${url}`);

      const response = await fetch(url, {
        method: 'DELETE',
        headers: headers
      });

      console.log(`[DEBUG] deleteLayout: レスポンスステータス = ${response.status}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error(`[DEBUG] deleteLayout: HTTPエラーが発生しました: ${response.status}`, errorData);
        throw new Error(`HTTP error! status: ${response.status}${errorData ? `, message: ${JSON.stringify(errorData)}` : ''}`);
      }

      return "レイアウトが正常に削除されました";
    } catch (error) {
      console.error("[DEBUG] deleteLayout: エラーが発生しました", error);
      return `エラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`;
    }
  },
}); 