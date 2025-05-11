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
 * Tool to retrieve a list of all users from Xibo CMS API
 * 
 * Accesses the /api/user endpoint to fetch information about all users
 * in the Xibo CMS system and returns formatted user data.
 */

// Import required modules
import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from '../../../index';
import { 
  TreeNode, 
  treeResponseSchema, 
  createTreeViewResponse 
} from "../utility/treeView";

/**
 * Schema for user group data
 * 
 * Defines the structure of user group information returned by the API.
 * This includes permissions, notification settings, and features.
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
 * Schema for the API response containing user data
 * 
 * Defines the structure of the array of user objects returned from the API.
 * Each user object contains personal information, group associations,
 * permissions, and related entity counts.
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
 * ユーザーリストをツリー構造に変換する
 * 
 * @param users APIから取得したユーザー配列
 * @returns ツリーノード構造
 */
function buildUsersTree(users: any[]): TreeNode[] {
  // ユーザーごとのノードを作成
  const tree: TreeNode[] = users.map(user => {
    // ユーザーの基本情報
    const userNode: TreeNode = {
      type: 'user',
      id: user.userId,
      name: user.userName,
      children: []
    };
    
    // プロファイル情報があれば追加
    if (user.firstName || user.lastName || user.email || user.phone) {
      const profileItems: TreeNode[] = [];
      
      // 氏名
      if (user.firstName || user.lastName) {
        profileItems.push({
          type: 'name',
          id: user.userId * 100 + 1,
          name: `${user.firstName || ''} ${user.lastName || ''}`.trim()
        });
      }
      
      // メール
      if (user.email) {
        profileItems.push({
          type: 'email',
          id: user.userId * 100 + 2,
          name: user.email
        });
      }
      
      // 電話
      if (user.phone) {
        profileItems.push({
          type: 'phone',
          id: user.userId * 100 + 3,
          name: user.phone
        });
      }
      
      if (profileItems.length > 0) {
        userNode.children!.push({
          type: 'profile',
          id: user.userId * 10 + 1,
          name: 'Profile',
          children: profileItems
        });
      }
    }
    
    // グループ情報を子ノードとして追加
    if (user.groups && user.groups.length > 0) {
      userNode.children!.push({
        type: 'groups',
        id: user.userId * 10 + 2,
        name: 'Groups',
        children: user.groups.map((group: any, index: number) => ({
          type: 'group',
          id: user.userId * 100 + 20 + index,
          name: group.group
        }))
      });
    }
    
    // 統計情報を追加
    const stats: Array<{label: string; count: number; type: string}> = [
      { label: 'Layouts', count: user.layouts?.length || 0, type: 'layouts' },
      { label: 'Media', count: user.media?.length || 0, type: 'media' },
      { label: 'Campaigns', count: user.campaigns?.length || 0, type: 'campaigns' },
      { label: 'Playlists', count: user.playlists?.length || 0, type: 'playlists' },
      { label: 'Display Groups', count: user.displayGroups?.length || 0, type: 'displayGroups' }
    ].filter(stat => stat.count > 0);
    
    if (stats.length > 0) {
      userNode.children!.push({
        type: 'stats',
        id: user.userId * 10 + 3,
        name: 'Content Stats',
        children: stats.map((stat, index) => ({
          type: stat.type,
          id: user.userId * 100 + 30 + index,
          name: `${stat.label}: ${stat.count}`
        }))
      });
    }
    
    // ステータス情報
    userNode.children!.push({
      type: 'status',
      id: user.userId * 10 + 4,
      name: 'Status',
      children: [
        {
          type: 'active',
          id: user.userId * 100 + 40,
          name: user.retired === 1 ? 'Retired' : 'Active'
        },
        {
          type: 'lastAccess',
          id: user.userId * 100 + 41,
          name: `Last Access: ${user.lastAccessed || 'Never'}`
        }
      ]
    });
    
    return userNode;
  });
  
  return tree;
}

/**
 * ユーザーリストノードのカスタム表示フォーマッタ
 */
function usersNodeFormatter(node: TreeNode): string {
  switch (node.type) {
    case 'group':
      return `Group: ${node.name}`;
    case 'user':
      return `User: ${node.name}`;
    case 'profile':
    case 'stats':
    case 'status':
      return node.name;
    case 'name':
      return `Name: ${node.name}`;
    case 'email':
      return `Email: ${node.name}`;
    case 'phone':
      return `Phone: ${node.name}`;
    case 'active':
      return `Status: ${node.name}`;
    case 'lastAccess':
      return node.name;
    default:
      return node.name;
  }
}

/**
 * Tool definition for retrieving user information
 * 
 * This tool fetches all users from the Xibo CMS system, validates the response
 * against a schema, and returns a simplified version of user data.
 * No input parameters are required for this operation.
 */
export const getUsers = createTool({
  id: 'get-users',
  description: 'Retrieves the list of Xibo users',
  // No input parameters required - explicitly set to optional empty object
  inputSchema: z.object({
    _placeholder: z.string().optional().describe('This tool does not require input parameters'),
    treeView: z.boolean().optional().describe('Set to true to return users in tree structure')
  }),
  outputSchema: z.union([
    z.string(),
    treeResponseSchema
  ]),
  execute: async ({ context }) => {
    try {
      // Verify CMS URL is configured
      if (!config.cmsUrl) {
        throw new Error("CMS URL is not set");
      }

      // Prepare authentication and endpoint URL
      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/user`;

      logger.info(`Retrieving users${context.treeView ? ' with tree view' : ''}`);

      // Make API request to fetch users
      const response = await fetch(url, {
        headers,
      });

      // Handle error responses
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Parse and validate response data
      const data = await response.json();
      const validatedData = userResponseSchema.parse(data);

      // ツリービューが要求された場合
      if (context.treeView) {
        logger.info(`Generating tree view for ${validatedData.length} users`);
        const usersTree = buildUsersTree(validatedData);
        return createTreeViewResponse(validatedData, usersTree, usersNodeFormatter);
      }

      // Format user list for display
      // Creates a simplified version with only essential user information
      const formattedUsers = validatedData.map(user => ({
        userId: user.userId,
        userName: user.userName,
        email: user.email,
        group: user.group,
        retired: user.retired === 1 ? 'Retired' : 'Active',
        lastAccessed: user.lastAccessed || 'Not accessed'
      }));

      // Return formatted JSON string
      return JSON.stringify(formattedUsers, null, 2);
    } catch (error) {
      // Log and handle errors
      logger.error(`getUsers: An error occurred: ${error instanceof Error ? error.message : "Unknown error"}`, { error });
      return `An error occurred: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  },
}); 