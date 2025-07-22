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
 * @module addDataSet
 * @description Provides a tool to add a new dataset to the Xibo CMS,
 * supporting both standard and remote dataset configurations.
 */
import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { dataSetSchema } from "./schemas";
import { logger } from "../../../logger";
import { decodeErrorMessage, processError } from "../utility/error";

// Schema for a successful response, containing the newly created dataset.
const successResponseSchema = z.object({
  success: z.literal(true),
  data: dataSetSchema,
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
 * Tool for adding a new dataset to the Xibo CMS.
 * This tool can create both standard and remote datasets with various configurations.
 */
export const addDataSet = createTool({
  id: "add-data-set",
  description: "Adds a new dataset to the Xibo CMS, with options for remote data sources.",
  inputSchema: z.object({
    dataSet: z.string().describe("The name for the new dataset. Required."),
    description: z.string().optional().describe("An optional description for the dataset."),
    code: z.string().optional().describe("An optional code for filtering or identification."),
    folderId: z.number().optional().describe("The ID of the folder where the dataset should be created."),
    isRemote: z.number().optional().describe("Flag indicating if this is a remote DataSet (0 for false, 1 for true). Required by API."),
    isRealTime: z.number().optional().describe("Flag indicating if this is a real-time DataSet (0 for false, 1 for true). Required by API."),
    dataConnectorSource: z.string().optional().describe("Source of the data connector. Required for real-time datasets."),
    method: z.string().optional().describe("For remote datasets, the HTTP request method (e.g., 'GET', 'POST')."),
    uri: z.string().optional().describe("For remote datasets, the URI of the data source, without query parameters."),
    postData: z.string().optional().describe("For remote datasets using POST, the query parameter encoded data to send."),
    authentication: z.string().optional().describe("For remote datasets, the HTTP Authentication method (e.g., 'None', 'Basic', 'Digest')."),
    username: z.string().optional().describe("For remote datasets, the username for HTTP Authentication."),
    password: z.string().optional().describe("For remote datasets, the password for HTTP Authentication."),
    customHeaders: z.string().optional().describe("For remote datasets, a comma-separated string of custom HTTP headers."),
    userAgent: z.string().optional().describe("For remote datasets, a custom user agent value."),
    refreshRate: z.number().optional().describe("For remote datasets, the refresh interval in seconds."),
    clearRate: z.number().optional().describe("For remote datasets, the interval in seconds to truncate old data."),
    truncateOnEmpty: z.number().optional().describe("For remote datasets, flag to truncate if the source returns no new data (0 or 1)."),
    runsAfter: z.number().optional().describe("For remote datasets, an optional dataSetId that should run before this one."),
    dataRoot: z.string().optional().describe("For remote datasets, the root element of the data in the remote source."),
    summarize: z.string().optional().describe("For remote datasets, whether the data should be aggregated (e.g., 'None', 'Summarize', 'Count')."),
    summarizeField: z.string().optional().describe("For remote datasets, the field to use for summarization."),
    sourceId: z.number().optional().describe("For remote datasets, the data type ID (1 for JSON, 2 for CSV)."),
    ignoreFirstRow: z.number().optional().describe("For remote CSV datasets, a flag to ignore the first row (0 or 1)."),
    rowLimit: z.number().optional().describe("For remote datasets, the maximum number of rows the dataset can hold."),
    limitPolicy: z.string().optional().describe("For remote datasets, the policy when the row limit is reached (e.g., 'stop', 'fifo', 'truncate')."),
    csvSeparator: z.string().optional().describe("For remote CSV datasets, the separator character."),
    dataConnectorScript: z.string().optional().describe("For real-time datasets, a script to connect to the data source."),
  }),
  outputSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      const message = "CMS URL is not configured.";
      logger.error(message);
      return { success: false as const, message };
    }

    const url = new URL(`${config.cmsUrl}/api/dataset`);

    try {
      const params = new URLSearchParams();
      Object.entries(context).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });
      
      logger.info({ url: url.toString(), params: params.toString() }, `Attempting to add dataset: ${context.dataSet}`);

      const response = await fetch(url.toString(), {
        method: "POST",
        headers: {
          ...await getAuthHeaders(),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
      });

      const responseData = await response.json();

      if (!response.ok) {
        const decodedError = decodeErrorMessage(responseData);
        const message = `Failed to add dataset. API responded with status ${response.status}.`;
        logger.error({ status: response.status, response: decodedError }, message);
        return { success: false as const, message, errorData: decodedError };
      }

      const validationResult = dataSetSchema.safeParse(responseData);

      if (!validationResult.success) {
        const message = "Add dataset response validation failed.";
        logger.error({ error: validationResult.error.flatten(), data: responseData }, message);
        return {
          success: false as const,
          message,
          error: validationResult.error.flatten(),
          errorData: responseData,
        };
      }
      
      logger.info({ dataSetId: validationResult.data.dataSetId }, `Successfully added dataset: ${validationResult.data.dataSet}`);
      return {
        success: true as const,
        data: validationResult.data,
      };
    } catch (error) {
      const message = "An unexpected error occurred while adding the dataset.";
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