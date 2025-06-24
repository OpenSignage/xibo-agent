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
 * Font Details Retrieval Tool
 * 
 * This module provides functionality to retrieve detailed information about 
 * a specific font from the Xibo CMS. It implements the API endpoint for font details 
 * and includes robust error handling and response validation.
 */

import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../index";
import { decodeErrorMessage } from "../utility/error";

/**
 * Schema for the structure of font details.
 */
const fontDetailsSchema = z.object({
  details: z.union([z.array(z.any()), z.record(z.any())])
    .describe("The detailed information about the font, which can be an array or an object."),
});

/**
 * Defines the schema for a successful response.
 */
const successSchema = z.object({
  success: z.literal(true),
  data: fontDetailsSchema,
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
 * Tool for retrieving detailed information about a specific font from Xibo CMS
 */
export const getFontDetails = createTool({
  id: "get-font-details",
  description: "Retrieve detailed information about a specific font",
  inputSchema: z.object({
    fontId: z.number().describe("The Font ID to retrieve details for"),
  }),
  outputSchema: z.union([successSchema, errorSchema]),
  execute: async ({ context: input }): Promise<z.infer<typeof successSchema> | z.infer<typeof errorSchema>> => {
    if (!config.cmsUrl) {
      const errorMessage = "CMS URL is not configured.";
      logger.error(`getFontDetails: ${errorMessage}`);
      return {
        success: false,
        message: errorMessage,
      };
    }

    const url = `${config.cmsUrl}/api/fonts/details/${input.fontId}`;
    logger.info(`Requesting font details for ID: ${input.fontId} from ${url}`);

    const response = await fetch(url, {
      method: "GET",
      headers: await getAuthHeaders(),
    });

    // Safely parse the JSON response, falling back to raw text if parsing fails.
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
      const errorMessage = `Failed to get font details. API responded with status ${response.status}.`;
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

    // The API can return data in multiple formats. This block standardizes the response
    // into a consistent { details: ... } structure for reliable validation.
    let standardizedData;
    if (Array.isArray(responseData)) {
      standardizedData = { details: responseData };
    } else if (responseData && typeof responseData === 'object' && 'details' in responseData) {
      standardizedData = responseData;
    } else {
        // Fallback for other unexpected but valid JSON objects.
        standardizedData = { details: responseData };
    }

    // Validate the standardized data against the schema.
    const validationResult = fontDetailsSchema.safeParse(standardizedData);

    if (!validationResult.success) {
      const errorMessage = "Font details response validation failed.";
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
    
    logger.info(`Successfully retrieved font details for ID: ${input.fontId}`);
    return {
      success: true,
      data: validationResult.data,
    };
  },
});

export default getFontDetails;