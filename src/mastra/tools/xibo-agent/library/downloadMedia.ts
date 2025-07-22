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
 * @module Download Media Tool
 *
 * This module provides a tool to download a media file from the Xibo CMS
 * library and save it to a specified local path. It implements the
 * 'GET /library/download/{mediaId}' endpoint.
 */
import { z } from 'zod';
import { createTool } from '@mastra/core';
import { logger } from '../../../logger';
import { getAuthHeaders } from '../auth';
import { config } from '../config';
import fs from 'fs/promises';
import path from 'path';

// Schema for the tool's input
const inputSchema = z.object({
  mediaId: z.number().describe('The ID of the media item to download.'),
  destinationPath: z.string().optional().default('').describe('A relative path inside the main downloads directory (`persistent_data/downloads`) where the file should be saved. e.g., "banners/". Defaults to the root of the downloads directory.'),
  fileName: z.string().optional().describe('The desired file name for the downloaded media. If not provided, it will be extracted from the response headers.'),
});

// Schema for the tool's output
const outputSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  filePath: z.string().optional().describe('The full path to the downloaded file.'),
  error: z.any().optional(),
  errorData: z.any().optional(),
});

/**
 * @tool Tool for Downloading a Media File
 *
 * This tool downloads a specified media file from the CMS library and saves
 * it to the local filesystem.
 */
export const downloadMedia = createTool({
  id: 'download-media',
  description: 'Downloads a media file from the Library and saves it locally.',
  inputSchema,
  outputSchema,
  execute: async ({ context: input }) => {
    logger.info({ input }, 'Starting downloadMedia tool execution');
    const { mediaId, destinationPath: relativeDestPath, fileName } = input;

    if (!config.cmsUrl) {
      logger.error({}, 'downloadMedia: CMS URL is not configured.');
      return { success: false, message: 'CMS URL is not configured.' };
    }

    // Construct the full destination path and perform a security check to prevent path traversal.
    const destinationPath = path.join(config.downloadsDir, relativeDestPath);
    const resolvedPath = path.resolve(destinationPath);
    const resolvedDownloadsDir = path.resolve(config.downloadsDir);
    if (!resolvedPath.startsWith(resolvedDownloadsDir)) {
      logger.error({ destinationPath }, 'Path traversal attempt detected');
      return {
        success: false,
        message: 'Invalid destination path. Path traversal is not allowed.',
      };
    }

    const url = `${config.cmsUrl}/api/library/download/${mediaId}`;
    logger.debug(`downloadMedia: Fetching from URL: ${url}`);

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(url, { headers });

      if (!response.ok) {
        const errorData = await response.json().catch(() => response.statusText);
        logger.error(
          {
            status: response.status,
            data: errorData,
          },
          'downloadMedia: HTTP error'
        );
        return {
          success: false,
          message: `HTTP error! status: ${response.status}`,
          errorData: errorData,
        };
      }

      // Determine the filename. If not provided in the input, try to extract it
      // from the 'content-disposition' header of the response.
      let finalFileName = fileName;
      if (!finalFileName) {
        const contentDisposition = response.headers.get('content-disposition');
        if (contentDisposition) {
          const match = contentDisposition.match(/filename="?([^"]+)"?/);
          if (match && match[1]) {
            finalFileName = match[1];
            logger.debug(`Filename extracted from header: ${finalFileName}`);
          }
        }
      }

      // If a filename could not be determined, return an error.
      if (!finalFileName) {
        const message = 'File name could not be determined from response headers. Please specify a `fileName` in the input.';
        logger.error({}, message);
        return {
          success: false,
          message: message,
        };
      }

      // Ensure the destination directory exists before writing the file.
      await fs.mkdir(destinationPath, { recursive: true });
      const filePath = path.join(destinationPath, finalFileName);
      logger.debug(`Saving file to: ${filePath}`);

      // Get the response body as a buffer and write it to the file.
      const buffer = await response.arrayBuffer();
      await fs.writeFile(filePath, Buffer.from(buffer));

      logger.info({ filePath }, `File downloaded successfully`);
      return { success: true, filePath, message: `File downloaded successfully to ${filePath}` };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'An unexpected error occurred.';
      logger.error(
        {
          error: errorMessage,
          details: error,
        },
        'downloadMedia: Unexpected error'
      );
      return { success: false, message: errorMessage, errorData: error };
    }
  },
}); 