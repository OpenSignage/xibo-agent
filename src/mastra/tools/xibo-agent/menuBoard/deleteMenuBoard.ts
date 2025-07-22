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
 * @module deleteMenuBoard
 * @description This module provides a tool to delete a menu board from the Xibo CMS.
 * It implements the menu board deletion API endpoint.
 */
import { z } from 'zod';
import { createTool } from '@mastra/core/tools';
import { config } from '../config';
import { getAuthHeaders } from '../auth';
import { logger } from '../../../logger';
import { decodeErrorMessage } from '../utility/error';

// Schema for the input of the deleteMenuBoard tool
const inputSchema = z.object({
  menuId: z.number().describe('The ID of the menu board to delete.'),
});

// Schema for a successful response (no data returned on success)
const successResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
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
 * @tool deleteMenuBoard
 * @description A tool for deleting a specific menu board from the Xibo CMS.
 */
export const deleteMenuBoard = createTool({
  id: 'delete-menu-board',
  description: 'Delete a specific menu board.',
  inputSchema,
  outputSchema,
  execute: async ({ context }): Promise<Output> => {
    if (!config.cmsUrl) {
      const message = 'CMS URL is not configured.';
      logger.error(message);
      return { success: false, message };
    }

    const url = new URL(`${config.cmsUrl}/api/menuboard/${context.menuId}`);

    try {
      logger.info({ menuId: context.menuId }, `Attempting to delete menu board.`);

      const response = await fetch(url.toString(), {
        method: 'DELETE',
        headers: await getAuthHeaders(),
      });

      if (response.status === 204) {
        const message = `Successfully deleted menu board with ID ${context.menuId}.`;
        logger.info({ menuId: context.menuId }, message);
        return { success: true, message };
      }

      const responseText = await response.text();
      const decodedError = decodeErrorMessage(responseText);
      const message = `Failed to delete menu board. API responded with status ${response.status}.`;
      logger.error({ status: response.status, response: decodedError, menuId: context.menuId }, message);
      return { success: false, message, errorData: decodedError };

    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
      logger.error({ error, menuId: context.menuId }, `An unexpected error occurred in deleteMenuBoard: ${message}`);
      return {
        success: false,
        message: `An unexpected error occurred: ${message}`,
        error: error,
      };
    }
  },
}); 