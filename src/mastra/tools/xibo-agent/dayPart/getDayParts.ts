/*
 * Copyright (C) 2025 Open Source Digital Signage Initiative.
 *
 * You can redistribute it and/or modify
 * it under theterms of the Elastic License 2.0 (ELv2) as published by
 * the Search AI Company, either version 3 of the License, or
 * any later version.
 *
 * You should have received a copy of the GElastic License 2.0 (ELv2).
 * see <https://www.elastic.co/licensing/elastic-license>.
 */

/**
 * @module getDayParts
 * @description Provides a tool to retrieve DayPart records from the Xibo CMS.
 * It implements the GET /daypart API endpoint.
 */
import { z } from 'zod';
import { createTool } from '@mastra/core';
import { getAuthHeaders } from '../auth';
import { config } from '../config';
import { logger } from '../../../logger';
import { processError } from '../utility/error';
import { dayPartSchema } from './schemas';

/**
 * Schema for the successful response, containing an array of DayParts.
 */
const getDayPartsSuccessSchema = z.object({
  success: z.literal(true),
  data: z.array(dayPartSchema),
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
const outputSchema = z.union([getDayPartsSuccessSchema, errorResponseSchema]);

/**
 * Tool to retrieve a list of DayParts from the Xibo CMS.
 */
export const getDayParts = createTool({
  id: 'get-dayparts',
  description: 'Gets a list of DayPart records from the Xibo CMS.',
  inputSchema: z.object({
    dayPartId: z.number().optional().describe('Filter by a specific DayPart ID.'),
    name: z.string().optional().describe('Filter by DayPart name.'),
    embed: z.string().optional().describe("Embed related data. Use 'exceptions' to include scheduling exceptions."),
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
      if (context.dayPartId) {
        url.searchParams.append('dayPartId', context.dayPartId.toString());
      }
      if (context.name) {
        url.searchParams.append('name', context.name);
      }
      if (context.embed) {
        url.searchParams.append('embed', context.embed);
      }

      logger.debug(
        { url: url.toString() },
        'Attempting to get a list of DayParts'
      );

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: await getAuthHeaders(),
      });

      const responseData = await response.json();

      if (!response.ok) {
        const message = `Failed to get DayParts. API responded with status ${response.status}.`;
        logger.error(
          { status: response.status, response: responseData },
          message
        );
        return { success: false as const, message, errorData: responseData };
      }

      const validationResult = z.array(dayPartSchema).safeParse(responseData);

      if (!validationResult.success) {
        const message = 'Get DayParts response validation failed.';
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
        { count: validationResult.data.length },
        `Successfully retrieved ${validationResult.data.length} DayParts.`
      );
      return { success: true as const, data: validationResult.data };
    } catch (error) {
      const message =
        'An unexpected error occurred while getting DayParts.';
      const processedError = processError(error);
      logger.error({ error: processedError }, message);
      return { success: false as const, message, error: processedError };
    }
  },
});