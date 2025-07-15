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
 * @description Provides shared Zod schemas for Xibo Sync Group tools,
 * ensuring consistency with the xibo-api.json specification.
 */
import { z } from 'zod';

/**
 * Schema for a single Sync Group object, based on #/definitions/SyncGroup.
 */
export const syncGroupSchema = z.object({
  syncGroupId: z.number().describe('The ID of this Entity'),
  name: z.string().describe('The name of this Entity'),
  createdDt: z.string().nullable().describe('The datetime this entity was created'),
  modifiedDt: z.string().nullable().describe('The datetime this entity was last modified'),
  modifiedBy: z.number().nullable().describe('The ID of the user that last modified this sync group'),
  modifiedByName: z.string().nullable().describe('The name of the user that last modified this sync group'),
  ownerId: z.number().describe('The ID of the owner of this sync group'),
  owner: z.string().nullable().describe('The name of the owner of this sync group'),
  syncPublisherPort: z.number().describe('The publisher port number'),
  syncSwitchDelay: z.number().nullable().describe('The delay (in ms) when displaying the changes in content'),
  syncVideoPauseDelay: z.number().nullable().describe('The delay (in ms) before unpausing the video on start.'),
  leadDisplayId: z.number().nullable().describe('The ID of the lead Display for this sync group'),
  leadDisplay: z.string().nullable().describe('The name of the lead Display for this sync group'),
  folderId: z.number().optional().describe('The id of the Folder this Sync Group belongs to'),
  permissionsFolderId: z.number().optional().describe('The id of the Folder responsible for providing permissions for this Sync Group'),
  groupsWithPermissions: z.any().optional().nullable().describe('Groups with permissions for this sync group'),
});

/**
 * Schema for a display that is a member of a Sync Group.
 * This combines relevant fields from #/definitions/Display and the response of GET /syncgroup/{syncGroupId}/displays.
 */
export const syncGroupDisplaySchema = z.object({
  displayId: z.number().describe("The unique ID of the display."),
  display: z.string().describe("The name of the display."),
  isMaster: z.number().describe("Flag indicating if this display is the master (1) or a slave (0).").optional(), // This field is not in the base Display definition but is in the sync group context
  macAddress: z.string().optional().describe("The MAC address of the display."),
  version: z.string().optional().describe("The player software version."),
  playerSoftware: z.string().optional().describe("The name of the player software."),
  playerSoftwareId: z.number().optional().describe("The ID of the player software."),
  // The API for GET /syncgroup/{syncGroupId}/displays seems to return a variant of the Display object.
  // The fields below are from the main Display definition and might not all be present.
  authorised: z.number().optional().describe('Flag indicating if the display is authorised.'),
  loggedIn: z.number().optional().describe('Flag indicating if the display is logged in.'),
});

/**
 * Schema for a failed operation response.
 */
export const errorResponseSchema = z.object({
  success: z.literal(false).describe('Indicates the operation failed.'),
  message: z.string().describe('A human-readable error message.'),
  error: z.any().optional().describe('Optional technical details about the error.'),
  errorData: z.any().optional().describe('Optional raw error data from the API.'),
}); 