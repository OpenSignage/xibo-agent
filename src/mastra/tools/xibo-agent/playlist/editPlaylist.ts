import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";

export const editPlaylist = createTool({
  id: 'edit-playlist',
  description: 'プレイリストを編集します',
  inputSchema: z.object({
    playlistId: z.number().describe('編集するプレイリストのID'),
    name: z.string().describe('プレイリストの名前'),
    tags: z.string().optional().describe('タグ'),
    isDynamic: z.number().describe('動的プレイリストかどうか（0: 静的, 1: 動的）'),
    filterMediaName: z.string().optional().describe('メディア名でフィルタリング'),
    logicalOperatorName: z.string().optional().describe('複数名の論理演算子（AND|OR）'),
    filterMediaTag: z.string().optional().describe('メディアタグでフィルタリング'),
    exactTags: z.number().optional().describe('タグの完全一致フラグ'),
    logicalOperator: z.string().optional().describe('タグの論理演算子（AND|OR）'),
    maxNumberOfItems: z.number().optional().describe('最大アイテム数（動的プレイリストのみ）'),
    folderId: z.number().optional().describe('フォルダID')
  }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        throw new Error("CMSのURLが設定されていません");
      }

      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/playlist/${context.playlistId}`;
      console.log(`[DEBUG] putPlaylist: リクエストURL = ${url}`);

      const formData = new FormData();
      formData.append('name', context.name);
      formData.append('isDynamic', context.isDynamic.toString());
      if (context.tags) formData.append('tags', context.tags);
      if (context.filterMediaName) formData.append('filterMediaName', context.filterMediaName);
      if (context.logicalOperatorName) formData.append('logicalOperatorName', context.logicalOperatorName);
      if (context.filterMediaTag) formData.append('filterMediaTag', context.filterMediaTag);
      if (context.exactTags) formData.append('exactTags', context.exactTags.toString());
      if (context.logicalOperator) formData.append('logicalOperator', context.logicalOperator);
      if (context.maxNumberOfItems) formData.append('maxNumberOfItems', context.maxNumberOfItems.toString());
      if (context.folderId) formData.append('folderId', context.folderId.toString());

      const response = await fetch(url, {
        method: 'PUT',
        headers,
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error(`[DEBUG] putPlaylist: HTTPエラーが発生しました: ${response.status}`, errorData);
        throw new Error(`HTTP error! status: ${response.status}${errorData ? `, message: ${JSON.stringify(errorData)}` : ''}`);
      }

      console.log("[DEBUG] putPlaylist: プレイリストの編集が成功しました");
      return "プレイリストが正常に編集されました";
    } catch (error) {
      console.error("[DEBUG] putPlaylist: エラーが発生しました", error);
      return `エラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`;
    }
  },
}); 