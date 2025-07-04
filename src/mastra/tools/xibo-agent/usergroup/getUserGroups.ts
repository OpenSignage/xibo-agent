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
 * @module getUserGroups
 * @description This module provides functionality to search for and retrieve
 * user groups from the Xibo CMS.
 */

import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../index";
import { decodeErrorMessage } from "../utility/error";

/**
 * Schema for the user group data returned by the API.
 */
const userGroupSchema = z.object({
  groupId: z.number(),
  group: z.string(),
  isUserSpecific: z.number().optional(),
  isEveryone: z.number().optional(),
  description: z.string().nullable().optional(),
  libraryQuota: z.number().nullable().optional(),
  isSystemNotification: z.number().optional(),
  isDisplayNotification: z.number().optional(),
  isDataSetNotification: z.number().optional(),
  isLayoutNotification: z.number().optional(),
  isLibraryNotification: z.number().optional(),
  isReportNotification: z.number().optional(),
  isScheduleNotification: z.number().optional(),
  isCustomNotification: z.number().optional(),
  isShownForAddUser: z.number().optional(),
  defaultHomepageId: z.string().nullable().optional(),
  features: z.array(z.string()).optional(),
  buttons: z.array(z.string()).optional(),
});

/**
 * Schema for the tool's output.
 */
const outputSchema = z.union([
  z.object({
    success: z.literal(true),
    data: z.array(userGroupSchema),
    message: z.string(),
  }),
  z.object({
    success: z.literal(false),
    message: z.string(),
    error: z.any().optional(),
    errorData: z.any().optional(),
  }),
]);

/**
 * Tool to retrieve a list of user groups from the Xibo CMS.
 */
export const getUserGroups = createTool({
  id: "get-user-groups",
  description: "Search for user groups in Xibo CMS",
  inputSchema: z.object({
    userGroupId: z.number().optional().describe("Filter by a specific User Group ID"),
    userGroup: z.string().optional().describe("Filter by a user group name (partial match supported)"),
  }),
  outputSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      const message = "CMS URL is not configured.";
      logger.error(message);
      return { success: false as const, message };
    }

    const searchCriteria = (context.userGroupId ? `ID: ${context.userGroupId}` : '') + 
                           (context.userGroup ? ` Name: ${context.userGroup}` : '');
    logger.info(`Attempting to get user groups with criteria: ${searchCriteria || 'none'}`);

    try {
      const url = new URL(`${config.cmsUrl}/api/group`);
      if (context.userGroupId) url.searchParams.append("userGroupId", context.userGroupId.toString());
      if (context.userGroup) url.searchParams.append("userGroup", context.userGroup);

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: await getAuthHeaders(),
      });

      const rawData = await response.json();

      if (!response.ok) {
        const decodedError = decodeErrorMessage(rawData);
        const message = `Failed to get user groups. API responded with status ${response.status}`;
        logger.error(message, { response: decodedError });
        return { success: false as const, message, errorData: decodedError };
      }

      // The API might return a single object or an array of objects
      const userGroups = Array.isArray(rawData) ? rawData : [rawData];

      const validationResult = z.array(userGroupSchema).safeParse(userGroups);
      if (!validationResult.success) {
        const message = "API response validation failed";
        logger.error(message, { error: validationResult.error, data: rawData });
        return { success: false as const, message, error: validationResult.error, errorData: rawData };
      }

      if (validationResult.data.length === 0) {
        const message = "No user groups found matching the criteria.";
        logger.info(message, { criteria: context });
        return { success: true, data: [], message };
      }

      const message = `Successfully retrieved ${validationResult.data.length} user group(s).`;
      logger.info(message);
      return { success: true, data: validationResult.data, message };
    } catch (error) {
      const message = "An unexpected error occurred while getting user groups.";
      logger.error(message, { error });
      return {
        success: false as const,
        message,
        error: error instanceof Error ? { name: error.name, message: error.message } : error,
      };
    }
  },
}); 