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
 * It implements the /api/font/{id} endpoint with the DELETE method.
 */
import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../index";
import { decodeErrorMessage } from "../utility/error";

/**
 * Defines the schema for a successful response.
 */
const successSchema = z.object({
  success: z.literal(true),
  message: z.string().describe("Success message indicating the font was deleted."),
});

/**
 * Defines the schema for a failed operation.
 */
const errorSchema = z.object({
  success: z.literal(false),
  message: z.string().describe("A human-readable error message."),
  error: z
    .any()
    .optional()
    .describe("Optional technical details about the error."),
});

/**
 * A tool for deleting a specific font from the Xibo CMS.
 */
export const deleteFont = createTool({
  id: "delete-font",
  description: "Deletes a specific font by its ID.",
  inputSchema: z.object({
    id: z.number().describe("The unique ID of the font to delete."),
  }),
  outputSchema: z.union([successSchema, errorSchema]),
  execute: async ({ context: input }): Promise<z.infer<typeof successSchema> | z.infer<typeof errorSchema>> => {
    if (!config.cmsUrl) {
      const errorMessage = "CMS URL is not configured.";
      logger.error(`deleteFont: ${errorMessage}`);
      return {
        success: false,
        message: errorMessage,
      };
    }

    const url = `${config.cmsUrl}/api/fonts/${input.id}/delete`;
    logger.info(`Attempting to delete font from: ${url}`);

    const response = await fetch(url, {
      method: "DELETE",
      headers: await getAuthHeaders(),
    });

    if (response.status === 204) {
      logger.info(`Font with ID ${input.fontId} deleted successfully.`);
      return {
        success: true,
        message: `Font with ID ${input.fontId} deleted successfully.`,
      };
    }
    
    const responseText = await response.text();
    const decodedText = decodeErrorMessage(responseText);
    const errorMessage = `Failed to delete font. API responded with status ${response.status}.`;
    logger.error(errorMessage, {
      status: response.status,
      response: decodedText,
    });
    return {
      success: false,
      message: `${errorMessage} Message: ${decodedText}`,
      error: {
        statusCode: response.status,
        responseBody: responseText,
      },
    };
  },
});

export default deleteFont; 