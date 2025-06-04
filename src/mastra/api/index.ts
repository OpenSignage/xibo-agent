/*
 * Copyright (C) 2024 OpenSignage Project.
 * All rights reserved.
 *
 * This software is licensed under the Elastic License 2.0 (ELv2).
 * You may obtain a copy of the license at:
 * https://www.elastic.co/licensing/elastic-license
 */

/**
 * API Routes Registration
 * This file registers all custom API routes for the application
 */

import { registerApiRoute } from '@mastra/core/server';
import { helloHandler } from './handlers/hello';
import { uploadHandler } from './handlers/upload';

export const apiRoutes = [
  registerApiRoute("/ext-api/hello", {
    method: "GET",
    handler: helloHandler,
  }),
  registerApiRoute("/ext-api/upload", {
    method: "POST",
    handler: uploadHandler,
  }),
]; 