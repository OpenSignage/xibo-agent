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
 * @module set-playlist-enable-stat
 * @description This module provides a tool to enable or disable statistics collection for a playlist.
 * It implements the PUT /api/playlist/setenablestat/{playlistId} endpoint.
 */

import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../index";

/**
 * Tool to configure statistics collection for a specific playlist.
 */
export const setPlaylistEnableStat = createTool({
  id: 'set-playlist-enable-stat',
  description: 'Enables or disables statistics collection for a playlist.',
  inputSchema: z.object({
    playlistId: z.number().describe('The ID of the playlist to configure.'),
    enableStat: z.enum(['On', 'Off', 'Inherit']).describe('The desired statistics collection setting (On, Off, or Inherit).')
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
        logger.error("setPlaylistEnableStat: CMS URL is not configured");
        return { success: false, message: "CMS URL is not configured" };
      }

      // Get authentication headers and construct the target URL.
      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/playlist/setenablestat/${context.playlistId}`;
      logger.debug(`setPlaylistEnableStat: Request URL = ${url}`);

      // Prepare the request body with the 'enableStat' parameter.
      const formData = new URLSearchParams();
      formData.append('enableStat', context.enableStat);

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
        logger.info(`Statistics collection for playlist ${context.playlistId} set to '${context.enableStat}'.`);
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
        logger.error("setPlaylistEnableStat: API error response", { status: response.status, error: parsedError });
        return { success: false, message: `HTTP error! status: ${response.status}`, errorData: parsedError };
      }
      
      // Handle other successful (2xx) responses, though 204 is expected.
      const responseData = await response.json().catch(() => ({}));
      return { success: true, data: responseData };

    } catch (error) {
      // Handle Zod validation errors.
      if (error instanceof z.ZodError) {
        logger.error("setPlaylistEnableStat: Validation error", { error: error.issues });
        return { success: false, message: "Validation error occurred", errorData: error.issues };
      }
      // Handle any other unexpected errors.
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
      logger.error("setPlaylistEnableStat: An unexpected error occurred", { error: errorMessage });
      return { success: false, message: errorMessage };
    }
  },
}); 