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
 * Xibo CMS Folder Deletion Tool
 * 
 * This module provides functionality to delete folders from the Xibo CMS system.
 * It implements the folder deletion API endpoint and handles proper response validation.
 */

import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from '../../../index';

/**
 * Schema for API response after deleting a folder
 * 
 * For DELETE operations, the API typically returns a 204 No Content status
 * with no response body. Our implementation returns a standardized success structure.
 */
const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z.null(),
});

/**
 * Tool for deleting a folder from Xibo CMS
 * 
 * This tool requires a folder ID and will completely remove the folder
 * and potentially its contents from the CMS. This operation cannot be undone.
 */
export const deleteFolder = createTool({
  id: "delete-folder",
  description: "Delete a folder from Xibo CMS",
  inputSchema: z.object({
    folderId: z.number().describe('ID of the folder to delete'),
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not configured");
    }

    try {
      // Prepare the API endpoint URL with the folder ID
      const url = new URL(`${config.cmsUrl}/api/folders/${context.folderId}`);
      logger.info(`Deleting folder with ID: ${context.folderId}`);

      // Get authentication headers
      const headers = await getAuthHeaders();

      // Send the delete request
      const response = await fetch(url.toString(), {
        method: "DELETE",
        headers: headers,
      });
      
      // Handle error responses
      if (!response.ok) {
        const responseText = await response.text();
        logger.error(`Failed to delete folder: ${responseText}`, { 
          status: response.status,
          url: url.toString(),
          folderId: context.folderId
        });
        throw new Error(`HTTP error! status: ${response.status}, message: ${responseText}`);
      }

      // For successful deletion (typically 204 No Content)
      logger.info(`Folder with ID ${context.folderId} deleted successfully`);
      return {
        success: true,
        data: null
      };
    } catch (error) {
      logger.error(`deleteFolder: An error occurred: ${error instanceof Error ? error.message : "Unknown error"}`, { error });
      throw error;
    }
  },
});

export default deleteFolder; 