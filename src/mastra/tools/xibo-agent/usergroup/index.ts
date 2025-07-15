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
 * @module userGroupTools
 * @description This module serves as the entry point for all tools related to
 * user group management in the Xibo CMS. It exports all available user group tools.
 */

// Export all user group related tools
export { getUserGroups } from './getUserGroups';
export { addUserGroup } from './addUserGroup';
export { editUserGroup } from './editUserGroup';
export { deleteUserGroup } from './deleteUserGroup';
export { copyUserGroup } from './copyUserGroup';
export { assignUserToGroup } from './assignUserToGroup';
export { unassignUserFromGroup } from './unassignUserFromGroup';
