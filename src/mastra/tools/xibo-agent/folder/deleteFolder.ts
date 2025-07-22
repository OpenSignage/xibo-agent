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
 * @module deleteFolder
 * @description This module provides a tool to delete a folder from the Xibo CMS.
 * It handles the necessary API calls and error handling for the deletion process.
 */
import { z } from 'zod';
import { createTool } from '@mastra/core/tools';
import { config } from '../config';
import { getAuthHeaders } from '../auth';
import { logger } from '../../../logger';
import { decodeErrorMessage } from '../utility/error';
import { errorResponseSchema } from './schemas';

/**
 * Defines the schema for a successful deletion response.
 */
const successResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
});

/**
 * The output schema is a union of a successful response or an error response.
 */
const outputSchema = z.union([successResponseSchema, errorResponseSchema]);

/**
 * @tool deleteFolder
 * @description A tool to delete an existing folder from the Xibo CMS.
 */
export const deleteFolder = createTool({
  id: 'delete-folder',
  description: 'Deletes a folder from the Xibo CMS.',
  inputSchema: z.object({
    folderId: z.number().describe('The ID of the folder to delete. This is required.'),
  }),
  outputSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      const message = 'CMS URL is not configured.';
      logger.error(message);
      return { success: false as const, message };
    }

    const { folderId } = context;
    const url = new URL(`${config.cmsUrl}/api/folders/${folderId}`);

    try {
      logger.info({ folderId }, `Attempting to delete folder.`);

      const headers = await getAuthHeaders();
      const response = await fetch(url.toString(), {
        method: 'DELETE',
        headers,
      });

      if (response.status === 204) {
        const message = `Folder with ID ${folderId} deleted successfully.`;
        logger.info({ folderId }, message);
        return { success: true as const, message };
      }

      const responseData = await response.json();
      
      if (!response.ok) {
        const decodedError = decodeErrorMessage(responseData);
        const message = `Failed to delete folder. API responded with status ${response.status}.`;
        logger.error({ status: response.status, response: decodedError }, message);
        return {
          success: false as const,
          message,
          errorData: decodedError,
        };
      }
      
      // Should not be reached if 204 is handled, but as a fallback.
      const message = `Folder with ID ${folderId} deleted successfully.`;
      logger.info({ folderId }, message);
      return { success: true as const, message };

    } catch (error: unknown) {
      const message = 'An unexpected error occurred while deleting the folder.';
      logger.error({ error, folderId }, message);
      return {
        success: false as const,
        message,
        error: error instanceof Error ? { name: error.name, message: error.message } : error,
      };
    }
  },
}); 