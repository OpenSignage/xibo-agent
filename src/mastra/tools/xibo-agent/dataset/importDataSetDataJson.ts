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
 * @module importDataSetDataJson
 * @description Provides a tool to import data from a JSON object into a dataset in the Xibo CMS.
 */
import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../index";
import { decodeErrorMessage, processError } from "../utility/error";

/**
 * Schema for the JSON data structure required for import, matching the Xibo API specification.
 */
const importJsonSchema = z.object({
  uniqueKeys: z.array(z.string()).describe("An array of column headings to use as a unique key for matching and updating rows."),
  rows: z.array(z.record(z.string(), z.any())).describe("An array of row objects, where each object's keys are column headings and values are the cell data."),
});

/**
 * Schema for a successful response. The API response structure can vary.
 */
const successResponseSchema = z.object({
  success: z.literal(true),
  data: z.any(),
});

/**
 * Schema for a generic error response.
 */
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
 * Tool for importing data from a JSON object into a dataset.
 */
export const importDataSetDataJson = createTool({
  id: "import-data-set-data-json",
  description: "Imports data from a structured JSON object into a specified dataset.",
  inputSchema: z.object({
    dataSetId: z.number().describe("The ID of the dataset to import data into."),
    jsonData: importJsonSchema.describe("The JSON object containing the data to import, conforming to the API's expected structure."),
  }),
  outputSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      const message = "CMS URL is not configured.";
      logger.error(message);
      return { success: false as const, message };
    }

    const { dataSetId, jsonData } = context;
    const url = new URL(`${config.cmsUrl}/api/dataset/importjson/${dataSetId}`);
    
    try {
      logger.info({ dataSetId }, `Attempting to import JSON data into dataset ID: ${dataSetId}`);

      const response = await fetch(url.toString(), {
        method: "POST",
        headers: {
          ...await getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(jsonData),
      });

      const responseData = await response.json();

      if (!response.ok) {
        const decodedError = decodeErrorMessage(responseData);
        const message = `Failed to import JSON data. API responded with status ${response.status}.`;
        logger.error({ status: response.status, response: decodedError }, message);
        return { success: false as const, message, errorData: decodedError };
      }
      
      logger.info({ dataSetId, response: responseData }, `Successfully imported JSON data into dataset ID: ${dataSetId}.`);
      return {
        success: true as const,
        data: responseData,
      };
    } catch (error) {
      const message = "An unexpected error occurred while importing JSON data.";
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