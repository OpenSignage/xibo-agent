import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";

export const setWidgetRegion = createTool({
  id: 'set-widget-region',
  description: 'ウィジェットのリージョンを設定します',
  inputSchema: z.object({
    widgetId: z.number().describe('リージョンを設定するウィジェットのID'),
    targetRegionId: z.string().describe('対象のリージョンID')
  }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        throw new Error("CMSのURLが設定されていません");
      }

      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/playlist/widget/${context.widgetId}/region`;
      console.log(`[DEBUG] setWidgetRegion: リクエストURL = ${url}`);

      const formData = new FormData();
      formData.append('targetRegionId', context.targetRegionId);

      const response = await fetch(url, {
        method: 'PUT',
        headers,
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error(`[DEBUG] setWidgetRegion: HTTPエラーが発生しました: ${response.status}`, errorData);
        throw new Error(`HTTP error! status: ${response.status}${errorData ? `, message: ${JSON.stringify(errorData)}` : ''}`);
      }

      console.log("[DEBUG] setWidgetRegion: ウィジェットのリージョン設定が成功しました");
      return "ウィジェットのリージョンが正常に設定されました";
    } catch (error) {
      console.error("[DEBUG] setWidgetRegion: エラーが発生しました", error);
      return `エラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`;
    }
  },
}); 