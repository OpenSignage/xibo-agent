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
 * @module getMultiEntityPermissions
 * @description This module provides a tool to retrieve aggregated permissions for multiple entities of the same type.
 */
import { z } from 'zod';
import { createTool } from '@mastra/core/tools';
import { config } from '../config';
import { getAuthHeaders } from '../auth';
import { logger } from '../../../index';
import { decodeErrorMessage } from '../utility/error';

// Schema for a single permission entry in a multi-entity response.
const multiEntityPermissionSchema = z.object({
  groupId: z.number().describe('The ID of the group.'),
  group: z.string().describe('The name of the group.'),
  view: z.number().describe('View permission flag (0 or 1).'),
  edit: z.number().describe('Edit permission flag (0 or 1).'),
  delete: z.number().describe('Delete permission flag (0 or 1).'),
});

// Schema for a generic error response.
const errorResponseSchema = z.object({
  success: z.literal(false),
  message: z.string(),
  error: z.any().optional(),
  errorData: z.any().optional(),
});

// Schema for a successful response.
const successResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(multiEntityPermissionSchema),
});

/**
 * Schema for the tool's output, which can be a success or error response.
 */
const outputSchema = z.union([successResponseSchema, errorResponseSchema]);

/**
 * @tool getMultiEntityPermissions
 * @description A tool to get aggregated permissions for multiple entities of the same type.
 */
export const getMultiEntityPermissions = createTool({
  id: 'get-multi-entity-permissions',
  description: 'Gets permissions for multiple entities of the same type.',
  inputSchema: z.object({
    entity: z.string().describe("The entity type (e.g., 'layout', 'campaign')."),
    ids: z.array(z.number()).describe('An array of object IDs for the specified entity.'),
  }),
  outputSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      const message = 'CMS URL is not configured.';
      logger.error(message);
      return { success: false as const, message };
    }

    const { entity, ids } = context;
    const url = new URL(`${config.cmsUrl}/api/user/permissions/${entity}`);
    url.searchParams.append('ids', ids.join(','));

    try {
      logger.info({ entity, ids }, 'Attempting to retrieve multi-entity permissions.');

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: await getAuthHeaders(),
      });

      const responseData = await response.json();

      if (!response.ok) {
        const decodedError = decodeErrorMessage(responseData);
        const message = `Failed to get multi-entity permissions. API responded with status ${response.status}.`;
        logger.error({ status: response.status, response: decodedError, entity, ids }, message);
        return { success: false as const, message, errorData: decodedError };
      }

      const validationResult = z.array(multiEntityPermissionSchema).safeParse(responseData);

      if (!validationResult.success) {
        const message = 'Multi-entity permissions response validation failed.';
        logger.error({ error: validationResult.error.flatten(), data: responseData }, message);
        return { success: false as const, message, error: validationResult.error, errorData: responseData };
      }

      logger.info({ count: validationResult.data.length }, `Successfully retrieved ${validationResult.data.length} aggregated permission records.`);
      return { success: true as const, data: validationResult.data };
    } catch (error: unknown) {
      const message = 'An unexpected error occurred while retrieving multi-entity permissions.';
      logger.error({ error, entity, ids }, message);
      return {
        success: false as const,
        message,
        error: error instanceof Error ? { name: error.name, message: error.message } : error,
      };
    }
  },
}); 