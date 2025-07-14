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
 * @module getFonts
 * @description Provides a tool to search and retrieve font information from the Xibo CMS,
 * implementing the /fonts API endpoint and handling response validation.
 */

import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { decodeErrorMessage, processError } from "../utility/error";
import { logger } from "../../../index";

// Schema definition for a single font record, based on the Xibo API.
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

// Schema for a successful response.
const successResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  data: z.array(fontSchema).describe("An array of font records."),
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
 * Tool to retrieve a list of fonts from the Xibo CMS.
 * Supports filtering by font ID or name.
 */
export const getFonts = createTool({
  id: "get-fonts",
  description: "Search and retrieve fonts from the Xibo CMS.",
  inputSchema: z.object({
    id: z.number().optional().describe("Filter by a specific Font ID."),
    name: z.string().optional().describe("Filter by Font Name (searches for part of a name)."),
  }),
  outputSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      const message = "CMS URL is not configured.";
      logger.error(message);
      return { success: false as const, message };
    }

    const url = new URL(`${config.cmsUrl}/api/fonts`);
    if (context.id) url.searchParams.append("id", context.id.toString());
    if (context.name) url.searchParams.append("name", context.name);

    try {
      logger.info({ url: url.toString() }, "Requesting fonts from Xibo CMS");

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: await getAuthHeaders(),
      });
      
      const responseData = await response.json().catch(() => response.text());

      if (!response.ok) {
        const decodedError = decodeErrorMessage(responseData);
        const message = `Failed to get fonts. API responded with status ${response.status}.`;
        logger.error({ status: response.status, response: decodedError }, message);
        return { success: false as const, message, errorData: decodedError };
      }
      
      const validationResult = z.array(fontSchema).safeParse(responseData);

      if (!validationResult.success) {
        const message = "Fonts response validation failed.";
        logger.error({ error: validationResult.error.flatten(), data: responseData }, message);
        return {
          success: false as const,
          message,
          error: validationResult.error.flatten(),
          errorData: responseData,
        };
      }
      
      if (context.id && validationResult.data.length === 0) {
        const message = "Font not found.";
        logger.warn({ fontId: context.id }, message);
        return { success: false as const, message };
      }

      logger.info({ count: validationResult.data.length }, `Successfully retrieved ${validationResult.data.length} fonts.`);
      return {
        success: true,
        message: `Successfully retrieved ${validationResult.data.length} fonts.`,
        data: validationResult.data,
      };
    } catch (error) {
      const message = "An unexpected error occurred while fetching fonts.";
      const processedError = processError(error);
      logger.error({ error: processedError }, message);
      return { success: false as const, message, error: processedError };
    }
  },
}); 