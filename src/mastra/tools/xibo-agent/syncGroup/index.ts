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
 * @module syncGroup/index
 * @description This index file exports all the tools related to sync group management,
 * making them available for use throughout the application.
 */

export { getSyncGroups } from "./getSyncGroups";
export { addSyncGroup } from "./addSyncGroup";
export { editSyncGroup } from "./editSyncGroup";
export { deleteSyncGroup } from "./deleteSyncGroup";
export { getSyncGroupDisplays } from "./getSyncGroupDisplays";
export { assignSyncGroupMembers } from "./assignSyncGroupMembers"; 