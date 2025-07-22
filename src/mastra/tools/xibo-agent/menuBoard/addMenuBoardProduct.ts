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
 * @module addMenuBoardProduct
 * @description This module provides a tool to add a new product to a menu board category.
 * It implements the menu board product creation API endpoint and handles the necessary validation.
 */
import { z } from 'zod';
import { createTool } from '@mastra/core/tools';
import { config } from '../config';
import { getAuthHeaders } from '../auth';
import { logger } from '../../../logger';
import { menuBoardProductSchema } from './schemas';
import { decodeErrorMessage } from '../utility/error';

// Schema for the input of the addMenuBoardProduct tool
const inputSchema = z.object({
  menuCategoryId: z.number().describe('The ID of the parent menu category.'),
  name: z.string().describe('The name for the new product.'),
  displayOrder: z.number().describe('The display order of the product.'),
  description: z.string().optional().describe('An optional description for the product.'),
  price: z.number().optional().describe('The price of the product.'),
  allergyInfo: z.string().optional().describe('Allergy information for the product.'),
  calories: z.number().optional().describe('Calorie count for the product.'),
  availability: z.number().optional().describe('Flag indicating product availability.'),
  mediaId: z.number().optional().describe('The ID of a media item to associate with the product.'),
  code: z.string().optional().describe('An optional code for the product.'),
  productOptions: z.array(z.string()).optional().describe('An array of product options.'),
  productValues: z.array(z.string()).optional().describe('An array of values corresponding to product options.'),
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
 * @tool addMenuBoardProduct
 * @description A tool for creating a new product in a specific menu board category.
 */
export const addMenuBoardProduct = createTool({
  id: 'add-menu-board-product',
  description: 'Add a new product to a specific menu board category.',
  inputSchema,
  outputSchema,
  execute: async ({ context }): Promise<Output> => {
    if (!config.cmsUrl) {
      const message = 'CMS URL is not configured.';
      logger.error(message);
      return { success: false, message };
    }

    const { menuCategoryId, ...bodyParams } = context;
    const url = new URL(`${config.cmsUrl}/api/menuboard/${menuCategoryId}/product`);
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

    try {
      logger.info({ body: params.toString() }, `Attempting to add new product to category ${menuCategoryId}.`);

      const response = await fetch(url.toString(), {
        method: 'POST',
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
        const message = `Failed to add menu board product. API responded with status ${response.status}.`;
        logger.error({ status: response.status, response: decodedError }, message);
        return { success: false, message, errorData: decodedError };
      }

      const validationResult = menuBoardProductSchema.safeParse(responseData);

      if (!validationResult.success) {
        const message = 'Add menu board product response validation failed.';
        logger.error({ error: validationResult.error.flatten(), data: responseData }, message);
        return { success: false, message, error: validationResult.error, errorData: responseData };
      }

      logger.info({ product: validationResult.data }, `Successfully added product '${validationResult.data.name}'.`);
      return { success: true, data: validationResult.data };

    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
      logger.error({ error }, `An unexpected error occurred in addMenuBoardProduct: ${message}`);
      return {
        success: false,
        message: `An unexpected error occurred: ${message}`,
        error: error,
      };
    }
  },
}); 