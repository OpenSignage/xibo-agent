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
 * manual content files.
 */
import path from 'path';

// Get the current working directory.
const CWD = process.cwd();

// In `run dev` mode, CWD points to `.mastra/output`, so we need to resolve
// the project root by going up two directories. In other environments
// (e.g., build, test), CWD is the project root itself.
const projectRoot = CWD.includes('.mastra/output')
  ? path.resolve(CWD, '..', '..')
  : CWD;

export const config = {
  // Base URL for the Xibo manual web pages.
  baseUrl: 'https://sigme.net/manual-r4/ja/',
  // Base URL for resolving relative image paths found in the manual content.
  imageBaseUrl: 'https://xibosignage.com/',
  paths: {
    // The absolute path to the project root.
    root: projectRoot,
    // The manual content is treated as persistent data, separate from source code.
    contents: path.join(projectRoot, 'persistent_data/manual-contents'),
  },
} as const;

// Exports the configuration type for use in other modules.
export type Config = typeof config; 