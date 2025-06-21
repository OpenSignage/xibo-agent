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
 * @module convert-playlist
 * @description This module provides a tool to convert an inline playlist to a global one.
 * It implements the POST /api/playlist/{playlistId}/convert endpoint.
 */

import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../index";

// A simple schema for the successful conversion response.
const conversionResponseSchema = z.object({
    playlistId: z.number(),
    name: z.string(),
    // Add other relevant fields if the API returns more details
});

/**
 * Tool to convert an inline playlist (from a layout's region) into a global playlist.
 */
export const convertPlaylist = createTool({
  id: 'convert-playlist',
  description: 'Converts an inline playlist to a global playlist.',
  inputSchema: z.object({
    playlistId: z.number().describe('The ID of the inline playlist to convert.'),
    name: z.string().optional().describe('An optional new name for the global playlist.')
  }),
  outputSchema: z.object({
    success: z.boolean(),
    data: conversionResponseSchema.optional(),
    message: z.string().optional(),
    errorData: z.any().optional()
  }),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        logger.error("convertPlaylist: CMS URL is not configured");
        return { success: false, message: "CMS URL is not configured" };
      }

      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/playlist/${context.playlistId}/convert`;
      logger.debug(`convertPlaylist: Request URL = ${url}`);

      const formData = new URLSearchParams();
      if (context.name) formData.append('name', context.name);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
            ...headers,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData
      });

      if (!response.ok) {
        const responseText = await response.text();
        let parsedError: any;
        try {
            parsedError = JSON.parse(responseText);
        } catch (e) {
            parsedError = responseText;
        }
        logger.error("convertPlaylist: API error response", { status: response.status, error: parsedError });
        return { success: false, message: `HTTP error! status: ${response.status}`, errorData: parsedError };
      }
      
      const data = await response.json();
      const validatedData = conversionResponseSchema.parse(data);

      return { success: true, data: validatedData };
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.error("convertPlaylist: Validation error", { error: error.issues });
        return { success: false, message: "Validation error occurred", errorData: error.issues };
      }
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
      logger.error("convertPlaylist: An unexpected error occurred", { error: errorMessage });
      return { success: false, message: errorMessage };
    }
  },
}); 