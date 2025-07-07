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
 * @module
 * This module provides a tool for editing an existing display group in the Xibo CMS.
 * It sends a PUT request to the /api/displaygroup/:displayGroupId endpoint.
 */

import { z } from 'zod';
import { createTool } from '@mastra/core/tools';
import { config } from '../config';
import { getAuthHeaders } from '../auth';
import { logger } from '../../../index';
import { displayGroupSchema } from './schemas';

const inputSchema = z.object({
  displayGroupId: z.number().describe('The ID of the display group to edit.'),
  name: z.string().describe('The new name for the display group.'),
  description: z.string().optional().describe('An optional new description for the display group.'),
  isDynamic: z.number().optional().describe('Flag to set the group as dynamic (0 or 1).'),
  tags: z.string().optional().describe('A comma-separated list of tags for the display group.'),
  dynamicCriteria: z.string().optional().describe('SQL filter for dynamic groups.'),
  folderId: z.number().optional().describe('The ID of the folder to move the group to.'),
});

const outputSchema = z.union([
  z.object({
    success: z.literal(true),
    message: z.string(),
    data: displayGroupSchema,
  }),
  z.object({
    success: z.literal(false),
    message: z.string(),
    error: z.any().optional(),
  }),
]);

export const editDisplayGroup = createTool({
  id: 'edit-display-group',
  description: 'Edit an existing display group in the CMS.',
  inputSchema,
  outputSchema,
  execute: async ({ context: input }): Promise<z.infer<typeof outputSchema>> => {
    try {
      if (!config.cmsUrl) {
        return { success: false, message: 'CMS URL is not configured.' };
      }
      
      const { displayGroupId, ...bodyParams } = input;
      const headers = await getAuthHeaders();
      const params = new URLSearchParams();

      // The API expects 'displayGroup' for the name field
      params.append('displayGroup', bodyParams.name);
      
      Object.entries(bodyParams).forEach(([key, value]) => {
        // 'name' is already handled, so we skip it
        if (key !== 'name' && value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });
      
      const url = `${config.cmsUrl}/api/displaygroup/${displayGroupId}`;
      logger.debug(`editDisplayGroup: Requesting URL = ${url}, Body = ${params.toString()}`);
      
      const response = await fetch(url, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });

      const responseData = await response.json();

      if (!response.ok) {
        logger.error(`editDisplayGroup: HTTP error: ${response.status}`, { error: responseData });
        return { success: false, message: `HTTP error! status: ${response.status}`, error: responseData };
      }

      const validatedData = displayGroupSchema.parse(responseData);
      return { success: true, message: 'Display group edited successfully.', data: validatedData };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      logger.error('editDisplayGroup: An unexpected error occurred', { error });

      if (error instanceof z.ZodError) {
        return { success: false, message: 'Validation error occurred.', error: error.issues };
      }
      
      return { success: false, message: `An unexpected error occurred: ${errorMessage}`, error };
    }
  },
}); 