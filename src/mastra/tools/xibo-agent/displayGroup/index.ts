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
 * This module aggregates and exports all tools related to display group management
 * in the Xibo CMS. It provides a single point of access for functionalities
 * like creating, editing, deleting, and managing display groups.
 */

export { getDisplayGroups } from './getDisplayGroups';
export { addDisplayGroup } from './addDisplayGroup';
export { editDisplayGroup } from './editDisplayGroup';
export { deleteDisplayGroup } from './deleteDisplayGroup';
export { assignDisplaysToDisplayGroup } from './assignDisplaysToDisplayGroup';
export { unassignDisplaysFromDisplayGroup } from './unassignDisplaysFromDisplayGroup';
export { collectNowForDisplayGroup } from './collectNowForDisplayGroup';
export { clearStatsAndLogsForDisplayGroup } from './clearStatsAndLogsForDisplayGroup';
export { revertDisplayGroupToSchedule } from './revertDisplayGroupToSchedule';
export { sendCommandToDisplayGroup } from './sendCommandToDisplayGroup';
export { copyDisplayGroup } from './copyDisplayGroup';
export { selectFolderForDisplayGroup } from './selectFolderForDisplayGroup';
export { triggerWebhookForDisplayGroup } from './triggerWebhookForDisplayGroup';
 