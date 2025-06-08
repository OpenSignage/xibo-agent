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
 * Notification Deletion Tool for Xibo CMS
 * 
 * This module provides functionality to delete notifications from the Xibo CMS.
 */

import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from '../../../index';

/**
 * Schema for success response
 */
const successResponseSchema = z.object({
  success: z.literal(true),
  message: z.string()
});

/**
 * Schema for error response
 */
const errorResponseSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.number(),
    message: z.string(),
    details: z.any().optional()
  })
});

/**
 * Combined response schema
 */
const responseSchema = z.union([successResponseSchema, errorResponseSchema]);

type SuccessResponse = z.infer<typeof successResponseSchema>;
type ErrorResponse = z.infer<typeof errorResponseSchema>;
type Response = SuccessResponse | ErrorResponse;

/**
 * Tool for deleting notifications from Xibo CMS
 */
export const deleteNotification = createTool({
  id: 'delete-notification',
  description: 'Delete a notification from Xibo CMS',
  inputSchema: z.object({
    notificationId: z.number().describe('ID of the notification to delete')
  }),

  outputSchema: responseSchema,
  execute: async ({ context }): Promise<Response> => {
    try {
      logger.info('Deleting notification from CMS');

      if (!config.cmsUrl) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: {
            code: 500,
            message: "CMS URL is not configured"
          }
        };
        return errorResponse;
      }

      const headers = await getAuthHeaders();
      logger.debug('Auth headers obtained');

      const url = `${config.cmsUrl}/api/notification/${context.notificationId}`;
      logger.debug(`Request URL: ${url}`);

      const response = await fetch(url, {
        method: 'DELETE',
        headers
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        logger.error(`HTTP error occurred: ${response.status}`, { errorData });
        const errorResponse: ErrorResponse = {
          success: false,
          error: {
            code: response.status,
            message: errorData?.message || `HTTP error occurred: ${response.status}`,
            details: errorData
          }
        };
        return errorResponse;
      }

      // Check if response is empty
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        // Return success response for empty or non-JSON response
        const successResponse: SuccessResponse = {
          success: true,
          message: "Notification deleted successfully"
        };
        logger.info('Notification deleted successfully (empty response)');
        return successResponse;
      }

      // Try to parse JSON response
      try {
        const data = await response.json();
        logger.debug('Raw API response:', { data });
        
        const validatedData = successResponseSchema.parse(data);
        logger.info('Notification deleted successfully');
        return validatedData;
      } catch (parseError) {
        // If JSON parsing fails, return success response
        const successResponse: SuccessResponse = {
          success: true,
          message: "Notification deleted successfully (invalid JSON response)"
        };
        logger.info('Notification deleted successfully (invalid JSON response)');
        return successResponse;
      }
    } catch (error) {
      logger.error('Error occurred while deleting notification', { error });
      const errorResponse: ErrorResponse = {
        success: false,
        error: {
          code: 500,
          message: error instanceof Error ? error.message : "Unknown error occurred",
          details: error
        }
      };
      return errorResponse;
    }
  },
}); 