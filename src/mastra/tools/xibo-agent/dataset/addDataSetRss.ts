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
 * @module addDataSetRss
 * @description Provides a tool to add a new RSS feed configuration to a dataset in the Xibo CMS.
 */
import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { dataSetRssSchema } from "./schemas";
import { logger } from "../../../logger";  
import { decodeErrorMessage, processError } from "../utility/error";

// Schema for a successful response, containing the newly created RSS feed configuration.
const successResponseSchema = z.object({
  success: z.literal(true),
  data: dataSetRssSchema,
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
 * Tool for adding a new RSS feed configuration to a dataset.
 */
export const addDataSetRss = createTool({
  id: "add-data-set-rss",
  description: "Adds a new RSS feed configuration to a specified dataset.",
  inputSchema: z.object({
    dataSetId: z.number().describe("The ID of the dataset to add the RSS feed to. Required."),
    title: z.string().describe("The title for the new RSS feed. Required."),
    author: z.string().describe("The author for the new RSS feed. Required."),
    summaryColumnId: z.number().describe("The ID of the dataset column to be used for the item summary. Required."),
    contentColumnId: z.number().describe("The ID of the dataset column to be used for the item content. Required."),
    publishedDateColumnId: z.number().describe("The ID of the dataset column to be used for the item published date. Required."),
  }),
  outputSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      const message = "CMS URL is not configured.";
      logger.error(message);
      return { success: false as const, message };
    }

    const { dataSetId, ...rest } = context;
    const url = new URL(`${config.cmsUrl}/api/dataset/${dataSetId}/rss`);

    try {
      const params = new URLSearchParams();
      Object.entries(rest).forEach(([key, value]) => {
        params.append(key, String(value));
      });
      
      logger.info({ url: url.toString(), params: params.toString() }, `Attempting to add RSS feed to dataset ID: ${dataSetId}`);

      const response = await fetch(url.toString(), {
        method: "POST",
        headers: {
          ...await getAuthHeaders(),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params,
      });

      const responseData = await response.json();

      if (!response.ok) {
        const decodedError = decodeErrorMessage(responseData);
        const message = `Failed to add RSS feed. API responded with status ${response.status}.`;
        logger.error({ status: response.status, response: decodedError }, message);
        return { success: false as const, message, errorData: decodedError };
      }

      const validationResult = dataSetRssSchema.safeParse(responseData);

      if (!validationResult.success) {
        const message = "Add RSS feed response validation failed.";
        logger.error({ error: validationResult.error.flatten(), data: responseData }, message);
        return {
          success: false as const,
          message,
          error: validationResult.error.flatten(),
          errorData: responseData,
        };
      }
      
      logger.info({ rssId: validationResult.data.rssId }, `Successfully added RSS feed to dataset ID: ${dataSetId}.`);
      return {
        success: true as const,
        data: validationResult.data,
      };
    } catch (error) {
      const message = "An unexpected error occurred while adding the RSS feed.";
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