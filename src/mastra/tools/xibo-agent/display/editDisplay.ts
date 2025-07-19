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
 * @module editDisplay
 * @description Provides a tool to edit an existing display in the Xibo CMS.
 * It implements the PUT /display/{displayId} endpoint.
 */
import { z } from 'zod';
import { createTool } from '@mastra/core';
import { getAuthHeaders } from '../auth';
import { config } from '../config';
import { logger } from '../../../index';
import { processError } from '../utility/error';
import { displaySchema } from './schemas';

/**
 * Schema for a standardized error response.
 */
const errorResponseSchema = z.object({
  success: z.literal(false),
  message: z.string().describe('A simple, readable error message.'),
  error: z
    .any()
    .optional()
    .describe('Detailed error information, e.g., from Zod.'),
  errorData: z.any().optional().describe('Raw response data from the CMS.'),
});

const editDisplaySuccessSchema = z.object({
  success: z.literal(true),
  data: displaySchema,
});

const outputSchema = z.union([editDisplaySuccessSchema, errorResponseSchema]);

export const editDisplay = createTool({
  id: 'edit-display',
  description: 'Edits an existing display.',
  inputSchema: z.object({
    displayId: z.number().describe('The Display ID'),
    display: z.string().describe('The Display Name'),
    description: z.string().optional().describe('A description of the Display'),
    tags: z.string().optional().describe('A comma separated list of tags for this item'),
    auditingUntil: z.string().optional().describe('A date this Display records auditing information until.'),
    defaultLayoutId: z.number().describe('A Layout ID representing the Default Layout for this Display.'),
    licensed: z.number().describe('Flag indicating whether this display is licensed.'),
    license: z.string().describe('The hardwareKey to use as the licence key for this Display'),
    incSchedule: z.number().describe('Flag indicating whether the Default Layout should be included in the Schedule'),
    emailAlert: z.number().describe('Flag indicating whether the Display generates up/down email alerts.'),
    alertTimeout: z.number().optional().describe("How long in seconds should this display wait before alerting when it hasn't connected. Override for the collection interval."),
    wakeOnLanEnabled: z.number().describe('Flag indicating if Wake On LAN is enabled for this Display'),
    wakeOnLanTime: z.string().optional().describe('A h:i string representing the time that the Display should receive its Wake on LAN command'),
    broadCastAddress: z.string().optional().describe('The BroadCast Address for this Display - used by Wake On LAN'),
    secureOn: z.string().optional().describe('The secure on configuration for this Display'),
    cidr: z.string().optional().describe('The CIDR configuration for this Display'), // API docs say integer, but this is likely a string.
    latitude: z.number().optional().describe('The Latitude of this Display'),
    longitude: z.number().optional().describe('The Longitude of this Display'),
    timeZone: z.string().optional().describe('The timezone for this display, or empty to use the CMS timezone'),
    languages: z.string().optional().describe('An array of languages supported in this display location'),
    displayProfileId: z.number().optional().describe('The Display Settings Profile ID'),
    displayTypeId: z.number().optional().describe('The Display Type ID of this Display'),
    screenSize: z.number().optional().describe('The screen size of this Display'),
    venueId: z.number().optional().describe('The Venue ID of this Display'),
    address: z.string().optional().describe('The Location Address of this Display'),
    isMobile: z.number().optional().describe('Is this Display mobile?'),
    isOutdoor: z.number().optional().describe('Is this Display Outdoor?'),
    costPerPlay: z.number().optional().describe('The Cost Per Play of this Display'),
    impressionsPerPlay: z.number().optional().describe('The Impressions Per Play of this Display'),
    customId: z.string().optional().describe('The custom ID of this Display'),
    ref1: z.string().optional().describe('Reference 1'),
    ref2: z.string().optional().describe('Reference 2'),
    ref3: z.string().optional().describe('Reference 3'),
    ref4: z.string().optional().describe('Reference 4'),
    ref5: z.string().optional().describe('Reference 5'),
    clearCachedData: z.number().optional().describe('Clear all Cached data for this display'),
    rekeyXmr: z.number().optional().describe('Clear the cached XMR configuration and send a rekey'),
    teamViewerSerial: z.string().optional().describe('The TeamViewer serial number for this Display, if applicable'),
    webkeySerial: z.string().optional().describe('The Webkey serial number for this Display, if applicable'),
    folderId: z.number().optional().describe('Folder ID to which this object should be assigned to'),
  }),
  outputSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      const message = 'CMS URL is not configured.';
      logger.error({}, message);
      return { success: false as const, message };
    }

    try {
      const { displayId, ...bodyParams } = context;
      const url = new URL(`${config.cmsUrl}/api/display/${displayId}`);

      const body = new URLSearchParams();
      Object.entries(bodyParams).forEach(([key, value]) => {
        // Exclude undefined, null, and empty strings from the request body.
        if (value !== undefined && value !== null && value !== '') {
          body.append(key, value.toString());
        }
      });

      const authHeaders = await getAuthHeaders();
      const headers = {
        ...authHeaders,
        'Content-Type': 'application/x-www-form-urlencoded',
      };

      logger.debug(
        { url: url.toString(), body: body.toString() },
        `Editing display ${displayId}`
      );

      const response = await fetch(url.toString(), {
        method: 'PUT',
        headers,
        body,
      });

      if (!response.ok) {
        const message = `Failed to edit display ${displayId}. Status: ${response.status}`;
        let errorData: any = await response.text();
        try {
          errorData = JSON.parse(errorData);
        } catch (e) {
          // Not a JSON response
        }
        logger.error({ status: response.status, data: errorData }, message);
        return {
          success: false as const,
          message,
          errorData,
        };
      }

      const responseData = await response.json();
      const validationResult = displaySchema.safeParse(responseData);

      if (!validationResult.success) {
        const message = `Edit display ${displayId} response validation failed.`;
        logger.error(
          { error: validationResult.error.flatten(), data: responseData },
          message
        );
        return {
          success: false as const,
          message,
          error: validationResult.error.flatten(),
          errorData: responseData,
        };
      }
      return { success: true as const, data: validationResult.data };
    } catch (error) {
      const processedError = processError(error);
      const message = 'An unexpected error occurred while editing a display.';
      logger.error({ error: processedError }, message);
      return {
        success: false as const,
        message,
        error: processedError,
      };
    }
  },
}); 