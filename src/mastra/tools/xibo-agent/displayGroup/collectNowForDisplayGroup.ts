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
 * @module collectNowForDisplayGroup
 * @description Provides a tool to trigger a "Collect Now" action for a Display Group.
 * It implements the POST /displaygroup/{id}/action/collectnow endpoint.
 */
import { z } from 'zod';
import { createTool } from '@mastra/core';
import { getAuthHeaders } from '../auth';
import { config } from '../config';
import { logger } from '../../../logger'; 
import { processError } from '../utility/error';

const errorResponseSchema = z.object({
  success: z.literal(false),
  message: z.string().describe('A simple, readable error message.'),
  error: z.any().optional().describe('Detailed error information.'),
  errorData: z.any().optional().describe('Raw response data from the CMS.'),
});

const successResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
});

const outputSchema = z.union([successResponseSchema, errorResponseSchema]);

export const collectNowForDisplayGroup = createTool({
  id: 'collect-now-for-display-group',
  description: 'Triggers a "Collect Now" action for a Display Group.',
  inputSchema: z.object({
    displayGroupId: z.number().describe('The ID of the Display Group.'),
  }),
  outputSchema,
  execute: async ({ context }) => {
    logger.debug({ context }, 'Executing collectNowForDisplayGroup tool.');

    if (!config.cmsUrl) {
      const message = 'CMS URL is not configured.';
      logger.error({}, message);
      return { success: false as const, message };
    }

    try {
      const url = new URL(`${config.cmsUrl}/api/displaygroup/${context.displayGroupId}/action/collectnow`);
      const authHeaders = await getAuthHeaders();
      const response = await fetch(url.toString(), { method: 'POST', headers: authHeaders });

      if (response.status !== 204) {
        const message = `Failed to trigger Collect Now for group ${context.displayGroupId}. Status: ${response.status}`;
        let errorData: any = await response.text();
        try { errorData = JSON.parse(errorData); } catch (e) { /* Not JSON */ }
        logger.error({ status: response.status, data: errorData }, message);
        return { success: false as const, message, errorData };
      }

      return { success: true as const, message: `Collect Now triggered for group ${context.displayGroupId}.` };
    } catch (error) {
      const processedError = processError(error);
      const message = 'An unexpected error occurred during Collect Now action.';
      logger.error({ error: processedError }, message);
      return { success: false as const, message, error: processedError };
    }
  },
}); 