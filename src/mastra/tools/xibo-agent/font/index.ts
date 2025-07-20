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
 * @module FontTools
 * @description Barrel file for font-related tools.
 * This module aggregates and exports all tools for managing fonts
 * in the Xibo CMS, such as retrieving, uploading, and deleting fonts.
 */

export { getFonts } from './getFonts';
export { getFontDetails } from './getFontDetails';
export { uploadFont } from './uploadFont';
export { downloadFont } from './downloadFont';
export { deleteFont } from './deleteFont';