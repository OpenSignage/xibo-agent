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
 * This module provides a tool to move a menu board to a different folder.
 */

import { z } from 'zod';
import { createTool } from '@mastra/core/tools';
import { config } from '../config';
import { getAuthHeaders } from '../auth';
import { logger } from '../../../index';
import { menuBoardSchema } from './schemas';

const inputSchema = z.object({
  menuId: z.number().describe('The ID of the menu board to move.'),
  folderId: z.number().describe('The ID of the target destination folder.'),
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

export const selectMenuBoardFolder = createTool({
  id: 'select-menu-board-folder',
  description: 'Move a menu board to a new parent folder.',
  inputSchema,
  outputSchema,
  execute: async ({ context: input }): Promise<z.infer<typeof outputSchema>> => {
    try {
      // Ensure CMS URL is configured
      if (!config.cmsUrl) {
        return { success: false, message: 'CMS URL is not configured.' };
      }
      
      const { menuId, folderId } = input;
      
      // Get authentication headers
      const headers = await getAuthHeaders();
      const params = new URLSearchParams({ folderId: String(folderId) });
      
      const url = `${config.cmsUrl}/api/menuboard/${menuId}/selectfolder`;
      logger.debug(`selectMenuBoardFolder: Requesting URL = ${url}, Body = ${params.toString()}`);
      
      // Make the API call to change the menu board's folder
      const response = await fetch(url, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });

      const responseData = await response.json();

      // Handle non-successful responses
      if (!response.ok) {
        logger.error(`selectMenuBoardFolder: HTTP error: ${response.status}`, { error: responseData });
        return { success: false, message: `HTTP error! status: ${response.status}`, error: responseData };
      }

      // Validate the response data against the schema
      const validatedData = menuBoardSchema.parse(responseData);
      return { success: true, message: 'Menu board folder changed successfully.', data: validatedData };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      logger.error('selectMenuBoardFolder: An unexpected error occurred', { error });

      // Handle validation errors specifically
      if (error instanceof z.ZodError) {
        return { success: false, message: 'Validation error occurred.', error: error.issues };
      }
      
      // Handle other unexpected errors
      return { success: false, message: `An unexpected error occurred: ${errorMessage}`, error };
    }
  },
}); 