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
 * This module provides a tool for assigning displays to a display group.
 * It sends a POST request to the /api/displaygroup/:displayGroupId/display/assign endpoint.
 */

import { z } from 'zod';
import { createTool } from '@mastra/core/tools';
import { config } from '../config';
import { getAuthHeaders } from '../auth';
import { logger } from '../../../index';
import { displayGroupSchema } from './schemas';

const inputSchema = z.object({
  displayGroupId: z.number().describe('The ID of the display group to assign displays to.'),
  displayIds: z.array(z.number()).describe('An array of display IDs to assign to the group.'),
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

export const assignDisplaysToDisplayGroup = createTool({
  id: 'assign-displays-to-display-group',
  description: 'Assign one or more displays to a specific display group.',
  inputSchema,
  outputSchema,
  execute: async ({ context: input }): Promise<z.infer<typeof outputSchema>> => {
    try {
      if (!config.cmsUrl) {
        return { success: false, message: 'CMS URL is not configured.' };
      }

      const headers = await getAuthHeaders();
      const params = new URLSearchParams();
      input.displayIds.forEach(id => params.append('displayIds[]', String(id)));

      const url = `${config.cmsUrl}/api/displaygroup/${input.displayGroupId}/display/assign`;
      logger.debug(`assignDisplaysToDisplayGroup: Requesting URL = ${url}, Body = ${params.toString()}`);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });

      const responseData = await response.json();

      if (!response.ok) {
        logger.error(`assignDisplaysToDisplayGroup: HTTP error: ${response.status}`, { error: responseData });
        return { success: false, message: `HTTP error! status: ${response.status}`, error: responseData };
      }

      const validatedData = displayGroupSchema.parse(responseData);
      return { success: true, message: 'Displays assigned successfully.', data: validatedData };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      logger.error('assignDisplaysToDisplayGroup: An unexpected error occurred', { error });

      if (error instanceof z.ZodError) {
        return { success: false, message: 'Validation error occurred.', error: error.issues };
      }
      
      return { success: false, message: `An unexpected error occurred: ${errorMessage}`, error };
    }
  },
}); 