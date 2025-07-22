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
 * @description Provides a tool to delete an existing RSS feed configuration from a dataset in the Xibo CMS.
 */
import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../logger";  
import { decodeErrorMessage, processError } from "../utility/error";

// Schema for a successful response (204 No Content).
const successResponseSchema = z.object({
  success: z.literal(true),
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
 * Tool for deleting an existing RSS feed from a dataset.
 */
export const deleteDataSetRss = createTool({
  id: "delete-data-set-rss",
  description: "Deletes an existing RSS feed configuration from a dataset.",
  inputSchema: z.object({
    dataSetId: z.number().describe("The ID of the dataset the RSS feed belongs to."),
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

    try {
      logger.info({ url: url.toString() }, `Attempting to delete RSS feed ${rssId} from dataset ID: ${dataSetId}`);

      const response = await fetch(url.toString(), {
        method: "DELETE",
        headers: await getAuthHeaders(),
      });

      if (response.status === 204) {
        logger.info(`Successfully deleted RSS feed ${rssId} from dataset ID: ${dataSetId}`);
        return { success: true as const };
      }

      let responseData;
      try {
        responseData = await response.json();
      } catch (e) {
        responseData = await response.text();
      }

      const decodedError = decodeErrorMessage(responseData);
      const message = `Failed to delete RSS feed. API responded with status ${response.status}.`;
      logger.error({ status: response.status, response: decodedError }, message);
      return { success: false as const, message, errorData: decodedError };
      
    } catch (error) {
      const message = "An unexpected error occurred while deleting the RSS feed.";
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