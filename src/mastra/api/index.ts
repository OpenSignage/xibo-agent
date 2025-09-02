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
import { uploadHandler } from './handlers/upload';
import { getImageHandler } from './handlers/getImage';
import { getFontImageHandler } from './handlers/getFontImage';
import { uploadProductsInfoFormHandler } from './handlers/uploadProductsInfoForm';
import { uploadProductsInfoByNameHandler } from './handlers/uploadProductsInfo';
import { downloadUnifiedHandler } from './handlers/downloadUnified';

export const apiRoutes = [
  // File Upload API - Handles media file uploads
  registerApiRoute("/ext-api/upload", {
    method: "POST",
    handler: uploadHandler,
    openapi: {
      summary: "Generic file upload",
      description: "Uploads a single file using multipart/form-data. Validates type and size based on server configuration (images/videos/fonts). The file is saved under persistent_data/uploads.",
      tags: ["Extended API"],
      requestBody: {
        required: true,
        content: {
          "multipart/form-data": {
            schema: {
              type: "object",
              properties: {
                file: { type: "string", format: "binary", description: "File to upload (single)" }
              },
              required: ["file"]
            }
          }
        }
      },
      responses: {
        200: {
          description: "Upload succeeded",
          content: { "application/json": { schema: { type: "object", properties: { message: { type: "string" }, filename: { type: "string" }, size: { type: "number" }, type: { type: "string" } } } } }
        },
        400: { description: "Validation error (missing file / invalid type / too large)" },
        500: { description: "Server error" }
      }
    },
  }),
  // Upload form (HTML)
  registerApiRoute("/ext-api/products_info/upload-form/:productName", {
    method: "GET",
    handler: uploadProductsInfoFormHandler,
    openapi: {
      summary: "Products info upload form",
      description: "Serve an HTML form to upload product-related files. Uses path parameter to indicate target product.",
      tags: ["Extended API"],
      parameters: [
        { name: "productName", in: "path", required: true, schema: { type: "string" }, description: "Target product name (used as subdirectory under products_info)" }
      ],
      responses: {
        200: {
          description: "HTML form",
          content: { "text/html": { schema: { type: "string" } } }
        }
      }
    },
  }),
  // Upload product-related files into persistent_data/products_info/<productName>
  registerApiRoute("/ext-api/products_info/upload/:productName", {
    method: "POST",
    handler: uploadProductsInfoByNameHandler,
    openapi: {
      summary: "Upload product info files",
      description: "Uploads files into persistent_data/products_info/<productName>. Supports .pdf/.ppt/.pptx/.txt/.md/.url.",
      tags: ["Extended API"],
      parameters: [
        { name: "productName", in: "path", required: true, schema: { type: "string" }, description: "Target product name (used as subdirectory under products_info)" }
      ],
      requestBody: {
        required: true,
        content: {
          "multipart/form-data": {
            schema: {
              type: "object",
              properties: {
                file: { type: "string", format: "binary", description: "File(s) to upload (can be provided multiple times)" }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: "Upload succeeded",
          content: { "application/json": { schema: { type: "object" } } }
        },
        400: { description: "Validation error (missing productName / no file / invalid type / too large)" },
        500: { description: "Server error" }
      }
    },
  }),
  // Unified download endpoint
  // Examples:
  //   /ext-api/download/report/xxxx.md
  //   /ext-api/download/podcast/xxxx.wav
  //   /ext-api/download/presentation/xxxx.pptx
  registerApiRoute("/ext-api/download/:kind/:fileName", {
    method: "GET",
    handler: downloadUnifiedHandler,
    openapi: {
      summary: "Download generated artifact",
      description: "Downloads a generated file by kind and fileName (report|podcast|presentation).",
      tags: ["Extended API"],
      parameters: [
        {
          name: "kind",
          in: "path",
          required: true,
          schema: { type: "string", enum: ["report", "podcast", "presentation"] },
          description: "Artifact type"
        },
        {
          name: "fileName",
          in: "path",
          required: true,
          schema: { type: "string" },
          description: "Target file name to download"
        }
      ],
      responses: {
        200: { description: "Binary file stream", content: { "application/octet-stream": { schema: { type: "string", format: "binary" } } } },
        404: { description: "File not found" },
        400: { description: "Invalid parameters" },
        500: { description: "Server error" }
      }
    },
  }),
  // Get Image API - Serves generated images
  registerApiRoute("/ext-api/getImage/:filename", {
    method: "GET",
    handler: getImageHandler,
    openapi: {
      summary: "Get generated image",
      description: "Serves a generated image by file name.",
      tags: ["Extended API"],
      parameters: [
        { name: "filename", in: "path", required: true, schema: { type: "string" }, description: "Image file name" }
      ],
      responses: {
        200: { description: "Image stream", content: { "image/*": { schema: { type: "string", format: "binary" } } } },
        404: { description: "Image not found" }
      }
    },
  }),
  // Get Font Preview Image API - Serves generated font preview images
  registerApiRoute("/ext-api/getFontImage/:fileName", {
    method: "GET",
    handler: getFontImageHandler,
    openapi: {
      summary: "Get font preview image",
      description: "Serves a generated font preview image by file name.",
      tags: ["Extended API"],
      parameters: [
        { name: "fileName", in: "path", required: true, schema: { type: "string" }, description: "Font image file name" }
      ],
      responses: {
        200: { description: "Font preview image stream", content: { "image/*": { schema: { type: "string", format: "binary" } } } },
        404: { description: "File not found" }
      }
    },
  }),
]; 