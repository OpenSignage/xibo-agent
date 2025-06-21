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
 * Layout Management Module
 * 
 * This module exports all layout-related tools for interacting with Xibo CMS.
 * Includes operations for creating, modifying, displaying, publishing, and removing layouts.
 */


export { getLayouts } from './getLayouts';
export { addLayout } from './addLayout';
export { deleteLayout } from './deleteLayout';
export { copyLayout } from './copyLayout';
export { editLayout } from './editLayout';
export { publishLayout } from './publishLayout';
export { retireLayout } from './retireLayout';
export { unretireLayout } from './unretireLayout';
export { clearLayout } from './clearLayout';
export { getLayoutStatus } from './getLayoutStatus';
export { checkoutLayout } from './checkoutLayout';
export { discardLayout } from './discardLayout';
export { positionRegions } from './positionRegions';
export { editLayoutBackground } from './editLayoutBackground';
export { applyLayoutTemplate } from './applyLayoutTemplate';
export { setLayoutEnableStat } from './setLayoutEnableStat';
export { tagLayout } from './tagLayout';
export { untagLayout } from './untagLayout';
export { addFullscreenLayout } from './addFullscreenLayout';
export { addRegion } from './addRegion';
export { editRegion } from './editRegion';
export { deleteRegion } from './deleteRegion';
export { addDrawerRegion } from './addDrawerRegion';
export { saveDrawerRegion } from './saveDrawerRegion';
export { positionAllRegions } from './positionAllRegions';






