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
 * Xibo CMS Resolution Management Tools Index
 * 
 * This module exports all resolution-related tools for Xibo CMS integration.
 * It provides a centralized export point for resolution management functionality
 * including retrieval, creation, editing, and deletion operations.
 */

export { getResolutions } from './getResolutions';
export { addResolution } from './addResolution';
export { editResolution } from './editResolution';
export { deleteResolution } from './deleteResolution';