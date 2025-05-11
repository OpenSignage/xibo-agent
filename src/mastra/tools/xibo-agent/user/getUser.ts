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
 * Xibo CMS User Information Retrieval Tool
 * 
 * This module provides functionality to retrieve user information from the Xibo CMS API.
 * It supports filtering users by various parameters such as userId, userName, userTypeId,
 * and retired status.
 * 
 * The tool validates both input parameters and API responses using Zod schemas to ensure
 * data integrity and type safety throughout the request/response cycle.
 */

import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { createLogger } from '@mastra/core/logger';
import { 
  TreeNode, 
  treeResponseSchema, 
  createTreeViewResponse 
} from "../utility/treeView";

const logger = createLogger({ name: 'xibo-agent:user:getUser' });

/**
 * Schema for user group data
 */
// タグスキーマの定義
const tagSchema = z.object({
  tag: z.string(),
  tagId: z.number(),
  value: z.string().optional(),
});

// 権限スキーマの定義
const permissionSchema = z.object({
  permissionId: z.number(),
  entityId: z.number(),
  groupId: z.number(),
  objectId: z.number(),
  isUser: z.number(),
  entity: z.string(),
  objectIdString: z.string(),
  group: z.string(),
  view: z.number(),
  edit: z.number(),
  delete: z.number(),
  modifyPermissions: z.number(),
});

// ウィジェットオプションスキーマ
const widgetOptionSchema = z.object({
  widgetId: z.number(),
  type: z.string().optional(),
  option: z.string(),
  value: z.string(),
});

// オーディオスキーマ
const audioSchema = z.object({
  widgetId: z.number(),
  mediaId: z.number(),
  volume: z.number(),
  loop: z.number(),
});

// ウィジェットスキーマ
const widgetSchema = z.object({
  widgetId: z.number(),
  playlistId: z.number(),
  ownerId: z.number(),
  type: z.string(),
  duration: z.number(),
  displayOrder: z.number(),
  useDuration: z.number(),
  calculatedDuration: z.number(),
  createdDt: z.string(),
  modifiedDt: z.string(),
  fromDt: z.number().nullable(),
  toDt: z.number().nullable(),
  schemaVersion: z.number(),
  transitionIn: z.number().nullable(),
  transitionOut: z.number().nullable(),
  transitionDurationIn: z.number().nullable(),
  transitionDurationOut: z.number().nullable(),
  widgetOptions: z.array(widgetOptionSchema).optional(),
  mediaIds: z.array(z.number()).optional(),
  audio: z.array(audioSchema).optional(),
  permissions: z.array(permissionSchema).optional(),
  playlist: z.string().optional(),
});

// プレイリストスキーマ
const playlistSchema = z.object({
  playlistId: z.number(),
  ownerId: z.number(),
  name: z.string(),
  regionId: z.number().nullable(),
  isDynamic: z.number(),
  filterMediaName: z.string().nullable(),
  filterMediaNameLogicalOperator: z.string().nullable(),
  filterMediaTags: z.string().nullable(),
  filterExactTags: z.number().nullable(),
  filterMediaTagsLogicalOperator: z.string().nullable(),
  filterFolderId: z.number().nullable(),
  maxNumberOfItems: z.number().nullable(),
  createdDt: z.string(),
  modifiedDt: z.string(),
  duration: z.number(),
  requiresDurationUpdate: z.number(),
  enableStat: z.string().nullable(),
  tags: z.array(tagSchema).optional(),
  widgets: z.array(widgetSchema).optional(),
  permissions: z.array(permissionSchema).optional(),
  folderId: z.number().nullable(),
  permissionsFolderId: z.number().nullable(),
});

// リージョンオプションスキーマ
const regionOptionSchema = z.object({
  regionId: z.number(),
  option: z.string(),
  value: z.string(),
});

