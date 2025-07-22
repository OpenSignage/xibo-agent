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
 * Select Media Folder
 * 
 * This module provides a tool to move a media item to a different folder in the Xibo CMS.
 * It corresponds to the `POST /library/folder/{id}` endpoint.
 */

import { createTool } from '@mastra/core';
import { z } from 'zod';
import { logger } from '../../../logger';
import { getAuthHeaders } from '../auth';
import { config } from '../config';
import { librarySchema } from './schemas';

/**
 * Zod schema for the input of the selectMediaFolder tool.
 */
const selectMediaFolderInputSchema = z.object({
    mediaId: z.number().describe('The ID of the media to move.'),
    folderId: z.number().describe('The ID of the destination folder.'),
});

/**
 * Zod schema for the output of the selectMediaFolder tool.
 * It expects a Library object as the result.
 */
const selectMediaFolderOutputSchema = z.object({
    success: z.boolean(),
    message: z.string().optional(),
    data: librarySchema.optional(),
    error: z.any().optional(),
});

/**
 * Tool to move a media item to a different folder in the Xibo CMS.
 */
export const selectMediaFolder = createTool({
    id: 'select-media-folder',
    description: 'Moves a media item to a different folder in the Xibo CMS.',
    inputSchema: selectMediaFolderInputSchema,
    outputSchema: selectMediaFolderOutputSchema,
    
    execute: async ({ context: input }) => {
        const { mediaId, folderId } = input;
        const { cmsUrl } = config;

        if (!cmsUrl) {
            logger.error('selectMediaFolder: CMS URL is not configured.');
            return { success: false, message: 'CMS URL is not configured.' };
        }
        
        const url = `${cmsUrl}/api/library/${mediaId}/selectfolder`;
        const formData = new URLSearchParams();
        formData.append('folderId', folderId.toString());

        try {
            const authHeaders = await getAuthHeaders();
            const headers = { 
                ...authHeaders,
                'Content-Type': 'application/x-www-form-urlencoded',
            };

            logger.info(`selectMediaFolder: Attempting to move media ${mediaId} to folder ${folderId}.`);

            const response = await fetch(url, {
                method: 'PUT',
                headers,
                body: formData,
            });

            // A successful move returns a 204 No Content response, with no body
            if (response.status !== 204) {
                const errorData = await response.json().catch(() => response.statusText);
                logger.error(
                    { 
                        status: response.status,
                        statusText: response.statusText,
                        error: errorData 
                    },
                    'selectMediaFolder: HTTP error occurred.'
                );
                return { 
                    success: false, 
                    message: `HTTP error! status: ${response.status}`, 
                    error: errorData 
                };
            }
            
            logger.info(`selectMediaFolder: Successfully moved media ${mediaId} to folder ${folderId}.`);
            return { success: true, message: `Successfully moved media ${mediaId} to folder ${folderId}.` };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
            logger.error(
                {
                    error: errorMessage,
                    details: error
                },
                'selectMediaFolder: An unexpected error occurred during execution.'
            );
            return { success: false, message: errorMessage, error };
        }
    },
}); 