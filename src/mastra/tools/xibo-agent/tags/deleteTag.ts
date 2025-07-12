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
 * @module deleteTag
 * @description Provides a tool to delete a tag from the Xibo CMS.
 * It implements the tag deletion API endpoint and handles success and error responses.
 */
import { z } from 'zod';
import { createTool } from '@mastra/core/tools';
import { config } from '../config';
import { getAuthHeaders } from '../auth';
import { logger } from '../../../index';
import { decodeErrorMessage } from '../utility/error';

/**
 * Defines the schema for a successful response.
 */
const successResponseSchema = z.object({
  success: z.literal(true),
  message: z.string().describe('A confirmation message indicating success.'),
});

/**
 * Defines the schema for a failed operation, including a success flag and error details.
 */
const errorResponseSchema = z.object({
  success: z.literal(false),
  message: z.string().describe('A human-readable error message.'),
  error: z.any().optional().describe('Optional technical details about the error.'),
  errorData: z.any().optional().describe('The raw error data from the API.'),
});

/**
 * The output schema for the tool, which can be either a success or an error response.
 */
const outputSchema = z.union([successResponseSchema, errorResponseSchema]);

/**
 * @tool deleteTag
 * @description A tool for deleting an existing tag from the Xibo CMS by its ID.
 */
export const deleteTag = createTool({
  id: 'delete-tag',
  description: 'Delete a tag from Xibo CMS by its ID.',
  inputSchema: z.object({
    tagId: z.number().describe('The ID of the tag to delete.'),
  }),
  outputSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      const message = 'CMS URL is not configured.';
      logger.error(message);
      return { success: false, message };
    }

    const url = new URL(`${config.cmsUrl}/api/tag/${context.tagId}`);

    try {
      logger.info({ tagId: context.tagId }, 'Attempting to delete tag.');

      const response = await fetch(url.toString(), {
        method: 'DELETE',
        headers: await getAuthHeaders(),
      });

      // A successful deletion returns a 204 No Content status.
      if (response.status === 204) {
        const message = `Tag with ID ${context.tagId} deleted successfully.`;
        logger.info({ tagId: context.tagId }, message);
        return { success: true, message };
      }

      const responseText = await response.text();
      const decodedError = decodeErrorMessage(responseText);
      const message = `Failed to delete tag. API responded with status ${response.status}.`;
      logger.error({ status: response.status, response: decodedError, tagId: context.tagId }, message);
      return { success: false, message, errorData: decodedError };
      
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
      logger.error({ error, tagId: context.tagId }, `An unexpected error occurred while deleting tag: ${message}`);
      return {
        success: false,
        message: `An unexpected error occurred: ${message}`,
        error,
      };
    }
  },
}); 