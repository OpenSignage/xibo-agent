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
 * @module getFontDetails
 * @description Provides a tool to retrieve detailed information for a specific font
 * from the Xibo CMS. It implements the /fonts/details/{id} API endpoint.
 */

import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../logger";
import { decodeErrorMessage, processError } from "../utility/error";

// Schema for the detailed font properties from the API.
const detailedFontInfoSchema = z.object({
    "Name": z.string().describe("The name of the font.").optional(),
    "SubFamily Name": z.string().describe("The subfamily name of the font.").optional(),
    "Subfamily ID": z.string().describe("The subfamily ID of the font.").optional(),
    "Full Name": z.string().describe("The full name of the font.").optional(),
    "Version": z.string().describe("The version string of the font.").optional(),
    "Font Weight": z.number().describe("The weight of the font.").optional(),
    "Font Postscript Name": z.string().describe("The Postscript name of the font.").optional(),
    "Font Copyright": z.string().describe("The copyright information for the font.").optional(),
}).passthrough();

// Schema for the structure of font details, which can be an array or an object.
const fontDetailsSchema = z.object({
  details: z.union([z.array(z.any()), detailedFontInfoSchema])
    .describe("The detailed information about the font."),
});

// Schema for a successful response.
const successResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  data: fontDetailsSchema,
});

// Schema for a failed operation.
const errorResponseSchema = z.object({
  success: z.literal(false),
  message: z.string().describe("A human-readable error message."),
  error: z.any().optional().describe("Optional technical details about the error."),
  errorData: z.any().optional(),
});

/**
 * Union schema for tool output, covering both success and error cases.
 */
const outputSchema = z.union([successResponseSchema, errorResponseSchema]);

/**
 * Tool to retrieve detailed information about a specific font from Xibo CMS.
 */
export const getFontDetails = createTool({
  id: "get-font-details",
  description: "Retrieve detailed information about a specific font.",
  inputSchema: z.object({
    fontId: z.number().describe("The ID of the font to retrieve details for."),
  }),
  outputSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      const message = "CMS URL is not configured.";
      logger.error(message);
      return { success: false as const, message };
    }

    const url = new URL(`${config.cmsUrl}/api/fonts/details/${context.fontId}`);

    try {
      logger.info({ url: url.toString() }, `Requesting font details for ID: ${context.fontId}`);

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: await getAuthHeaders(),
      });

      const responseData = await response.json().catch(() => response.text());

      if (!response.ok) {
        const decodedError = decodeErrorMessage(responseData);
        const message = `Failed to get font details. API responded with status ${response.status}.`;
        logger.error({ status: response.status, response: decodedError }, message);
        return { success: false as const, message, errorData: decodedError };
      }

      // The API can return data in multiple formats. Standardize it.
      const standardizedData = (responseData && typeof responseData === 'object' && 'details' in responseData)
        ? responseData
        : { details: responseData };
      
      const validationResult = fontDetailsSchema.safeParse(standardizedData);

      if (!validationResult.success) {
        const message = "Font details response validation failed.";
        logger.error({ error: validationResult.error.flatten(), data: responseData }, message);
        return {
          success: false as const,
          message,
          error: validationResult.error.flatten(),
          errorData: responseData,
        };
      }
      
      logger.info({ fontId: context.fontId }, "Successfully retrieved font details.");
      return {
        success: true,
        message: "Successfully retrieved font details.",
        data: validationResult.data,
      };
    } catch (error) {
      const message = "An unexpected error occurred while fetching font details.";
      const processedError = processError(error);
      logger.error({ error: processedError }, message);
      return { success: false as const, message, error: processedError };
    }
  },
});