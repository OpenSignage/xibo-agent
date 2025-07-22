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
 * @module downloadPlayerVersion
 * @description Provides a tool to download a player software file from the Xibo CMS.
 * It implements the GET /playersoftware/{versionId} endpoint.
 */
import { z } from 'zod';
import { createTool } from '@mastra/core';
import fs from 'fs/promises';
import path from 'path';
import { getAuthHeaders } from '../auth';
import { config } from '../config';
import { logger } from '../../../logger';
import { processError } from '../utility/error';

/**
 * Schema for the successful response, which includes the path to the downloaded file.
 */
const downloadPlayerVersionSuccessSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  filePath: z.string(),
});

/**
 * Schema for a standardized error response.
 */
const errorResponseSchema = z.object({
  success: z.literal(false),
  message: z.string().describe('A simple, readable error message.'),
  error: z.any().optional().describe('Detailed error information, e.g., from Zod.'),
  errorData: z.any().optional().describe('Raw response data from the CMS.'),
});

/**
 * Union schema for tool output, covering both success and error cases.
 */
const outputSchema = z.union([
  downloadPlayerVersionSuccessSchema,
  errorResponseSchema,
]);

/**
 * Tool to download a player software file from the Xibo CMS.
 */
export const downloadPlayerVersion = createTool({
  id: 'download-player-version',
  description: 'Downloads a specific player software version file.',
  inputSchema: z.object({
    versionId: z.number().describe('The ID of the player software version to download.'),
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
      const url = new URL(`${config.cmsUrl}/api/playersoftware/download/${versionId}`);
      logger.debug(
        { url: url.toString() },
        `Attempting to download player software version ${versionId}`
      );

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: await getAuthHeaders(),
      });

      if (!response.ok) {
        const responseData = await response.json().catch(() => null);
        const message = `Failed to download player software. API responded with status ${response.status}.`;
        logger.error(
          { status: response.status, response: responseData },
          message
        );
        return { success: false as const, message, errorData: responseData };
      }

      const contentDisposition = response.headers.get('content-disposition');
      let fileName = `player-version-${versionId}.zip`; // Default filename
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="([^"]+)"/);
        if (match && match[1]) {
          fileName = match[1];
        }
      }

      const destinationPath = config.downloadsDir;
      await fs.mkdir(destinationPath, { recursive: true });
      const filePath = path.join(destinationPath, fileName);
      
      const fileStream = await response.arrayBuffer();
      await fs.writeFile(filePath, Buffer.from(fileStream));

      const message = `File downloaded successfully to ${filePath}.`;
      logger.info({ filePath }, message);

      return { success: true as const, message, filePath };

    } catch (error) {
      const message = `An unexpected error occurred while downloading player software version ${versionId}.`;
      const processedError = processError(error);
      logger.error({ error: processedError, versionId }, message);
      return { success: false as const, message, error: processedError };
    }
  },
});
