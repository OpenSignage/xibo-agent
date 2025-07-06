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
 * This module defines common Zod schemas for the Campaign tools in the Xibo Agent.
 * These schemas are used for data validation and type inference.
 */

import { z } from 'zod';

export const tagSchema = z.object({
  tag: z.string().describe('The name of the tag.'),
  tagId: z.number().describe('The ID of the tag.'),
  value: z.string().nullable().describe('The value associated with the tag.'),
});

export const campaignSchema = z.object({
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
  targetType: z.string().nullable().optional().describe('The measurement target type for ad campaigns (e.g., "plays", "budget", "imp").',),
  target: z.number().optional().describe('The target value for ad campaigns.'),
  startDt: z.number().nullable().optional().describe('The start date/time of the campaign (timestamp).'),
  endDt: z.number().nullable().optional().describe('The end date/time of the campaign (timestamp).'),
  plays: z.number().optional().describe('The number of plays.'),
  spend: z.number().optional().describe('The amount spent.'),
  impressions: z.number().optional().describe('The number of impressions.'),
  lastPopId: z.number().nullable().optional().describe('The ID of the last POP.'),
  ref1: z.string().nullable().optional().describe('Reference field 1.'),
  ref2: z.string().nullable().optional().describe('Reference field 2.'),
  ref3: z.string().nullable().optional().describe('Reference field 3.'),
  ref4: z.string().nullable().optional().describe('Reference field 4.'),
  ref5: z.string().nullable().optional().describe('Reference field 5.'),
  createdDt: z.string().optional().describe('The creation date of the campaign.'),
  modifiedDt: z.string().optional().describe('The last modification date of the campaign.'),
  isDefault: z.number().optional().describe('Indicates if this is the default campaign.'),
  layouts: z.array(z.unknown()).optional().describe('An array of layouts associated with the campaign (if embedded).'),
});
