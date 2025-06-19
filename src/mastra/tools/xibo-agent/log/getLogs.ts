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
 * Xibo CMS Log Retrieval Tool
 * 
 * This module provides functionality to retrieve logs from the Xibo CMS API.
 * It accesses the /api/log endpoint to get logs from the CMS.
 * 
 * The tool is useful for:
 * - Checking CMS log information
 * - Debugging CMS issues
 * - Monitoring CMS activity
 */

import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { decodeErrorMessage } from "../utility/error";
import { logger } from '../../../index';

/**
 * Schema for the log entries array from Xibo API.
 * The API returns a direct array of log entries.
 */
const logArraySchema = z.array(z.any());

/**
 * Schema for the data property in the tool's output.
 * It contains the log entries wrapped in an object.
 */
const logDataSchema = z.object({
  log: logArraySchema
});

/**
 * Tool for retrieving Xibo CMS log information
 * 
 * This tool doesn't require any input parameters and returns
 * a JSON object containing:
 * - log: Array of log entries
 */
export const getLogs = createTool({
  id: 'get-logs',
  description: 'Get Xibo CMS log information',
  inputSchema: z.object({
    _placeholder: z.string().optional().describe('This tool does not require input parameters')
  }),
  outputSchema: z.object({
    success: z.boolean(),
    data: logDataSchema.optional(),
    message: z.string(),
    error: z.string().optional()
  }),
  execute: async ({ context }) => {
    try {
      // Check if CMS URL is configured
      if (!config.cmsUrl) {
        const errorMsg = "CMS URL is not configured";
        logger.error(`getLogs: ${errorMsg}`);
        return {
          success: false,
          message: "Failed to get CMS logs",
          error: errorMsg
        };
      }

      // Get authentication headers
      const headers = await getAuthHeaders();
      
      // Call CMS API
      const response = await fetch(`${config.cmsUrl}/api/log`, {
        headers,
      });
      // Handle API errors
      if (!response.ok) {
        const text = await response.text();
        const errorMsg = decodeErrorMessage(text);
        logger.error("getLogs: API error response", {
            status: response.status,
            error: errorMsg
        });
        return {
          success: false,
          message: `HTTP error! status: ${response.status}, message: ${errorMsg}`,
          error: errorMsg
        };
      }

      // Parse and validate response
      const data = await response.json();
      const validatedLogArray = logArraySchema.parse(data);

      // Return formatted response
      return {
        success: true,
        data: {
          log: validatedLogArray
        },
        message: "Successfully retrieved CMS logs"
      };
    } catch (error) {
      // Handle Zod validation errors and other exceptions
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error(`getLogs: An error occurred: ${errorMessage}`, { error });
      return {
        success: false,
        message: "Failed to get CMS logs",
        error: errorMessage
      };
    }
  },
});
