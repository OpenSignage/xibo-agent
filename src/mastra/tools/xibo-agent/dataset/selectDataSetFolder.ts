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
 * @module selectDataSetFolder
 * @description Provides a tool to move a dataset to a different folder in the Xibo CMS.
 */
import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { dataSetSchema } from "./schemas";
import { logger } from "../../../index";
import { decodeErrorMessage, processError } from "../utility/error";

// Schema for a successful response, containing the updated dataset.
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
 * Tool for assigning a dataset to a different folder.
 */
export const selectDataSetFolder = createTool({
  id: "select-data-set-folder",
  description: "Moves a dataset to a different folder.",
  inputSchema: z.object({
    dataSetId: z.number().describe("The ID of the dataset to move."),
    folderId: z.number().describe("The ID of the destination folder."),
  }),
  outputSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      const message = "CMS URL is not configured.";
      logger.error(message);
      return { success: false as const, message };
    }

    const { dataSetId, folderId } = context;
    const url = new URL(`${config.cmsUrl}/api/dataset/${dataSetId}/selectfolder`);

    try {
      logger.info({ url: url.toString(), context }, `Attempting to move dataset ${dataSetId} to folder ${folderId}`);

      const params = new URLSearchParams();
      params.append("folderId", String(folderId));

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
        const message = `Failed to select folder for dataset. API responded with status ${response.status}.`;
        logger.error({ status: response.status, response: decodedError }, message);
        return { success: false as const, message, errorData: decodedError };
      }

      const validationResult = dataSetSchema.safeParse(responseData);

      if (!validationResult.success) {
        const message = "Select dataset folder response validation failed.";
        logger.error({ error: validationResult.error.flatten(), data: responseData }, message);
        return {
          success: false as const,
          message,
          error: validationResult.error.flatten(),
          errorData: responseData,
        };
      }
      
      logger.info({ dataSetId, folderId }, `Successfully moved dataset ${dataSetId} to folder ${folderId}.`);
      return {
        success: true as const,
        data: validationResult.data,
      };
    } catch (error) {
      const message = "An unexpected error occurred while selecting the dataset folder.";
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