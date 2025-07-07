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
 * This module provides a tool to edit an existing menu board product.
 */

import { z } from 'zod';
import { createTool } from '@mastra/core/tools';
import { config } from '../config';
import { getAuthHeaders } from '../auth';
import { logger } from '../../../index';
import { menuBoardProductSchema } from './schemas';

const inputSchema = z.object({
  menuProductId: z.number().describe('The ID of the menu board product to edit.'),
  name: z.string().describe('The new name for the product.'),
  displayOrder: z.number().describe('The new display order of the product.'),
  description: z.string().optional().describe('The new description for the product.'),
  price: z.number().optional().describe('The new price of the product.'),
  allergyInfo: z.string().optional().describe('New allergy information for the product.'),
  calories: z.number().optional().describe('New calorie count for the product.'),
  availability: z.number().optional().describe('New flag indicating product availability.'),
  mediaId: z.number().optional().describe('The new media ID to associate with the product.'),
  code: z.string().optional().describe('The new code for the product.'),
  productOptions: z.array(z.string()).optional().describe('An array of new product options.'),
  productValues: z.array(z.string()).optional().describe('An array of new values corresponding to product options.'),
});

const outputSchema = z.union([
  z.object({
    success: z.literal(true),
    message: z.string(),
    data: menuBoardProductSchema,
  }),
  z.object({
    success: z.literal(false),
    message: z.string(),
    error: z.any().optional(),
  }),
]);

export const editMenuBoardProduct = createTool({
  id: 'edit-menu-board-product',
  description: 'Edit an existing menu board product.',
  inputSchema,
  outputSchema,
  execute: async ({ context: input }): Promise<z.infer<typeof outputSchema>> => {
    try {
      if (!config.cmsUrl) {
        return { success: false, message: 'CMS URL is not configured.' };
      }
      
      const { menuProductId, ...bodyParams } = input;
      const headers = await getAuthHeaders();
      const params = new URLSearchParams();

      for (const [key, value] of Object.entries(bodyParams)) {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            value.forEach(item => params.append(`${key}[]`, String(item)));
          } else {
            params.append(key, String(value));
          }
        }
      }
      
      const url = `${config.cmsUrl}/api/menuboard/${menuProductId}/product`;
      logger.debug(`editMenuBoardProduct: Requesting URL = ${url}, Body = ${params.toString()}`);
      
      const response = await fetch(url, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });

      const responseData = await response.json();

      if (!response.ok) {
        logger.error(`editMenuBoardProduct: HTTP error: ${response.status}`, { error: responseData });
        return { success: false, message: `HTTP error! status: ${response.status}`, error: responseData };
      }

      const validatedData = menuBoardProductSchema.parse(responseData.data);
      return { success: true, message: 'Menu board product edited successfully.', data: validatedData };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      logger.error('editMenuBoardProduct: An unexpected error occurred', { error });

      if (error instanceof z.ZodError) {
        return { success: false, message: 'Validation error occurred.', error: error.issues };
      }
      
      return { success: false, message: `An unexpected error occurred: ${errorMessage}`, error };
    }
  },
}); 