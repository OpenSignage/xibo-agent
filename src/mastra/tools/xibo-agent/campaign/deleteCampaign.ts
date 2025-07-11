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

// Schema for the tool's input.
const inputSchema = z.object({
  campaignId: z.number().describe('The ID of the campaign to delete.'),
});

// Schema for the tool's output.
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

/**
 * Tool to delete a specific campaign from the Xibo CMS.
 */
export const deleteCampaign = createTool({
  id: 'delete-campaign',
  description: 'Deletes a specific campaign from the Xibo CMS.',
  inputSchema,
  outputSchema,
  execute: async ({
    context: input,
  }): Promise<z.infer<typeof outputSchema>> => {
    const { campaignId } = input;
    // Log the start of the execution.
    logger.info({ campaignId }, 'Executing deleteCampaign tool.');

    if (!config.cmsUrl) {
      const message = 'CMS URL is not configured.';
      logger.error(message);
      return { success: false, message };
    }

    try {
      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/campaign/${campaignId}`;
      // Log the request details before sending.
      logger.debug({ url }, 'Sending DELETE request to delete campaign.');

      const response = await fetch(url, {
        method: 'DELETE',
        headers,
      });

      if (response.status === 204) {
        // Log the successful deletion.
        logger.info({ campaignId }, 'Successfully deleted campaign.');
        return { success: true, message: `Campaign with ID ${campaignId} deleted successfully.` };
      }
      
      const errorData = await response.json().catch(() => null);
      // Log the HTTP error.
      const message = `HTTP error! status: ${response.status}`;
      logger.error({ status: response.status, errorData }, message);
      return { success: false, message, error: errorData };

    } catch (error) {
      // Log any unexpected errors.
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      logger.error({ error, campaignId }, 'An unexpected error occurred in deleteCampaign.');
      return { success: false, message: `An unexpected error occurred: ${errorMessage}` };
    }
  },
}); 