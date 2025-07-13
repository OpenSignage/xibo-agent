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
 * Schema for a Xibo CMS Action, based on the API definition.
 * An action represents a command or navigable event that can be triggered
 * on a display or display group.
 */
export const actionSchema = z.object({
  actionId: z.number().describe("The unique identifier for the action."),
  ownerId: z.number().describe("The ID of the user who owns this action."),
  triggerType: z.string().nullable().describe("The action's trigger type (e.g., 'touch', 'webhook')."),
  triggerCode: z.string().nullable().describe("The action's trigger code."),
  actionType: z.string().nullable().describe("The action's type (e.g., 'next', 'previous', 'navLayout', 'navWidget')."),
  source: z.string().nullable().describe("The source of the action (e.g., 'layout', 'region', 'widget')."),
  sourceId: z.number().nullable().describe("The ID of the action's source object (layoutId, regionId, or widgetId)."),
  target: z.string().nullable().describe("The target of the action (e.g., 'screen', 'region')."),
  targetId: z.number().nullable().describe("The ID of the action's target object (e.g., regionId)."),
  widgetId: z.number().nullable().describe("The widget ID to navigate to for 'navWidget' actions."),
  layoutCode: z.string().nullable().describe("The layout code identifier for 'navLayout' actions."),
  layoutId: z.number().nullable().describe("The layout ID associated with this action."),
}).catchall(z.any()); 