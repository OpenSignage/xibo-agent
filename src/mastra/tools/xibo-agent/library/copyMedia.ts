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
 * Copy Media
 * 
 * This module provides a tool to copy a media item in the Xibo CMS.
 * It corresponds to the `POST /library/copy/{mediaId}` endpoint.
 */

import { createTool } from '@mastra/core';
import { z } from 'zod';
import { logger } from '../../../logger';   
import { getAuthHeaders } from '../auth';
import { config } from '../config';
import { librarySchema } from './schemas';

/**
 * Zod schema for the input of the copyMedia tool.
 */
const copyMediaInputSchema = z.object({
    mediaId: z.number().describe('The ID of the media to copy.'),
    name: z.string().describe('The new name for the copied media.'),
    tags: z.number().optional().describe('Flag to delete the old media item (0 or 1).'),
});

/**
 * Zod schema for the output of the copyMedia tool.
 * It expects a Library object as the result.
 */
const copyMediaOutputSchema = z.object({
    success: z.boolean(),
    message: z.string().optional(),
    data: librarySchema.optional(),
    error: z.any().optional(),
    errorData: z.any().optional(),
});

/**
 * Tool to copy a media item in the Xibo CMS.
 */
export const copyMedia = createTool({
    id: 'copy-media',
    description: 'Copies a media item in the Xibo CMS.',
    inputSchema: copyMediaInputSchema,
    outputSchema: copyMediaOutputSchema,
    
    execute: async ({ context: input }) => {
        const { mediaId, name, tags } = input;
        const { cmsUrl } = config;

        if (!cmsUrl) {
            logger.error({}, 'copyMedia: CMS URL is not configured.');
            return { success: false, message: 'CMS URL is not configured.' };
        }

        const url = `${cmsUrl}/api/library/copy/${mediaId}`;
        const formData = new URLSearchParams();
        formData.append('name', name);
        if (tags !== undefined) {
            formData.append('tags', tags.toString());
        }

        try {
            const authHeaders = await getAuthHeaders();
            const headers = { 
                ...authHeaders,
                'Content-Type': 'application/x-www-form-urlencoded',
            };

            logger.info(`copyMedia: Attempting to copy media ${mediaId} to '${name}'.`);

            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: formData,
            });

            const responseData = await response.json();

            if (!response.ok) {
                logger.error(
                    { 
                        status: response.status,
                        statusText: response.statusText,
                        data: responseData 
                    },
                    'copyMedia: HTTP error occurred.'
                );
                return { 
                    success: false, 
                    message: `HTTP error! status: ${response.status}`, 
                    errorData: responseData 
                };
            }

            const parsedData = librarySchema.safeParse(responseData);

            if (!parsedData.success) {
                logger.error(
                    { 
                        error: parsedData.error.format(), 
                        rawData: responseData 
                    },
                    'copyMedia: Zod validation failed for the API response.'
                );
                return { 
                    success: false, 
                    message: 'Validation failed for the API response.', 
                    error: parsedData.error.format(),
                    errorData: responseData
                };
            }
            
            logger.info(`copyMedia: Successfully copied media ${mediaId} to new media with ID ${parsedData.data.mediaId}.`);
            return { success: true, data: parsedData.data };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
            logger.error(
                {
                    error: errorMessage,
                    details: error
                },
                'copyMedia: An unexpected error occurred during execution.'
            );
            return { success: false, message: errorMessage, errorData: error };
        }
    },
}); 