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
 * @module addDayPart
 * @description Provides a tool to add a new DayPart record to the Xibo CMS.
 * It implements the POST /daypart API endpoint.
 */
import { z } from 'zod';
import { createTool } from '@mastra/core';
import { getAuthHeaders } from '../auth';
import { config } from '../config';
import { logger } from '../../../logger';  
import { processError } from '../utility/error';
import { dayPartSchema } from './schemas';

/**
 * Schema for the successful response, containing the newly created DayPart.
 */
const addDayPartSuccessSchema = z.object({
  success: z.literal(true),
  data: dayPartSchema,
});

/**
 * Schema for a standardized error response.
 */
const errorResponseSchema = z.object({
  success: z.literal(false),
  message: z.string().describe('A simple, readable error message.'),
  error: z
    .any()
    .optional()
    .describe('Detailed error information, e.g., from Zod.'),
  errorData: z.any().optional().describe('Raw response data from the CMS.'),
});

/**
 * Union schema for tool output, covering both success and error cases.
 */
const outputSchema = z.union([addDayPartSuccessSchema, errorResponseSchema]);

/**
 * Tool to add a new DayPart record to the Xibo CMS.
 */
export const addDayPart = createTool({
  id: 'add-daypart',
  description: 'Adds a new DayPart record to the Xibo CMS.',
  inputSchema: z.object({
    name: z.string().describe('The name for the new DayPart.'),
    description: z.string().optional().describe('An optional description for the DayPart.'),
    startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/).describe('The start time in HH:mm:ss format.'),
    endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/).describe('The end time in HH:mm:ss format.'),
  }),
  outputSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      const message = 'CMS URL is not configured.';
      logger.error({}, message);
      return { success: false as const, message };
    }

    try {
      const url = new URL(`${config.cmsUrl}/api/daypart`);
      const authHeaders = await getAuthHeaders();
      const headers = {
        ...authHeaders,
        'Content-Type': 'application/x-www-form-urlencoded',
      };

      const body = new URLSearchParams(context);

      logger.debug(
        { url: url.toString(), body: body.toString() },
        'Attempting to add a new DayPart'
      );

      const response = await fetch(url.toString(), {
        method: 'POST',
        headers,
        body,
      });

      const responseData = await response.json();

      if (!response.ok) {
        const message = `Failed to add DayPart. API responded with status ${response.status}.`;
        logger.error(
          { status: response.status, response: responseData },
          message
        );
        return { success: false as const, message, errorData: responseData };
      }

      const validationResult = dayPartSchema.safeParse(responseData);
      if (!validationResult.success) {
        const message = 'Add DayPart response validation failed.';
        logger.error(
          { error: validationResult.error.flatten(), data: responseData },
          message
        );
        return {
          success: false as const,
          message,
          error: validationResult.error.flatten(),
          errorData: responseData,
        };
      }

      logger.info(
        {
          dayPartId: validationResult.data.dayPartId,
          dayPartName: validationResult.data.name,
        },
        `Successfully added DayPart '${validationResult.data.name}'.`
      );
      return { success: true as const, data: validationResult.data };
    } catch (error) {
      const message = 'An unexpected error occurred while adding a DayPart.';
      const processedError = processError(error);
      logger.error({ error: processedError }, message);
      return { success: false as const, message, error: processedError };
    }
  },
});