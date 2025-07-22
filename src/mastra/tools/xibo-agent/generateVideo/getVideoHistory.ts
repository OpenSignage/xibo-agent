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
 * Get Video History Tool
 * 
 * This module provides a tool to retrieve the history of all generated videos.
 */

import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { readVideoHistory, historySchema } from './videoHistory';
import { logger } from '../../../logger';

// Defines the schema for a successful response, containing the video history.
const successResponseSchema = z.object({
  success: z.literal(true),
  data: historySchema,
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
 * A tool to retrieve the history of generated videos.
 * It reads the history from the persistent JSON file and returns it.
 */
export const getVideoHistory = createTool({
  id: "get-video-history",
  description: "Retrieve the history of all generated videos.",
  inputSchema: z.object({}), // No input required for this tool.
  outputSchema: responseSchema,
  execute: async ({ context: _ }): Promise<ResponseSchema> => {
    try {
      logger.info("Attempting to retrieve video history.");
      const history = readVideoHistory();
      logger.info(`Successfully retrieved ${history.length} video history entries.`);
      
      return {
        success: true,
        data: history,
      };

    } catch (error) {
      const message = "An unexpected error occurred while retrieving video history.";
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