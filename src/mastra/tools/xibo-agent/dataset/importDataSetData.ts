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
 * @module importDataSetData
 * @description Provides a tool to import data from a CSV string into a dataset in the Xibo CMS.
 */
import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../logger";
import { decodeErrorMessage, processError } from "../utility/error";

// Schema for a successful response. The API response structure can vary.
const successResponseSchema = z.object({
    success: z.literal(true),
    data: z.any(),
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
 * Tool for importing data from a CSV string into a dataset.
 */
export const importDataSetData = createTool({
  id: "import-data-set-data",
  description: "Imports data from a CSV string into a specified dataset.",
  inputSchema: z.object({
    dataSetId: z.number().describe("The ID of the dataset to import data into."),
    csvData: z.string().describe("The CSV formatted data as a single string."),
    overwrite: z.boolean().optional().describe("Set to true to overwrite all existing data in the dataset."),
  }),
  outputSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      const message = "CMS URL is not configured.";
      logger.error(message);
      return { success: false as const, message };
    }

    const { dataSetId, csvData, overwrite } = context;
    const url = new URL(`${config.cmsUrl}/api/dataset/import/${dataSetId}`);
    
    try {
      logger.info({ dataSetId, overwrite }, `Attempting to import data into dataset ID: ${dataSetId}`);

      const formData = new FormData();
      const csvBlob = new Blob([csvData], { type: 'text/csv' });
      formData.append("files", csvBlob, "import.csv");

      if (overwrite) {
        formData.append("overwrite", "1");
      }

      const response = await fetch(url.toString(), {
        method: "POST",
        headers: await getAuthHeaders(), // Content-Type is set automatically by fetch for FormData
        body: formData,
      });

      const responseData = await response.json();

      if (!response.ok) {
        const decodedError = decodeErrorMessage(responseData);
        const message = `Failed to import dataset data. API responded with status ${response.status}.`;
        logger.error({ status: response.status, response: decodedError }, message);
        return { success: false as const, message, errorData: decodedError };
      }
      
      logger.info({ dataSetId, response: responseData }, `Successfully imported data into dataset ID: ${dataSetId}.`);
      return {
        success: true as const,
        data: responseData,
      };
    } catch (error) {
      const message = "An unexpected error occurred while importing dataset data.";
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