import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";

export const deleteWidgetData = createTool({
  id: 'delete-widget-data',
  description: 'ウィジェットのデータを削除します',
  inputSchema: z.object({
    widgetId: z.number().describe('データを削除するウィジェットのID'),
    dataId: z.number().describe('削除するデータのID')
  }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        throw new Error("CMSのURLが設定されていません");
      }

      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/playlist/widget/data/${context.widgetId}/${context.dataId}`;
      console.log(`[DEBUG] deleteWidgetData: リクエストURL = ${url}`);

      const response = await fetch(url, {
        method: 'DELETE',
        headers
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error(`[DEBUG] deleteWidgetData: HTTPエラーが発生しました: ${response.status}`, errorData);
        throw new Error(`HTTP error! status: ${response.status}${errorData ? `, message: ${JSON.stringify(errorData)}` : ''}`);
      }

      console.log("[DEBUG] deleteWidgetData: ウィジェットのデータ削除が成功しました");
      return "ウィジェットのデータが正常に削除されました";
    } catch (error) {
      console.error("[DEBUG] deleteWidgetData: エラーが発生しました", error);
      return `エラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`;
    }
  },
}); 