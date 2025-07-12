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
 * @module
 * This module defines common Zod schemas for the Resolution tools in the Xibo Agent.
 * These schemas are used for data validation and type inference.
 */

import { z } from "zod";

/**
 * Schema for a single resolution object returned by the API.
 */
export const resolutionSchema = z.object({
  resolutionId: z.number().describe("The unique ID of the resolution."),
  resolution: z.string().describe("The name of the resolution."),
  width: z.number().describe("The width of the resolution in pixels."),
  height: z.number().describe("The height of the resolution in pixels."),
  designerWidth: z.number().describe("The designer width."),
  designerHeight: z.number().describe("The designer height."),
  version: z.number().describe("The version number of the resolution."),
  enabled: z.number().describe("Flag indicating if the resolution is enabled (1 or 0)."),
  userId: z.number().describe("The ID of the user associated with the resolution."),
}).passthrough(); 