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
 * This module provides a tool for assigning a campaign to a specific folder in Xibo CMS.
 * It implements the PUT /campaign/{id}/selectfolder endpoint.
 */

import { z } from 'zod';
import { createTool } from '@mastra/core/tools';
import { config } from '../config';
import { getAuthHeaders } from '../auth';
import { logger } from '../../../index';
import { campaignSchema } from './schemas';

const inputSchema = z.object({
  campaignId: z.number().describe('The ID of the campaign to move.'),
  folderId: z.number().optional().describe('The ID of the folder to assign the campaign to. If omitted, it may be moved to the root.'),
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

export const selectCampaignFolder = createTool({
  id: 'select-campaign-folder',
  description: 'Assigns a campaign to a specific folder.',
  inputSchema,
  outputSchema,
  execute: async ({ context: input }): Promise<z.infer<typeof outputSchema>> => {
    const { campaignId, folderId } = input;

    if (!config.cmsUrl) {
      return { success: false, message: 'CMS URL is not configured.' };
    }

    try {
      const authHeaders = await getAuthHeaders();
      const headers = { ...authHeaders, 'Content-Type': 'application/x-www-form-urlencoded' };
      const params = new URLSearchParams();
      
      if (folderId !== undefined) {
        params.append('folderId', folderId.toString());
      }
      
      const url = `${config.cmsUrl}/api/campaign/${campaignId}/selectfolder`;
      logger.debug(`selectCampaignFolder: Requesting URL = ${url}`, { body: params.toString() });

      const response = await fetch(url, {
        method: 'PUT',
        headers,
        body: params.toString(),
      });
      
      const responseData = await response.json();

      if (!response.ok) {
        logger.error(`selectCampaignFolder: HTTP error: ${response.status}`, { error: responseData });
        return { success: false, message: `HTTP error! status: ${response.status}`, error: responseData };
      }

      const validatedData = campaignSchema.parse(responseData);
      logger.info(`selectCampaignFolder: Successfully moved campaign ${validatedData.campaignId} to folder.`);
      return { success: true, message: 'Campaign folder updated successfully.', data: validatedData };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      logger.error('selectCampaignFolder: An unexpected error occurred', { error });

      if (error instanceof z.ZodError) {
        return { success: false, message: 'Validation error occurred.', error: error.issues };
      }
      
      return { success: false, message: `An unexpected error occurred: ${errorMessage}`, error };
    }
  },
}); 