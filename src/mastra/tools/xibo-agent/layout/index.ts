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

// Basic layout operations
export { getLayouts } from './getLayouts';
export { addLayout } from './addLayout';
export { deleteLayout } from './deleteLayout';
export { copyLayout } from './copyLayout';

// Layout status management
export { publishLayout } from './publishLayout';
export { retireLayout } from './retireLayout';
export { unretireLayout } from './unretireLayout';
export { clearLayout } from './clearLayout';
export { getLayoutStatus } from './getLayoutStatus';
export { checkoutLayout } from './checkoutLayout';
export { discardLayout } from './discardLayout';

// Layout content management
export { positionRegions } from './positionRegions';
export { setLayoutBackground } from './setLayoutBackground';
export { applyLayoutTemplate } from './applyLayoutTemplate';
export { setLayoutEnableStat } from './setLayoutEnableStat';

// Layout tagging
export { tagLayout } from './tagLayout';
export { untagLayout } from './untagLayout';

// Layout usage information
export { getLayoutUsage } from './getLayoutUsage';
export { getLayoutUsageByLayouts } from './getLayoutUsageByLayouts';
export { getLayoutUsageByPlaylists } from './getLayoutUsageByPlaylists';
export { getLayoutUsageByDisplays } from './getLayoutUsageByDisplays';
export { getLayoutUsageByCampaigns } from './getLayoutUsageByCampaigns'; 