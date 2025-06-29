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
 * @module PlayerSoftwareTools
 * @description This module exports all tools related to player software management in Xibo.
 * It serves as a central point for accessing tools that handle deleting, downloading,
 * editing, and uploading player software versions.
 */
export { deletePlayerVersion } from "./deletePlayerVersion";
export { downloadPlayerVersion } from "./downloadPlayerVersion";
export { editPlayerVersion } from "./editPlayerVersion";
export { uploadPlayerSoftware } from "./uploadPlayerSoftware"; 