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
 * Xibo CMS User Information Retrieval Tool
 * 
 * This module provides functionality to retrieve user information from the Xibo CMS API.
 * It supports filtering users by various parameters such as userId, userName, userTypeId,
 * and retired status.
 * 
 * The tool validates both input parameters and API responses using Zod schemas to ensure
 * data integrity and type safety throughout the request/response cycle.
 */

import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { createLogger } from '@mastra/core/logger';

const logger = createLogger({ name: 'xibo-agent:user:getUser' });

/**
 * Schema for user group data
 */
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
  buttons: z.array(z.unknown()),
});

/**
 * Schema for user response data from the Xibo API
 */
const userResponseSchema = z.array(z.object({
  userId: z.number(),
  userName: z.string(),
  userTypeId: z.number(),
  loggedIn: z.number().nullable(),
  email: z.string().nullable(),
  homePageId: z.string(),
  homeFolderId: z.number(),
  lastAccessed: z.string().nullable(),
  newUserWizard: z.number(),
  retired: z.number(),
  isPasswordChangeRequired: z.number(),
  groupId: z.number(),
  group: z.string(),
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
  campaigns: z.array(z.unknown()),
  layouts: z.array(z.unknown()),
  media: z.array(z.unknown()),
  events: z.array(z.unknown()),
  playlists: z.array(z.unknown()),
  displayGroups: z.array(z.unknown()),
  dayParts: z.array(z.unknown()),
  isSystemNotification: z.number(),
  isDisplayNotification: z.number(),
  isDataSetNotification: z.number(),
  isLayoutNotification: z.number(),
  isLibraryNotification: z.number(),
  isReportNotification: z.number(),
  isScheduleNotification: z.number(),
  isCustomNotification: z.number(),
  twoFactorTypeId: z.number(),
  homeFolder: z.string(),
}));

/**
 * Tool for retrieving user information from Xibo CMS
 */
export const getUser = createTool({
  id: 'get-user',
  description: 'Get user information from Xibo CMS',
  inputSchema: z.object({
    userId: z.number().optional().describe('Filter by User Id'),
    userName: z.string().optional().describe('Filter by User Name'),
    userTypeId: z.number().optional().describe('Filter by UserType Id'),
    retired: z.number().optional().describe('Filter by Retired')
  }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        throw new Error("CMS URL is not configured");
      }

      const headers = await getAuthHeaders();

      // Build query parameters
      const queryParams = new URLSearchParams();
      if (context.userId) queryParams.append('userId', context.userId.toString());
      if (context.userName) queryParams.append('userName', context.userName);
      if (context.userTypeId) queryParams.append('userTypeId', context.userTypeId.toString());
      if (context.retired) queryParams.append('retired', context.retired.toString());

      const queryString = queryParams.toString();
      const url = `${config.cmsUrl}/api/user${queryString ? `?${queryString}` : ''}`;

      const response = await fetch(url, {
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const validatedData = userResponseSchema.parse(data);

      return JSON.stringify(validatedData, null, 2);
    } catch (error) {
      logger.error(`Error in getUser tool: ${error instanceof Error ? error.message : "Unknown error"}`, { error });
      return `Error: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  },
});