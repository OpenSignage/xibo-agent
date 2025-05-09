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
 * Xibo CMS User Management Tools
 * 
 * This module exports a comprehensive set of tools for managing users in the Xibo CMS.
 * Functionality includes creating, retrieving, updating, and deleting users, as well as
 * managing user permissions and preferences.
 * 
 * These tools provide access to both basic user operations and advanced permission
 * management capabilities for system administrators.
 */

export { getUser } from './getUser';
export { getUsers } from './getUsers';
export { getUserMe } from './getUserMe';
export { addUser } from './addUser';
export { editUser } from './editUser';
export { deleteUser } from './deleteUser';
export { getUserPermissions } from './getUserPermissions';
export { setUserPermissions } from './setUserPermissions';
export { getUserPreferences } from './getUserPreferences';
export { setUserPreferences } from './setUserPreferences';
export { getMultiEntityPermissions } from './getMultiEntityPermissions';
export { setMultiEntityPermissions } from './setMultiEntityPermissions'; 