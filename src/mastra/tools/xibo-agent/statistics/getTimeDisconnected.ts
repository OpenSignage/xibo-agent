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
 * @module getTimeDisconnected
 * @description This module provides a tool to retrieve the disconnected time for displays from the Xibo CMS.
 */
import { z } from 'zod';
import { createTool } from '@mastra/core/tools';
import { config } from '../config';
import { getAuthHeaders } from '../auth';
import { logger } from '../../../logger';
import { decodeErrorMessage } from '../utility/error';

// Schema for a single disconnected time record.
const disconnectedTimeSchema = z.object({
  displayId: z.number().describe('The ID of the display.'),
  display: z.string().describe('The name of the display.'),
  lastSeen: z.string().describe('The last time the display was seen.'),
  lastSeenUnix: z.number().describe('The last time the display was seen as a Unix timestamp.'),
  timeDisconnected: z.number().describe('The duration in seconds the display has been disconnected.'),
});

// Schema for a successful response.
const successResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(disconnectedTimeSchema),
  message: z.string(),
});

// Schema for an error response.
const errorResponseSchema = z.object({
  success: z.literal(false),
  message: z.string(),
  error: z.any().optional(),
  errorData: z.any().optional(),
});

/**
 * Schema for the tool's output, which can be a success or error response.
 */
const outputSchema = z.union([successResponseSchema, errorResponseSchema]);

/**
 * @tool getTimeDisconnected
 * @description A tool for retrieving the disconnected time for displays.
 * This can be filtered by display or display group.
 */
export const getTimeDisconnected = createTool({
  id: 'get-time-disconnected',
  description: 'Get the disconnected time for displays.',
  inputSchema: z.object({
    fromDt: z.string().describe("The start date for the filter (e.g., 'YYYY-MM-DD HH:MM:SS')."),
    toDt: z.string().describe("The end date for the filter (e.g., 'YYYY-MM-DD HH:MM:SS')."),
    displayId: z.number().optional().describe('Filter by a single Display ID.'),
    displayIds: z.array(z.number()).optional().describe('Filter by a list of Display IDs.'),
    returnDisplayLocalTime: z.string().optional().describe("Return results in the display's local time. Use 'on', '1', or 'true'."),
    returnDateFormat: z.string().optional().describe('A PHP-style date format string for how the returned dates should be formatted.'),
  }),
  outputSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      const message = 'CMS URL is not configured.';
      logger.error(message);
      return { success: false as const, message };
    }

    const url = new URL(`${config.cmsUrl}/api/stats/timeDisconnected`);
    const params = new URLSearchParams();

    Object.entries(context).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, String(value));
      }
    });
    url.search = params.toString();

    try {
      logger.info({ url: url.toString() }, 'Requesting disconnected time stats.');
      
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: await getAuthHeaders(),
      });

      const responseData = await response.json();

      if (!response.ok) {
        const decodedError = decodeErrorMessage(responseData);
        const message = `Failed to get disconnected time. API responded with status ${response.status}.`;
        logger.error({ status: response.status, response: decodedError }, message);
        return {
          success: false as const,
          message,
          errorData: decodedError,
        };
      }

      const validationResult = z.array(disconnectedTimeSchema).safeParse(responseData);

      if (!validationResult.success) {
        const message = 'Disconnected time response validation failed.';
        logger.error({ error: validationResult.error.flatten(), data: responseData }, message);
        return {
          success: false as const,
          message,
          error: validationResult.error,
          errorData: responseData,
        };
      }

      const message = `Successfully retrieved disconnected time for ${validationResult.data.length} display(s).`;
      logger.info({ count: validationResult.data.length }, message);
      return {
        success: true as const,
        data: validationResult.data,
        message,
      };
    } catch (error: unknown) {
      const message = 'An unexpected error occurred while getting disconnected time.';
      logger.error({ error }, message);
      return {
        success: false as const,
        message,
        error: error instanceof Error ? { name: error.name, message: error.message } : error,
      };
    }
  },
}); 