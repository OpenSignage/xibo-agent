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
 * @module get-playlist-usage-by-layouts
 * @description This module provides a tool to get a detailed usage report for a playlist, broken down by layout.
 * It implements the GET /api/playlist/usage/layouts/{playlistId} endpoint.
 */

import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../index";

// Schema for the detailed layout usage report
const layoutUsageReportSchema = z.object({
    layouts: z.array(z.object({
        layoutId: z.number(),
        layout: z.string(),
        regions: z.array(z.object({
            regionId: z.number(),
            region: z.string()
        }))
    }))
});

/**
 * Tool to retrieve a detailed usage report for a playlist, showing which layouts and regions it is used in.
 */
export const getPlaylistUsageByLayouts = createTool({
  id: 'get-playlist-usage-by-layouts',
  description: 'Gets a detailed, by-layout usage report for a playlist.',
  inputSchema: z.object({
    playlistId: z.number().describe('The ID of the playlist to get the usage report for.')
  }),
  outputSchema: z.object({
    success: z.boolean(),
    data: layoutUsageReportSchema.optional(),
    message: z.string().optional(),
    errorData: z.any().optional()
  }),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        logger.error("getPlaylistUsageByLayouts: CMS URL is not configured");
        return { success: false, message: "CMS URL is not configured" };
      }

      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/playlist/usage/layouts/${context.playlistId}`;
      logger.debug(`getPlaylistUsageByLayouts: Request URL = ${url}`);

      const response = await fetch(url, { method: 'GET', headers });

      if (!response.ok) {
        const responseText = await response.text();
        let parsedError: any;
        try {
            parsedError = JSON.parse(responseText);
        } catch (e) {
            parsedError = responseText;
        }
        logger.error("getPlaylistUsageByLayouts: API error response", { status: response.status, error: parsedError });
        return { success: false, message: `HTTP error! status: ${response.status}`, errorData: parsedError };
      }

      const data = await response.json();
      const validatedData = layoutUsageReportSchema.parse(data);
      
      return { success: true, data: validatedData };
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.error("getPlaylistUsageByLayouts: Validation error", { error: error.issues });
        return { success: false, message: "Validation error occurred", errorData: error.issues };
      }
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
      logger.error("getPlaylistUsageByLayouts: An unexpected error occurred", { error: errorMessage });
      return { success: false, message: errorMessage };
    }
  },
}); 