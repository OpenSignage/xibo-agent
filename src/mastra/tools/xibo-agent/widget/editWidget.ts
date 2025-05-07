import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";

export const editWidget = createTool({
  id: 'edit-widget',
  description: 'ウィジェットを編集します',
  inputSchema: z.object({
    widgetId: z.number().describe('編集するウィジェットのID'),
    useDuration: z.number().optional().describe('表示時間を使用するかどうか（0: 使用しない, 1: 使用する）'),
    duration: z.number().optional().describe('表示時間（秒）'),
    name: z.string().optional().describe('ウィジェットの名前'),
    enableStat: z.string().optional().describe('統計収集の設定（On|Off|Inherit）')
  }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        throw new Error("CMSのURLが設定されていません");
      }

      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/playlist/widget/${context.widgetId}`;
      console.log(`[DEBUG] editWidget: リクエストURL = ${url}`);

      const formData = new FormData();
      if (context.useDuration !== undefined) formData.append('useDuration', context.useDuration.toString());
      if (context.duration) formData.append('duration', context.duration.toString());
      if (context.name) formData.append('name', context.name);
      if (context.enableStat) formData.append('enableStat', context.enableStat);

      const response = await fetch(url, {
        method: 'PUT',
        headers,
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error(`[DEBUG] editWidget: HTTPエラーが発生しました: ${response.status}`, errorData);
        throw new Error(`HTTP error! status: ${response.status}${errorData ? `, message: ${JSON.stringify(errorData)}` : ''}`);
      }

      console.log("[DEBUG] editWidget: ウィジェットの編集が成功しました");
      return "ウィジェットが正常に編集されました";
    } catch (error) {
      console.error("[DEBUG] editWidget: エラーが発生しました", error);
      return `エラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`;
    }
  },
}); 