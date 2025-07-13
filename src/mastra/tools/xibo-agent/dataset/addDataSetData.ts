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
 * @module addDataSetData
 * @description Provides a tool to add a new row of data to a specific dataset in the Xibo CMS.
 */
import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { dataSetDataSchema } from "./schemas";
import { logger } from "../../../index";
import { decodeErrorMessage, processError } from "../utility/error";

// Schema for a successful response, containing the newly created data row.
const successResponseSchema = z.object({
  success: z.literal(true),
  data: dataSetDataSchema,
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
 * Tool for adding a new row of data to a dataset.
 */
export const addDataSetData = createTool({
  id: "add-data-set-data",
  description: "Adds a new row of data to a specified dataset.",
  inputSchema: z.object({
    dataSetId: z.number().describe("The ID of the dataset to add the data row to."),
    rowData: z.array(z.object({
      columnId: z.number().describe("The ID of the dataset column."),
      value: z.any().describe("The value for the column."),
    })).describe("An array of objects, each representing a column's data for the new row."),
  }),
  outputSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      const message = "CMS URL is not configured.";
      logger.error(message);
      return { success: false as const, message };
    }

    const { dataSetId, rowData } = context;
    const url = new URL(`${config.cmsUrl}/api/dataset/data/${dataSetId}`);
    
    try {
      const params = new URLSearchParams();
      rowData.forEach(item => {
        // The API expects keys in the format 'dataSetColumnId_{ID}'
        params.append(`dataSetColumnId_${item.columnId}`, String(item.value));
      });

      logger.info({ url: url.toString(), params: params.toString() }, `Attempting to add data to dataset ID: ${dataSetId}`);

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
        const message = `Failed to add data to dataset. API responded with status ${response.status}.`;
        logger.error({ status: response.status, response: decodedError }, message);
        return { success: false as const, message, errorData: decodedError };
      }

      const validationResult = dataSetDataSchema.safeParse(responseData);

      if (!validationResult.success) {
        const message = "Add dataset data response validation failed.";
        logger.error({ error: validationResult.error.flatten(), data: responseData }, message);
        return {
          success: false as const,
          message,
          error: validationResult.error.flatten(),
          errorData: responseData,
        };
      }
      
      logger.info({ rowId: validationResult.data.id }, `Successfully added data to dataset ID: ${dataSetId}.`);
      return {
        success: true as const,
        data: validationResult.data,
      };
    } catch (error) {
      const message = "An unexpected error occurred while adding data to the dataset.";
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