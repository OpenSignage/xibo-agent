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
 * This module provides a tool to purge all cached media from a display.
 * It sends a PUT request to the /api/display/purgeAll/:displayId endpoint.
 */

import { z } from 'zod';
import { createTool } from '@mastra/core/tools';
import { config } from '../config';
import { getAuthHeaders } from '../auth';
import { logger } from '../../../index';

const inputSchema = z.object({
  displayId: z.number().describe('The ID of the display to purge media from.'),
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

export const purgeAllMediaFromDisplay = createTool({
  id: 'purge-all-media-from-display',
  description: 'Purge all cached media from a specific display.',
  inputSchema,
  outputSchema,
  execute: async ({ context: input }): Promise<z.infer<typeof outputSchema>> => {
    try {
      if (!config.cmsUrl) {
        return { success: false, message: 'CMS URL is not configured.' };
      }

      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/display/purgeAll/${input.displayId}`;
      logger.debug(`purgeAllMediaFromDisplay: Requesting URL = ${url}`);

      const response = await fetch(url, {
        method: 'PUT',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.text();
        logger.error(`purgeAllMediaFromDisplay: HTTP error: ${response.status}`, { error: errorData });
        return { success: false, message: `HTTP error! status: ${response.status}`, error: errorData };
      }

      // A successful response is typically a 204 No Content
      return { success: true, message: 'All media purge requested successfully.' };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      logger.error('purgeAllMediaFromDisplay: An unexpected error occurred', { error });
      return { success: false, message: `An unexpected error occurred: ${errorMessage}`, error };
    }
  },
}); 