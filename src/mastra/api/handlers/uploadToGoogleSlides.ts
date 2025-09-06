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
 * @module uploadToGoogleSlidesHandler
 * @description Uploads a generated PPTX (in presentations dir) to Google Drive and converts it to Google Slides.
 * Returns the created file id and webViewLink on success.
 */

import path from 'path';
import { promises as fs } from 'fs';
import type { Context } from 'hono';
import { uploadToGoogleSlidesTool } from '../../tools/util/uploadToGoogleSlides';
import { config } from '../../tools/xibo-agent/config';
import { logger } from '../../logger';

function isValidPresentationName(name: string): boolean {
  // Allow unicode letters/numbers, space, underscore, dot and hyphen, and require .pptx or .ppt
  const re = /^[\p{L}\p{N}_ .-]+\.(pptx|ppt)$/u;
  return re.test(name);
}

function safeResolve(baseDir: string, target: string): string | null {
  const resolved = path.resolve(baseDir, target);
  if (!resolved.startsWith(path.resolve(baseDir) + path.sep)) return null;
  return resolved;
}

export async function uploadToGoogleSlidesHandler(c: Context) {
  try {
    logger.info({ route: '/ext-api/presentation/:fileName/upload-to-google-slides' }, 'Handling upload to Google Slides');
    const fileName = c.req.param('fileName');
    if (!fileName || !isValidPresentationName(fileName)) {
      logger.warn({ fileName }, 'Invalid or missing fileName');
      return c.json({ success: false, message: 'Invalid or missing fileName. Must be *.pptx or *.ppt' }, 400);
    }

    const baseDir = config.presentationsDir;
    const pptxPath = safeResolve(baseDir, fileName);
    if (!pptxPath) {
      logger.warn({ baseDir, fileName }, 'Path traversal detected or invalid path');
      return c.json({ success: false, message: 'Invalid path' }, 400);
    }
    try {
      await fs.access(pptxPath);
    } catch {
      logger.warn({ pptxPath }, 'PPTX not found');
      return c.json({ success: false, message: 'File not found' }, 404);
    }

    const baseName = path.parse(fileName).name;
    const folderId = process.env.GDRIVE_FOLDER_ID;
    const serviceAccountJson = process.env.GSA_KEY_JSON;
    logger.info({ pptxPath, baseName, hasFolderId: !!folderId }, 'Starting upload to Google Slides');

    const res: any = await uploadToGoogleSlidesTool.execute({ context: { pptxPath, name: baseName, folderId, serviceAccountJson } } as any);
    if (!res.success) {
      logger.error({ message: res.message, error: res.error }, 'Upload to Google Slides failed');
      return c.json({ success: false, message: res.message ?? 'Upload failed', error: res.error }, 500);
    }
    logger.info({ id: res.data.id, hasWebViewLink: !!res.data.webViewLink }, 'Upload to Google Slides succeeded');
    return c.json({ success: true, data: { id: res.data.id, webViewLink: res.data.webViewLink } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal error';
    logger.error({ error }, 'Unexpected error in uploadToGoogleSlidesHandler');
    return c.json({ success: false, message }, 500);
  }
}

