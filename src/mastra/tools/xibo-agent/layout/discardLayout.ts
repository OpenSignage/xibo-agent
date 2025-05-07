import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";

export const discardLayout = createTool({
  id: 'discard-layout',
  description: 'レイアウトの変更を破棄します',
  inputSchema: z.object({
    layoutId: z.number().describe('変更を破棄するレイアウトのID')
  }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        throw new Error("CMSのURLが設定されていません");
      }

      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/layout/discard/${context.layoutId}`;
      console.log(`[DEBUG] discardLayout: リクエストURL = ${url}`);

      const response = await fetch(url, {
        method: 'POST',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error(`[DEBUG] discardLayout: HTTPエラーが発生しました: ${response.status}`, errorData);
        throw new Error(`HTTP error! status: ${response.status}${errorData ? `, message: ${JSON.stringify(errorData)}` : ''}`);
      }

      console.log("[DEBUG] discardLayout: レイアウトの変更破棄が成功しました");
      return "レイアウトの変更が正常に破棄されました";
    } catch (error) {
      console.error("[DEBUG] discardLayout: エラーが発生しました", error);
      return `エラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`;
    }
  },
}); 