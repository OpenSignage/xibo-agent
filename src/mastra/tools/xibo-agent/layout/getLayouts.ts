/*
 * Copyright (C) 2025 Open Source Digital Signage Initiative.
 *
 * You can redistribute it and/or modify
 * it under the terms of the Elastic License 2.0 (ELv2) as published by
 * the Search AI Company, either version 3 of the License, or
 * any later version.
 *
 * You should have received a copy of the GElastic License 2.0 (ELv2).
 * see <https://www.elastic.co/licensing/elastic-license>.
 */

/**
 * Layout Management Tool
 * This module provides functionality to retrieve and manage Xibo layouts
 * through the CMS API with comprehensive data validation
 */

import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { decodeErrorMessage } from "../utility/error";
import { logger } from '../../../index';
import { 
  TreeNode, 
  treeResponseSchema, 
  generateTreeView, 
  flattenTree, 
  createTreeViewResponse 
} from "../utility/treeView";

// Schema definition for layout response validation
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
    }).nullable()
  })),
  tags: z.array(z.object({
    tag: z.string().nullable(),
    tagId: z.union([z.number(), z.string().transform(Number)]),
    value: z.string().nullable()
  })),
  folderId: z.union([z.number(), z.string().transform(Number)]),
  permissionsFolderId: z.union([z.number(), z.string().transform(Number)])
}));

/**
 * レイアウトのツリー表示に使用するノード変換関数
 * APIレスポンスからツリーノード構造に変換する
 * 
 * @param layouts APIから取得したレイアウト配列
 * @returns ツリーノード配列
 */
function buildLayoutTree(layouts: any[]): TreeNode[] {
  const tree: TreeNode[] = [];
  
  layouts.forEach(layout => {
    // レイアウトノードを作成
    const layoutNode: TreeNode = {
      type: 'layout',
      id: layout.layoutId,
      name: layout.layout || `Layout ${layout.layoutId}`,
      children: []
    };
    
    // リージョンを追加
    if (layout.regions && Array.isArray(layout.regions)) {
      layout.regions.forEach((region: any) => {
        const regionNode: TreeNode = {
          type: 'region',
          id: region.regionId,
          name: region.name || `Region ${region.regionId}`,
          children: []
        };
        
        // プレイリストを追加
        if (region.regionPlaylist) {
          const playlist = region.regionPlaylist;
          const playlistNode: TreeNode = {
            type: 'playlist',
            id: playlist.playlistId,
            name: playlist.name || `Playlist ${playlist.playlistId}`,
            children: []
          };
          
          // ウィジェットを追加
          if (playlist.widgets && Array.isArray(playlist.widgets)) {
            playlist.widgets.forEach((widget: any) => {
              const widgetNode: TreeNode = {
                type: 'widget',
                id: widget.widgetId,
                name: `${widget.type || 'Widget'} (${widget.widgetId})`,
                duration: widget.duration
              };
              playlistNode.children?.push(widgetNode);
            });
          }
          
          regionNode.children?.push(playlistNode);
        }
        
        layoutNode.children?.push(regionNode);
      });
    }
    
    // タグを追加
    if (layout.tags && Array.isArray(layout.tags) && layout.tags.length > 0) {
      const tagsNode: TreeNode = {
        type: 'tags',
        id: 0,
        name: 'Tags',
        children: []
      };
      
      layout.tags.forEach((tag: any) => {
        const tagNode: TreeNode = {
          type: 'tag',
          id: tag.tagId,
          name: tag.tag || `Tag ${tag.tagId}`
        };
        tagsNode.children?.push(tagNode);
      });
      
      layoutNode.children?.push(tagsNode);
    }
    
    tree.push(layoutNode);
  });
  
  return tree;
}

/**
 * レイアウトノードのカスタム表示フォーマッタ
 * 
 * @param node ツリーノード
 * @returns フォーマットされた表示文字列
 */
function layoutNodeFormatter(node: TreeNode): string {
  switch (node.type) {
    case 'layout':
      return `Layout: ${node.name}`;
    case 'region':
      return `Region: ${node.name}`;
    case 'playlist':
      return `Playlist: ${node.name}`;
    case 'widget':
      return `${node.name}${node.duration ? ` (${node.duration}s)` : ''}`;
    default:
      return `${node.type}: ${node.name}`;
  }
}

/**
 * Tool for retrieving Xibo layouts with filtering options
 * 
 * Example usage with embed parameter:
 * ```
 * const layouts = await getLayouts.execute({
 *   context: {
 *     // Basic filtering
 *     layoutId: 123,
 *     // Include related data using embed parameter
 *     embed: "regions,playlists,widgets,tags"
 *     // OR as an array
 *     // embed: ["regions", "playlists", "widgets", "tags"]
 *     // Tree view option
 *     treeView: true
 *   }
 * });
 * ```
 */
