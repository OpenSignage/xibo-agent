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
 * @module editMenuBoard
 * @description Provides a tool to edit an existing menu board in the Xibo CMS.
 * It implements the menu board update API endpoint and handles the necessary validation.
 */
import { z } from 'zod';
import { createTool } from '@mastra/core/tools';
import { config } from '../config';
import { getAuthHeaders } from '../auth';
import { logger } from '../../../logger';
import { menuBoardSchema } from './schemas';
import { decodeErrorMessage } from '../utility/error';

// Schema for the input of the editMenuBoard tool
const inputSchema = z.object({
  menuId: z.number().describe('The ID of the menu board to edit.'),
  name: z.string().optional().describe('The new name for the menu board.'),
  description: z.string().optional().describe('The new description for the menu board.'),
  code: z.string().optional().describe('The new code for the menu board.'),
  folderId: z.number().optional().describe('The new parent folder ID.'),
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
 * @tool editMenuBoard
 * @description A tool for editing an existing menu board in the Xibo CMS.
 */
export const editMenuBoard = createTool({
  id: 'edit-menu-board',
  description: 'Edit an existing menu board.',
  inputSchema,
  outputSchema,
  execute: async ({ context }): Promise<Output> => {
    if (!config.cmsUrl) {
      const message = 'CMS URL is not configured.';
      logger.error(message);
      return { success: false, message };
    }

    const { menuId, ...bodyParams } = context;
    const url = new URL(`${config.cmsUrl}/api/menuboard/${menuId}`);
    const params = new URLSearchParams();

    Object.entries(bodyParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, String(value));
      }
    });
    
    if (params.toString() === '') {
        const message = 'No fields provided to edit.';
        logger.warn({ context }, message);
        return { success: false, message };
    }

    try {
      logger.info({ menuId, body: params.toString() }, 'Attempting to edit menu board.');

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
        const message = `Failed to edit menu board. API responded with status ${response.status}.`;
        logger.error({ status: response.status, response: decodedError, menuId }, message);
        return { success: false, message, errorData: decodedError };
      }

      const validationResult = menuBoardSchema.safeParse(responseData);

      if (!validationResult.success) {
        const message = 'Edit menu board response validation failed.';
        logger.error({ error: validationResult.error.flatten(), data: responseData }, message);
        return { success: false, message, error: validationResult.error, errorData: responseData };
      }

      logger.info({ menuBoard: validationResult.data }, `Successfully edited menu board '${validationResult.data.name}'.`);
      return { success: true, data: validationResult.data };

    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
      logger.error({ error, menuId }, `An unexpected error occurred in editMenuBoard: ${message}`);
      return {
        success: false,
        message: `An unexpected error occurred: ${message}`,
        error: error,
      };
    }
  },
}); 