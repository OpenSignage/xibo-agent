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
 * Notification Tool for Xibo CMS
 * 
 * This module provides functionality to retrieve notifications from the Xibo CMS.
 * It supports filtering by notification ID and subject, and can include related data.
 */

import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from '../../../index';

/**
 * Schema for notification data
 */
const notificationSchema = z.object({
  notificationId: z.number(),
  subject: z.string(),
  body: z.string(),
  createdDt: z.string().optional(),
  releaseDt: z.union([z.string(), z.number()]).optional(),
  isEmail: z.number().optional(),
  isInterrupt: z.number(),
  isSystem: z.number(),
  userId: z.number(),
  displayGroupIds: z.array(z.number()).optional(),
  displayGroupNames: z.array(z.string()).optional(),
  read: z.number().optional(),
  readDt: z.string().nullable().optional(),
  readBy: z.string().nullable().optional()
});

/**
 * Schema for API response
 */
const responseSchema = z.array(notificationSchema);

/**
 * Tool for retrieving notifications from Xibo CMS
 */
export const getNotifications = createTool({
  id: 'get-notifications',
  description: 'Retrieve notifications from Xibo CMS',
  inputSchema: z.object({
    notificationId: z.number().optional().describe('Filter by notification ID'),
    subject: z.string().optional().describe('Filter by subject'),
    embed: z.string().optional().describe('Include related data (userGroups, displayGroups)')
  }),

  outputSchema: z.array(notificationSchema),
  execute: async ({ context }) => {
    try {
      logger.info('Fetching notifications from CMS');

      if (!config.cmsUrl) {
        throw new Error("CMS URL is not configured");
      }

      const headers = await getAuthHeaders();
      logger.debug('Auth headers obtained');

      const queryParams = new URLSearchParams();
      if (context.notificationId) {
        queryParams.append('notificationId', context.notificationId.toString());
      }
      if (context.subject) {
        queryParams.append('subject', context.subject);
      }
      if (context.embed) {
        queryParams.append('embed', context.embed);
      }

      const url = `${config.cmsUrl}/api/notification?${queryParams.toString()}`;
      logger.debug(`Request URL: ${url}`);

      const response = await fetch(url, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        logger.error(`HTTP error occurred: ${response.status}`, { errorData });
        throw new Error(`HTTP error! status: ${response.status}${errorData ? `, message: ${JSON.stringify(errorData)}` : ''}`);
      }

      const data = await response.json();
      logger.debug('Raw API response:', { data });
      
      const validatedData = responseSchema.parse(data);
      logger.info('Notifications retrieved successfully');

      return validatedData;
    } catch (error) {
      logger.error('Error occurred while fetching notifications', { error });
      throw error;
    }
  },
}); 