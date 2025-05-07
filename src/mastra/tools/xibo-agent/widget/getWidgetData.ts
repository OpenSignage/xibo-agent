import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";

const widgetDataSchema = z.object({
  id: z.number(),
  widgetId: z.number(),
  data: z.array(z.string()),
  displayOrder: z.number(),
  createdDt: z.string(),
  modifiedDt: z.string()
});

export const getWidgetData = createTool({
  id: 'get-widget-data',
  description: 'ウィジェットのデータを取得します',
  inputSchema: z.object({
    widgetId: z.number().describe('データを取得するウィジェットのID')
  }),
  outputSchema: z.array(widgetDataSchema),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        throw new Error("CMSのURLが設定されていません");
      }

      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/playlist/widget/data/${context.widgetId}`;
      console.log(`[DEBUG] getWidgetData: リクエストURL = ${url}`);

      const response = await fetch(url, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error(`[DEBUG] getWidgetData: HTTPエラーが発生しました: ${response.status}`, errorData);
        throw new Error(`HTTP error! status: ${response.status}${errorData ? `, message: ${JSON.stringify(errorData)}` : ''}`);
      }

      const data = await response.json();
      console.log("[DEBUG] getWidgetData: ウィジェットのデータ取得が成功しました");
      return data;
    } catch (error) {
      console.error("[DEBUG] getWidgetData: エラーが発生しました", error);
      throw error;
    }
  },
}); 