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
 * Xibo CMS Layout Background Setting Tool
 * 
 * This module provides functionality to set or change the background image
 * of a layout in the Xibo CMS system. It implements the layout/background/{id}
 * endpoint from Xibo API and allows users to specify a media item as background.
 */

import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { decodeErrorMessage } from "../utility/error";
import { logger } from '../../../index';

/**
 * Tool to set a background image for a layout
 * Implements the layout/background endpoint from Xibo API
 * Changes only the background image while preserving other layout properties
 */
export const setLayoutBackground = createTool({
  id: 'set-layout-background',
  description: 'Set a background image for a layout',
  inputSchema: z.object({
    layoutId: z.number().describe('ID of the layout to set background for'),
    backgroundImageId: z.number().describe('ID of the background image to set'),
    backgroundColor: z.string().optional().describe('HEX color code for layout background'),
    backgroundzIndex: z.number().optional().default(1).describe('Z-index for the background layer')
  }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        logger.error("setLayoutBackground: CMS URL is not configured");
        throw new Error("CMS URL is not configured");
      }

      logger.info(`Setting background for layout ${context.layoutId} with image ID: ${context.backgroundImageId}`);
      
      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/layout/background/${context.layoutId}`;

      // Prepare form data with required parameters
      const formData = new URLSearchParams();
      formData.append('backgroundImageId', context.backgroundImageId.toString());
      
      // Add optional parameters if provided
      if (context.backgroundColor) {
        formData.append('backgroundColor', context.backgroundColor);
        logger.debug(`Using background color: ${context.backgroundColor}`);
      } else {
        // API requires backgroundColor even when setting image
        formData.append('backgroundColor', '#000000');
        logger.debug(`Using default background color: #000000`);
      }
      
      // BackgroundzIndex is required by API
      const zIndex = context.backgroundzIndex || 1;
      formData.append('backgroundzIndex', zIndex.toString());
      logger.debug(`Using background z-index: ${zIndex}`);
      
      logger.debug(`Sending PUT request to ${url}`);
      const response = await fetch(url, {
        method: 'PUT', // API requires PUT for this endpoint
        headers: {
          ...headers,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData.toString()
      });

      if (!response.ok) {
        const responseText = await response.text();
        const errorMessage = decodeErrorMessage(responseText);
        logger.error(`Failed to set background for layout ${context.layoutId}: ${errorMessage}`, {
          statusCode: response.status,
          response: responseText
        });
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorMessage}`);
      }

      logger.info(`Successfully set background image ${context.backgroundImageId} for layout ${context.layoutId}`);
      return "Layout background image set successfully";
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error(`setLayoutBackground: An error occurred: ${errorMessage}`, { error });
      return `Error: ${errorMessage}`;
    }
  },
}); 