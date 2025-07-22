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
 * @module revertDisplayGroupToSchedule
 * @description Provides a tool to revert a Display Group's layout to its schedule.
 * It implements the POST /displaygroup/{id}/action/revert endpoint.
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

export const revertDisplayGroupToSchedule = createTool({
  id: 'revert-display-group-to-schedule',
  description: "Reverts a Display Group's current layout to the scheduled layout.",
  inputSchema: z.object({
    displayGroupId: z.number().describe('The ID of the Display Group to revert.'),
  }),
  outputSchema,
  execute: async ({ context }) => {
    logger.debug({ context }, 'Executing revertDisplayGroupToSchedule tool.');

    if (!config.cmsUrl) {
      const message = 'CMS URL is not configured.';
      logger.error({}, message);
      return { success: false as const, message };
    }

    try {
      const url = new URL(`${config.cmsUrl}/api/displaygroup/${context.displayGroupId}/action/revert`);
      const authHeaders = await getAuthHeaders();
      const response = await fetch(url.toString(), { method: 'POST', headers: authHeaders });

      if (response.status !== 204) {
        const message = `Failed to revert to schedule for group ${context.displayGroupId}. Status: ${response.status}`;
        let errorData: any = await response.text();
        try { errorData = JSON.parse(errorData); } catch (e) { /* Not JSON */ }
        logger.error({ status: response.status, data: errorData }, message);
        return { success: false as const, message, errorData };
      }
      
      return { success: true as const, message: `Display Group ${context.displayGroupId} reverted to schedule.` };
    } catch (error) {
      const processedError = processError(error);
      const message = 'An unexpected error occurred while reverting to schedule.';
      logger.error({ error: processedError }, message);
      return { success: false as const, message, error: processedError };
    }
  },
}); 