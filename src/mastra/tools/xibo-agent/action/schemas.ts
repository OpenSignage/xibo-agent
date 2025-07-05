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
 * @module schemas
 * @description Provides shared Zod schemas for Xibo Action tools.
 */
import { z } from "zod";

/**
 * Schema for a Xibo CMS Action.
 * An action represents a command or event that can be sent to a display or display group.
 */
export const actionSchema = z.object({
  actionId: z.number().describe("The unique identifier for the action."),
  action: z.string().nullable().optional().describe("A descriptive name for the action."),
  type: z.string().nullable().optional().describe("The type of the action (e.g., 'changelayout', 'command')."),
  displayGroupId: z.number().nullable().optional().describe("The ID of the display group this action belongs to."),
  ownerId: z.number().describe("The ID of the user who owns this action."),
  isSystem: z.number().nullable().optional().describe("A flag indicating if this is a system action (0 or 1)."),
  layoutId: z.number().nullable().optional().describe("The layout ID associated with a 'change layout' action."),
  duration: z.number().nullable().optional().describe("The duration associated with an action."),
  commandId: z.number().nullable().optional().describe("The command ID associated with a 'command' action."),
  command: z.string().nullable().optional().describe("The shell command string for a 'shell command' action."),
  reboot: z.string().nullable().optional().describe("Flag for 'reboot' action type."),
  powerState: z.string().nullable().optional().describe("The power state for a 'power' action (e.g., 'on', 'off')."),
  font: z.string().nullable().optional().describe("The font for a 'font' action."),
}).catchall(z.any()); 