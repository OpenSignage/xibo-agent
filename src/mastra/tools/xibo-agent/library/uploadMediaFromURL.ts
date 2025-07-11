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
 * Upload Media from URL Tool
 *
 * This module provides a tool to upload a media file to the Xibo CMS library
 * from a given URL. It implements the 'POST /library/url' endpoint.
 */
import { z } from "zod";
import { createTool } from '@mastra/core';
import { logger } from '../../../index';
import { getAuthHeaders } from '../auth';
import { config } from '../config';
import { librarySchema } from './schemas';

// Schema for the input, based on the POST /library/url endpoint parameters
const inputSchema = z.object({
    url: z.string().url().describe("The direct URL to the media file to upload."),
    name: z.string().optional().describe("An optional name for the new media item."),
    oldMediaId: z.number().optional().describe("The ID of an existing media item to replace."),
    updateInLayouts: z.number().optional().describe("A flag (0 or 1) to indicate that Layouts should be updated with this new version of the media."),
    deleteOldRevisions: z.number().optional().describe("A flag (0 or 1) to delete old revisions of the media item being replaced."),
    folderId: z.number().optional().describe("The ID of the folder to upload the media into."),
});

// Schema for the tool's output, handling both success and error cases
const outputSchema = z.union([
    z.object({
        success: z.literal(true),
        data: librarySchema,
    }),
    z.object({
        success: z.literal(false),
        message: z.string(),
        error: z.any().optional(),
    }),
]);

/**
 * Tool for Uploading Media from a URL
 *
 * This tool uploads a file from a specified URL to the Xibo Library. It can
 * be used to add new media or replace existing media items.
 */
export const uploadMediaFromURL = createTool({
    id: 'upload-media-from-url',
    description: 'Uploads a media file to the Library from a URL.',
    inputSchema,
    outputSchema,
    execute: async ({ context: input }): Promise<z.infer<typeof outputSchema>> => {
        if (!config.cmsUrl) {
            return { success: false, message: 'CMS URL is not configured.' };
        }

        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(input)) {
            if (value !== undefined) {
                params.append(key, String(value));
            }
        }

        const url = `${config.cmsUrl}/api/library/url`;
        logger.debug(`uploadMediaFromURL: Posting to URL: ${url}`);

        try {
            const authHeaders = await getAuthHeaders();
            const headers = {
                ...authHeaders,
                'Content-Type': 'application/x-www-form-urlencoded',
            };

            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: params,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => response.statusText);
                logger.error('uploadMediaFromURL: HTTP error', { status: response.status, error: errorData });
                return { success: false, message: `HTTP error! status: ${response.status}`, error: errorData };
            }

            const data = await response.json();
            const parsedData = librarySchema.safeParse(data);

            if (!parsedData.success) {
                logger.error('uploadMediaFromURL: Zod validation failed', { error: parsedData.error.format(), rawData: data });
                return { success: false, message: 'Validation failed for the API response.', error: parsedData.error.format() };
            }

            return { success: true, data: parsedData.data };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
            logger.error('uploadMediaFromURL: Unexpected error', { error: errorMessage, details: error });
            return { success: false, message: errorMessage, error };
        }
    },
}); 