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
 * @module
 * This module aggregates and exports all tools related to display management
 * in the Xibo CMS. It provides a single point of access for functionalities
 * like retrieving display information, editing settings, and controlling state.
 */

export { getDisplays } from './getDisplays';
export { toggleAuthoriseForDisplay } from './toggleAuthoriseForDisplay';
export { setDefaultLayoutForDisplay } from './setDefaultLayoutForDisplay';
export { checkDisplayLicence } from './checkDisplayLicence';
export { getDisplayStatus } from './getDisplayStatus';
export { purgeAllMediaFromDisplay } from './purgeAllMediaFromDisplay';
export { editDisplay } from './editDisplay';
export { requestDisplayScreenshot } from './requestDisplayScreenshot';
export { deleteDisplay } from './deleteDisplay';
export { wakeDisplayOnLan } from './wakeDisplayOnLan';
