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
 * @module sendCommandToDisplayGroup
 * @description Provides a tool for sending a command to a display group.
 * It implements the POST /displaygroup/{id}/action/command endpoint.
 */
import { z } from 'zod';
import { createTool } from '@mastra/core';
import { getAuthHeaders } from '../auth';
import { config } from '../config';
import { logger } from '../../../index';
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

export const sendCommandToDisplayGroup = createTool({
  id: 'send-command-to-display-group',
  description: 'Send a predefined command to a specific display group.',
  inputSchema: z.object({
    displayGroupId: z
      .number()
      .describe('The ID of the display group to send the command to.'),
    commandId: z.number().describe('The ID of the command to send.'),
  }),
  outputSchema,
  execute: async ({ context }) => {
    logger.debug({ context }, 'Executing sendCommandToDisplayGroup tool.');

    if (!config.cmsUrl) {
      const message = 'CMS URL is not configured.';
      logger.error({}, message);
      return { success: false as const, message };
    }

    try {
      const url = new URL(
        `${config.cmsUrl}/api/displaygroup/${context.displayGroupId}/action/command`
      );
      const body = new URLSearchParams({
        commandId: context.commandId.toString(),
      });

      const authHeaders = await getAuthHeaders();
      const headers = { ...authHeaders, 'Content-Type': 'application/x-www-form-urlencoded' };
      const response = await fetch(url.toString(), { method: 'POST', headers, body });

      if (response.status !== 204) {
        const message = `Failed to send command to group ${context.displayGroupId}. Status: ${response.status}`;
        let errorData: any = await response.text();
        try { errorData = JSON.parse(errorData); } catch (e) { /* Not JSON */ }
        logger.error({ status: response.status, data: errorData }, message);
        return { success: false as const, message, errorData };
      }
      
      return { success: true as const, message: 'Command sent successfully.' };
    } catch (error) {
      const processedError = processError(error);
      const message = 'An unexpected error occurred while sending a command.';
      logger.error({ error: processedError }, message);
      return { success: false as const, message, error: processedError };
    }
  },
}); 