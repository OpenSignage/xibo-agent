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
 * @description Provides shared Zod schemas for Xibo Sync Group tools.
 * This centralization of schemas ensures consistency and reusability across
 * different tools that interact with Sync Group entities in the CMS.
 */
import { z } from 'zod';

/**
 * Schema for a single Sync Group object as returned by the Xibo API.
 */
export const syncGroupSchema = z.object({
  syncGroupId: z.number().describe('The unique ID of the sync group.'),
  syncGroupName: z.string().describe('The name of the sync group.'),
  isSyncEnabled: z.number().describe('Flag indicating if sync is enabled (0 or 1).'),
  isSyncTimeEnabled: z.number().describe('Flag indicating if sync time is enabled (0 or 1).'),
  isSyncOffsetEnabled: z.number().describe('Flag indicating if sync offset is enabled (0 or 1).'),
  syncOffset: z.number().describe('The sync offset value.'),
  syncMaster: z.number().describe('The display ID of the sync master.'),
  syncMasterMac: z.string().describe('The MAC address of the sync master.'),
  syncSlaves: z.array(z.number()).describe('An array of display IDs for the sync slaves.'),
  syncMasterCode: z.string().describe('The identification code for the sync master.'),
});

/**
 * Schema for the success response of an operation.
 */
export const successResponseSchema = z.object({
  success: z.literal(true).describe('Indicates the operation was successful.'),
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

/**
 * Schema for a display associated with a Sync Group.
 */
export const syncGroupDisplaySchema = z.object({
    displayGroupId: z.number().describe("The ID of the display group."),
    displayId: z.number().describe("The unique ID of the display."),
    display: z.string().describe("The name of the display."),
    isMaster: z.number().describe("Flag indicating if this display is the master (1) or a slave (0)."),
    macAddress: z.string().describe("The MAC address of the display."),
    version: z.string().describe("The player software version."),
    playerSoftware: z.string().describe("The name of the player software."),
    playerSoftwareId: z.number().describe("The ID of the player software."),
});

/**
 * Schema for the user object within a response.
 */
export const userSchema = z.object({
  userId: z.number().describe("The user's ID"),
  userName: z.string().describe("The user's name"),
  userGroupId: z.number().describe("The ID of the user's group"),
  userGroupName: z.string().describe("The name of the user's group"),
  isRetired: z.number().describe("Flag indicating if the user is retired"),
  isDisplayAdmin: z.number().describe("Flag indicating if the user has display admin privileges"),
  isGroupAdmin: z.number().describe("Flag indicating if the user has group admin privileges"),
  userTypeId: z.number().describe("The ID of the user's type"),
  userType: z.string().describe("The user's type (e.g., 'System', 'Group')"),
  lastAccessed: z.string().describe("The last access timestamp"),
  loggedIn: z.string().describe("The last login timestamp"),
  homePage: z.string().describe("The user's home page"),
}); 