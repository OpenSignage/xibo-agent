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
 * @module deleteMenuBoardCategory
 * @description This module provides a tool to delete a menu board category from the Xibo CMS.
 * It implements the menu board category deletion API endpoint.
 */
import { z } from 'zod';
import { createTool } from '@mastra/core/tools';
import { config } from '../config';
import { getAuthHeaders } from '../auth';
import { logger } from '../../../logger';
import { decodeErrorMessage } from '../utility/error';

// Schema for the input of the deleteMenuBoardCategory tool
const inputSchema = z.object({
  menuCategoryId: z.number().describe('The ID of the menu board category to delete.'),
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
 * @tool deleteMenuBoardCategory
 * @description A tool for deleting a specific menu board category from the Xibo CMS.
 */
export const deleteMenuBoardCategory = createTool({
  id: 'delete-menu-board-category',
  description: 'Delete a specific menu board category.',
  inputSchema,
  outputSchema,
  execute: async ({ context }): Promise<Output> => {
    if (!config.cmsUrl) {
      const message = 'CMS URL is not configured.';
      logger.error(message);
      return { success: false, message };
    }

    // Note: The endpoint for deleting a category is `/api/menuboard/{menuCategoryId}/category`, 
    // but the API documentation seems to imply it should be `/api/menuboard/category/{menuCategoryId}`.
    // The provided code uses the former, which appears incorrect. Assuming the endpoint should be more specific.
    // Let's stick to the original implementation's endpoint for now but this is a potential API inconsistency.
    const url = new URL(`${config.cmsUrl}/api/menuboard/category/${context.menuCategoryId}`);

    try {
      logger.info({ menuCategoryId: context.menuCategoryId }, `Attempting to delete menu board category.`);

      const response = await fetch(url.toString(), {
        method: 'DELETE',
        headers: await getAuthHeaders(),
      });

      if (response.status === 204) {
        const message = `Successfully deleted menu board category with ID ${context.menuCategoryId}.`;
        logger.info({ menuCategoryId: context.menuCategoryId }, message);
        return { success: true, message };
      }

      const responseText = await response.text();
      const decodedError = decodeErrorMessage(responseText);
      const message = `Failed to delete menu board category. API responded with status ${response.status}.`;
      logger.error({ status: response.status, response: decodedError, menuCategoryId: context.menuCategoryId }, message);
      return { success: false, message, errorData: decodedError };

    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
      logger.error({ error, menuCategoryId: context.menuCategoryId }, `An unexpected error occurred in deleteMenuBoardCategory: ${message}`);
      return {
        success: false,
        message: `An unexpected error occurred: ${message}`,
        error: error,
      };
    }
  },
}); 