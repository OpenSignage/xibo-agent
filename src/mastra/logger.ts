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
          levelFirst: true,
          translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
          ignore: 'hostname',
          singleLine: false,
        },
      },
      {
        level: 'info',
        target: 'pino-roll',
        options: {
          file: resolve(config.logsDir, 'xibo-agent.log'),
          frequency: 'daily',
          dateFormat: 'yyyy-MM-dd',
          size: '1G',
          maxFiles: 7,
          mkdir: true,
        },
      },
    ],
  }),
); 