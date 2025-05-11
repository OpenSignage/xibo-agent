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
 * Tool to retrieve current authenticated user information from Xibo CMS API
 * 
 * Accesses the /api/user/me endpoint to retrieve detailed information
 * about the authenticated user (group memberships, permissions, etc.)
 */

// Import required modules
import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from '../../../index';  // Import shared logger
import { 
  TreeNode, 
  treeResponseSchema, 
  createTreeViewResponse 
} from "../utility/treeView";

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

// ユーザーグループスキーマ
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

// Define user response schema
// Complete structure of user information returned from the API
const userResponseSchema = z.object({
  userId: z.number(),
  userName: z.string(),
  userTypeId: z.number(),
  loggedIn: z.union([z.string(), z.number()]).nullable(),
  email: z.string(),
  homePageId: z.union([z.string(), z.number()]),
  homeFolderId: z.number(),
  lastAccessed: z.string(),
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
});

/**
 * 現在のユーザー情報をツリー構造に変換する
 * 
 * @param userData 現在のユーザー情報
 * @returns ツリーノード構造
 */
function buildUserMeTree(userData: z.infer<typeof userResponseSchema>): TreeNode[] {
  const tree: TreeNode[] = [];
  
  // メインユーザーノード
  const userNode: TreeNode = {
    type: 'user',
    id: userData.userId,
    name: userData.userName,
    children: []
  };
  
  // カテゴリーごとに子ノードを作成
  
  // 1. プロフィール情報
  const profileNode: TreeNode = {
    type: 'profile',
    id: 1,
    name: 'Profile',
    children: []
  };
  
  // 基本プロフィール情報
  if (userData.firstName || userData.lastName) {
    profileNode.children!.push({
      type: 'name',
      id: 101,
      name: `${userData.firstName || ''} ${userData.lastName || ''}`.trim()
    });
  }
  
  if (userData.email) {
    profileNode.children!.push({
      type: 'email',
      id: 102,
      name: userData.email
    });
  }
  
  if (userData.phone) {
    profileNode.children!.push({
      type: 'phone',
      id: 103,
      name: userData.phone
    });
  }
  
  // 参照情報
  const refFields = [
    { key: 'ref1', value: userData.ref1 },
    { key: 'ref2', value: userData.ref2 },
    { key: 'ref3', value: userData.ref3 },
    { key: 'ref4', value: userData.ref4 },
    { key: 'ref5', value: userData.ref5 }
  ].filter(ref => ref.value);
  
  if (refFields.length > 0) {
    const refsNode: TreeNode = {
      type: 'references',
      id: 104,
      name: 'Reference Fields',
      children: refFields.map((ref, index) => ({
        type: 'ref',
        id: 1040 + index,
        name: `${ref.key}: ${ref.value}`
      }))
    };
    profileNode.children!.push(refsNode);
  }
  
  // アカウント情報
  profileNode.children!.push({
    type: 'account',
    id: 105,
    name: 'Account',
    children: [
      {
        type: 'status',
        id: 1051,
        name: `Status: ${userData.retired === 1 ? 'Retired' : 'Active'}`
      },
      {
        type: 'lastAccess',
        id: 1052,
        name: `Last Access: ${userData.lastAccessed}`
      },
      {
        type: 'typeId',
        id: 1053,
        name: `User Type: ${userData.userTypeId}`
      },
      {
        type: 'passwordChange',
        id: 1054,
        name: `Password Change Required: ${userData.isPasswordChangeRequired === 1 ? 'Yes' : 'No'}`
      }
    ]
  });
  
  // プロフィールが子ノードを持つ場合のみ追加
  if (profileNode.children!.length > 0) {
    userNode.children!.push(profileNode);
  }
  
  // 2. グループ情報
  if (userData.groups && userData.groups.length > 0) {
    const groupsNode: TreeNode = {
      type: 'groups',
      id: 2,
      name: 'Groups',
      children: userData.groups.map((group: any, index: number) => {
        const groupNode: TreeNode = {
          type: 'group',
          id: 200 + index,
          name: group.group,
          children: []
        };
        
        // グループの詳細情報
        const details: TreeNode[] = [];
        
        if (group.description) {
          details.push({
            type: 'description',
            id: 2000 + index * 10 + 1,
            name: group.description
          });
        }
        
        details.push({
          type: 'quota',
          id: 2000 + index * 10 + 2,
          name: `Library Quota: ${group.libraryQuota}`
        });
        
        // グループ機能
        if (group.features && group.features.length > 0) {
          groupNode.children!.push({
            type: 'features',
            id: 2000 + index * 10 + 3,
            name: 'Features',
            children: group.features.map((feature: string, featureIndex: number) => ({
              type: 'feature',
              id: 2000 + index * 100 + 30 + featureIndex,
              name: feature
            }))
          });
        }
        
        // 詳細情報を追加
        if (details.length > 0) {
          groupNode.children!.push({
            type: 'details',
            id: 2000 + index * 10 + 4,
            name: 'Details',
            children: details
          });
        }
        
        return groupNode;
      })
    };
    
    userNode.children!.push(groupsNode);
  }
  
  // 3. コンテンツアイテム
  const contentItems: {category: string; type: string; items: any[]}[] = [
    { category: 'Layouts', type: 'layouts', items: userData.layouts || [] },
    { category: 'Media', type: 'media', items: userData.media || [] },
    { category: 'Campaigns', type: 'campaigns', items: userData.campaigns || [] },
    { category: 'Playlists', type: 'playlists', items: userData.playlists || [] },
    { category: 'Display Groups', type: 'displayGroups', items: userData.displayGroups || [] },
    { category: 'Events', type: 'events', items: userData.events || [] },
    { category: 'Day Parts', type: 'dayParts', items: userData.dayParts || [] }
  ].filter(item => item.items && item.items.length > 0);
  
  if (contentItems.length > 0) {
    const contentNode: TreeNode = {
      type: 'content',
      id: 3,
      name: 'Content',
      children: contentItems.map((category, categoryIndex) => {
        // カテゴリーに項目がない場合はスキップ
        if (category.items.length === 0) return null;
        
        const categoryNode: TreeNode = {
          type: category.type,
          id: 300 + categoryIndex,
          name: `${category.category} (${category.items.length})`,
          children: category.items.slice(0, 5).map((item, itemIndex) => {
            // 各アイテムのプロパティはAPIレスポンスによって異なる可能性がある
            const itemName = item.name || 
                           item.layout || 
                           item.media || 
                           item.campaign || 
                           item.title ||
                           `Item ${itemIndex + 1}`;
                           
            return {
              type: category.type.slice(0, -1), // 複数形から単数形へ
              id: 3000 + categoryIndex * 100 + itemIndex,
              name: itemName
            };
          })
        };
        
        return categoryNode;
      }).filter((node): node is TreeNode => node !== null) // nullを除外し型を保証
    };
    
    userNode.children!.push(contentNode);
  }
  
  // 4. 通知設定
  const notifications = [
    { key: 'isSystemNotification', label: 'System Notifications' },
    { key: 'isDisplayNotification', label: 'Display Notifications' },
    { key: 'isLayoutNotification', label: 'Layout Notifications' },
    { key: 'isMediaNotification', label: 'Media Notifications' },
    { key: 'isReportNotification', label: 'Report Notifications' },
    { key: 'isScheduleNotification', label: 'Schedule Notifications' },
    { key: 'isCustomNotification', label: 'Custom Notifications' }
  ].filter(notif => {
    // 型安全に通知設定を検証
    const key = notif.key as keyof typeof userData;
    return userData[key] === 1;
  });
  
  if (notifications.length > 0) {
    userNode.children!.push({
      type: 'notifications',
      id: 4,
      name: 'Notifications',
      children: notifications.map((notif, index) => ({
        type: 'notification',
        id: 400 + index,
        name: notif.label
      }))
    });
  }
  
  tree.push(userNode);
  return tree;
}

