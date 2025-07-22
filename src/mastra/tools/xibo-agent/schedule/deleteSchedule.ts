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
 * Delete Schedule Event Tool
 *
 * This module provides a tool to delete a specific schedule event
 * from the Xibo CMS.
 */
import { z } from "zod";
import { createTool } from '@mastra/core';
import { logger } from '../../../logger';
import { getAuthHeaders } from '../auth';
import { config } from '../config';

// Schema for the overall response
const outputSchema = z.union([
    z.object({
        success: z.literal(true),
        message: z.string(),
    }),
    z.object({
        success: z.literal(false),
        message: z.string(),
        error: z.any().optional(),
    }),
]);

/**
 * A tool to delete a specific schedule event from the Xibo CMS.
 */
export const deleteSchedule = createTool({
    id: 'delete-schedule',
    description: 'Deletes a specific schedule event.',
    inputSchema: z.object({
        eventId: z.number().describe("The ID of the event to delete."),
    }),
    outputSchema,
    execute: async ({ context: input }): Promise<z.infer<typeof outputSchema>> => {
        const { eventId } = input;
        
        if (!config.cmsUrl) {
            return { success: false, message: 'CMS URL is not configured.' };
        }

        const url = `${config.cmsUrl}/api/schedule/${eventId}`;

        try {
            const headers = await getAuthHeaders();
            const response = await fetch(url, {
                method: 'DELETE',
                headers,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => response.statusText);
                logger.error('deleteSchedule: HTTP error', { eventId, status: response.status, error: errorData });
                return { success: false, message: `HTTP error! status: ${response.status}`, error: errorData };
            }
            
            // A 204 No Content response is expected on successful deletion
            return { success: true, message: `Schedule event ${eventId} deleted successfully.` };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            logger.error('deleteSchedule: Unexpected error', { eventId, error: errorMessage });
            return { success: false, message: `An unexpected error occurred: ${errorMessage}`, error };
        }
    },
}); 