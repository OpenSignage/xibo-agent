import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";

export const saveWidgetElements = createTool({
  id: 'save-widget-elements',
  description: 'ウィジェットの要素を保存します',
  inputSchema: z.object({
    widgetId: z.number().describe('要素を保存するウィジェットのID'),
    elements: z.string().describe('ウィジェットに割り当てる要素のJSON')
  }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        throw new Error("CMSのURLが設定されていません");
      }

      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/playlist/widget/${context.widgetId}/elements`;
      console.log(`[DEBUG] saveWidgetElements: リクエストURL = ${url}`);

      const response = await fetch(url, {
        method: 'PUT',
        headers,
        body: context.elements
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error(`[DEBUG] saveWidgetElements: HTTPエラーが発生しました: ${response.status}`, errorData);
        throw new Error(`HTTP error! status: ${response.status}${errorData ? `, message: ${JSON.stringify(errorData)}` : ''}`);
      }

      console.log("[DEBUG] saveWidgetElements: ウィジェットの要素保存が成功しました");
      return "ウィジェットの要素が正常に保存されました";
    } catch (error) {
      console.error("[DEBUG] saveWidgetElements: エラーが発生しました", error);
      return `エラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`;
    }
  },
}); 