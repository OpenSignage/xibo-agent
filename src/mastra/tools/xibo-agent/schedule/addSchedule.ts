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
 * Create Schedule Event Tool
 *
 * This module provides a tool to create a new schedule event in the Xibo CMS.
 */
import { z } from "zod";
import { createTool } from '@mastra/core';
import { logger } from '../../../logger';
import { getAuthHeaders } from '../auth';
import { config } from '../config';
import { scheduleEventSchema } from './schemas';

// Schema for the input when creating an event
const inputSchema = z.object({
    campaignId: z.number().describe("The ID of the campaign to schedule."),
    displayGroupIds: z.array(z.number()).describe("An array of display group IDs to schedule the event on."),
    fromDt: z.string().describe("The start date and time in 'YYYY-MM-DD HH:mm:ss' format."),
    toDt: z.string().describe("The end date and time in 'YYYY-MM-DD HH:mm:ss' format."),
    isPriority: z.number().optional().describe("Flag to set the event as priority (1 for yes, 0 for no)."),
    displayOrder: z.number().optional().describe("The display order for the event."),
    eventTypeId: z.number().optional().describe("The type of event. Defaults to 1 (Layout)."),
    daypartId: z.number().optional().describe("The ID of a specific daypart to use for this event."),
    recurrenceType: z.string().optional().describe("The recurrence type (e.g., 'Minute', 'Hour', 'Day', 'Week', 'Month', 'Year')."),
    recurrenceDetail: z.string().optional().describe("The recurrence details (e.g., for weekly, a comma-separated list of day numbers 0-6, Sunday-Saturday)."),
    recurrenceRepeatsOn: z.string().optional().describe("For monthly recurrence, specify the day of the month."),
    recurrenceRange: z.number().optional().describe("The end date for the recurrence, as a Unix timestamp."),
});

// Schema for the overall response
const outputSchema = z.union([
    z.object({
        success: z.literal(true),
        data: scheduleEventSchema,
    }),
    z.object({
        success: z.literal(false),
        message: z.string(),
        error: z.any().optional(),
    }),
]);

/**
 * A tool to create a new schedule event in the Xibo CMS.
 */
export const addSchedule = createTool({
    id: 'add-schedule',
    description: 'Create a new schedule event.',
    inputSchema,
    outputSchema,
    execute: async ({ context: input }): Promise<z.infer<typeof outputSchema>> => {
        if (!config.cmsUrl) {
            return { success: false, message: 'CMS URL is not configured.' };
        }

        const url = `${config.cmsUrl}/api/schedule`;

        try {
            const authHeaders = await getAuthHeaders();
            const headers = {
                ...authHeaders,
                'Content-Type': 'application/x-www-form-urlencoded',
            };

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

            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: params,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => response.statusText);
                logger.error('addSchedule: HTTP error while creating event', { status: response.status, error: errorData });
                return { success: false, message: `HTTP error! status: ${response.status}`, error: errorData };
            }

            const data = await response.json();
            const parsedData = scheduleEventSchema.safeParse(data);

            if (!parsedData.success) {
                logger.error('addSchedule: Zod validation failed', { error: parsedData.error });
                return { success: false, message: 'Validation failed for the API response.', error: parsedData.error.format() };
            }
            
            return { success: true, data: parsedData.data };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            logger.error('addSchedule: Unexpected error while creating event', { error: errorMessage });
            return { success: false, message: `An unexpected error occurred: ${errorMessage}`, error };
        }
    },
}); 