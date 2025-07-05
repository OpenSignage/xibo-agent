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
 * @description Provides a tool to export dataset data as a CSV string from the Xibo CMS.
 */
import { z } from 'zod';
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../index";
import { decodeErrorMessage } from "../utility/error";

/**
 * Schema for the tool's output, covering success and failure cases.
 * The success data is a string containing the CSV data.
 */
const outputSchema = z.union([
  z.object({
    success: z.literal(true),
    data: z.string(),
    message: z.string(),
  }),
  z.object({
    success: z.literal(false),
    message: z.string(),
    error: z.any().optional(),
    errorData: z.any().optional(),
  }),
]);

/**
 * Tool for exporting dataset data as a CSV string.
 */
export const exportDataSetData = createTool({
  id: "export-data-set-data",
  description: "Export the data from a dataset as a CSV string.",
  inputSchema: z.object({
    dataSetId: z.number().describe("The ID of the dataset to export."),
  }),
  outputSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      const message = "CMS URL is not configured.";
      logger.error(message);
      return { success: false as const, message };
    }

    const url = new URL(`${config.cmsUrl}/api/dataset/${context.dataSetId}/csv`);
    logger.info(`Attempting to export data from dataset ID: ${context.dataSetId}`);

    try {
      const response = await fetch(url.toString(), {
        method: "GET",
        headers: await getAuthHeaders(),
      });

      const responseText = await response.text();

      if (!response.ok) {
        // Try to parse as JSON for error details, but fall back to text
        let errorData;
        try {
          errorData = JSON.parse(responseText);
        } catch {
          errorData = responseText;
        }
        const decodedError = decodeErrorMessage(errorData);
        const message = `Failed to export dataset data. API responded with status ${response.status}.`;
        logger.error(message, { response: decodedError });
        return { success: false as const, message, errorData: decodedError };
      }
      
      const message = `Successfully exported data from dataset ID: ${context.dataSetId}.`;
      logger.info(message);
      return {
        success: true as const,
        data: responseText,
        message,
      };
    } catch (error) {
      const message = "An unexpected error occurred while exporting the dataset data.";
      logger.error(message, { error });
      return {
        success: false as const,
        message,
        error: error instanceof Error ? { name: error.name, message: error.message } : error,
      };
    }
  },
}); 