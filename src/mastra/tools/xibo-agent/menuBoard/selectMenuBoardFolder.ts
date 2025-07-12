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
 * @module selectMenuBoardFolder
 * @description This module provides a tool to move a menu board to a different folder.
 * It implements the menu board folder selection API endpoint.
 */
import { z } from 'zod';
import { createTool } from '@mastra/core/tools';
import { config } from '../config';
import { getAuthHeaders } from '../auth';
import { logger } from '../../../index';
import { menuBoardSchema } from './schemas';
import { decodeErrorMessage } from '../utility/error';

// Schema for the input of the selectMenuBoardFolder tool
const inputSchema = z.object({
  menuId: z.number().describe('The ID of the menu board to move.'),
  folderId: z.number().describe('The ID of the target destination folder.'),
});

// Schema for a successful response
const successResponseSchema = z.object({
  success: z.literal(true),
  data: menuBoardSchema,
});

// Schema for an error response
const errorResponseSchema = z.object({
  success: z.literal(false),
  message: z.string().describe('A human-readable error message.'),
  error: z.any().optional().describe('Optional technical details about the error.'),
  errorData: z.any().optional().describe('The raw error data from the API.'),
});

// The output schema for the tool
const outputSchema = z.union([successResponseSchema, errorResponseSchema]);

type Output = z.infer<typeof outputSchema>;

/**
 * @tool selectMenuBoardFolder
 * @description A tool to move a menu board to a new parent folder.
 */
export const selectMenuBoardFolder = createTool({
  id: 'select-menu-board-folder',
  description: 'Move a menu board to a new parent folder.',
  inputSchema,
  outputSchema,
  execute: async ({ context }): Promise<Output> => {
    if (!config.cmsUrl) {
      const message = 'CMS URL is not configured.';
      logger.error(message);
      return { success: false, message };
    }

    const { menuId, folderId } = context;
    const url = new URL(`${config.cmsUrl}/api/menuboard/${menuId}/selectfolder`);
    const params = new URLSearchParams({ folderId: String(folderId) });

    try {
      logger.info({ menuId, folderId }, 'Attempting to move menu board to new folder.');

      const response = await fetch(url.toString(), {
        method: 'PUT',
        headers: {
          ...(await getAuthHeaders()),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
      });

      const responseText = await response.text();
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        responseData = responseText;
      }

      if (!response.ok) {
        const decodedError = decodeErrorMessage(responseText);
        const message = `Failed to move menu board. API responded with status ${response.status}.`;
        logger.error({ status: response.status, response: decodedError, menuId, folderId }, message);
        return { success: false, message, errorData: decodedError };
      }

      const validationResult = menuBoardSchema.safeParse(responseData);

      if (!validationResult.success) {
        const message = 'Select menu board folder response validation failed.';
        logger.error({ error: validationResult.error.flatten(), data: responseData }, message);
        return { success: false, message, error: validationResult.error, errorData: responseData };
      }

      logger.info({ menuBoard: validationResult.data }, `Successfully moved menu board ${menuId} to folder ${folderId}.`);
      return { success: true, data: validationResult.data };

    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
      logger.error({ error, menuId, folderId }, `An unexpected error occurred in selectMenuBoardFolder: ${message}`);
      return {
        success: false,
        message: `An unexpected error occurred: ${message}`,
        error: error,
      };
    }
  },
}); 