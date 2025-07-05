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
 * @module addDataSetColumn
 * @description Provides a tool to add a new column to a dataset in the Xibo CMS.
 */
import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { dataSetColumnSchema } from "./schemas";
import { logger } from "../../../index";
import { decodeErrorMessage } from "../utility/error";

/**
 * Schema for the tool's output, which can be a success or failure response.
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
 * Tool for adding a new column to a dataset.
 */
export const addDataSetColumn = createTool({
  id: "add-data-set-column",
  description: "Add a new column to a dataset.",
  inputSchema: z.object({
    dataSetId: z.number().describe("The ID of the dataset to add the column to."),
    heading: z.string().describe("The heading for the new column."),
    dataTypeId: z.number().describe("The ID of the data type for the new column. (1:String, 2:Number, 3:Date, 4:External Image, 5:library Image, 6:HTML)"),
    columnOrder: z.number().describe("The display order for this column."),
    dataSetColumnTypeId: z.number().optional().describe("The column type for this column.(1:Value, 2:Formula, 3:Remote)"),
    listContent: z.string().optional().describe("A comma-separated list of content for drop-downs."),
    formula: z.string().optional().describe("A formula to calculate the column's value (MySQL SELECT syntax)."),
    remoteField: z.string().optional().describe("JSON-String to select Data from the Remote DataSet."),
    showFilter: z.number().optional().describe("Flag to show a filter for this column (0 or 1)."),
    showSort: z.number().optional().describe("Flag to enable sorting for this column (0 or 1)."),
    tooltip: z.string().optional().describe("Help text to be displayed when entering data for this column."),
    isRequired: z.number().optional().describe("Flag indicating whether a value must be provided for this column (0 or 1)."),
    dateFormat: z.string().optional().describe("PHP date format for dates in the remote DataSet source."),
  }),
  outputSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      const message = "CMS URL is not configured.";
      logger.error(message);
      return { success: false as const, message };
    }

    const { dataSetId, ...rest } = context;
    const url = new URL(`${config.cmsUrl}/api/dataset/${dataSetId}/column`);
    logger.info(`Attempting to add column to dataset ID: ${dataSetId}`);

    try {
      const params = new URLSearchParams();
      Object.entries(rest).forEach(([key, value]) => {
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
        const message = `Failed to add dataset column. API responded with status ${response.status}.`;
        logger.error(message, { response: decodedError });
        return { success: false as const, message, errorData: decodedError };
      }

      const validationResult = dataSetColumnSchema.safeParse(responseData);

      if (!validationResult.success) {
        const message = "Dataset column response validation failed.";
        logger.error(message, { error: validationResult.error, data: responseData });
        return {
          success: false as const,
          message,
          error: validationResult.error,
          errorData: responseData,
        };
      }
      
      const message = `Successfully added column '${validationResult.data.heading}' to dataset.`;
      logger.info(message, { dataSetColumnId: validationResult.data.dataSetColumnId });
      return {
        success: true as const,
        data: validationResult.data,
      };
    } catch (error) {
      const message = "An unexpected error occurred while adding the dataset column.";
      logger.error(message, { error });
      return {
        success: false as const,
        message,
        error: error instanceof Error ? { name: error.name, message: error.message } : error,
      };
    }
  },
}); 