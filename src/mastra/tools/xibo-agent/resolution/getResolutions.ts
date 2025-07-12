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
 * @module
 * This module provides a tool for retrieving resolution information from the Xibo CMS.
 * It implements the GET /resolution endpoint with filtering options.
 */

import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from '../../../index';
import { decodeErrorMessage } from "../utility/error";
import { resolutionSchema } from "./schemas";

/**
 * Schema for the tool's output, covering both success and failure cases.
 */
const outputSchema = z.object({
  success: z.boolean().describe("Indicates whether the operation was successful."),
  data: z.array(resolutionSchema).optional().describe("An array of resolution objects on success."),
  message: z.string().optional().describe("A message providing details about the operation outcome."),
  error: z.any().optional().describe("Error details if the operation failed."),
  errorData: z.any().optional().describe("Raw error data from the API."),
});

/**
 * Tool to retrieve resolutions from the Xibo CMS, with optional filters.
 */
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
    logger.info({ context }, "Executing getResolutions tool.");

    if (!config.cmsUrl) {
      const message = "CMS URL is not configured.";
      logger.error(message);
      return { success: false, message };
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
      
      logger.debug({ url: url.toString() }, "Sending GET request to retrieve resolutions.");

      const headers = await getAuthHeaders();
      const response = await fetch(url.toString(), {
        method: "GET",
        headers,
      });

      const responseText = await response.text();
      
      if (!response.ok) {
        const errorData = decodeErrorMessage(responseText);
        const message = `API request failed with status ${response.status}.`;
        logger.error({ status: response.status, errorData, context }, message);
        return { success: false, message, errorData };
      }
      
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        const message = "Invalid JSON response from server.";
        logger.error({ responseText, context }, message);
        return { success: false, message, errorData: responseText, };
      }
      
      const validationResult = z.array(resolutionSchema).safeParse(responseData);

      if (!validationResult.success) {
        const message = "Response validation failed.";
        logger.warn({ error: validationResult.error.flatten(), responseData, context }, message);
        return { success: false, message, error: validationResult.error.flatten(), errorData: responseData, };
      }

      logger.info({ count: validationResult.data.length }, "Successfully retrieved resolutions.");
      return { success: true, data: validationResult.data };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      logger.error({ error: errorMessage, context }, "An unexpected error occurred in getResolutions.");
      return { success: false, message: "An unexpected error occurred.", error: errorMessage };
    }
  },
}); 