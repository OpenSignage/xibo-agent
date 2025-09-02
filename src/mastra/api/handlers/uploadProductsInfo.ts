/*
 * Copyright (C) 2024 OpenSignage Project.
 * All rights reserved.
 *
 * This software is licensed under the Elastic License 2.0 (ELv2).
 * You may obtain a copy of the license at:
 * https://www.elastic.co/licensing/elastic-license
 */

import { Context } from 'hono';
import { logger } from './logger';
import { config as apiConfig } from '../config';
import { config as toolsConfig } from '../../tools/xibo-agent/config';
import path from 'path';
import fs from 'fs/promises';

/**
 * Strict whitelist for product analysis inputs.
 * Only these extensions are accepted by the upload endpoint.
 */
const allowedExtensions = ['.pdf', '.ppt', '.pptx', '.txt', '.md', '.url'];
const isAllowedFile = (file: File): boolean => {
  const extension = path.extname(file.name).toLowerCase();
  return allowedExtensions.includes(extension);
};

const isAllowedSize = (file: File): boolean => file.size <= apiConfig.upload.maxFileSize;

/**
 * Sanitize the product name so that it can be used safely as a directory name.
 * - Trims whitespace
 * - Replaces unsupported characters with underscore
 * - Allows ASCII letters/numbers/space/underscore/hyphen and common CJK/Hiragana/Katakana
 */
function sanitizeProductName(name: string): string {
  const trimmed = (name || '').trim();
  // Allow letters, numbers, space, underscore, hyphen and common CJK/Hiragana/Katakana
  const safe = trimmed.replace(/[^A-Za-z0-9_ \-\u3040-\u30FF\u4E00-\u9FFF]/g, '_');
  return safe.length > 0 ? safe : '';
}

/**
 * Handle multipart file uploads for a specific product name.
 *
 * Behavior:
 * 1) Validate and sanitize `productName` from the path parameter
 * 2) Parse incoming multipart form-data and collect files
 * 3) Clean the target directory (delete if exists), then recreate it
 * 4) Validate each file (extension/size), then save it to disk
 * 5) Return a success JSON with file metadata or an error JSON on failure
 */
export const uploadProductsInfoByNameHandler = async (c: Context) => {
  try {
    // 1) Validate productName from path parameter
    const productNameRaw = (c.req as any).param('productName') || '';
    const productName = sanitizeProductName(productNameRaw);
    if (!productName) {
      return c.json({ error: 'Invalid productName' }, 400);
    }

    // 2) Parse multipart form-data from the request
    const formData = await c.req.formData();
    const files = formData.getAll('file') as File[];
    if (!files || files.length === 0) {
      return c.json({ error: 'No file uploaded' }, 400);
    }

    // 3) Prepare the target directory (clean first, then recreate)
    const targetDir = path.join(toolsConfig.projectRoot, 'persistent_data', 'products_info', productName);
    // Clean existing directory (if any). `force: true` avoids throwing if it does not exist.
    try {
      await fs.rm(targetDir, { recursive: true, force: true });
    } catch {
      // Best-effort cleanup — ignore removal errors and proceed to mkdir
    }
    await fs.mkdir(targetDir, { recursive: true });

    // 4) Validate and persist files
    const results: Array<{ filename: string; size: number; type: string; savedPath: string }> = [];
    
    for (const file of files) {
      // Validate extension against the allowlist
      if (!isAllowedFile(file)) {
        return c.json({ error: `Invalid file type for ${file.name}`, allowedExtensions }, 400);
      }
      // Enforce max file size
      if (!isAllowedSize(file)) {
        return c.json({ error: `File too large: ${file.name}`, maxSize: apiConfig.upload.maxFileSize }, 400);
      }

      // Persist file to disk
      const arrayBuffer = await file.arrayBuffer();
      const savedPath = path.join(targetDir, file.name);
      await fs.writeFile(savedPath, Buffer.from(arrayBuffer));
      results.push({ filename: file.name, size: file.size, type: file.type, savedPath });
    }

    // 5) Return success JSON with minimal metadata for the uploaded files
    logger.info('Products info files uploaded (by productName)', { productName, count: results.length, dir: targetDir });
    return c.json({ success: true, productName, dir: targetDir, files: results });
  } catch (error) {
    // Unified error handling — ensure a structured error JSON is returned
    logger.error('uploadProductsInfoByName failed', { error });
    return c.json({ error: 'Upload failed' }, 500);
  }
};

