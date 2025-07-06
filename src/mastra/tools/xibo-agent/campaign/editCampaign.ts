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
import { logger } from '../../../index';

const inputSchema = z.object({
  campaignId: z.number().describe('ID of the campaign to edit.'),
  name: z.string().describe('The new name for the campaign.'),
  folderId: z.number().optional().describe('Folder ID to which this object should be assigned to.'),
  manageLayouts: z.number().optional().describe('Flag indicating whether to manage layouts or not. Default to no.'),
  layoutIds: z.array(z.number()).optional().describe('An array of layoutIds to assign to this Campaign, in order.'),
  cyclePlaybackEnabled: z.number().optional().describe("When cycle based playback is enabled only 1 Layout from this Campaign will be played each time it is in a Schedule loop. The same Layout will be shown until the 'Play count' is achieved.",),
  playCount: z.number().optional().describe('In cycle based playback, how many plays should each Layout have before moving on?',),
  listPlayOrder: z.string().optional().describe('In layout list, how should campaigns in the schedule with the same play order be played?',),
  targetType: z.string().optional().describe('For ad campaigns, how do we measure the target? plays|budget|imp'),
  target: z.number().optional().describe('For ad campaigns, what is the target count for playback over the entire campaign',),
  startDt: z.string().optional().describe('For ad campaigns, what is the start date (ISO 8601 format).'),
  endDt: z.string().optional().describe('For ad campaigns, what is the end date (ISO 8601 format).'),
  displayGroupIds: z.array(z.number()).optional().describe('For ad campaigns, which display groups should the campaign be run on?',),
  ref1: z.string().optional().describe('An optional reference field.'),
  ref2: z.string().optional().describe('An optional reference field.'),
  ref3: z.string().optional().describe('An optional reference field.'),
  ref4: z.string().optional().describe('An optional reference field.'),
  ref5: z.string().optional().describe('An optional reference field.'),
});

const tagSchema = z.object({
  tag: z.string().describe('The name of the tag.'),
  tagId: z.number().describe('The ID of the tag.'),
  value: z.string().nullable().describe('The value associated with the tag.'),
});

const campaignResponseSchema = z.object({
  campaignId: z.number().describe('The ID of the campaign.'),
  ownerId: z.number().describe('The ID of the campaign owner.'),
  type: z.string().describe('The type of the campaign (e.g., "list", "ad").'),
  campaign: z.string().describe('The name of the campaign.'),
  isLayoutSpecific: z.number().describe('Indicates if the campaign is layout-specific.'),
  numberLayouts: z.number().describe('The number of layouts in the campaign.'),
  totalDuration: z.number().optional().describe('The total duration of the campaign in seconds.'),
  tags: z.array(tagSchema).optional().describe('An array of tags associated with the campaign.'),
  folderId: z.number().optional().describe('The ID of the folder containing the campaign.'),
  permissionsFolderId: z.number().optional().describe('The ID of the folder for permissions.'),
  cyclePlaybackEnabled: z.number().optional().describe('Indicates if cycle-based playback is enabled.'),
  playCount: z.number().optional().describe('The number of times each layout plays in a cycle.'),
  listPlayOrder: z.string().optional().describe('The play order for list campaigns.'),
  targetType: z.string().optional().describe('The measurement target type for ad campaigns (e.g., "plays", "budget", "imp").',),
  target: z.number().optional().describe('The target value for ad campaigns.'),
  startDt: z.number().nullable().optional().describe('The start date/time of the campaign (timestamp).'),
  endDt: z.number().nullable().optional().describe('The end date/time of the campaign (timestamp).'),
  plays: z.number().optional().describe('The number of plays.'),
  spend: z.number().optional().describe('The amount spent.'),
  impressions: z.number().optional().describe('The number of impressions.'),
  lastPopId: z.number().optional().describe('The ID of the last POP.'),
  ref1: z.string().nullable().optional().describe('Reference field 1.'),
  ref2: z.string().nullable().optional().describe('Reference field 2.'),
  ref3: z.string().nullable().optional().describe('Reference field 3.'),
  ref4: z.string().nullable().optional().describe('Reference field 4.'),
  ref5: z.string().nullable().optional().describe('Reference field 5.'),
  createdDt: z.string().optional().describe('The creation date of the campaign.'),
  modifiedDt: z.string().optional().describe('The last modification date of the campaign.'),
  isDefault: z.number().optional().describe('Indicates if this is the default campaign.'),
});

const outputSchema = z.union([
  z.object({
    success: z.literal(true),
    message: z.string(),
    data: campaignResponseSchema,
  }),
  z.object({
    success: z.literal(false),
    message: z.string(),
    error: z.any().optional(),
  }),
]);

export const editCampaign = createTool({
  id: 'edit-campaign',
  description: 'Edits an existing campaign in the Xibo CMS.',
  inputSchema,
  outputSchema,
  execute: async ({
    context: input,
  }): Promise<z.infer<typeof outputSchema>> => {
    const { campaignId, layoutIds, displayGroupIds, ...inputData } = input;

    if (!config.cmsUrl) {
      return { success: false, message: 'CMS URL is not configured.' };
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
      logger.debug(`putCampaign: Requesting URL = ${url}`, { body: params.toString() });

      const response = await fetch(url, {
        method: 'PUT',
        headers,
        body: params.toString(),
      });
      
      const responseData = await response.json();

      if (!response.ok) {
        logger.error(`putCampaign: HTTP error: ${response.status}`, { error: responseData });
        return { success: false, message: `HTTP error! status: ${response.status}`, error: responseData };
      }

      const validatedData = campaignResponseSchema.parse(responseData);
      logger.info(`putCampaign: Successfully edited campaign ${validatedData.campaignId}.`);
      return { success: true, message: 'Campaign edited successfully.', data: validatedData };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      logger.error('putCampaign: An unexpected error occurred', { error });

      if (error instanceof z.ZodError) {
        return { success: false, message: 'Validation error occurred.', error: error.issues };
      }
      
      return { success: false, message: `An unexpected error occurred: ${errorMessage}` };
    }
  },
}); 