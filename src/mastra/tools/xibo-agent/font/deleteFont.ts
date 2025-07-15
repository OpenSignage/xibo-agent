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
 * @module deleteFont
 * @description Provides a tool to delete a specific font from the Xibo CMS.
 * It implements the DELETE /api/fonts/{id} endpoint.
 */
import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../index";
import { decodeErrorMessage, processError } from "../utility/error";

// Schema for a successful deletion response.
const successResponseSchema = z.object({
  success: z.literal(true),
  message: z.string().describe("Success message indicating the font was deleted."),
});

// Schema for a failed operation.
const errorResponseSchema = z.object({
  success: z.literal(false),
  message: z.string().describe("A human-readable error message."),
  error: z.any().optional().describe("Optional technical details about the error."),
  errorData: z.any().optional(),
});

/**
 * Union schema for tool output, covering both success and error cases.
 */
const outputSchema = z.union([successResponseSchema, errorResponseSchema]);

/**
 * A tool for deleting a specific font from the Xibo CMS by its ID.
 */
export const deleteFont = createTool({
  id: "delete-font",
  description: "Deletes a specific font by its ID.",
  inputSchema: z.object({
    id: z.number().describe("The unique ID of the font to delete."),
  }),
  outputSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      const message = "CMS URL is not configured.";
      logger.error(message);
      return { success: false, message };
    }

    const url = new URL(`${config.cmsUrl}/api/fonts/${context.id}/delete`);
    
    try {
      logger.info({ url: url.toString() }, `Attempting to delete font ID: ${context.id}`);

      const response = await fetch(url.toString(), {
        method: "DELETE",
        headers: await getAuthHeaders(),
      });

      if (response.ok) {
        const message = `Font with ID ${context.id} deleted successfully.`;
        logger.info({ fontId: context.id }, message);
        return { success: true, message };
      }
      
      const responseData = await response.json().catch(() => response.text());
      const decodedError = decodeErrorMessage(responseData);
      const message = `Failed to delete font. API responded with status ${response.status}.`;
      logger.error({ status: response.status, response: decodedError }, message);
      return { success: false, message, errorData: decodedError };

    } catch (error) {
      const message = "An unexpected error occurred while deleting the font.";
      const processedError = processError(error);
      logger.error({ error: processedError }, message);
      return { success: false, message, error: processedError };
    }
  },
}); 