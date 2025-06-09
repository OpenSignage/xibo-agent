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

// Schema for tag information in display groups
const tagSchema = z.object({
  tag: z.string(),
  tagId: z.number(),
  value: z.string()
});

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
  features: z.array(z.string()).nullable()
});

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
  ref5: z.string().nullable()
});

// Schema for notification data validation
const notificationSchema = z.object({
  notificationId: z.number(),
  createDt: z.string(),
  releaseDt: z.string(),
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
  displayGroups: z.array(displayGroupSchema).nullable()
});

// Schema for API response validation
const responseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  data: notificationSchema.optional()
});

/**
 * Tool for creating notifications in Xibo CMS
 * 
 * This tool accepts notification details and creates a new notification
 * in the Xibo CMS system.
 */
export const postNotification = createTool({
  id: 'post-notification',
  description: 'Create a new notification',
  inputSchema: z.object({
    subject: z.string().describe('Notification subject'),
    body: z.string().optional().describe('Notification body'),
    releaseDt: z.string().optional().describe('Notification release date and time (ISO 8601 format)'),
    isInterrupt: z.number().describe('Flag to interrupt web portal navigation/login (0-1)'),
    displayGroupIds: z.array(z.number()).describe('Array of display group IDs to assign the notification to'),
    userGroupIds: z.array(z.number()).describe('Array of user group IDs to assign the notification to')
  }),

  outputSchema: responseSchema,

  execute: async ({ context }) => {
    try {
      logger.info("Starting notification creation");
      
      // Validate CMS URL configuration
      if (!config.cmsUrl) {
        throw new Error("CMS URL is not set");
      }

      // Get authentication headers for API request
      const headers = await getAuthHeaders();
      logger.debug("Authentication headers obtained");

      // Prepare request body with ISO 8601 formatted date
      const requestBody = {
        ...context,
        releaseDt: context.releaseDt ? new Date(context.releaseDt).toISOString() : undefined
      };

      logger.debug("Sending notification creation request", { requestBody });

      // Send POST request to create notification
      const response = await fetch(`${config.cmsUrl}/api/notification`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      // Handle HTTP error responses
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        logger.error("HTTP error occurred", { 
          status: response.status, 
          errorData 
        });
        return {
          success: false,
          message: `HTTP error! status: ${response.status}${errorData ? `, message: ${JSON.stringify(errorData)}` : ''}`
        };
      }

      // Parse and validate response data
      const data = await response.json();
      logger.debug("Response data received", { data });

      try {
        const validatedData = notificationSchema.parse(data);
        logger.info("Notification created successfully");

        return {
          success: true,
          data: validatedData
        };
      } catch (validationError) {
        // Handle validation errors
        const errorDetails = validationError instanceof Error 
          ? JSON.parse(validationError.message)
          : "Unknown validation error";

        logger.error("Validation error occurred", { 
          error: errorDetails
        });

        return {
          success: false,
          message: "Validation error occurred",
          error: errorDetails
        };
      }
    } catch (error) {
      // Handle unexpected errors
      logger.error("Error occurred during notification creation", { 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error"
      };
    }
  },
}); 