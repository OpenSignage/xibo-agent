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

import { config } from "../config";

/**
 * Generate authentication headers for Xibo CMS API requests
 * Using Basic Authentication with clientId and clientSecret
 */
export const getAuthHeaders = async () => {
  // Create Basic auth token from client credentials
  const authToken = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');
  
  return {
    "Content-Type": "application/json",
    "Authorization": `Basic ${authToken}`
  };
}; 