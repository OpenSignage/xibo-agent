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
 * This module provides a tool for assigning a layout to a campaign in Xibo CMS.
 * It implements the POST /campaign/layout/assign/{campaignId} endpoint.
 */

import { z } from 'zod';
import { createTool } from '@mastra/core/tools';
import { config } from '../config';
import { getAuthHeaders } from '../auth';
import { logger } from '../../../index';
import { URLSearchParams } from 'url';

// Schema for the tool's input.
const inputSchema = z.object({
  campaignId: z.number().describe('The Campaign ID'),
  layoutId: z.number().describe('Layout ID to Assign: Please note that as of v3.0.0 this API no longer accepts multiple layoutIds.'),
  daysOfWeek: z.array(z.number()).optional().describe('Ad campaigns: restrict this to certain days of the week (iso week)'),
  dayPartId: z.number().optional().describe('Ad campaigns: restrict this to a day part'),
  geoFence: z.string().optional().describe('Ad campaigns: restrict this to a geofence'),
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
 * Tool to assign a layout to a campaign in the Xibo CMS.
 */
export const assignLayoutToCampaign = createTool({
  id: 'assign-layout-to-campaign',
  description: 'Assigns a layout to a campaign in the Xibo CMS.',
  inputSchema,
  outputSchema,
  execute: async ({
    context: input,
  }): Promise<z.infer<typeof outputSchema>> => {
    // Log the start of the execution.
    logger.info({ input }, 'Executing assignLayoutToCampaign tool.');
    const { campaignId, layoutId, daysOfWeek, dayPartId, geoFence } = input;

    if (!config.cmsUrl) {
      const message = 'CMS URL is not configured.';
      logger.error(message);
      return {
        success: false,
        message,
      };
    }

    const url = `${config.cmsUrl}/api/campaign/layout/assign/${campaignId}`;
    
    try {
      const params = new URLSearchParams();
      params.append('layoutId', layoutId.toString());

      if (daysOfWeek) {
        daysOfWeek.forEach((day) =>
          params.append('daysOfWeek[]', day.toString()),
        );
      }

      if (dayPartId !== undefined) {
        params.append('dayPartId', dayPartId.toString());
      }

      if (geoFence !== undefined) {
        params.append('geoFence', geoFence);
      }
      
      const authHeaders = await getAuthHeaders();
      const headers = {
        ...authHeaders,
        'Content-Type': 'application/x-www-form-urlencoded',
      };

      // Log the request details before sending.
      logger.debug({ url, body: params.toString() }, 'Sending POST request to assign layout to campaign.');

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: params.toString(),
      });

      if (response.status === 204) {
        // Log the successful assignment.
        logger.info({ layoutId, campaignId }, 'Successfully assigned layout to campaign.');
        return {
          success: true,
          message: `Layout ${layoutId} successfully assigned to campaign ${campaignId}.`,
        };
      }

      const errorData = await response.json().catch(() => response.statusText);
      // Log the HTTP error.
      const message = `HTTP error! status: ${response.status}`;
      logger.error({ status: response.status, error: errorData }, message);
      return {
        success: false,
        message,
        error: errorData,
      };

    } catch (error) {
      // Log any unexpected errors.
      logger.error({ error }, 'An unexpected error occurred in assignLayoutToCampaign.');
      if (error instanceof z.ZodError) {
        return { success: false, message: 'Validation error occurred.', error: error.issues };
      }
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      return {
        success: false,
        message: `An unexpected error occurred: ${errorMessage}`,
        error,
      };
    }
  },
}); 