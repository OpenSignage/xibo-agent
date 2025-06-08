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
 * Image History Retrieval Tool
 * 
 * This module provides functionality to retrieve the history of generated images,
 * including metadata and generation parameters for each image.
 */

import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { getHistory, getAllHistory } from './imageHistory';
import { logger } from '../../../index';

/**
 * Schema for API response validation
 */
const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    history: z.array(z.object({
      id: z.number(),
      filename: z.string(),
      prompt: z.string(),
      aspectRatio: z.string(),
      width: z.number(),
      height: z.number(),
      createdAt: z.string(),
    })),
    error: z.string().optional(),
  }),
});

/**
 * Tool for retrieving image generation history
 * 
 * Features:
 * - Retrieve history for a specific generation process
 * - Get metadata for all generated images
 * - Error handling and logging
 */
export const getImageHistory = createTool({
  id: "get-image-history",
  description: "Retrieve the history of generated images",
  inputSchema: z.object({
    generatorId: z.string().optional().describe("ID of the generation process (optional)"),
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    try {
      let history;
      
      if (context.generatorId) {
        // 特定の生成プロセスの履歴を取得
        const generatorHistory = getHistory(context.generatorId);
        history = generatorHistory.images;
      } else {
        // 全生成プロセスの履歴を取得
        const allHistory = getAllHistory();
        history = Object.values(allHistory).flatMap(generator => generator.images);
      }

      logger.info(`Retrieved history for ${history.length} images`);
      
      return {
        success: true,
        data: {
          history,
        },
      };

    } catch (error) {
      logger.error(`getImageHistory: An error occurred: ${error instanceof Error ? error.message : "Unknown error"}`, { error });
      return {
        success: false,
        data: {
          history: [],
          error: error instanceof Error ? error.message : "Unknown error"
        }
      };
    }
  },
}); 