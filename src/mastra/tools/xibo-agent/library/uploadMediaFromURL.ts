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
 * Upload Media from URL Tool
 * 
 * This module provides a tool to upload a media file to the Xibo CMS library
 * from a given URL. It implements the 'POST /library/uploadUrl' endpoint.
 */
import { z } from "zod";
import { createTool } from '@mastra/core';
import { logger } from '../../../logger';
import { getAuthHeaders } from '../auth';
import { config } from '../config';
import { librarySchema } from './schemas';

/**
 * @const
 * @description Zod schema for the input, based on the POST /library/uploadUrl endpoint parameters.
 */
const inputSchema = z.object({
    url: z.string().url().describe("The direct URL to the media file to upload."),
    type: z.string().describe("The type of the media, e.g., 'image', 'video'."),
    extension: z.string().optional().describe("Optional extension of the media, e.g., 'jpg', 'png'. If not set, it will be retrieved from headers."),
    enableStat: z.string().optional().describe("Option to enable Media Proof of Play statistics: 'On', 'Off', or 'Inherit'."),
    optionalName: z.string().optional().describe("An optional name for this media file; defaults to the file name if empty."),
    expires: z.string().optional().describe("Date in 'Y-m-d H:i:s' format to set the expiration date on the Media item."),
    folderId: z.number().optional().describe("The ID of the folder to upload the media into."),
});

/**
 * @const
 * @description Zod schema for the tool's output, handling both success and error cases.
 * On success, it returns the newly created Library object.
 */
const outputSchema = z.object({
    success: z.boolean(),
    message: z.string().optional(),
    data: librarySchema.optional(),
    error: z.any().optional(),
    errorData: z.any().optional(),
});

/**
 * @tool
 * @description Tool for Uploading Media from a URL.
 * 
 * This tool uploads a file from a specified URL to the Xibo Library. It can
 * be used to add new media items.
 */
export const uploadMediaFromURL = createTool({
    id: 'upload-media-from-url',
    description: 'Uploads a media file to the Library from a URL.',
    inputSchema,
    outputSchema,
    execute: async ({ context: input }) => {
        if (!config.cmsUrl) {
            logger.error({}, "uploadMediaFromURL: CMS URL is not configured.");
            return { success: false, message: 'CMS URL is not configured.' };
        }

        // Prepare form data from input, excluding undefined values.
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(input)) {
            if (value !== undefined) {
                params.append(key, String(value));
            }
        }

        const url = `${config.cmsUrl}/api/library/uploadUrl`;
        logger.debug(`uploadMediaFromURL: Attempting to POST to URL: ${url}`);

        try {
            const authHeaders = await getAuthHeaders();
            const headers = {
                ...authHeaders,
                'Content-Type': 'application/x-www-form-urlencoded',
            };

            // Make the API request to upload the media from the URL
            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: params,
            });

            // Handle non-successful HTTP responses
            if (!response.ok) {
                const errorData = await response.json().catch(() => response.statusText);
                logger.error({ status: response.status, error: errorData }, 'uploadMediaFromURL: HTTP error occurred.');
                return { success: false, message: `HTTP error! status: ${response.status}`, errorData: errorData };
            }

            const data = await response.json();
            
            // Validate the response data against the library schema
            const parsedData = librarySchema.safeParse(data);
            if (!parsedData.success) {
                logger.error(
                    { error: parsedData.error.format(), rawData: data },
                    'uploadMediaFromURL: Zod validation failed for API response.'
                );
                return { 
                    success: false, 
                    message: 'Validation failed for the API response.', 
                    error: parsedData.error.format(),
                    errorData: data
                };
            }

            logger.info(`uploadMediaFromURL: Successfully uploaded media from URL and created media item with ID ${parsedData.data.mediaId}.`);
            return { success: true, data: parsedData.data };
            
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
            logger.error({ error: errorMessage, details: error }, 'uploadMediaFromURL: An unexpected error occurred during execution.');
            return { success: false, message: errorMessage, errorData: error };
        }
    },
}); 