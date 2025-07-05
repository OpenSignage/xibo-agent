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
 * @description Provides a tool to add a new dataset to the Xibo CMS.
 */
import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { dataSetSchema } from "./schemas";
import { logger } from "../../../index";
import { decodeErrorMessage } from "../utility/error";

/**
 * Schema for the tool's output, which can be a success or failure response.
 */
const outputSchema = z.union([
  z.object({
    success: z.literal(true),
    data: dataSetSchema,
  }),
  z.object({
    success: z.literal(false),
    message: z.string(),
    error: z.any().optional(),
    errorData: z.any().optional(),
  }),
]);

/**
 * Tool for adding a new dataset.
 */
export const addDataSet = createTool({
  id: "add-data-set",
  description: "Add a new dataset.",
  inputSchema: z.object({
    dataSet: z.string().describe("The name of the dataset."),
    description: z.string().optional().describe("A description for the dataset."),
    code: z.string().optional().describe("A code for filtering."),
    folderId: z.number().optional().describe("Folder ID to which this dataset should be assigned."),
    isRemote: z.number().optional().describe("Flag indicating if this is a remote DataSet (0 or 1)."),
    isRealTime: z.number().optional().describe("Flag indicating if this is a real-time DataSet (0 or 1)."),
    dataConnectorSource: z.string().optional().describe("Source of the data connector."),
    method: z.string().optional().describe("The request method (GET or POST)."),
    uri: z.string().optional().describe("The URI, without query parameters."),
    postData: z.string().optional().describe("Query parameter encoded data to add to the request."),
    authentication: z.string().optional().describe("HTTP Authentication method (None, Basic, Digest)."),
    username: z.string().optional().describe("HTTP Authentication User Name."),
    password: z.string().optional().describe("HTTP Authentication Password."),
    customHeaders: z.string().optional().describe("Comma-separated string of custom HTTP headers."),
    userAgent: z.string().optional().describe("Custom user agent value."),
    refreshRate: z.number().optional().describe("How often in seconds this remote DataSet should be refreshed."),
    clearRate: z.number().optional().describe("How often in seconds this remote DataSet should be truncated."),
    truncateOnEmpty: z.number().optional().describe("Should the DataSet data be truncated even if no new data is pulled from the source? (0 or 1)"),
    runsAfter: z.number().optional().describe("An optional dataSetId which should be run before this Remote DataSet."),
    dataRoot: z.string().optional().describe("The root of the data in the Remote source."),
    summarize: z.string().optional().describe("Should the data be aggregated? (None, Summarize, Count)."),
    summarizeField: z.string().optional().describe("Which field should be used to summarize."),
    sourceId: z.number().optional().describe("For remote DataSet, the data type (1 for json, 2 for csv)."),
    ignoreFirstRow: z.number().optional().describe("For remote CSV DataSet, should the first row be ignored? (0 or 1)"),
    rowLimit: z.number().optional().describe("Maximum number of rows this DataSet can hold."),
    limitPolicy: z.string().optional().describe("What should happen when the DataSet row limit is reached? (stop, fifo, or truncate)."),
    csvSeparator: z.string().optional().describe("Separator for remote CSV DataSets."),
    dataConnectorScript: z.string().optional().describe("If isRealTime, provide a script to connect to the data source."),
  }),
  outputSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      const message = "CMS URL is not configured.";
      logger.error(message);
      return { success: false as const, message };
    }

    const url = new URL(`${config.cmsUrl}/api/dataset`);
    logger.info(`Attempting to add dataset: ${context.dataSet}`);

    try {
      const params = new URLSearchParams();
      // Dynamically append all context properties to the search params
      Object.entries(context).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      });

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
        logger.error(message, { response: decodedError });
        return { success: false as const, message, errorData: decodedError };
      }

      const validationResult = dataSetSchema.safeParse(responseData);

      if (!validationResult.success) {
        const message = "Dataset response validation failed.";
        logger.error(message, { error: validationResult.error, data: responseData });
        return {
          success: false as const,
          message,
          error: validationResult.error,
          errorData: responseData,
        };
      }
      
      const message = `Successfully added dataset: ${validationResult.data.dataSet}`;
      logger.info(message, { dataSetId: validationResult.data.dataSetId });
      return {
        success: true as const,
        data: validationResult.data,
      };
    } catch (error) {
      const message = "An unexpected error occurred while adding the dataset.";
      logger.error(message, { error });
      return {
        success: false as const,
        message,
        error: error instanceof Error ? { name: error.name, message: error.message } : error,
      };
    }
  },
}); 