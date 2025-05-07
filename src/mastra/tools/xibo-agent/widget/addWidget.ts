import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";

export const addWidget = createTool({
  id: 'add-widget',
  description: 'プレイリストにウィジェットを追加します',
  inputSchema: z.object({
    type: z.string().describe('ウィジェットのタイプ（例：text）'),
    playlistId: z.number().describe('プレイリストID'),
    displayOrder: z.number().optional().describe('表示順序'),
    templateId: z.string().optional().describe('テンプレートID（モジュールタイプにdataTypeがある場合）')
  }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        throw new Error("CMSのURLが設定されていません");
      }

      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/playlist/widget/${context.type}/${context.playlistId}`;
      console.log(`[DEBUG] addWidget: リクエストURL = ${url}`);

      const formData = new FormData();
      if (context.displayOrder) formData.append('displayOrder', context.displayOrder.toString());
      if (context.templateId) formData.append('templateId', context.templateId);

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error(`[DEBUG] addWidget: HTTPエラーが発生しました: ${response.status}`, errorData);
        throw new Error(`HTTP error! status: ${response.status}${errorData ? `, message: ${JSON.stringify(errorData)}` : ''}`);
      }

      const location = response.headers.get('Location');
      console.log("[DEBUG] addWidget: ウィジェットの追加が成功しました");
      return `ウィジェットが正常に追加されました。Location: ${location}`;
    } catch (error) {
      console.error("[DEBUG] addWidget: エラーが発生しました", error);
      return `エラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`;
    }
  },
}); 