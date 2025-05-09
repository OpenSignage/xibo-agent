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
 * Xibo CMS Resolution Deletion Tool
 * 
 * This module provides functionality to delete resolutions from the Xibo CMS system.
 * It implements the resolution deletion API endpoint and handles proper response validation.
 */

import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from '../../../index';

/**
 * Schema for API response after deleting a resolution
 * 
 * For DELETE operations, the API typically returns a 204 No Content status
 * with no response body. Our implementation returns a standardized success structure.
 */
const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z.null(),
});

export const deleteResolution = createTool({
  id: "delete-resolution",
  description: "Delete a resolution from Xibo CMS",
  inputSchema: z.object({
    resolutionId: z.number().describe('ID of the resolution to delete'),
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not configured");
    }

    try {
      // Prepare the API endpoint URL with the resolution ID
      const url = new URL(`${config.cmsUrl}/api/resolution/${context.resolutionId}`);
      logger.info(`Deleting resolution with ID: ${context.resolutionId}`);

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
        logger.error(`Failed to delete resolution: ${responseText}`, { 
          status: response.status,
          url: url.toString(),
          resolutionId: context.resolutionId
        });
        throw new Error(`HTTP error! status: ${response.status}, message: ${responseText}`);
      }

      // For successful deletion (typically 204 No Content)
      logger.info(`Resolution with ID ${context.resolutionId} deleted successfully`);
      return {
        success: true,
        data: null
      };
    } catch (error) {
      logger.error(`deleteResolution: An error occurred: ${error instanceof Error ? error.message : "Unknown error"}`, { error });
      throw error;
    }
  },
});

export default deleteResolution; 