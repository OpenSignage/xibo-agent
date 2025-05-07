import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";

const widgetOrderSchema = z.object({
  widgetId: z.number(),
  position: z.number()
});

export const orderWidgets = createTool({
  id: 'order-widgets',
  description: 'プレイリスト内のウィジェットの順序を設定します',
  inputSchema: z.object({
    playlistId: z.number().describe('順序を設定するプレイリストのID'),
    widgets: z.array(widgetOrderSchema).describe('ウィジェットIDと位置の配列')
  }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        throw new Error("CMSのURLが設定されていません");
      }

      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/playlist/order/${context.playlistId}`;
      console.log(`[DEBUG] orderWidgets: リクエストURL = ${url}`);

      const formData = new FormData();
      context.widgets.forEach(widget => {
        formData.append('widgets[]', JSON.stringify(widget));
      });

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error(`[DEBUG] orderWidgets: HTTPエラーが発生しました: ${response.status}`, errorData);
        throw new Error(`HTTP error! status: ${response.status}${errorData ? `, message: ${JSON.stringify(errorData)}` : ''}`);
      }

      const data = await response.json();
      console.log("[DEBUG] orderWidgets: ウィジェットの順序設定が成功しました");
      return JSON.stringify(data);
    } catch (error) {
      console.error("[DEBUG] orderWidgets: エラーが発生しました", error);
      return `エラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`;
    }
  },
}); 