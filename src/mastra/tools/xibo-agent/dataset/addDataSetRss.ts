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
 * @description Provides a tool to add a new RSS feed to a dataset in the Xibo CMS.
 */
import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { dataSetRssSchema } from "./schemas";
import { logger } from "../../../index";
import { decodeErrorMessage } from "../utility/error";

/**
 * Schema for the tool's output, covering success and failure cases.
 */
const outputSchema = z.union([
  z.object({
    success: z.literal(true),
    data: dataSetRssSchema,
  }),
  z.object({
    success: z.literal(false),
    message: z.string(),
    error: z.any().optional(),
    errorData: z.any().optional(),
  }),
]);

/**
 * Tool for adding a new RSS feed to a dataset.
 */
export const addDataSetRss = createTool({
  id: "add-data-set-rss",
  description: "Add a new RSS feed to a dataset.",
  inputSchema: z.object({
    dataSetId: z.number().describe("The ID of the dataset to add the RSS feed to."),
    title: z.string().describe("The title for the RSS."),
    summaryColumnId: z.number().describe("The columnId to be used as each item summary."),
    contentColumnId: z.number().describe("The columnId to be used as each item content."),
    publishedDateColumnId: z.number().describe("The columnId to be used as each item published date."),
  }),
  outputSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      const message = "CMS URL is not configured.";
      logger.error(message);
      return { success: false as const, message };
    }

    const { dataSetId, title, summaryColumnId, contentColumnId, publishedDateColumnId } = context;
    const url = new URL(`${config.cmsUrl}/api/dataset/${dataSetId}/rss`);
    logger.info(`Attempting to add RSS feed to dataset ID: ${dataSetId}`);

    try {
      const params = new URLSearchParams();
      params.append('title', title);
      params.append('summaryColumnId', String(summaryColumnId));
      params.append('contentColumnId', String(contentColumnId));
      params.append('publishedDateColumnId', String(publishedDateColumnId));

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
        logger.error(message, { response: decodedError });
        return { success: false as const, message, errorData: decodedError };
      }

      const validationResult = dataSetRssSchema.safeParse(responseData);

      if (!validationResult.success) {
        const message = "Add RSS feed response validation failed.";
        logger.error(message, { error: validationResult.error, data: responseData });
        return {
          success: false as const,
          message,
          error: validationResult.error,
          errorData: responseData,
        };
      }
      
      return {
        success: true as const,
        data: validationResult.data,
      };
    } catch (error) {
      const message = "An unexpected error occurred while adding the RSS feed.";
      logger.error(message, { error });
      return {
        success: false as const,
        message,
        error: error instanceof Error ? { name: error.name, message: error.message } : error,
      };
    }
  },
}); 