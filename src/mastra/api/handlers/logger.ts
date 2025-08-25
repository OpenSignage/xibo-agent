/*
 * Copyright (C) 2024 OpenSignage Project.
 * All rights reserved.
 *
 * This software is licensed under the Elastic License 2.0 (ELv2).
 * You may obtain a copy of the license at:
 * https://www.elastic.co/licensing/elastic-license
 */

/**
 * Logger Configuration
 * 
 * This module provides a centralized logging instance for the API handlers.
 * It uses @mastra/core/logger to create a consistent logging interface.
 * 
 * Usage:
 * import { logger } from './logger';
 * 
 * logger.info('Message', { data });
 * logger.error('Error message', { error });
 */

import { ConsoleLogger } from '@mastra/core/logger';

// Create shared logger instance for centralized logging
export const logger = new ConsoleLogger({
  name: 'Xibo-Agent-API',
  level: 'info',  // Set to info level to exclude debug logs
});