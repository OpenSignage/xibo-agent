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
 * @module dayPartSchemas
 * @description This module contains shared Zod schemas for Xibo DayPart tools,
 * defining the structure of dayparting data.
 */
import { z } from 'zod';

/**
 * Schema for a single DayPart object, based on the GET /daypart API response.
 */
export const dayPartSchema = z.object({
  dayPartId: z.number().describe('The unique identifier for the DayPart record.'),
  isAlways: z.number().describe('A flag indicating if this DayPart is always active (1 for true, 0 for false).'),
  isCustom: z.number().describe('A flag indicating if this is a custom DayPart (1 for true, 0 for false).'),
  name: z.string().describe('The name of the DayPart.'),
  description: z.string().nullable().describe('A description for the DayPart.'),
  startTime: z.union([
      z.string().regex(/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/),
      z.string().length(0),])
      .describe('The start time for the DayPart in HH:mm:ss format, or empty string.'),
  endTime: z.union([
      z.string().regex(/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/),
      z.string().length(0),
    ])
    .describe(
      'The end time for the DayPart in HH:mm:ss format, or empty string.'
    ),
  exceptions: z
    .array(
      z.object({
        day: z.string().describe('The day of the week for the exception (e.g., "Mon", "Tue").'),
        start: z.string().describe('The start time of the exception.'),
        end: z.string().describe('The end time of the exception.'),
      })
    )
    .nullable()
    .optional()
    .describe(
      'An array of exceptions associated with this DayPart. This is only available when using `embed=exceptions`.'
    ),
}); 