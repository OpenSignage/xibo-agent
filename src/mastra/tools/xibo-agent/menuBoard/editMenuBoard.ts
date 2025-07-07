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
 * This module provides a tool to edit an existing menu board in the Xibo CMS.
 */

import { z } from 'zod';
import { createTool } from '@mastra/core/tools';
import { config } from '../config';
import { getAuthHeaders } from '../auth';
import { logger } from '../../../index';
import { menuBoardSchema } from './schemas';

const inputSchema = z.object({
  menuId: z.number().describe('The ID of the menu board to edit.'),
  name: z.string().describe('The new name for the menu board.'),
  description: z.string().optional().describe('The new description for the menu board.'),
  code: z.string().optional().describe('The new code for the menu board.'),
  folderId: z.number().optional().describe('The new parent folder ID.'),
});

const outputSchema = z.union([
  z.object({
    success: z.literal(true),
    message: z.string(),
    data: menuBoardSchema,
  }),
  z.object({
    success: z.literal(false),
    message: z.string(),
    error: z.any().optional(),
  }),
]);

export const editMenuBoard = createTool({
  id: 'edit-menu-board',
  description: 'Edit an existing menu board.',
  inputSchema,
  outputSchema,
  execute: async ({ context: input }): Promise<z.infer<typeof outputSchema>> => {
    try {
      // Ensure CMS URL is configured
      if (!config.cmsUrl) {
        return { success: false, message: 'CMS URL is not configured.' };
      }
      
      const { menuId, ...bodyParams } = input;
      
      // Get authentication headers
      const headers = await getAuthHeaders();
      const params = new URLSearchParams();

      // Prepare request parameters from input context
      Object.entries(bodyParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });
      
      const url = `${config.cmsUrl}/api/menuboard/${menuId}`;
      logger.debug(`editMenuBoard: Requesting URL = ${url}, Body = ${params.toString()}`);
      
      // Make the API call to edit the menu board
      const response = await fetch(url, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });

      const responseData = await response.json();

      // Handle non-successful responses
      if (!response.ok) {
        logger.error(`editMenuBoard: HTTP error: ${response.status}`, { error: responseData });
        return { success: false, message: `HTTP error! status: ${response.status}`, error: responseData };
      }

      // Validate the response data against the schema
      const validatedData = menuBoardSchema.parse(responseData);
      logger.info(`editMenuBoard: Successfully edited menu board '${validatedData.name}'.`, { menuId: validatedData.menuId });
      return { success: true, message: 'Menu board edited successfully.', data: validatedData };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      logger.error('editMenuBoard: An unexpected error occurred', { error });

      // Handle validation errors specifically
      if (error instanceof z.ZodError) {
        return { success: false, message: 'Validation error occurred.', error: error.issues };
      }
      
      // Handle other unexpected errors
      return { success: false, message: `An unexpected error occurred: ${errorMessage}`, error };
    }
  },
}); 