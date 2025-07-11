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
 * @module getMediaUsage
 * @description Provides a tool to retrieve the usage report for a specific
 * media item from the Xibo CMS library. It implements the
 * 'GET /library/usage/{mediaId}' endpoint.
 */
import { z } from "zod";
import { createTool } from '@mastra/core';
import { logger } from '../../../index';
import { getAuthHeaders } from '../auth';
import { config } from '../config';

/**
 * Zod schema for the tool's input.
 * Corresponds to the parameters for the GET /library/usage/{mediaId} endpoint.
 */
const getMediaUsageInputSchema = z.object({
    mediaId: z.number().describe("The ID of the media item to get the usage report for."),
});

/**
 * Defines the structure for a single usage entry, which could be a layout or a playlist.
 */
const usageEntrySchema = z.object({
    type: z.string().describe("The type of the item where the media is used (e.g., 'layout', 'playlist')."),
    id: z.number().describe("The ID of the item."),
    name: z.string().describe("The name of the item."),
});

/**
 * Zod schema for the successful output of the tool.
 * The API returns an array of objects detailing where the media is used.
 */
const getMediaUsageOutputSchema = z.object({
    success: z.boolean(),
    message: z.string().optional(),
    data: z.array(usageEntrySchema).optional(),
    error: z.any().optional(),
    errorData: z.any().optional(),
});


/**
 * @tool getMediaUsage
 * @description A tool for retrieving a media item's usage report.
 * This tool fetches the usage report, which shows where a specific media item is being used
 * across layouts, playlists, etc.
 */
export const getMediaUsage = createTool({
    id: 'get-media-usage',
    description: "Gets a media item's usage report.",
    inputSchema: getMediaUsageInputSchema,
    outputSchema: getMediaUsageOutputSchema,
    execute: async ({ context: input }) => {
        const { mediaId } = input;
        const { cmsUrl } = config;

        if (!cmsUrl) {
            logger.error({}, 'getMediaUsage: CMS URL is not configured.');
            return { success: false, message: 'CMS URL is not configured.' };
        }

        const url = `${cmsUrl}/api/library/usage/${mediaId}`;
        logger.debug(`getMediaUsage: Attempting to GET from URL: ${url}`);

        try {
            const authHeaders = await getAuthHeaders();
            const headers = { ...authHeaders };

            const response = await fetch(url, {
                method: 'GET',
                headers,
            });

            const responseData = await response.json();

            if (!response.ok) {
                logger.error(
                    { 
                        status: response.status,
                        statusText: response.statusText,
                        data: responseData 
                    },
                    'getMediaUsage: HTTP error occurred.'
                );
                return { success: false, message: `HTTP error! status: ${response.status}`, errorData: responseData };
            }

            // The API returns an empty object {} if the media is not used.
            // We should treat this as a success case with an empty array.
            const dataToParse = (responseData && typeof responseData === 'object' && !Array.isArray(responseData) && Object.keys(responseData).length === 0)
                ? []
                : responseData;

            const parsedData = z.array(usageEntrySchema).safeParse(dataToParse);
            
            if (!parsedData.success) {
                logger.error(
                    { 
                        error: parsedData.error.format(), 
                        rawData: responseData 
                    },
                    'getMediaUsage: Zod validation failed for the API response.'
                );
                return { 
                    success: false, 
                    message: 'Validation failed for the API response.', 
                    error: parsedData.error.format(),
                    errorData: responseData
                };
            }

            logger.info(`getMediaUsage: Successfully retrieved usage report for media ${mediaId}.`);
            return { success: true, data: parsedData.data };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
            logger.error(
                {
                    error: errorMessage,
                    details: error
                },
                'getMediaUsage: An unexpected error occurred during execution.'
            );
            return { success: false, message: errorMessage, errorData: error };
        }
    },
}); 