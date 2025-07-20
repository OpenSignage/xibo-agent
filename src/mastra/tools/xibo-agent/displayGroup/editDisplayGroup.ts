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
 * @module editDisplayGroup
 * @description Provides a tool to edit an existing Display Group in the Xibo CMS.
 * It implements the PUT /displaygroup/{id} endpoint.
 */
import { z } from 'zod';
import { createTool } from '@mastra/core';
import { getAuthHeaders } from '../auth';
import { config } from '../config';
import { logger } from '../../../index';
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

/**
 * Union schema for the tool's output, covering both success and error cases.
 */
const outputSchema = z.union([successResponseSchema, errorResponseSchema]);

/**
 * Tool to edit an existing Display Group in the Xibo CMS.
 */
export const editDisplayGroup = createTool({
  id: 'edit-display-group',
  description: 'Edits an existing Display Group.',
  inputSchema: z.object({
    displayGroupId: z.number().describe('The ID of the Display Group to edit.'),
    displayGroup: z.string().describe('The new name for the Display Group.'),
    description: z.string().optional().describe('An optional new description.'),
    isDynamic: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe('Flag for dynamic group.'),
    dynamicCriteria: z
      .string()
      .optional()
      .describe('The filter criteria for a dynamic group.'),
    dynamicCriteriaLogicalOperator: z
      .enum(['AND', 'OR'])
      .optional()
      .describe('Logical operator for dynamic criteria.'),
    dynamicCriteriaTags: z
      .string()
      .optional()
      .describe('Tags for dynamic criteria.'),
    dynamicCriteriaExactTags: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe('Flag for exact tag matching in dynamic criteria.'),
    dynamicCriteriaTagsLogicalOperator: z
      .enum(['AND', 'OR'])
      .optional()
      .describe('Logical operator for tags in dynamic criteria.'),
    tags: z.string().optional().describe('A comma-separated list of tags.'),
  }),
  outputSchema,
  execute: async ({ context }) => {
    logger.debug({ context }, 'Executing editDisplayGroup tool.');

    if (!config.cmsUrl) {
      const message = 'CMS URL is not configured.';
      logger.error({}, message);
      return { success: false as const, message };
    }

    try {
      const { displayGroupId, ...bodyParams } = context;
      const url = new URL(`${config.cmsUrl}/api/displaygroup/${displayGroupId}`);
      const body = new URLSearchParams();
      Object.entries(bodyParams).forEach(([key, value]) => {
        if (value !== undefined) {
          body.append(key, value.toString());
        }
      });

      const authHeaders = await getAuthHeaders();
      const headers = { ...authHeaders, 'Content-Type': 'application/x-www-form-urlencoded' };
      
      logger.debug({ url: url.toString(), body: body.toString() }, `Editing display group ${displayGroupId}.`);
      const response = await fetch(url.toString(), { method: 'PUT', headers, body });

      if (!response.ok) {
        const message = `Failed to edit display group ${displayGroupId}. Status: ${response.status}`;
        let errorData: any = await response.text();
        try { errorData = JSON.parse(errorData); } catch (e) { /* Not JSON */ }
        logger.error({ status: response.status, data: errorData }, message);
        return { success: false as const, message, errorData };
      }

      const responseData = await response.json();
      const validationResult = displayGroupSchema.safeParse(responseData);

      if (!validationResult.success) {
        const message = 'Edit display group response validation failed.';
        logger.error({ error: validationResult.error.flatten(), data: responseData }, message);
        return { success: false as const, message, error: validationResult.error.flatten(), errorData: responseData };
      }

      logger.info({ displayGroupId }, 'Successfully edited display group.');
      return { success: true as const, data: validationResult.data };
    } catch (error) {
      const processedError = processError(error);
      const message = 'An unexpected error occurred while editing a display group.';
      logger.error({ error: processedError }, message);
      return { success: false as const, message, error: processedError };
    }
  },
}); 