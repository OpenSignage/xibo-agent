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
 * This module provides a tool to retrieve schedule information from the Xibo CMS.
 * It allows querying for schedule events based on various filters like display
 * group IDs and event IDs.
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
 * A tool to retrieve schedule events from the Xibo CMS.
 * It can filter events by display group IDs and a specific event ID.
 */
export const getSchedule = createTool({
    id: 'get-schedule',
    description: 'Retrieves schedule events. Can be filtered by display groups or a specific event.',
    inputSchema: z.object({
        displayGroupIds: z.array(z.number()).optional().describe("An array of display group IDs to filter the schedule events."),
        eventId: z.number().optional().describe("A specific event ID to retrieve.")
    }),
    outputSchema,
    execute: async ({ context: input }): Promise<z.infer<typeof outputSchema>> => {
        const { displayGroupIds, eventId } = input;
        
        if (!config.cmsUrl) {
            return { success: false, message: 'CMS URL is not configured.' };
        }

        const params = new URLSearchParams();
        if (displayGroupIds) {
            params.append('displayGroupIds', displayGroupIds.join(','));
        }

        const endpoint = eventId ? `/api/schedule/${eventId}` : '/api/schedule';
        const url = `${config.cmsUrl}${endpoint}?${params.toString()}`;

        try {
            const headers = await getAuthHeaders();
            const response = await fetch(url, { headers });

            if (!response.ok) {
                const errorData = await response.json().catch(() => response.statusText);
                logger.error('getSchedule: HTTP error', { status: response.status, error: errorData });
                return { success: false, message: `HTTP error! status: ${response.status}`, error: errorData };
            }

            const data = await response.json();
            // If a single event is requested, the API returns an object, not an array. Wrap it.
            const dataArray = Array.isArray(data) ? data : [data];
            const parsedData = responseDataSchema.safeParse(dataArray);

            if (!parsedData.success) {
                logger.error('getSchedule: Zod validation failed', { error: parsedData.error });
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