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
 * @module getTags
 * @description Provides a tool to retrieve and search for tags within the Xibo CMS.
 * It implements the tag API endpoint and handles validation and error handling for tag operations.
 */
import { z } from 'zod';
import { createTool } from '@mastra/core/tools';
import { config } from '../config';
import { getAuthHeaders } from '../auth';
import { logger } from '../../../logger';
import { decodeErrorMessage } from '../utility/error';
import { tagSchema } from './schemas';

/**
 * Defines the schema for a successful response, containing an array of tags.
 */
const successResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(tagSchema).describe('An array of tag records.'),
});

/**
 * Defines the schema for a failed operation, including a success flag and error details.
 */
const errorResponseSchema = z.object({
  success: z.literal(false),
  message: z.string().describe('A human-readable error message.'),
  error: z.any().optional().describe('Optional technical details about the error.'),
  errorData: z.any().optional().describe('The raw error data from the API.'),
});

/**
 * The output schema for the tool, which can be either a success or an error response.
 */
const outputSchema = z.union([successResponseSchema, errorResponseSchema]);

type Output = z.infer<typeof outputSchema>;

/**
 * @tool getTags
 * @description A tool for retrieving tags from the Xibo CMS.
 * It supports filtering tags by various criteria such as ID, name, or system status.
 */
export const getTags = createTool({
  id: 'get-tags',
  description: 'Search and retrieve tags from Xibo CMS.',
  inputSchema: z.object({
    tagId: z.number().optional().describe('Filter by a specific tag ID.'),
    tag: z.string().optional().describe('Filter by a partial match on the tag name.'),
    exactTag: z.string().optional().describe('Filter by an exact match on the tag name.'),
    isSystem: z.number().min(0).max(1).optional().describe('Filter by system tag status (0 for non-system, 1 for system).'),
    isRequired: z.number().min(0).max(1).optional().describe('Filter by required tag status (0 for optional, 1 for required).'),
    haveOptions: z.number().min(0).max(1).optional().describe('Filter for tags that have predefined options (1 for yes).'),
  }),
  outputSchema,
  execute: async ({ context }): Promise<Output> => {
    if (!config.cmsUrl) {
      const message = 'CMS URL is not configured.';
      logger.error(message);
      return { success: false, message };
    }

    const url = new URL(`${config.cmsUrl}/api/tag`);
    const params = new URLSearchParams();
    
    // Dynamically build the query string from the tool's input context.
    Object.entries(context).forEach(([key, value]) => {
        if (value !== undefined) {
            params.append(key, String(value));
        }
    });
    url.search = params.toString();

    try {
      logger.info({ url: url.toString() }, 'Attempting to retrieve tags.');

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: await getAuthHeaders(),
      });

      const responseText = await response.text();
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        responseData = responseText;
      }
      
      if (!response.ok) {
        const decodedError = decodeErrorMessage(responseText);
        const message = `Failed to get tags. API responded with status ${response.status}.`;
        logger.error({ status: response.status, response: decodedError }, message);
        return { success: false, message, errorData: decodedError };
      }
      
      const validationResult = z.array(tagSchema).safeParse(responseData);

      if (!validationResult.success) {
        const message = 'Tags response validation failed.';
        logger.error({ error: validationResult.error.flatten(), data: responseData }, message);
        return { success: false, message, error: validationResult.error, errorData: responseData };
      }

      logger.info(`Successfully retrieved ${validationResult.data.length} tag(s).`);
      return { success: true, data: validationResult.data };
      
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
      logger.error({ error }, `An unexpected error occurred in getTags: ${message}`);
      return {
        success: false,
        message: `An unexpected error occurred: ${message}`,
        error: error,
      };
    }
  },
}); 