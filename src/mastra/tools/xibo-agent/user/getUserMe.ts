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
 * Tool to retrieve current authenticated user information from Xibo CMS API
 * 
 * Accesses the /api/user/me endpoint to retrieve detailed information
 * about the authenticated user (group memberships, permissions, etc.)
 */

// Import required modules
import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from '../../../index';  // Import shared logger

// Define user group schema
// Validation schema to ensure API response format
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

// Define user response schema
// Complete structure of user information returned from the API
const userResponseSchema = z.object({
  userId: z.number(),
  userName: z.string(),
  userTypeId: z.number(),
  loggedIn: z.string().nullable(),
  email: z.string(),
  homePageId: z.string(),
  homeFolderId: z.number(),
  lastAccessed: z.string(),
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
});

// Define and export the tool
export const getUserMe = createTool({
  id: 'get-user-me',
  description: 'Retrieves information about the current Xibo user',
  // This tool doesn't require input parameters, so only define a placeholder
  inputSchema: z.object({
    _placeholder: z.string().optional().describe('This tool does not require input parameters')
  }),
  // Output is in string format (JSON string)
  outputSchema: z.string(),
  
  // Tool execution logic
  execute: async ({ context }) => {
    try {
      // Check if CMS URL is configured
      if (!config.cmsUrl) {
        throw new Error("CMS URL is not set");
      }

      // Get authentication headers
      const headers = await getAuthHeaders();
      
      // Execute API request
      const response = await fetch(`${config.cmsUrl}/api/user/me`, {
        headers,
      });

      // Handle error response
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Retrieve and validate response data
      const data = await response.json();
      const validatedData = userResponseSchema.parse(data);

      // Return formatted JSON
      return JSON.stringify(validatedData, null, 2);
    } catch (error) {
      // Log and handle errors
      logger.error(`getUserMe: An error occurred: ${error instanceof Error ? error.message : "Unknown error"}`, { error });
      return `An error occurred: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  },
});