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
 * @module deleteSyncGroup
 * @description This module provides functionality to delete a sync group.
 * It implements the DELETE /api/syncgroup/{id} endpoint.
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

/**
 * Tool to delete a sync group.
 * This tool deletes an existing synchronization group from the Xibo CMS.
 */
export const deleteSyncGroup = createTool({
  id: "delete-sync-group",
  description: "Delete a sync group",
  inputSchema: z.object({
    syncGroupId: z.number().describe("The ID of the sync group to delete."),
  }),
  outputSchema: responseSchema,
  execute: async ({ context }): Promise<z.infer<typeof responseSchema>> => {
    if (!config.cmsUrl) {
      const message = "CMS URL is not configured";
      logger.error(`deleteSyncGroup: ${message}`);
      return { success: false, message };
    }

    const url = `${config.cmsUrl}/api/syncgroup/${context.syncGroupId}/delete`;
    
    try {
      logger.debug(`deleteSyncGroup: Requesting URL: ${url}`);
      const response = await fetch(url, {
        method: "DELETE",
        headers: await getAuthHeaders(),
      });

      if (!response.ok) {
        // Try to parse error response, but fallback to text if it fails
        const responseData = await response.json().catch(() => response.text());
        const message = `HTTP error! status: ${response.status}`;
        logger.error(`deleteSyncGroup: ${message}`, { errorData: responseData });
        return { success: false, message, errorData: responseData };
      }

      // A 204 No Content response is a success case for DELETE
      const successMessage = `Sync group ${context.syncGroupId} deleted successfully`;
      logger.info(successMessage);
      return { success: true, message: successMessage };

    } catch (error) {
      const message = error instanceof Error ? error.message : "An unknown error occurred";
      logger.error(`deleteSyncGroup: ${message}`, { error });
      return { success: false, message, error };
    }
  },
});

export default deleteSyncGroup; 