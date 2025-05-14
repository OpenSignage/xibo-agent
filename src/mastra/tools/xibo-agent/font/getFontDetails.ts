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
 * Schema for font details data structure
 * Supports both array and object formats for details
 */
const fontDetailsSchema = z.object({
  details: z.union([
    z.array(z.any()), 
    z.record(z.any())  // オブジェクト形式もサポート
  ]),
});

/**
 * Schema for API response validation with multiple possible formats
 * Handles different response structures that the API might return:
 * 1. Standard format: { success: boolean, data: { details: [...] } }
 * 2. Direct details object: { details: [...] }
 * 3. Direct array format: [...]
 * 4. Object with details as object: { details: {...} }
 */
const apiResponseSchema = z.union([
  z.object({
    success: z.boolean(),
    data: fontDetailsSchema,
  }),
  fontDetailsSchema,
  z.array(z.any()),
  z.record(z.any()),  // 任意のオブジェクト形式も許可
]);

/**
 * Tool for retrieving detailed information about a specific font from Xibo CMS
 */
export const getFontDetails = createTool({
  id: "get-font-details",
  description: "Retrieve detailed information about a specific font",
  inputSchema: z.object({
    id: z.number().describe("The Font ID to retrieve details for"),
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        logger.error("getFontDetails: CMS URL is not set");
        throw new Error("CMS URL is not set");
      }

      const url = new URL(`${config.cmsUrl}/api/fonts/details/${context.id}`);
      logger.info(`Requesting font details for ID: ${context.id}`);
      logger.debug(`Request URL: ${url.toString()}`);

      const headers = await getAuthHeaders();
      const response = await fetch(url.toString(), {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        const responseText = await response.text();
        const errorMessage = decodeErrorMessage(responseText);
        logger.error(`Failed to retrieve font details: ${errorMessage}`, {
          status: response.status,
          url: url.toString()
        });
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorMessage}`);
      }

      // Log raw response for debugging
      const rawData = await response.json();
      logger.debug(`Raw API response: ${JSON.stringify(rawData)}`);
      
      const validatedData = apiResponseSchema.parse(rawData);
      
      // Standardize different response formats to ensure consistent return structure
      if (Array.isArray(validatedData)) {
        logger.info("Font details retrieved successfully (array format)");
        return { success: true, data: { details: validatedData } };
      } else if ('details' in validatedData) {
        logger.info("Font details retrieved successfully (details object format)");
        return { success: true, data: validatedData };
      } else if ('data' in validatedData && 'success' in validatedData) {
        logger.info("Font details retrieved successfully (standard format)");
        return validatedData;
      }
      
      // Fallback for unexpected formats - convert to standard format to ensure compatibility
      logger.info("Font details retrieved successfully (generic object format)");
      return { 
        success: true, 
        data: { 
          details: validatedData 
        } 
      };
    } catch (error) {
      logger.error(`getFontDetails: An error occurred: ${error instanceof Error ? error.message : "Unknown error"}`, { error });
      throw error;
    }
  },
});

export default getFontDetails; 