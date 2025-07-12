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
 * @module addTag
 * @description Provides a tool to add a new tag to the Xibo CMS.
 * It implements the tag creation API endpoint and handles the necessary validation.
 */
import { z } from 'zod';
import { createTool } from '@mastra/core/tools';
import { config } from '../config';
import { getAuthHeaders } from '../auth';
import { logger } from '../../../index';
import { decodeErrorMessage } from '../utility/error';
import { tagSchema } from './schemas';

/**
 * Defines the schema for a successful operation, which returns the newly created tag object.
 */
const successResponseSchema = z.object({
  success: z.literal(true),
  data: tagSchema,
});

/**
 * Defines the schema for a failed operation, including a success flag, a message, and optional error details.
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
 * @tool addTag
 * @description A tool for adding a new tag to the Xibo CMS.
 * It allows specifying the tag's name, required status, and options upon creation.
 */
export const addTag = createTool({
  id: 'add-tag',
  description: 'Add a new tag to Xibo CMS.',
  inputSchema: z.object({
    tag: z
      .string()
      .min(1, { message: 'Tag name must be at least 1 character long.' })
      .max(50, { message: 'Tag name must be 50 characters or less.' })
      .describe('The name for the new tag (1-50 characters).'),
    isRequired: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe('Set the tag as required (0 for optional, 1 for required).'),
    options: z
      .string()
      .optional()
      .describe('A comma-separated string of predefined values for the tag.'),
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

    // The API expects 'name' for the tag, so we map it from the input 'tag'.
    params.append('name', context.tag);
    if (context.isRequired !== undefined) {
      params.append('isRequired', String(context.isRequired));
    }
    if (context.options) {
      params.append('options', context.options);
    }

    try {
      logger.info({ body: params.toString() }, 'Attempting to add new tag.');

      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          ...(await getAuthHeaders()),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
      });

      // The API returns the new tag object directly, not in an array.
      // It can sometimes be empty on failure.
      const responseText = await response.text();
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        responseData = responseText;
      }
      
      if (!response.ok) {
        const decodedError = decodeErrorMessage(responseText);
        const message = `Failed to add tag. API responded with status ${response.status}.`;
        logger.error({ status: response.status, response: decodedError }, message);
        return { success: false, message, errorData: decodedError };
      }

      // Handle cases where the API returns a successful status but an empty body or non-array response
      const dataToValidate = Array.isArray(responseData) ? responseData[0] : responseData;

      if (!dataToValidate) {
        const message = 'API returned a successful status but no data.';
        logger.error({ status: response.status, responseData }, message);
        return { success: false, message, errorData: responseData };
      }
      
      const validationResult = tagSchema.safeParse(dataToValidate);

      if (!validationResult.success) {
        const message = 'Add tag response validation failed.';
        logger.error({ error: validationResult.error.flatten(), data: dataToValidate }, message);
        return { success: false, message, error: validationResult.error, errorData: dataToValidate };
      }

      logger.info({ tag: validationResult.data }, `Successfully added tag '${validationResult.data.tag}'.`);
      return { success: true, data: validationResult.data };

    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
      logger.error({ error }, `An unexpected error occurred in addTag: ${message}`);
      return {
        success: false,
        message: `An unexpected error occurred: ${message}`,
        error: error,
      };
    }
  },
}); 