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
 * getGoogleFonts.ts
 * 
 * Xibo Agent Tool to fetch Google Fonts metadata from the Google Fonts Developer API
 * API specification: https://developers.google.com/fonts/docs/developer_api
 */

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { logger } from '../../../index';

// Valid sort options for Google Fonts API
const SORT_OPTIONS = ['alpha', 'date', 'popularity', 'style', 'trending'] as const;

// Valid category options for font filtering
const CATEGORY_OPTIONS = ['serif', 'sans-serif', 'monospace', 'display', 'handwriting'] as const;

// Valid capability options
const CAPABILITY_OPTIONS = ['VF', 'WOFF2'] as const;

/**
 * Tool to retrieve font information from Google Fonts API
 * 
 * This tool fetches metadata about available fonts from the Google Fonts Developer API.
 * It allows filtering by various criteria and sorting the results.
 * API key is automatically loaded from environment variables.
 */
export const getGoogleFonts = createTool({
  id: 'get-google-fonts',
  description: 'Fetches font metadata from the Google Fonts Developer API',
  inputSchema: z.object({
    family: z.string().optional().describe('Filter by font family name'),
    subset: z.string().optional().default('japanese').describe('Filter by font subset name (e.g., latin, cyrillic, greek, japanese)'),
    category: z.enum(CATEGORY_OPTIONS).optional().describe('Filter by font category (serif, sans-serif, monospace, display, handwriting)'),
    capability: z.enum(CAPABILITY_OPTIONS).array().optional().default(['VF']).describe('Filter by font capability (VF for variable fonts, WOFF2 for WOFF2 format)'),
    sort: z.enum(SORT_OPTIONS).optional().describe('Sort order for results (alpha, date, popularity, style, trending)'),
    limit: z.number().optional().describe('Maximum number of fonts to return (default: 20)'),
  }),
  outputSchema: z.any(),
  execute: async ({ context }) => {
    try {
      // Get API key from environment variables
      const apiKey = process.env.GOOGLE_FONTS_API_KEY;
      
      if (!apiKey) {
        throw new Error('Google Fonts API Key is not set in environment variables (GOOGLE_FONTS_API_KEY)');
      }

      // Extract parameters from context with defaults
      const family = context?.family;
      const subset = context?.subset || 'japanese';
      const category = context?.category;
      const capability = context?.capability || ['VF'];
      const sort = context?.sort;
      const limit = context?.limit || 20;

      // Build URL parameters
      const params = new URLSearchParams();
      params.append('key', apiKey);
      
      if (family) params.append('family', family);
      if (subset) params.append('subset', subset);
      if (category) params.append('category', category);
      if (sort) params.append('sort', sort);
      
      // Add capability parameters (can be multiple)
      if (capability && capability.length > 0) {
        capability.forEach(cap => params.append('capability', cap));
      }

      const apiUrl = `https://www.googleapis.com/webfonts/v1/webfonts?${params.toString()}`;
      
      // Log request with masked API key for security
      logger.info(`Fetching Google Fonts data with filters: ${params.toString().replace(/key=[^&]+/, 'key=***')}`);
      
      // Call the Google Fonts API
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Google Fonts API returned an error: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      const data = await response.json();
      
      // Limit the number of results if needed
      if (data.items && data.items.length > limit) {
        data.items = data.items.slice(0, limit);
      }
      
      logger.info(`Retrieved ${data.items?.length || 0} fonts from Google Fonts API`);
      
      // Return structured response
      return {
        success: true,
        total: data.items?.length || 0,
        fonts: data.items || [],
        kind: data.kind,
      };
    } catch (error) {
      // Log and return error information
      logger.error('Error fetching Google Fonts data:', { error: error instanceof Error ? error.message : 'Unknown error' });
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch Google Fonts data',
      };
    }
  }
}); 