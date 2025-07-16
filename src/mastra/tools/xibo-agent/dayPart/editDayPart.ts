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
 * @module editDayPart
 * @description Provides a tool to edit an existing DayPart record in the Xibo CMS.
 * It implements the PUT /daypart/{id} API endpoint.
 */
import { z } from 'zod';
import { createTool } from '@mastra/core';
import { getAuthHeaders } from '../auth';
import { config } from '../config';
import { logger } from '../../../index';
import { processError } from '../utility/error';
import { dayPartSchema } from './schemas';

/**
 * Schema for the successful response, containing the updated DayPart.
 */
const editDayPartSuccessSchema = z.object({
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
const outputSchema = z.union([editDayPartSuccessSchema, errorResponseSchema]);

/**
 * Tool to edit an existing DayPart record in the Xibo CMS.
 */
export const editDayPart = createTool({
  id: 'edit-daypart',
  description: 'Edits an existing DayPart record in the Xibo CMS.',
  inputSchema: z.object({
    dayPartId: z.number().describe('The ID of the DayPart record to edit.'),
    name: z.string().describe('The new name for the DayPart.'),
    description: z.string().optional().describe('The new description for the DayPart.'),
    startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/).describe('The new start time in HH:mm:ss format.'),
    endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/).describe('The new end time in HH:mm:ss format.'),
  }),
  outputSchema,
  execute: async ({ context }) => {
    const { dayPartId, ...updates } = context;

    if (!config.cmsUrl) {
      const message = 'CMS URL is not configured.';
      logger.error({}, message);
      return { success: false as const, message };
    }

    try {
      const url = new URL(`${config.cmsUrl}/api/daypart/${dayPartId}`);
      const authHeaders = await getAuthHeaders();
      const headers = {
        ...authHeaders,
        'Content-Type': 'application/x-www-form-urlencoded',
      };

      const body = new URLSearchParams(updates as Record<string, string>);

      logger.debug(
        { url: url.toString(), body: body.toString() },
        `Attempting to edit DayPart ${dayPartId}`
      );

      const response = await fetch(url.toString(), {
        method: 'PUT',
        headers,
        body,
      });

      const responseData = await response.json();

      if (!response.ok) {
        const message = `Failed to edit DayPart. API responded with status ${response.status}.`;
        logger.error(
          { status: response.status, response: responseData },
          message
        );
        return { success: false as const, message, errorData: responseData };
      }

      const validationResult = dayPartSchema.safeParse(responseData);
      if (!validationResult.success) {
        const message = 'Edit DayPart response validation failed.';
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
        { dayPartId },
        `Successfully edited DayPart ID ${dayPartId}.`
      );
      return { success: true as const, data: validationResult.data };
    } catch (error) {
      const message = `An unexpected error occurred while editing DayPart ${dayPartId}.`;
      const processedError = processError(error);
      logger.error({ error: processedError, dayPartId }, message);
      return { success: false as const, message, error: processedError };
    }
  },
});