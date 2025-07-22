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
 * @module deleteUser
 * @description This module provides a tool to delete a user from the Xibo CMS.
 */
import { z } from 'zod';
import { createTool } from '@mastra/core/tools';
import { config } from '../config';
import { getAuthHeaders } from '../auth';
import { logger } from '../../../logger';
import { decodeErrorMessage } from '../utility/error';

// Schema for a generic success response, extended with an optional message.
const successResponseSchema = z.object({
  success: z.literal(true),
  message: z.string().optional(),
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
 * @tool deleteUser
 * @description A tool for deleting a user from the Xibo CMS.
 * It provides options to reassign or delete the user's associated items.
 */
export const deleteUser = createTool({
  id: 'delete-user',
  description: "Deletes a user from the Xibo CMS.",
  inputSchema: z.object({
    userId: z.number().describe('The ID of the user to delete.'),
    reassignTo: z.number().optional().describe('The ID of the user to reassign items to. Required if reassign is true.'),
    deleteItems: z.boolean().optional().describe('Set to true to delete all items owned by the user.'),
  }).refine(data => !data.deleteItems ? data.reassignTo !== undefined : true, {
    message: "reassignTo is required when not deleting items.",
    path: ["reassignTo"],
  }),
  outputSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      const message = 'CMS URL is not configured.';
      logger.error(message);
      return { success: false as const, message };
    }

    const { userId, reassignTo, deleteItems } = context;
    const url = new URL(`${config.cmsUrl}/api/user/${userId}`);
    const formData = new URLSearchParams();

    if (deleteItems) {
      formData.append('deleteItems', '1');
    } else if (reassignTo) {
      formData.append('reassignTo', String(reassignTo));
    }

    try {
      logger.info({ userId, deleteItems, reassignTo }, 'Attempting to delete user.');

      const response = await fetch(url.toString(), {
        method: 'DELETE',
        headers: {
            ...(await getAuthHeaders()),
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData.toString(),
      });
      
      if (response.status === 204) {
        const message = `User with ID ${userId} deleted successfully.`;
        logger.info({ userId }, message);
        return { success: true as const, message };
      }
      
      const responseData = await response.json();

      if (!response.ok) {
        const decodedError = decodeErrorMessage(responseData);
        const message = `Failed to delete user. API responded with status ${response.status}.`;
        logger.error({ status: response.status, response: decodedError, userId }, message);
        return { success: false as const, message, errorData: decodedError };
      }

      // This part might not be reached if 204 is the success status, but included for completeness
      const message = `User deletion process completed for user ID ${userId}.`;
      logger.info({ userId, responseData }, message);
      return { success: true as const, message: responseData.message || message };

    } catch (error: unknown) {
      const message = `An unexpected error occurred while deleting user ${userId}.`;
      logger.error({ error, userId }, message);
      return {
        success: false as const,
        message,
        error: error instanceof Error ? { name: error.name, message: error.message } : error,
      };
    }
  },
}); 