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
 * Xibo CMS User Deletion Tool
 * 
 * This module provides functionality to delete users from the Xibo CMS system.
 * It implements the user deletion API endpoint and handles the necessary parameters
 * for deleting users and managing their associated items.
 */

import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from '../../../index';
import { decodeErrorMessage } from "../utility/error";

/**
 * Schema for API response validation
 * Expected response format from the Xibo CMS API
 */
const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z.null(),
});

/**
 * Tool for deleting users from Xibo CMS
 * 
 * This tool accepts a user ID and optional parameters for handling
 * the user's associated items (delete or reassign).
 */
export const deleteUser = createTool({
  id: "delete-user",
  description: "Delete a user from Xibo CMS",
  inputSchema: z.object({
    userId: z.number().describe("ID of the user to be deleted"),
    deleteAllItems: z.number().optional().describe("Whether to delete all items owned by the user (0: no, 1: yes)"),
    reassignUserId: z.number().optional().describe("ID of the user to reassign items to (required if deleteAllItems is 0)"),
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
    if (context.deleteAllItems) formData.append("deleteAllItems", context.deleteAllItems.toString());
    if (context.reassignUserId) formData.append("reassignUserId", context.reassignUserId.toString());

    // Get authentication headers and add Content-Type
    const headers = await getAuthHeaders();
    const requestHeaders = {
      ...headers,
      'Content-Type': 'application/x-www-form-urlencoded'
    };

    // Send DELETE request to Xibo CMS API
    const response = await fetch(url.toString(), {
      method: "DELETE",
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
      logger.error('Failed to delete user:', {
        status: response.status,
        statusText: response.statusText,
        error: decodedError
      });
      throw new Error(`HTTP error! status: ${response.status}, message: ${decodedError}`);
    }

    // Return success response
    return {
      success: true,
      data: null
    };
  },
});

export default deleteUser; 