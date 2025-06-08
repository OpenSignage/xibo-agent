/*
 * Copyright (C) 2024 OpenSignage Project.
 * All rights reserved.
 *
 * This software is licensed under the Elastic License 2.0 (ELv2).
 * You may obtain a copy of the license at:
 * https://www.elastic.co/licensing/elastic-license
 */

/**
 * API Module Logger Configuration
 * 
 * Provides a centralized logging solution for the API module.
 * This logger is independent from the main Mastra logger.
 */

import { createLogger } from '@mastra/core/logger';

// APIモジュール用のロガーインスタンスを作成
export const logger = createLogger({
  name: 'Mastra-API',
  level: 'info',
  // API固有の設定をここに追加
}); 