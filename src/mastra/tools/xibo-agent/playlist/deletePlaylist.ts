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
 * @module delete-playlist
 * @description This module provides a tool to delete a playlist.
 * It implements the DELETE /api/playlist/{playlistId} endpoint.
 */

import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../logger";

/**
 * Tool to delete a specific playlist from the Xibo CMS.
 */
export const deletePlaylist = createTool({
  id: 'delete-playlist',
  description: 'Deletes a playlist.',
  inputSchema: z.object({
    playlistId: z.number().describe('The ID of the playlist to delete.')
  }),
  outputSchema: z.object({
    success: z.boolean(),
    data: z.object({}).optional(),
    message: z.string().optional(),
    errorData: z.any().optional()
  }),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        logger.error("deletePlaylist: CMS URL is not configured");
        return { success: false, message: "CMS URL is not configured" };
      }

      // Get authentication headers and construct the target URL.
      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/playlist/${context.playlistId}`;
      logger.debug(`deletePlaylist: Request URL = ${url}`);

      // Make the DELETE request to the Xibo API.
      const response = await fetch(url, {
        method: 'DELETE',
        headers
      });

      // A 204 No Content response indicates successful deletion.
      if (response.status === 204) {
        logger.info(`Playlist ${context.playlistId} deleted successfully.`);
        return { success: true, data: {} };
      }

      // Handle any other non-successful responses.
      if (!response.ok) {
        const responseText = await response.text();
        let parsedError: any;
        try {
            parsedError = JSON.parse(responseText);
        } catch (e) {
            parsedError = responseText;
        }
        logger.error("deletePlaylist: API error response", { status: response.status, error: parsedError });
        return { success: false, message: `HTTP error! status: ${response.status}`, errorData: parsedError };
      }

      // This case is unlikely for a DELETE request but handles other 2xx success codes.
      // Should not happen for a 204 response, but handle other 2xx responses if they occur
      return { success: true, message: `Playlist deleted with status: ${response.status}` };
    } catch (error) {
      // Catch and handle any unexpected errors during the execution.
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
      logger.error("deletePlaylist: An unexpected error occurred", { error: errorMessage });
      return { success: false, message: errorMessage };
    }
  },
}); 