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
 * @module getTimeDisconnected
 * @description Provides a tool to retrieve statistics on disconnection times for displays from the Xibo CMS.
 * It implements the time disconnected API endpoint and handles validation and error handling.
 */
import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../index";
import { decodeErrorMessage } from "../utility/error";

/**
 * Defines the schema for a single "time disconnected" record.
 * This ensures that the data received from the Xibo API conforms to the expected structure.
 */
const timeDisconnectedSchema = z.object({
  display: z.string().describe("The name of the display."),
  displayId: z.number().describe("The unique ID of the display."),
  duration: z
    .number()
    .describe("The duration of the disconnection in seconds."),
  start: z
    .string()
    .describe("The start date and time of the disconnection period."),
  end: z.string().describe("The end date and time of the disconnection period."),
  isFinished: z
    .boolean()
    .describe("Indicates whether the disconnection period has finished."),
});

/**
 * Defines the schema for a successful response, containing an array of disconnection records and a success flag.
 */
const successSchema = z.object({
  success: z.literal(true),
  data: z
    .array(timeDisconnectedSchema)
    .describe("An array of time disconnected statistics records."),
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
 * A tool for retrieving statistics about the time displays have been disconnected.
 * It allows filtering by date range and specific display IDs.
 */
export const getTimeDisconnected = createTool({
  id: "get-time-disconnected",
  description: "Get statistics on the time displays have been disconnected.",
  inputSchema: z.object({
    fromDt: z.string().describe("The start date for the filter."),
    toDt: z.string().describe("The end date for the filter."),
    displayId: z
      .number()
      .optional()
      .describe("An optional display Id to filter."),
    displayIds: z
      .array(z.number())
      .optional()
      .describe("An optional array of display Id to filter."),
    returnDisplayLocalTime: z
      .boolean()
      .optional()
      .describe(
        "Return results in the display's local time. Accepts true, 1, or 'On'."
      ),
    returnDateFormat: z
      .string()
      .optional()
      .describe(
        "A PHP-style date format for how the returned dates should be formatted."
      ),
  }),
  outputSchema: z
    .union([successSchema, errorSchema])
    .describe("An array of time disconnected statistics records."),
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

    // Construct the API endpoint URL. Note the specific path for this statistic.
    const url = new URL(`${config.cmsUrl}/api/stats/timeDisconnected`);

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
    appendIfExists("displayIds", context.displayIds);
    appendIfExists("returnDisplayLocalTime", context.returnDisplayLocalTime);
    appendIfExists("returnDateFormat", context.returnDateFormat);

    logger.info(`Requesting time disconnected stats from: ${url.toString()}`);

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
      const errorMessage = `Failed to get time disconnected stats. API responded with status ${response.status}.`;
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

    // Validate the structure of the successful response data.
    const validationResult =
      z.array(timeDisconnectedSchema).safeParse(responseData);

    if (!validationResult.success) {
      const errorMessage = "Time disconnected response validation failed.";
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

    // On success, log and return the validated data.
    logger.info(
      `Successfully retrieved ${validationResult.data.length} time disconnected records.`
    );
    return {
      success: true,
      data: validationResult.data,
    };
  },
});

export default getTimeDisconnected; 