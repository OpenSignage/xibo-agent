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
 * @module DeleteNotification
 * @description This module provides a tool for deleting notifications from the Xibo CMS.
 * It handles the API request and response for notification deletion.
 */
import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from '../../../index';
import { decodeErrorMessage } from "../utility/error";

/**
 * Defines the output schema for the deleteNotification tool.
 * It represents either a successful deletion or a failure with an error message.
 */
const outputSchema = z.union([
  z.object({
    success: z.literal(true),
    message: z.string(),
  }),
  z.object({
    success: z.literal(false),
    message: z.string(),
    error: z.any().optional(),
    errorData: z.any().optional(),
  }),
]);

/**
 * Tool for deleting a notification from the Xibo CMS.
 * This tool sends a DELETE request to remove the specified notification.
 */
export const deleteNotification = createTool({
  id: 'delete-notification',
  description: 'Delete a notification from the Xibo CMS.',
  inputSchema: z.object({
    notificationId: z.number().describe('The ID of the notification to be deleted.')
  }),
  outputSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      const message = "CMS URL is not configured.";
      logger.error(message);
      return { success: false as const, message };
    }
    
    const url = new URL(`${config.cmsUrl}/api/notification/${context.notificationId}`);
    logger.info({ notificationId: context.notificationId }, "Attempting to delete a notification.");

    try {
      const response = await fetch(url.toString(), {
        method: 'DELETE',
        headers: await getAuthHeaders(),
      });

      if (response.status === 204) {
        const message = `Successfully deleted notification with ID: ${context.notificationId}.`;
        logger.info({ notificationId: context.notificationId }, message);
        return { success: true, message };
      }
      
      const responseData = await response.json().catch(() => null);
      const decodedError = decodeErrorMessage(responseData);
      const message = `Failed to delete notification. API responded with status ${response.status}.`;
      
      logger.error({ response: decodedError, status: response.status }, message);
      return {
        success: false,
        message,
        errorData: decodedError,
      };

    } catch (error: unknown) {
      const message = "An unexpected error occurred while deleting the notification.";
      logger.error({ error }, message);
      return { 
        success: false,
        message,
        error: error instanceof Error ? { name: error.name, message: error.message } : error
      };
    }
  },
}); 