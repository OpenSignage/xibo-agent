/*
 * Copyright (C) 2024 OpenSignage Project.
 * All rights reserved.
 *
 * This software is licensed under the Elastic License 2.0 (ELv2).
 * You may obtain a copy of the license at:
 * https://www.elastic.co/licensing/elastic-license
 */

/**
 * File Upload Handler
 * Handles file uploads with type and size validation
 * 
 * Usage:
 * 1. Using curl:
 *    curl -X POST -F "file=@path/to/your/file.jpg" http://localhost:4111/ext-api/upload
 * 
 * 2. Using fetch:
 *    const formData = new FormData();
 *    formData.append('file', fileInput.files[0]);
 *    const response = await fetch('http://localhost:4111/ext-api/upload', {
 *      method: 'POST',
 *      body: formData
 *    });
 * 
 * Response:
 * - Success (200):
 *   {
 *     "message": "File uploaded successfully",
 *     "filename": "example.jpg",
 *     "size": 12345,
 *     "type": "image/jpeg"
 *   }
 * 
 * - Error (400/500):
 *   {
 *     "error": "Error message",
 *     "details": "Detailed error information"
 *   }
 * 
 * Configuration:
 * - File size limit: 4GB (configurable via MAX_FILE_SIZE env var)
 * - Allowed file types: images, videos, fonts (configurable via env vars)
 *   See config.ts for details
 */

import { Context } from 'hono';
import { logger } from '../logger';
import { config } from '../config';
import path from 'path';
import fs from 'fs/promises';

/**
 * Validates if the file type is allowed
 * @param file - The file to validate
 * @returns boolean indicating if the file type is allowed
 */
const validateFileType = (file: File): boolean => {
  const extension = path.extname(file.name).toLowerCase();
  const mimeType = file.type;

  // Combine all allowed types into a single array
  const allAllowedTypes = [
    ...config.upload.allowedTypes.image,
    ...config.upload.allowedTypes.video,
    ...config.upload.allowedTypes.font
  ];

  // Combine all allowed extensions into a single array
  const allAllowedExtensions = [
    ...config.upload.allowedExtensions.image,
    ...config.upload.allowedExtensions.video,
    ...config.upload.allowedExtensions.font
  ];

  return allAllowedTypes.includes(mimeType) || allAllowedExtensions.includes(extension);
};

/**
 * Validates if the file size is within the allowed limit
 * @param file - The file to validate
 * @returns boolean indicating if the file size is allowed
 */
const validateFileSize = (file: File): boolean => {
  return file.size <= config.upload.maxFileSize;
};

/**
 * Handles file upload requests
 * Validates file type and size, then saves the file to the upload directory
 * 
 * @param c - Hono context object
 * @returns JSON response with upload status
 */
export const uploadHandler = async (c: Context) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return c.json({ error: "No file uploaded" }, 400);
    }

    // Validate file type
    if (!validateFileType(file)) {
      return c.json({ 
        error: "Invalid file type",
        allowedTypes: {
          image: config.upload.allowedTypes.image,
          video: config.upload.allowedTypes.video,
          font: config.upload.allowedTypes.font
        }
      }, 400);
    }

    // Validate file size
    if (!validateFileSize(file)) {
      return c.json({ 
        error: "File too large",
        maxSize: config.upload.maxFileSize
      }, 400);
    }

    // Create upload directory if it doesn't exist
    const uploadDir = path.join(process.cwd(), 'persistent_data', 'uploads');
    await fs.mkdir(uploadDir, { recursive: true });

    // Save the file
    const filePath = path.join(uploadDir, file.name);
    const arrayBuffer = await file.arrayBuffer();
    await fs.writeFile(filePath, Buffer.from(arrayBuffer));

    logger.info(`File uploaded successfully: ${file.name}, size: ${file.size}`);
    
    return c.json({ 
      message: "File uploaded successfully",
      filename: file.name,
      size: file.size,
      type: file.type
    });
  } catch (error) {
    logger.error('Upload error:', { 
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined
    });
    return c.json({ 
      error: "Upload failed",
      details: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
}; 