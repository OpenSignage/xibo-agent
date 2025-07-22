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
 * @module setUserPermissions
 * @description This module provides a tool to set the permissions for a specific entity.
 */
import { z } from 'zod';
import { createTool } from '@mastra/core/tools';
import { config } from '../config';
import { getAuthHeaders } from '../auth';
import { logger } from '../../../logger';
import { decodeErrorMessage } from '../utility/error';

// Schema for a generic success response, extended with a message.
const successResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
});

// Schema for a generic error response.
const errorResponseSchema = z.object({
  success: z.literal(false),
  message: z.string(),
  error: z.any().optional(),
  errorData: z.any().optional(),
});


/**
 * The output schema is a union of a successful response or an error response.
 */
const outputSchema = z.union([successResponseSchema, errorResponseSchema]);

/**
 * @tool setUserPermissions
 * @description A tool to set permissions for a specific entity.
 */
export const setUserPermissions = createTool({
  id: 'set-user-permissions',
  description: 'Sets permissions for a specific entity (e.g., layout, campaign).',
  inputSchema: z.object({
    entity: z.string().describe("The type of entity (e.g., 'layout', 'campaign')."),
    objectId: z.number().describe('The ID of the object to set permissions for.'),
    groupIds: z.array(z.number()).describe('An array of group IDs to grant permissions to.'),
    ownerId: z.number().optional().describe('The user ID to set as the new owner.'),
  }),
  outputSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      const message = 'CMS URL is not configured.';
      logger.error(message);
      return { success: false as const, message };
    }

    const { entity, objectId, groupIds, ownerId } = context;
    const url = new URL(`${config.cmsUrl}/api/user/permissions/${entity}/${objectId}`);
    const formData = new URLSearchParams();
    
    groupIds.forEach(id => formData.append('groupIds[]', String(id)));
    if (ownerId) {
      formData.append('ownerId', String(ownerId));
    }

    try {
      logger.info({ entity, objectId, groupIds, ownerId }, 'Attempting to set permissions.');

      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
            ...(await getAuthHeaders()),
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      });

      if (response.status === 204) {
        const message = 'Permissions set successfully.';
        logger.info({ entity, objectId }, message);
        return { success: true as const, message };
      }
      
      const responseData = await response.json();

      if (!response.ok) {
        const decodedError = decodeErrorMessage(responseData);
        const message = `Failed to set permissions. API responded with status ${response.status}.`;
        logger.error({ status: response.status, response: decodedError, entity, objectId }, message);
        return { success: false as const, message, errorData: decodedError };
      }
      
      const message = 'Permissions set successfully.';
      logger.info({ entity, objectId }, message);
      return { success: true as const, message };

    } catch (error: unknown) {
      const message = 'An unexpected error occurred while setting permissions.';
      logger.error({ error, entity, objectId }, message);
      return {
        success: false as const,
        message,
        error: error instanceof Error ? { name: error.name, message: error.message } : error,
      };
    }
  },
}); 