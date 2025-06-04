/*
 * Copyright (C) 2024 OpenSignage Project.
 * All rights reserved.
 *
 * This software is licensed under the Elastic License 2.0 (ELv2).
 * You may obtain a copy of the license at:
 * https://www.elastic.co/licensing/elastic-license
 */

/**
 * Hello World API Handler
 * Simple endpoint to test the API functionality
 */

import { Context } from 'hono';

export const helloHandler = async (c: Context) => {
  return c.json({ message: "Hello from ext-api" });
}; 