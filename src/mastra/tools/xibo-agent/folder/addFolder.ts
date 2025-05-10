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
 * Xibo CMS Folder Creation Tool
 * 
 * This module provides functionality to create new folders in the Xibo CMS system.
 * It implements the folder creation API endpoint and handles the necessary validation
 * and data transformation for creating folders with appropriate properties.
 */

import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from '../../../index';
import { decodeErrorMessage } from "../utility/error";

/**
 * Schema for folder data returned from the API
 * 
 * This defines the structure of folder data as returned from Xibo CMS
 * after successfully creating a new folder.
 */
const folderSchema = z.object({
  id: z.number(),
  type: z.string().nullable(),
  text: z.string(),
  parentId: z.union([z.number(), z.string()]).nullable(),
  isRoot: z.number().nullable(),
  children: z.string().nullable(),
  permissionsFolderId: z.number().nullable(),
});

/**
 * Schema for API response after creating a folder
 */
const apiResponseSchema = z.object({
  success: z.boolean(),
  data: folderSchema,
});

/**
 * Tool for creating new folders in Xibo CMS
 * 
 * This tool accepts folder details and creates a new folder
 * with the specified name and optional parent folder.
 */
export const addFolder = createTool({
  id: "add-folder",
  description: "Add a new folder to Xibo CMS",
  inputSchema: z.object({
    text: z.string().describe('Folder name'),
    parentId: z.number().optional().describe('Parent folder ID (numeric, optional)'),
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not configured");
    }

    // Prepare the API endpoint URL
    const url = new URL(`${config.cmsUrl}/api/folders`);
    logger.info(`Creating folder: ${context.text}`);

    // Prepare form data for request
    const formData = new URLSearchParams();
    formData.append("text", context.text);
    if (context.parentId) formData.append("parentId", context.parentId.toString());
    
    // Get authentication headers
    const headers = await getAuthHeaders();
    
    // Set Content-Type header as required by Xibo API
    const requestHeaders = {
      ...headers,
      'Content-Type': 'application/x-www-form-urlencoded'
    };

    try {
      // Submit request to Xibo CMS API
      const response = await fetch(url.toString(), {
        method: "POST",
        headers: requestHeaders,
        body: formData.toString(),
      });
      
      // Get the complete response text
      const text = await response.text();
      
      // Check if response is successful
      if (!response.ok) {
        throw new Error(decodeErrorMessage(text));
      }

      // Parse the response data
      let data;
      try {
        data = JSON.parse(text);
      } catch (error) {
        logger.error(`Failed to parse response as JSON: ${text}`);
        throw new Error(`Invalid JSON response from server: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
      
      // Validate the response data against schema
      try {
        const validatedData = apiResponseSchema.parse({
          success: true,
          data: data
        });
        logger.info(`Folder created successfully: id=${data.id}`);
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
      logger.error(`addFolder: An error occurred: ${error instanceof Error ? error.message : "Unknown error"}`, { error });
      throw error;
    }
  },
});

export default addFolder; 