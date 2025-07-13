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
 * @module getDataSetRss
 * @description Provides a tool to retrieve all RSS feed configurations for a specific dataset.
 */
import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { dataSetRssSchema } from "./schemas";
import { logger } from "../../../index";
import { decodeErrorMessage, processError } from "../utility/error";

// Schema for a successful response, containing an array of RSS feed configurations.
const successResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(dataSetRssSchema),
});

// Schema for a generic error response.
const errorResponseSchema = z.object({
  success: z.literal(false),
  message: z.string(),
  error: z.any().optional(),
  errorData: z.any().optional(),
});

/**
 * Schema for the tool's output, covering success and failure cases.
 */
const outputSchema = z.union([successResponseSchema, errorResponseSchema]);

/**
 * Tool for retrieving all RSS feed configurations for a specific dataset.
 */
export const getDataSetRss = createTool({
  id: "get-data-set-rss",
  description: "Retrieves all RSS feed configurations associated with a specific dataset.",
  inputSchema: z.object({
    dataSetId: z.number().describe("The ID of the dataset to retrieve RSS feeds for."),
  }),
  outputSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      const message = "CMS URL is not configured.";
      logger.error(message);
      return { success: false as const, message };
    }

    const url = new URL(`${config.cmsUrl}/api/dataset/${context.dataSetId}/rss`);
    
    try {
      logger.info({ url: url.toString() }, `Requesting RSS feeds for dataset ID: ${context.dataSetId}`);

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: await getAuthHeaders(),
      });

      const responseData = await response.json();

      if (!response.ok) {
        const decodedError = decodeErrorMessage(responseData);
        const message = `Failed to retrieve RSS feeds. API responded with status ${response.status}.`;
        logger.error({ status: response.status, response: decodedError }, message);
        return { success: false as const, message, errorData: decodedError };
      }

      const validationResult = z.array(dataSetRssSchema).safeParse(responseData);

      if (!validationResult.success) {
        const message = "RSS feeds response validation failed.";
        logger.error({ error: validationResult.error.flatten(), data: responseData }, message);
        return {
          success: false as const,
          message,
          error: validationResult.error.flatten(),
          errorData: responseData,
        };
      }
      
      logger.info({ count: validationResult.data.length }, `Successfully retrieved ${validationResult.data.length} RSS feeds for dataset ID: ${context.dataSetId}.`);
      return {
        success: true as const,
        data: validationResult.data,
      };
    } catch (error) {
      const message = "An unexpected error occurred while retrieving RSS feeds.";
      const processedError = processError(error);
      logger.error({ error: processedError }, message);
      return {
        success: false as const,
        message,
        error: processedError,
      };
    }
  },
}); 