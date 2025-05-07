import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";

export const publishLayout = createTool({
  id: 'publish-layout',
  description: 'レイアウトを公開します',
  inputSchema: z.object({
    layoutId: z.number().describe('公開するレイアウトのID')
  }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        throw new Error("CMSのURLが設定されていません");
      }

      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/layout/${context.layoutId}/publish`;
      console.log(`[DEBUG] publishLayout: リクエストURL = ${url}`);

      const response = await fetch(url, {
        method: 'POST',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error(`[DEBUG] publishLayout: HTTPエラーが発生しました: ${response.status}`, errorData);
        throw new Error(`HTTP error! status: ${response.status}${errorData ? `, message: ${JSON.stringify(errorData)}` : ''}`);
      }

      console.log("[DEBUG] publishLayout: レイアウトの公開が成功しました");
      return "レイアウトが正常に公開されました";
    } catch (error) {
      console.error("[DEBUG] publishLayout: エラーが発生しました", error);
      return `エラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`;
    }
  },
}); 