// リージョンスキーマ
const regionSchema = z.object({
  regionId: z.number(),
  layoutId: z.number(),
  ownerId: z.number(),
  type: z.string().nullable(),
  name: z.string(),
  width: z.number(),
  height: z.number(),
  top: z.number(),
  left: z.number(),
  zIndex: z.number(),
  syncKey: z.string().nullable(),
  regionOptions: z.array(regionOptionSchema).optional(),
  permissions: z.array(permissionSchema).optional(),
  duration: z.number(),
  isDrawer: z.number().nullable(),
  regionPlaylist: playlistSchema.optional(),
});

// レイアウトスキーマ
const layoutSchema = z.object({
  layoutId: z.number(),
  ownerId: z.number(),
  campaignId: z.number().nullable(),
  parentId: z.number().nullable(),
  publishedStatusId: z.number(),
  publishedStatus: z.string(),
  publishedDate: z.string().nullable(),
  backgroundImageId: z.number().nullable(),
  schemaVersion: z.number(),
  layout: z.string(),
  description: z.string().nullable(),
  backgroundColor: z.string().nullable(),
  createdDt: z.string(),
  modifiedDt: z.string(),
  status: z.number(),
  retired: z.number(),
  backgroundzIndex: z.number().nullable(),
  width: z.number(),
  height: z.number(),
  orientation: z.string().nullable(),
  displayOrder: z.number().nullable(),
  duration: z.number(),
  statusMessage: z.string().nullable(),
  enableStat: z.number().optional(),
  autoApplyTransitions: z.number().nullable(),
  code: z.string().nullable(),
  isLocked: z.boolean().optional(),
  regions: z.array(regionSchema).optional(),
  tags: z.array(tagSchema).optional(),
  folderId: z.number().nullable(),
  permissionsFolderId: z.number().nullable(),
});

// キャンペーンスキーマ
const campaignSchema = z.object({
  campaignId: z.number(),
  ownerId: z.number(),
  type: z.string(),
  campaign: z.string(),
  isLayoutSpecific: z.number(),
  numberLayouts: z.number().optional(),
  totalDuration: z.number().optional(),
  tags: z.array(tagSchema).optional(),
  folderId: z.number().nullable(),
  permissionsFolderId: z.number().nullable(),
  cyclePlaybackEnabled: z.number().nullable(),
  playCount: z.number().nullable(),
  listPlayOrder: z.string().nullable(),
  targetType: z.string().nullable(),
  target: z.number().nullable(),
  startDt: z.number().nullable(),
  endDt: z.number().nullable(),
  plays: z.number().optional(),
  spend: z.number().optional(),
  impressions: z.number().optional(),
  lastPopId: z.number().nullable(),
  ref1: z.string().nullable(),
  ref2: z.string().nullable(),
  ref3: z.string().nullable(),
  ref4: z.string().nullable(),
  ref5: z.string().nullable(),
});

