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
 * @module UserTools
 * @description This module aggregates and exports all user-related tools for the Xibo CMS.
 * It provides a single point of access for functionalities such as creating, retrieving,
 * updating, and deleting users, as well as managing permissions and preferences.
 */
export { addUser } from './addUser';
export { deleteUser } from './deleteUser';
export { editUser } from './editUser';
export { editUserPref } from './editUserPref';
export { getMultiEntityPermissions } from './getMultiEntityPermissions';
export { getUser } from './getUser';
export { getUserMe } from './getUserMe';
export { getUserPermissions } from './getUserPermissions';
export { setMultiEntityPermissions } from './setMultiEntityPermissions';
export { setUserPermissions } from './setUserPermissions';
export { getUserPref } from './getUserPref';
export { addUserPref } from './addUserPref';