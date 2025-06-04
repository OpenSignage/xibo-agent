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
 * Xibo CMS Time Retrieval Tool
 * 
 * This module provides functionality to retrieve the current time from the Xibo CMS API.
 * It connects to the /api/clock endpoint to get the server's current time, which is useful
 * for synchronization and scheduling operations in the Xibo ecosystem.
 * 
 * The tool returns both server time (UTC) and local time based on the server's timezone settings.
 * For Japanese servers, the timezone is typically set to JST (UTC+9).
 */

import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { decodeErrorMessage } from "../utility/error";
import { logger } from '../../../index';

/**
 * Schema for the clock response from Xibo API
 * 
 * The API returns:
 * - serverTime: Current server time in ISO 8601 format
 * - timezone: Server's timezone setting (e.g., "Asia/Tokyo" for JST)
 * - offset: Timezone offset in minutes (e.g., 540 for JST)
 */
const clockResponseSchema = z.object({
  serverTime: z.string().optional(),
  timezone: z.string().optional(),
  offset: z.number().optional()
}).passthrough();

/**
 * Convert UTC time to local time with timezone offset
 * 
 * @param utcTime - UTC time string in ISO 8601 format
 * @param timezone - Timezone string (e.g., "Asia/Tokyo")
 * @param offset - Timezone offset in minutes (e.g., 540 for JST)
 * @returns Local time string in ISO 8601 format
 */
function convertToLocalTime(utcTime: string, timezone: string, offset: number): string {
  try {
    const date = new Date(utcTime);
    const localDate = new Date(date.getTime() + (offset * 60 * 1000));
    return localDate.toISOString();
  } catch (error) {
    logger.error(`Error converting time: ${error instanceof Error ? error.message : "Unknown error"}`);
    return utcTime;
  }
}

/**
 * Tool for retrieving the current time from Xibo CMS
 * 
 * This tool doesn't require any input parameters and returns
 * a JSON object containing:
 * - currentTime: Server's current time in UTC
 * - timezone: Server's timezone setting
 * - offset: Timezone offset in minutes
 * - localTime: Time converted to local timezone
 */
export const getCmsTime = createTool({
  id: 'get-cms-time',
  description: 'Get the current time from Xibo CMS',
  inputSchema: z.object({
    _placeholder: z.string().optional().describe('This tool does not require input parameters')
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    data: z.object({
      currentTime: z.string(),
      timezone: z.string(),
      offset: z.number(),
      localTime: z.string()
    }).optional(),
    error: z.string().optional()
  }),
  execute: async ({ context }) => {
    try {
      // Check if CMS URL is configured
      if (!config.cmsUrl) {
        return {
          success: false,
          message: "Failed to get CMS time",
          error: "CMS URL is not configured"
        };
      }

      // Get authentication headers
      const headers = await getAuthHeaders();

      // Call CMS API
      const response = await fetch(`${config.cmsUrl}/api/clock`, {
        headers,
      });

      // Handle API errors
      if (!response.ok) {
        const text = await response.text();
        return {
          success: false,
          message: "Failed to get CMS time",
          error: decodeErrorMessage(text)
        };
      }

      // Parse and validate response
      const data = await response.json();
      logger.debug('CMS time response:', data);
      const validatedData = clockResponseSchema.parse(data);
      
      // Extract time information with fallbacks
      const serverTime = validatedData.serverTime || new Date().toISOString();
      const timezone = validatedData.timezone || 'UTC';
      const offset = validatedData.offset || 0;
      const localTime = convertToLocalTime(serverTime, timezone, offset);

      // Return formatted response
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
      logger.error(`getCmsTime: An error occurred: ${error instanceof Error ? error.message : "Unknown error"}`, { error });
      return {
        success: false,
        message: "Failed to get CMS time",
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  },
});
