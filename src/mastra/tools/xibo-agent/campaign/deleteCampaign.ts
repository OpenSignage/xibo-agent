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
 * This module provides a tool to delete a campaign from the Xibo CMS.
 * It implements the DELETE /campaign/{campaignId} endpoint.
 */

import { z } from 'zod';
import { createTool } from '@mastra/core/tools';
import { config } from '../config';
import { getAuthHeaders } from '../auth';
import { logger } from '../../../index';

const inputSchema = z.object({
  campaignId: z.number().describe('The ID of the campaign to delete.'),
});

const outputSchema = z.union([
  z.object({
    success: z.literal(true),
    message: z.string(),
  }),
  z.object({
    success: z.literal(false),
    message: z.string(),
    error: z.any().optional(),
  }),
]);

export const deleteCampaign = createTool({
  id: 'delete-campaign',
  description: 'Deletes a specific campaign from the Xibo CMS.',
  inputSchema,
  outputSchema,
  execute: async ({
    context: input,
  }): Promise<z.infer<typeof outputSchema>> => {
    const { campaignId } = input;

    if (!config.cmsUrl) {
      return { success: false, message: 'CMS URL is not configured.' };
    }

    try {
      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/campaign/${campaignId}`;
      logger.debug(`deleteCampaign: Requesting URL = ${url}`);

      const response = await fetch(url, {
        method: 'DELETE',
        headers,
      });

      if (response.status === 204) {
        logger.info(`deleteCampaign: Successfully deleted campaign ${campaignId}.`);
        return { success: true, message: `Campaign with ID ${campaignId} deleted successfully.` };
      }
      
      const errorData = await response.json().catch(() => null);
      logger.error(`deleteCampaign: HTTP error: ${response.status}`, { error: errorData });
      return { success: false, message: `HTTP error! status: ${response.status}`, error: errorData };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      logger.error('deleteCampaign: An unexpected error occurred', { error });
      return { success: false, message: `An unexpected error occurred: ${errorMessage}` };
    }
  },
}); 