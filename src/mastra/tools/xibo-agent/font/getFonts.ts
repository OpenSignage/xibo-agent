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
 * Font Retrieval Tool
 * 
 * This module provides functionality to search and retrieve font information from the Xibo CMS.
 * It implements the /fonts API endpoint and handles response validation.
 */

import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { decodeErrorMessage } from "../utility/error";
import { logger } from "../../../index";

/**
 * Schema definition for a single font record.
 */
const fontSchema = z.object({
  id: z.number().describe("The Font ID"),
  createdAt: z.string().describe("The Font created date"),
  modifiedAt: z.string().describe("The Font modified date"),
  modifiedBy: z.string().describe("The name of the user that modified this font last"),
  name: z.string().describe("The Font name"),
  fileName: z.string().describe("The Font file name"),
  familyName: z.string().describe("The Font family name"),
  size: z.number().describe("The Font file size in bytes"),
  md5: z.string().describe("A MD5 checksum of the stored font file"),
});

/**
 * Defines the schema for a successful response.
 */
const successSchema = z.object({
  success: z.literal(true),
  data: z.array(fontSchema).describe("An array of font records."),
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
 * Tool for retrieving fonts from Xibo CMS
 */
export const getFonts = createTool({
  id: "get-fonts",
  description: "Search and retrieve fonts from the Xibo CMS.",
  inputSchema: z.object({
    id: z.number().optional().describe("Filter by a specific Font ID."),
    name: z.string().optional().describe("Filter by Font Name (searches for part of a name)."),
  }),
  outputSchema: z.union([successSchema, errorSchema]),
  execute: async ({ context: input }): Promise<z.infer<typeof successSchema> | z.infer<typeof errorSchema>> => {
    if (!config.cmsUrl) {
      const errorMessage = "CMS URL is not configured.";
      logger.error(`getFonts: ${errorMessage}`);
      return {
        success: false,
        message: errorMessage,
      };
    }

    // Construct the request URL and add search parameters if provided.
    const url = new URL(`${config.cmsUrl}/api/fonts`);
    if (input.id) url.searchParams.append("id", input.id.toString());
    if (input.name) url.searchParams.append("name", input.name);

    logger.info(`Requesting fonts from: ${url.toString()}`);

    const response = await fetch(url.toString(), {
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
        const errorMessage = `Failed to get fonts. API responded with status ${response.status}.`;
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
    
    // Validate the structure of the response data against the schema.
    const validationResult = z.array(fontSchema).safeParse(responseData);

    if (!validationResult.success) {
        const errorMessage = "Fonts response validation failed.";
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
    
    // If a specific font ID was requested and no results were found, return a 'not found' error.
    if (input.id && validationResult.data.length === 0) {
      const message = "Font not found.";
      logger.warn(`getFonts: ${message} for ID: ${input.id}`);
      return {
        success: false,
        message,
      };
    }

    if (validationResult.data.length === 0) {
        logger.info("No fonts found matching the criteria.");
    } else {
        logger.info(`Successfully retrieved ${validationResult.data.length} fonts.`);
    }

    return {
      success: true,
      data: validationResult.data,
    };
  },
});

export default getFonts; 