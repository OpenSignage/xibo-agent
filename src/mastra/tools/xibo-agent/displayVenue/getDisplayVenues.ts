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
 * It implements the /api/displayvenue endpoint.
 */
import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../logger";
import { decodeErrorMessage, processError } from "../utility/error";

/**
 * Defines the schema for a single display venue object, based on the Xibo API.
 */
const displayVenueSchema = z.object({
  venueId: z.number().describe("The unique ID of the venue."),
  venueName: z.string().describe("The name of the venue."),
});

/**
 * Defines the schema for a successful response, containing an array of display venues.
 */
const successResponseSchema = z.object({
  success: z.literal(true),
  data: z
    .array(displayVenueSchema)
    .describe("An array of display venue records."),
});

/**
 * Defines the schema for a generic error response.
 */
const errorResponseSchema = z.object({
  success: z.literal(false),
  message: z.string().describe("A human-readable error message."),
  error: z
    .any()
    .optional()
    .describe("Optional technical details about the error."),
  errorData: z
    .any()
    .optional()
    .describe("Optional raw error data returned from the API."),
});

/**
 * A tool for retrieving all display venues from the Xibo CMS.
 */
export const getDisplayVenues = createTool({
  id: "get-display-venues",
  description: "Retrieves a list of all display venues available in the Xibo CMS.",
  inputSchema: z.object({}).describe("This tool does not require any input parameters."),
  outputSchema: z.union([successResponseSchema, errorResponseSchema]),
  execute: async (): Promise<
    z.infer<typeof successResponseSchema> | z.infer<typeof errorResponseSchema>
  > => {
    if (!config.cmsUrl) {
      const message = "CMS URL is not configured.";
      logger.error(message);
      return {
        success: false,
        message,
      };
    }

    const url = new URL(`${config.cmsUrl}/api/displayvenue`);
    
    try {
      logger.info({ url: url.toString() }, "Requesting all display venues from Xibo CMS.");

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: await getAuthHeaders(),
      });

      const responseData = await response.json();

      if (!response.ok) {
        const decodedError = decodeErrorMessage(responseData);
        const message = `Failed to get display venues. API responded with status ${response.status}.`;
        logger.error({ status: response.status, response: decodedError }, message);
        return {
          success: false,
          message,
          errorData: decodedError,
        };
      }

      const validationResult = z.array(displayVenueSchema).safeParse(responseData);

      if (!validationResult.success) {
        const message = "Display venues response validation failed.";
        logger.error({ error: validationResult.error.flatten(), data: responseData }, message);
        return {
          success: false,
          message,
          error: validationResult.error.flatten(),
          errorData: responseData,
        };
      }

      logger.info({ count: validationResult.data.length }, `Successfully retrieved ${validationResult.data.length} display venue records.`);
      return {
        success: true,
        data: validationResult.data,
      };
    } catch (error) {
        const message = "An unexpected error occurred while getting display venues.";
        const processedError = processError(error);
        logger.error({ error: processedError }, message);
        return {
            success: false,
            message,
            error: processedError,
        };
    }
  },
}); 