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
 * @module copyDataSet
 * @description Provides a tool to copy an existing dataset in the Xibo CMS,
 * creating a new dataset with a new name and optional properties.
 */
import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { dataSetSchema } from "./schemas";
import { logger } from "../../../index";
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
 * Tool for copying an existing dataset to a new one.
 */
export const copyDataSet = createTool({
  id: "copy-data-set",
  description: "Copies an existing dataset, creating a new one with a specified name and optional properties.",
  inputSchema: z.object({
    dataSetId: z.number().describe("The ID of the dataset to copy. Required."),
    dataSet: z.string().describe("The name for the new, copied dataset. Required."),
    description: z.string().optional().describe("An optional description for the new dataset."),
    code: z.string().optional().describe("An optional code for the new dataset."),
    copyRows: z.number().min(0).max(1).optional().describe("Flag to indicate whether to copy all data rows from the source dataset (1 for yes, 0 for no)."),
  }),
  outputSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      const message = "CMS URL is not configured.";
      logger.error(message);
      return { success: false as const, message };
    }

    const { dataSetId, ...rest } = context;
    const url = new URL(`${config.cmsUrl}/api/dataset/copy/${dataSetId}`);
    
    try {
      logger.info({ url: url.toString(), context: rest }, `Attempting to copy dataset ID ${dataSetId} to '${context.dataSet}'`);

      const params = new URLSearchParams();
      Object.entries(rest).forEach(([key, value]) => {
        if (value !== undefined) {
            params.append(key, String(value));
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
        const message = `Failed to copy dataset. API responded with status ${response.status}.`;
        logger.error({ status: response.status, response: decodedError }, message);
        return { success: false as const, message, errorData: decodedError };
      }

      const validationResult = dataSetSchema.safeParse(responseData);

      if (!validationResult.success) {
        const message = "Copied dataset response validation failed.";
        logger.error({ error: validationResult.error.flatten(), data: responseData }, message);
        return {
          success: false as const,
          message,
          error: validationResult.error.flatten(),
          errorData: responseData,
        };
      }
      
      logger.info({ newDataSetId: validationResult.data.dataSetId }, `Successfully copied dataset to '${validationResult.data.dataSet}'.`);
      return {
        success: true as const,
        data: validationResult.data,
      };
    } catch (error) {
      const message = "An unexpected error occurred while copying the dataset.";
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