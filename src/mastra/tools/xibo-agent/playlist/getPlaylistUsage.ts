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

// Schema for an individual layout entry in the usage report
const layoutUsageSchema = z.object({
    layout: z.string(),
    layoutId: z.number(),
    status: z.string()
});

// The API returns an object where the `data` key contains a JSON string.
const usageReportSchema = z.object({
    data: z.string()
});

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
    data: z.array(layoutUsageSchema).optional(),
    message: z.string().optional(),
    errorData: z.any().optional()
  }),
  execute: async ({ context }) => {
    try {
      // Check for CMS URL configuration.
      if (!config.cmsUrl) {
        logger.error("getPlaylistUsage: CMS URL is not configured");
        return { success: false, message: "CMS URL is not configured" };
      }

      // Get authentication headers and construct the request URL.
      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/playlist/usage/${context.playlistId}`;
      logger.debug(`getPlaylistUsage: Request URL = ${url}`);

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
        logger.error("getPlaylistUsage: API error response", { status: response.status, error: parsedError });
        return { success: false, message: `HTTP error! status: ${response.status}`, errorData: parsedError };
      }

      const rawData = await response.json();
      // First, validate that the response is an object with a 'data' property that is a string.
      const initialValidation = usageReportSchema.parse(rawData);
      
      const usageString = initialValidation.data;

      // The 'data' field can contain either a JSON string of an array, or a plain text message.
      try {
        // Attempt to parse the string as JSON. It might be empty if there's no usage.
        if (!usageString.trim()) {
            return { success: true, data: [] };
        }
        const usageData = JSON.parse(usageString);
        // If successful, validate the array structure.
        const validatedData = z.array(layoutUsageSchema).parse(usageData);
        return { success: true, data: validatedData };
      } catch (e) {
        // If parsing fails, it's not a JSON string.
        // It could be a message like "Specified playlist has no usage".
        // In this case, we return an empty array and the message.
        logger.info(`getPlaylistUsage: 'data' field was not a valid JSON array. Content: "${usageString}"`);
        return { success: true, data: [], message: usageString };
      }
    } catch (error) {
      // Handle any Zod validation errors from the initial parsing or JSON parsing.
      if (error instanceof z.ZodError) {
        logger.error("getPlaylistUsage: Validation error", { error: error.issues });
        return { success: false, message: "Validation error occurred", errorData: error.issues };
      }
      // Handle other unexpected errors.
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
      logger.error("getPlaylistUsage: An unexpected error occurred", { error: errorMessage });
      return { success: false, message: errorMessage };
    }
  },
}); 