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
 * @module getDataSets
 * @description Provides a tool to retrieve a list of datasets from the Xibo CMS, with optional filtering.
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
 * The success data is an array of datasets.
 */
const outputSchema = z.union([
  z.object({
    success: z.literal(true),
    data: z.array(dataSetSchema),
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
 * Tool for retrieving a list of datasets.
 */
export const getDataSets = createTool({
  id: "get-data-sets",
  description: "Get a list of datasets, with optional filtering.",
  inputSchema: z.object({
    dataSetId: z.number().optional().describe("Filter by a specific dataset ID."),
    dataSet: z.string().optional().describe("Filter by dataset name (or part of the name)."),
    code: z.string().optional().describe("Filter by dataset code."),
  }),
  outputSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      const message = "CMS URL is not configured.";
      logger.error(message);
      return { success: false as const, message };
    }

    const url = new URL(`${config.cmsUrl}/api/dataset`);
    const params = new URLSearchParams();
    if (context.dataSetId) params.append("dataSetId", context.dataSetId.toString());
    if (context.dataSet) params.append("dataSet", context.dataSet);
    if (context.code) params.append("code", context.code);
    url.search = params.toString();
    
    logger.info(`Requesting datasets from URL: ${url.toString()}`);

    try {
      const response = await fetch(url.toString(), {
        method: "GET",
        headers: await getAuthHeaders(),
      });

      const responseData = await response.json();

      if (!response.ok) {
        const decodedError = decodeErrorMessage(responseData);
        const message = `Failed to retrieve datasets. API responded with status ${response.status}.`;
        logger.error(message, { response: decodedError });
        return { success: false as const, message, errorData: decodedError };
      }

      const validationResult = z.array(dataSetSchema).safeParse(responseData);

      if (!validationResult.success) {
        const message = "Datasets response validation failed.";
        logger.error(message, { error: validationResult.error, data: responseData });
        return {
          success: false as const,
          message,
          error: validationResult.error,
          errorData: responseData,
        };
      }
      
      const message = `Successfully retrieved ${validationResult.data.length} datasets.`;
      logger.info(message);
      return {
        success: true as const,
        data: validationResult.data,
        message,
      };
    } catch (error) {
      const message = "An unexpected error occurred while retrieving datasets.";
      logger.error(message, { error });
      return {
        success: false as const,
        message,
        error: error instanceof Error ? { name: error.name, message: error.message } : error,
      };
    }
  },
}); 