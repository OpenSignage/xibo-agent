/*
 * Copyright (C) 2025 Open Source Digital Signage Initiative.
 * All rights reserved.
 *
 * This software is licensed under the Elastic License 2.0 (ELv2).
 * You may obtain a copy of the license at:
 * https://www.elastic.co/licensing/elastic-license
 */

import { Context } from 'hono';
import path from 'path';
import fs from 'fs/promises';
import { config as toolsConfig } from '../../tools/xibo-agent/config';

const KIND = ['report', 'podcast', 'presentation'] as const;
type Kind = typeof KIND[number];

const validators: Record<Kind, (name: string) => boolean> = {
  // Allow Unicode letters/numbers, underscore, hyphen, dot and space; forbid path separators
  report: (n) => /^[\p{L}\p{N}_ .-]+\.(md|pdf)$/u.test(n) && !/[\\/]/.test(n),
  podcast: (n) => /^[\p{L}\p{N}_ .-]+\.(wav|mp3|m4a)$/u.test(n) && !/[\\/]/.test(n),
  presentation: (n) => /^[\p{L}\p{N}_ .-]+\.(pptx|ppt)$/u.test(n) && !/[\\/]/.test(n),
};

const baseDirs: Record<Kind, string> = {
  report: toolsConfig.reportsDir,
  podcast: path.join(toolsConfig.generatedDir, 'podcast'),
  presentation: toolsConfig.presentationsDir,
};

const safeResolve = (baseDir: string, fileName: string): string => {
  const abs = path.resolve(baseDir, fileName);
  // Ensure the resolved path stays within baseDir
  if (!abs.startsWith(baseDir + path.sep) && abs !== baseDir) {
    throw new Error('Invalid resolved path');
  }
  return abs;
};

const contentTypes: Record<Kind, string> = {
  report: 'text/markdown; charset=utf-8',
  podcast: 'audio/wav',
  presentation: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

export const downloadUnifiedHandler = async (c: Context) => {
  try {
    const { kind, fileName } = c.req.param();
    if (!kind || !KIND.includes(kind as Kind)) {
      return c.json({ error: 'Invalid kind. Use report|podcast|presentation' }, 400);
    }
    const k = kind as Kind;
    if (!fileName || !validators[k](fileName)) {
      return c.json({ error: 'Invalid fileName for kind' }, 400);
    }
    let filePath: string;
    try {
      filePath = safeResolve(baseDirs[k], fileName);
    } catch {
      return c.json({ error: 'Invalid fileName for kind' }, 400);
    }
    try {
      await fs.access(filePath);
    } catch {
      return c.json({ error: 'File not found' }, 404);
    }
    const content = await fs.readFile(filePath);
    let resolvedContentType = contentTypes[k];
    if (k === 'report') {
      resolvedContentType = fileName.toLowerCase().endsWith('.pdf')
        ? 'application/pdf'
        : 'text/markdown; charset=utf-8';
    } else if (k === 'podcast') {
      const lower = fileName.toLowerCase();
      if (lower.endsWith('.mp3')) resolvedContentType = 'audio/mpeg';
      else if (lower.endsWith('.m4a')) resolvedContentType = 'audio/mp4';
      else resolvedContentType = 'audio/wav';
    } else if (k === 'presentation') {
      resolvedContentType = fileName.toLowerCase().endsWith('.ppt')
        ? 'application/vnd.ms-powerpoint'
        : 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    }
    // Build ASCII-safe Content-Disposition with RFC 5987 filename*
    const asciiFallback = fileName
      .replace(/["\\]/g, '_')
      .replace(/[^\x20-\x7E]/g, '_'); // ASCII printable only
    const encodedUtf8 = encodeURIComponent(fileName);
    const contentDisposition = `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodedUtf8}`;

    const headers = {
      'Content-Type': resolvedContentType,
      'Content-Disposition': contentDisposition,
      'Cache-Control': 'no-store',
    } as Record<string, string>;
    return new Response(content, { status: 200, headers });
  } catch (err) {
    return c.json({ error: 'Download failed' }, 500);
  }
};

