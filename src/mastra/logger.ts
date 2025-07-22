/*
 * Copyright (C) 2025 Open Source Digital Signage Initiative.
 * ...
 */
import pino from 'pino';
import { resolve } from 'path';
import { config } from './tools/xibo-agent/config';

export const logger = pino(
  {
    level: process.env.LOG_LEVEL || 'info',
  },
  pino.transport({
    targets: [
      {
        level: 'info',
        target: 'pino-pretty',
        options: {
          colorize: true,
        },
      },
      {
        level: 'info',
        target: 'pino-roll',
        options: {
          file: resolve(config.logsDir, 'xibo-agent.log'),
          frequency: 'daily',
          pattern: '.yyyy-MM-dd',
          maxFiles: 14,
          mkdir: true,
        },
      },
    ],
  }),
); 