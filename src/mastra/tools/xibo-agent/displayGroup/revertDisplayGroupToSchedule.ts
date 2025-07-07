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
 * This module provides a tool to revert a display group to its scheduled content.
 * It sends a POST request to the /api/displaygroup/:displayGroupId/revertToSchedule endpoint.
 */

import { z } from 'zod';
import { createTool } from '@mastra/core/tools';
import { config } from '../config';
import { getAuthHeaders } from '../auth';
import { logger } from '../../../index';

const inputSchema = z.object({
  displayGroupId: z.number().describe('The ID of the display group to revert to schedule.'),
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

export const revertDisplayGroupToSchedule = createTool({
  id: 'revert-display-group-to-schedule',
  description: 'Revert a display group to its scheduled content, canceling any overrides.',
  inputSchema,
  outputSchema,
  execute: async ({ context: input }): Promise<z.infer<typeof outputSchema>> => {
    try {
      if (!config.cmsUrl) {
        return { success: false, message: 'CMS URL is not configured.' };
      }

      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/displaygroup/${input.displayGroupId}/revertToSchedule`;
      logger.debug(`revertDisplayGroupToSchedule: Requesting URL = ${url}`);

      const response = await fetch(url, {
        method: 'POST',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.text();
        logger.error(`revertDisplayGroupToSchedule: HTTP error: ${response.status}`, { error: errorData });
        return { success: false, message: `HTTP error! status: ${response.status}`, error: errorData };
      }
      
      // Successful response is 204 No Content
      return { success: true, message: 'Successfully reverted to schedule.' };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      logger.error('revertDisplayGroupToSchedule: An unexpected error occurred', { error });
      return { success: false, message: `An unexpected error occurred: ${errorMessage}`, error };
    }
  },
}); 