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
 * Schema definition for font data based on Xibo API documentation
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
  md5: z.string().describe("A MD5 checksum of the stored font file")
});

/**
 * Schema for API response validation
 * Supports two potential response formats:
 * 1. Standard format: { success: boolean, data: [...] }
 * 2. Direct array format: [...]
 */
const apiResponseSchema = z.union([
  z.object({
    success: z.boolean(),
    data: z.array(fontSchema),
  }),
  z.array(fontSchema)
]);

/**
 * Tool for retrieving fonts from Xibo CMS
 * 
 * This tool allows searching for fonts by ID or name
 */
export const getFonts = createTool({
  id: "get-fonts",
  description: "Search fonts in Xibo CMS",
  inputSchema: z.object({
    id: z.number().optional().describe("Filter by Font ID"),
    name: z.string().optional().describe("Filter by Font Name"),
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        logger.error("getFonts: CMS URL is not configured");
        throw new Error("CMS URL is not configured");
      }

      // Prepare the API endpoint URL
      const url = new URL(`${config.cmsUrl}/api/fonts`);
      
      // Add query parameters if provided
      if (context.id) url.searchParams.append("id", context.id.toString());
      if (context.name) url.searchParams.append("name", context.name);

      logger.info(`Searching fonts${context.id ? ` with ID ${context.id}` : ''}${context.name ? ` with name '${context.name}'` : ''}`);
      logger.debug(`Request URL: ${url.toString()}`);

      // Fetch authentication headers and make the request
      const headers = await getAuthHeaders();
      const response = await fetch(url.toString(), {
        method: "GET",
        headers,
      });

      // Handle error responses
      if (!response.ok) {
        const responseText = await response.text();
        const errorMessage = decodeErrorMessage(responseText);
        logger.error(`Failed to retrieve fonts: ${errorMessage}`, {
          status: response.status,
          url: url.toString()
        });
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorMessage}`);
      }

      // Parse and validate the response
      const rawData = await response.json();
      const validatedData = apiResponseSchema.parse(rawData);
      
      // Handle both response formats (object with data property or direct array)
      // Extract the font data array regardless of response format
      const fontsData = Array.isArray(validatedData) ? validatedData : validatedData.data;
      
      logger.info(`Successfully retrieved ${fontsData.length} fonts`);
      
      // Standardize the response format to ensure consistent structure
      // If we received an array directly, wrap it in the standard object format
      return Array.isArray(validatedData) 
        ? { success: true, data: validatedData } 
        : validatedData;
    } catch (error) {
      logger.error(`getFonts: An error occurred: ${error instanceof Error ? error.message : "Unknown error"}`, { error });
      throw error;
    }
  },
});

export default getFonts; 