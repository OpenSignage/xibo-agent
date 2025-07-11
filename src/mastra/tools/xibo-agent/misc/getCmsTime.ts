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
 * This module provides a tool to retrieve the current time from the Xibo CMS.
 * It implements the GET /clock endpoint.
 */

import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { decodeErrorMessage } from "../utility/error";
import { logger } from '../../../index';

/**
 * Schema for the 'clock' response from the Xibo API.
 */
const clockResponseSchema = z.object({
  serverTime: z.string().optional().describe("Current server time in ISO 8601 format."),
  timezone: z.string().optional().describe("Server's timezone setting (e.g., 'Asia/Tokyo')."),
  offset: z.number().optional().describe("Timezone offset in minutes from UTC.")
}).passthrough();

/**
 * Converts a UTC time string to a local time string using a given offset.
 * @param utcTime - The UTC time string in ISO 8601 format.
 * @param offset - The timezone offset in minutes.
 * @returns The calculated local time string in ISO 8601 format.
 */
function convertToLocalTime(utcTime: string, offset: number): string {
  try {
    const date = new Date(utcTime);
    const localDate = new Date(date.getTime() + (offset * 60 * 1000));
    return localDate.toISOString();
  } catch (error) {
    logger.error({ error }, "Error converting UTC time to local time.");
    return utcTime; // Return original time on error
  }
}

/**
 * Schema for the tool's output.
 */
const outputSchema = z.object({
  success: z.boolean().describe("Indicates whether the operation was successful."),
  message: z.string().describe("A message providing details about the operation outcome."),
  data: z.object({
    currentTime: z.string().describe("The server's current time in UTC (ISO 8601)."),
    timezone: z.string().describe("The server's configured timezone."),
    offset: z.number().describe("The timezone offset in minutes from UTC."),
    localTime: z.string().describe("The calculated local time (ISO 8601).")
  }).optional().describe("The time information on success."),
  error: z.string().optional().describe("Error details if the operation failed."),
});

/**
 * Tool for retrieving the current time from the Xibo CMS.
 */
export const getCmsTime = createTool({
  id: 'get-cms-time',
  description: 'Get the current time from Xibo CMS.',
  inputSchema: z.object({}), // This tool does not require any input.
  outputSchema,
  execute: async ({ context }) => {
    logger.info({ context }, "Executing getCmsTime tool.");
    
    try {
      if (!config.cmsUrl) {
        const message = "CMS URL is not configured.";
        logger.error(message);
        return { success: false, message, error: message };
      }

      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/clock`;
      logger.debug({ url }, "Sending GET request for CMS time.");
      
      const response = await fetch(url, { headers });

      if (!response.ok) {
        const text = await response.text();
        const error = decodeErrorMessage(text);
        const message = "Failed to get CMS time.";
        logger.error({ status: response.status, error }, message);
        return { success: false, message, error };
      }

      const data = await response.json();
      logger.debug({ data }, "Received clock response from CMS API.");
      const validatedData = clockResponseSchema.parse(data);
      
      const serverTime = validatedData.serverTime || new Date().toISOString();
      const timezone = validatedData.timezone || 'UTC';
      const offset = validatedData.offset || 0;
      const localTime = convertToLocalTime(serverTime, offset);

      logger.info("Successfully retrieved CMS time.");
      return {
        success: true,
        data: {
          currentTime: serverTime,
          timezone,
          offset,
          localTime
        },
        message: "Successfully retrieved CMS time"
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error({ error }, "An unexpected error occurred in getCmsTime.");
      return {
        success: false,
        message: "Failed to get CMS time",
        error: errorMessage,
      };
    }
  },
});
