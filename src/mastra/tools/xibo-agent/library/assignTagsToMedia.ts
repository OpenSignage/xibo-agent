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
 * Assign Tags to Media Tool
 *
 * This module provides a tool to assign tags to a media item in
 * the Xibo CMS library. It implements the 'POST /library/{mediaId}/tag' endpoint.
 */
import { z } from "zod";
import { createTool } from '@mastra/core';
import { logger } from '../../../index';
import { getAuthHeaders } from '../auth';
import { config } from '../config';
import { librarySchema } from './schemas';

// Schema for the input, based on the POST /library/{mediaId}/tag endpoint
const inputSchema = z.object({
    mediaId: z.number().describe("The ID of the media item to tag."),
    tags: z.array(z.string()).describe("An array of tags to assign."),
});

// The API returns the updated media object on success.
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
 * Tool for Assigning Tags to a Media Item
 *
 * This tool assigns one or more tags to a specified media item.
 */
export const assignTagsToMedia = createTool({
    id: 'assign-tags-to-media',
    description: 'Assigns tags to a media item.',
    inputSchema,
    outputSchema,
    execute: async ({ context: input }): Promise<z.infer<typeof outputSchema>> => {
        const { mediaId, tags } = input;

        if (!config.cmsUrl) {
            return { success: false, message: 'CMS URL is not configured.' };
        }

        const method = 'POST';
        const params = new URLSearchParams();
        tags.forEach(tag => params.append('tag[]', tag));

        const url = `${config.cmsUrl}/api/library/${mediaId}/tag`;
        logger.debug(`assignTagsToMedia: ${method}ing to URL: ${url}`);

        try {
            const authHeaders = await getAuthHeaders();
            const headers = {
                ...authHeaders,
                'Content-Type': 'application/x-www-form-urlencoded',
            };

            const response = await fetch(url, {
                method,
                headers,
                body: params,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => response.statusText);
                logger.error('assignTagsToMedia: HTTP error', { status: response.status, error: errorData });
                return { success: false, message: `HTTP error! status: ${response.status}`, error: errorData };
            }

            const data = await response.json();
            const parsedData = librarySchema.safeParse(data);

            if (!parsedData.success) {
                logger.error('assignTagsToMedia: Zod validation failed', { error: parsedData.error.format(), rawData: data });
                return { success: false, message: 'Validation failed for the API response.', error: parsedData.error.format() };
            }

            return { success: true, data: parsedData.data };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
            logger.error('assignTagsToMedia: Unexpected error', { error: errorMessage, details: error });
            return { success: false, message: errorMessage, error };
        }
    },
}); 