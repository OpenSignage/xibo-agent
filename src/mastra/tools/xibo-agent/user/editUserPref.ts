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
* @module editUserPref
 * @description This module provides a tool for editing the preferences of a specific user.
 */
import { z } from 'zod';
import { createTool } from '@mastra/core/tools';
import { config } from '../config';
import { getAuthHeaders } from '../auth';
import { logger } from '../../../logger';
import { decodeErrorMessage } from '../utility/error';
import {
  userSchema,
  preferenceSchema,
} from './schemas';

// Schema for a successful response, containing the updated user object.
const successResponseSchema = z.object({
  success: z.literal(true),
  data: userSchema,
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
 * @tool editUserPref
 * @description A tool for editing the preferences of a specific user.
 */
export const editUserPref = createTool({
  id: 'edit-user-pref',
  description: 'Edits preferences for a specific user.',
  inputSchema: z.object({
    userId: z.number().describe('The ID of the user whose preferences are to be edited.'),
    preferences: z.array(preferenceSchema.omit({ userId: true })).describe('An array of preference objects to set.'),
  }),
  outputSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      const message = 'CMS URL is not configured.';
      logger.error(message);
      return { success: false as const, message };
    }

    const { userId, preferences } = context;
    const url = new URL(`${config.cmsUrl}/api/user/pref/${userId}`);

    try {
      logger.info({ userId, preferences }, 'Attempting to edit user preferences.');

      const response = await fetch(url.toString(), {
        method: 'PUT',
        headers: {
          ...(await getAuthHeaders()),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(preferences),
      });

      const responseData = await response.json();

      if (!response.ok) {
        const decodedError = decodeErrorMessage(responseData);
        const message = `Failed to edit user preferences. API responded with status ${response.status}.`;
        logger.error({ status: response.status, response: decodedError, userId }, message);
        return { success: false as const, message, errorData: decodedError };
      }

      const validationResult = userSchema.safeParse(responseData);

      if (!validationResult.success) {
        const message = 'User preferences edit response validation failed.';
        logger.error({ error: validationResult.error.flatten(), data: responseData }, message);
        return { success: false as const, message, error: validationResult.error, errorData: responseData };
      }
      
      logger.info({ userId }, `Successfully edited preferences for user ID ${userId}.`);
      return { success: true as const, data: validationResult.data };

    } catch (error: unknown) {
      const message = `An unexpected error occurred while editing user preferences for user ID ${userId}.`;
      logger.error({ error, userId }, message);
      return {
        success: false as const,
        message,
        error: error instanceof Error ? { name: error.name, message: error.message } : error,
      };
    }
  },
});
