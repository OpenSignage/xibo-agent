import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";

export const deleteWidgetAudio = createTool({
  id: 'delete-widget-audio',
  description: 'ウィジェットのオーディオを削除します',
  inputSchema: z.object({
    widgetId: z.number().describe('オーディオを削除するウィジェットのID')
  }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        throw new Error("CMSのURLが設定されていません");
      }

      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/playlist/widget/audio/${context.widgetId}`;
      console.log(`[DEBUG] deleteWidgetAudio: リクエストURL = ${url}`);

      const response = await fetch(url, {
        method: 'DELETE',
        headers
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error(`[DEBUG] deleteWidgetAudio: HTTPエラーが発生しました: ${response.status}`, errorData);
        throw new Error(`HTTP error! status: ${response.status}${errorData ? `, message: ${JSON.stringify(errorData)}` : ''}`);
      }

      console.log("[DEBUG] deleteWidgetAudio: ウィジェットのオーディオ削除が成功しました");
      return "ウィジェットのオーディオが正常に削除されました";
    } catch (error) {
      console.error("[DEBUG] deleteWidgetAudio: エラーが発生しました", error);
      return `エラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`;
    }
  },
}); 