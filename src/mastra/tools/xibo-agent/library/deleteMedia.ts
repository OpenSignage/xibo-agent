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
 * Delete Media Tool
 *
 * This module provides a tool to delete a media item from the Xibo CMS library.
 * It implements the 'DELETE /library/{mediaId}' endpoint.
 */
import { z } from "zod";
import { createTool } from '@mastra/core';
import { logger } from '../../../index';
import { getAuthHeaders } from '../auth';
import { config } from '../config';

// Schema for the input, based on the DELETE /library/{mediaId} endpoint
const inputSchema = z.object({
    mediaId: z.number().describe("The ID of the media item to delete."),
    forceDelete: z.number().describe("If the media item has been used should it be force removed from items that uses it? (0 or 1)."),
    purge: z.number().optional().describe("Should this Media be added to the Purge List for all Displays? (0 or 1)."),
});

// Schema for the tool's output
const outputSchema = z.union([
    z.object({
        success: z.literal(true),
        message: z.string(),
    }),
    z.object({
        success: z.literal(false),
        message: z.string(),
        error: z.any().optional(),
    }),
]);

/**
 * Tool for Deleting a Media Item
 *
 * This tool deletes a specified media item from the Xibo Library.
 * It can optionally force the deletion if the item is currently in use.
 */
export const deleteMedia = createTool({
    id: 'delete-media',
    description: 'Deletes a media item from the Library.',
    inputSchema,
    outputSchema,
    execute: async ({ context: input }): Promise<z.infer<typeof outputSchema>> => {
        const { mediaId, forceDelete, purge } = input;

        if (!config.cmsUrl) {
            return { success: false, message: 'CMS URL is not configured.' };
        }

        const url = `${config.cmsUrl}/api/library/${mediaId}`;
        logger.debug(`deleteMedia: Deleting from URL: ${url}`);

        try {
            const authHeaders = await getAuthHeaders();
            
            // The API expects parameters as form data, even on a DELETE request.
            const body = new URLSearchParams();
            body.append('forceDelete', String(forceDelete));
            if (purge !== undefined) {
                body.append('purge', String(purge));
            }
            
            const headers: HeadersInit = { 
                ...authHeaders,
                'Content-Type': 'application/x-www-form-urlencoded',
            };

            const response = await fetch(url, {
                method: 'DELETE',
                headers,
                body,
            });

            // A successful deletion returns a 204 No Content response.
            if (response.status === 204) {
                return { success: true, message: `Media item ${mediaId} deleted successfully.` };
            }

            const errorData = await response.json().catch(() => response.statusText);
            logger.error('deleteMedia: HTTP error', { status: response.status, error: errorData });
            return { success: false, message: `HTTP error! status: ${response.status}`, error: errorData };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
            logger.error('deleteMedia: Unexpected error', { error: errorMessage, details: error });
            return { success: false, message: errorMessage, error };
        }
    },
}); 