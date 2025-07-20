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
 * @module getDisplayGroups
 * @description Provides a tool to retrieve a list of Display Groups from the Xibo CMS.
 * It implements the GET /displaygroup endpoint.
 */
import { z } from 'zod';
import { createTool } from '@mastra/core';
import { getAuthHeaders } from '../auth';
import { config } from '../config';
import { logger } from '../../../index';
import { processError } from '../utility/error';
import { displayGroupSchema } from './schemas';

/**
 * Schema for a standardized error response.
 */
const errorResponseSchema = z.object({
  success: z.literal(false),
  message: z.string().describe('A simple, readable error message.'),
  error: z
    .any()
    .optional()
    .describe('Detailed error information, e.g., from Zod.'),
  errorData: z.any().optional().describe('Raw response data from the CMS.'),
});

/**
 * Schema for a successful response, containing an array of display groups.
 */
const successResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(displayGroupSchema),
});

/**
 * Union schema for the tool's output, covering both success and error cases.
 */
const outputSchema = z.union([successResponseSchema, errorResponseSchema]);

/**
 * Tool to retrieve a list of Display Groups from the Xibo CMS.
 */
export const getDisplayGroups = createTool({
  id: 'get-display-groups',
  description: 'Retrieves a list of Display Groups.',
  inputSchema: z.object({
    displayGroupId: z.number().optional().describe('Filter by a specific Display Group ID.'),
    displayGroup: z.string().optional().describe('Filter by Display Group name (with % wildcard support).'),
    displayId: z.number().optional().describe('Filter by Display Groups containing a specific display.'),
    nestedDisplayId: z.number().optional().describe('Filter by Display Groups containing a specific display in their nesting.'),
    dynamicCriteria: z.string().optional().describe('Filter by Display Groups containing a specific dynamic criteria.'),
    tags: z.string().optional().describe('Filter by a comma-separated list of tags.'),
    exactTags: z.number().min(0).max(1).optional().describe('A flag indicating whether to treat the tags filter as an exact match (1 for yes).'),
    logicalOperator: z.enum(['AND', 'OR']).optional().describe('When filtering by multiple Tags, which logical operator should be used? AND|OR'),
    isDisplaySpecific: z.number().min(0).max(1).optional().describe('Filter by whether the Display Group belongs to a Display or is user created.'),
    forSchedule: z.number().min(0).max(1).optional().describe('Should the list be refined for only those groups the User can Schedule against?'),
    folderId: z.number().optional().describe('Filter by Folder ID.'),
  }),
  outputSchema,
  execute: async ({ context }) => {
    logger.debug({ context }, 'Executing getDisplayGroups tool.');

    if (!config.cmsUrl) {
      const message = 'CMS URL is not configured.';
      logger.error({}, message);
      return { success: false as const, message };
    }

    try {
      const url = new URL(`${config.cmsUrl}/api/displaygroup`);

      // Dynamically build the URL query string from the provided context.
      Object.entries(context).forEach(([key, value]) => {
        if (value) {
          url.searchParams.append(key, value.toString());
        }
      });

      const authHeaders = await getAuthHeaders();
      logger.debug({ url: url.toString() }, 'Fetching display groups from CMS.');

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: authHeaders,
      });

      if (!response.ok) {
        const message = `Failed to get display groups. Status: ${response.status}`;
        let errorData: any = await response.text();
        try {
          errorData = JSON.parse(errorData);
        } catch (e) {
          // Not a JSON response
        }
        logger.error({ status: response.status, data: errorData }, message);
        return { success: false as const, message, errorData };
      }

      const responseData = await response.json();
      const validationResult = z.array(displayGroupSchema).safeParse(responseData);

      if (!validationResult.success) {
        const message = 'Get display groups response validation failed.';
        logger.error(
          { error: validationResult.error.flatten(), data: responseData },
          message
        );
        return {
          success: false as const,
          message,
          error: validationResult.error.flatten(),
          errorData: responseData,
        };
      }

      logger.info(
        { count: validationResult.data.length },
        'Successfully retrieved and validated display groups.'
      );
      return { success: true as const, data: validationResult.data };
    } catch (error) {
      const processedError = processError(error);
      const message = 'An unexpected error occurred while getting display groups.';
      logger.error({ error: processedError }, message);
      return {
        success: false as const,
        message,
        error: processedError,
      };
    }
  },
}); 