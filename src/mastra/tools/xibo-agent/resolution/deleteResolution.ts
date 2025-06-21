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
 * Schema for the tool's output, covering both success and failure cases.
 */
const outputSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  error: z.any().optional(),
  errorData: z.any().optional(),
});

export const deleteResolution = createTool({
  id: "delete-resolution",
  description: "Delete a resolution from Xibo CMS",
  inputSchema: z.object({
    resolutionId: z.number().describe('ID of the resolution to delete'),
  }),
  outputSchema,
  execute: async ({ context }) => {
    const logContext = { ...context };
    logger.info("Attempting to delete a resolution.", logContext);

    if (!config.cmsUrl) {
      logger.error("CMS URL is not configured.", logContext);
      return { success: false, message: "CMS URL is not configured." };
    }

    try {
      const url = new URL(`${config.cmsUrl}/api/resolution/${context.resolutionId}`);
      logger.debug(`Requesting to delete resolution at: ${url.toString()}`, logContext);

      const headers = await getAuthHeaders();

      const response = await fetch(url.toString(), {
        method: "DELETE",
        headers,
      });

      if (response.status === 204) {
        logger.info(`Successfully deleted resolution ID ${context.resolutionId}.`, logContext);
        return { success: true, message: `Resolution with ID ${context.resolutionId} deleted successfully.` };
      }

      const responseText = await response.text();
      const errorData = decodeErrorMessage(responseText);
      
      logger.error("Failed to delete resolution via CMS API.", {
        ...logContext,
        status: response.status,
        errorData,
      });
      return {
        success: false,
        message: `API request failed with status ${response.status}.`,
        errorData,
      };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      logger.error("An unexpected error occurred in deleteResolution.", {
        ...logContext,
        error: errorMessage,
      });
      return { success: false, message: "An unexpected error occurred.", error: errorMessage };
    }
  },
});

export default deleteResolution; 