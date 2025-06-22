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
 * Notification Tool for Xibo CMS
 * 
 * This module provides functionality to retrieve notifications from the Xibo CMS.
 * It supports filtering by notification ID and subject, and can include related data.
 */

import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from '../../../index';
import { decodeErrorMessage } from "../utility/error";

// Schemas for embedded data, based on actual API response
const tagSchema = z.object({
  tag: z.string().nullable(),
  tagId: z.number(),
  value: z.string().nullable(),
}).passthrough();

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


/**
 * Schema for notification data
 */
const notificationSchema = z.object({
  notificationId: z.number(),
  subject: z.string(),
  body: z.string(),
  createDt: z.union([z.string(), z.number()]).optional(),
  releaseDt: z.union([z.string(), z.number()]).optional(),
  type: z.string().optional(),
  isEmail: z.number().optional(),
  isInterrupt: z.number(),
  isSystem: z.number(),
  userId: z.number(),
  filename: z.string().nullable().optional(),
  originalFileName: z.string().nullable().optional(),
  nonusers: z.string().nullable().optional(),
  userGroups: z.array(userGroupSchema).nullable().optional(),
  displayGroups: z.array(displayGroupSchema).nullable().optional(),
  displayGroupIds: z.array(z.number()).optional(),
  displayGroupNames: z.array(z.string()).optional(),
  read: z.number().optional(),
  readDt: z.string().nullable().optional(),
  readBy: z.string().nullable().optional()
}).passthrough();

/**
 * Schema for the tool's output, covering both success and failure cases.
 */
const outputSchema = z.object({
  success: z.boolean(),
  data: z.array(notificationSchema).optional(),
  message: z.string().optional(),
  error: z.any().optional(),
  errorData: z.any().optional(),
});

/**
 * Tool for retrieving notifications from Xibo CMS
 */
export const getNotifications = createTool({
  id: 'get-notifications',
  description: 'Retrieve notifications from Xibo CMS',
  inputSchema: z.object({
    notificationId: z.number().optional().describe('Filter by notification ID'),
    subject: z.string().optional().describe('Filter by subject'),
    embed: z.string().optional().describe('Include related data (userGroups, displayGroups)')
  }),
  outputSchema,
  execute: async ({ context }) => {
    const logContext = { ...context };
    logger.info("Attempting to retrieve notifications.", logContext);
    
    if (!config.cmsUrl) {
      logger.error("CMS URL is not configured.", logContext);
      return { success: false, message: "CMS URL is not configured." };
    }

    try {
      const params = new URLSearchParams();
      if (context.notificationId) {
        params.append('notificationId', context.notificationId.toString());
      }
      if (context.subject) {
        params.append('subject', context.subject);
      }
      if (context.embed) {
        params.append('embed', context.embed);
      }

      const url = new URL(`${config.cmsUrl}/api/notification`);
      url.search = params.toString();
      
      logger.debug(`Requesting notifications from: ${url.toString()}`, logContext);

      const headers = await getAuthHeaders();
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers
      });
      
      const responseText = await response.text();

      if (!response.ok) {
        const errorData = decodeErrorMessage(responseText);
        logger.error("Failed to retrieve notifications from CMS API.", {
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

      const validationResult = z.array(notificationSchema).safeParse(responseData);

      if (!validationResult.success) {
        logger.warn("API response validation failed for getNotifications.", {
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

      logger.info(`Successfully retrieved ${validationResult.data.length} notifications.`, logContext);
      return { success: true, data: validationResult.data };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      logger.error("An unexpected error occurred in getNotifications.", {
        ...logContext,
        error: errorMessage,
      });
      return { success: false, message: "An unexpected error occurred.", error: errorMessage };
    }
  },
}); 