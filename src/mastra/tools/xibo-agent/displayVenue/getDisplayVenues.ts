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
 * @module getDisplayVenues
 * @description Provides a tool to retrieve all display venues from the Xibo CMS.
 * It implements the /api/displayvenue endpoint and handles the necessary validation
 * and error handling.
 */
import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../index";
import { decodeErrorMessage } from "../utility/error";

/**
 * Defines the schema for a single display venue.
 * This ensures that data received from the Xibo API conforms to the expected structure.
 */
const displayVenueSchema = z.object({
  venueId: z.number().describe("The unique ID of the venue."),
  venueName: z.string().describe("The name of the venue."),
});

/**
 * Defines the schema for a successful response.
 */
const successSchema = z.object({
  success: z.literal(true),
  data: z
    .array(displayVenueSchema)
    .describe("An array of display venue records."),
});

/**
 * Defines the schema for a failed operation.
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
 * A tool for retrieving all display venues from the Xibo CMS.
 */
export const getDisplayVenues = createTool({
  id: "get-display-venues",
  description: "Retrieve all display venues.",
  inputSchema: z.object({
    _placeholder: z
      .string()
      .optional()
      .describe("This tool does not require input parameters"),
  }),
  outputSchema: z.union([successSchema, errorSchema]),
  execute: async (): Promise<
    z.infer<typeof successSchema> | z.infer<typeof errorSchema>
  > => {
    if (!config.cmsUrl) {
      const errorMessage = "CMS URL is not configured.";
      logger.error(`getDisplayVenues: ${errorMessage}`);
      return {
        success: false,
        message: errorMessage,
      };
    }

    const url = `${config.cmsUrl}/api/displayvenue`;
    logger.info(`Requesting all display venues from: ${url}`);

    const response = await fetch(url, {
      method: "GET",
      headers: await getAuthHeaders(),
    });

    const responseText = await response.text();
    let responseData: any;
    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      responseData = responseText;
    }

    if (!response.ok) {
      const decodedText = decodeErrorMessage(responseText);
      const errorMessage = `Failed to get display venues. API responded with status ${response.status}.`;
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

    const validationResult = z.array(displayVenueSchema).safeParse(responseData);

    if (!validationResult.success) {
      const errorMessage = "Display venues response validation failed.";
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

    logger.info(
      `Successfully retrieved ${validationResult.data.length} display venue records.`
    );
    return {
      success: true,
      data: validationResult.data,
    };
  },
});

export default getDisplayVenues; 