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
import { decodeErrorMessage } from "../utility/error";

/**
 * Schema for API response after deleting a resolution
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
      const url = new URL(`${config.cmsUrl}/api/resolution/${context.resolutionId}`);
      logger.info(`Deleting resolution with ID: ${context.resolutionId}`);

      const formData = new URLSearchParams();
      formData.append("resolutionId", context.resolutionId.toString());

      // Get authentication headers
      const headers = await getAuthHeaders();
      headers['Content-Type'] = 'application/x-www-form-urlencoded';

      const response = await fetch(url.toString(), {
        method: "DELETE",
        headers: headers,
        body: formData.toString(),
      });

      const text = await response.text();
      if (!response.ok) {
        // Decode the error message for better readability
        const decodedText = decodeErrorMessage(text);
        let errorMessage;
        try {
          const errorObj = JSON.parse(decodedText);
          errorMessage = errorObj.message || decodedText;
        } catch {
          errorMessage = decodedText;
        }
        
        logger.error(`Failed to delete resolution: ${errorMessage}`, { 
          status: response.status,
          url: url.toString(),
          resolutionId: context.resolutionId
        });
        throw new Error(errorMessage);
      }

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