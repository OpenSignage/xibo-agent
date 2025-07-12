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
 * @module StatisticsTools
 * @description This module aggregates and exports all statistics-related tools
 * for the Xibo CMS. It provides a single point of access for functionalities
 * such as retrieving proof-of-play stats, disconnected time, and export counts.
 */
export { getExportStatsCount } from './getExportStatsCount';
export { getStats } from './getStats';
export { getTimeDisconnected } from './getTimeDisconnected';