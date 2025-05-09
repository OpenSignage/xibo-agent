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
 * Xibo CMS Folder Editing Tool
 * 
 * This module provides functionality to edit existing folders in the Xibo CMS system.
 * It implements the folder editing API endpoint and handles the necessary validation
 * and data transformation for updating folder properties.
 */

import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from '../../../index';

/**
 * Schema for folder data returned from the API
 * 
 * This defines the structure of folder data as returned from Xibo CMS.
 * The schema includes validation for all expected folder properties.
 * It uses a recursive definition to handle nested children folders.
 */
// Define folderSchema with recursion support
const folderSchema: z.ZodType<any> = z.lazy(() => 
  z.object({
    id: z.number(),
    type: z.string().nullable(),
    text: z.string(),
    parentId: z.union([z.number(), z.string()]).nullable(),
    isRoot: z.number().nullable(),
    // Allow children to be either an array of folders or null
    children: z.union([z.array(folderSchema), z.null()]),
    permissionsFolderId: z.number().nullable().optional(),
    // Additional fields that appear in the response
    folderId: z.number().optional(),
    folderName: z.string().optional()
  })
);

/**
 * Schema for API response after editing a folder
 */
const apiResponseSchema = z.object({
  success: z.boolean(),
  data: folderSchema,
});

/**
 * Tool for editing an existing folder in Xibo CMS
 * 
 * This tool allows updating folder properties, primarily the folder name.
 */
export const editFolder = createTool({
  id: "edit-folder",
  description: "Edit an existing folder in Xibo CMS",
  inputSchema: z.object({
    folderId: z.number().describe('ID of the folder to edit'),
    text: z.string().describe('New name for the folder'),
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not configured");
    }

    try {
      // Prepare the API endpoint URL with the folder ID
      const url = new URL(`${config.cmsUrl}/api/folders/${context.folderId}`);
      logger.info(`Editing folder with ID: ${context.folderId}`);

      // Prepare form data with the new folder name
      const formData = new URLSearchParams();
      formData.append("text", context.text);

      // Get authentication headers
      const headers = await getAuthHeaders();
      
      // Set Content-Type header as required by Xibo API
      const requestHeaders = {
        ...headers,
        'Content-Type': 'application/x-www-form-urlencoded'
      };

      // Send the update request
      const response = await fetch(url.toString(), {
        method: "PUT",
        headers: requestHeaders,
        body: formData.toString(),
      });
      
      // Get the complete response text
      const responseText = await response.text();
      
      // Handle error responses
      if (!response.ok) {
        logger.error(`Failed to edit folder: ${responseText}`, { 
          status: response.status,
          url: url.toString(),
          folderId: context.folderId,
          newName: context.text
        });
        throw new Error(`HTTP error! status: ${response.status}, message: ${responseText}`);
      }

      // Parse and validate the response data
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (error) {
        logger.error(`Failed to parse response as JSON: ${responseText}`);
        throw new Error(`Invalid JSON response from server: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
      
      // Validate the response data against schema
      try {
        const validatedData = apiResponseSchema.parse({
          success: true,
          data: data
        });
        logger.info(`Folder with ID ${context.folderId} updated to name: ${context.text}`);
        return validatedData;
      } catch (validationError) {
        logger.warn(`Response validation failed: ${validationError instanceof Error ? validationError.message : "Unknown error"}`, { 
          responseData: data 
        });
        
        // Return with basic validation even if full schema validation fails
        return {
          success: true,
          data: data
        };
      }
    } catch (error) {
      logger.error(`editFolder: An error occurred: ${error instanceof Error ? error.message : "Unknown error"}`, { error });
      throw error;
    }
  },
});

export default editFolder; 