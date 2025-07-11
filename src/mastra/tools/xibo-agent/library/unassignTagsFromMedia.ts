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
 * Unassign Tags from Media Tool
 *
 * This module provides a tool to unassign tags from a media item in
 * the Xibo CMS library. It implements the 'POST /library/{mediaId}/untag' endpoint.
 */
import { z } from "zod";
import { createTool } from '@mastra/core';
import { logger } from '../../../index';
import { getAuthHeaders } from '../auth';
import { config } from '../config';
import { librarySchema } from './schemas';

// Schema for the input, based on the POST /library/{mediaId}/untag endpoint
const inputSchema = z.object({
    mediaId: z.number().describe("The ID of the media item to untag."),
    tags: z.array(z.string()).describe("An array of tags to unassign."),
});

// The API returns the updated media object on success.
const outputSchema = z.object({
    success: z.boolean(),
    message: z.string().optional(),
    data: librarySchema.optional(),
    error: z.any().optional(),
    errorData: z.any().optional(),
});

/**
 * Tool for Unassigning Tags from a Media Item
 *
 * This tool unassigns one or more tags from a specified media item.
 */
export const unassignTagsFromMedia = createTool({
    id: 'unassign-tags-from-media',
    description: 'Unassigns tags from a media item.',
    inputSchema,
    outputSchema,
    execute: async ({ context: input }) => {
        const { mediaId, tags } = input;

        if (!config.cmsUrl) {
            logger.error({}, 'unassignTagsFromMedia: CMS URL is not configured.');
            return { success: false, message: 'CMS URL is not configured.' };
        }

        const method = 'POST';
        const params = new URLSearchParams();
        tags.forEach(tag => params.append('tag[]', tag));

        const url = `${config.cmsUrl}/api/library/${mediaId}/untag`;
        logger.debug(`unassignTagsFromMedia: ${method}ing to URL: ${url}`);

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
                logger.error({ status: response.status, data: errorData }, 'unassignTagsFromMedia: HTTP error');
                return { success: false, message: `HTTP error! status: ${response.status}`, errorData: errorData };
            }

            const data = await response.json();
            const parsedData = librarySchema.safeParse(data);

            if (!parsedData.success) {
                logger.error(
                    { error: parsedData.error.format(), rawData: data },
                    'unassignTagsFromMedia: Zod validation failed'
                );
                return { 
                    success: false, 
                    message: 'Validation failed for the API response.', 
                    error: parsedData.error.format(),
                    errorData: data 
                };
            }

            return { success: true, data: parsedData.data };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
            logger.error({ error: errorMessage, details: error }, 'unassignTagsFromMedia: Unexpected error');
            return { success: false, message: errorMessage, errorData: error };
        }
    },
}); 