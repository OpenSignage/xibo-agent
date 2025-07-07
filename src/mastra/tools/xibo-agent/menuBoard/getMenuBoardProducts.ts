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
 * This module provides a tool to retrieve menu board products from the Xibo CMS.
 */

import { z } from 'zod';
import { createTool } from '@mastra/core/tools';
import { config } from '../config';
import { getAuthHeaders } from '../auth';
import { logger } from '../../../index';
import { menuBoardProductSchema } from './schemas';

const inputSchema = z.object({
  menuCategoryId: z.number().describe('The ID of the parent menu category.'),
  menuId: z.number().optional().describe('Filter by a specific Menu Board ID.'),
  name: z.string().optional().describe('Filter by product name (supports filtering with %).'),
  code: z.string().optional().describe('Filter by product code.'),
});

const outputSchema = z.union([
  z.object({
    success: z.literal(true),
    message: z.string(),
    data: z.array(menuBoardProductSchema),
  }),
  z.object({
    success: z.literal(false),
    message: z.string(),
    error: z.any().optional(),
  }),
]);

export const getMenuBoardProducts = createTool({
  id: 'get-menu-board-products',
  description: 'Search for and retrieve menu board products.',
  inputSchema,
  outputSchema,
  execute: async ({ context: input }): Promise<z.infer<typeof outputSchema>> => {
    try {
      // Ensure CMS URL is configured
      if (!config.cmsUrl) {
        return { success: false, message: 'CMS URL is not configured.' };
      }
      
      const { menuCategoryId, ...filterParams } = input;
      
      // Get authentication headers
      const headers = await getAuthHeaders();
      const params = new URLSearchParams();
      
      // Prepare request parameters from input context
      Object.entries(filterParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });

      const url = `${config.cmsUrl}/api/menuboard/${menuCategoryId}/products?${params.toString()}`;
      logger.debug(`getMenuBoardProducts: Requesting URL = ${url}`);

      // Make the API call to get menu board products
      const response = await fetch(url, { headers });
      const responseData = await response.json();

      // Handle non-successful responses
      if (!response.ok) {
        logger.error(`getMenuBoardProducts: HTTP error: ${response.status}`, { error: responseData });
        return { success: false, message: `HTTP error! status: ${response.status}`, error: responseData };
      }
      
      // Validate the response data against the schema
      const validatedData = z.array(menuBoardProductSchema).parse(responseData);

      // Handle cases where no data is found
      if (validatedData.length === 0) {
        return { success: true, message: 'No menu board products found matching the criteria.', data: [] };
      }
      
      return { success: true, message: 'Menu board products retrieved successfully.', data: validatedData };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      logger.error('getMenuBoardProducts: An unexpected error occurred', { error });
      
      // Handle validation errors specifically
      if (error instanceof z.ZodError) {
        return { success: false, message: 'Validation error occurred.', error: error.issues };
      }
      
      // Handle other unexpected errors
      return { success: false, message: `An unexpected error occurred: ${errorMessage}`, error };
    }
  },
}); 