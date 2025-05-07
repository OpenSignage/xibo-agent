import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";

const layoutResponseSchema = z.array(z.object({
  layoutId: z.union([z.number(), z.string().transform(Number)]),
  ownerId: z.union([z.number(), z.string().transform(Number)]),
  campaignId: z.union([z.number(), z.string().transform(Number)]),
  parentId: z.union([z.number(), z.string().transform(Number)]).nullable(),
  publishedStatusId: z.union([z.number(), z.string().transform(Number)]),
  publishedStatus: z.string().nullable(),
  publishedDate: z.string().nullable(),
  backgroundImageId: z.union([z.number(), z.string().transform(Number)]).nullable(),
  schemaVersion: z.union([z.number(), z.string().transform(Number)]),
  layout: z.string().nullable(),
  description: z.string().nullable(),
  backgroundColor: z.string().nullable(),
  createdDt: z.string().nullable(),
  modifiedDt: z.string().nullable(),
  status: z.union([z.number(), z.string().transform(Number)]),
  retired: z.union([z.number(), z.string().transform(Number)]),
  backgroundzIndex: z.union([z.number(), z.string().transform(Number)]),
  width: z.union([z.number(), z.string().transform(Number)]),
  height: z.union([z.number(), z.string().transform(Number)]),
  orientation: z.string().nullable(),
  displayOrder: z.union([z.number(), z.string().transform(Number)]).nullable(),
  duration: z.union([z.number(), z.string().transform(Number)]),
  statusMessage: z.string().nullable(),
  enableStat: z.union([z.number(), z.string().transform(Number)]),
  autoApplyTransitions: z.union([z.number(), z.string().transform(Number)]),
  code: z.string().nullable(),
  isLocked: z.union([z.boolean(), z.array(z.any())]).transform(val => Array.isArray(val) ? false : val),
  regions: z.array(z.object({
    regionId: z.union([z.number(), z.string().transform(Number)]),
    layoutId: z.union([z.number(), z.string().transform(Number)]),
    ownerId: z.union([z.number(), z.string().transform(Number)]),
    type: z.string().nullable(),
    name: z.string().nullable(),
    width: z.union([z.number(), z.string().transform(Number)]),
    height: z.union([z.number(), z.string().transform(Number)]),
    top: z.union([z.number(), z.string().transform(Number)]),
    left: z.union([z.number(), z.string().transform(Number)]),
    zIndex: z.union([z.number(), z.string().transform(Number)]),
    syncKey: z.string().nullable(),
    regionOptions: z.array(z.object({
      regionId: z.union([z.number(), z.string().transform(Number)]),
      option: z.string().nullable(),
      value: z.string().nullable()
    })),
    permissions: z.array(z.object({
      permissionId: z.union([z.number(), z.string().transform(Number)]),
      entityId: z.union([z.number(), z.string().transform(Number)]),
      groupId: z.union([z.number(), z.string().transform(Number)]),
      objectId: z.union([z.number(), z.string().transform(Number)]),
      isUser: z.union([z.number(), z.string().transform(Number)]),
      entity: z.string().nullable(),
      objectIdString: z.string().nullable(),
      group: z.string().nullable(),
      view: z.union([z.number(), z.string().transform(Number)]),
      edit: z.union([z.number(), z.string().transform(Number)]),
      delete: z.union([z.number(), z.string().transform(Number)]),
      modifyPermissions: z.union([z.number(), z.string().transform(Number)])
    })),
    duration: z.union([z.number(), z.string().transform(Number)]),
    isDrawer: z.union([z.number(), z.string().transform(Number)]),
    regionPlaylist: z.object({
      playlistId: z.union([z.number(), z.string().transform(Number)]),
      ownerId: z.union([z.number(), z.string().transform(Number)]),
      name: z.string().nullable(),
      regionId: z.union([z.number(), z.string().transform(Number)]),
      isDynamic: z.union([z.number(), z.string().transform(Number)]),
      filterMediaName: z.string().nullable(),
      filterMediaNameLogicalOperator: z.string().nullable(),
      filterMediaTags: z.string().nullable(),
      filterExactTags: z.union([z.number(), z.string().transform(Number)]),
      filterMediaTagsLogicalOperator: z.string().nullable(),
      filterFolderId: z.union([z.number(), z.string().transform(Number)]),
      maxNumberOfItems: z.union([z.number(), z.string().transform(Number)]),
      createdDt: z.string().nullable(),
      modifiedDt: z.string().nullable(),
      duration: z.union([z.number(), z.string().transform(Number)]),
      requiresDurationUpdate: z.union([z.number(), z.string().transform(Number)]),
      enableStat: z.string().nullable(),
      tags: z.array(z.object({
        tag: z.string().nullable(),
        tagId: z.union([z.number(), z.string().transform(Number)]),
        value: z.string().nullable()
      })),
      widgets: z.array(z.object({
        widgetId: z.union([z.number(), z.string().transform(Number)]),
        playlistId: z.union([z.number(), z.string().transform(Number)]),
        ownerId: z.union([z.number(), z.string().transform(Number)]),
        type: z.string().nullable(),
        duration: z.union([z.number(), z.string().transform(Number)]),
        displayOrder: z.union([z.number(), z.string().transform(Number)]),
        useDuration: z.union([z.number(), z.string().transform(Number)]),
        calculatedDuration: z.union([z.number(), z.string().transform(Number)]),
        createdDt: z.string().nullable(),
        modifiedDt: z.string().nullable(),
        fromDt: z.union([z.number(), z.string().transform(Number)]),
        toDt: z.union([z.number(), z.string().transform(Number)]),
        schemaVersion: z.union([z.number(), z.string().transform(Number)]),
        transitionIn: z.union([z.number(), z.string().transform(Number)]),
        transitionOut: z.union([z.number(), z.string().transform(Number)]),
        transitionDurationIn: z.union([z.number(), z.string().transform(Number)]),
        transitionDurationOut: z.union([z.number(), z.string().transform(Number)]),
        widgetOptions: z.array(z.object({
          widgetId: z.union([z.number(), z.string().transform(Number)]),
          type: z.string().nullable(),
          option: z.string().nullable(),
          value: z.string().nullable()
        })),
        mediaIds: z.array(z.union([z.number(), z.string().transform(Number)])),
        audio: z.array(z.object({
          widgetId: z.union([z.number(), z.string().transform(Number)]),
          mediaId: z.union([z.number(), z.string().transform(Number)]),
          volume: z.union([z.number(), z.string().transform(Number)]),
          loop: z.union([z.number(), z.string().transform(Number)])
        })),
        permissions: z.array(z.object({
          permissionId: z.union([z.number(), z.string().transform(Number)]),
          entityId: z.union([z.number(), z.string().transform(Number)]),
          groupId: z.union([z.number(), z.string().transform(Number)]),
          objectId: z.union([z.number(), z.string().transform(Number)]),
          isUser: z.union([z.number(), z.string().transform(Number)]),
          entity: z.string().nullable(),
          objectIdString: z.string().nullable(),
          group: z.string().nullable(),
          view: z.union([z.number(), z.string().transform(Number)]),
          edit: z.union([z.number(), z.string().transform(Number)]),
          delete: z.union([z.number(), z.string().transform(Number)]),
          modifyPermissions: z.union([z.number(), z.string().transform(Number)])
        })),
        playlist: z.string().nullable()
      })),
      permissions: z.array(z.object({
        permissionId: z.union([z.number(), z.string().transform(Number)]),
        entityId: z.union([z.number(), z.string().transform(Number)]),
        groupId: z.union([z.number(), z.string().transform(Number)]),
        objectId: z.union([z.number(), z.string().transform(Number)]),
        isUser: z.union([z.number(), z.string().transform(Number)]),
        entity: z.string().nullable(),
        objectIdString: z.string().nullable(),
        group: z.string().nullable(),
        view: z.union([z.number(), z.string().transform(Number)]),
        edit: z.union([z.number(), z.string().transform(Number)]),
        delete: z.union([z.number(), z.string().transform(Number)]),
        modifyPermissions: z.union([z.number(), z.string().transform(Number)])
      })),
      folderId: z.union([z.number(), z.string().transform(Number)]),
      permissionsFolderId: z.union([z.number(), z.string().transform(Number)])
    })
  })),
  tags: z.array(z.object({
    tag: z.string().nullable(),
    tagId: z.union([z.number(), z.string().transform(Number)]),
    value: z.string().nullable()
  })),
  folderId: z.union([z.number(), z.string().transform(Number)]),
  permissionsFolderId: z.union([z.number(), z.string().transform(Number)])
}));

