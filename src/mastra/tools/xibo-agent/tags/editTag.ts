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
 * @module editTag
 * @description Provides a tool to edit an existing tag in the Xibo CMS.
 * It implements the tag update API endpoint and handles validation for the operation.
 */
import { z } from 'zod';
import { createTool } from '@mastra/core/tools';
import { config } from '../config';
import { getAuthHeaders } from '../auth';
import { logger } from '../../../index';
import { decodeErrorMessage } from '../utility/error';
import { tagSchema } from './schemas';

/**
 * Defines the schema for a successful operation, which returns the updated tag object.
 */
const successResponseSchema = z.object({
  success: z.literal(true),
  data: tagSchema,
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
 * @tool editTag
 * @description A tool for editing an existing tag in the Xibo CMS.
 * It allows updating the tag's name, required status, and options.
 */
export const editTag = createTool({
  id: 'edit-tag',
  description: 'Edit an existing tag in Xibo CMS.',
  inputSchema: z.object({
    tagId: z.number().describe('The ID of the tag to edit.'),
    tag: z.string().optional().describe('The new name for the tag.'),
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

    const url = new URL(`${config.cmsUrl}/api/tag/${context.tagId}`);
    const params = new URLSearchParams();

    // Map context to form data, renaming 'tag' to 'name' for the API.
    if (context.tag) params.append('name', context.tag);
    if (context.isRequired !== undefined) {
      params.append('isRequired', String(context.isRequired));
    }
    if (context.options !== undefined) {
      params.append('options', context.options);
    }
    
    // The request should fail if no editable fields are provided.
    if (params.toString() === '') {
        const message = 'No fields provided to edit.';
        logger.warn({ context }, message);
        return { success: false, message };
    }

    try {
      logger.info({ tagId: context.tagId, body: params.toString() }, 'Attempting to edit tag.');

      const response = await fetch(url.toString(), {
        method: 'PUT',
        headers: {
          ...(await getAuthHeaders()),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
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
        const message = `Failed to edit tag. API responded with status ${response.status}.`;
        logger.error({ status: response.status, response: decodedError, tagId: context.tagId }, message);
        return { success: false, message, errorData: decodedError };
      }

      const validationResult = tagSchema.safeParse(responseData);

      if (!validationResult.success) {
        const message = 'Edit tag response validation failed.';
        logger.error({ error: validationResult.error.flatten(), data: responseData }, message);
        return { success: false, message, error: validationResult.error, errorData: responseData };
      }

      logger.info({ tag: validationResult.data }, `Successfully edited tag '${validationResult.data.tag}'.`);
      return { success: true, data: validationResult.data };

    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
      logger.error({ error, tagId: context.tagId }, `An unexpected error occurred in editTag: ${message}`);
      return {
        success: false,
        message: `An unexpected error occurred: ${message}`,
        error: error,
      };
    }
  },
}); 