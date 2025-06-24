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
 * @module tags
 * @description This module serves as the entry point for all tag-related tools,
 * re-exporting them for easy consumption by other parts of the application.
 */

export { getTags } from "./getTags";
export { addTag } from "./addTag";
export { editTag } from "./editTag";
export { deleteTag } from "./deleteTag"; 