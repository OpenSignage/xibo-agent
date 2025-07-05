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
 * @module editDataSetConnector
 * @description Provides a tool to edit the data connector for a dataset in the Xibo CMS.
 */
import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../index";
import { decodeErrorMessage } from "../utility/error";
import { dataSetConnectorSchema } from "./schemas";

/**
 * Schema for the tool's output, covering success and failure cases.
 */
const outputSchema = z.union([
  z.object({
    success: z.literal(true),
    data: dataSetConnectorSchema,
  }),
  z.object({
    success: z.literal(false),
    message: z.string(),
    error: z.any().optional(),
    errorData: z.any().optional(),
  }),
]);

/**
 * Tool for editing a dataset's data connector.
 */
export const editDataSetConnector = createTool({
  id: "edit-data-set-connector",
  description: "Edit the data connector for a dataset.",
  inputSchema: z.object({
    dataSetId: z.number().describe("The ID of the dataset."),
    dataConnectorScript: z.string().describe("If isRealTime then provide a script to connect to the data source."),
  }),
  outputSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      const message = "CMS URL is not configured.";
      logger.error(message);
      return { success: false as const, message };
    }

    const { dataSetId, dataConnectorScript } = context;
    const url = new URL(`${config.cmsUrl}/api/dataset/dataconnector/${dataSetId}`);
    logger.info(`Editing data connector for dataset ID: ${dataSetId}`);

    try {
      const params = new URLSearchParams();
      params.append('dataConnectorScript', dataConnectorScript);

      const response = await fetch(url.toString(), {
        method: "PUT",
        headers: {
          ...await getAuthHeaders(),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params,
      });

      const responseData = await response.json();

      if (!response.ok) {
        const decodedError = decodeErrorMessage(responseData);
        const message = `Failed to edit data connector. API responded with status ${response.status}.`;
        logger.error(message, { response: decodedError });
        return { success: false as const, message, errorData: decodedError };
      }

      const validationResult = dataSetConnectorSchema.safeParse(responseData);

      if (!validationResult.success) {
        const message = "Edit data connector response validation failed.";
        logger.error(message, { error: validationResult.error, data: responseData });
        return {
          success: false as const,
          message,
          error: validationResult.error,
          errorData: responseData,
        };
      }

      return {
        success: true as const,
        data: validationResult.data,
      };

    } catch (error) {
      const message = "An unexpected error occurred while editing data connector.";
      logger.error(message, { error });
      return {
        success: false as const,
        message,
        error: error instanceof Error ? { name: error.name, message: error.message } : error,
      };
    }
  },
}); 