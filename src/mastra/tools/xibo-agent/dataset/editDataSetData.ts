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
 * @module editDataSetData
 * @description Provides a tool to edit an existing row of data in a specific dataset in the Xibo CMS.
 */
import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { dataSetDataSchema } from "./schemas";
import { logger } from "../../../index";
import { decodeErrorMessage, processError } from "../utility/error";

// Schema for a successful response. The API returns an empty object on success.
const successResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({}).optional(),
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
 * Tool for editing an existing row of data in a dataset.
 */
export const editDataSetData = createTool({
  id: "edit-data-set-data",
  description: "Edits an existing row of data in a specified dataset.",
  inputSchema: z.object({
    dataSetId: z.number().describe("The ID of the dataset where the row belongs."),
    rowId: z.number().describe("The ID of the data row to edit."),
    rowData: z.array(z.object({
      columnId: z.number().describe("The ID of the dataset column to update."),
      value: z.any().describe("The new value for the column."),
    })).describe("An array of objects, each representing a column's new data."),
  }),
  outputSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      const message = "CMS URL is not configured.";
      logger.error(message);
      return { success: false as const, message };
    }

    const { dataSetId, rowId, rowData } = context;
    const url = new URL(`${config.cmsUrl}/api/dataset/data/${dataSetId}/${rowId}`);

    try {
      const params = new URLSearchParams();
      rowData.forEach(item => {
        // The API expects keys in the format 'dataSetColumnId_{ID}'
        params.append(`dataSetColumnId_${item.columnId}`, String(item.value));
      });
      
      logger.info({ url: url.toString(), params: params.toString() }, `Attempting to edit data row ${rowId} in dataset ID: ${dataSetId}`);

      const response = await fetch(url.toString(), {
        method: "PUT",
        headers: {
          ...await getAuthHeaders(),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
      });

      const responseData = await response.json();

      if (!response.ok) {
        const decodedError = decodeErrorMessage(responseData);
        const message = `Failed to edit dataset data. API responded with status ${response.status}.`;
        logger.error({ status: response.status, response: decodedError }, message);
        return { success: false as const, message, errorData: decodedError };
      }

      // The API returns an empty object on success, so we don't validate against a schema.
      logger.info({ rowId, dataSetId }, `Successfully submitted edits for data row ${rowId} in dataset ID: ${dataSetId}.`);
      return {
        success: true as const,
        data: responseData,
      };
    } catch (error) {
      const message = "An unexpected error occurred while editing the dataset data.";
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