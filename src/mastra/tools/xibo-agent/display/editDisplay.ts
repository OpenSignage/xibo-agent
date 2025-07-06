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
 * This module provides a tool for editing display information in the Xibo CMS.
 * It accesses the /api/display/:displayId endpoint to update display properties.
 */

import { z } from 'zod';
import { createTool } from '@mastra/core/tools';
import { config } from '../config';
import { getAuthHeaders } from '../auth';
import { logger } from '../../../index';
import { displaySchema } from './schemas';

const inputSchema = z.object({
  displayId: z.number().describe('The ID of the display to edit.'),
  display: z.string().describe('The new name for the display.'),
  description: z.string().optional().describe('An optional description for the display.'),
  tags: z.string().optional().describe('A comma-separated string of tags to assign to the display.'),
  auditingUntil: z.string().optional().describe('The date until which auditing is enabled (e.g., "yyyy-mm-dd hh:mm:ss").'),
  longitude: z.number().optional().describe('The longitude coordinate for the display.'),
  timeZone: z.string().optional().describe('The timezone for the display (e.g., "America/New_York").'),
  languages: z.string().optional().describe('A comma-separated list of languages.'),
  displayProfileId: z.number().optional().describe('The ID of the display profile to assign.'),
  displayTypeId: z.number().optional().describe('The ID of the display type.'),
  screenSize: z.number().optional().describe('The screen size of the display.'),
  customId: z.string().optional().describe('A custom identifier for the display.'),
  ref1: z.string().optional().describe('Optional reference field 1.'),
  ref2: z.string().optional().describe('Optional reference field 2.'),
  ref3: z.string().optional().describe('Optional reference field 3.'),
  ref4: z.string().optional().describe('Optional reference field 4.'),
  ref5: z.string().optional().describe('Optional reference field 5.'),
  clearCachedData: z.number().optional().describe('Flag to clear cached data (1 for yes).'),
});

const outputSchema = z.union([
  z.object({
    success: z.literal(true),
    message: z.string(),
    data: displaySchema,
  }),
  z.object({
    success: z.literal(false),
    message: z.string(),
    error: z.any().optional(),
  }),
]);

export const editDisplay = createTool({
  id: 'edit-display',
  description: 'Edit the details of a specific display.',
  inputSchema,
  outputSchema,
  execute: async ({ context: input }): Promise<z.infer<typeof outputSchema>> => {
    try {
      if (!config.cmsUrl) {
        return { success: false, message: 'CMS URL is not configured.' };
      }
      
      const { displayId, ...bodyParams } = input;
      const headers = await getAuthHeaders();
      const params = new URLSearchParams();

      Object.entries(bodyParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });
      
      const url = `${config.cmsUrl}/api/display/${displayId}`;
      logger.debug(`editDisplay: Requesting URL = ${url}, Body = ${params.toString()}`);
      
      const response = await fetch(url, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });

      const responseData = await response.json();

      if (!response.ok) {
        logger.error(`editDisplay: HTTP error: ${response.status}`, { error: responseData });
        return { success: false, message: `HTTP error! status: ${response.status}`, error: responseData };
      }

      const validatedData = displaySchema.parse(responseData);
      return { success: true, message: 'Display edited successfully.', data: validatedData };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      logger.error('editDisplay: An unexpected error occurred', { error });

      if (error instanceof z.ZodError) {
        return { success: false, message: 'Validation error occurred.', error: error.issues };
      }
      
      return { success: false, message: `An unexpected error occurred: ${errorMessage}`, error };
    }
  },
}); 