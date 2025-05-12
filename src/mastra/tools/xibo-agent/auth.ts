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
 * Authentication Module for Xibo CMS API
 * 
 * This module handles authentication with the Xibo CMS API using OAuth2 client credentials.
 * It provides functions to obtain access tokens and generate authenticated request headers.
 */

import { config } from "./config";
import { logger } from '../../index';

/**
 * Requests an OAuth2 access token from the Xibo CMS API
 * 
 * Uses client credentials flow to authenticate with the CMS.
 * The obtained token is used for subsequent API requests.
 * 
 * @returns {Promise<string>} The access token for API authentication
 * @throws {Error} If token acquisition fails
 */
export const getAccessToken = async () => {
  const tokenUrl = `${config.cmsUrl}/api/authorize/access_token`;
  logger.debug(`Requesting access token from: ${tokenUrl}`);
  
  try {
    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: config.clientId,
        client_secret: config.clientSecret,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`Access token request failed: ${response.status} ${response.statusText}`, {
        url: tokenUrl,
        statusCode: response.status,
        response: errorText
      });
      throw new Error(`Failed to obtain access token: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    logger.info(`Access token obtained successfully`);
    
    // Log token expiration details if available
    if (data.expires_in) {
      logger.debug(`Token will expire in ${data.expires_in} seconds`);
    }
    
    return data.access_token;
  } catch (error) {
    // Handle network or other errors
    logger.error(`Error in token acquisition process`, { error });
    throw error; // Re-throw for caller to handle
  }
};

/**
 * Generates HTTP headers with authorization for Xibo API requests
 * 
 * @returns {Promise<Object>} Headers object with Authorization bearer token
 */
export const getAuthHeaders = async () => {
  logger.debug('Preparing authenticated request headers');
  
  try {
    const accessToken = await getAccessToken();
    const headers = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessToken}`,
    };
    
    logger.debug('Authentication headers created successfully');
    return headers;
  } catch (error) {
    logger.error('Failed to create authentication headers', { error });
    throw error; // Re-throw for caller to handle
  }
}; 