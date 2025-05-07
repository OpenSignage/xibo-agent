import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";

const playlistSchema = z.object({
  playlistId: z.number(),
  ownerId: z.number(),
  name: z.string(),
  regionId: z.number().optional(),
  isDynamic: z.number(),
  filterMediaName: z.string().optional(),
  filterMediaNameLogicalOperator: z.string().optional(),
  filterMediaTags: z.string().optional(),
  filterExactTags: z.number().optional(),
  filterMediaTagsLogicalOperator: z.string().optional(),
  filterFolderId: z.number().optional(),
  maxNumberOfItems: z.number().optional(),
  createdDt: z.string(),
  modifiedDt: z.string(),
  duration: z.number().optional(),
  requiresDurationUpdate: z.number().optional(),
  enableStat: z.string().optional(),
  tags: z.array(z.object({
    tagId: z.number(),
    tag: z.string()
  })).optional(),
  widgets: z.array(z.object({
    widgetId: z.number(),
    type: z.string(),
    duration: z.number().optional(),
    useDuration: z.number().optional(),
    displayOrder: z.number().optional()
  })).optional(),
  permissions: z.array(z.object({
    groupId: z.number(),
    view: z.number(),
    edit: z.number(),
    delete: z.number()
  })).optional(),
  folderId: z.number().optional(),
  permissionsFolderId: z.number().optional()
});

export const getPlaylists = createTool({
  id: 'get-playlists',
  description: 'プレイリストを検索します',
  inputSchema: z.object({
    playlistId: z.number().optional().describe('プレイリストIDでフィルタリング'),
    name: z.string().optional().describe('プレイリスト名でフィルタリング（部分一致）'),
    userId: z.number().optional().describe('ユーザーIDでフィルタリング'),
    tags: z.string().optional().describe('タグでフィルタリング'),
    exactTags: z.number().optional().describe('タグの完全一致フラグ'),
    logicalOperator: z.string().optional().describe('複数タグの論理演算子（AND|OR）'),
    ownerUserGroupId: z.number().optional().describe('ユーザーグループIDでフィルタリング'),
    embed: z.string().optional().describe('関連データの埋め込み（regions, widgets, permissions, tags）'),
    folderId: z.number().optional().describe('フォルダIDでフィルタリング')
  }),
  outputSchema: z.array(playlistSchema),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        throw new Error("CMSのURLが設定されていません");
      }

      const headers = await getAuthHeaders();
      const params = new URLSearchParams();
      
      if (context.playlistId) params.append('playlistId', context.playlistId.toString());
      if (context.name) params.append('name', context.name);
      if (context.userId) params.append('userId', context.userId.toString());
      if (context.tags) params.append('tags', context.tags);
      if (context.exactTags) params.append('exactTags', context.exactTags.toString());
      if (context.logicalOperator) params.append('logicalOperator', context.logicalOperator);
      if (context.ownerUserGroupId) params.append('ownerUserGroupId', context.ownerUserGroupId.toString());
      if (context.embed) params.append('embed', context.embed);
      if (context.folderId) params.append('folderId', context.folderId.toString());

      const url = `${config.cmsUrl}/api/playlist?${params.toString()}`;
      console.log(`[DEBUG] getPlaylists: リクエストURL = ${url}`);

      const response = await fetch(url, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error(`[DEBUG] getPlaylists: HTTPエラーが発生しました: ${response.status}`, errorData);
        throw new Error(`HTTP error! status: ${response.status}${errorData ? `, message: ${JSON.stringify(errorData)}` : ''}`);
      }

      const data = await response.json();
      console.log("[DEBUG] getPlaylists: プレイリストの取得が成功しました");
      return data;
    } catch (error) {
      console.error("[DEBUG] getPlaylists: エラーが発生しました", error);
      throw error;
    }
  },
}); 