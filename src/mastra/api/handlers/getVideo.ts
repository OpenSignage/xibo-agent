/*
 * Copyright (C) 2024 OpenSignage Project.
 * All rights reserved.
 *
 * This software is licensed under the Elastic License 2.0 (ELv2).
 * You may obtain a copy of the license at:
 * https://www.elastic.co/licensing/elastic-license
 */

/**
 * Get Video API Handler
 * Serves generated videos through ext-api
 * URL format: /ext-api/getVideo/{filename}
 */

import { Context } from 'hono';
import * as path from 'path';
import * as fs from 'fs';
import { logger } from './logger';
import { config } from '../../tools/xibo-agent/config';

export const getVideoHandler = async (c: Context) => {
  try {
    const filename = c.req.param('filename');
    if (!filename) {
      logger.error('getVideo: No filename provided');
      return c.json({ error: 'No filename provided' }, 400);
    }

    const videoPath = path.join(config.generatedDir, filename);

    if (!fs.existsSync(videoPath)) {
      logger.error(`getVideo: Video file not found: ${videoPath}`);
      return c.json({ error: 'Video not found' }, 404);
    }

    logger.info(`getVideo: Serving video: ${videoPath}`);
    const videoBuffer = fs.readFileSync(videoPath);
    return c.body(videoBuffer, {
      headers: {
        'Content-Type': 'video/mp4',
      },
    });

  } catch (error) {
    logger.error('getVideo: An error occurred:', { error: error instanceof Error ? error.message : String(error) });
    return c.json({ error: 'Internal server error' }, 500);
  }
}; 