/**
 * ユーザー情報ノードのカスタム表示フォーマッタ
 */
function userMeNodeFormatter(node: TreeNode): string {
  switch (node.type) {
    case 'user':
      return `Current User: ${node.name}`;
    case 'profile':
    case 'groups':
    case 'content':
    case 'notifications':
    case 'features':
    case 'details':
    case 'account':
    case 'references':
      return node.name;
    case 'name':
      return `Name: ${node.name}`;
    case 'email':
      return `Email: ${node.name}`;
    case 'phone':
      return `Phone: ${node.name}`;
    case 'group':
      return `Group: ${node.name}`;
    case 'layouts':
    case 'media':
    case 'campaigns':
    case 'playlists':
    case 'displayGroups':
    case 'events':
    case 'dayParts':
      return node.name;
    default:
      return node.name;
  }
}

// Define and export the tool
export const getUserMe = createTool({
  id: 'get-user-me',
  description: 'Retrieves information about the current Xibo user',
  // This tool doesn't require input parameters, so only define a placeholder
  inputSchema: z.object({
    _placeholder: z.string().optional().describe('This tool does not require input parameters'),
    treeView: z.boolean().optional().describe('Set to true to return user info in tree structure')
  }),
  // Output is in string format (JSON string)
  outputSchema: z.union([
    z.string(),
    treeResponseSchema
  ]),
  
  // Tool execution logic
  execute: async ({ context }) => {
    try {
      // Check if CMS URL is configured
      if (!config.cmsUrl) {
        throw new Error("CMS URL is not set");
      }

      // Get authentication headers
      const headers = await getAuthHeaders();
      
      logger.info(`Retrieving current user info${context.treeView ? ' with tree view' : ''}`);
      
      // Execute API request
      const response = await fetch(`${config.cmsUrl}/api/user/me`, {
        headers,
      });

      // Handle error response
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Retrieve and validate response data
      const data = await response.json();
      const validatedData = userResponseSchema.parse(data);

      // ツリービューが要求された場合
      if (context.treeView) {
        logger.info(`Generating tree view for current user`);
        const userTree = buildUserMeTree(validatedData);
        return createTreeViewResponse(validatedData, userTree, userMeNodeFormatter);
      }

      // Return formatted JSON
      return JSON.stringify(validatedData, null, 2);
    } catch (error) {
      // Log and handle errors
      logger.error(`getUserMe: An error occurred: ${error instanceof Error ? error.message : "Unknown error"}`, { error });
      return `An error occurred: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  },
});