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
 * Xibo CMS Layout Template Application Tool
 *
 * This module provides functionality to apply a template to an existing layout
 * in the Xibo CMS system. It implements the layout/applyTemplate/{id} endpoint
 * from Xibo API, which replaces an existing layout with a template.
 */

import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { decodeErrorMessage } from "../utility/error";
import { logger } from '../../../index';

/**
 * Tool to apply a template to an existing layout
 * Implements the layout/applyTemplate endpoint from Xibo API
 * This operation replaces the content of the target layout with the selected template
 */
export const applyLayoutTemplate = createTool({
  id: 'apply-layout-template',
  description: 'Apply a template to an existing layout',
  inputSchema: z.object({
    layoutId: z.number().describe('ID of the layout to apply template to'),
    templateId: z.number().describe('ID of the template to apply')
  }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        logger.error("applyLayoutTemplate: CMS URL is not configured");
        throw new Error("CMS URL is not configured");
      }

      logger.info(`Applying template ID ${context.templateId} to layout ID ${context.layoutId}`);
      
      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/layout/applyTemplate/${context.layoutId}`;

      // Prepare form data with required parameters
      const formData = new URLSearchParams();
      formData.append('templateId', context.templateId.toString());
      
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
        logger.error(`Failed to apply template to layout ${context.layoutId}: ${errorMessage}`, {
          statusCode: response.status,
          response: responseText,
          templateId: context.templateId
        });
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorMessage}`);
      }

      // Log successful operation
      logger.info(`Successfully applied template ${context.templateId} to layout ${context.layoutId}`);
      return "Template applied successfully";
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error(`applyLayoutTemplate: An error occurred: ${errorMessage}`, { error });
      return `Error: ${errorMessage}`;
    }
  },
}); 