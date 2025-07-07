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
 * This module provides a tool to add a new menu board to the Xibo CMS.
 */

import { z } from 'zod';
import { createTool } from '@mastra/core/tools';
import { config } from '../config';
import { getAuthHeaders } from '../auth';
import { logger } from '../../../index';
import { menuBoardSchema } from './schemas';

const inputSchema = z.object({
  name: z.string().describe('The name for the new menu board.'),
  description: z.string().optional().describe('An optional description for the menu board.'),
  code: z.string().optional().describe('An optional code for the menu board.'),
  folderId: z.number().optional().describe('The ID of the parent folder.'),
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

export const addMenuBoard = createTool({
  id: 'add-menu-board',
  description: 'Add a new menu board to the CMS.',
  inputSchema,
  outputSchema,
  execute: async ({ context: input }): Promise<z.infer<typeof outputSchema>> => {
    try {
      if (!config.cmsUrl) {
        return { success: false, message: 'CMS URL is not configured.' };
      }

      const headers = await getAuthHeaders();
      const params = new URLSearchParams();

      Object.entries(input).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });
      
      const url = `${config.cmsUrl}/api/menuboard`;
      logger.debug(`addMenuBoard: Requesting URL = ${url}, Body = ${params.toString()}`);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });

      const responseData = await response.json();

      if (!response.ok) {
        logger.error(`addMenuBoard: HTTP error: ${response.status}`, { error: responseData });
        return { success: false, message: `HTTP error! status: ${response.status}`, error: responseData };
      }

      const validatedData = menuBoardSchema.parse(responseData.data);
      return { success: true, message: 'Menu board added successfully.', data: validatedData };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      logger.error('addMenuBoard: An unexpected error occurred', { error });

      if (error instanceof z.ZodError) {
        return { success: false, message: 'Validation error occurred.', error: error.issues };
      }
      
      return { success: false, message: `An unexpected error occurred: ${errorMessage}`, error };
    }
  },
}); 