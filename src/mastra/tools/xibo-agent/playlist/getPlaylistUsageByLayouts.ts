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
import { logger } from "../../../logger";

// Schema for the array of layouts returned directly by the API when usage exists.
const apiResponseSchema = z.array(z.object({
    layoutId: z.number(),
    layout: z.string(),
    regions: z.array(z.object({
        regionId: z.number(),
        region: z.string()
    }))
}));

// Infer the type from the schema for explicit typing.
type LayoutUsageArray = z.infer<typeof apiResponseSchema>;

// Schema for the 'data' object in the tool's final output. This standardizes the output format.
const layoutUsageReportSchema = z.object({
    layouts: apiResponseSchema.optional().default([])
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

      // Get authentication headers and construct the request URL.
      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/playlist/usage/layouts/${context.playlistId}`;
      logger.debug(`getPlaylistUsageByLayouts: Request URL = ${url}`);

      // Make the GET request to the Xibo API.
      const response = await fetch(url, { method: 'GET', headers });

      // Handle non-2xx responses from the API.
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
      
      // The API has inconsistent return types for this endpoint.
      // - It returns an array of layouts if the playlist is in use.
      // - It returns an empty object {} if the playlist is not in use.
      // We handle this by checking the type of the response before validation.
      let layoutsArray: LayoutUsageArray = [];
      if (Array.isArray(data)) {
        // If the response is an array, validate it against the array schema.
        layoutsArray = apiResponseSchema.parse(data);
      } else if (typeof data === 'object' && data !== null && Object.keys(data).length === 0) {
        // If it's an empty object, it signifies no usage. We treat it as an empty array.
        logger.info("getPlaylistUsageByLayouts: Received an empty object, assuming no usage.", { data });
      } else {
        // Handle unexpected response types.
        logger.warn("getPlaylistUsageByLayouts: Unexpected response type, assuming no usage.", { response: data });
      }
      
      // We then wrap the resulting array in an object to match the tool's standardized output schema.
      return { success: true, data: { layouts: layoutsArray } };
    } catch (error) {
      // Handle any Zod validation errors.
      if (error instanceof z.ZodError) {
        logger.error("getPlaylistUsageByLayouts: Validation error", { error: error.issues });
        return { success: false, message: "Validation error occurred", errorData: error.issues };
      }
      // Handle other unexpected errors.
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
      logger.error("getPlaylistUsageByLayouts: An unexpected error occurred", { error: errorMessage });
      return { success: false, message: errorMessage };
    }
  },
}); 