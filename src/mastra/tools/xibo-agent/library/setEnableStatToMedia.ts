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
 * @module setEnableStatToMedia
 * @description Provides a tool to enable or disable statistics collection for a
 * specific media item in the Xibo CMS library. It implements the
 * 'PUT /library/setenablestat/{mediaId}' endpoint.
 */
import { z } from "zod";
import { createTool } from '@mastra/core';
import { logger } from '../../../logger';
import { getAuthHeaders } from '../auth';
import { config } from '../config';

/**
 * Zod schema for the tool's input.
 * Corresponds to the parameters for the PUT /library/setenablestat/{mediaId} endpoint.
 */
const inputSchema = z.object({
    mediaId: z.number().describe("The ID of the media item."),
    enableStat: z.string().describe("Enable statistics collection. Use '1' to enable, '0' to disable."),
});

/**
 * Zod schema for the tool's output.
 * The API returns a 204 No Content on success, so this schema defines a
 * structured response for both success and failure cases.
 */
const outputSchema = z.object({
    success: z.boolean().describe("Indicates whether the operation was successful."),
    message: z.string().describe("A summary message of the operation result."),
    error: z.any().optional().describe("Detailed error information if the operation failed."),
    errorData: z.any().optional().describe("Raw error data from the API response."),
});

/**
 * @tool setEnableStatToMedia
 * @description A tool for enabling or disabling statistics collection for a media item.
 * This tool sets the 'Enable Stats Collection' option for a media item, which
 * controls the gathering of Proof of Play statistics.
 */
export const setEnableStatToMedia = createTool({
    id: 'set-media-enable-stat',
    description: 'Enables or disables statistics collection for a media item.',
    inputSchema,
    outputSchema,
    execute: async ({ context: input }) => {
        const { mediaId, enableStat } = input;

        if (!config.cmsUrl) {
            logger.error({}, 'setEnableStatToMedia: CMS URL is not configured.');
            return { success: false, message: 'CMS URL is not configured.' };
        }

        const url = `${config.cmsUrl}/api/library/setenablestat/${mediaId}`;
        const params = new URLSearchParams({ enableStat });
        
        logger.debug(`setEnableStatToMedia: Attempting to PUT to URL: ${url} with body: ${params.toString()}`);

        try {
            const authHeaders = await getAuthHeaders();
            const headers = {
                ...authHeaders,
                'Content-Type': 'application/x-www-form-urlencoded',
            };

            const response = await fetch(url, {
                method: 'PUT',
                headers,
                body: params,
            });

            // A 204 No Content response indicates a successful operation.
            if (response.status === 204) {
                const successMessage = `Successfully set enableStat to '${enableStat}' for media ${mediaId}.`;
                logger.info({}, successMessage);
                return { success: true, message: successMessage };
            }

            // Handle non-204 responses as errors.
            const errorData = await response.json().catch(() => response.statusText);
            logger.error(
                { 
                    status: response.status,
                    statusText: response.statusText,
                    data: errorData 
                },
                'setEnableStatToMedia: HTTP error occurred.'
            );
            return { success: false, message: `HTTP error! status: ${response.status}`, errorData: errorData };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
            logger.error(
                { 
                    error: errorMessage, 
                    details: error 
                },
                'setEnableStatToMedia: An unexpected error occurred during execution.'
            );
            return { success: false, message: errorMessage, errorData: error };
        }
    },
}); 