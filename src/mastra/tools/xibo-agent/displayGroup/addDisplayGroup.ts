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
 * This module provides a tool for adding a new display group to the Xibo CMS.
 * It sends a POST request to the /api/displaygroup endpoint.
 */

import { z } from 'zod';
import { createTool } from '@mastra/core/tools';
import { config } from '../config';
import { getAuthHeaders } from '../auth';
import { logger } from '../../../index';
import { displayGroupSchema } from './schemas';

const inputSchema = z.object({
  name: z.string().describe('The name of the new display group.'),
  description: z.string().optional().describe('An optional description for the display group.'),
  isDynamic: z.number().optional().describe('Flag to set the group as dynamic (0 or 1).'),
  tags: z.string().optional().describe('A comma-separated list of tags for the display group.'),
  dynamicCriteria: z.string().optional().describe('SQL filter for dynamic groups.'),
  folderId: z.number().optional().describe('The ID of the folder to create the group in.'),
});

const outputSchema = z.union([
  z.object({
    success: z.literal(true),
    message: z.string(),
    data: displayGroupSchema,
  }),
  z.object({
    success: z.literal(false),
    message: z.string(),
    error: z.any().optional(),
  }),
]);

export const addDisplayGroup = createTool({
  id: 'add-display-group',
  description: 'Add a new display group to the CMS.',
  inputSchema,
  outputSchema,
  execute: async ({ context: input }): Promise<z.infer<typeof outputSchema>> => {
    try {
      if (!config.cmsUrl) {
        return { success: false, message: 'CMS URL is not configured.' };
      }

      const headers = await getAuthHeaders();
      const params = new URLSearchParams();

      // The API expects 'displayGroup' for the name field
      params.append('displayGroup', input.name);

      Object.entries(input).forEach(([key, value]) => {
        // 'name' is already handled, so we skip it.
        if (key !== 'name' && value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });
      
      const url = `${config.cmsUrl}/api/displaygroup`;
      logger.debug(`addDisplayGroup: Requesting URL = ${url}, Body = ${params.toString()}`);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });

      const responseData = await response.json();

      if (!response.ok) {
        logger.error(`addDisplayGroup: HTTP error: ${response.status}`, { error: responseData });
        return { success: false, message: `HTTP error! status: ${response.status}`, error: responseData };
      }

      const validatedData = displayGroupSchema.parse(responseData);
      return { success: true, message: 'Display group added successfully.', data: validatedData };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      logger.error('addDisplayGroup: An unexpected error occurred', { error });

      if (error instanceof z.ZodError) {
        return { success: false, message: 'Validation error occurred.', error: error.issues };
      }
      
      return { success: false, message: `An unexpected error occurred: ${errorMessage}`, error };
    }
  },
}); 