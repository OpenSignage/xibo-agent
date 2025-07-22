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
 * @module editMedia
 * @description This module provides a tool to edit an existing media item in the Xibo CMS library.
 * It implements the 'PUT /library/{mediaId}' endpoint.
 */
import { z } from "zod";
import { createTool } from '@mastra/core';
import { logger } from '../../../logger';  
import { getAuthHeaders } from '../auth';
import { config } from '../config';
import { librarySchema } from './schemas';

// Schema for the input, based on the PUT /library/{mediaId} endpoint parameters
const inputSchema = z.object({
    mediaId: z.number().describe("The ID of the media item to edit."),
    name: z.string().describe("Media Item Name."),
    duration: z.number().describe("The duration in seconds for this Media Item."),
    retired: z.number().describe("Flag indicating if this media is retired (0 or 1)."),
    tags: z.string().optional().describe("Comma separated list of Tags."),
    updateInLayouts: z.number().optional().describe("Flag indicating whether to update the duration in all Layouts the Media is assigned to (0 or 1)."),
    expires: z.string().optional().describe("Date in Y-m-d H:i:s format, will set expiration date on the Media item."),
    folderId: z.number().optional().describe("The ID of the folder to move this media item to."),
});

// Schema for the tool's output, allowing for detailed error reporting
const outputSchema = z.object({
    success: z.boolean(),
    message: z.string().optional(),
    data: librarySchema.optional(),
    error: z.any().optional(),
    errorData: z.any().optional(),
});

/**
 * Tool for Editing a Media Item
 *
 * This tool edits the properties of a specified media item in the Xibo Library.
 */
export const editMedia = createTool({
    id: 'edit-media',
    description: 'Edits a media item in the Library.',
    inputSchema,
    outputSchema,
    execute: async ({ context: input }) => {
        const { mediaId, ...bodyParams } = input;
        logger.debug(`editMedia: Initiating edit for mediaId: ${mediaId}`);

        if (!config.cmsUrl) {
            logger.error({}, 'editMedia: CMS URL is not configured.');
            return { success: false, message: 'CMS URL is not configured.' };
        }

        try {
            // Prepare the URL-encoded form data
            const params = new URLSearchParams();
            for (const [key, value] of Object.entries(bodyParams)) {
                if (value !== undefined) {
                    params.append(key, String(value));
                }
            }

            const url = `${config.cmsUrl}/api/library/${mediaId}`;
            logger.debug({
                message: `editMedia: Sending PUT request to URL: ${url}`,
                body: params.toString()
            });

            // Get authentication headers
            const authHeaders = await getAuthHeaders();
            const headers = {
                ...authHeaders,
                'Content-Type': 'application/x-www-form-urlencoded',
            };

            // Send the request using the native fetch API
            const response = await fetch(url, {
                method: 'PUT',
                headers,
                body: params,
            });

            // Check if the request was successful
            if (!response.ok) {
                const errorData = await response.json().catch(() => response.statusText);
                logger.error({ status: response.status, data: errorData }, 'editMedia: HTTP error');
                return { success: false, message: `HTTP error! status: ${response.status}`, errorData: errorData };
            }

            // Parse and validate the response data
            const data = await response.json();
            const parsedData = librarySchema.safeParse(data);

            if (!parsedData.success) {
                logger.error(
                    { error: parsedData.error.format(), rawData: data },
                    'editMedia: Zod validation failed'
                );
                return { 
                    success: false, 
                    message: 'Validation failed for the API response.', 
                    error: parsedData.error.format(),
                    errorData: data
                };
            }

            // Return the successful response
            logger.info({ mediaId: parsedData.data.mediaId }, 'editMedia: Successfully edited media.');
            return { success: true, data: parsedData.data };
            
        } catch (error) {
            // Handle unexpected errors (e.g., network issues)
            const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
            logger.error({ error: errorMessage, details: error }, 'editMedia: Unexpected error');
            return { success: false, message: errorMessage, errorData: error };
        }
    },
}); 