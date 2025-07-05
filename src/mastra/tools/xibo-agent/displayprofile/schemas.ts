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
 * @module DisplayProfileSchemas
 * @description Provides shared Zod schemas for display profile tools.
 */
import { z } from 'zod';

/**
 * Schema for a single display profile, including optional embedded data.
 * The `catchall(z.any())` is used to allow for any other properties that might be returned,
 * especially when using the 'embed' parameter.
 */
export const displayProfileSchema = z.object({
  displayProfileId: z.number(),
  name: z.string(),
  type: z.string(),
  isDefault: z.number(),
  userId: z.number().optional(),
  config: z.array(z.any()).optional(),
  configDefault: z.array(z.any()).optional(),
}).catchall(z.any()); 