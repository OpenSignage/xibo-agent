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
 * Xibo CMS User Group Creation Tool
 * 
 * This module provides functionality to create new user groups in the Xibo CMS system.
 * It implements the user group creation API endpoint and handles the necessary validation
 * and data transformation for creating user groups with appropriate permissions.
 */

import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../index";

/**
 * Schema for user group data validation
 * Defines the structure of user group data in the Xibo CMS system
 */
const userGroupSchema = z.object({
  groupId: z.number(),
  group: z.string(),
  description: z.string().nullable().optional(),
  libraryQuota: z.number().optional(),
  isSystemNotification: z.number().optional(),
  isDisplayNotification: z.number().optional(),
  isScheduleNotification: z.number().optional(),
  isCustomNotification: z.number().optional(),
  isShownForAddUser: z.number().optional(),
  defaultHomePageId: z.number().nullable().optional(),
});

/**
 * Schema for API response validation
 * Expected response format from the Xibo CMS API
 */
const apiResponseSchema = z.object({
  success: z.boolean(),
  data: userGroupSchema,
});

/**
 * Tool for creating new user groups in Xibo CMS
 * 
 * This tool accepts user group details and creates a new user group
 * with appropriate permissions and settings.
 */
export const addUserGroup = createTool({
  id: "add-user-group",
  description: "Add a new user group to Xibo CMS",
  inputSchema: z.object({
    group: z.string().describe("Name of the user group to be created"),
    description: z.string().optional().describe("Description of the user group (optional)"),
    libraryQuota: z.string().optional().describe("Library quota in MB (optional)"),
    isSystemNotification: z.number().optional().describe("Whether to receive system notifications (0: no, 1: yes)"),
    isDisplayNotification: z.number().optional().describe("Whether to receive display notifications (0: no, 1: yes)"),
    isScheduleNotification: z.number().optional().describe("Whether to receive schedule notifications (0: no, 1: yes)"),
    isCustomNotification: z.number().optional().describe("Whether to receive custom notifications (0: no, 1: yes)"),
    isShownForAddUser: z.number().optional().describe("Whether to show in user creation (0: no, 1: yes)"),
    defaultHomePageId: z.number().optional().describe("Default home page ID for the user group (optional)"),
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/api/group`);
    
    // Create form data
    const formData = new URLSearchParams();
    formData.append("group", context.group);
    if (context.description) formData.append("description", context.description);
    if (context.libraryQuota) formData.append("libraryQuota", context.libraryQuota);
    if (context.isSystemNotification) formData.append("isSystemNotification", context.isSystemNotification.toString());
    if (context.isDisplayNotification) formData.append("isDisplayNotification", context.isDisplayNotification.toString());
    if (context.isScheduleNotification) formData.append("isScheduleNotification", context.isScheduleNotification.toString());
    if (context.isCustomNotification) formData.append("isCustomNotification", context.isCustomNotification.toString());
    if (context.isShownForAddUser) formData.append("isShownForAddUser", context.isShownForAddUser.toString());
    if (context.defaultHomePageId) formData.append("defaultHomePageId", context.defaultHomePageId.toString());

    logger.info('Creating user group:', {
      url: url.toString(),
      group: context.group,
      hasDescription: !!context.description,
      hasLibraryQuota: !!context.libraryQuota,
      notificationSettings: {
        system: context.isSystemNotification,
        display: context.isDisplayNotification,
        schedule: context.isScheduleNotification,
        custom: context.isCustomNotification
      }
    });

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: {
        ...await getAuthHeaders(),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Failed to create user group:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }

    const rawData = await response.json();
    try {
      const validatedData = apiResponseSchema.parse(rawData);
      logger.info('User group created successfully:', {
        groupId: validatedData.data.groupId,
        group: validatedData.data.group
      });
      return validatedData;
    } catch (error) {
      logger.error('Failed to validate response data:', {
        error: error instanceof Error ? error.message : "Unknown error",
        rawData
      });
      throw error;
    }
  },
});

export default addUserGroup; 