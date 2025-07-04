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
 * @module userGroupSchemas
 * @description This module contains shared Zod schemas for Xibo user group tools.
 */

import { z } from "zod";

/**
 * Schema for the user group data returned by the API.
 */
export const userGroupSchema = z.object({
  groupId: z.number(),
  group: z.string(),
  isUserSpecific: z.number().optional(),
  isEveryone: z.number().optional(),
  description: z.string().nullable().optional(),
  libraryQuota: z.number().nullable().optional(),
  isSystemNotification: z.number().optional(),
  isDisplayNotification: z.number().optional(),
  isDataSetNotification: z.number().optional(),
  isLayoutNotification: z.number().optional(),
  isLibraryNotification: z.number().optional(),
  isReportNotification: z.number().optional(),
  isScheduleNotification: z.number().optional(),
  isCustomNotification: z.number().optional(),
  isShownForAddUser: z.number().optional(),
  defaultHomepageId: z.string().nullable().optional(),
  features: z.array(z.string()).optional(),
  buttons: z.array(z.string()).optional(),
}); 