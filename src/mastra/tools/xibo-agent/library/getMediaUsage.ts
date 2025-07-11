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
 * Get Media Usage Report Tool
 *
 * This module provides a tool to retrieve the usage report for a specific
 * media item from the Xibo CMS library. It implements the
 * 'GET /library/usage/{mediaId}' endpoint.
 */
import { z } from "zod";
import { createTool } from '@mastra/core';
import { logger } from '../../../index';
import { getAuthHeaders } from '../auth';
import { config } from '../config';

// Schema for the input, based on the GET /library/usage/{mediaId} endpoint
const inputSchema = z.object({
    mediaId: z.number().describe("The ID of the media item to get the usage report for."),
});

// The API documentation does not specify a schema for the response.
const outputSchema = z.union([
    z.object({
        success: z.literal(true),
        data: z.any().describe("The usage report data."),
    }),
    z.object({
        success: z.literal(false),
        message: z.string(),
        error: z.any().optional(),
    }),
]);

/**
 * Tool for Retrieving a Media Item's Usage Report
 *
 * Fetches the usage report, showing where a specific media item is being used.
 */
export const getMediaUsage = createTool({
    id: 'get-media-usage',
    description: "Gets a media item's usage report.",
    inputSchema,
    outputSchema,
    execute: async ({ context: input }): Promise<z.infer<typeof outputSchema>> => {
        const { mediaId } = input;

        if (!config.cmsUrl) {
            return { success: false, message: 'CMS URL is not configured.' };
        }

        const url = `${config.cmsUrl}/api/library/usage/${mediaId}`;
        logger.debug(`getMediaUsage: GETting from URL: ${url}`);

        try {
            const authHeaders = await getAuthHeaders();
            const headers = { ...authHeaders };

            const response = await fetch(url, {
                method: 'GET',
                headers,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => response.statusText);
                logger.error('getMediaUsage: HTTP error', { status: response.status, error: errorData });
                return { success: false, message: `HTTP error! status: ${response.status}`, error: errorData };
            }

            const data = await response.json();
            return { success: true, data };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
            logger.error('getMediaUsage: Unexpected error', { error: errorMessage, details: error });
            return { success: false, message: errorMessage, error };
        }
    },
}); 