import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";

export const editWidgetTransition = createTool({
  id: 'edit-widget-transition',
  description: 'ウィジェットのトランジションを編集します',
  inputSchema: z.object({
    type: z.string().describe('トランジションタイプ（in, out）'),
    widgetId: z.number().describe('トランジションを追加するウィジェットのID'),
    transitionType: z.string().describe('トランジションの種類（fly, fadeIn, fadeOut）'),
    transitionDuration: z.number().optional().describe('トランジションの時間（ミリ秒）'),
    transitionDirection: z.string().optional().describe('トランジションの方向（N, NE, E, SE, S, SW, W, NW）')
  }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        throw new Error("CMSのURLが設定されていません");
      }

      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/playlist/widget/transition/${context.type}/${context.widgetId}`;
      console.log(`[DEBUG] editWidgetTransition: リクエストURL = ${url}`);

      const formData = new FormData();
      formData.append('transitionType', context.transitionType);
      if (context.transitionDuration) formData.append('transitionDuration', context.transitionDuration.toString());
      if (context.transitionDirection) formData.append('transitionDirection', context.transitionDirection);

      const response = await fetch(url, {
        method: 'PUT',
        headers,
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error(`[DEBUG] editWidgetTransition: HTTPエラーが発生しました: ${response.status}`, errorData);
        throw new Error(`HTTP error! status: ${response.status}${errorData ? `, message: ${JSON.stringify(errorData)}` : ''}`);
      }

      console.log("[DEBUG] editWidgetTransition: ウィジェットのトランジション編集が成功しました");
      return "ウィジェットのトランジションが正常に編集されました";
    } catch (error) {
      console.error("[DEBUG] editWidgetTransition: エラーが発生しました", error);
      return `エラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`;
    }
  },
}); 