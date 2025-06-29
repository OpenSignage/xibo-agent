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
 * @module assign-library-items
 * @description This module provides a tool to assign library media items to a playlist.
 * It implements the POST /api/playlist/library/assign/{playlistId} endpoint.
 */

import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../index";

// Schema for the successful response after assigning media
const assignResponseSchema = z.object({
    // The API returns the updated playlist object, so we define its basic structure.
    playlistId: z.number(),
    name: z.string(),
    duration: z.number(),
    widgets: z.array(z.any()), // Can be more specific if the widget structure is known
});

/**
 * Tool to assign one or more media items from the Library to a playlist.
 */
export const assignLibraryItems = createTool({
  id: 'assign-library-items',
  description: 'Assigns library media items to a playlist.',
  inputSchema: z.object({
    playlistId: z.number().describe('The ID of the playlist to assign media to.'),
    media: z.array(z.number()).describe('An array of media IDs to assign.'),
    duration: z.number().optional().describe('The duration in seconds for the new widget(s).'),
    useDuration: z.number().min(0).max(1).optional().describe('Flag to use the supplied duration (1 for yes, 0 for no).'),
    displayOrder: z.number().optional().describe('The display order for the new widget(s).')
  }),
  outputSchema: z.object({
    success: z.boolean(),
    data: assignResponseSchema.optional(),
    message: z.string().optional(),
    errorData: z.any().optional()
  }),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        logger.error("assignLibraryItems: CMS URL is not configured");
        return { success: false, message: "CMS URL is not configured" };
      }

      // Get authentication headers and construct the target URL.
      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/playlist/library/assign/${context.playlistId}`;
      logger.debug(`assignLibraryItems: Request URL = ${url}`);

      // Prepare the request body. The 'media' parameter is an array.
      const formData = new URLSearchParams();
      context.media.forEach(mediaId => {
        formData.append('media[]', mediaId.toString());
      });
      // Append optional parameters if they are provided.
      if (context.duration !== undefined) formData.append('duration', context.duration.toString());
      if (context.useDuration !== undefined) formData.append('useDuration', context.useDuration.toString());
      if (context.displayOrder !== undefined) formData.append('displayOrder', context.displayOrder.toString());

      // Make the POST request to assign the library items.
      const response = await fetch(url, {
        method: 'POST',
        headers: {
            ...headers,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData
      });

      // Handle non-successful API responses.
      if (!response.ok) {
        const responseText = await response.text();
        let parsedError: any;
        try {
            parsedError = JSON.parse(responseText);
        } catch (e) {
            parsedError = responseText;
        }
        logger.error("assignLibraryItems: API error response", { status: response.status, error: parsedError });
        return { success: false, message: `HTTP error! status: ${response.status}`, errorData: parsedError };
      }

      // Parse and validate the successful response against the schema.
      const data = await response.json();
      const validatedData = assignResponseSchema.parse(data);

      // Return a success object with the validated playlist data.
      return { success: true, data: validatedData };
    } catch (error) {
      // Handle Zod validation errors specifically.
      if (error instanceof z.ZodError) {
        logger.error("assignLibraryItems: Validation error", { error: error.issues });
        return { success: false, message: "Validation error occurred", errorData: error.issues };
      }
      // Catch and handle any other unexpected errors.
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
      logger.error("assignLibraryItems: An unexpected error occurred", { error: errorMessage });
      return { success: false, message: errorMessage };
    }
  },
}); 