// メディアスキーマ
const mediaSchema = z.object({
  mediaId: z.number(),
  ownerId: z.number(),
  parentId: z.number().nullable(),
  name: z.string(),
  mediaType: z.string(),
  storedAs: z.string().nullable(),
  fileName: z.string().nullable(),
  tags: z.array(tagSchema).optional(),
  fileSize: z.number(),
  duration: z.number().nullable(),
  valid: z.number(),
  moduleSystemFile: z.number().nullable(),
  expires: z.number().nullable(),
  retired: z.number(),
  isEdited: z.number().nullable(),
  md5: z.string().nullable(),
  owner: z.string().nullable(),
  groupsWithPermissions: z.string().nullable(),
  released: z.number().nullable(),
  apiRef: z.string().nullable(),
  createdDt: z.string(),
  modifiedDt: z.string(),
  enableStat: z.string().nullable(),
  orientation: z.string().nullable(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  folderId: z.number().nullable(),
  permissionsFolderId: z.number().nullable(),
});

// ディスプレイグループスキーマ
const displayGroupSchema = z.object({
  displayGroupId: z.number(),
  displayGroup: z.string(),
  description: z.string().nullable(),
  isDisplaySpecific: z.number(),
  isDynamic: z.number(),
  dynamicCriteria: z.string().nullable(),
  dynamicCriteriaLogicalOperator: z.string().nullable(),
  dynamicCriteriaTags: z.string().nullable(),
  dynamicCriteriaExactTags: z.number().nullable(),
  dynamicCriteriaTagsLogicalOperator: z.string().nullable(),
  userId: z.number().nullable(),
  tags: z.array(tagSchema).optional(),
  bandwidthLimit: z.number().nullable(),
  groupsWithPermissions: z.string().nullable(),
  createdDt: z.string(),
  modifiedDt: z.string(),
  folderId: z.number().nullable(),
  permissionsFolderId: z.number().nullable(),
  ref1: z.string().nullable(),
  ref2: z.string().nullable(),
  ref3: z.string().nullable(),
  ref4: z.string().nullable(),
  ref5: z.string().nullable(),
});

// スケジュールリマインダースキーマ
const scheduleReminderSchema = z.object({
  scheduleReminderId: z.number(),
  eventId: z.number(),
  value: z.number(),
  type: z.number(),
  option: z.number(),
  isEmail: z.number(),
  reminderDt: z.number().nullable(),
  lastReminderDt: z.number().nullable(),
});

// イベントスキーマ
const eventSchema = z.object({
  eventId: z.number(),
  eventTypeId: z.number(),
  campaignId: z.number().nullable(),
  commandId: z.number().nullable(),
  displayGroups: z.array(displayGroupSchema).optional(),
  scheduleReminders: z.array(scheduleReminderSchema).optional(),
  criteria: z.array(z.string()).optional(),
  userId: z.number(),
  fromDt: z.number().nullable(),
  toDt: z.number().nullable(),
  isPriority: z.number(),
  displayOrder: z.number(),
  recurrenceType: z.string(),
  recurrenceDetail: z.number().nullable(),
  recurrenceRange: z.number().nullable(),
  recurrenceRepeatsOn: z.string().nullable(),
  recurrenceMonthlyRepeatsOn: z.number().nullable(),
  campaign: z.string().nullable(),
  command: z.string().nullable(),
  dayPartId: z.number().nullable(),
  isAlways: z.number().nullable(),
  isCustom: z.number().nullable(),
  syncEvent: z.number().nullable(),
  syncTimezone: z.number().nullable(),
  shareOfVoice: z.number().nullable(),
  maxPlaysPerHour: z.number().nullable(),
  isGeoAware: z.number().nullable(),
  geoLocation: z.string().nullable(),
  actionTriggerCode: z.string().nullable(),
  actionType: z.string().nullable(),
  actionLayoutCode: z.string().nullable(),
  parentCampaignId: z.number().nullable(),
  syncGroupId: z.number().nullable(),
  dataSetId: z.number().nullable(),
  dataSetParams: z.number().nullable(),
  modifiedBy: z.number().nullable(),
  createdOn: z.string().nullable(),
  updatedOn: z.string().nullable(),
  name: z.string().nullable(),
});

// 日付区切りスキーマ
const dayPartSchema = z.object({
  dayPartId: z.number(),
  isAlways: z.number(),
  isCustom: z.number(),
});

const groupSchema = z.object({
  groupId: z.number(),
  group: z.string(),
  isUserSpecific: z.number(),
  isEveryone: z.number(),
  description: z.string().nullable(),
  libraryQuota: z.number(),
  isSystemNotification: z.number(),
  isDisplayNotification: z.number(),
  isDataSetNotification: z.number(),
  isLayoutNotification: z.number(),
  isLibraryNotification: z.number(),
  isReportNotification: z.number(),
  isScheduleNotification: z.number(),
  isCustomNotification: z.number(),
  isShownForAddUser: z.number(),
  defaultHomepageId: z.string().nullable(),
  features: z.array(z.string()),
  buttons: z.array(z.unknown()).optional(),
});

/**
 * Schema for user response data from the Xibo API
 */
const userResponseSchema = z.array(z.object({
  userId: z.number(),
  userName: z.string(),
  userTypeId: z.number(),
  loggedIn: z.union([z.string(), z.number()]).nullable(),
  email: z.string().nullable(),
  homePageId: z.union([z.string(), z.number()]),
  homeFolderId: z.number(),
  lastAccessed: z.string().nullable(),
  newUserWizard: z.number(),
  retired: z.number(),
  isPasswordChangeRequired: z.number(),
  groupId: z.number(),
  group: z.union([z.string(), z.number()]),
  libraryQuota: z.number(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  phone: z.string().nullable(),
  ref1: z.string().nullable(),
  ref2: z.string().nullable(),
  ref3: z.string().nullable(),
  ref4: z.string().nullable(),
  ref5: z.string().nullable(),
  groups: z.array(groupSchema),
  campaigns: z.array(campaignSchema).optional(),
  layouts: z.array(layoutSchema).optional(),
  media: z.array(mediaSchema).optional(),
  events: z.array(eventSchema).optional(),
  playlists: z.array(playlistSchema).optional(),
  displayGroups: z.array(displayGroupSchema).optional(),
  dayParts: z.array(dayPartSchema).optional(),
  isSystemNotification: z.number(),
  isDisplayNotification: z.number(),
  isDataSetNotification: z.number(),
  isLayoutNotification: z.number(),
  isLibraryNotification: z.number(),
  isReportNotification: z.number(),
  isScheduleNotification: z.number(),
  isCustomNotification: z.number(),
  twoFactorTypeId: z.number(),
  twoFactorSecret: z.string().optional(),
  twoFactorRecoveryCodes: z.array(z.string()).optional(),
  homeFolder: z.string().optional(),
}));

/**
 * ユーザーデータからツリーノード構造を構築する
 * 
 * @param users APIから取得したユーザー配列
 * @returns ツリーノード構造
 */
function buildUserTree(users: any[]): TreeNode[] {
  return users.map(user => {
    // ユーザーノード
    const userNode: TreeNode = {
      type: 'user',
      id: user.userId,
      name: user.userName,
      children: []
    };
    
    // プロファイル情報を子ノードとして追加
    const profileNode: TreeNode = {
      type: 'profile',
      id: 0,
      name: 'Profile',
      children: []
    };
    
    // 名前情報
    if (user.firstName || user.lastName) {
      profileNode.children!.push({
        type: 'name',
        id: 1,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim()
      });
    }
    
    // 連絡先情報
    if (user.email) {
      profileNode.children!.push({
        type: 'email',
        id: 2,
        name: user.email
      });
    }
    
    if (user.phone) {
      profileNode.children!.push({
        type: 'phone',
        id: 3,
        name: user.phone
      });
    }
    
    // 参照フィールド
    const refs = [
      { field: 'ref1', value: user.ref1 },
      { field: 'ref2', value: user.ref2 },
      { field: 'ref3', value: user.ref3 },
      { field: 'ref4', value: user.ref4 },
      { field: 'ref5', value: user.ref5 }
    ].filter(r => r.value);
    
    if (refs.length > 0) {
      const refsNode: TreeNode = {
        type: 'refs',
        id: 4,
        name: 'References',
        children: refs.map((ref, index) => ({
          type: 'ref',
          id: 40 + index,
          name: `${ref.field}: ${ref.value}`
        }))
      };
      profileNode.children!.push(refsNode);
    }
    
    // プロファイルノードに子ノードがある場合のみ追加
    if (profileNode.children!.length > 0) {
      userNode.children!.push(profileNode);
    }
    
    // グループ情報を子ノードとして追加
    if (user.groups && user.groups.length > 0) {
      const groupsNode: TreeNode = {
        type: 'groups',
        id: 5,
        name: 'Groups',
        children: user.groups.map((group: any, index: number) => ({
          type: 'group',
          id: 50 + index,
          name: group.group
        }))
      };
      userNode.children!.push(groupsNode);
    }
    
    // 関連アイテム情報を子ノードとして追加
    const relatedItems: { type: string; items: any[] }[] = [
      { type: 'campaigns', items: user.campaigns },
      { type: 'layouts', items: user.layouts },
      { type: 'media', items: user.media },
      { type: 'events', items: user.events },
      { type: 'playlists', items: user.playlists },
      { type: 'displayGroups', items: user.displayGroups },
      { type: 'dayParts', items: user.dayParts }
    ];
    
    const itemsWithData = relatedItems.filter(item => item.items && item.items.length > 0);
    
    if (itemsWithData.length > 0) {
      const relatedNode: TreeNode = {
        type: 'related',
        id: 6,
        name: 'Related Items',
        children: []
      };
      
      itemsWithData.forEach((item, categoryIndex) => {
        const categoryNode: TreeNode = {
          type: item.type,
          id: 60 + categoryIndex,
          name: item.type.charAt(0).toUpperCase() + item.type.slice(1),
          children: item.items.map((subItem: any, itemIndex: number) => {
            // 各アイテムのプロパティはAPIレスポンスによって異なる
            // ここでは汎用的な表示を使用
            const itemId = subItem.id || subItem.campaignId || subItem.layoutId || subItem.mediaId || (600 + itemIndex);
            const itemName = subItem.name || subItem.campaign || subItem.layout || subItem.media || `Item ${itemIndex + 1}`;
            
            return {
              type: item.type.slice(0, -1), // 複数形から単数形に
              id: itemId,
              name: itemName
            };
          })
        };
        
        relatedNode.children!.push(categoryNode);
      });
      
      userNode.children!.push(relatedNode);
    }
    
    return userNode;
  });
}

/**
 * ユーザーノードのカスタム表示フォーマッタ
 */
function userNodeFormatter(node: TreeNode): string {
  switch (node.type) {
    case 'user':
      return `User: ${node.name}`;
    case 'profile':
    case 'groups':
    case 'related':
      return node.name;
    case 'group':
      return `Group: ${node.name}`;
    case 'email':
      return `Email: ${node.name}`;
    case 'phone':
      return `Phone: ${node.name}`;
    case 'name':
      return `Name: ${node.name}`;
    default:
      return `${node.name}`;
  }
}

/**
 * Tool for retrieving user information from Xibo CMS
 */
export const getUser = createTool({
  id: 'get-user',
  description: 'Get user information from Xibo CMS',
  inputSchema: z.object({
    userId: z.number().optional().describe('Filter by User Id'),
    userName: z.string().optional().describe('Filter by User Name'),
    userTypeId: z.number().optional().describe('Filter by UserType Id'),
    retired: z.number().optional().describe('Filter by Retired'),
    treeView: z.boolean().optional().describe('Set to true to return users in tree structure')
  }),
  outputSchema: z.union([
    z.string(),
    treeResponseSchema
  ]),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        throw new Error("CMS URL is not configured");
      }

      const headers = await getAuthHeaders();

      // Build query parameters
      const queryParams = new URLSearchParams();
      if (context.userId) queryParams.append('userId', context.userId.toString());
      if (context.userName) queryParams.append('userName', context.userName);
      if (context.userTypeId) queryParams.append('userTypeId', context.userTypeId.toString());
      if (context.retired) queryParams.append('retired', context.retired.toString());

      const queryString = queryParams.toString();
      const url = `${config.cmsUrl}/api/user${queryString ? `?${queryString}` : ''}`;

      logger.info(`Retrieving users${context.treeView ? ' with tree view' : ''}`);
      
      const response = await fetch(url, {
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const validatedData = userResponseSchema.parse(data);

      // ツリービューが要求された場合
      if (context.treeView) {
        logger.info(`Generating tree view for ${validatedData.length} users`);
        const userTree = buildUserTree(validatedData);
        return createTreeViewResponse(validatedData, userTree, userNodeFormatter);
      }

      return JSON.stringify(validatedData, null, 2);
    } catch (error) {
      logger.error(`getUser: An error occurred: ${error instanceof Error ? error.message : "Unknown error"}`, { error });
      return `Error: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  },
});