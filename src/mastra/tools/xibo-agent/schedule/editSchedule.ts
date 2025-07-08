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
 * Create/Update Schedule Event Tool
 *
 * This module provides a tool to create or update a schedule event in the Xibo CMS.
 * It handles both creating new events and modifying existing ones.
 */
import { z } from "zod";
import { createTool } from '@mastra/core';
import { logger } from '../../../index';
import { getAuthHeaders } from '../auth';
import { config } from '../config';
import { scheduleEventSchema } from './schemas';

// Base schema for event properties, used for both create and update
const baseEventSchema = z.object({
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

// Schema for the input when creating or updating an event
const inputSchema = baseEventSchema.extend({
    eventId: z.number().optional().describe("The ID of the event to update. If omitted, a new event will be created."),
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
 * A tool to create or update a schedule event in the Xibo CMS.
 * If an eventId is provided, it updates the existing event. Otherwise, it creates a new one.
 */
export const editSchedule = createTool({
    id: 'edit-schedule',
    description: 'Create or update a schedule event.',
    inputSchema,
    outputSchema,
    execute: async ({ context: input }): Promise<z.infer<typeof outputSchema>> => {
        const { eventId, ...eventData } = input;
        
        if (!config.cmsUrl) {
            return { success: false, message: 'CMS URL is not configured.' };
        }

        const endpoint = eventId ? `/api/schedule/${eventId}` : '/api/schedule';
        const url = `${config.cmsUrl}${endpoint}`;
        const method = eventId ? 'PUT' : 'POST';
        const action = eventId ? 'updating' : 'creating';

        try {
            const authHeaders = await getAuthHeaders();
            const headers = {
                ...authHeaders,
                'Content-Type': 'application/x-www-form-urlencoded',
            };

            const params = new URLSearchParams();
            for (const [key, value] of Object.entries(eventData)) {
                if (value !== undefined) {
                     if (Array.isArray(value)) {
                        params.append(key, value.join(','));
                    } else {
                        params.append(key, String(value));
                    }
                }
            }

            const response = await fetch(url, {
                method,
                headers,
                body: params,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => response.statusText);
                logger.error(`editSchedule: HTTP error while ${action} event ${eventId || ''}`, { status: response.status, error: errorData });
                return { success: false, message: `HTTP error! status: ${response.status}`, error: errorData };
            }

            const data = await response.json();
            const parsedData = scheduleEventSchema.safeParse(data);

            if (!parsedData.success) {
                logger.error('editSchedule: Zod validation failed', { error: parsedData.error });
                return { success: false, message: 'Validation failed for the API response.', error: parsedData.error.format() };
            }
            
            return { success: true, data: parsedData.data };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            logger.error(`editSchedule: Unexpected error while ${action} event`, { eventId, error: errorMessage });
            return { success: false, message: `An unexpected error occurred: ${errorMessage}`, error };
        }
    },
}); 