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
 * Xibo CMS Resolution Editing Tool
 * 
 * This module provides functionality to edit existing resolutions in the Xibo CMS system.
 * It implements the resolution editing API endpoint and handles the necessary validation
 * and data transformation for updating resolution properties.
 */

import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from '../../../index';
import { decodeErrorMessage } from "../utility/error";

/**
 * Schema for resolution data returned from the API
 */
const resolutionSchema = z.object({
  resolutionId: z.number(),
  resolution: z.string(),
  width: z.number(),
  height: z.number(),
  enabled: z.number().optional(),
});

/**
 * Schema for API response after editing a resolution
 */
const apiResponseSchema = z.object({
  success: z.boolean(),
  data: resolutionSchema,
});

export const editResolution = createTool({
  id: "edit-resolution",
  description: "Edit an existing resolution in Xibo CMS",
  inputSchema: z.object({
    resolutionId: z.number().describe('ID of the resolution to edit'),
    resolution: z.string().describe('New resolution name'),
    width: z.number().describe('New width in pixels'),
    height: z.number().describe('New height in pixels'),
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not configured");
    }

    try {
      const url = new URL(`${config.cmsUrl}/api/resolution/${context.resolutionId}`);
      logger.info(`Editing resolution with ID: ${context.resolutionId} to ${context.resolution} (${context.width}x${context.height})`);

      const formData = new URLSearchParams();
      formData.append("resolution", context.resolution);
      formData.append("width", context.width.toString());
      formData.append("height", context.height.toString());

      // Get authentication headers
      const headers = await getAuthHeaders();
      headers['Content-Type'] = 'application/x-www-form-urlencoded';

      const response = await fetch(url.toString(), {
        method: "PUT",
        headers: headers,
        body: formData.toString(),
      });

      // Get the complete response text
      let responseText = await response.text();
      
      if (!response.ok) {
        // Decode the error message for better readability
        const decodedText = decodeErrorMessage(responseText);
        let errorMessage;
        try {
          const errorObj = JSON.parse(decodedText);
          errorMessage = errorObj.message || decodedText;
        } catch {
          errorMessage = decodedText;
        }
        
        logger.error(`Failed to edit resolution: ${errorMessage}`, { 
          status: response.status,
          url: url.toString(),
          resolutionId: context.resolutionId
        });
        throw new Error(errorMessage);
      }

      // Parse the response data
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
        logger.info(`Resolution with ID ${context.resolutionId} updated successfully`);
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
      logger.error(`editResolution: An error occurred: ${error instanceof Error ? error.message : "Unknown error"}`, { error });
      throw error;
    }
  },
});

export default editResolution; 