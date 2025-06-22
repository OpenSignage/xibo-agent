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
 * @module getUser
 * @description This module provides a tool to retrieve user information from the Xibo CMS,
 * with optional tree view formatting.
 */

import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { 
  TreeNode, 
  treeResponseSchema, 
  createTreeViewResponse 
} from "../utility/treeView";
import { logger } from '../../../index';

// =================================================================
// Schema Definitions
// =================================================================

// Schema for tags associated with various Xibo entities.
const tagSchema = z.object({
  tag: z.string(),
  tagId: z.number(),
  value: z.string().optional(),
});

// Schema for permission details on Xibo entities.
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

// Schema for widget options.
const widgetOptionSchema = z.object({
  widgetId: z.number(),
  type: z.string().optional(),
  option: z.string(),
  value: z.string(),
});

// Schema for audio associated with a widget.
const audioSchema = z.object({
  widgetId: z.number(),
  mediaId: z.number(),
  volume: z.number(),
  loop: z.number(),
});

// Schema for a widget within a playlist.
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

// Schema for a playlist, which contains widgets.
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

// Schema for layout region options.
const regionOptionSchema = z.object({
  regionId: z.number(),
  option: z.string(),
  value: z.string(),
});

// Schema for a layout region.
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

// Schema for a layout, which is composed of regions.
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

// Schema for a campaign, which is a collection of layouts.
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

// Schema for a media item in the library.
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

// Schema for a display group.
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

// Schema for schedule reminders.
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

// Schema for a scheduled event.
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

// Schema for day parts used in scheduling.
const dayPartSchema = z.object({
  dayPartId: z.number(),
  isAlways: z.number(),
  isCustom: z.number(),
});

// Schema for user groups.
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

// Schema for the user list response from the API. Note that it's an array.
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

// Schema for a successful response, containing the data and a message.
const successResponseSchema = z.object({
  success: z.literal(true),
  data: z.union([userResponseSchema, treeResponseSchema]),
  message: z.string(),
});

// Schema for an error response.
const errorResponseSchema = z.object({
  success: z.literal(false),
  message: z.string(),
  error: z.any().optional(),
  errorData: z.any().optional(),
});

// The final output schema is a union of success and error responses.
const outputSchema = z.union([successResponseSchema, errorResponseSchema]);

/**
 * Builds a hierarchical tree structure from the user data array.
 * This is used for the optional tree view output.
 * @param users An array of user objects from the API.
 * @returns An array of TreeNode objects, one for each user.
 */
