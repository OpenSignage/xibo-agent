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
 * Configuration for the Xibo Manual Tool
 *
 * This module defines configuration settings for the xiboManualTool,
 * including base URLs for the manual and images, and paths to local
 * manual content files. It dynamically locates the project root
 * to ensure path robustness.
 */
import path from 'path';

// `find-up` は `mastra dev` の環境で予期せぬ動作をするため、
// コマンド実行時のカレントディレクトリを直接使用します。
// これにより、常にプロジェクトルートが正しく取得されます。
const projectRoot = process.cwd();

export const config = {
  // Base URL for the Xibo manual web pages.
  baseUrl: 'https://sigme.net/manual-r4/ja/',
  // Base URL for resolving relative image paths found in the manual content.
  imageBaseUrl: 'https://xibosignage.com/',
  paths: {
    // The absolute path to the project root.
    root: projectRoot,
    // The absolute path to the directory containing the local manual markdown files.
    contents: path.join(projectRoot, 'src/mastra/tools/xibo-manual/contents'),
  },
} as const;

// Exports the configuration type for use in other modules.
export type Config = typeof config; 