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
 * Xibo CMS Notification Creation Tool
 * 
 * This module provides functionality to create notifications in the Xibo CMS system.
 * It implements the notification creation API endpoint and handles the necessary validation
 * and data transformation for creating notification information.
 */

import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../index";
import { decodeErrorMessage } from "../utility/error";

// Schema for tag information in display groups
const tagSchema = z.object({
  tag: z.string().nullable(),
  tagId: z.number(),
  value: z.string().nullable(),
}).passthrough();

// Schema for user group information
const userGroupSchema = z.object({
  groupId: z.number(),
  group: z.string(),
  isUserSpecific: z.number(),
  isEveryone: z.number(),
  description: z.string().nullable(),
  libraryQuota: z.number().nullable(),
  isSystemNotification: z.number().nullable(),
  isDisplayNotification: z.number().nullable(),
  isDataSetNotification: z.number().nullable(),
  isLayoutNotification: z.number().nullable(),
  isLibraryNotification: z.number().nullable(),
  isReportNotification: z.number().nullable(),
  isScheduleNotification: z.number().nullable(),
  isCustomNotification: z.number().nullable(),
  isShownForAddUser: z.number().nullable(),
  defaultHomepageId: z.string().nullable(),
  features: z.array(z.string()).nullable(),
}).passthrough();

// Schema for display group information
const displayGroupSchema = z.object({
  displayGroupId: z.number(),
  displayGroup: z.string(),
  description: z.string().nullable(),
  isDisplaySpecific: z.number(),
  isDynamic: z.number(),
  dynamicCriteria: z.string().nullable(),
  dynamicCriteriaLogicalOperator: z.string().nullable(),
  dynamicCriteriaTags: z.string().nullable(),
  dynamicCriteriaExactTags: z.number(),
  dynamicCriteriaTagsLogicalOperator: z.string().nullable(),
  userId: z.number(),
  tags: z.array(tagSchema).nullable(),
  bandwidthLimit: z.number().nullable(),
  groupsWithPermissions: z.string().nullable(),
  createdDt: z.string().nullable(),
  modifiedDt: z.string().nullable(),
  folderId: z.number().nullable(),
  permissionsFolderId: z.number().nullable(),
  ref1: z.string().nullable(),
  ref2: z.string().nullable(),
  ref3: z.string().nullable(),
  ref4: z.string().nullable(),
  ref5: z.string().nullable(),
}).passthrough();

// Schema for notification data validation
const notificationSchema = z.object({
  notificationId: z.number(),
  createDt: z.union([z.string(), z.number()]),
  releaseDt: z.union([z.string(), z.number()]),
  subject: z.string(),
  type: z.string(),
  body: z.string(),
  isInterrupt: z.number(),
  isSystem: z.number(),
  userId: z.number(),
  filename: z.string().nullable(),
  originalFileName: z.string().nullable(),
  nonusers: z.string().nullable(),
  userGroups: z.array(userGroupSchema).nullable(),
  displayGroups: z.array(displayGroupSchema).nullable(),
}).passthrough();

// Schema for API response validation
const outputSchema = z.object({
  success: z.boolean(),
  data: notificationSchema.optional(),
  message: z.string().optional(),
  error: z.any().optional(),
  errorData: z.any().optional(),
});

/**
 * Tool for creating notifications in Xibo CMS
 * 
 * This tool accepts notification details and creates a new notification
 * in the Xibo CMS system.
 */
export const addNotification = createTool({
  id: 'add-notification',
  description: 'Create a new notification',
  inputSchema: z.object({
    subject: z.string().describe('Notification subject'),
    body: z.string().optional().describe('Notification body'),
    releaseDt: z.string().describe('Notification release date and time (ISO 8601 format)'),
    isInterrupt: z.number().describe('Flag to interrupt web portal navigation/login (0-1)'),
    displayGroupIds: z.array(z.number()).describe('Array of display group IDs to assign the notification to'),
    userGroupIds: z.array(z.number()).describe('Array of user group IDs to assign the notification to')
  }),
  outputSchema,
  execute: async ({ context }) => {
    const logContext = { ...context };
    logger.info("Attempting to create a new notification.", logContext);

    if (!config.cmsUrl) {
      logger.error("CMS URL is not configured.", logContext);
      return { success: false, message: "CMS URL is not configured." };
    }

    try {
      const url = new URL(`${config.cmsUrl}/api/notification`);
      logger.debug(`Requesting to create notification at: ${url.toString()}`, logContext);

      const formData = new URLSearchParams();
      formData.append("subject", context.subject);
      if (context.body) {
        formData.append("body", context.body);
      }
      formData.append("releaseDt", context.releaseDt);
      formData.append("isInterrupt", context.isInterrupt.toString());
      context.displayGroupIds.forEach(id => formData.append('displayGroupIds[]', id.toString()));
      context.userGroupIds.forEach(id => formData.append('userGroupIds[]', id.toString()));

      const headers = await getAuthHeaders();
      headers['Content-Type'] = 'application/x-www-form-urlencoded';

      const response = await fetch(url.toString(), {
        method: 'POST',
        headers,
        body: formData.toString(),
      });

      const responseText = await response.text();
      
      if (!response.ok) {
        const errorData = decodeErrorMessage(responseText);
        logger.error("Failed to create notification via CMS API.", {
          ...logContext,
          status: response.status,
          errorData,
        });
        return {
          success: false,
          message: `API request failed with status ${response.status}.`,
          errorData,
        };
      }
      
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        logger.error("Failed to parse JSON response from CMS API.", {
          ...logContext,
          responseText,
        });
        return {
          success: false,
          message: "Invalid JSON response from server.",
          errorData: responseText,
        };
      }
      
      const validationResult = notificationSchema.safeParse(responseData);

      if (!validationResult.success) {
        logger.warn("API response validation failed for postNotification.", {
          ...logContext,
          error: validationResult.error.flatten(),
          responseData,
        });
        return {
          success: false,
          message: "Response validation failed.",
          error: validationResult.error.flatten(),
          errorData: responseData,
        };
      }

      logger.info(`Successfully created notification "${validationResult.data.subject}".`, logContext);
      return { success: true, data: validationResult.data };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      logger.error("An unexpected error occurred in postNotification.", {
        ...logContext,
        error: errorMessage,
      });
      return { success: false, message: "An unexpected error occurred.", error: errorMessage };
    }
  },
}); 