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
 * Video History Update Tool
 * 
 * This module provides a tool to update the metadata of a previously
 * generated video in the history.
 */

import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { updateVideoHistory, videoHistorySchema } from './videoHistory';
import { logger } from '../../../logger';

// Defines the schema for a successful response, containing the updated video entry.
const successResponseSchema = z.object({
  success: z.literal(true),
  data: videoHistorySchema,
});

// Defines the schema for an error response.
const errorResponseSchema = z.object({
  success: z.literal(false),
  message: z.string(),
  error: z.any().optional(),
});

// Creates a union schema for consistent response validation.
const responseSchema = z.union([successResponseSchema, errorResponseSchema]);
type ResponseSchema = z.infer<typeof responseSchema>;

/**
 * A tool to update the metadata of a generated video.
 * It modifies entries in the persistent videoHistory.json file.
 */
export const videoUpdate = createTool({
  id: "update-video-history",
  description: "Update the metadata of a generated video in the history.",
  inputSchema: z.object({
    id: z.string().describe("The ID of the video to update."),
    updates: z.object({
      isFavorite: z.boolean().optional().describe("Set or unset the video as a favorite."),
      // Add other updatable fields here in the future if needed.
    }).describe("The properties to update.")
  }),
  outputSchema: responseSchema,
  execute: async ({ context }): Promise<ResponseSchema> => {
    try {
      const { id, updates } = context;
      logger.info(`Attempting to update video with ID: ${id}`);
      
      const updatedVideo = updateVideoHistory(id, updates);

      if (!updatedVideo) {
        const message = `Video with ID ${id} not found.`;
        logger.warn(message);
        return {
          success: false,
          message,
        };
      }
      
      logger.info(`Successfully updated video with ID: ${id}`);
      return {
        success: true,
        data: updatedVideo,
      };

    } catch (error) {
      const message = "An unexpected error occurred while updating video history.";
      logger.error(message, {
        error: error instanceof Error ? error.message : "Unknown error"
      });
      return {
        success: false,
        message,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  },
}); 