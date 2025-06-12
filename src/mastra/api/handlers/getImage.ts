/*
 * Copyright (C) 2024 OpenSignage Project.
 * All rights reserved.
 *
 * This software is licensed under the Elastic License 2.0 (ELv2).
 * You may obtain a copy of the license at:
 * https://www.elastic.co/licensing/elastic-license
 */

/**
 * Get Image API Handler
 * Serves generated images through ext-api
 * URL format: /ext-api/getImage/{filename}
 */

import { Context } from 'hono';
import * as path from 'path';
import * as fs from 'fs';
import { logger } from './logger';

export const getImageHandler = async (c: Context) => {
  try {
    const filename = c.req.param('filename');
    if (!filename) {
      logger.error('getImage: No filename provided');
      return c.json({ error: 'No filename provided' }, 400);
    }

    // Debug: Check current working directory
    logger.info('getImage: Current working directory', { cwd: process.cwd() });

    // Build image file path
    const imagePath = path.join(process.cwd(), '..', '..', 'persistent_data', 'generated', filename);

    // Check if file exists
    if (!fs.existsSync(imagePath)) {
      logger.error(`getImage: Image file not found: ${imagePath}`);
      return c.json({ error: 'Image not found' }, 404);
    }

    // Send image file
    logger.info(`getImage: Serving image: ${imagePath}`);
    const imageBuffer = fs.readFileSync(imagePath);
    return c.body(imageBuffer, {
      headers: {
        'Content-Type': 'image/png',
      },
    });

  } catch (error) {
    logger.error('getImage: An error occurred:', { error: error instanceof Error ? error.message : String(error) });
    return c.json({ error: 'Internal server error' }, 500);
  }
}; 