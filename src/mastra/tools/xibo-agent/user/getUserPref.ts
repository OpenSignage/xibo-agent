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
 * @module getUserPref
 * @description This module provides a tool to retrieve the preferences for the current user.
 */
import { z } from 'zod';
import { createTool } from '@mastra/core/tools';
import { config } from '../config';
import { getAuthHeaders } from '../auth';
import { logger } from '../../../index';
import { decodeErrorMessage } from '../utility/error';

// This response uses 'option' as the key, not 'preference'.
// We define a local schema to avoid breaking other tools that might use the shared 'preferenceSchema'.
const preferenceResponseSchema = z.object({
  option: z.string(),
  value: z.any(),
});

// Schema for a successful response, containing an array of preferences.
const successResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(preferenceResponseSchema),
});

// Schema for a generic error response.
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
 * @tool getUserPref
 * @description A tool to retrieve all or a specific preference for the current user.
 */
export const getUserPref = createTool({
  id: 'get-user-pref',
  description: 'Gets preferences for the current user.',
  inputSchema: z.object({
    preference: z.string().optional().describe('The specific preference key to retrieve.'),
  }),
  outputSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      const message = 'CMS URL is not configured.';
      logger.error(message);
      return { success: false as const, message };
    }

    const url = new URL(`${config.cmsUrl}/api/user/pref`);
    if (context.preference) {
      url.searchParams.append('preference', context.preference);
    }

    try {
      logger.info({ preference: context.preference }, 'Attempting to retrieve user preferences.');

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: await getAuthHeaders(),
      });

      const responseData = await response.json();

      if (!response.ok) {
        const decodedError = decodeErrorMessage(responseData);
        const message = `Failed to get user preferences. API responded with status ${response.status}.`;
        logger.error({ status: response.status, response: decodedError }, message);
        return { success: false as const, message, errorData: decodedError };
      }

      // The API returns an array for all preferences, but a single object for a specific one.
      const responseValidationSchema = z.union([preferenceResponseSchema, z.array(preferenceResponseSchema)]);
      const validationResult = responseValidationSchema.safeParse(responseData);

      if (!validationResult.success) {
        const message = 'User preferences response validation failed.';
        logger.error({ error: validationResult.error.flatten(), data: responseData }, message);
        return { success: false as const, message, error: validationResult.error, errorData: responseData };
      }

      // Normalize the data to always be an array.
      const preferences = Array.isArray(validationResult.data)
        ? validationResult.data
        : [validationResult.data];

      logger.info({ count: preferences.length }, 'Successfully retrieved user preferences.');
      return { success: true as const, data: preferences };
    } catch (error: unknown) {
      const message = 'An unexpected error occurred while retrieving user preferences.';
      logger.error({ error }, message);
      return {
        success: false as const,
        message,
        error: error instanceof Error ? { name: error.name, message: error.message } : error,
      };
    }
  },
}); 