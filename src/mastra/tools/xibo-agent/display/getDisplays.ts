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
 * This module provides a tool to retrieve information about displays
 * registered in the Xibo CMS. It accesses the /api/display endpoint to get
 * detailed information about each display.
 */

import { z } from 'zod';
import { createTool } from '@mastra/core/tools';
import { config } from '../config';
import { getAuthHeaders } from '../auth';
import { logger } from '../../../index';
import { displaySchema } from './schemas';

const inputSchema = z.object({
  displayId: z.number().optional().describe('Filter by a specific Display ID.'),
  displayGroupId: z.number().optional().describe('Filter by a specific Display Group ID.'),
  isAuthorized: z.number().optional().describe('Filter by authorization status (1 for authorized, 0 for not).'),
  isLoggedIn: z.number().optional().describe('Filter by logged-in status (1 for logged in, 0 for not).'),
  version: z.string().optional().describe('Filter by a specific client version.'),
  name: z.string().optional().describe('Filter by display name (supports filtering with %).'),
  tags: z.string().optional().describe('Filter by a comma-separated list of tags.'),
  hasLayouts: z.number().optional().describe('Filter by whether the display has layouts.'),
  retired: z.number().optional().describe('Filter for retired displays.'),
  embed: z.string().optional().describe('Include related data (e.g., "displayGroups,tags").'),
});

const outputSchema = z.union([
  z.object({
    success: z.literal(true),
    message: z.string(),
    data: z.array(displaySchema),
  }),
  z.object({
    success: z.literal(false),
    message: z.string(),
    error: z.any().optional(),
  }),
]);

export const getDisplays = createTool({
  id: 'get-displays',
  description: 'Get information about displays registered in Xibo CMS, with optional filters.',
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
      
      const url = `${config.cmsUrl}/api/display?${params.toString()}`;
      logger.debug(`getDisplays: Requesting URL = ${url}`);

      const response = await fetch(url, { headers });

      if (!response.ok) {
        const errorData = await response.json().catch(() => response.statusText);
        logger.error(`getDisplays: HTTP error: ${response.status}`, { error: errorData });
        return { success: false, message: `HTTP error! status: ${response.status}`, error: errorData };
      }

      const data = await response.json();
      const validatedData = z.array(displaySchema).parse(data);
      
      return { success: true, message: 'Displays retrieved successfully.', data: validatedData };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      logger.error('getDisplays: An unexpected error occurred', { error });
      
      if (error instanceof z.ZodError) {
        return { success: false, message: 'Validation error occurred.', error: error.issues };
      }
      
      return { success: false, message: `An unexpected error occurred: ${errorMessage}`, error };
    }
  },
});
  