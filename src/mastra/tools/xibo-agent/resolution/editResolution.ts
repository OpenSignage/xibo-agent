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
 * This module provides a tool for editing an existing resolution in the Xibo CMS.
 * It implements the PUT /resolution/{id} endpoint.
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
  data: resolutionSchema.optional().describe("The edited resolution data on success."),
  message: z.string().optional().describe("A message providing details about the operation outcome."),
  error: z.any().optional().describe("Error details if the operation failed."),
  errorData: z.any().optional().describe("Raw error data from the API."),
});

/**
 * Tool to edit an existing resolution in the Xibo CMS.
 */
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
    logger.info({ context }, "Executing editResolution tool.");
    
    if (!config.cmsUrl) {
      const message = "CMS URL is not configured.";
      logger.error(message);
      return { success: false, message };
    }

    try {
      const url = new URL(`${config.cmsUrl}/api/resolution/${context.resolutionId}`);
      
      const formData = new URLSearchParams();
      formData.append("resolution", context.resolution);
      formData.append("width", context.width.toString());
      formData.append("height", context.height.toString());
      formData.append("enabled", context.enabled.toString());
      
      logger.debug({ url: url.toString(), body: formData.toString() }, "Sending PUT request to edit resolution.");

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
        return { success: false, message, errorData: responseText };
      }
      
      const validationResult = resolutionSchema.safeParse(responseData);

      if (!validationResult.success) {
        const message = "Response validation failed.";
        logger.warn({ error: validationResult.error.flatten(), responseData, context }, message);
        return { success: false, message, error: validationResult.error.flatten(), errorData: responseData };
      }

      logger.info({ resolutionId: validationResult.data.resolutionId }, "Successfully edited resolution.");
      return { success: true, data: validationResult.data };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      logger.error({ error: errorMessage, context }, "An unexpected error occurred in editResolution.");
      return { success: false, message: "An unexpected error occurred.", error: errorMessage };
    }
  },
}); 