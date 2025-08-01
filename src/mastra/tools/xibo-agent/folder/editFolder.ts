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
 * @module editFolder
 * @description This module provides a tool to edit an existing folder in the Xibo CMS.
 * It primarily allows for changing the folder's name.
 */
import { z } from 'zod';
import { createTool } from '@mastra/core/tools';
import { config } from '../config';
import { getAuthHeaders } from '../auth';
import { logger } from '../../../logger';
import { decodeErrorMessage } from '../utility/error';
import {
  folderSchema,
  errorResponseSchema,
} from './schemas';

/**
 * The output schema is a union of possible responses:
 * - A successful response with the updated folder data.
 * - An error response.
 */
const outputSchema = z.union([
    z.object({
        success: z.literal(true),
        data: folderSchema,
    }),
    errorResponseSchema,
]);

/**
 * @tool editFolder
 * @description A tool to edit an existing folder in the Xibo CMS.
 * It primarily allows for changing the folder's name.
 */
export const editFolder = createTool({
  id: 'edit-folder',
  description: 'Edits an existing folder in the Xibo CMS.',
  inputSchema: z.object({
    folderId: z.number().describe('The ID of the folder to edit. This is required.'),
    text: z.string().describe('The new name for the folder. This is required.'),
  }),
  outputSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      const message = 'CMS URL is not configured.';
      logger.error(message);
      return { success: false as const, message };
    }

    const url = new URL(`${config.cmsUrl}/api/folders/${context.folderId}`);
    const formData = new URLSearchParams();
    formData.append('text', context.text);

    try {
      logger.info({ folderId: context.folderId, newName: context.text }, 'Attempting to edit folder.');
      
      const headers = {
        ...(await getAuthHeaders()),
        'Content-Type': 'application/x-www-form-urlencoded',
      };

      const response = await fetch(url.toString(), {
        method: 'PUT',
        headers: headers,
        body: formData.toString(),
      });

      const responseData = await response.json();

      if (!response.ok) {
        const decodedError = decodeErrorMessage(responseData);
        const message = `Failed to edit folder. API responded with status ${response.status}.`;
        logger.error({ status: response.status, response: decodedError }, message);
        return {
          success: false as const,
          message,
          errorData: decodedError,
        };
      }

      const validationResult = folderSchema.safeParse(responseData);

      if (!validationResult.success) {
        const message = 'Folder edit response validation failed.';
        logger.error({ error: validationResult.error.flatten(), data: responseData }, message);
        return {
          success: false as const,
          message,
          error: validationResult.error,
          errorData: responseData,
        };
      }

      const updatedFolder = validationResult.data;
      logger.info({ folder: updatedFolder }, `Folder '${updatedFolder.text}' updated successfully.`);
      
      return { success: true as const, data: updatedFolder };
    } catch (error: unknown) {
      const message = 'An unexpected error occurred while editing the folder.';
      logger.error({ error }, message);
      return {
        success: false as const,
        message,
        error: error instanceof Error ? { name: error.name, message: error.message } : error,
      };
    }
  },
}); 