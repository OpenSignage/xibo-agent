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
 * @module addFolder
 * @description This module provides a tool to create new folders in the Xibo CMS.
 * It handles the necessary API calls, data validation, and error handling.
 */
import { z } from 'zod';
import { createTool } from '@mastra/core/tools';
import { config } from '../config';
import { getAuthHeaders } from '../auth';
import { logger } from '../../../index';
import { decodeErrorMessage } from '../utility/error';
import {
  folderSchema,
  errorResponseSchema,
  successResponseSchema,
} from './schemas';

/**
 * The output schema is a union of possible responses:
 * - A successful response with the newly created folder data.
 * - An error response.
 */
const outputSchema = z.union([successResponseSchema, errorResponseSchema]);

/**
 * @tool addFolder
 * @description A tool to create a new folder in the Xibo CMS.
 * It takes a folder name and an optional parent ID as input.
 */
export const addFolder = createTool({
  id: 'add-folder',
  description: 'Adds a new folder to the Xibo CMS.',
  inputSchema: z.object({
    text: z.string().describe('The name for the new folder. This is required.'),
    parentId: z
      .number()
      .optional()
      .describe('The ID of the parent folder. If omitted, it will be a root folder.'),
  }),
  outputSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      const message = 'CMS URL is not configured.';
      logger.error(message);
      return { success: false as const, message };
    }

    const url = new URL(`${config.cmsUrl}/api/folders`);
    const formData = new URLSearchParams();
    formData.append('text', context.text);
    if (context.parentId) {
      formData.append('parentId', String(context.parentId));
    }

    try {
      logger.info({ folderName: context.text }, 'Attempting to create folder.');
      
      const headers = {
        ...(await getAuthHeaders()),
        'Content-Type': 'application/x-www-form-urlencoded',
      };

      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: headers,
        body: formData.toString(),
      });

      const responseData = await response.json();

      if (!response.ok) {
        const decodedError = decodeErrorMessage(responseData);
        const message = `Failed to create folder. API responded with status ${response.status}.`;
        logger.error({ status: response.status, response: decodedError }, message);
        return {
          success: false as const,
          message,
          errorData: decodedError,
        };
      }

      // The API returns an array containing the new folder
      const validationResult = z.array(folderSchema).safeParse(responseData);

      if (!validationResult.success) {
        const message = 'Folder creation response validation failed.';
        logger.error({ error: validationResult.error.flatten(), data: responseData }, message);
        return {
          success: false as const,
          message,
          error: validationResult.error,
          errorData: responseData,
        };
      }

      const newFolder = validationResult.data[0];
      logger.info({ folder: newFolder }, `Folder '${newFolder.text}' created successfully.`);
      
      return { success: true as const, data: validationResult.data };
    } catch (error: unknown) {
      const message = 'An unexpected error occurred while creating the folder.';
      logger.error({ error }, message);
      return {
        success: false as const,
        message,
        error: error instanceof Error ? { name: error.name, message: error.message } : error,
      };
    }
  },
}); 