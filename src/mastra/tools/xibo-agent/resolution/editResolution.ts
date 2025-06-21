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
  data: resolutionSchema.optional(),
  message: z.string().optional(),
  error: z.any().optional(),
  errorData: z.any().optional(),
});

export const editResolution = createTool({
  id: "edit-resolution",
  description: "Edit an existing resolution in Xibo CMS",
  inputSchema: z.object({
    resolutionId: z.number().describe('ID of the resolution to edit'),
    resolution: z.string().describe('New resolution name'),
    width: z.number().describe('New width in pixels'),
    height: z.number().describe('New height in pixels'),
    enabled: z.number().optional().default(1).describe('Set enabled status (0 for disabled, 1 for enabled, defaults to 1)'),
  }),
  outputSchema,
  execute: async ({ context }) => {
    const logContext = { ...context };
    logger.info("Attempting to edit a resolution.", logContext);
    
    if (!config.cmsUrl) {
      logger.error("CMS URL is not configured.", logContext);
      return { success: false, message: "CMS URL is not configured." };
    }

    try {
      const url = new URL(`${config.cmsUrl}/api/resolution/${context.resolutionId}`);
      logger.debug(`Requesting to edit resolution at: ${url.toString()}`, logContext);

      const formData = new URLSearchParams();
      formData.append("resolution", context.resolution);
      formData.append("width", context.width.toString());
      formData.append("height", context.height.toString());
      formData.append("enabled", context.enabled.toString());

      const headers = await getAuthHeaders();
      headers['Content-Type'] = 'application/x-www-form-urlencoded';

      const response = await fetch(url.toString(), {
        method: "PUT",
        headers,
        body: formData.toString(),
      });

      const responseText = await response.text();
      
      if (!response.ok) {
        const errorData = decodeErrorMessage(responseText);
        logger.error("Failed to edit resolution via CMS API.", {
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
      
      const validationResult = resolutionSchema.safeParse(responseData);

      if (!validationResult.success) {
        logger.warn("API response validation failed for editResolution.", {
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

      logger.info(`Successfully edited resolution ID ${validationResult.data.resolutionId}.`, logContext);
      return { success: true, data: validationResult.data };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      logger.error("An unexpected error occurred in editResolution.", {
        ...logContext,
        error: errorMessage,
      });
      return { success: false, message: "An unexpected error occurred.", error: errorMessage };
    }
  },
});

export default editResolution; 