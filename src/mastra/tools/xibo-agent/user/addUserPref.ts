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
 * @module addUserPref
 * @description This module provides a tool to add or update preferences for the current user.
 */
import { z } from 'zod';
import { createTool } from '@mastra/core/tools';
import { config } from '../config';
import { getAuthHeaders } from '../auth';
import { logger } from '../../../index';
import { decodeErrorMessage } from '../utility/error';
import {
  preferenceSchema,
} from './schemas';

// Schema for a generic success response, extended with a message.
const successResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
});

// Schema for a generic error response.
const errorResponseSchema = z.object({
  success: z.literal(false),
  message: z.string(),
  error: z.any().optional(),
  errorData: z.any().optional(),
});

/**
 * The output schema is a union of a successful response or an error response.
 */
const outputSchema = z.union([successResponseSchema, errorResponseSchema]);

/**
 * @tool addUserPref
 * @description A tool to add or update one or more preferences for the current user.
 */
export const addUserPref = createTool({
  id: 'add-user-pref',
  description: 'Adds or updates preferences for the current user.',
  inputSchema: z.object({
    preferences: z.array(preferenceSchema.omit({ userId: true })).describe('An array of preference objects to add or update.'),
  }),
  outputSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      const message = 'CMS URL is not configured.';
      logger.error(message);
      return { success: false as const, message };
    }

    const url = new URL(`${config.cmsUrl}/api/user/pref`);
    
    try {
      logger.info({ preferences: context.preferences }, 'Attempting to add or update user preferences.');

      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          ...(await getAuthHeaders()),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(context.preferences),
      });

      if (response.status === 204) {
        const message = 'User preferences added/updated successfully.';
        logger.info(message);
        return { success: true as const, message };
      }
      
      const responseData = await response.json();

      if (!response.ok) {
        const decodedError = decodeErrorMessage(responseData);
        const message = `Failed to add/update user preferences. API responded with status ${response.status}.`;
        logger.error({ status: response.status, response: decodedError }, message);
        return { success: false as const, message, errorData: decodedError };
      }

      const message = 'User preferences added/updated successfully.';
      logger.info(message);
      return { success: true as const, message };

    } catch (error: unknown) {
      const message = 'An unexpected error occurred while adding/updating user preferences.';
      logger.error({ error }, message);
      return {
        success: false as const,
        message,
        error: error instanceof Error ? { name: error.name, message: error.message } : error,
      };
    }
  },
}); 