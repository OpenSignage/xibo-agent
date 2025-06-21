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
 * @module get-playlist-usage
 * @description This module provides a tool to get the usage report for a playlist.
 * It implements the GET /api/playlist/usage/{playlistId} endpoint.
 */

import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../index";

// Schema for the playlist usage report response
const usageReportSchema = z.array(z.object({
    layout: z.string(),
    layoutId: z.number(),
    status: z.string()
}));

/**
 * Tool to retrieve a usage report for a specific playlist, showing which layouts it is used in.
 */
export const getPlaylistUsage = createTool({
  id: 'get-playlist-usage',
  description: 'Gets the usage report for a playlist.',
  inputSchema: z.object({
    playlistId: z.number().describe('The ID of the playlist to get the usage report for.')
  }),
  outputSchema: z.object({
    success: z.boolean(),
    data: usageReportSchema.optional(),
    message: z.string().optional(),
    errorData: z.any().optional()
  }),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        logger.error("getPlaylistUsage: CMS URL is not configured");
        return { success: false, message: "CMS URL is not configured" };
      }

      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/playlist/usage/${context.playlistId}`;
      logger.debug(`getPlaylistUsage: Request URL = ${url}`);

      const response = await fetch(url, { method: 'GET', headers });

      if (!response.ok) {
        const responseText = await response.text();
        let parsedError: any;
        try {
            parsedError = JSON.parse(responseText);
        } catch (e) {
            parsedError = responseText;
        }
        logger.error("getPlaylistUsage: API error response", { status: response.status, error: parsedError });
        return { success: false, message: `HTTP error! status: ${response.status}`, errorData: parsedError };
      }

      const data = await response.json();
      const validatedData = usageReportSchema.parse(data);
      
      return { success: true, data: validatedData };
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.error("getPlaylistUsage: Validation error", { error: error.issues });
        return { success: false, message: "Validation error occurred", errorData: error.issues };
      }
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
      logger.error("getPlaylistUsage: An unexpected error occurred", { error: errorMessage });
      return { success: false, message: errorMessage };
    }
  },
}); 