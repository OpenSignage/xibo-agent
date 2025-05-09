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
 * Xibo CMS Display Management Tools
 * 
 * This module exports tools for managing displays in the Xibo CMS system.
 * These tools allow for retrieving display information, editing display settings,
 * managing display status, and controlling display behavior remotely.
 * 
 * The tools provide functionality ranging from basic status checks to advanced
 * operations like Wake-on-LAN and license management.
 */

export { getDisplays } from './getDisplays';
export { editDisplay } from './editDisplay';
export { wakeOnLan } from './wakeOnLan';
export { toggleAuthorise } from './toggleAuthorise';
export { setDefaultLayout } from './setDefaultLayout';
export { checkLicence } from './checkLicence';
export { getDisplayStatus } from './getDisplayStatus';
export { purgeAll } from './purgeAll'; 