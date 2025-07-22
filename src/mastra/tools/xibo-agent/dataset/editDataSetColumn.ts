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
import { logger } from "../../../logger";
import { decodeErrorMessage, processError } from "../utility/error";

// Schema for a successful response, containing the edited dataset column.
const successResponseSchema = z.object({
  success: z.literal(true),
  data: dataSetColumnSchema,
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
 * Tool for editing an existing column in a dataset.
 */
export const editDataSetColumn = createTool({
  id: "edit-data-set-column",
  description: "Edits an existing column in a specified dataset.",
  inputSchema: z.object({
    dataSetId: z.number().describe("The ID of the dataset the column belongs to. Required."),
    dataSetColumnId: z.number().describe("The ID of the column to edit. Required."),
    heading: z.string().describe("A new heading for the column. Required by API."),
    columnOrder: z.number().describe("A new display order for the column. Required by API."),
    dataTypeId: z.number().describe("A new data type ID for the column (e.g., 1 for String). Required by API."),
    dataSetColumnTypeId: z.number().describe("A new column type ID for this column (e.g., 1 for Value). Required by API."),
    showFilter: z.number().min(0).max(1).describe("Flag to show a filter for this column (1 for yes, 0 for no). Required by API."),
    showSort: z.number().min(0).max(1).describe("Flag to enable sorting for this column (1 for yes, 0 for no). Required by API."),
    listContent: z.string().optional().describe("For dropdown types, a new comma-separated list of values."),
    formula: z.string().optional().describe("For formula types, a new MySQL SELECT syntax formula."),
    remoteField: z.string().optional().describe("For remote types, a new JSON-String to select data from the remote source."),
    tooltip: z.string().optional().describe("New help text to be displayed when entering data."),
    isRequired: z.number().min(0).max(1).optional().describe("Flag if a value must be provided (1 for yes, 0 for no)."),
    dateFormat: z.string().optional().describe("For remote date types, a new PHP date format string."),
  }),
  outputSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      const message = "CMS URL is not configured.";
      logger.error(message);
      return { success: false as const, message };
    }

    const { dataSetId, dataSetColumnId, ...rest } = context;
    const url = new URL(`${config.cmsUrl}/api/dataset/${dataSetId}/column/${dataSetColumnId}`);
    
    try {
      logger.info({ url: url.toString(), context: rest }, `Attempting to edit column ${dataSetColumnId} in dataset ID: ${dataSetId}`);

      const params = new URLSearchParams();
      Object.entries(rest).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
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
        logger.error({ status: response.status, response: decodedError }, message);
        return { success: false as const, message, errorData: decodedError };
      }

      const validationResult = dataSetColumnSchema.safeParse(responseData);

      if (!validationResult.success) {
        const message = "Edited dataset column response validation failed.";
        logger.error({ error: validationResult.error.flatten(), data: responseData }, message);
        return {
          success: false as const,
          message,
          error: validationResult.error.flatten(),
          errorData: responseData,
        };
      }
      
      logger.info({ dataSetColumnId: validationResult.data.dataSetColumnId }, `Successfully edited column: ${validationResult.data.heading}`);
      return {
        success: true as const,
        data: validationResult.data,
      };
    } catch (error) {
      const message = "An unexpected error occurred while editing the dataset column.";
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