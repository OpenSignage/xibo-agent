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
 * @module isMediaUsed
 * @description Provides a tool to check if a specific media item is currently
 * in use within the Xibo CMS. It implements the 'GET /library/{mediaId}/isused/'
 * endpoint.
 */
import { z } from "zod";
import { createTool } from '@mastra/core';
import { logger } from '../../../index';
import { getAuthHeaders } from '../auth';
import { config } from '../config';

/**
 * Zod schema for the tool's input, requiring the mediaId.
 */
const isMediaUsedInputSchema = z.object({
    mediaId: z.number().describe("The ID of the media item to check."),
});

/**
 * Zod schema for the tool's output, indicating usage status.
 */
const isMediaUsedOutputSchema = z.object({
    success: z.boolean().describe("Indicates whether the operation was successful."),
    isUsed: z.boolean().optional().describe("True if the media is used, false otherwise."),
    message: z.string().optional().describe("A summary message of the operation result."),
    error: z.any().optional().describe("Detailed error information if the operation failed."),
    errorData: z.any().optional().describe("Raw error data from the API response."),
});

/**
 * @tool isMediaUsed
 * @description A tool to check if a media item is currently in use.
 * The API returns a 200 OK if the media is used. It's expected to return a 404
 * or another non-200 status if not used or not found, but we will treat
 * any non-200 as 'not used' for simplicity unless it's a server error.
 */
export const isMediaUsed = createTool({
    id: 'is-media-used',
    description: "Checks if a specific media item is currently in use.",
    inputSchema: isMediaUsedInputSchema,
    outputSchema: isMediaUsedOutputSchema,

    execute: async ({ context: input }) => {
        const { mediaId } = input;
        const { cmsUrl } = config;

        if (!cmsUrl) {
            logger.error('isMediaUsed: CMS URL is not configured.');
            return { success: false, message: 'CMS URL is not configured.' };
        }

        const url = `${cmsUrl}/api/library/${mediaId}/isused`;
        logger.debug(`isMediaUsed: Attempting to GET from URL: ${url}`);

        try {
            const authHeaders = await getAuthHeaders();
            const headers = { ...authHeaders };

            const response = await fetch(url, {
                method: 'GET',
                headers,
            });

            // The API documentation suggests 200 OK for "used".
            if (response.status === 200) {
                 logger.info(`isMediaUsed: Media ${mediaId} is in use.`);
                 return { success: true, isUsed: true, message: `Media ${mediaId} is in use.` };
            }

            // We interpret 404 as "not used" and consider it a successful check.
            if (response.status === 404) {
                 logger.info(`isMediaUsed: Media ${mediaId} is not in use or not found.`);
                 return { success: true, isUsed: false, message: `Media ${mediaId} is not in use or not found.` };
            }

            // For other non-200 responses, we log it as an error but return a structured response.
            const errorData = await response.json().catch(() => response.text());
            logger.error('isMediaUsed: An unexpected HTTP status was received.', { 
                status: response.status,
                statusText: response.statusText,
                data: errorData 
            });
            return { 
                success: false,
                isUsed: false,
                message: `An unexpected HTTP status was received: ${response.status}`,
                errorData,
            };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
            logger.error('isMediaUsed: An unexpected error occurred during execution.', {
                error: errorMessage,
                details: error
            });
            return { success: false, message: errorMessage, isUsed: false, errorData: error };
        }
    },
}); 