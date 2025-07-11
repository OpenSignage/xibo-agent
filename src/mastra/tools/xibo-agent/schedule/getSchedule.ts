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
 * Get Schedule Tool
 *
 * This module provides a tool to retrieve a filtered list of schedule events 
 * from the Xibo CMS.
 */
import { z } from "zod";
import { createTool } from '@mastra/core';
import { logger } from '../../../index';
import { getAuthHeaders } from '../auth';
import { config } from '../config';
import { scheduleEventSchema } from './schemas';

const responseDataSchema = z.array(scheduleEventSchema);

// Schema for the overall response
const outputSchema = z.union([
    z.object({
        success: z.literal(true),
        data: responseDataSchema,
    }),
    z.object({
        success: z.literal(false),
        message: z.string(),
        error: z.any().optional(),
    }),
]);

/**
 * A tool to retrieve a filtered list of schedule events from the Xibo CMS.
 */
export const getSchedule = createTool({
    id: 'get-schedule',
    description: 'Retrieves a filtered list of schedule events.',
    inputSchema: z.object({
        eventTypeId: z.number().optional().describe("Filter by event type ID. 1=Layout, 2=Command, 3=Overlay, 4=Interrupt, 5=Campaign, 6=Action, 7=Media Library, 8=Playlist"),
        displayGroupIds: z.array(z.number()).optional().describe("Filter events by an array of Display Group Ids."),
        fromDt: z.string().optional().describe("Filter for events starting from this date. Format: YYYY-MM-DD HH:mm:ss"),
        toDt: z.string().optional().describe("Filter for events ending by this date. Format: YYYY-MM-DD HH:mm:ss"),
        geoAware: z.number().optional().describe("Flag (0 or 1) to return events using Geo Location."),
        recurring: z.number().optional().describe("Flag (0 or 1) to return recurring events."),
        campaignId: z.number().optional().describe("Filter events by a specific campaign ID."),
    }),
    outputSchema,
    execute: async ({ context: input }): Promise<z.infer<typeof outputSchema>> => {
        if (!config.cmsUrl) {
            return { success: false, message: 'CMS URL is not configured.' };
        }

        const params = new URLSearchParams();

        for (const [key, value] of Object.entries(input)) {
            if (value !== undefined) {
                if (Array.isArray(value)) {
                    params.append(key, value.join(','));
                } else {
                    params.append(key, String(value));
                }
            }
        }
        
        const url = `${config.cmsUrl}/api/schedule?${params.toString()}`;

        try {
            const headers = await getAuthHeaders();
            const response = await fetch(url, { headers });

            if (!response.ok) {
                const errorData = await response.json().catch(() => response.statusText);
                logger.error('getSchedule: HTTP error', { status: response.status, error: errorData });
                return { success: false, message: `HTTP error! status: ${response.status}`, error: errorData };
            }

            const data = await response.json();
            const parsedData = responseDataSchema.safeParse(data);

            if (!parsedData.success) {
                logger.error('getSchedule: Zod validation failed', { error: parsedData.error, rawData: data });
                return { success: false, message: 'Validation failed for the received schedule data.', error: parsedData.error.format() };
            }

            return { success: true, data: parsedData.data };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            logger.error('getSchedule: Unexpected error', { error: errorMessage });
            return { success: false, message: `An unexpected error occurred: ${errorMessage}`, error };
        }
    },
}); 