function buildUserTree(users: any[]): TreeNode[] {
  return users.map(user => {
    // Create the main root node for the user.
    const userNode: TreeNode = {
      type: 'user',
      id: user.userId,
      name: user.userName,
      children: []
    };
    
    // Create a 'Profile' node to hold personal details.
    const profileNode: TreeNode = {
      type: 'profile',
      id: 0, // Static ID for the profile category node
      name: 'Profile',
      children: []
    };
    
    // Add name if available.
    if (user.firstName || user.lastName) {
      profileNode.children!.push({
        type: 'name',
        id: 1,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim()
      });
    }
    
    // Add contact information.
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
    // Add reference fields if they have values.
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
    // Only add the profile node to the user tree if it contains information.
    if (profileNode.children!.length > 0) {
      userNode.children!.push(profileNode);
    }
    // Add group memberships as a child node.
    if (user.groups && user.groups.length > 0) {
      const groupsNode: TreeNode = {
        type: 'groups',
        id: 5,
        name: 'Groups',
        children: user.groups.map((group: any, index: number) => ({
          type: 'group',
          id: 50 + index,
          name: group.group,
          children: [
            {
              type: 'description',
              id: 500 + index,
              name: group.description || ''
            },
            {
              type: 'quota',
              id: 510 + index,
              name: `Library Quota: ${group.libraryQuota}`
            }
          ]
        }))
      };
      userNode.children!.push(groupsNode);
    }
    // Configuration for displaying various types of related content.
    const relatedItems: { type: string; items: any[]; label: string; icon: string; detailFields?: string[] }[] = [
      { type: 'campaigns', items: user.campaigns, label: 'Campaigns', icon: '📢', detailFields: ['campaignId','campaign','type','startDt','endDt','tags'] },
      { type: 'layouts', items: user.layouts, label: 'Layouts', icon: '📄', detailFields: ['layoutId','layout','description','createdDt','modifiedDt','tags'] },
      { type: 'media', items: user.media, label: 'Media', icon: '🎞️', detailFields: ['mediaId','name','mediaType','duration','createdDt','modifiedDt','tags'] },
      { type: 'events', items: user.events, label: 'Events', icon: '📅', detailFields: ['eventId','eventTypeId','fromDt','toDt','campaign','command'] },
      { type: 'playlists', items: user.playlists, label: 'Playlists', icon: '🎬', detailFields: ['playlistId','name','duration','createdDt','modifiedDt','tags'] },
      { type: 'displayGroups', items: user.displayGroups, label: 'Display Groups', icon: '🖥️', detailFields: ['displayGroupId','displayGroup','description','createdDt','modifiedDt','tags'] },
      { type: 'dayParts', items: user.dayParts, label: 'Day Parts', icon: '⏰', detailFields: ['dayPartId','isAlways','isCustom'] }
    ];
    // Filter out item types that have no data for this user.
    const itemsWithData = relatedItems.filter(item => item.items && item.items.length > 0);
    if (itemsWithData.length > 0) {
      const relatedNode: TreeNode = {
        type: 'related',
        id: 6,
        name: 'Related Items',
        children: []
      };
      // Create a category node for each type of related item.
      itemsWithData.forEach((item, categoryIndex) => {
        const categoryNode: TreeNode = {
          type: item.type,
          id: 60 + categoryIndex,
          name: `${item.icon} ${item.label}`,
          children: item.items.map((subItem: any, itemIndex: number) => {
            // Display detailed properties for each item.
            const itemId = subItem.id || subItem.campaignId || subItem.layoutId || subItem.mediaId || subItem.eventId || subItem.playlistId || subItem.displayGroupId || subItem.dayPartId || (600 + itemIndex);
            const itemName = subItem.name || subItem.campaign || subItem.layout || subItem.media || subItem.displayGroup || subItem.eventId || `Item ${itemIndex + 1}`;
            const children: TreeNode[] = [];
            // Add specified detail fields as child nodes.
            if (item.detailFields) {
              item.detailFields.forEach(field => {
                if (subItem[field] !== undefined && subItem[field] !== null) {
                  // Special handling for tags to create a nested list.
                  if (field === 'tags' && Array.isArray(subItem.tags) && subItem.tags.length > 0) {
                    children.push({
                      type: 'tags',
                      id: itemId * 1000 + 1,
                      name: 'Tags',
                      children: subItem.tags.map((tag: any, tagIdx: number) => ({
                        type: 'tag',
                        id: itemId * 1000 + 10 + tagIdx,
                        name: tag.tag || `Tag ${tag.tagId}`
                      }))
                    });
                  } else {
                    children.push({
                      type: field,
                      id: itemId * 100 + field.length,
                      name: `${field}: ${subItem[field]}`
                    });
                  }
                }
              });
            }
            return {
              type: item.type.slice(0, -1), // e.g., 'layouts' -> 'layout'
              id: itemId,
              name: itemName,
              children: children.length > 0 ? children : undefined
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
 * Formats a user tree node for display, adding an icon based on its type.
 * @param node The tree node to format.
 * @returns A formatted string representation of the node.
 */
function userNodeFormatter(node: TreeNode): string {
  switch (node.type) {
    case 'user':
      return `👤 ${node.name}`;
    case 'info':
      return `ℹ️ ${node.name}`;
    case 'groups':
      return `👥 ${node.name}`;
    case 'group':
      return node.name;
    case 'homepage':
    case 'user-id':
    case 'user-type':
    case 'retired':
      return node.name;
    default:
      return node.name;
  }
}

/**
 * Tool for retrieving user information from Xibo CMS.
 * This tool retrieves a list of users and can format the output as a tree view.
 */
export const getUser = createTool({
  id: 'get-user',
  description: 'Get user information from Xibo CMS, with optional tree view.',
  inputSchema: z.object({
    userId: z.number().optional().describe('Filter by a specific User ID.'),
    userName: z.string().optional().describe('Filter by a specific User Name.'),
    userTypeId: z.number().optional().describe('Filter by a specific UserType ID.'),
    retired: z.number().optional().describe('Filter by retired status (0 for not retired, 1 for retired).'),
    treeView: z.boolean().optional().describe('Set to true to return the user list in a tree structure for better visualization.')
  }),
  outputSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      const message = "CMS URL is not configured.";
      logger.error(message);
      return { success: false as const, message };
    }

    try {
      const queryParams = new URLSearchParams();
      if (context.userId) queryParams.append('userId', context.userId.toString());
      if (context.userName) queryParams.append('userName', context.userName);
      if (context.userTypeId) queryParams.append('userTypeId', context.userTypeId.toString());
      if (context.retired !== undefined) queryParams.append('retired', context.retired.toString());
      
      const queryString = queryParams.toString();
      const url = `${config.cmsUrl}/api/user${queryString ? `?${queryString}` : ''}`;

      logger.info(`Requesting user information from: ${url}`);

      const response = await fetch(url, {
        method: 'GET',
        headers: await getAuthHeaders(),
      });

      const rawData = await response.json();

      if (!response.ok) {
        const message = `Failed to get user information. API responded with status ${response.status}`;
        logger.error(message, { response: rawData });
        return { success: false as const, message, errorData: rawData };
      }
      
      const validationResult = userResponseSchema.safeParse(rawData);

      if (!validationResult.success) {
        const message = "API response validation failed.";
        logger.error(message, { error: validationResult.error, data: rawData });
        return { success: false as const, message, error: validationResult.error, errorData: rawData };
      }
      
      const validatedData = validationResult.data;
      let responseData: z.infer<typeof userResponseSchema> | z.infer<typeof treeResponseSchema> = validatedData;
      let message: string;

      if (context.treeView) {
        logger.info(`Generating tree view for ${validatedData.length} users.`);
        const userTree = buildUserTree(validatedData);
        responseData = createTreeViewResponse(validatedData, userTree, userNodeFormatter);
        message = "User information retrieved and formatted as a tree view successfully.";
      } else {
        message = "User information retrieved successfully.";
      }
      
      logger.info(message, { userCount: validatedData.length, treeView: !!context.treeView });
      return { success: true, data: responseData, message };

    } catch (error) {
      const message = "An unexpected error occurred while getting user information.";
      logger.error(message, { error });
      return {
        success: false as const,
        message,
        error: error instanceof Error ? { name: error.name, message: error.message } : error,
      };
    }
  },
});