import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";

export const unretireLayout = createTool({
  id: 'unretire-layout',
  description: 'レイアウトの廃止を解除します',
  inputSchema: z.object({
    layoutId: z.number().describe('廃止を解除するレイアウトのID')
  }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        throw new Error("CMSのURLが設定されていません");
      }

      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/layout/${context.layoutId}/unretire`;
      console.log(`[DEBUG] unretireLayout: リクエストURL = ${url}`);

      const response = await fetch(url, {
        method: 'POST',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error(`[DEBUG] unretireLayout: HTTPエラーが発生しました: ${response.status}`, errorData);
        throw new Error(`HTTP error! status: ${response.status}${errorData ? `, message: ${JSON.stringify(errorData)}` : ''}`);
      }

      console.log("[DEBUG] unretireLayout: レイアウトの廃止解除が成功しました");
      return "レイアウトの廃止が正常に解除されました";
    } catch (error) {
      console.error("[DEBUG] unretireLayout: エラーが発生しました", error);
      return `エラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`;
    }
  },
}); 