export const getLayouts = createTool({
  id: 'get-layouts',
  description: 'Xiboのレイアウト一覧を取得します',
  inputSchema: z.object({
    layoutId: z.number().optional().describe('レイアウトIDでフィルタリング'),
    parentId: z.number().optional().describe('親IDでフィルタリング'),
    showDrafts: z.number().optional().describe('下書きを表示するかどうか（0-1）'),
    layout: z.string().optional().describe('レイアウト名で部分一致検索'),
    userId: z.number().optional().describe('ユーザーIDでフィルタリング'),
    retired: z.number().optional().describe('廃止フラグでフィルタリング（0-1）'),
    tags: z.string().optional().describe('タグでフィルタリング'),
    exactTags: z.number().optional().describe('タグを完全一致で検索するかどうか（0-1）'),
    logicalOperator: z.enum(['AND', 'OR']).optional().describe('複数タグでの検索時の論理演算子'),
    ownerUserGroupId: z.number().optional().describe('ユーザーグループIDでフィルタリング'),
    publishedStatusId: z.number().optional().describe('公開状態でフィルタリング（1: 公開済み、2: 下書き）'),
    embed: z.string().optional().describe('関連データ（regions, playlists, widgets, tags, campaigns, permissions）を含めるかどうか'),
    campaignId: z.number().optional().describe('キャンペーンIDに属するレイアウトを取得'),
    folderId: z.number().optional().describe('フォルダIDでフィルタリング')
  }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        throw new Error("CMSのURLが設定されていません");
      }

      const headers = await getAuthHeaders();
      
      // クエリパラメータの構築
      const queryParams = new URLSearchParams();
      if (context.layoutId) queryParams.append('layoutId', context.layoutId.toString());
      if (context.parentId) queryParams.append('parentId', context.parentId.toString());
      if (context.showDrafts !== undefined) queryParams.append('showDrafts', context.showDrafts.toString());
      if (context.layout) queryParams.append('layout', context.layout);
      if (context.userId) queryParams.append('userId', context.userId.toString());
      if (context.retired !== undefined) queryParams.append('retired', context.retired.toString());
      if (context.tags) queryParams.append('tags', context.tags);
      if (context.exactTags !== undefined) queryParams.append('exactTags', context.exactTags.toString());
      if (context.logicalOperator) queryParams.append('logicalOperator', context.logicalOperator);
      if (context.ownerUserGroupId) queryParams.append('ownerUserGroupId', context.ownerUserGroupId.toString());
      if (context.publishedStatusId) queryParams.append('publishedStatusId', context.publishedStatusId.toString());
      if (context.embed) queryParams.append('embed', context.embed);
      if (context.campaignId) queryParams.append('campaignId', context.campaignId.toString());
      if (context.folderId) queryParams.append('folderId', context.folderId.toString());

      const url = `${config.cmsUrl}/api/layout${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      console.log(`[DEBUG] getLayouts: リクエストURL = ${url}`);

      const response = await fetch(url, {
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error(`[DEBUG] getLayouts: HTTPエラーが発生しました: ${response.status}`, errorData);
        throw new Error(`HTTP error! status: ${response.status}${errorData ? `, message: ${JSON.stringify(errorData)}` : ''}`);
      }

      const data = await response.json();
      console.log("[DEBUG] getLayouts: レスポンスデータを取得しました");
      console.log("[DEBUG] getLayouts: レスポンスデータの構造:");
      console.log("生データ:", JSON.stringify(data, null, 2));
      console.log("データ型:", typeof data);
      console.log("キー一覧:", Object.keys(data));

      const validatedData = layoutResponseSchema.parse(data);
      console.log("[DEBUG] getLayouts: データの検証が成功しました");

      return JSON.stringify(validatedData, null, 2);
    } catch (error) {
      console.error("[DEBUG] getLayouts: エラーが発生しました", error);
      return `エラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`;
    }
  },
});