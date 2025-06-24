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
 * @module deleteTag
 * @description Provides a tool to delete a tag from the Xibo CMS.
 * It implements the tag deletion API endpoint and handles the necessary validation.
 */
import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../index";
import { decodeErrorMessage } from "../utility/error";

// Defines the schema for a successful response
const successSchema = z.object({
  success: z.literal(true),
  message: z.string().describe("A confirmation message."),
});

// Defines the schema for an error response
const errorSchema = z.object({
  success: z.literal(false),
  message: z.string().describe("A simple, readable error message."),
  error: z.any().optional().describe("Optional detailed error information."),
  errorData: z.any().optional().describe("Raw response data from CMS."),
});

/**
 * A tool for deleting an existing tag from the Xibo CMS by its ID.
 */
export const deleteTag = createTool({
  id: "delete-tag",
  description: "Delete a tag from Xibo CMS by its ID.",
  inputSchema: z.object({
    tagId: z.number().describe("The ID of the tag to delete."),
  }),
  outputSchema: z.union([successSchema, errorSchema]),
  execute: async ({
    context,
  }): Promise<z.infer<typeof successSchema> | z.infer<typeof errorSchema>> => {
    // Ensure the CMS URL is configured before proceeding.
    if (!config.cmsUrl) {
      const errorMessage = "CMS URL is not configured.";
      logger.error(errorMessage);
      return {
        success: false,
        message: errorMessage,
      };
    }

    // Construct the API endpoint URL for the specific tag.
    const url = new URL(`${config.cmsUrl}/api/tag/${context.tagId}`);

    logger.info(`Deleting tag ${context.tagId} at: ${url.toString()}`);

    // Perform the DELETE request to the Xibo CMS API.
    const response = await fetch(url.toString(), {
      method: "DELETE",
      headers: await getAuthHeaders(),
    });

    // Log the response status to trace the execution flow.
    logger.info(`Received API response with status: ${response.status}`);

    // A successful deletion returns a 204 No Content status.
    if (response.status === 204) {
      logger.info(`Successfully deleted tag ${context.tagId}.`);
      return {
        success: true,
        message: `Tag with ID ${context.tagId} deleted successfully.`,
      };
    }

    // Handle the specific case of 404 Not Found as a distinct error.
    if (response.status === 404) {
      const message = `Tag with ID ${context.tagId} not found.`;
      logger.error(message, { status: 404 });
      return {
        success: false,
        message: message,
        error: { status: 404 },
      };
    }

    // For any other non-successful status, return a detailed error object.
    const responseText = await response.text();
    const decodedText = decodeErrorMessage(responseText);
    const message = `Failed to delete tag. API responded with an unexpected status ${response.status}.`;
    logger.error(message, {
      status: response.status,
      response: decodedText,
    });
    return {
      success: false,
      message: message,
      error: { status: response.status },
      errorData: decodedText,
    };
  },
});

export default deleteTag; 