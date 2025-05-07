import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";

export const addWidgetData = createTool({
  id: 'add-widget-data',
  description: 'ウィジェットにデータを追加します',
  inputSchema: z.object({
    widgetId: z.number().describe('データを追加するウィジェットのID'),
    data: z.string().describe('ウィジェットのデータ型に合わせたJSON形式のデータ'),
    displayOrder: z.number().optional().describe('表示順序')
  }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        throw new Error("CMSのURLが設定されていません");
      }

      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/playlist/widget/data/${context.widgetId}`;
      console.log(`[DEBUG] addWidgetData: リクエストURL = ${url}`);

      const formData = new FormData();
      formData.append('data', context.data);
      if (context.displayOrder) formData.append('displayOrder', context.displayOrder.toString());

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error(`[DEBUG] addWidgetData: HTTPエラーが発生しました: ${response.status}`, errorData);
        throw new Error(`HTTP error! status: ${response.status}${errorData ? `, message: ${JSON.stringify(errorData)}` : ''}`);
      }

      const location = response.headers.get('Location');
      console.log("[DEBUG] addWidgetData: ウィジェットのデータ追加が成功しました");
      return `ウィジェットのデータが正常に追加されました。Location: ${location}`;
    } catch (error) {
      console.error("[DEBUG] addWidgetData: エラーが発生しました", error);
      return `エラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`;
    }
  },
}); 