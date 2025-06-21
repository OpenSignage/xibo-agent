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
 * @module copy-playlist
 * @description This module provides a tool to copy an existing playlist.
 * It implements the POST /api/playlist/copy/{playlistId} endpoint.
 */

import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../index";

// Schema for the successful response after copying a playlist.
const copyResponseSchema = z.object({
    // The API returns the new playlist object, so we define its basic structure.
    playlistId: z.number(),
    name: z.string(),
    duration: z.number(),
    widgets: z.array(z.any()), // Can be more specific if the widget structure is known
});


/**
 * Tool to create a copy of an existing playlist.
 */
export const copyPlaylist = createTool({
  id: 'copy-playlist',
  description: 'Copies an existing playlist.',
  inputSchema: z.object({
    playlistId: z.number().describe('The ID of the playlist to copy.'),
    name: z.string().describe('The name for the new copied playlist.'),
    copyMediaFiles: z.number().min(0).max(1).describe('Whether to copy the associated media files (1 for yes, 0 for no).')
  }),
  outputSchema: z.object({
    success: z.boolean(),
    data: copyResponseSchema.optional(),
    message: z.string().optional(),
    errorData: z.any().optional()
  }),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        logger.error("copyPlaylist: CMS URL is not configured");
        return { success: false, message: "CMS URL is not configured" };
      }

      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/playlist/copy/${context.playlistId}`;
      logger.debug(`copyPlaylist: Request URL = ${url}`);

      const formData = new URLSearchParams();
      formData.append('name', context.name);
      formData.append('copyMediaFiles', context.copyMediaFiles.toString());

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
        logger.error("copyPlaylist: API error response", { status: response.status, error: parsedError });
        return { success: false, message: `HTTP error! status: ${response.status}`, errorData: parsedError };
      }

      const data = await response.json();
      const validatedData = copyResponseSchema.parse(data);

      return { success: true, data: validatedData };
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.error("copyPlaylist: Validation error", { error: error.issues });
        return { success: false, message: "Validation error occurred", errorData: error.issues };
      }
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
      logger.error("copyPlaylist: An unexpected error occurred", { error: errorMessage });
      return { success: false, message: errorMessage };
    }
  },
}); 