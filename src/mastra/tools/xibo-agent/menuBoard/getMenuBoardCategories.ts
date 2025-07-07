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
 * @module
 * This module provides a tool to retrieve menu board categories from the Xibo CMS.
 */

import { z } from 'zod';
import { createTool } from '@mastra/core/tools';
import { config } from '../config';
import { getAuthHeaders } from '../auth';
import { logger } from '../../../index';
import { menuBoardCategorySchema } from './schemas';

const inputSchema = z.object({
  menuId: z.number().describe('The ID of the parent menu board.'),
  menuCategoryId: z.number().optional().describe('Filter by a specific Menu Category ID.'),
  name: z.string().optional().describe('Filter by category name (supports filtering with %).'),
  code: z.string().optional().describe('Filter by category code.'),
});

const outputSchema = z.union([
  z.object({
    success: z.literal(true),
    message: z.string(),
    data: z.array(menuBoardCategorySchema),
  }),
  z.object({
    success: z.literal(false),
    message: z.string(),
    error: z.any().optional(),
  }),
]);

export const getMenuBoardCategories = createTool({
  id: 'get-menu-board-categories',
  description: 'Search for and retrieve menu board categories.',
  inputSchema,
  outputSchema,
  execute: async ({ context: input }): Promise<z.infer<typeof outputSchema>> => {
    try {
      if (!config.cmsUrl) {
        return { success: false, message: 'CMS URL is not configured.' };
      }
      
      const { menuId, ...filterParams } = input;
      const headers = await getAuthHeaders();
      const params = new URLSearchParams();
      
      Object.entries(filterParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });

      const url = `${config.cmsUrl}/api/menuboard/${menuId}/categories?${params.toString()}`;
      logger.debug(`getMenuBoardCategories: Requesting URL = ${url}`);

      const response = await fetch(url, { headers });
      const responseData = await response.json();

      if (!response.ok) {
        logger.error(`getMenuBoardCategories: HTTP error: ${response.status}`, { error: responseData });
        return { success: false, message: `HTTP error! status: ${response.status}`, error: responseData };
      }
      
      const validatedData = z.array(menuBoardCategorySchema).parse(responseData.data);

      if (validatedData.length === 0) {
        return { success: true, message: 'No menu board categories found matching the criteria.', data: [] };
      }
      
      return { success: true, message: 'Menu board categories retrieved successfully.', data: validatedData };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      logger.error('getMenuBoardCategories: An unexpected error occurred', { error });
      
      if (error instanceof z.ZodError) {
        return { success: false, message: 'Validation error occurred.', error: error.issues };
      }
      
      return { success: false, message: `An unexpected error occurred: ${errorMessage}`, error };
    }
  },
}); 