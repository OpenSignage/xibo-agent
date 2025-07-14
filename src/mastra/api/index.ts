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
import { getImageHandler } from './handlers/getImage';
import { swaggerHandler } from './handlers/swagger';
import { getFontImage } from './handlers/getFontImage';

export const apiRoutes = [
  // Swagger UI - API Documentation
  registerApiRoute("/ext-api/swagger-ui", {
    method: "GET",
    handler: swaggerHandler,
  }),
  // Hello World API - Test endpoint
  registerApiRoute("/ext-api/hello", {
    method: "GET",
    handler: helloHandler,
  }),
  // File Upload API - Handles media file uploads
  registerApiRoute("/ext-api/upload", {
    method: "POST",
    handler: uploadHandler,
  }),
  // Get Image API - Serves generated images
  registerApiRoute("/ext-api/getImage/:filename", {
    method: "GET",
    handler: getImageHandler,
  }),
  // Get Font Preview Image API - Serves generated font preview images
  registerApiRoute("/ext-api/getFontImage/:fileName", {
    method: "GET",
    handler: getFontImage,
  }),
]; 