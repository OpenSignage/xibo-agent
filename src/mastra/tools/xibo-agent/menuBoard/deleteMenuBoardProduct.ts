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
 * @module deleteMenuBoardProduct
 * @description This module provides a tool to delete a menu board product from the Xibo CMS.
 * It implements the menu board product deletion API endpoint.
 */
import { z } from 'zod';
import { createTool } from '@mastra/core/tools';
import { config } from '../config';
import { getAuthHeaders } from '../auth';
import { logger } from '../../../logger';
import { decodeErrorMessage } from '../utility/error';

// Schema for the input of the deleteMenuBoardProduct tool
const inputSchema = z.object({
  menuProductId: z.number().describe('The ID of the menu board product to delete.'),
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
 * @tool deleteMenuBoardProduct
 * @description A tool for deleting a specific menu board product from the Xibo CMS.
 */
export const deleteMenuBoardProduct = createTool({
  id: 'delete-menu-board-product',
  description: 'Delete a specific menu board product.',
  inputSchema,
  outputSchema,
  execute: async ({ context }): Promise<Output> => {
    if (!config.cmsUrl) {
      const message = 'CMS URL is not configured.';
      logger.error(message);
      return { success: false, message };
    }

    const url = new URL(`${config.cmsUrl}/api/menuboard/product/${context.menuProductId}`);

    try {
      logger.info({ menuProductId: context.menuProductId }, `Attempting to delete menu board product.`);

      const response = await fetch(url.toString(), {
        method: 'DELETE',
        headers: await getAuthHeaders(),
      });

      if (response.status === 204) {
        const message = `Successfully deleted menu board product with ID ${context.menuProductId}.`;
        logger.info({ menuProductId: context.menuProductId }, message);
        return { success: true, message };
      }

      const responseText = await response.text();
      const decodedError = decodeErrorMessage(responseText);
      const message = `Failed to delete menu board product. API responded with status ${response.status}.`;
      logger.error({ status: response.status, response: decodedError, menuProductId: context.menuProductId }, message);
      return { success: false, message, errorData: decodedError };

    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
      logger.error({ error, menuProductId: context.menuProductId }, `An unexpected error occurred in deleteMenuBoardProduct: ${message}`);
      return {
        success: false,
        message: `An unexpected error occurred: ${message}`,
        error: error,
      };
    }
  },
}); 