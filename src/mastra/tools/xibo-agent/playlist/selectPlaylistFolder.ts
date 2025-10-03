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
 * @module select-playlist-folder
 * @description This module provides a tool to assign a playlist to a specific folder.
 * It implements the PUT /api/playlist/{playlistId}/selectfolder endpoint.
 */

import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../logger";

/**
 * Tool to assign a playlist to a folder in the Xibo CMS.
 */
export const selectPlaylistFolder = createTool({
  id: 'select-playlist-folder',
  description: 'Assigns a playlist to a folder.',
  inputSchema: z.object({
    playlistId: z.number().describe('The ID of the playlist to assign to a folder.'),
    folderId: z.number().describe('The ID of the folder to assign the playlist to.')
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
        logger.error("selectPlaylistFolder: CMS URL is not configured");
        return { success: false, message: "CMS URL is not configured" };
      }

      // Get authentication headers and construct the target URL.
      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/playlist/${context.playlistId}/selectfolder`;
      logger.debug(`selectPlaylistFolder: Request URL = ${url}`);

      // Prepare the request body with the folderId.
      const formData = new URLSearchParams();
      formData.append('folderId', context.folderId.toString());

      // Make the PUT request to the Xibo API.
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
            ...headers,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData
      });
      
      // A 204 No Content response indicates a successful operation.
      if (response.status === 204) {
        logger.info(`Playlist ${context.playlistId} successfully assigned to folder ${context.folderId}.`);
        return { success: true, data: {} };
      }

      // Handle any other non-2xx responses.
      if (!response.ok) {
        const responseText = await response.text();
        let parsedError: any;
        try {
            parsedError = JSON.parse(responseText);
        } catch (e) {
            parsedError = responseText;
        }
        logger.error({ status: response.status, error: parsedError }, "selectPlaylistFolder: API error response");
        return { success: false, message: `HTTP error! status: ${response.status}`, errorData: parsedError };
      }
      
      // Handle cases where API might return 200 OK with a body, though 204 is expected.
      const responseData = await response.json().catch(() => ({}));
      return { success: true, data: responseData };

    } catch (error) {
      // Handle Zod validation errors.
      if (error instanceof z.ZodError) {
        logger.error({ error: error.issues }, "selectPlaylistFolder: Validation error");
        return { success: false, message: "Validation error occurred", errorData: error.issues };
      }
      // Handle any other unexpected errors.
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
      logger.error({ error: errorMessage }, "selectPlaylistFolder: An unexpected error occurred");
      return { success: false, message: errorMessage };
    }
  },
}); 