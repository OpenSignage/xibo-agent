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
 * @module exportDataSetData
 * @description Provides a tool to export all data from a dataset as a CSV string.
 */
import { z } from 'zod';
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../logger";
import { decodeErrorMessage, processError } from "../utility/error";

// Schema for a successful response, containing the CSV data as a string.
const successResponseSchema = z.object({
  success: z.literal(true),
  data: z.string(),
});

// Schema for a generic error response.
const errorResponseSchema = z.object({
  success: z.literal(false),
  message: z.string(),
  error: z.any().optional(),
  errorData: z.any().optional(),
});

/**
 * Schema for the tool's output, which can be a success or error response.
 */
const outputSchema = z.union([successResponseSchema, errorResponseSchema]);

/**
 * Tool for exporting dataset data as a CSV string.
 */
export const exportDataSetData = createTool({
  id: "export-data-set-data",
  description: "Exports all data from a specified dataset as a CSV formatted string.",
  inputSchema: z.object({
    dataSetId: z.number().describe("The ID of the dataset to export data from."),
  }),
  outputSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      const message = "CMS URL is not configured.";
      logger.error(message);
      return { success: false as const, message };
    }

    const url = new URL(`${config.cmsUrl}/api/dataset/export/csv/${context.dataSetId}`);

    try {
      logger.info({ url: url.toString() }, `Attempting to export data from dataset ID: ${context.dataSetId}`);

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: await getAuthHeaders(),
      });

      const responseText = await response.text();

      if (!response.ok) {
        let errorData;
        try {
          errorData = JSON.parse(responseText);
        } catch (e) {
          errorData = responseText;
        }
        const decodedError = decodeErrorMessage(errorData);
        const message = `Failed to export dataset data. API responded with status ${response.status}.`;
        logger.error({ status: response.status, response: decodedError }, message);
        return { success: false as const, message, errorData: decodedError };
      }
      
      logger.info({ dataSetId: context.dataSetId }, `Successfully exported data from dataset ID: ${context.dataSetId}.`);
      return {
        success: true as const,
        data: responseText,
      };
    } catch (error) {
      const message = "An unexpected error occurred while exporting the dataset data.";
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