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

/**
 * Schema for user group data
 * 
 * Defines the structure of user group information returned by the API.
 * This includes permissions, notification settings, and features.
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
  loggedIn: z.number(),
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
    _placeholder: z.string().optional().describe('This tool does not require input parameters')
  }),
  outputSchema: z.string(),
  execute: async () => {
    try {
      // Verify CMS URL is configured
      if (!config.cmsUrl) {
        throw new Error("CMS URL is not set");
      }

      // Prepare authentication and endpoint URL
      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/user`;

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