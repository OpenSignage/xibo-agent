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
 * @module getDisplays
 * @description Provides a tool to retrieve a list of displays from the Xibo CMS,
 * with optional filtering. It implements the GET /display endpoint.
 */
import { z } from 'zod';
import { createTool } from '@mastra/core';
import { getAuthHeaders } from '../auth';
import { config } from '../config';
import { logger } from '../../../logger';
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

/**
 * Schema for a successful response, containing an array of displays.
 */
const getDisplaysSuccessSchema = z.object({
  success: z.literal(true),
  data: z.array(displaySchema),
});

/**
 * Union schema for the tool's output, covering both success and error cases.
 */
const outputSchema = z.union([getDisplaysSuccessSchema, errorResponseSchema]);

/**
 * Tool to retrieve a list of displays from the Xibo CMS with optional filtering.
 */
export const getDisplays = createTool({
  id: 'get-displays',
  description: 'Retrieves a list of displays with optional filtering.',
  inputSchema: z.object({
    displayId: z.number().optional().describe('Filter by Display Id'),
    displayGroupId: z.number().optional().describe('Filter by DisplayGroup Id'),
    display: z.string().optional().describe('Filter by Display Name'),
    tags: z.string().optional().describe('Filter by tags'),
    exactTags: z.number().optional().describe('A flag indicating whether to treat the tags filter as an exact match'),
    logicalOperator: z.enum(['AND', 'OR']).optional().describe('When filtering by multiple Tags, which logical operator should be used? AND|OR'),
    macAddress: z.string().optional().describe('Filter by Mac Address'),
    hardwareKey: z.string().optional().describe('Filter by Hardware Key'),
    clientVersion: z.string().optional().describe('Filter by Client Version'),
    clientType: z.string().optional().describe('Filter by Client Type'),
    clientCode: z.string().optional().describe('Filter by Client Code'),
    embed: z.string().optional().describe('Embed related data, namely displaygroups. A comma separated list of child objects to embed.'),
    authorised: z.number().optional().describe('Filter by authorised flag'),
    displayProfileId: z.number().optional().describe('Filter by Display Profile'),
    mediaInventoryStatus: z.number().optional().describe('Filter by Display Status ( 1 - up to date, 2 - downloading, 3 - Out of date)'),
    loggedIn: z.number().optional().describe('Filter by Logged In flag'),
    lastAccessed: z.string().optional().describe('Filter by Display Last Accessed date, expects date in Y-m-d H:i:s format'),
    folderId: z.number().optional().describe('Filter by Folder ID'),
    xmrRegistered: z.number().optional().describe('Filter by whether XMR is registed (1 or 0)'),
    isPlayerSupported: z.number().optional().describe('Filter by whether the player is supported (1 or 0)'),
  }),
  outputSchema,
  execute: async ({ context }) => {
    logger.debug({ context }, 'Executing getDisplays tool.');

    if (!config.cmsUrl) {
      const message = 'CMS URL is not configured.';
      logger.error({}, message);
      return { success: false as const, message };
    }

    try {
      const url = new URL(`${config.cmsUrl}/api/display`);

      // Dynamically build the URL query string from the provided context,
      // excluding any undefined, null, or empty string values.
      Object.entries(context).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          url.searchParams.append(key, value.toString());
        }
      });

      const authHeaders = await getAuthHeaders();
      logger.debug({ url: url.toString() }, 'Fetching displays from CMS');

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: authHeaders,
      });

      if (!response.ok) {
        const message = `Failed to get displays. Status: ${response.status}`;
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
      const validationResult = z.array(displaySchema).safeParse(responseData);

      if (!validationResult.success) {
        const message = 'Get displays response validation failed.';
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

      logger.info(
        { count: validationResult.data.length },
        'Successfully retrieved and validated displays.'
      );

      return { success: true as const, data: validationResult.data };
    } catch (error) {
      const processedError = processError(error);
      const message = 'An unexpected error occurred while getting displays.';
      logger.error({ error: processedError }, message);
      return {
        success: false as const,
        message,
        error: processedError,
      };
    }
  },
});
  