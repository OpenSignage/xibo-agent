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
 * @module AddNotification
 * @description This module provides a tool for creating notifications in the Xibo CMS.
 * It handles the API request, data validation, and response formatting for
 * adding a new notification.
 */
import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../index";
import { decodeErrorMessage } from "../utility/error";
import { notificationSchema } from './schemas';

/**
 * Defines the output schema for the addNotification tool.
 * It represents a successful response with the created notification data or a failure.
 */
const outputSchema = z.union([
  z.object({
    success: z.literal(true),
    data: notificationSchema,
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
 * Tool for creating a new notification in the Xibo CMS.
 * This tool sends a POST request with the notification details.
 */
export const addNotification = createTool({
  id: 'add-notification',
  description: 'Create a new notification in the Xibo CMS.',
  inputSchema: z.object({
    subject: z.string().describe('The subject of the notification.'),
    body: z.string().optional().describe('The main content of the notification.'),
    releaseDt: z.string().describe('The release date and time for the notification in ISO 8601 format.'),
    isInterrupt: z.number().describe('Flag to determine if the notification should interrupt users. Use 1 for true, 0 for false.'),
    displayGroupIds: z.array(z.number()).describe('An array of display group IDs to which this notification will be sent.'),
    userGroupIds: z.array(z.number()).describe('An array of user group IDs to which this notification will be sent.')
  }),
  outputSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      const message = "CMS URL is not configured.";
      logger.error(message);
      return { success: false as const, message };
    }

    const url = new URL(`${config.cmsUrl}/api/notification`);
    logger.info({ subject: context.subject }, "Attempting to create a new notification.");

    try {
      const formData = new URLSearchParams();
      formData.append("subject", context.subject);
      if (context.body) {
        formData.append("body", context.body);
      }
      formData.append("releaseDt", new Date(context.releaseDt).toISOString());
      formData.append("isInterrupt", context.isInterrupt.toString());
      context.displayGroupIds.forEach(id => formData.append('displayGroupIds[]', id.toString()));
      context.userGroupIds.forEach(id => formData.append('userGroupIds[]', id.toString()));

      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          ...await getAuthHeaders(),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });

      const responseData = await response.json();

      if (!response.ok) {
        const decodedError = decodeErrorMessage(responseData);
        const message = `Failed to create notification. API responded with status ${response.status}.`;
        logger.error({ response: decodedError, status: response.status }, message);
        return {
          success: false as const,
          message,
          errorData: decodedError,
        };
      }
      
      const validationResult = notificationSchema.safeParse(responseData);

      if (!validationResult.success) {
        const message = "Notification response validation failed.";
        logger.error({ error: validationResult.error, data: responseData }, message);
        return {
          success: false as const,
          message,
          error: validationResult.error,
          errorData: responseData,
        };
      }

      const message = `Successfully created notification: "${validationResult.data.subject}".`;
      logger.info({ notificationId: validationResult.data.notificationId }, message);
      return { success: true as const, data: validationResult.data, message };

    } catch (error: unknown) {
      const message = "An unexpected error occurred while creating the notification.";
      logger.error({ error }, message);
      return { 
        success: false as const, 
        message,
        error: error instanceof Error ? { name: error.name, message: error.message } : error
      };
    }
  },
}); 