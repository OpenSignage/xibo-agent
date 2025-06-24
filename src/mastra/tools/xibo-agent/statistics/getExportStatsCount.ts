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
 * Defines the schema for a successful response, containing the count and a success flag.
 */
const successSchema = z.object({
  success: z.literal(true),
  data: z.number().describe("The total count of exportable stats."),
});

/**
 * Defines the schema for a failed operation, including a success flag, a message, and optional error details.
 */
const errorSchema = z.object({
  success: z.literal(false),
  message: z.string().describe("A human-readable error message."),
  error: z
    .any()
    .optional()
    .describe("Optional technical details about the error."),
});

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
  outputSchema: z
    .union([successSchema, errorSchema])
    .describe("The result of the get operation."),
  execute: async ({
    context,
  }): Promise<z.infer<typeof successSchema> | z.infer<typeof errorSchema>> => {
    // Ensure the CMS URL is configured before proceeding.
    if (!config.cmsUrl) {
      const errorMessage = "CMS URL is not configured.";
      logger.error(errorMessage);
      return {
        success: false,
        message: errorMessage,
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
      const errorMessage = `Failed to get export stats count. API responded with status ${response.status}.`;
      logger.error(errorMessage, {
        status: response.status,
        response: decodedText,
      });
      return {
        success: false,
        message: `${errorMessage} Message: ${decodedText}`,
        error: {
          statusCode: response.status,
          responseBody: responseData,
        },
      };
    }

    // The API is expected to return a single number for the count.
    // Validate that the response data is a number.
    const validationResult = z.number().safeParse(responseData);

    if (!validationResult.success) {
      const errorMessage = "Export stats count response validation failed.";
      logger.error(errorMessage, {
        error: validationResult.error.issues,
        data: responseData,
      });
      return {
        success: false,
        message: errorMessage,
        error: {
          validationIssues: validationResult.error.issues,
          receivedData: responseData,
        },
      };
    }

    // On success, log and return the validated count.
    logger.info(
      `Successfully retrieved export stats count: ${validationResult.data}`
    );
    return {
      success: true,
      data: validationResult.data,
    };
  },
});

export default getExportStatsCount; 