export const getLayouts = createTool({
  id: 'get-layouts',
  description: 'Retrieves a list of Xibo layouts with optional filtering',
  inputSchema: z.object({
    layoutId: z.number().optional().describe('Filter by layout ID'),
    parentId: z.number().optional().describe('Filter by parent ID'),
    showDrafts: z.number().optional().describe('Show drafts (0-1)'),
    layout: z.string().optional().describe('Filter by layout name (partial match)'),
    userId: z.number().optional().describe('Filter by user ID'),
    retired: z.number().optional().describe('Filter by retired status (0-1)'),
    tags: z.string().optional().describe('Filter by tags'),
    exactTags: z.number().optional().describe('Use exact tag matching (0-1)'),
    logicalOperator: z.enum(['AND', 'OR']).optional().describe('Logical operator for multiple tags'),
    ownerUserGroupId: z.number().optional().describe('Filter by user group ID'),
    publishedStatusId: z.number().optional().describe('Filter by publish status (1: Published, 2: Draft)'),
    embed: z.union([
      z.string().describe('Include related data as comma-separated values (e.g. "regions,playlists,widgets,tags,campaigns,permissions")'),
      z.array(z.string()).describe('Include related data as array of values')
    ]).optional(),
    campaignId: z.number().optional().describe('Get layouts belonging to campaign ID'),
    folderId: z.number().optional().describe('Filter by folder ID'),
    skipValidation: z.boolean().optional().describe('Skip schema validation (for debugging)'),
    treeView: z.boolean().optional().describe('Set to true to return layouts in tree structure')
  }),
  outputSchema: z.union([
    z.string(),
    treeResponseSchema,
    layoutResponseSchema
  ]),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        throw new Error("CMS URL is not configured");
      }

      const headers = await getAuthHeaders();
      
      // Build query parameters
      const queryParams = new URLSearchParams();
      Object.entries(context).forEach(([key, value]) => {
        if (value !== undefined) {
          // 内部処理用のパラメータはAPIリクエストに含めない
          if (key === 'skipValidation' || key === 'treeView') {
            return; // このパラメータはスキップ
          }
          
          // 特殊な処理: embed パラメータの処理
          if (key === 'embed') {
            // Xiboの API 仕様に適合するようにフォーマット
            let embedValue: string;
            
            if (Array.isArray(value)) {
              // 配列の場合はカンマ区切りの文字列に変換
              embedValue = value.join(',');
            } else {
              // 文字列の場合はそのまま使用
              embedValue = value.toString();
            }
            
            // `%2C` でなく `,` を使用するように指定
            queryParams.append(key, embedValue);
            
            // デバッグ: embed パラメータの内容をログ出力
            console.log(`Using embed parameter: ${embedValue}`);
          } else {
            queryParams.append(key, value.toString());
          }
        }
      });

      // URLの構築を修正
      let url = `${config.cmsUrl}/api/layout`;
      if (queryParams.toString()) {
        url = `${url}?${queryParams.toString()}`;
      }
      
      // デバッグ用: リクエスト URL とヘッダーをログに出力
      console.log(`Requesting layouts from: ${url}`);
      logger.info(`Retrieving layouts${context.treeView ? ' with tree view' : ''}`);
      
      try {
        const response = await fetch(url, { headers });
        
        // レスポンスの状態をログに出力
        console.log(`Response status: ${response.status} ${response.statusText}`);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Error response body: ${errorText}`);
          const decodedError = decodeErrorMessage(errorText);
          throw new Error(`HTTP error! status: ${response.status}, message: ${decodedError}`);
        }

        const data = await response.json();
        // データの一部をログに出力（センシティブな情報に注意）
        console.log(`Response data received with ${Array.isArray(data) ? data.length : 'unknown'} items`);
        
        // ツリービューが要求された場合
        if (context.treeView) {
          logger.info(`Generating tree view for ${Array.isArray(data) ? data.length : 0} layouts`);
          
          const layoutTree = buildLayoutTree(data);
          return createTreeViewResponse(data, layoutTree, layoutNodeFormatter);
        }
        
        // skipValidation オプションがあればバリデーションをスキップ
        if (context.skipValidation) {
          console.log('Skipping validation as requested');
          return JSON.stringify(data, null, 2);
        }
        
        try {
          // レスポンスが配列の場合はlayoutResponseSchemaで検証
          if (Array.isArray(data)) {
            const validatedData = layoutResponseSchema.parse(data);
            return JSON.stringify(validatedData, null, 2);
          } else {
            // ツリービューの場合はtreeResponseSchemaで検証
            const validatedData = treeResponseSchema.parse(data);
            return JSON.stringify(validatedData, null, 2);
          }
        } catch (validationError) {
          console.error('Validation error:', validationError);
          
          // データ構造を解析して型情報を出力（デバッグ用）
          if (Array.isArray(data) && data.length > 0) {
            const firstItem = data[0];
            console.log('データ構造分析:');
            
            // リージョンの構造確認
            if (firstItem.regions && Array.isArray(firstItem.regions)) {
              console.log(`リージョン数: ${firstItem.regions.length}`);
              
              // 各リージョンのプレイリスト情報を確認
              firstItem.regions.forEach((region: any, index: number) => {
                console.log(`リージョン[${index}]:`);
                console.log(`  regionId: ${region.regionId}`);
                console.log(`  regionPlaylistの型: ${region.regionPlaylist === null ? 'null' : typeof region.regionPlaylist}`);
                
                if (region.regionPlaylist) {
                  console.log(`  プレイリスト名: ${region.regionPlaylist.name}`);
                  console.log(`  ウィジェット数: ${Array.isArray(region.regionPlaylist.widgets) ? region.regionPlaylist.widgets.length : 'unknown'}`);
                }
              });
            }
          }
          
          // エラーの詳細を返す代わりに、未検証のデータを返す（開発中のみ）
          console.warn('Returning unvalidated data for debugging');
          return JSON.stringify(data, null, 2);
        }
      } catch (error) {
        console.error(`Fetch error details:`, error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return `Error occurred: ${errorMessage}`;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return `Error occurred: ${errorMessage}`;
    }
  },
});