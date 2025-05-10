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
 * Xibo CMS Resolution Retrieval Tool
 * 
 * This module provides functionality to retrieve resolution information from the Xibo CMS system.
 * It implements the resolution search API endpoint and handles the necessary validation
 * and data transformation for retrieving resolutions with various filtering options.
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
 * Schema for API response after retrieving resolutions
 */
const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(resolutionSchema),
});

export const getResolutions = createTool({
  id: "get-resolutions",
  description: "Retrieve resolutions from Xibo CMS",
  inputSchema: z.object({
    resolutionId: z.number().optional().describe('Filter by specific resolution ID'),
    resolution: z.string().optional().describe('Filter by exact resolution name'),
    partialResolution: z.string().optional().describe('Filter by partial resolution name'),
    enabled: z.number().optional().describe('Filter by enabled status (1 for enabled, 0 for disabled)'),
    width: z.number().optional().describe('Filter by exact width'),
    height: z.number().optional().describe('Filter by exact height'),
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not configured");
    }

    try {
      const url = new URL(`${config.cmsUrl}/api/resolution`);
      if (context.resolutionId) url.searchParams.append("resolutionId", context.resolutionId.toString());
      if (context.resolution) url.searchParams.append("resolution", context.resolution);
      if (context.partialResolution) url.searchParams.append("partialResolution", context.partialResolution);
      if (context.enabled !== undefined) url.searchParams.append("enabled", context.enabled.toString());
      if (context.width) url.searchParams.append("width", context.width.toString());
      if (context.height) url.searchParams.append("height", context.height.toString());

      logger.info(`Retrieving resolutions with filters: ${JSON.stringify(context)}`);

      // Get authentication headers
      const headers = await getAuthHeaders();

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: headers,
      });

      const text = await response.text();
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
        logger.info(`Retrieved ${data.length} resolutions successfully`);
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
      logger.error(`getResolutions: An error occurred: ${error instanceof Error ? error.message : "Unknown error"}`, { error });
      throw error;
    }
  },
});

export default getResolutions; 