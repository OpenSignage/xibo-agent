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
 * @module Download Thumbnail Tool
 *
 * This module provides a tool to download a media item's thumbnail from the
 * Xibo CMS library and save it to a local path. It implements the
 * 'GET /library/thumbnail/{mediaId}' endpoint.
 */
import { z } from "zod";
import { createTool } from '@mastra/core';
import { logger } from '../../../logger';
import { getAuthHeaders } from '../auth';
import { config } from '../config';
import fs from 'fs/promises';
import path from 'path';

// Schema for the input
const inputSchema = z.object({
    mediaId: z.number().describe("The ID of the media item to get the thumbnail for."),
    destinationPath: z.string().optional().default('').describe('A relative path inside the main downloads directory (`persistent_data/downloads`) where the thumbnail should be saved. Defaults to the root of the downloads directory.'),
    fileName: z.string().optional().describe('The desired file name for the thumbnail. If not provided, it will be extracted from the response headers.'),
});

// Schema for the tool's output
const outputSchema = z.object({
    success: z.boolean(),
    message: z.string().optional(),
    filePath: z.string().optional().describe('The full path to the downloaded thumbnail file.'),
    error: z.any().optional(),
    errorData: z.any().optional(),
});

/**
 * @tool Tool for Downloading a Media Thumbnail
 *
 * This tool downloads a specified media item's thumbnail and saves it
 * to the local filesystem.
 */
export const downloadThumbnail = createTool({
    id: 'download-thumbnail',
    description: "Downloads a media item's thumbnail from the Library and saves it locally.",
    inputSchema,
    outputSchema,
    execute: async ({ context: input }) => {
        logger.info({ input }, 'Starting downloadThumbnail tool execution');
        const { mediaId, destinationPath: relativeDestPath, fileName } = input;

        if (!config.cmsUrl) {
            logger.error({}, 'downloadThumbnail: CMS URL is not configured.');
            return { success: false, message: 'CMS URL is not configured.' };
        }

        // Construct the full destination path and perform a security check.
        const destinationPath = path.join(config.downloadsDir, relativeDestPath);
        const resolvedPath = path.resolve(destinationPath);
        const resolvedDownloadsDir = path.resolve(config.downloadsDir);
        if (!resolvedPath.startsWith(resolvedDownloadsDir)) {
            logger.error({ destinationPath }, 'downloadThumbnail: Path traversal attempt detected');
            return {
                success: false,
                message: 'Invalid destination path. Path traversal is not allowed.',
            };
        }

        const url = `${config.cmsUrl}/api/library/thumbnail/${mediaId}`;
        logger.debug(`downloadThumbnail: Fetching from URL: ${url}`);

        try {
            const headers = await getAuthHeaders();
            const response = await fetch(url, { headers });

            if (!response.ok) {
                const errorData = await response.json().catch(() => response.statusText);
                logger.error({ status: response.status, data: errorData }, 'downloadThumbnail: HTTP error');
                return { success: false, message: `HTTP error! status: ${response.status}`, errorData: errorData };
            }

            // Determine the filename from input or response headers.
            let finalFileName = fileName;
            if (!finalFileName) {
                const contentDisposition = response.headers.get('content-disposition');
                if (contentDisposition) {
                    const match = contentDisposition.match(/filename="?([^"]+)"?/);
                    if (match && match[1]) {
                        finalFileName = match[1];
                        logger.debug(`Filename for thumbnail extracted from header: ${finalFileName}`);
                    }
                }
            }

            // If a filename could still not be determined, generate one automatically
            // as a fallback. This ensures the file can always be saved.
            if (!finalFileName) {
                finalFileName = `thumbnail-${mediaId}.png`;
                logger.info(`Could not determine filename. Using generated filename: ${finalFileName}`);
            }

            // Ensure the destination directory exists and save the file.
            await fs.mkdir(destinationPath, { recursive: true });
            const filePath = path.join(destinationPath, finalFileName);
            logger.debug(`Saving thumbnail to: ${filePath}`);

            const buffer = await response.arrayBuffer();
            await fs.writeFile(filePath, Buffer.from(buffer));

            logger.info({ filePath }, 'Thumbnail downloaded successfully');
            return { success: true, filePath, message: `Thumbnail downloaded successfully to ${filePath}` };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
            logger.error({ error: errorMessage, details: error }, 'downloadThumbnail: Unexpected error');
            return { success: false, message: errorMessage, errorData: error };
        }
    },
}); 