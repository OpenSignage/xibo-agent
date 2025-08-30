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
import { getFontImageHandler } from './handlers/getFontImage';
import { uploadProductsInfoHandler } from './handlers/uploadProductsInfo';
import { uploadProductsInfoFormHandler } from './handlers/uploadProductsInfoForm';
import { downloadUnifiedHandler } from './handlers/downloadUnified';

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
  // Upload form (HTML)
  registerApiRoute("/ext-api/threads/products_info/upload-form", {
    method: "GET",
    handler: uploadProductsInfoFormHandler,
  }),
  // Upload product-related files into persistent_data/<threadId>/products_info
  registerApiRoute("/ext-api/threads/:threadId/products_info/upload", {
    method: "POST",
    handler: uploadProductsInfoHandler,
  }),
  // Unified download endpoint
  // Examples:
  //   /ext-api/download/report/xxxx.md
  //   /ext-api/download/podcast/xxxx.wav
  //   /ext-api/download/presentation/xxxx.pptx
  registerApiRoute("/ext-api/download/:kind/:fileName", {
    method: "GET",
    handler: downloadUnifiedHandler,
  }),
  // Get Image API - Serves generated images
  registerApiRoute("/ext-api/getImage/:filename", {
    method: "GET",
    handler: getImageHandler,
  }),
  // Get Font Preview Image API - Serves generated font preview images
  registerApiRoute("/ext-api/getFontImage/:fileName", {
    method: "GET",
    handler: getFontImageHandler,
  }),
]; 