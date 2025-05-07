import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";

export const assignLibraryItems = createTool({
  id: 'assign-library-items',
  description: 'ライブラリアイテムをプレイリストに割り当てます',
  inputSchema: z.object({
    playlistId: z.number().describe('割り当て先のプレイリストID'),
    media: z.array(z.number()).describe('割り当てるメディアIDの配列'),
    duration: z.number().optional().describe('ウィジェットの表示時間（秒）'),
    useDuration: z.number().optional().describe('表示時間を使用するかどうか（0: 使用しない, 1: 使用する）'),
    displayOrder: z.number().optional().describe('表示順序')
  }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        throw new Error("CMSのURLが設定されていません");
      }

      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/playlist/library/assign/${context.playlistId}`;
      console.log(`[DEBUG] assignLibraryItems: リクエストURL = ${url}`);

      const formData = new FormData();
      context.media.forEach(mediaId => {
        formData.append('media[]', mediaId.toString());
      });
      if (context.duration) formData.append('duration', context.duration.toString());
      if (context.useDuration) formData.append('useDuration', context.useDuration.toString());
      if (context.displayOrder) formData.append('displayOrder', context.displayOrder.toString());

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error(`[DEBUG] assignLibraryItems: HTTPエラーが発生しました: ${response.status}`, errorData);
        throw new Error(`HTTP error! status: ${response.status}${errorData ? `, message: ${JSON.stringify(errorData)}` : ''}`);
      }

      const data = await response.json();
      console.log("[DEBUG] assignLibraryItems: ライブラリアイテムの割り当てが成功しました");
      return JSON.stringify(data);
    } catch (error) {
      console.error("[DEBUG] assignLibraryItems: エラーが発生しました", error);
      return `エラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`;
    }
  },
}); 