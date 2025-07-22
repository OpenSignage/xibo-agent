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
 * @module addMenuBoardCategory
 * @description This module provides a tool to add a new category to a menu board.
 * It implements the menu board category creation API endpoint and handles the necessary validation.
 */
import { z } from 'zod';
import { createTool } from '@mastra/core/tools';
import { config } from '../config';
import { getAuthHeaders } from '../auth';
import { logger } from '../../../logger';
import { menuBoardCategorySchema } from './schemas';
import { decodeErrorMessage } from '../utility/error';

// Schema for the input of the addMenuBoardCategory tool
const inputSchema = z.object({
  menuId: z.number().describe('The ID of the parent menu board.'),
  name: z.string().describe('The name for the new category.'),
  description: z.string().optional().describe('An optional description for the category.'),
  code: z.string().optional().describe('An optional code for the category.'),
  mediaId: z.number().optional().describe('The ID of a media item to associate with the category.'),
});

// Schema for a successful response
const successResponseSchema = z.object({
  success: z.literal(true),
  data: menuBoardCategorySchema,
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
 * @tool addMenuBoardCategory
 * @description A tool for creating a new category in a specific menu board.
 */
export const addMenuBoardCategory = createTool({
  id: 'add-menu-board-category',
  description: 'Add a new category to a specific menu board.',
  inputSchema,
  outputSchema,
  execute: async ({ context }): Promise<Output> => {
    if (!config.cmsUrl) {
      const message = 'CMS URL is not configured.';
      logger.error(message);
      return { success: false, message };
    }

    const { menuId, ...bodyParams } = context;
    const url = new URL(`${config.cmsUrl}/api/menuboard/${menuId}/category`);
    const params = new URLSearchParams();

    Object.entries(bodyParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, String(value));
      }
    });

    try {
      logger.info({ body: params.toString() }, `Attempting to add new category to menu board ${menuId}.`);

      const response = await fetch(url.toString(), {
        method: 'POST',
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
        const message = `Failed to add menu board category. API responded with status ${response.status}.`;
        logger.error({ status: response.status, response: decodedError }, message);
        return { success: false, message, errorData: decodedError };
      }

      const validationResult = menuBoardCategorySchema.safeParse(responseData);

      if (!validationResult.success) {
        const message = 'Add menu board category response validation failed.';
        logger.error({ error: validationResult.error.flatten(), data: responseData }, message);
        return { success: false, message, error: validationResult.error, errorData: responseData };
      }

      logger.info({ category: validationResult.data }, `Successfully added category '${validationResult.data.name}'.`);
      return { success: true, data: validationResult.data };

    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
      logger.error({ error }, `An unexpected error occurred in addMenuBoardCategory: ${message}`);
      return {
        success: false,
        message: `An unexpected error occurred: ${message}`,
        error: error,
      };
    }
  },
}); 