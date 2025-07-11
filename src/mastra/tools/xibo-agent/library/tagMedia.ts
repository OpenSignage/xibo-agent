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
 * Tag Media Tool
 *
 * This module provides a tool to assign or unassign tags to a media item in
 * the Xibo CMS library. It implements the 'POST /library/{mediaId}/tag' and
 * 'DELETE /library/{mediaId}/tag' endpoints.
 */
import { z } from "zod";
import { createTool } from '@mastra/core';
import { logger } from '../../../index';
import { getAuthHeaders } from '../auth';
import { config } from '../config';
import { librarySchema } from './schemas';

// Schema for the input, based on the POST/DELETE /library/{mediaId}/tag endpoints
const inputSchema = z.object({
    mediaId: z.number().describe("The ID of the media item to tag or untag."),
    tags: z.array(z.string()).describe("An array of tags to assign."),
    action: z.enum(['assign', 'unassign']).default('assign').describe("Whether to 'assign' or 'unassign' the tags."),
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
 * Tool for Tagging a Media Item
 *
 * This tool assigns or unassigns one or more tags to a specified media item.
 */
export const tagMedia = createTool({
    id: 'tag-media',
    description: 'Assigns or unassigns tags to a media item.',
    inputSchema,
    outputSchema,
    execute: async ({ context: input }): Promise<z.infer<typeof outputSchema>> => {
        const { mediaId, tags, action } = input;

        if (!config.cmsUrl) {
            return { success: false, message: 'CMS URL is not configured.' };
        }

        const method = action === 'assign' ? 'POST' : 'DELETE';
        const params = new URLSearchParams();
        params.append('tags', tags.join(','));

        const url = `${config.cmsUrl}/api/library/${mediaId}/tag`;
        logger.debug(`tagMedia: ${method}ing to URL: ${url}`);

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
                logger.error('tagMedia: HTTP error', { status: response.status, error: errorData });
                return { success: false, message: `HTTP error! status: ${response.status}`, error: errorData };
            }

            const data = await response.json();
            const parsedData = librarySchema.safeParse(data);

            if (!parsedData.success) {
                logger.error('tagMedia: Zod validation failed', { error: parsedData.error.format(), rawData: data });
                return { success: false, message: 'Validation failed for the API response.', error: parsedData.error.format() };
            }

            return { success: true, data: parsedData.data };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
            logger.error('tagMedia: Unexpected error', { error: errorMessage, details: error });
            return { success: false, message: errorMessage, error };
        }
    },
}); 