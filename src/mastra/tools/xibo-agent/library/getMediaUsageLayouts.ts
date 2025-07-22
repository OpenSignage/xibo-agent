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
 * @module getMediaUsageLayouts
 * @description Provides a tool to retrieve the usage report for a specific
 * media item within layouts from the Xibo CMS library. It implements the
 * 'GET /library/usage/layouts/{mediaId}' endpoint.
 */
import { z } from "zod";
import { createTool } from '@mastra/core';
import { logger } from '../../../logger';
import { getAuthHeaders } from '../auth';
import { config } from '../config';

/**
 * Zod schema for a single layout object returned by the usage report.
 */
const layoutUsageSchema = z.object({
    layoutId: z.number().describe("The layout ID."),
    ownerId: z.number().describe("The ID of the owner user."),
    campaignId: z.number().describe("The campaign ID."),
    parentId: z.number().describe("The ID of the parent layout."),
    publishedStatusId: z.number().describe("The ID of the published status."),
    publishedStatus: z.string().describe("The published status (e.g., 'Draft')."),
    publishedDate: z.string().nullable().describe("The date the layout was published."),
    backgroundImageId: z.number().nullable().describe("The ID of the background image."),
    schemaVersion: z.number().describe("The schema version of the layout."),
    layout: z.string().describe("The name of the layout."),
    description: z.string().nullable().describe("The description of the layout."),
    backgroundColor: z.string().describe("The background color hex code."),
    createdDt: z.string().describe("The creation date."),
    modifiedDt: z.string().describe("The last modification date."),
    status: z.number().describe("The status of the layout."),
    retired: z.number().describe("Flag indicating if the layout is retired (0 or 1)."),
    backgroundzIndex: z.number().describe("The z-index of the background."),
    width: z.number().describe("The width of the layout."),
    height: z.number().describe("The height of the layout."),
    orientation: z.string().describe("The orientation of the layout (e.g., 'landscape')."),
    displayOrder: z.number().nullable().describe("The display order."),
    duration: z.number().describe("The duration of the layout in seconds."),
    statusMessage: z.string().nullable().describe("A status message for the layout."),
    enableStat: z.number().nullable().describe("Flag for enabling statistics."),
    autoApplyTransitions: z.number().describe("Flag for auto-applying transitions."),
    code: z.string().nullable().describe("Associated code for the layout."),
    isLocked: z.any().nullable().describe("Flag indicating if the layout is locked."),
    regions: z.array(z.any()).describe("An array of regions in the layout."),
    tags: z.array(z.any()).describe("An array of tags associated with the layout."),
    drawers: z.array(z.any()).describe("An array of drawers in the layout."),
    actions: z.array(z.any()).describe("An array of actions for the layout."),
    permissions: z.array(z.any()).describe("An array of permissions for the layout."),
    campaigns: z.array(z.any()).describe("An array of campaigns the layout is part of."),
    owner: z.string().describe("The username of the owner."),
    groupsWithPermissions: z.any().nullable().describe("Groups with permissions on the layout."),
    folderId: z.number().describe("The folder ID containing the layout."),
    permissionsFolderId: z.number().describe("The permissions folder ID."),
});

/**
 * Zod schema for the tool's input.
 * Corresponds to the parameters for the GET /library/usage/layouts/{mediaId} endpoint.
 */
const inputSchema = z.object({
    mediaId: z.number().describe("The ID of the media item to get the layout usage report for."),
});

/**
 * Zod schema for the tool's output.
 * It defines a structured response for both success and failure cases.
 */
const outputSchema = z.object({
    success: z.boolean().describe("Indicates whether the operation was successful."),
    message: z.string().optional().describe("A summary message of the operation result."),
    data: z.array(layoutUsageSchema).optional().describe("An array of layouts where the media is used."),
    error: z.any().optional().describe("Detailed error information if the operation failed."),
    errorData: z.any().optional().describe("Raw error data from the API response."),
});

/**
 * @tool getMediaUsageLayouts
 * @description A tool for retrieving a media item's usage report specifically for layouts.
 * This tool fetches the usage report, showing which layouts a specific media item is being used in.
 */
export const getMediaUsageLayouts = createTool({
    id: 'get-media-usage-layouts',
    description: "Gets a media item's usage report for layouts.",
    inputSchema,
    outputSchema,
    execute: async ({ context: input }) => {
        const { mediaId } = input;

        if (!config.cmsUrl) {
            logger.error({}, 'getMediaUsageLayouts: CMS URL is not configured.');
            return { success: false, message: 'CMS URL is not configured.' };
        }

        const url = `${config.cmsUrl}/api/library/usage/layouts/${mediaId}`;
        logger.debug(`getMediaUsageLayouts: Attempting to GET from URL: ${url}`);

        try {
            const authHeaders = await getAuthHeaders();
            const headers = { ...authHeaders };

            const response = await fetch(url, {
                method: 'GET',
                headers,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => response.statusText);
                logger.error(
                    { 
                        status: response.status,
                        statusText: response.statusText,
                        data: errorData 
                    },
                    'getMediaUsageLayouts: HTTP error occurred.'
                );
                return { success: false, message: `HTTP error! status: ${response.status}`, errorData: errorData };
            }

            const data = await response.json();
            
            // Handle the specific case where the media item is not in use
            if (data && typeof data === 'object' && data.data === 'Specified Media item is not in use.') {
                logger.info(`getMediaUsageLayouts: Media item ${input.mediaId} is not in use. Returning an empty array.`);
                return { success: true, data: [] };
            }

            // Handle cases where the API might return an empty object for an empty list
            const dataToParse = (data && typeof data === 'object' && !Array.isArray(data) && Object.keys(data).length === 0)
                ? []
                : data;

            const parsedData = z.array(layoutUsageSchema).safeParse(dataToParse);

            if (!parsedData.success) {
                logger.error(
                    { 
                        error: parsedData.error.format(), 
                        rawData: data 
                    },
                    'getMediaUsageLayouts: Zod validation failed'
                );
                return { 
                    success: false, 
                    message: 'Validation failed for the API response.', 
                    error: parsedData.error.format(),
                    errorData: data
                };
            }

            logger.info(`getMediaUsageLayouts: Successfully retrieved layout usage report for media ${mediaId}.`);
            return { success: true, data: parsedData.data };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
            logger.error(
                {
                    error: errorMessage,
                    details: error
                },
                'getMediaUsageLayouts: An unexpected error occurred during execution.'
            );
            return { success: false, message: errorMessage, errorData: error };
        }
    },
}); 