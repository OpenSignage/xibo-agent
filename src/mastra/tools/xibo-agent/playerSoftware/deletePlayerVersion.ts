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
 * @module deletePlayerVersion
 * @description Provides a tool to delete a player software version from the Xibo CMS.
 * It implements the DELETE /playersoftware/{versionId} API endpoint.
 */
import { z } from 'zod';
import { createTool } from '@mastra/core';
import { getAuthHeaders } from '../auth';
import { config } from '../config';
import { logger } from '../../../logger';
import { processError } from '../utility/error';

/**
 * Schema for the successful response, which is a simple confirmation message.
 * The API returns a 204 No Content on success, so we don't expect a data body.
 */
const deletePlayerVersionSuccessSchema = z.object({
  success: z.literal(true),
  message: z.string(),
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
  deletePlayerVersionSuccessSchema,
  errorResponseSchema,
]);

/**
 * Tool to delete a player software version from the Xibo CMS.
 */
export const deletePlayerVersion = createTool({
  id: 'delete-player-version',
  description: 'Deletes a player software version from the Xibo CMS by its ID.',
  inputSchema: z.object({
    versionId: z
      .number()
      .describe('The ID of the player software version to delete.'),
  }),
  outputSchema,
  execute: async ({ context }) => {
    const { versionId } = context;

    if (!config.cmsUrl) {
      const message = 'CMS URL is not configured.';
      logger.error({}, message);
      return { success: false as const, message };
    }

    try {
      const url = new URL(`${config.cmsUrl}/api/playersoftware/${versionId}`);
      logger.debug(
        { url: url.toString() },
        `Attempting to delete player software version ${versionId}`
      );

      const response = await fetch(url.toString(), {
        method: 'DELETE',
        headers: await getAuthHeaders(),
      });

      if (response.status === 204) {
        const message = `Player software version ${versionId} deleted successfully.`;
        logger.info({ versionId }, message);
        return { success: true as const, message };
      }

      const responseData = await response.json().catch(() => null);

      const message = `Failed to delete player software version. API responded with status ${response.status}.`;
      logger.error(
        { status: response.status, response: responseData },
        message
      );
      return { success: false as const, message, errorData: responseData };
    } catch (error) {
      const message = `An unexpected error occurred while deleting player software version ${versionId}.`;
      const processedError = processError(error);
      logger.error({ error: processedError, versionId }, message);
      return { success: false as const, message, error: processedError };
    }
  },
});
