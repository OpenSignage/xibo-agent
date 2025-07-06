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
 * This module provides a tool for removing a layout from a campaign in Xibo CMS.
 * It implements the DELETE /campaign/layout/remove/{campaignId} endpoint.
 */

import { z } from 'zod';
import { createTool } from '@mastra/core/tools';
import { config } from '../config';
import { getAuthHeaders } from '../auth';
import { logger } from '../../../index';

const inputSchema = z.object({
  campaignId: z
    .number()
    .describe('The ID of the campaign to remove the layout from.'),
  layoutId: z.number().describe('The ID of the layout to remove.'),
  displayOrder: z
    .number()
    .optional()
    .describe('The display order. Omit to remove all occurences of the layout'),
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

export const removeLayoutFromCampaign = createTool({
  id: 'remove-layout-from-campaign',
  description: 'Removes a layout from a campaign in the Xibo CMS.',
  inputSchema,
  outputSchema,
  execute: async ({
    context: input,
  }): Promise<z.infer<typeof outputSchema>> => {
    const { campaignId, layoutId, displayOrder } = input;

    if (!config.cmsUrl) {
      return { success: false, message: 'CMS URL is not configured.' };
    }

    const url = `${config.cmsUrl}/api/campaign/layout/remove/${campaignId}`;

    try {
      const authHeaders = await getAuthHeaders();
      const headers = {
        ...authHeaders,
        'Content-Type': 'application/x-www-form-urlencoded',
      };
      const params = new URLSearchParams();
      params.append('layoutId', layoutId.toString());

      if (displayOrder !== undefined) {
        params.append('displayOrder', displayOrder.toString());
      }

      logger.debug(`removeLayoutFromCampaign: Requesting URL = ${url}`, {
        body: params.toString(),
      });

      const response = await fetch(url, {
        method: 'DELETE',
        headers,
        body: params.toString(),
      });

      if (response.status === 204) {
        logger.info(
          `Successfully removed layout ${layoutId} from campaign ${campaignId}.`,
        );
        return { success: true, message: 'Layout removed successfully.' };
      }

      const errorData = await response.json().catch(() => response.statusText);
      logger.error(
        `removeLayoutFromCampaign: HTTP error: ${response.status}`,
        { error: errorData },
      );
      return {
        success: false,
        message: `HTTP error! status: ${response.status}`,
        error: errorData,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'An unknown error occurred';
      logger.error('removeLayoutFromCampaign: An unexpected error occurred', {
        error,
      });

      if (error instanceof z.ZodError) {
        return {
          success: false,
          message: 'Validation error occurred.',
          error: error.issues,
        };
      }

      return {
        success: false,
        message: `An unexpected error occurred: ${errorMessage}`,
        error,
      };
    }
  },
}); 