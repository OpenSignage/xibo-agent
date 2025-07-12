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
 * @module DeleteDisplayProfile
 * @description This module provides a tool to delete a display profile from the Xibo CMS.
 * It handles the API request for deleting a profile and processes the response.
 */
import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../index";
import { decodeErrorMessage } from "../utility/error";

/**
 * Defines the output schema for the deleteDisplayProfile tool.
 * This schema represents a successful deletion with a message or a failure
 * with an error message.
 */
const outputSchema = z.union([
  z.object({
    success: z.literal(true),
    message: z.string(),
  }),
  z.object({
    success: z.literal(false),
    message: z.string(),
    error: z.any().optional(),
    errorData: z.any().optional(),
  }),
]);

/**
 * Tool for deleting a display profile.
 * This tool sends a DELETE request to the Xibo CMS API to remove a display profile
 * identified by its ID.
 */
export const deleteDisplayProfile = createTool({
  id: "delete-display-profile",
  description: "Delete an existing display profile.",
  inputSchema: z.object({
    displayProfileId: z.number().describe("The ID of the display profile to delete."),
  }),
  outputSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      const message = "CMS URL is not configured.";
      logger.error(message);
      return { success: false as const, message };
    }

    const url = new URL(`${config.cmsUrl}/api/displayprofile/${context.displayProfileId}`);
    logger.info({ displayProfileId: context.displayProfileId }, 'Attempting to delete display profile.');

    try {
      const response = await fetch(url.toString(), {
        method: "DELETE",
        headers: await getAuthHeaders(),
      });

      if (response.status === 204) {
        const message = `Successfully deleted display profile ID: ${context.displayProfileId}`;
        logger.info({ displayProfileId: context.displayProfileId }, message);
        return { success: true as const, message };
      }

      // Try to get response data, but handle cases where it might be empty
      let responseData;
      try {
        responseData = await response.json();
      } catch (e) {
        responseData = null; // No JSON body
      }

      if (!response.ok) {
        const decodedError = decodeErrorMessage(responseData);
        const message = `Failed to delete display profile. API responded with status ${response.status}.`;
        logger.error({ response: decodedError }, message);
        return { success: false as const, message, errorData: decodedError };
      }
      
      const message = "The display profile was deleted, but the API returned an unexpected response.";
      logger.warn({ responseData }, message);
      return { success: true as const, message };

    } catch (error) {
      const message = "An unexpected error occurred while deleting the display profile.";
      logger.error({ error }, message);
      return {
        success: false as const,
        message,
        error: error instanceof Error ? { name: error.name, message: error.message } : error,
      };
    }
  },
}); 