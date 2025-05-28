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
 * Xibo CMS User Creation Tool
 * 
 * This module provides functionality to create new users in the Xibo CMS system.
 * It implements the user creation API endpoint and handles the necessary validation
 * and data transformation for creating users with appropriate permissions and settings.
 */

import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from '../../../index';
import { base64Encode } from "../utility/encoding";

/**
 * Create a safe version of data for logging without sensitive information
 * 
 * @param data The original data object
 * @returns A copy with password replaced by asterisks
 */
function getSafeDataForLogging(data: any): any {
  if (!data) return data;
  const safeCopy = { ...data };
  if (safeCopy.password) {
    safeCopy.password = '********';
  }
  return safeCopy;
}

/**
 * Tool for creating new users in Xibo CMS
 * 
 * This tool accepts user details and creates a new user account
 * with appropriate permissions based on the userTypeId.
 * Default values are provided for common settings.
 */
export const addUser = createTool({
  id: "add-user",
  description: "Add a new user to Xibo CMS",
  inputSchema: z.object({
    userName: z.string().describe("Username for the new user account"),
    email: z.string().optional().describe("Email address for the user (optional)"),
    userTypeId: z.number().default(3).describe("User type ID (default: 3 for standard user)"),
    homeFolderId: z.number().default(1).describe("Home folder ID for the user (default: 1)"),
    homePageId: z.string().default("icondashboard.view").describe("Default home page for the user (default: icondashboard.view)"),
    password: z.string().describe("Password for the user account"),
    groupId: z.number().default(1).describe("Group ID for the user (default: 1)"),
    newUserWizard: z.number().default(0).describe("Whether to show new user wizard (0: no, 1: yes)"),
    hideNavigation: z.number().default(0).describe("Whether to hide navigation (0: no, 1: yes)"),
    firstName: z.string().optional().describe("User's first name (optional)"),
    lastName: z.string().optional().describe("User's last name (optional)"),
    libraryQuota: z.number().default(4096).describe("Library quota in MB (default: 4096)"),
    isPasswordChangeRequired: z.number().optional().default(0).describe("Whether password change is required on first login (0: no, 1: yes)"),
    phone: z.string().optional().describe("Phone number for the user (optional)"),
    ref1: z.string().optional().describe("Reference 1 for the user (optional)"),
    ref2: z.string().optional().describe("Reference 2 for the user (optional)"),
    ref3: z.string().optional().describe("Reference 3 for the user (optional)"),
    ref4: z.string().optional().describe("Reference 4 for the user (optional)"),
    ref5: z.string().optional().describe("Reference 5 for the user (optional)"),
    isPasswordChangeReuest: z.number().default(0).describe("Whether to change password on first login (0: no, 1: yes)"),
  }),
  outputSchema: z.object({}),  // Returns an empty object
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not configured");
    }

    // Use the standard API endpoint
    const url = new URL(`${config.cmsUrl}/api/user`);
    
    // Use the original username as is
    logger.info(`Creating new user: ${context.userName}`);

    try {
      // Get authentication headers
      const headers = await getAuthHeaders();
      
      // Set Content-Type header for form-urlencoded
      const requestHeaders = {
        ...headers,
        'Content-Type': 'application/x-www-form-urlencoded'
      };
      
      // Create form data using URLSearchParams
      const formData = new URLSearchParams();
      formData.append("userName", context.userName);
      formData.append("userTypeId", context.userTypeId.toString());
      formData.append("homePageId", context.homePageId);
      formData.append("homeFolderId", context.homeFolderId.toString());
      formData.append("password", base64Encode(context.password));
      formData.append("groupId", context.groupId.toString());
      formData.append("newUserWizard", context.newUserWizard.toString());
      formData.append("hideNavigation", context.hideNavigation.toString());
      formData.append("libraryQuota", context.libraryQuota.toString());
      formData.append("isPasswordChangeReuest", context.isPasswordChangeReuest.toString());
      
      // Add optional parameters if they exist
      if (context.email) {
        formData.append("email", context.email);
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
      
      // Submit request to Xibo CMS API with form-urlencoded data
      const response = await fetch(url.toString(), {
        method: "POST",
        headers: requestHeaders,
        body: formData.toString(),
      });

      // Log the complete response
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
      
      // Check if response is successful
      if (!response.ok) {
        // Try to get detailed error information
        try {
          const errorData = JSON.parse(responseText);
          
          // Decode error message
          if (errorData.message) {
            errorData.message = decodeURIComponent(errorData.message);
          }
          
          // Log detailed information for validation errors (422)
          if (response.status === 422 && errorData.error) {
            logger.error(`Validation error: ${errorData.error.message}`, {
              status: response.status,
              url: url.toString(),
              userName: context.userName,
              errorDetails: errorData.error
            });
          } else {
            logger.error(`Failed to create user: ${JSON.stringify(errorData)}`, { 
              status: response.status,
              url: url.toString(),
              userName: context.userName,
              email: context.email
            });
          }
        } catch (parseError) {
          // Log original error message if JSON parsing fails
          logger.error(`Failed to create user: ${responseText}`, { 
            status: response.status,
            url: url.toString(),
            userName: context.userName,
            email: context.email
          });
        }
        
        throw new Error(`HTTP error! status: ${response.status}, message: ${responseText}`);
      }

      // Return empty object for successful response
      logger.info(`User created successfully`);
      return {};
    } catch (error) {
      logger.error(`addUser: An error occurred: ${error instanceof Error ? error.message : "Unknown error"}`, { error });
      
      // Decode error message
      if (error instanceof Error) {
        try {
          const errorObj = JSON.parse(error.message);
          if (errorObj.message) {
            errorObj.message = decodeURIComponent(errorObj.message);
            error.message = JSON.stringify(errorObj);
          }
        } catch (e) {
          // Use original error message if JSON parsing fails
        }
      }
      
      throw error;
    }
  },
});

export default addUser; 