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
 * @module deleteUser
 * @description This module provides a tool to delete users from the Xibo CMS system.
 * It implements the user deletion API endpoint and handles the necessary parameters
 * for deleting users and managing their associated items.
 */

import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from '../../../index';

// =================================================================
// Schema Definitions (from getUser for response validation)
// =================================================================

const tagSchema = z.object({
  tag: z.string(),
  tagId: z.number(),
  value: z.string().optional(),
});

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

const widgetOptionSchema = z.object({
  widgetId: z.number(),
  type: z.string().optional(),
  option: z.string(),
  value: z.string(),
});

const audioSchema = z.object({
  widgetId: z.number(),
  mediaId: z.number(),
  volume: z.number(),
  loop: z.number(),
});

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

const regionOptionSchema = z.object({
  regionId: z.number(),
  option: z.string(),
  value: z.string(),
});

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

const userSchema = z.object({
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
});

const userListSchema = z.array(userSchema);

const deleteSuccessDataSchema = z.union([userListSchema, z.null()]);

const successResponseSchema = z.object({
    success: z.literal(true),
    data: deleteSuccessDataSchema.describe("The response data from the CMS. This will be null, or a list of users if items were reassigned."),
    message: z.string(),
});

const errorResponseSchema = z.object({
    success: z.literal(false),
    message: z.string(),
    error: z.any().optional(),
    errorData: z.any().optional(),
});

const outputSchema = z.union([successResponseSchema, errorResponseSchema]);

export const deleteUser = createTool({
  id: "delete-user",
  description: "Deletes a user from the Xibo CMS.",
  inputSchema: z.object({
    userId: z.number().describe("The ID of the user to be deleted. This is a required field."),
    deleteAllItems: z.number().optional().describe("Set to 1 to delete all items owned by the user, or 0 to reassign them. If not provided, items will be reassigned."),
    reassignUserId: z.number().optional().describe("The ID of the user to reassign items to. This is required if deleteAllItems is 0 or not provided."),
  }),
  outputSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      const message = "CMS URL is not configured.";
      logger.error(message);
      return { success: false as const, message };
    }

    if (context.deleteAllItems === 0 && !context.reassignUserId) {
      const message = "reassignUserId is required when deleteAllItems is set to 0.";
      logger.error(message);
      return { success: false as const, message };
    }
    
    try {
      const url = `${config.cmsUrl}/api/user/${context.userId}`;
      const formData = new URLSearchParams();
      
      if (context.deleteAllItems !== undefined) {
        formData.append("deleteAllItems", context.deleteAllItems.toString());
      }
      if (context.reassignUserId) {
        formData.append("reassignUserId", context.reassignUserId.toString());
      }

      logger.debug(`Attempting to delete user ${context.userId} with params:`, { body: formData.toString() });

      const response = await fetch(url, {
        method: "DELETE",
        headers: {
            ...(await getAuthHeaders()),
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData.toString(),
      });

      const responseText = await response.text();
      let responseData: any = null;
      try {
          responseData = responseText ? JSON.parse(responseText) : null;
      } catch (e) {
          // Response is not JSON, treat as plain text.
          responseData = responseText;
      }

      if (!response.ok) {
        const message = `Failed to delete user. API responded with status ${response.status}`;
        logger.error(message, { status: response.status, response: responseData });
        return { success: false as const, message, errorData: responseData };
      }

      const validationResult = deleteSuccessDataSchema.safeParse(responseData);

      if (!validationResult.success) {
          const message = "Successful API call but response validation failed.";
          logger.error(message, { error: validationResult.error, data: responseData });
          return { success: false as const, message, error: validationResult.error, errorData: responseData };
      }

      const message = `User with ID ${context.userId} deleted successfully.`;
      logger.info(message, { userId: context.userId, responseData: validationResult.data });

      return {
        success: true,
        data: validationResult.data,
        message: message,
      };

    } catch (error) {
        const message = "An unexpected error occurred while deleting the user.";
        logger.error(message, { error });
        return {
            success: false as const,
            message,
            error: error instanceof Error ? { name: error.name, message: error.message } : error,
        };
    }
  },
});

export default deleteUser; 