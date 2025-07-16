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
 * @module commandSchemas
 * @description This module contains shared Zod schemas for Xibo command tools,
 * defining the structure of command data.
 */
import { z } from 'zod';

/**
 * Schema for a single command object, based on the GET /command API response.
 */
export const commandSchema = z.object({
  commandId: z.number().describe('The unique identifier for the command.'),
  command: z.string().describe('The name of the command.'),
  code: z
    .string()
    .describe(
      'A code used to identify the command, often used in things like web hooks.'
    ),
  description: z
    .string()
    .nullable()
    .describe('A description of what the command is for.'),
  userId: z.number().describe('The ID of the user who created the command.'),
  commandString: z
    .string()
    .nullable()
    .describe('The command string to be sent to the Player.'),
  validationString: z
    .string()
    .nullable()
    .describe(
      'A regular expression to validate the output of the command string.'
    ),
  displayProfileId: z
    .number()
    .nullable()
    .describe('The ID of a display profile to associate with this command.'),
  commandStringDisplayProfile: z
    .string()
    .nullable()
    .describe('The command string for the associated display profile.'),
  validationStringDisplayProfile: z
    .string()
    .nullable()
    .describe(
      'The validation string for the associated display profile.'
    ),
  availableOn: z
    .string()
    .nullable()
    .describe('Where the command is available (e.g., Display, DisplayGroup).'),
  createAlertOn: z
    .string()
    .nullable()
    .describe(
      'Condition for creating an alert (e.g., Success, Error, Always).'
    ),
  createAlertOnDisplayProfile: z
    .string()
    .nullable()
    .describe('Alert condition for the associated display profile.'),
  groupsWithPermissions: z
    .string()
    .nullable()
    .describe('A comma-separated list of user groups with permissions.'),
}); 