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
 * Xibo CMS Resolution Creation Tool
 * 
 * This module provides functionality to create new resolutions in the Xibo CMS system.
 * It implements the resolution creation API endpoint and handles the necessary data
 * for creating resolutions with appropriate dimensions.
 */

import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from '../../../index';

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
 * Schema for API response after creating a resolution
 */
const apiResponseSchema = z.object({
  success: z.boolean(),
  data: resolutionSchema,
});

export const addResolution = createTool({
  id: "add-resolution",
  description: "Add a new resolution to Xibo CMS",
  inputSchema: z.object({
    resolution: z.string().describe('Resolution name'),
    width: z.number().describe('Width in pixels'),
    height: z.number().describe('Height in pixels'),
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not configured");
    }

    try {
      const url = new URL(`${config.cmsUrl}/api/resolution`);
      logger.info(`Creating resolution: ${context.resolution} (${context.width}x${context.height})`);

      const formData = new FormData();
      formData.append("resolution", context.resolution);
      formData.append("width", context.width.toString());
      formData.append("height", context.height.toString());

      // Get authentication headers
      const headers = await getAuthHeaders();

      const response = await fetch(url.toString(), {
        method: "POST",
        headers: headers,
        body: formData,
      });

      // Get the complete response text
      const responseText = await response.text();
      
      if (!response.ok) {
        logger.error(`Failed to create resolution: ${responseText}`, { 
          status: response.status,
          url: url.toString(),
          resolution: context.resolution
        });
        throw new Error(`HTTP error! status: ${response.status}, message: ${responseText}`);
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
        logger.info(`Resolution created successfully: ${context.resolution}`);
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
      logger.error(`addResolution: An error occurred: ${error instanceof Error ? error.message : "Unknown error"}`, { error });
      throw error;
    }
  },
});

export default addResolution; 