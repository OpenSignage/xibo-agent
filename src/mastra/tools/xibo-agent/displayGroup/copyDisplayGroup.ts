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
 * @module copyDisplayGroup
 * @description Provides a tool to copy an existing Display Group in the Xibo CMS.
 * It implements the POST /displaygroup/{id}/action/copy endpoint.
 */
import { z } from 'zod';
import { createTool } from '@mastra/core';
import { getAuthHeaders } from '../auth';
import { config } from '../config';
import { logger } from '../../../logger';
import { processError } from '../utility/error';
import { displayGroupSchema } from './schemas';

const errorResponseSchema = z.object({
  success: z.literal(false),
  message: z.string().describe('A simple, readable error message.'),
  error: z.any().optional().describe('Detailed error information.'),
  errorData: z.any().optional().describe('Raw response data from the CMS.'),
});

const successResponseSchema = z.object({
  success: z.literal(true),
  data: displayGroupSchema,
});

const outputSchema = z.union([successResponseSchema, errorResponseSchema]);

export const copyDisplayGroup = createTool({
  id: 'copy-display-group',
  description: 'Copies an existing Display Group.',
  inputSchema: z.object({
    displayGroupId: z.number().describe('The ID of the Display Group to copy.'),
    newDisplayGroup: z.string().describe('The name for the new (copied) Display Group.'),
    newDisplayGroupDescription: z.string().optional().describe('An optional description for the new group.'),
  }),
  outputSchema,
  execute: async ({ context }) => {
    logger.debug({ context }, 'Executing copyDisplayGroup tool.');

    if (!config.cmsUrl) {
      const message = 'CMS URL is not configured.';
      logger.error({}, message);
      return { success: false as const, message };
    }

    try {
      const { displayGroupId, ...bodyParams } = context;
      const url = new URL(`${config.cmsUrl}/api/displaygroup/${displayGroupId}/action/copy`);
      const body = new URLSearchParams();
      Object.entries(bodyParams).forEach(([key, value]) => {
        if (value !== undefined) {
          body.append(key, value.toString());
        }
      });
      
      const authHeaders = await getAuthHeaders();
      const headers = { ...authHeaders, 'Content-Type': 'application/x-www-form-urlencoded' };
      const response = await fetch(url.toString(), { method: 'POST', headers, body });

      if (!response.ok) {
        const message = `Failed to copy display group ${displayGroupId}. Status: ${response.status}`;
        let errorData: any = await response.text();
        try { errorData = JSON.parse(errorData); } catch (e) { /* Not JSON */ }
        logger.error({ status: response.status, data: errorData }, message);
        return { success: false as const, message, errorData };
      }

      const responseData = await response.json();
      const validationResult = displayGroupSchema.safeParse(responseData);

      if (!validationResult.success) {
        const message = 'Copy display group response validation failed.';
        logger.error({ error: validationResult.error.flatten(), data: responseData }, message);
        return { success: false as const, message, error: validationResult.error.flatten(), errorData: responseData };
      }

      return { success: true as const, data: validationResult.data };
    } catch (error) {
      const processedError = processError(error);
      const message = 'An unexpected error occurred while copying a display group.';
      logger.error({ error: processedError }, message);
      return { success: false as const, message, error: processedError };
    }
  },
}); 