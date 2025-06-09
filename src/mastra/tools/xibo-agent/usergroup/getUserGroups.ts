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
 * Xibo CMS User Group Search Tool
 * 
 * This module provides functionality to search user groups in the Xibo CMS system.
 * It implements the user group search API endpoint and handles the necessary validation
 * and data transformation for retrieving user group information.
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
  isUserSpecific: z.number().optional(),
  isEveryone: z.number().optional(),
  isDataSetNotification: z.number().optional(),
  isLayoutNotification: z.number().optional(),
  isLibraryNotification: z.number().optional(),
  isReportNotification: z.number().optional(),
  features: z.array(z.string()).optional(),
  buttons: z.array(z.string()).optional(),
});

/**
 * Schema for API response validation
 * Expected response format from the Xibo CMS API
 */
const apiResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  data: z.array(userGroupSchema).optional()
});

/**
 * Tool for searching user groups in Xibo CMS
 * 
 * This tool accepts search criteria and retrieves matching user groups
 * from the Xibo CMS system.
 */
export const getUserGroups = createTool({
  id: "get-user-groups",
  description: "Search user groups in Xibo CMS",
  inputSchema: z.object({
    userGroupId: z.number().optional().describe("User group ID (optional)"),
    userGroup: z.string().optional().describe("User group name (optional)"),
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/api/group`);
    
    // Add query parameters
    if (context.userGroupId) url.searchParams.append("userGroupId", context.userGroupId.toString());
    if (context.userGroup) url.searchParams.append("userGroup", context.userGroup);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: await getAuthHeaders(),
    });

    // Get response text
    const responseText = await response.text();

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}, message: ${responseText}`);
    }

    // Parse and validate response data
    try {
      const rawData = JSON.parse(responseText);
      
      // Handle array response
      const userGroups = Array.isArray(rawData) ? rawData : [rawData];

      // Check if data is empty
      if (userGroups.length === 0) {
        const searchCriteria = [];
        if (context.userGroupId) searchCriteria.push(`ID: ${context.userGroupId}`);
        if (context.userGroup) searchCriteria.push(`Name: ${context.userGroup}`);

        const criteriaMessage = searchCriteria.length > 0 
          ? ` with criteria: ${searchCriteria.join(', ')}`
          : '';

        logger.info(`No user groups found${criteriaMessage}`);
        return {
          success: false,
          message: `No user groups found${criteriaMessage}`
        };
      }

      // Validate the transformed data
      const validatedData = {
        success: true,
        data: userGroups
      };

      return apiResponseSchema.parse(validatedData);
    } catch (error) {
      logger.error(`Failed to parse response: ${error instanceof Error ? error.message : "Unknown error"}`, { 
        error,
        responseText
      });
      return {
        success: false,
        message: error instanceof Error ? error.message : "Invalid response format from CMS API"
      };
    }
  },
});

export default getUserGroups; 