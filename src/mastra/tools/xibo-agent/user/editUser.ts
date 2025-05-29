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
 * Xibo CMS User Edit Tool
 * 
 * This module provides functionality to edit existing users in the Xibo CMS system.
 * It implements the user edit API endpoint and handles the necessary validation
 * and data transformation for updating user settings and permissions.
 */

import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from '../../../index';
import { base64Encode } from "../utility/encoding";
import { decodeErrorMessage } from "../utility/error";

/**
 * Schema for user data validation
 * Defines the structure of user data in the Xibo CMS system
 */
const userSchema = z.object({
  userId: z.number(),
  userName: z.string(),
  email: z.string().optional(),
  userTypeId: z.number(),
  homePageId: z.number(),
  libraryQuota: z.number().optional(),
  isSystemNotification: z.number().optional(),
  isDisplayNotification: z.number().optional(),
  isScheduleNotification: z.number().optional(),
  isCustomNotification: z.number().optional(),
  isShownForAddUser: z.number().optional(),
  defaultHomePageId: z.number().optional(),
  retired: z.number().optional(),
  tags: z.string().optional(),
});

/**
 * Schema for API response validation
 * Expected response format from the Xibo CMS API
 */
const apiResponseSchema = z.object({
  success: z.boolean(),
  data: userSchema,
});

/**
 * Tool for editing users in Xibo CMS
 * 
 * This tool accepts user details and updates an existing user account
 * with new settings and permissions.
 */
export const editUser = createTool({
  id: "edit-user",
  description: "Edit an existing user in Xibo CMS",
  inputSchema: z.object({
    userId: z.number().describe("ID of the user to be edited"),
    userName: z.string().optional().describe("New username for the user"),
    email: z.string().optional().describe("Email address for the user"),
    userTypeId: z.number().optional().describe("User type ID"),
    homePageId: z.string().describe("Home page ID for the user"),
    homeFolderId: z.number().optional().describe("Home folder ID for the user"),
    newPassword: z.string().optional().describe("New password for the user"),
    retypeNewPassword: z.string().optional().describe("Retype new password for the user"),
    retired: z.number().optional().describe("Whether the user is retired (0: no, 1: yes)"),
    groupId: z.number().optional().describe("Group ID for the user"),
    newUserWizard: z.number().optional().describe("Whether to show new user wizard (0: no, 1: yes)"),
    hideNavigation: z.number().optional().describe("Whether to hide navigation (0: no, 1: yes)"),
    firstName: z.string().optional().describe("User's first name"),
    lastName: z.string().optional().describe("User's last name"),
    libraryQuota: z.number().optional().describe("Library quota in MB"),
    isPasswordChangeRequired: z.number().optional().describe("Whether password change is required on first login (0: no, 1: yes)"),
    phone: z.string().optional().describe("Phone number for the user"),
    ref1: z.string().optional().describe("Reference 1 for the user"),
    ref2: z.string().optional().describe("Reference 2 for the user"),
    ref3: z.string().optional().describe("Reference 3 for the user"),
    ref4: z.string().optional().describe("Reference 4 for the user"),
    ref5: z.string().optional().describe("Reference 5 for the user"),
    isPasswordChangeReuest: z.number().optional().describe("Whether to change password on first login (0: no, 1: yes)")
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    // Check if CMS URL is configured
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    // Construct API endpoint URL
    const url = new URL(`${config.cmsUrl}/api/user/${context.userId}`);
    
    // Create form data using URLSearchParams
    const formData = new URLSearchParams();
    
    // Add required parameters
    formData.append("homePageId", context.homePageId);
    
    // Add optional parameters
    if (context.userName) {
      formData.append("userName", context.userName);
    }
    if (context.userTypeId) {
      formData.append("userTypeId", context.userTypeId.toString());
    }
    if (context.homeFolderId) {
      formData.append("homeFolderId", context.homeFolderId.toString());
    }
    if (context.groupId) {
      formData.append("groupId", context.groupId.toString());
    }
    if (context.newUserWizard) {
      formData.append("newUserWizard", context.newUserWizard.toString());
    }
    if (context.hideNavigation) {
      formData.append("hideNavigation", context.hideNavigation.toString());
    }
    if (context.libraryQuota) {
      formData.append("libraryQuota", context.libraryQuota.toString());
    }
    if (context.isPasswordChangeReuest) {
      formData.append("isPasswordChangeReuest", context.isPasswordChangeReuest.toString());
    }
    if (context.email) {
      formData.append("email", context.email);
    }
    if (context.newPassword) {
      formData.append("newPassword", base64Encode(context.newPassword));
    }
    if (context.retypeNewPassword) {
      formData.append("retypeNewPassword", base64Encode(context.retypeNewPassword));
    }
    if (context.retired) {
      formData.append("retired", context.retired.toString());
    }
    if (context.firstName) {
      formData.append("firstName", context.firstName);
    }
    if (context.lastName) {
      formData.append("lastName", context.lastName);
    }
    if (context.isPasswordChangeRequired) {
      formData.append("isPasswordChangeRequired", context.isPasswordChangeRequired.toString());
    }
    if (context.phone) {
      formData.append("phone", context.phone);
    }
    if (context.ref1) {
      formData.append("ref1", context.ref1);
    }
    if (context.ref2) {
      formData.append("ref2", context.ref2);
    }
    if (context.ref3) {
      formData.append("ref3", context.ref3);
    }
    if (context.ref4) {
      formData.append("ref4", context.ref4);
    }
    if (context.ref5) {
      formData.append("ref5", context.ref5);
    }

    // Get authentication headers and add Content-Type
    const headers = await getAuthHeaders();
    const requestHeaders = {
      ...headers,
      'Content-Type': 'application/x-www-form-urlencoded'
    };

    // Log form data for debugging
    logger.info('Sending form data:', {
      url: url.toString(),
      formData: formData.toString()
    });

    // Send PUT request to Xibo CMS API
    const response = await fetch(url.toString(), {
      method: "PUT",
      headers: requestHeaders,
      body: formData.toString(),
    });

    // Get response text
    const responseText = await response.text();
    
    // Decode response message
    let decodedResponse = responseText;
    try {
      const responseObj = JSON.parse(responseText);
      if (responseObj.message) {
        responseObj.message = decodeURIComponent(responseObj.message);
        decodedResponse = JSON.stringify(responseObj);
      }
    } catch (e) {
      // Use original message if JSON parsing fails
    }

    // Check if the request was successful
    if (!response.ok) {
      const errorText = await response.text();
      const decodedError = decodeErrorMessage(errorText);
      logger.error('Failed to edit user:', {
        status: response.status,
        statusText: response.statusText,
        error: decodedError
      });
      throw new Error(`HTTP error! status: ${response.status}, message: ${decodedError}`);
    }

    // Parse and validate response data
    try {
      const rawData = JSON.parse(responseText);
      const validatedData = apiResponseSchema.parse(rawData);
      return validatedData;
    } catch (error) {
      logger.error(`Failed to parse response: ${error instanceof Error ? error.message : "Unknown error"}`, { error });
      throw error;
    }
  },
});

export default editUser; 