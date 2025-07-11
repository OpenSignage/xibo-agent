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
 * This module provides a tool for deleting a resolution from the Xibo CMS.
 * It implements the DELETE /resolution/{id} endpoint.
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
  success: z.boolean().describe("Indicates whether the operation was successful."),
  message: z.string().optional().describe("A message providing details about the operation outcome."),
  error: z.any().optional().describe("Error details if the operation failed."),
  errorData: z.any().optional().describe("Raw error data from the API."),
});

/**
 * Tool to delete a resolution from the Xibo CMS.
 */
export const deleteResolution = createTool({
  id: "delete-resolution",
  description: "Delete a resolution from Xibo CMS",
  inputSchema: z.object({
    resolutionId: z.number().describe('ID of the resolution to delete'),
  }),
  outputSchema,
  execute: async ({ context }) => {
    logger.info({ context }, "Executing deleteResolution tool.");

    if (!config.cmsUrl) {
      const message = "CMS URL is not configured.";
      logger.error(message);
      return { success: false, message };
    }

    try {
      const url = new URL(`${config.cmsUrl}/api/resolution/${context.resolutionId}`);
      logger.debug({ url: url.toString() }, "Sending DELETE request to delete resolution.");

      const headers = await getAuthHeaders();

      const response = await fetch(url.toString(), {
        method: "DELETE",
        headers,
      });

      if (response.status === 204) {
        logger.info({ resolutionId: context.resolutionId }, "Successfully deleted resolution.");
        return { success: true, message: `Resolution with ID ${context.resolutionId} deleted successfully.` };
      }

      const responseText = await response.text();
      const errorData = decodeErrorMessage(responseText);
      const message = `API request failed with status ${response.status}.`;
      
      logger.error({ status: response.status, errorData, context }, message);
      return { success: false, message, errorData };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      logger.error({ error: errorMessage, context }, "An unexpected error occurred in deleteResolution.");
      return { success: false, message: "An unexpected error occurred.", error: errorMessage };
    }
  },
}); 