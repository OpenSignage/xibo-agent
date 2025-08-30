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

// Strict whitelist for product analysis inputs
const allowedExtensions = ['.pdf', '.ppt', '.pptx', '.txt', '.md', '.url'];
const isAllowedFile = (file: File): boolean => {
  const extension = path.extname(file.name).toLowerCase();
  return allowedExtensions.includes(extension);
};

const isAllowedSize = (file: File): boolean => file.size <= apiConfig.upload.maxFileSize;

const isSafeThreadId = (threadId: string): boolean => /^[A-Za-z0-9_-]+$/.test(threadId);

export const uploadProductsInfoHandler = async (c: Context) => {
  try {
    const { threadId } = c.req.param();
    if (!threadId || !isSafeThreadId(threadId)) {
      return c.json({ error: 'Invalid threadId' }, 400);
    }

    const formData = await c.req.formData();
    const files = formData.getAll('file') as File[];
    if (!files || files.length === 0) {
      return c.json({ error: 'No file uploaded' }, 400);
    }

    const targetDir = path.join(toolsConfig.projectRoot, 'persistent_data', threadId, 'products_info');
    await fs.mkdir(targetDir, { recursive: true });

    const results: Array<{ filename: string; size: number; type: string; savedPath: string }> = [];

    for (const file of files) {
      if (!isAllowedFile(file)) {
        return c.json({ error: `Invalid file type for ${file.name}`, allowedExtensions }, 400);
      }
      if (!isAllowedSize(file)) {
        return c.json({ error: `File too large: ${file.name}`, maxSize: apiConfig.upload.maxFileSize }, 400);
      }

      const arrayBuffer = await file.arrayBuffer();
      const savedPath = path.join(targetDir, file.name);
      await fs.writeFile(savedPath, Buffer.from(arrayBuffer));
      results.push({ filename: file.name, size: file.size, type: file.type, savedPath });
    }

    logger.info('Products info files uploaded', { threadId, count: results.length, dir: targetDir });
    return c.json({ success: true, threadId, dir: targetDir, files: results });
  } catch (error) {
    logger.error('uploadProductsInfo failed', { error });
    return c.json({ error: 'Upload failed' }, 500);
  }
};

