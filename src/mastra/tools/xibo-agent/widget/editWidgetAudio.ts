import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";

export const editWidgetAudio = createTool({
  id: 'edit-widget-audio',
  description: 'ウィジェットのオーディオを編集します',
  inputSchema: z.object({
    widgetId: z.number().describe('オーディオを編集するウィジェットのID'),
    mediaId: z.number().optional().describe('CMSライブラリのオーディオファイルID'),
    volume: z.number().optional().describe('音量（0-100）'),
    loop: z.number().optional().describe('ループ再生フラグ（0: ループしない, 1: ループする）')
  }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        throw new Error("CMSのURLが設定されていません");
      }

      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/playlist/widget/audio/${context.widgetId}`;
      console.log(`[DEBUG] editWidgetAudio: リクエストURL = ${url}`);

      const formData = new FormData();
      if (context.mediaId) formData.append('mediaId', context.mediaId.toString());
      if (context.volume) formData.append('volume', context.volume.toString());
      if (context.loop !== undefined) formData.append('loop', context.loop.toString());

      const response = await fetch(url, {
        method: 'PUT',
        headers,
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error(`[DEBUG] editWidgetAudio: HTTPエラーが発生しました: ${response.status}`, errorData);
        throw new Error(`HTTP error! status: ${response.status}${errorData ? `, message: ${JSON.stringify(errorData)}` : ''}`);
      }

      const data = await response.json();
      console.log("[DEBUG] editWidgetAudio: ウィジェットのオーディオ編集が成功しました");
      return JSON.stringify(data);
    } catch (error) {
      console.error("[DEBUG] editWidgetAudio: エラーが発生しました", error);
      return `エラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`;
    }
  },
}); 