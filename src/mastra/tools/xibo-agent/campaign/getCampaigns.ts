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
 * This module provides a tool for searching and retrieving campaigns from Xibo CMS.
 * It implements the GET /campaign endpoint with various filtering options.
 */

import { z } from 'zod';
import { createTool } from '@mastra/core/tools';
import { config } from '../config';
import { getAuthHeaders } from '../auth';
import { logger } from '../../../index';
import { campaignSchema } from './schemas';

const inputSchema = z.object({
  campaignId: z.number().optional().describe('Filter by Campaign ID.'),
  name: z.string().optional().describe('Filter by campaign name (supports filtering with %).'),
  tags: z.string().optional().describe('Filter by a comma-separated list of tags.'),
  exactTags: z.number().optional().describe('Whether to treat the tag filter as an exact match.'),
  logicalOperator: z.string().optional().describe('Logical operator for multiple tags (AND|OR).'),
  hasLayouts: z.number().optional().describe('Filter by whether the campaign has layouts.'),
  isLayoutSpecific: z.number().optional().describe('Filter for layout-specific campaigns.'),
  retired: z.number().optional().describe('Filter for retired campaigns.'),
  totalDuration: z.number().optional().describe('Whether to include the total duration.'),
  embed: z.string().optional().default('layouts,permissions,tags,event').describe('Include related data (layouts, permissions, tags, event).'),
  folderId: z.number().optional().describe('Filter by folder ID.'),
});

const outputSchema = z.union([
  z.object({
    success: z.literal(true),
    message: z.string(),
    data: z.array(campaignSchema),
  }),
  z.object({
    success: z.literal(false),
    message: z.string(),
    error: z.any().optional(),
  }),
]);

export const getCampaigns = createTool({
  id: 'get-campaigns',
  description: 'Searches for and retrieves campaigns from the Xibo CMS.',
  inputSchema,
  outputSchema,
  execute: async ({ context: input }): Promise<z.infer<typeof outputSchema>> => {
    if (!config.cmsUrl) {
      return { success: false, message: 'CMS URL is not configured.' };
    }
    
    try {
      const headers = await getAuthHeaders();
      const params = new URLSearchParams();
      
      Object.entries(input).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });

      const url = `${config.cmsUrl}/api/campaign?${params.toString()}`;
      logger.debug(`getCampaigns: Requesting URL = ${url}`);

      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      const responseData = await response.json();

      if (!response.ok) {
        logger.error(`getCampaigns: HTTP error: ${response.status}`, { error: responseData });
        return { success: false, message: `HTTP error! status: ${response.status}`, error: responseData };
      }

      const validatedData = z.array(campaignSchema).parse(responseData);
      logger.info('getCampaigns: Successfully retrieved and validated campaigns.');
      return { success: true, message: 'Campaigns retrieved successfully.', data: validatedData };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      logger.error('getCampaigns: An unexpected error occurred', { error });
      
      if (error instanceof z.ZodError) {
        return { success: false, message: 'Validation error occurred.', error: error.issues };
      }
      
      return { success: false, message: `An unexpected error occurred: ${errorMessage}` };
    }
  },
}); 