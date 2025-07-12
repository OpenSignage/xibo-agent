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
 * @module getMenuBoardCategories
 * @description This module provides a tool to retrieve menu board categories from the Xibo CMS.
 * It implements the menu board category listing API endpoint and supports filtering.
 */
import { z } from 'zod';
import { createTool } from '@mastra/core/tools';
import { config } from '../config';
import { getAuthHeaders } from '../auth';
import { logger } from '../../../index';
import { menuBoardCategorySchema } from './schemas';
import { decodeErrorMessage } from '../utility/error';

// Schema for the input of the getMenuBoardCategories tool
const inputSchema = z.object({
  menuId: z.number().describe('The ID of the parent menu board.'),
  menuCategoryId: z.number().optional().describe('Filter by a specific Menu Category ID.'),
  name: z.string().optional().describe('Filter by category name (supports filtering with %).'),
  code: z.string().optional().describe('Filter by category code.'),
});

// Schema for a successful response
const successResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(menuBoardCategorySchema),
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
 * @tool getMenuBoardCategories
 * @description A tool for searching and retrieving categories for a specific menu board.
 */
export const getMenuBoardCategories = createTool({
  id: 'get-menu-board-categories',
  description: 'Search for and retrieve menu board categories.',
  inputSchema,
  outputSchema,
  execute: async ({ context }): Promise<Output> => {
    if (!config.cmsUrl) {
      const message = 'CMS URL is not configured.';
      logger.error(message);
      return { success: false, message };
    }

    const { menuId, ...filterParams } = context;
    const url = new URL(`${config.cmsUrl}/api/menuboard/${menuId}/categories`);
    const params = new URLSearchParams();

    Object.entries(filterParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, String(value));
      }
    });
    url.search = params.toString();

    try {
      logger.info({ url: url.toString() }, `Attempting to retrieve categories for menu board ${menuId}.`);

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: await getAuthHeaders(),
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
        const message = `Failed to get menu board categories. API responded with status ${response.status}.`;
        logger.error({ status: response.status, response: decodedError }, message);
        return { success: false, message, errorData: decodedError };
      }

      const validationResult = z.array(menuBoardCategorySchema).safeParse(responseData);

      if (!validationResult.success) {
        const message = 'Get menu board categories response validation failed.';
        logger.error({ error: validationResult.error.flatten(), data: responseData }, message);
        return { success: false, message, error: validationResult.error, errorData: responseData };
      }

      logger.info(`Successfully retrieved ${validationResult.data.length} category/categories.`);
      return { success: true, data: validationResult.data };

    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
      logger.error({ error }, `An unexpected error occurred in getMenuBoardCategories: ${message}`);
      return {
        success: false,
        message: `An unexpected error occurred: ${message}`,
        error: error,
      };
    }
  },
}); 