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
 * @module TagSchemas
 * @description This module defines the Zod schemas for tag-related data structures
 * received from the Xibo CMS API.
 */
import { z } from 'zod';

/**
 * Defines the schema for a single tag record from the Xibo CMS.
 * This ensures that tag data conforms to the expected structure.
 */
export const tagSchema = z.object({
  tagId: z.number().describe("The unique ID of the tag."),
  tag: z.string().describe("The name or value of the tag."),
  isSystem: z.number().describe("A flag indicating if the tag is a system tag (1 for yes, 0 for no)."),
  isRequired: z.number().describe("A flag indicating if the tag is required (1 for yes, 0 for no)."),
  options: z.string().nullable().optional().describe("Optional predefined values for the tag, if any."),
}); 