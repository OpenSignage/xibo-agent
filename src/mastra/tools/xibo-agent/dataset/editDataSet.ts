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
 * @module editDataSet
 * @description Provides a tool to edit an existing dataset in the Xibo CMS.
 */
import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { dataSetSchema } from "./schemas";
import { logger } from "../../../index";
import { decodeErrorMessage } from "../utility/error";

/**
 * Schema for the tool's output, covering success and failure cases.
 */
const outputSchema = z.union([
  z.object({
    success: z.literal(true),
    data: dataSetSchema,
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
 * Tool for editing an existing dataset.
 */
export const editDataSet = createTool({
  id: "edit-data-set",
  description: "Edit an existing dataset.",
  inputSchema: z.object({
    dataSetId: z.number().describe("The ID of the dataset to edit."),
    dataSet: z.string().optional().describe("A new name for the dataset."),
    description: z.string().optional().describe("A new description for the dataset."),
    code: z.string().optional().describe("A new code for filtering."),
  }),
  outputSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      const message = "CMS URL is not configured.";
      logger.error(message);
      return { success: false as const, message };
    }

    const { dataSetId, ...rest } = context;
    const url = new URL(`${config.cmsUrl}/api/dataset/${dataSetId}`);
    logger.info(`Attempting to edit dataset ID: ${dataSetId}`);

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
        const message = `Failed to edit dataset. API responded with status ${response.status}.`;
        logger.error(message, { response: decodedError });
        return { success: false as const, message, errorData: decodedError };
      }

      const validationResult = dataSetSchema.safeParse(responseData);

      if (!validationResult.success) {
        const message = "Edited dataset response validation failed.";
        logger.error(message, { error: validationResult.error, data: responseData });
        return {
          success: false as const,
          message,
          error: validationResult.error,
          errorData: responseData,
        };
      }
      
      const message = `Successfully edited dataset: ${validationResult.data.dataSet}`;
      logger.info(message, { dataSetId: validationResult.data.dataSetId });
      return {
        success: true as const,
        data: validationResult.data,
        message,
      };
    } catch (error) {
      const message = "An unexpected error occurred while editing the dataset.";
      logger.error(message, { error });
      return {
        success: false as const,
        message,
        error: error instanceof Error ? { name: error.name, message: error.message } : error,
      };
    }
  },
}); 