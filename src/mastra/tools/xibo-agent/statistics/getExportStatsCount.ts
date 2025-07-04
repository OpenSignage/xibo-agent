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
 * @module getExportStatsCount
 * @description Provides a tool to retrieve the count of statistics records that can be exported
 * from the Xibo CMS, based on specified filters.
 */
import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../index";
import { decodeErrorMessage } from "../utility/error";

/**
 * Schema for the tool's output.
 */
const outputSchema = z.union([
  z.object({
    success: z.literal(true),
    data: z.number(),
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
 * A tool for retrieving the count of exportable statistics records.
 * This is useful for understanding the volume of data before performing a full export.
 */
export const getExportStatsCount = createTool({
  id: "get-export-stats-count",
  description: "Get the count of statistics data records for export.",
  inputSchema: z.object({
    fromDt: z
      .string()
      .optional()
      .describe("The start date for the filter (e.g., 'YYYY-MM-DD HH:MM:SS')."),
    toDt: z
      .string()
      .optional()
      .describe("The end date for the filter (e.g., 'YYYY-MM-DD HH:MM:SS')."),
    displayId: z
      .number()
      .optional()
      .describe("Filter by a single Display ID."),
  }),
  outputSchema,
  execute: async ({ context }) => {
    // Ensure the CMS URL is configured before proceeding.
    if (!config.cmsUrl) {
      const message = "CMS URL is not configured.";
      logger.error(message);
      return {
        success: false as const,
        message: message,
      };
    }

    // Construct the API endpoint URL for getting the export stats count.
    const url = new URL(`${config.cmsUrl}/api/stats/getExportStatsCount`);

    // Helper function to append a query parameter to the URL only if it has a value.
    const appendIfExists = (key: string, value: any) => {
      if (value !== undefined && value !== null) {
        const stringValue = String(value);
        if (stringValue !== "") {
          url.searchParams.append(key, stringValue);
        }
      }
    };

    // Dynamically build the query string from the tool's input context.
    appendIfExists("fromDt", context.fromDt);
    appendIfExists("toDt", context.toDt);
    appendIfExists("displayId", context.displayId);

    logger.info(`Requesting export stats count from: ${url.toString()}`);

    try {
      // Perform the GET request to the Xibo CMS API.
      const response = await fetch(url.toString(), {
        method: "GET",
        headers: await getAuthHeaders(),
      });

      // Read the response body as text to handle various response formats.
      const responseText = await response.text();
      let responseData: any;

      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        responseData = responseText;
      }

      // Handle non-successful HTTP responses.
      if (!response.ok) {
        const decodedText = decodeErrorMessage(responseText);
        const message = `Failed to get export stats count. API responded with status ${response.status}.`;
        logger.error(message, {
          status: response.status,
          response: decodedText,
        });
        return {
          success: false as const,
          message: message,
          errorData: responseData,
        };
      }

      // The API is expected to return a single number for the count.
      // Validate that the response data is a number.
      const validationResult = z.number().safeParse(responseData);

      if (!validationResult.success) {
        const message = "Export stats count response validation failed.";
        logger.error(message, {
          error: validationResult.error.issues,
          data: responseData,
        });
        return {
          success: false as const,
          message: message,
          error: validationResult.error,
          errorData: responseData,
        };
      }

      // On success, log and return the validated count.
      const message = `Successfully retrieved export stats count: ${validationResult.data}`;
      logger.info(message);
      return {
        success: true as const,
        data: validationResult.data,
        message: message,
      };
    } catch (error) {
      const message = "An unexpected error occurred while getting the export stats count.";
      logger.error(message, { error });
      return {
        success: false as const,
        message,
        error: error instanceof Error ? { name: error.name, message: error.message } : error,
      };
    }
  },
});

export default getExportStatsCount; 