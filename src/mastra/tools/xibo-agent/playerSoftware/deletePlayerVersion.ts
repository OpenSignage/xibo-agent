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
 * @module deletePlayerVersion
 * @description This module provides functionality to delete a specific player software version
 * from the Xibo CMS. It implements the DELETE /api/playersoftware/{versionId} endpoint.
 */
import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../index";

// Schema for the response, which can be a success or error
const responseSchema = z.union([
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

export const deletePlayerVersion = createTool({
  id: "delete-player-version",
  description: "Delete a player software version.",
  inputSchema: z.object({
    versionId: z.number().describe("The ID of the player software version to delete."),
  }),
  outputSchema: responseSchema,
  execute: async ({ context }): Promise<z.infer<typeof responseSchema>> => {
    if (!config.cmsUrl) {
      const message = "CMS URL is not configured";
      logger.error(`deletePlayerVersion: ${message}`);
      return { success: false, message };
    }

    const url = `${config.cmsUrl}/api/playersoftware/${context.versionId}`;
    
    try {
      logger.debug(`deletePlayerVersion: Requesting URL: ${url}`);
      const response = await fetch(url, {
        method: "DELETE",
        headers: await getAuthHeaders(),
      });

      if (response.status === 204) {
        const successMessage = `Player version ${context.versionId} deleted successfully`;
        logger.info(successMessage);
        return { success: true, message: successMessage };
      }

      const responseData = await response.json().catch(() => response.text());
      const message = `HTTP error! status: ${response.status}`;
      logger.error(`deletePlayerVersion: ${message}`, { errorData: responseData });
      return { success: false, message, errorData: responseData };

    } catch (error) {
      const message = error instanceof Error ? error.message : "An unknown error occurred";
      logger.error(`deletePlayerVersion: ${message}`, { error });
      return { success: false, message, error };
    }
  },
}); 