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
 * This module provides a tool for creating a new campaign in Xibo CMS.
 * It implements the POST /campaign endpoint.
 */

import { z } from 'zod';
import { createTool } from '@mastra/core/tools';
import { config } from '../config';
import { getAuthHeaders } from '../auth';
import { logger } from '../../../index';
import { campaignSchema } from './schemas';

const inputSchema = z.object({
  type: z.string().describe('Type of campaign (list|ad).'),
  name: z.string().describe('Name of the campaign.'),
  folderId: z.number().optional().describe('ID of the folder to create the campaign in.'),
  layoutIds: z.array(z.number()).optional().describe('Array of layout IDs to assign to this campaign (ordered).'),
  cyclePlaybackEnabled: z.number().optional().describe('Enable cycle-based playback (1: enabled, 0: disabled).'),
  playCount: z.number().optional().describe('For cycle-based playback, how many times to play each layout before moving to the next.'),
  listPlayOrder: z.string().optional().describe('For list campaigns, how to play campaigns with the same play order.'),
  targetType: z.string().optional().describe('For ad campaigns, the measurement for the target (plays|budget|imp).'),
  target: z.number().optional().describe('For ad campaigns, the target number of plays for the entire campaign.'),
});

const outputSchema = z.union([
  z.object({
    success: z.literal(true),
    message: z.string(),
    data: campaignSchema,
  }),
  z.object({
    success: z.literal(false),
    message: z.string(),
    error: z.any().optional(),
  }),
]);

export const addCampaign = createTool({
  id: 'add-campaign',
  description: 'Add a new campaign in the Xibo CMS.',
  inputSchema,
  outputSchema,
  execute: async ({
    context: input,
  }): Promise<z.infer<typeof outputSchema>> => {
    if (!config.cmsUrl) {
      return { success: false, message: 'CMS URL is not configured.' };
    }

    try {
      const authHeaders = await getAuthHeaders();
      const headers = { ...authHeaders, 'Content-Type': 'application/x-www-form-urlencoded' };
      const params = new URLSearchParams();

      Object.entries(input).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (key === 'layoutIds' && Array.isArray(value)) {
            // The API likely expects a specific format for arrays, often not standard URL encoding.
            // Assuming it expects comma-separated values for a parameter like this.
            // This might need adjustment based on actual API behavior.
            params.append(key, JSON.stringify(value));
          } else {
            params.append(key, String(value));
          }
        }
      });
      
      const url = `${config.cmsUrl}/api/campaign`;
      logger.debug(`postCampaign: Requesting URL = ${url}`, { body: params.toString() });

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: params.toString(),
      });
      
      const responseData = await response.json();

      if (!response.ok) {
        logger.error(`postCampaign: HTTP error: ${response.status}`, { error: responseData });
        return { success: false, message: `HTTP error! status: ${response.status}`, error: responseData };
      }

      const validatedData = campaignSchema.parse(responseData);
      logger.info(`postCampaign: Successfully created campaign ${validatedData.campaignId}.`);
      return { success: true, message: 'Campaign created successfully.', data: validatedData };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      logger.error('postCampaign: An unexpected error occurred', { error });

      if (error instanceof z.ZodError) {
        return { success: false, message: 'Validation error occurred.', error: error.issues };
      }
      
      return { success: false, message: `An unexpected error occurred: ${errorMessage}` };
    }
  },
}); 