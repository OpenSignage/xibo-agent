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

import { logger } from '../../../index';

/**
 * Converts a date string to Y-m-d format
 * @param dateStr Date string to convert
 * @returns Converted date string (Y-m-d format) or null if invalid date
 */
export const validateAndFormatDate = (dateStr: string): string | null => {
  try {
    // Support various date formats
    const date = new Date(dateStr);
    
    // Return null for invalid dates
    if (isNaN(date.getTime())) {
      return null;
    }

    // Convert to Y-m-d format
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  } catch (error) {
    logger.error('Failed to convert date', { error, dateStr });
    return null;
  }
}; 