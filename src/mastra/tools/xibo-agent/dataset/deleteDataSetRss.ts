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
 * @module deleteDataSetRss
 * @description Provides a tool to delete an existing RSS feed from a dataset in the Xibo CMS.
 */
import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../index";
import { decodeErrorMessage } from "../utility/error";

/**
 * Schema for the tool's output, covering success and failure cases.
 */
const outputSchema = z.union([
  z.object({
    success: z.literal(true),
  }),
  z.object({
    success: z.literal(false),
    message: z.string(),
    error: z.any().optional(),
    errorData: z.any().optional(),
  }),
]);

/**
 * Tool for deleting an existing RSS feed from a dataset.
 */
export const deleteDataSetRss = createTool({
  id: "delete-data-set-rss",
  description: "Delete an existing RSS feed from a dataset.",
  inputSchema: z.object({
    dataSetId: z.number().describe("The ID of the dataset."),
    rssId: z.number().describe("The ID of the RSS feed to delete."),
  }),
  outputSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      const message = "CMS URL is not configured.";
      logger.error(message);
      return { success: false as const, message };
    }

    const { dataSetId, rssId } = context;
    const url = new URL(`${config.cmsUrl}/api/dataset/${dataSetId}/rss/${rssId}`);
    logger.info(`Attempting to delete RSS feed ${rssId} from dataset ID: ${dataSetId}`);

    try {
      const response = await fetch(url.toString(), {
        method: "DELETE",
        headers: await getAuthHeaders(),
      });

      if (response.status === 204) {
        return { success: true as const };
      }

      // If we get a body, it's likely an error
      const responseData = await response.json();
      const decodedError = decodeErrorMessage(responseData);
      const message = `Failed to delete RSS feed. API responded with status ${response.status}.`;
      logger.error(message, { response: decodedError });
      return { success: false as const, message, errorData: decodedError };
      
    } catch (error) {
      const message = "An unexpected error occurred while deleting the RSS feed.";
      logger.error(message, { error });
      return {
        success: false as const,
        message,
        error: error instanceof Error ? { name: error.name, message: error.message } : error,
      };
    }
  },
}); 