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
 * @module editPlayerVersion
 * @description Provides a tool to edit a specific player software version's information
 * in the Xibo CMS. It implements the PUT /playersoftware/{versionId} endpoint.
 */
import { z } from 'zod';
import { createTool } from '@mastra/core';
import { getAuthHeaders } from '../auth';
import { config } from '../config';
import { logger } from '../../../index';
import { processError } from '../utility/error';
import { playerVersionSchema } from './schemas';

/**
 * Schema for the successful response, containing the updated player version.
 */
const editPlayerVersionSuccessSchema = z.object({
  success: z.literal(true),
  data: playerVersionSchema,
});

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
 * Union schema for tool output, covering both success and error cases.
 */
const outputSchema = z.union([
  editPlayerVersionSuccessSchema,
  errorResponseSchema,
]);

/**
 * Tool to edit an existing player software version in the Xibo CMS.
 */
export const editPlayerVersion = createTool({
  id: 'edit-player-version',
  description: 'Edits an existing player software version.',
  inputSchema: z.object({
    versionId: z
      .number()
      .describe('The ID of the player software version to edit.'),
    playerShowVersion: z
      .string()
      .optional()
      .describe('The new display name for the player version.'),
    version: z.string().optional().describe('The new version number.'),
    code: z.number().optional().describe('The new version code.'),
  }),
  outputSchema,
  execute: async ({ context }) => {
    const { versionId, ...updates } = context;

    if (!config.cmsUrl) {
      const message = 'CMS URL is not configured.';
      logger.error({}, message);
      return { success: false as const, message };
    }

    try {
      const url = new URL(`${config.cmsUrl}/api/playersoftware/${versionId}`);
      const authHeaders = await getAuthHeaders();
      const headers = {
        ...authHeaders,
        'Content-Type': 'application/x-www-form-urlencoded',
      };

      const body = new URLSearchParams();
      if (updates.playerShowVersion)
        body.append('playerShowVersion', updates.playerShowVersion);
      if (updates.version) body.append('version', updates.version);
      if (updates.code) body.append('code', updates.code.toString());

      logger.debug(
        { url: url.toString(), body: body.toString() },
        `Attempting to edit player software version ${versionId}`
      );

      const response = await fetch(url.toString(), {
        method: 'PUT',
        headers,
        body,
      });

      const responseData = await response.json();

      if (!response.ok) {
        const message = `Failed to edit player software version. API responded with status ${response.status}.`;
        logger.error(
          { status: response.status, response: responseData },
          message
        );
        return { success: false as const, message, errorData: responseData };
      }

      const validationResult = playerVersionSchema.safeParse(responseData);
      if (!validationResult.success) {
        const message =
          'Edit player software version response validation failed.';
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
        { versionId },
        `Successfully edited player software version ID ${versionId}.`
      );
      return { success: true as const, data: validationResult.data };
    } catch (error) {
      const message = `An unexpected error occurred while editing player software version ${versionId}.`;
      const processedError = processError(error);
      logger.error({ error: processedError, versionId }, message);
      return { success: false as const, message, error: processedError };
    }
  },
});
