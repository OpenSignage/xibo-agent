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
 * @module assignDisplaysToDisplayGroup
 * @description Provides a tool to assign one or more displays to a Display Group.
 * It implements the POST /displaygroup/{id}/action/assign endpoint.
 */
import { z } from 'zod';
import { createTool } from '@mastra/core';
import { getAuthHeaders } from '../auth';
import { config } from '../config';
import { logger } from '../../../logger';
import { processError } from '../utility/error';
import { assignedDisplaySchema } from './schemas';

const errorResponseSchema = z.object({
  success: z.literal(false),
  message: z.string().describe('A simple, readable error message.'),
  error: z.any().optional().describe('Detailed error information.'),
  errorData: z.any().optional().describe('Raw response data from the CMS.'),
});

/**
 * Schema for a successful response, containing an array of assigned displays.
 */
const successResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(assignedDisplaySchema),
});

/**
 * Union schema for the tool's output, covering both success and error cases.
 */
const outputSchema = z.union([successResponseSchema, errorResponseSchema]);

/**
 * Tool to assign one or more displays to a Display Group.
 */
export const assignDisplaysToDisplayGroup = createTool({
  id: 'assign-displays-to-display-group',
  description: 'Assigns one or more displays to a Display Group.',
  inputSchema: z.object({
    displayGroupId: z
      .number()
      .describe('The ID of the Display Group to assign to.'),
    displayIds: z.array(z.number()).describe('An array of Display IDs to assign.'),
    unassign: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe(
        'Flag to unassign all other displays before assigning the new ones.'
      ),
  }),
  outputSchema,
  execute: async ({ context }) => {
    logger.debug({ context }, 'Executing assignDisplaysToDisplayGroup tool.');

    if (!config.cmsUrl) {
      const message = 'CMS URL is not configured.';
      logger.error({}, message);
      return { success: false as const, message };
    }

    try {
      const url = new URL(
        `${config.cmsUrl}/api/displaygroup/${context.displayGroupId}/action/assign`
      );
      const body = new URLSearchParams();

      // The API expects an array parameter, so we append each ID with '[]'.
      context.displayIds.forEach((id) =>
        body.append('displayIds[]', id.toString())
      );
      if (context.unassign !== undefined) {
        body.append('unassign', context.unassign.toString());
      }

      const authHeaders = await getAuthHeaders();
      const headers = { ...authHeaders, 'Content-Type': 'application/x-www-form-urlencoded' };
      
      logger.debug({ url: url.toString(), body: body.toString() }, 'Assigning displays to group.');

      const response = await fetch(url.toString(), { method: 'POST', headers, body });

      if (!response.ok) {
        const message = `Failed to assign displays to group ${context.displayGroupId}. Status: ${response.status}`;
        let errorData: any = await response.text();
        try { errorData = JSON.parse(errorData); } catch (e) { /* Not JSON */ }
        logger.error({ status: response.status, data: errorData }, message);
        return { success: false as const, message, errorData };
      }

      const responseData = await response.json();
      const validationResult = z.array(assignedDisplaySchema).safeParse(responseData);

      if (!validationResult.success) {
        const message = 'Assign displays response validation failed.';
        logger.error({ error: validationResult.error.flatten(), data: responseData }, message);
        return { success: false as const, message, error: validationResult.error.flatten(), errorData: responseData };
      }

      logger.info(
        { displayGroupId: context.displayGroupId, count: validationResult.data.length },
        'Successfully assigned displays to group.'
      );
      return { success: true as const, data: validationResult.data };
    } catch (error) {
      const processedError = processError(error);
      const message = 'An unexpected error occurred while assigning displays.';
      logger.error({ error: processedError }, message);
      return { success: false as const, message, error: processedError };
    }
  },
}); 