import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";

export const deleteWidget = createTool({
  id: 'delete-widget',
  description: 'ウィジェットを削除します',
  inputSchema: z.object({
    widgetId: z.number().describe('削除するウィジェットのID')
  }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        throw new Error("CMSのURLが設定されていません");
      }

      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/playlist/widget/${context.widgetId}`;
      console.log(`[DEBUG] deleteWidget: リクエストURL = ${url}`);

      const response = await fetch(url, {
        method: 'DELETE',
        headers
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error(`[DEBUG] deleteWidget: HTTPエラーが発生しました: ${response.status}`, errorData);
        throw new Error(`HTTP error! status: ${response.status}${errorData ? `, message: ${JSON.stringify(errorData)}` : ''}`);
      }

      console.log("[DEBUG] deleteWidget: ウィジェットの削除が成功しました");
      return "ウィジェットが正常に削除されました";
    } catch (error) {
      console.error("[DEBUG] deleteWidget: エラーが発生しました", error);
      return `エラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`;
    }
  },
}); 