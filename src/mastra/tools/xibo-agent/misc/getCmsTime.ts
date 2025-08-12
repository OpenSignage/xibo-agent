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
import { logger } from '../../../logger';

/**
 * Schema for the 'clock' response from the Xibo API.
 */
const rawClockResponseSchemaA = z.object({
  time: z.string().describe("Current server time string as returned by CMS (e.g., '00:17 JST')."),
}).passthrough();

const rawClockResponseSchemaB = z.object({
  data: z.object({
    time: z.string().describe("Current server time string as returned by CMS (e.g., '00:17 JST')."),
  }).passthrough(),
}).passthrough();

const clockResponseUnion = z.union([rawClockResponseSchemaA, rawClockResponseSchemaB]);

// No conversion helper is needed for the current CMS response format.

/**
 * Schema for the tool's output.
 */
const outputSchema = z.object({
  success: z.boolean().describe("Indicates whether the operation was successful."),
  message: z.string().describe("A message providing details about the operation outcome."),
  data: z.object({
    time: z.string().describe("The current server time string as returned by CMS (e.g., '00:17 JST')."),
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

      const raw = await response.json();
      logger.debug({ raw }, "Received clock response from CMS API.");
      const parsed = clockResponseUnion.safeParse(raw);

      if (!parsed.success) {
        const message = "Unexpected CMS time response format.";
        logger.error({ raw, error: parsed.error.format() }, message);
        return { success: false, message, error: message };
      }

      const maybeTime = 'time' in parsed.data ? parsed.data.time : parsed.data.data.time;
      const timeResult = z.string().safeParse(maybeTime);
      if (!timeResult.success) {
        const message = "CMS time is not a string.";
        logger.error({ value: maybeTime, error: timeResult.error.format() }, message);
        return { success: false, message, error: message };
      }
      const time = timeResult.data;

      logger.info("Successfully retrieved CMS time.");
      return {
        success: true,
        data: { time },
        message: "Successfully retrieved CMS time",
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
