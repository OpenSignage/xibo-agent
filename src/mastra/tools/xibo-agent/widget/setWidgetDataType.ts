import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";

export const setWidgetDataType = createTool({
  id: 'set-widget-data-type',
  description: 'ウィジェットのデータ型を設定します',
  inputSchema: z.object({
    widgetId: z.number().describe('データ型を設定するウィジェットのID'),
    dataType: z.string().describe('データ型のJSON表現')
  }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        throw new Error("CMSのURLが設定されていません");
      }

      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/playlist/widget/${context.widgetId}/dataType`;
      console.log(`[DEBUG] setWidgetDataType: リクエストURL = ${url}`);

      const response = await fetch(url, {
        method: 'PUT',
        headers,
        body: context.dataType
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error(`[DEBUG] setWidgetDataType: HTTPエラーが発生しました: ${response.status}`, errorData);
        throw new Error(`HTTP error! status: ${response.status}${errorData ? `, message: ${JSON.stringify(errorData)}` : ''}`);
      }

      console.log("[DEBUG] setWidgetDataType: ウィジェットのデータ型設定が成功しました");
      return "ウィジェットのデータ型が正常に設定されました";
    } catch (error) {
      console.error("[DEBUG] setWidgetDataType: エラーが発生しました", error);
      return `エラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`;
    }
  },
}); 