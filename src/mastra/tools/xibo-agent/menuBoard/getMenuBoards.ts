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
 * This module provides a tool to retrieve menu boards from the Xibo CMS.
 * It supports filtering by various properties.
 */

import { z } from 'zod';
import { createTool } from '@mastra/core/tools';
import { config } from '../config';
import { getAuthHeaders } from '../auth';
import { logger } from '../../../index';
import { menuBoardSchema } from './schemas';

const inputSchema = z.object({
  menuId: z.number().optional().describe('Filter by a specific Menu Board ID.'),
  userId: z.number().optional().describe('Filter by the owner user ID.'),
  folderId: z.number().optional().describe('Filter by the parent folder ID.'),
  name: z.string().optional().describe('Filter by menu board name (supports filtering with %).'),
  code: z.string().optional().describe('Filter by menu board code.'),
});

const outputSchema = z.union([
  z.object({
    success: z.literal(true),
    message: z.string(),
    data: z.array(menuBoardSchema),
  }),
  z.object({
    success: z.literal(false),
    message: z.string(),
    error: z.any().optional(),
  }),
]);

export const getMenuBoards = createTool({
  id: 'get-menu-boards',
  description: 'Search for and retrieve menu boards from the CMS.',
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
      const params = new URLSearchParams();
      
      // Prepare request parameters from input context
      Object.entries(input).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });

      const url = `${config.cmsUrl}/api/menuboards?${params.toString()}`;
      logger.debug(`getMenuBoards: Requesting URL = ${url}`);

      // Make the API call to get menu boards
      const response = await fetch(url, { headers });

      const responseData = await response.json();

      // Handle non-successful responses
      if (!response.ok) {
        logger.error(`getMenuBoards: HTTP error: ${response.status}`, { error: responseData });
        return { success: false, message: `HTTP error! status: ${response.status}`, error: responseData };
      }
      
      // Validate the response data against the schema
      const validatedData = z.array(menuBoardSchema).parse(responseData);

      // Handle cases where no data is found
      if (validatedData.length === 0) {
        return { success: true, message: 'No menu boards found matching the criteria.', data: [] };
      }
      
      return { success: true, message: 'Menu boards retrieved successfully.', data: validatedData };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      logger.error('getMenuBoards: An unexpected error occurred', { error });
      
      // Handle validation errors specifically
      if (error instanceof z.ZodError) {
        return { success: false, message: 'Validation error occurred.', error: error.issues };
      }
      
      // Handle other unexpected errors
      return { success: false, message: `An unexpected error occurred: ${errorMessage}`, error };
    }
  },
}); 