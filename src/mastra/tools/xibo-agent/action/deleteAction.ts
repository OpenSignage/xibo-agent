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
 * @module deleteAction
 * @description Provides a tool to delete a specific action from the Xibo CMS.
 */
import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../logger";
import { decodeErrorMessage } from "../utility/error";

// Schema for a successful response (204 No Content).
const successResponseSchema = z.object({
  success: z.literal(true),
});

// Schema for a generic error response.
const errorResponseSchema = z.object({
  success: z.literal(false),
  message: z.string(),
  error: z.any().optional(),
  errorData: z.any().optional(),
});

/**
 * Schema for the tool's output, covering success and failure cases.
 */
const outputSchema = z.union([successResponseSchema, errorResponseSchema]);


/**
 * Tool for deleting a specific action from the Xibo CMS.
 */
export const deleteAction = createTool({
  id: "delete-action",
  description: "Deletes a specific action by its ID from the Xibo CMS.",
  inputSchema: z.object({
    actionId: z.number().describe("The unique identifier of the action to be deleted."),
  }),
  outputSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      const message = "CMS URL is not configured.";
      logger.error(message);
      return { success: false as const, message };
    }

    const url = new URL(`${config.cmsUrl}/api/action/${context.actionId}`);
    logger.info({ url: url.toString() }, `Attempting to delete action ID: ${context.actionId}`);

    try {
      const response = await fetch(url.toString(), {
        method: "DELETE",
        headers: await getAuthHeaders(),
      });

      if (response.status === 204) {
        logger.info(`Action with ID ${context.actionId} deleted successfully.`);
        return { success: true as const };
      }

      // Handle cases where the response is not 204, but not necessarily an error object
      let responseData;
      try {
        responseData = await response.json();
      } catch (e) {
        responseData = await response.text();
      }

      const decodedError = decodeErrorMessage(responseData);
      const message = `Failed to delete action. API responded with status ${response.status}.`;
      logger.error({ status: response.status, response: decodedError }, message);
      return { success: false as const, message, errorData: decodedError };
      
    } catch (error) {
      const message = "An unexpected error occurred while deleting the action.";
      logger.error({ error }, message);
      return {
        success: false as const,
        message,
        error: error instanceof Error ? { name: error.name, message: error.message } : error,
      };
    }
  },
}); 