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
 * This module provides a tool to edit an existing menu board category.
 */

import { z } from 'zod';
import { createTool } from '@mastra/core/tools';
import { config } from '../config';
import { getAuthHeaders } from '../auth';
import { logger } from '../../../index';
import { menuBoardCategorySchema } from './schemas';

const inputSchema = z.object({
  menuCategoryId: z.number().describe('The ID of the menu board category to edit.'),
  name: z.string().describe('The new name for the category.'),
  description: z.string().optional().describe('The new description for the category.'),
  code: z.string().optional().describe('The new code for the category.'),
  mediaId: z.number().optional().describe('The new media ID to associate with the category.'),
});

const outputSchema = z.union([
  z.object({
    success: z.literal(true),
    message: z.string(),
    data: menuBoardCategorySchema,
  }),
  z.object({
    success: z.literal(false),
    message: z.string(),
    error: z.any().optional(),
  }),
]);

export const editMenuBoardCategory = createTool({
  id: 'edit-menu-board-category',
  description: 'Edit an existing menu board category.',
  inputSchema,
  outputSchema,
  execute: async ({ context: input }): Promise<z.infer<typeof outputSchema>> => {
    try {
      // Ensure CMS URL is configured
      if (!config.cmsUrl) {
        return { success: false, message: 'CMS URL is not configured.' };
      }
      
      const { menuCategoryId, ...bodyParams } = input;
      
      // Get authentication headers
      const headers = await getAuthHeaders();
      const params = new URLSearchParams();

      // Prepare request parameters from input context
      Object.entries(bodyParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });
      
      const url = `${config.cmsUrl}/api/menuboard/${menuCategoryId}/category`;
      logger.debug(`editMenuBoardCategory: Requesting URL = ${url}, Body = ${params.toString()}`);
      
      // Make the API call to edit the menu board category
      const response = await fetch(url, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });

      const responseData = await response.json();

      // Handle non-successful responses
      if (!response.ok) {
        logger.error(`editMenuBoardCategory: HTTP error: ${response.status}`, { error: responseData });
        return { success: false, message: `HTTP error! status: ${response.status}`, error: responseData };
      }

      // Validate the response data against the schema
      const validatedData = menuBoardCategorySchema.parse(responseData);
      return { success: true, message: 'Menu board category edited successfully.', data: validatedData };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      logger.error('editMenuBoardCategory: An unexpected error occurred', { error });

      // Handle validation errors specifically
      if (error instanceof z.ZodError) {
        return { success: false, message: 'Validation error occurred.', error: error.issues };
      }
      
      // Handle other unexpected errors
      return { success: false, message: `An unexpected error occurred: ${errorMessage}`, error };
    }
  },
}); 