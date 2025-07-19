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
 * @module toggleAuthoriseForDisplay
 * @description Provides a tool to authorize or de-authorize a specific display.
 * It implements the PUT /display/authorise/{displayId} endpoint.
 */
import { z } from 'zod';
import { createTool } from '@mastra/core';
import { getAuthHeaders } from '../auth';
import { config } from '../config';
import { logger } from '../../../index';
import { processError } from '../utility/error';

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

const successResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
});

const outputSchema = z.union([successResponseSchema, errorResponseSchema]);

export const toggleAuthoriseForDisplay = createTool({
  id: 'toggle-authorise-for-display',
  description: 'Authorizes or de-authorizes a display.',
  inputSchema: z.object({
    displayId: z.number().describe('The ID of the display to toggle.'),
  }),
  outputSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      const message = 'CMS URL is not configured.';
      logger.error({}, message);
      return { success: false as const, message };
    }

    try {
      const url = new URL(
        `${config.cmsUrl}/api/display/authorise/${context.displayId}`
      );
      const authHeaders = await getAuthHeaders();
      const headers = {
        ...authHeaders,
        'Content-Type': 'application/x-www-form-urlencoded',
      };

      logger.debug(
        { url: url.toString() },
        `Toggling authorization for display ${context.displayId}`
      );

      const response = await fetch(url.toString(), {
        method: 'PUT',
        headers,
      });

      if (!response.ok) {
        const message = `Failed to toggle authorization for display ${context.displayId}. Status: ${response.status}`;
        let errorData: any = await response.text();
        try {
          errorData = JSON.parse(errorData);
        } catch (e) {
          // Not a JSON response
        }
        logger.error({ status: response.status, data: errorData }, message);
        return {
          success: false as const,
          message,
          errorData,
        };
      }

      const message = `Successfully toggled authorization for display ${context.displayId}.`;
      logger.info(message);
      return { success: true as const, message };
    } catch (error) {
      const processedError = processError(error);
      const message =
        'An unexpected error occurred while toggling display authorization.';
      logger.error({ error: processedError }, message);
      return {
        success: false as const,
        message,
        error: processedError,
      };
    }
  },
}); 