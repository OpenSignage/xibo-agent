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
 * @module
 * This module provides a tool to retrieve version and source information from the Xibo CMS.
 * It implements the GET /about endpoint.
 */

import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { decodeErrorMessage } from "../utility/error";
import { logger } from '../../../logger';

/**
 * Schema for the 'about' response from the Xibo API.
 */
const aboutResponseSchema = z.object({
  version: z.string().describe("Current CMS version (e.g., '3.0.0')."),
  sourceUrl: z.string().nullable().describe("URL to the source code repository."),
});

/**
 * Schema for the tool's output, covering both success and failure cases.
 */
const outputSchema = z.object({
  success: z.boolean().describe("Indicates whether the operation was successful."),
  data: aboutResponseSchema.optional().describe("The 'about' information on success."),
  message: z.string().describe("A message providing details about the operation outcome."),
  error: z.string().optional().describe("Error details if the operation failed."),
});

/**
 * Tool for retrieving Xibo CMS version and source information.
 */
export const getAbout = createTool({
  id: 'get-about',
  description: 'Get Xibo CMS version and source information.',
  inputSchema: z.object({}), // This tool does not require any input.
  outputSchema,
  execute: async ({ context }) => {
    logger.info({ context }, "Executing getAbout tool.");
    
    try {
      if (!config.cmsUrl) {
        const message = "CMS URL is not configured.";
        logger.error(message);
        return { success: false, message, error: message };
      }

      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/about`;
      logger.debug({ url }, "Sending GET request for 'about' information.");
      
      const response = await fetch(url, { headers });

      if (!response.ok) {
        const text = await response.text();
        const error = decodeErrorMessage(text);
        const message = "Failed to get CMS information.";
        logger.error({ status: response.status, error }, message);
        return { success: false, message, error };
      }

      const data = await response.json();
      const validatedData = aboutResponseSchema.parse(data);

      logger.info("Successfully retrieved CMS 'about' information.");
      return {
        success: true,
        data: validatedData,
        message: "Successfully retrieved CMS information."
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error({ error }, "An unexpected error occurred in getAbout.");
      return {
        success: false,
        message: "Failed to get CMS information",
        error: errorMessage,
      };
    }
  },
});
