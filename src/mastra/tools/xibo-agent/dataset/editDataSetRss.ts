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
 * @module editDataSetRss
 * @description Provides a tool to edit an existing RSS feed configuration for a dataset in the Xibo CMS.
 */
import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { dataSetRssSchema } from "./schemas";
import { logger } from "../../../index";
import { decodeErrorMessage, processError } from "../utility/error";

// Schema for a successful response, containing the edited RSS feed configuration.
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
 * Tool for editing an existing RSS feed configuration for a dataset.
 */
export const editDataSetRss = createTool({
  id: "edit-data-set-rss",
  description: "Edits an existing RSS feed configuration for a specified dataset.",
  inputSchema: z.object({
    dataSetId: z.number().describe("The ID of the dataset the RSS feed belongs to. Required."),
    rssId: z.number().describe("The ID of the RSS feed to edit. Required."),
    title: z.string().describe("The new title for the RSS feed. Required."),
    author: z.string().describe("The new author for the RSS feed. Required."),
    summaryColumnId: z.number().describe("The ID of the column to be used for the item summary. Required."),
    contentColumnId: z.number().describe("The ID of the column to be used for the item content. Required."),
    publishedDateColumnId: z.number().describe("The ID of the column to be used for the item published date. Required."),
    regeneratePsk: z.number().min(0).max(1).optional().describe("Flag to regenerate the Pre-Shared Key (1 for yes, 0 for no)."),
  }),
  outputSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      const message = "CMS URL is not configured.";
      logger.error(message);
      return { success: false as const, message };
    }

    const { dataSetId, rssId, ...rest } = context;
    const url = new URL(`${config.cmsUrl}/api/dataset/${dataSetId}/rss/${rssId}`);

    try {
      const params = new URLSearchParams();
      Object.entries(rest).forEach(([key, value]) => {
          if (value !== undefined) {
              params.append(key, String(value));
          }
      });
      
      logger.info({ url: url.toString(), params: params.toString() }, `Attempting to edit RSS feed ${rssId} for dataset ID: ${dataSetId}`);

      const response = await fetch(url.toString(), {
        method: "PUT",
        headers: {
          ...await getAuthHeaders(),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params,
      });

      const responseData = await response.json();

      if (!response.ok) {
        const decodedError = decodeErrorMessage(responseData);
        const message = `Failed to edit RSS feed. API responded with status ${response.status}.`;
        logger.error({ status: response.status, response: decodedError }, message);
        return { success: false as const, message, errorData: decodedError };
      }

      const validationResult = dataSetRssSchema.safeParse(responseData);

      if (!validationResult.success) {
        const message = "Edit RSS feed response validation failed.";
        logger.error({ error: validationResult.error.flatten(), data: responseData }, message);
        return {
          success: false as const,
          message,
          error: validationResult.error.flatten(),
          errorData: responseData,
        };
      }
      
      logger.info({ rssId: validationResult.data.rssId }, `Successfully edited RSS feed for dataset ID: ${dataSetId}.`);
      return {
        success: true as const,
        data: validationResult.data,
      };
    } catch (error) {
      const message = "An unexpected error occurred while editing the RSS feed.";
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