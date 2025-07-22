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
 * Get Schedule Events by Display Group ID Tool
 *
 * This module provides a tool to retrieve all schedule events associated with a
 * specific display group from the Xibo CMS.
 */
import { z } from "zod";
import { createTool } from '@mastra/core';
import { logger } from '../../../logger';
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
 * A tool to retrieve all schedule events for a specific display group from the Xibo CMS.
 */
export const getScheduleDisplayGroupIdEvents = createTool({
    id: 'get-schedule-display-group-events',
    description: 'Retrieves schedule events for a specific display group.',
    inputSchema: z.object({
        displayGroupId: z.number().describe("The ID of the display group to retrieve events for."),
    }),
    outputSchema,
    execute: async ({ context: input }): Promise<z.infer<typeof outputSchema>> => {
        const { displayGroupId } = input;

        if (!config.cmsUrl) {
            return { success: false, message: 'CMS URL is not configured.' };
        }

        const url = `${config.cmsUrl}/api/schedule/displaygroup/${displayGroupId}`;

        try {
            const headers = await getAuthHeaders();
            const response = await fetch(url, { headers });

            if (!response.ok) {
                const errorData = await response.json().catch(() => response.statusText);
                logger.error('getScheduleDisplayGroupIdEvents: HTTP error', { status: response.status, error: errorData });
                return { success: false, message: `HTTP error! status: ${response.status}`, error: errorData };
            }

            const data = await response.json();
            const parsedData = responseDataSchema.safeParse(data);

            if (!parsedData.success) {
                logger.error('getScheduleDisplayGroupIdEvents: Zod validation failed', { error: parsedData.error });
                return { success: false, message: 'Validation failed for the received schedule data.', error: parsedData.error.format() };
            }

            return { success: true, data: parsedData.data };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            logger.error('getScheduleDisplayGroupIdEvents: Unexpected error', { displayGroupId, error: errorMessage });
            return { success: false, message: `An unexpected error occurred: ${errorMessage}`, error };
        }
    },
});
