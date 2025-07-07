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
 * This module provides a tool to delete a menu board from the Xibo CMS.
 */

import { z } from 'zod';
import { createTool } from '@mastra/core/tools';
import { config } from '../config';
import { getAuthHeaders } from '../auth';
import { logger } from '../../../index';

const inputSchema = z.object({
  menuId: z.number().describe('The ID of the menu board to delete.'),
});

const outputSchema = z.union([
  z.object({
    success: z.literal(true),
    message: z.string(),
  }),
  z.object({
    success: z.literal(false),
    message: z.string(),
    error: z.any().optional(),
  }),
]);

export const deleteMenuBoard = createTool({
  id: 'delete-menu-board',
  description: 'Delete a specific menu board.',
  inputSchema,
  outputSchema,
  execute: async ({ context: input }): Promise<z.infer<typeof outputSchema>> => {
    try {
      // Ensure CMS URL is configured
      if (!config.cmsUrl) {
        return { success: false, message: 'CMS URL is not configured.' };
      }

      // Get authentication headers
      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/menuboard/${input.menuId}`;
      logger.debug(`deleteMenuBoard: Requesting URL = ${url}`);

      // Make the API call to delete the menu board
      const response = await fetch(url, {
        method: 'DELETE',
        headers,
      });

      // Handle non-successful responses
      if (!response.ok) {
        const errorData = await response.text();
        logger.error(`deleteMenuBoard: HTTP error: ${response.status}`, { error: errorData });
        return { success: false, message: `HTTP error! status: ${response.status}`, error: errorData };
      }
      
      // A successful DELETE request returns a 204 No Content response
      return { success: true, message: 'Menu board deleted successfully.' };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      logger.error('deleteMenuBoard: An unexpected error occurred', { error });

      // Handle other unexpected errors
      return { success: false, message: `An unexpected error occurred: ${errorMessage}`, error };
    }
  },
}); 