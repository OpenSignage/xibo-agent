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
 * Shared Schemas for Schedule Tools
 *
 * This module defines shared Zod schemas for the data objects
 * related to schedule management in the Xibo CMS.
 */
import { z } from "zod";

/**
 * A comprehensive schema for a Xibo schedule event.
 * It includes all possible fields returned from various schedule-related endpoints.
 * Fields that are not universally present are marked as optional.
 */
export const scheduleEventSchema = z.object({
    eventId: z.number().describe("The unique identifier for the event."),
    eventTypeId: z.number().describe("The type of the event."),
    fromDt: z.string().describe("The start date and time of the event in 'YYYY-MM-DD HH:mm:ss' format."),
    toDt: z.string().describe("The end date and time of the event in 'YYYY-MM-DD HH:mm:ss' format."),
    isAlways: z.number().describe("Flag indicating if the event is always running (1 for yes, 0 for no)."),
    displayOrder: z.number().describe("The display order of the event."),
    isPriority: z.number().describe("Flag indicating if the event has priority (1 for yes, 0 for no)."),
    displayGroupIds: z.array(z.number()).describe("An array of display group IDs this event is scheduled on."),
    userId: z.number().describe("The ID of the user who created the event."),
    daypartId: z.number().nullable().describe("The ID of the daypart, if applicable."),
    
    // Fields from the main /schedule endpoint
    commandId: z.number().nullable().optional().describe("The ID of the command, if applicable."),
    campaignId: z.number().optional().describe("The ID of the campaign associated with the event."),
    syncTimezone: z.number().optional().describe("Flag to sync with the display timezone (1 for yes, 0 for no)."),
    recurrenceType: z.string().nullable().optional().describe("The type of recurrence (e.g., 'Minute', 'Hour')."),
    recurrenceDetail: z.string().nullable().optional().describe("The recurrence details."),
    recurrenceRange: z.number().nullable().optional().describe("The range for the recurrence."),
    campaign: z.string().optional().describe("The name of the campaign."),
    command: z.string().nullable().optional().describe("The command string, if applicable."),
    code: z.string().nullable().optional().describe("The command code, if applicable."),

    // Fields from the /schedule/dataSet endpoint
    dataSetId: z.number().optional().describe("The ID of the dataSet associated with this event."),
    dataSetColumnId: z.number().optional().describe("The ID of the dataSet column used for filtering."),
    filter: z.string().optional().describe("The filter query applied to the dataSet column."),
    operator: z.string().optional().describe("The operator used for filtering (e.g., '=', '!=')."),

    // Fields from the /schedule/displaygroup endpoint
    displayGroupId: z.number().optional().describe("The ID of the display group this event is scheduled on."),
}); 