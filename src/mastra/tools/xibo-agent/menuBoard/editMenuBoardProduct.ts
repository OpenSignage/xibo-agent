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
 * @module editMenuBoardProduct
 * @description Provides a tool to edit an existing menu board product in the Xibo CMS.
 * It implements the menu board product update API endpoint and handles the necessary validation.
 */
import { z } from 'zod';
import { createTool } from '@mastra/core/tools';
import { config } from '../config';
import { getAuthHeaders } from '../auth';
import { logger } from '../../../index';
import { menuBoardProductSchema } from './schemas';
import { decodeErrorMessage } from '../utility/error';

// Schema for the input of the editMenuBoardProduct tool
const inputSchema = z.object({
  menuProductId: z.number().describe('The ID of the menu board product to edit.'),
  name: z.string().optional().describe('The new name for the product.'),
  displayOrder: z.number().optional().describe('The new display order of the product.'),
  description: z.string().optional().describe('The new description for the product.'),
  price: z.number().optional().describe('The new price of the product.'),
  allergyInfo: z.string().optional().describe('New allergy information for the product.'),
  calories: z.number().optional().describe('New calorie count for the product.'),
  availability: z.number().optional().describe('New flag indicating product availability.'),
  mediaId: z.number().optional().describe('The new media ID to associate with the product.'),
  code: z.string().optional().describe('The new code for the product.'),
  productOptions: z.array(z.string()).optional().describe('An array of new product options.'),
  productValues: z.array(z.string()).optional().describe('An array of new values corresponding to product options.'),
});

// Schema for a successful response
const successResponseSchema = z.object({
  success: z.literal(true),
  data: menuBoardProductSchema,
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
 * @tool editMenuBoardProduct
 * @description A tool for editing an existing menu board product in the Xibo CMS.
 */
export const editMenuBoardProduct = createTool({
  id: 'edit-menu-board-product',
  description: 'Edit an existing menu board product.',
  inputSchema,
  outputSchema,
  execute: async ({ context }): Promise<Output> => {
    if (!config.cmsUrl) {
      const message = 'CMS URL is not configured.';
      logger.error(message);
      return { success: false, message };
    }

    const { menuProductId, ...bodyParams } = context;
    const url = new URL(`${config.cmsUrl}/api/menuboard/product/${menuProductId}`);
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(bodyParams)) {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          value.forEach(item => params.append(`${key}[]`, String(item)));
        } else {
          params.append(key, String(value));
        }
      }
    }
    
    if (params.toString() === '') {
        const message = 'No fields provided to edit.';
        logger.warn({ context }, message);
        return { success: false, message };
    }

    try {
      logger.info({ menuProductId, body: params.toString() }, 'Attempting to edit menu board product.');

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
        const message = `Failed to edit menu board product. API responded with status ${response.status}.`;
        logger.error({ status: response.status, response: decodedError, menuProductId }, message);
        return { success: false, message, errorData: decodedError };
      }

      const validationResult = menuBoardProductSchema.safeParse(responseData);

      if (!validationResult.success) {
        const message = 'Edit menu board product response validation failed.';
        logger.error({ error: validationResult.error.flatten(), data: responseData }, message);
        return { success: false, message, error: validationResult.error, errorData: responseData };
      }

      logger.info({ product: validationResult.data }, `Successfully edited product '${validationResult.data.name}'.`);
      return { success: true, data: validationResult.data };

    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
      logger.error({ error, menuProductId }, `An unexpected error occurred in editMenuBoardProduct: ${message}`);
      return {
        success: false,
        message: `An unexpected error occurred: ${message}`,
        error: error,
      };
    }
  },
}); 