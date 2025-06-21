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
 * Schema for a single resolution object.
 */
const resolutionSchema = z.object({
  resolutionId: z.number(),
  resolution: z.string(),
  width: z.number(),
  height: z.number(),
  designerWidth: z.number(),
  designerHeight: z.number(),
  version: z.number(),
  enabled: z.number(),
  userId: z.number(),
}).passthrough();

/**
 * Schema for the tool's output, covering both success and failure cases.
 */
const outputSchema = z.object({
  success: z.boolean(),
  data: z.array(resolutionSchema).optional(),
  message: z.string().optional(),
  error: z.any().optional(),
  errorData: z.any().optional(),
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
  outputSchema,
  execute: async ({ context }) => {
    const logContext = { ...context };
    logger.info("Attempting to retrieve resolutions.", logContext);

    if (!config.cmsUrl) {
      logger.error("CMS URL is not configured.", logContext);
      return { success: false, message: "CMS URL is not configured." };
    }

    try {
      const params = new URLSearchParams();
      Object.entries(context).forEach(([key, value]) => {
        if (value !== undefined) {
          params.append(key, String(value));
        }
      });
      
      const url = new URL(`${config.cmsUrl}/api/resolution`);
      url.search = params.toString();
      
      logger.debug(`Requesting resolutions from: ${url.toString()}`, logContext);

      const headers = await getAuthHeaders();
      const response = await fetch(url.toString(), {
        method: "GET",
        headers,
      });

      const responseText = await response.text();
      
      if (!response.ok) {
        const errorData = decodeErrorMessage(responseText);
        logger.error("Failed to retrieve resolutions from CMS API.", {
          ...logContext,
          status: response.status,
          errorData,
        });
        return {
          success: false,
          message: `API request failed with status ${response.status}.`,
          errorData,
        };
      }
      
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        logger.error("Failed to parse JSON response from CMS API.", {
          ...logContext,
          responseText,
        });
        return {
          success: false,
          message: "Invalid JSON response from server.",
          errorData: responseText,
        };
      }
      
      const validationResult = z.array(resolutionSchema).safeParse(responseData);

      if (!validationResult.success) {
        logger.warn("API response validation failed for getResolutions.", {
          ...logContext,
          error: validationResult.error.flatten(),
          responseData,
        });
        return {
          success: false,
          message: "Response validation failed.",
          error: validationResult.error.flatten(),
          errorData: responseData,
        };
      }

      logger.info(`Successfully retrieved ${validationResult.data.length} resolutions.`, logContext);
      return { success: true, data: validationResult.data };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      logger.error("An unexpected error occurred in getResolutions.", {
        ...logContext,
        error: errorMessage,
      });
      return { success: false, message: "An unexpected error occurred.", error: errorMessage };
    }
  },
});

export default getResolutions; 