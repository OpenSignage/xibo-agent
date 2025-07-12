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
 * @module editMenuBoardCategory
 * @description Provides a tool to edit an existing menu board category in the Xibo CMS.
 * It implements the menu board category update API endpoint and handles the necessary validation.
 */
import { z } from 'zod';
import { createTool } from '@mastra/core/tools';
import { config } from '../config';
import { getAuthHeaders } from '../auth';
import { logger } from '../../../index';
import { menuBoardCategorySchema } from './schemas';
import { decodeErrorMessage } from '../utility/error';

// Schema for the input of the editMenuBoardCategory tool
const inputSchema = z.object({
  menuCategoryId: z.number().describe('The ID of the menu board category to edit.'),
  name: z.string().optional().describe('The new name for the category.'),
  description: z.string().optional().describe('The new description for the category.'),
  code: z.string().optional().describe('The new code for the category.'),
  mediaId: z.number().optional().describe('The new media ID to associate with the category.'),
});

// Schema for a successful response
const successResponseSchema = z.object({
  success: z.literal(true),
  data: menuBoardCategorySchema,
});

// Schema for an error response
const errorResponseSchema = z.object({
  success: z.literal(false),
  message: z.string().describe('A human-readable error message.'),
  error: z.any().optional().describe('Optional technical details about the error.'),
  errorData: z.any().optional().describe('The raw error data from the API.'),
});

// The output schema for the tool
const outputSchema = z.union([successResponseSchema, errorResponseSchema]);

type Output = z.infer<typeof outputSchema>;

/**
 * @tool editMenuBoardCategory
 * @description A tool for editing an existing menu board category in the Xibo CMS.
 */
export const editMenuBoardCategory = createTool({
  id: 'edit-menu-board-category',
  description: 'Edit an existing menu board category.',
  inputSchema,
  outputSchema,
  execute: async ({ context }): Promise<Output> => {
    if (!config.cmsUrl) {
      const message = 'CMS URL is not configured.';
      logger.error(message);
      return { success: false, message };
    }

    const { menuCategoryId, ...bodyParams } = context;
    const url = new URL(`${config.cmsUrl}/api/menuboard/category/${menuCategoryId}`);
    const params = new URLSearchParams();

    Object.entries(bodyParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, String(value));
      }
    });

    if (params.toString() === '') {
      const message = 'No fields provided to edit.';
      logger.warn({ context }, message);
      return { success: false, message };
    }

    try {
      logger.info({ menuCategoryId, body: params.toString() }, 'Attempting to edit menu board category.');

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
        const message = `Failed to edit menu board category. API responded with status ${response.status}.`;
        logger.error({ status: response.status, response: decodedError, menuCategoryId }, message);
        return { success: false, message, errorData: decodedError };
      }

      const validationResult = menuBoardCategorySchema.safeParse(responseData);

      if (!validationResult.success) {
        const message = 'Edit menu board category response validation failed.';
        logger.error({ error: validationResult.error.flatten(), data: responseData }, message);
        return { success: false, message, error: validationResult.error, errorData: responseData };
      }

      logger.info({ category: validationResult.data }, `Successfully edited category '${validationResult.data.name}'.`);
      return { success: true, data: validationResult.data };

    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
      logger.error({ error, menuCategoryId }, `An unexpected error occurred in editMenuBoardCategory: ${message}`);
      return {
        success: false,
        message: `An unexpected error occurred: ${message}`,
        error: error,
      };
    }
  },
}); 