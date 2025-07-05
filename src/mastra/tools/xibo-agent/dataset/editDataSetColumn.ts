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
 * @module editDataSetColumn
 * @description Provides a tool to edit an existing column in a dataset in the Xibo CMS.
 */
import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { dataSetColumnSchema } from "./schemas";
import { logger } from "../../../index";
import { decodeErrorMessage } from "../utility/error";

/**
 * Schema for the tool's output, covering success and failure cases.
 */
const outputSchema = z.union([
  z.object({
    success: z.literal(true),
    data: dataSetColumnSchema,
  }),
  z.object({
    success: z.literal(false),
    message: z.string(),
    error: z.any().optional(),
    errorData: z.any().optional(),
  }),
]);

/**
 * Tool for editing an existing dataset column.
 */
export const editDataSetColumn = createTool({
  id: "edit-data-set-column",
  description: "Edit an existing column in a dataset.",
  inputSchema: z.object({
    dataSetId: z.number().describe("The ID of the dataset the column belongs to."),
    columnId: z.number().describe("The ID of the column to edit."),
    heading: z.string().optional().describe("A new heading for the column."),
    dataTypeId: z.number().optional().describe("A new data type ID for the column. (1:String, 2:Number, 3:Date, 4:External Image, 5:library Image, 6:HTML)"),
    dataSetColumnTypeId: z.number().optional().describe("A new column type ID for this column. (1:Value, 2:Formula, 3:Remote)"),
    listContent: z.string().optional().describe("New comma-separated list of content for drop-downs."),
    columnOrder: z.number().optional().describe("A new display order for the column."),
    formula: z.string().optional().describe("A new formula to calculate the column's value (MySQL SELECT syntax)."),
    remoteField: z.string().optional().describe("A new JSON-String to select Data from the Remote DataSet."),
    showFilter: z.number().optional().describe("Flag to show a filter for this column (0 or 1)."),
    showSort: z.number().optional().describe("Flag to enable sorting for this column (0 or 1)."),
    tooltip: z.string().optional().describe("New help text to be displayed when entering data for this column."),
    isRequired: z.number().optional().describe("Flag indicating whether a value must be provided for this column (0 or 1)."),
    dateFormat: z.string().optional().describe("New PHP date format for dates in the remote DataSet source."),
  }),
  outputSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      const message = "CMS URL is not configured.";
      logger.error(message);
      return { success: false as const, message };
    }

    const { dataSetId, columnId, ...rest } = context;
    const url = new URL(`${config.cmsUrl}/api/dataset/${dataSetId}/column/${columnId}`);
    logger.info(`Attempting to edit column ${columnId} in dataset ID: ${dataSetId}`);

    try {
      const params = new URLSearchParams();
      Object.entries(rest).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
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
        const message = `Failed to edit dataset column. API responded with status ${response.status}.`;
        logger.error(message, { response: decodedError });
        return { success: false as const, message, errorData: decodedError };
      }

      const validationResult = dataSetColumnSchema.safeParse(responseData);

      if (!validationResult.success) {
        const message = "Edited dataset column response validation failed.";
        logger.error(message, { error: validationResult.error, data: responseData });
        return {
          success: false as const,
          message,
          error: validationResult.error,
          errorData: responseData,
        };
      }
      
      const message = `Successfully edited column: ${validationResult.data.heading}`;
      logger.info(message, { dataSetColumnId: validationResult.data.dataSetColumnId });
      return {
        success: true as const,
        data: validationResult.data,
      };
    } catch (error) {
      const message = "An unexpected error occurred while editing the dataset column.";
      logger.error(message, { error });
      return {
        success: false as const,
        message,
        error: error instanceof Error ? { name: error.name, message: error.message } : error,
      };
    }
  },
}); 