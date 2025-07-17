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
 * @module playerSoftwareSchemas
 * @description This module contains shared Zod schemas for Xibo Player Software tools.
 */
import { z } from 'zod';

/**
 * Schema for a single Player Version object.
 */
export const playerVersionSchema = z.object({
  versionId: z
    .number()
    .describe('The unique identifier for the player software version.'),
  type: z.string().nullable().describe('The type of the player (e.g., "android", "windows").'),
  version: z.string().nullable().describe('The version string.'),
  code: z.number().nullable().describe('The version code.'),
  playerShowVersion: z
    .string()
    .describe('The version string displayed to the user.'),
  createdAt: z
    .string()
    .datetime()
    .describe('The date and time this version was created.'),
  modifiedAt: z
    .string()
    .datetime()
    .describe('The date and time this version was last modified.'),
  modifiedBy: z
    .string()
    .describe('The name of the user who last modified this version.'),
  fileName: z.string().describe('The name of the player software file.'),
  size: z.number().describe('The size of the file in bytes.'),
  md5: z.string().nullable().describe('The MD5 hash of the file.'),
}); 