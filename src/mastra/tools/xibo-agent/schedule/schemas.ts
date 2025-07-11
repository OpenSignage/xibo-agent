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

// Schema for tags within a display group
const tagSchema = z.object({
  tag: z.string().nullable(),
  tagId: z.number(),
  value: z.string().nullable(),
});

// Schema for a display group associated with a schedule event
const displayGroupSchema = z.object({
  displayGroupId: z.number(),
  displayGroup: z.string(),
  description: z.string().nullable(),
  isDisplaySpecific: z.number(),
  isDynamic: z.number(),
  dynamicCriteria: z.string().nullable(),
  dynamicCriteriaLogicalOperator: z.string().nullable(),
  dynamicCriteriaTags: z.string().nullable(),
  dynamicCriteriaExactTags: z.number(),
  dynamicCriteriaTagsLogicalOperator: z.string().nullable(),
  userId: z.number(),
  tags: z.array(tagSchema).optional(),
  bandwidthLimit: z.number().nullable(),
  groupsWithPermissions: z.string().nullable(),
  createdDt: z.string().nullable(),
  modifiedDt: z.string().nullable(),
  folderId: z.number().nullable(),
  permissionsFolderId: z.number().nullable(),
  ref1: z.string().nullable(),
  ref2: z.string().nullable(),
  ref3: z.string().nullable(),
  ref4: z.string().nullable(),
  ref5: z.string().nullable(),
});

// Schema for schedule reminders
const scheduleReminderSchema = z.object({
  scheduleReminderId: z.number(),
  eventId: z.number(),
  value: z.number(),
  type: z.number(),
  option: z.number(),
  isEmail: z.number(),
  reminderDt: z.number(),
  lastReminderDt: z.number(),
});

/**
 * A comprehensive schema for a Xibo schedule event, based on the full API response.
 * It includes all possible fields returned from the /schedule endpoint.
 */
export const scheduleEventSchema = z.object({
  eventId: z.number(),
  eventTypeId: z.number(),
  campaignId: z.number(),
  commandId: z.number().nullable(),
  displayGroups: z.array(displayGroupSchema),
  scheduleReminders: z.array(scheduleReminderSchema),
  criteria: z.array(z.string()).optional(),
  userId: z.number(),
  fromDt: z.number().describe("The start timestamp of the event."),
  toDt: z.number().describe("The end timestamp of the event."),
  isPriority: z.number(),
  displayOrder: z.number(),
  recurrenceType: z.string().nullable(),
  recurrenceDetail: z.number().nullable(),
  recurrenceRange: z.number().nullable(),
  recurrenceRepeatsOn: z.string().nullable(),
  recurrenceMonthlyRepeatsOn: z.number().nullable(),
  campaign: z.string().nullable(),
  command: z.string().nullable(),
  dayPartId: z.number().nullable(),
  isAlways: z.number(),
  isCustom: z.number(),
  syncEvent: z.number(),
  syncTimezone: z.number(),
  shareOfVoice: z.number(),
  maxPlaysPerHour: z.number(),
  isGeoAware: z.number(),
  geoLocation: z.string().nullable(),
  actionTriggerCode: z.string().nullable(),
  actionType: z.string().nullable(),
  actionLayoutCode: z.string().nullable(),
  parentCampaignId: z.number().nullable(),
  syncGroupId: z.number().nullable(),
  dataSetId: z.number().nullable(),
  dataSetParams: z.any().nullable().describe("Parameters for the dataSet, can be of any type."),
  modifiedBy: z.number(),
  createdOn: z.string(),
  updatedOn: z.string(),
  name: z.string().nullable(),
}); 