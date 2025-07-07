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
 * This module provides a tool for sending a command to a display group.
 * It sends a POST request to the /api/displaygroup/:displayGroupId/command endpoint.
 */

import { z } from 'zod';
import { createTool } from '@mastra/core/tools';
import { config } from '../config';
import { getAuthHeaders } from '../auth';
import { logger } from '../../../index';

const inputSchema = z.object({
  displayGroupId: z.number().describe('The ID of the display group to send the command to.'),
  commandId: z.number().describe('The ID of the command to send.'),
  // Additional parameters can be sent if required by the command.
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

export const sendCommandToDisplayGroup = createTool({
  id: 'send-command-to-display-group',
  description: 'Send a predefined command to a specific display group.',
  inputSchema,
  outputSchema,
  execute: async ({ context: input }): Promise<z.infer<typeof outputSchema>> => {
    try {
      if (!config.cmsUrl) {
        return { success: false, message: 'CMS URL is not configured.' };
      }

      const headers = await getAuthHeaders();
      const params = new URLSearchParams({ commandId: String(input.commandId) });

      const url = `${config.cmsUrl}/api/displaygroup/${input.displayGroupId}/command`;
      logger.debug(`sendCommandToDisplayGroup: Requesting URL = ${url}, Body = ${params.toString()}`);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });

      if (!response.ok) {
        const errorData = await response.text();
        logger.error(`sendCommandToDisplayGroup: HTTP error: ${response.status}`, { error: errorData });
        return { success: false, message: `HTTP error! status: ${response.status}`, error: errorData };
      }
      
      // Successful response is 204 No Content
      return { success: true, message: 'Command sent successfully.' };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      logger.error('sendCommandToDisplayGroup: An unexpected error occurred', { error });
      return { success: false, message: `An unexpected error occurred: ${errorMessage}`, error };
    }
  },
}); 