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
 * This module provides a tool to retrieve information about display groups
 * from the Xibo CMS. It supports filtering by various properties.
 */

import { z } from 'zod';
import { createTool } from '@mastra/core/tools';
import { config } from '../config';
import { getAuthHeaders } from '../auth';
import { logger } from '../../../index';
import { displayGroupSchema } from './schemas';

const inputSchema = z.object({
  displayGroupId: z.number().optional().describe('Filter by a specific Display Group ID.'),
  displayGroup: z.string().optional().describe('Filter by display group name (supports filtering with %).'),
  displayId: z.number().optional().describe('Filter by a specific Display ID that is a member of the group.'),
  nestedDisplayId: z.number().optional().describe('Filter by a nested Display ID.'),
  isDynamic: z.number().optional().describe('Filter by dynamic status (0 for No, 1 for Yes).'),
  tags: z.string().optional().describe('Filter by a comma-separated list of tags.'),
});

const outputSchema = z.union([
  z.object({
    success: z.literal(true),
    message: z.string(),
    data: z.array(displayGroupSchema),
  }),
  z.object({
    success: z.literal(false),
    message: z.string(),
    error: z.any().optional(),
  }),
]);

export const getDisplayGroups = createTool({
  id: 'get-display-groups',
  description: 'Search for and retrieve display groups from the CMS.',
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

      const url = `${config.cmsUrl}/api/displaygroup?${params.toString()}`;
      logger.debug(`getDisplayGroups: Requesting URL = ${url}`);

      const response = await fetch(url, { headers });

      if (!response.ok) {
        const errorData = await response.json().catch(() => response.statusText);
        logger.error(`getDisplayGroups: HTTP error: ${response.status}`, { error: errorData });
        return { success: false, message: `HTTP error! status: ${response.status}`, error: errorData };
      }

      const data = await response.json();
      const validatedData = z.array(displayGroupSchema).parse(data);

      if (validatedData.length === 0) {
        return { success: true, message: 'No display groups found matching the criteria.', data: [] };
      }
      
      return { success: true, message: 'Display groups retrieved successfully.', data: validatedData };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      logger.error('getDisplayGroups: An unexpected error occurred', { error });
      
      if (error instanceof z.ZodError) {
        return { success: false, message: 'Validation error occurred.', error: error.issues };
      }
      
      return { success: false, message: `An unexpected error occurred: ${errorMessage}`, error };
    }
  },
}); 