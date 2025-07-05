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
 * @description Provides a tool to edit an existing row of data in a dataset in the Xibo CMS.
 */
import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { dataSetDataSchema } from "./schemas";
import { logger } from "../../../index";
import { decodeErrorMessage } from "../utility/error";

/**
 * Schema for the tool's output, covering success and failure cases.
 */
const outputSchema = z.union([
  z.object({
    success: z.literal(true),
    data: dataSetDataSchema,
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
 * Tool for editing an existing row of data in a dataset.
 */
export const editDataSetData = createTool({
  id: "edit-data-set-data",
  description: "Edit an existing row of data in a dataset.",
  inputSchema: z.object({
    dataSetId: z.number().describe("The ID of the dataset the data belongs to."),
    rowId: z.number().describe("The ID of the data row to edit."),
    rowData: z.array(z.object({
      key: z.string().describe("The column heading."),
      value: z.any().describe("The new value for the column."),
    })).describe("An array of key-value pairs representing the new row data."),
  }),
  outputSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      const message = "CMS URL is not configured.";
      logger.error(message);
      return { success: false as const, message };
    }

    const { dataSetId, rowId, rowData } = context;
    const url = new URL(`${config.cmsUrl}/api/dataset/${dataSetId}/data/${rowId}`);
    logger.info(`Attempting to edit data row ${rowId} in dataset ID: ${dataSetId}`);

    try {
      const params = new URLSearchParams();
      rowData.forEach(item => {
        // The API expects keys in the format 'colName[colHeading]'
        params.append(`colName[${item.key}]`, String(item.value));
      });

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
        logger.error(message, { response: decodedError });
        return { success: false as const, message, errorData: decodedError };
      }

      const validationResult = dataSetDataSchema.safeParse(responseData);

      if (!validationResult.success) {
        const message = "Edited dataset data response validation failed.";
        logger.error(message, { error: validationResult.error, data: responseData });
        return {
          success: false as const,
          message,
          error: validationResult.error,
          errorData: responseData,
        };
      }
      
      const message = `Successfully edited data row ${rowId} in dataset ID: ${dataSetId}.`;
      logger.info(message);
      return {
        success: true as const,
        data: validationResult.data,
        message,
      };
    } catch (error) {
      const message = "An unexpected error occurred while editing the dataset data.";
      logger.error(message, { error });
      return {
        success: false as const,
        message,
        error: error instanceof Error ? { name: error.name, message: error.message } : error,
      };
    }
  },
}); 