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
 * This module provides a tool for editing an existing campaign in Xibo CMS.
 * It implements the PUT /campaign/{id} endpoint.
 */

import { z } from 'zod';
import { createTool } from '@mastra/core/tools';
import { config } from '../config';
import { getAuthHeaders } from '../auth';
import { logger } from '../../../logger';  
import { campaignSchema } from './schemas';

// Schema for the tool's input, based on the API endpoint.
const inputSchema = z.object({
  campaignId: z.number().describe('ID of the campaign to edit.'),
  name: z.string().describe('The new name for the campaign.'),
  folderId: z.number().optional().describe('Folder ID to which this object should be assigned to.'),
  manageLayouts: z.number().optional().describe('Flag indicating whether to manage layouts or not. Default to no.'),
  layoutIds: z.array(z.number()).optional().describe('An array of layoutIds to assign to this Campaign, in order.'),
  cyclePlaybackEnabled: z.number().optional().describe("When cycle based playback is enabled only 1 Layout from this Campaign will be played each time it is in a Schedule loop. The same Layout will be shown until the 'Play count' is achieved."),
  playCount: z.number().optional().describe('In cycle based playback, how many plays should each Layout have before moving on?'),
  listPlayOrder: z.string().optional().describe('In layout list, how should campaigns in the schedule with the same play order be played?'),
  targetType: z.string().optional().describe('For ad campaigns, how do we measure the target? plays|budget|imp'),
  target: z.number().optional().describe('For ad campaigns, what is the target count for playback over the entire campaign'),
  startDt: z.string().optional().describe('For ad campaigns, what is the start date (ISO 8601 format).'),
  endDt: z.string().optional().describe('For ad campaigns, what is the end date (ISO 8601 format).'),
  displayGroupIds: z.array(z.number()).optional().describe('For ad campaigns, which display groups should the campaign be run on?'),
  ref1: z.string().optional().describe('An optional reference field.'),
  ref2: z.string().optional().describe('An optional reference field.'),
  ref3: z.string().optional().describe('An optional reference field.'),
  ref4: z.string().optional().describe('An optional reference field.'),
  ref5: z.string().optional().describe('An optional reference field.'),
});

// Schema for the tool's output.
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

/**
 * Tool to edit an existing campaign in the Xibo CMS.
 */
export const editCampaign = createTool({
  id: 'edit-campaign',
  description: 'Edits an existing campaign in the Xibo CMS.',
  inputSchema,
  outputSchema,
  execute: async ({
    context: input,
  }): Promise<z.infer<typeof outputSchema>> => {
    // Log the start of the execution.
    logger.info({ input }, 'Executing editCampaign tool.');
    const { campaignId, layoutIds, displayGroupIds, ...inputData } = input;

    if (!config.cmsUrl) {
      const message = 'CMS URL is not configured.';
      logger.error(message);
      return { success: false, message };
    }

    try {
      const authHeaders = await getAuthHeaders();
      const headers = { ...authHeaders, 'Content-Type': 'application/x-www-form-urlencoded' };
      const params = new URLSearchParams();

      Object.entries(inputData).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });

      if (layoutIds) {
        layoutIds.forEach((id) => params.append('layoutIds[]', String(id)));
      }

      if (displayGroupIds) {
        displayGroupIds.forEach((id) =>
          params.append('displayGroupIds[]', String(id)),
        );
      }
      
      const url = `${config.cmsUrl}/api/campaign/${campaignId}`;
      // Log the request details before sending.
      logger.debug({ url, body: params.toString() }, 'Sending PUT request to edit campaign.');

      const response = await fetch(url, {
        method: 'PUT',
        headers,
        body: params.toString(),
      });
      
      const responseData = await response.json();

      if (!response.ok) {
        // Log the HTTP error.
        const message = `HTTP error! status: ${response.status}`;
        logger.error({ status: response.status, responseData }, message);
        return { success: false, message, error: responseData };
      }

      const validatedData = campaignSchema.parse(responseData);
      // Log the successful edit.
      logger.info({ campaignId: validatedData.campaignId }, 'Successfully edited campaign.');
      return { success: true, message: 'Campaign edited successfully.', data: validatedData };

    } catch (error) {
      // Log any unexpected errors.
      logger.error({ error, input }, 'An unexpected error occurred in editCampaign.');

      if (error instanceof z.ZodError) {
        return { success: false, message: 'Validation error occurred.', error: error.issues };
      }
      
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      return { success: false, message: `An unexpected error occurred: ${errorMessage}` };
    }
  },
}); 