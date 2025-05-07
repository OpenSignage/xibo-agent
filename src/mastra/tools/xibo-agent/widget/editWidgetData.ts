import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";

export const editWidgetData = createTool({
  id: 'edit-widget-data',
  description: 'ウィジェットのデータを編集します',
  inputSchema: z.object({
    widgetId: z.number().describe('データを編集するウィジェットのID'),
    dataId: z.number().describe('編集するデータのID'),
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
      const url = `${config.cmsUrl}/api/playlist/widget/data/${context.widgetId}/${context.dataId}`;
      console.log(`[DEBUG] editWidgetData: リクエストURL = ${url}`);

      const formData = new FormData();
      formData.append('data', context.data);
      if (context.displayOrder) formData.append('displayOrder', context.displayOrder.toString());

      const response = await fetch(url, {
        method: 'PUT',
        headers,
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error(`[DEBUG] editWidgetData: HTTPエラーが発生しました: ${response.status}`, errorData);
        throw new Error(`HTTP error! status: ${response.status}${errorData ? `, message: ${JSON.stringify(errorData)}` : ''}`);
      }

      console.log("[DEBUG] editWidgetData: ウィジェットのデータ編集が成功しました");
      return "ウィジェットのデータが正常に編集されました";
    } catch (error) {
      console.error("[DEBUG] editWidgetData: エラーが発生しました", error);
      return `エラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`;
    }
  },
}); 